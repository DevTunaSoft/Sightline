import {
  DEFAULT_MODEL, appendObservation, frameDifference, pixelsFingerprint, toMarkdown
} from './vision-core.js';
import { analyzeFrame, loadVisionModels } from './client.js';

const $ = (id) => document.getElementById(id);
const ui = Object.fromEntries([
  'connection', 'sourceTag', 'monitorTag', 'tabBtn', 'shareBtn', 'fileBtn',
  'fileInput', 'preview', 'previewEmpty', 'videoSource', 'liveFlag',
  'snapshotBtn', 'stopBtn', 'captureStatus', 'autoToggle', 'cadence',
  'conversation', 'questionForm', 'question', 'askBtn', 'clearBtn',
  'exportBtn', 'exportJsonBtn', 'modelSelect', 'refreshModels'
].map((id) => [id, $(id)]));

const state = {
  mode: 'none', stream: null, screenVideo: document.createElement('video'),
  fileUrl: null, frame: null, lastAutomaticFingerprint: null,
  observations: [], model: DEFAULT_MODEL, busy: false,
  timer: null, epoch: 0, controller: null
};
state.screenVideo.autoplay = true;
state.screenVideo.muted = true;
state.screenVideo.playsInline = true;

function status(message, isError = false) {
  ui.captureStatus.textContent = message;
  ui.captureStatus.classList.toggle('error', isError);
}
function sourceLabel() {
  return ({ none: 'NO SOURCE', tab: 'TAB SNAPSHOT', share: 'LIVE SHARE', file: 'VIDEO FILE' })[state.mode];
}
function syncControls() {
  ui.sourceTag.textContent = sourceLabel();
  ui.liveFlag.hidden = state.mode !== 'share';
  ui.snapshotBtn.disabled = state.mode === 'none' || state.busy;
  ui.stopBtn.disabled = state.mode === 'none';
  ui.askBtn.disabled = state.busy || state.mode === 'none';
  ui.monitorTag.textContent = ui.autoToggle.checked ? 'ACTIVE' : 'OFF';
  ui.videoSource.hidden = state.mode !== 'file';
  ui.preview.hidden = state.mode === 'file' || !state.frame;
  ui.previewEmpty.hidden = state.mode === 'file' || !!state.frame;
  ui.previewEmpty.setAttribute('aria-hidden', String(ui.previewEmpty.hidden));
}
function showFrame(frame) {
  state.frame = frame;
  if (state.mode !== 'file') ui.preview.src = `data:image/jpeg;base64,${frame.image}`;
  syncControls();
}
function resetSource() {
  state.epoch++;
  state.controller?.abort();
  state.controller = null;
  state.busy = false;
  ui.autoToggle.checked = false;
  if (state.timer !== null) clearInterval(state.timer);
  state.timer = null;
  for (const track of state.stream?.getTracks() || []) track.stop();
  state.stream = null;
  state.screenVideo.pause();
  state.screenVideo.srcObject = null;
  ui.videoSource.pause();
  ui.videoSource.removeAttribute('src');
  ui.videoSource.load();
  if (state.fileUrl) URL.revokeObjectURL(state.fileUrl);
  state.fileUrl = null;
  state.mode = 'none';
  state.frame = null;
  state.lastAutomaticFingerprint = null;
  ui.preview.removeAttribute('src');
  status('Capture stopped. Session notes stay in memory until cleared or the panel closes.');
  syncControls();
}

async function packFrameFromCanvas(canvas) {
  const small = document.createElement('canvas');
  small.width = 10;
  small.height = 10;
  const smallCtx = small.getContext('2d', { willReadFrequently: true });
  smallCtx.drawImage(canvas, 0, 0, 10, 10);
  const data = smallCtx.getImageData(0, 0, 10, 10).data;
  return {
    image: canvas.toDataURL('image/jpeg', 0.74).split(',')[1],
    fingerprint: pixelsFingerprint(data, 10, 10),
    at: new Date().toISOString()
  };
}
function boundedDimensions(width, height) {
  if (!width || !height) throw new Error('There is no video frame available yet. Play the video or try again.');
  const ratio = Math.min(1, 1100 / width, 760 / height);
  return [Math.max(1, Math.floor(width * ratio)), Math.max(1, Math.floor(height * ratio))];
}
async function captureVideoFrame(video) {
  const [width, height] = boundedDimensions(video.videoWidth, video.videoHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  ctx.drawImage(video, 0, 0, width, height);
  return packFrameFromCanvas(canvas);
}
async function compressDataUrl(dataUrl) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const [width, height] = boundedDimensions(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  return packFrameFromCanvas(canvas);
}
async function captureFrame() {
  if (state.mode === 'tab') return state.frame;
  if (state.mode === 'share') return captureVideoFrame(state.screenVideo);
  if (state.mode === 'file') return captureVideoFrame(ui.videoSource);
  throw new Error('Choose a source before asking the AI.');
}

async function captureCurrentTab() {
  resetSource();
  const epoch = state.epoch;
  try {
    status('Capturing the active browser tab…');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId == null) throw new Error('No browser tab is active.');
    const data = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 83 });
    const frame = await compressDataUrl(data);
    if (epoch !== state.epoch) return;
    state.mode = 'tab';
    showFrame(frame);
    status('Tab captured. Ask a question or click Analyze a frame. To refresh, capture the tab again.');
  } catch (error) {
    if (epoch !== state.epoch) return;
    status(`Tab capture failed: ${error.message}. Click the extension toolbar icon on the tab you want to analyze.`, true);
  }
}

async function startScreenShare() {
  resetSource();
  const epoch = state.epoch;
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
    if (epoch !== state.epoch) { stream.getTracks().forEach((t) => t.stop()); return; }
    state.stream = stream;
    state.mode = 'share';
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) throw new Error('No video track was shared.');
    videoTrack.addEventListener('ended', () => {
      if (state.stream === stream) resetSource();
    }, { once: true });
    state.screenVideo.srcObject = stream;
    await state.screenVideo.play();
    if (epoch !== state.epoch) return;
    const frame = await captureVideoFrame(state.screenVideo);
    if (epoch !== state.epoch) return;
    showFrame(frame);
    status('Screen sharing active. Frame analysis only runs when requested or when Observation mode is enabled.');
  } catch (error) {
    if (epoch !== state.epoch) return;
    resetSource();
    status(`Sharing not started: ${error.message}`, true);
  }
}

function openVideoPicker() { ui.fileInput.click(); }
async function loadVideoFile(file) {
  if (!file) return;
  resetSource();
  if (!file.type.startsWith('video/')) { status('Choose a supported video file.', true); return; }
  state.fileUrl = URL.createObjectURL(file);
  state.mode = 'file';
  ui.videoSource.src = state.fileUrl;
  ui.videoSource.load();
  status(`Loaded ${file.name}. Press Play, then ask a question or enable periodic observations.`);
  syncControls();
}

function addEntry(item) {
  if (ui.conversation.querySelector('.placeholder')) ui.conversation.replaceChildren();
  const entry = document.createElement('article');
  entry.className = 'entry';
  const meta = document.createElement('div');
  meta.className = 'meta';
  const date = new Date(item.time);
  meta.textContent = `${Number.isNaN(date.getTime()) ? item.time : date.toLocaleTimeString()} • ${item.source}`;
  const q = document.createElement('div');
  q.className = 'question';
  q.textContent = item.question;
  const a = document.createElement('div');
  a.className = 'answer';
  a.textContent = item.text;
  entry.append(meta, q, a);
  ui.conversation.appendChild(entry);
  while (ui.conversation.children.length > 60) ui.conversation.firstChild.remove();
  ui.conversation.scrollTop = ui.conversation.scrollHeight;
}

async function askAI(question, frame = null, automatic = false) {
  if (state.busy) return;
  const epoch = state.epoch;
  let timeoutId;
  try {
    state.busy = true;
    syncControls();
    const current = frame || await captureFrame();
    if (!current) throw new Error('There is no captured frame available.');
    if (epoch !== state.epoch) return;
    showFrame(current);
    status(automatic ? 'Analyzing a changed frame locally…' : 'Asking the local vision model…');
    const controller = new AbortController();
    state.controller = controller;
    timeoutId = setTimeout(() => controller.abort(), 180_000);
    const answer = await analyzeFrame({
      model: state.model,
      question,
      imageBase64: current.image,
      source: state.mode,
      observations: state.observations
    }, fetch, controller.signal);
    if (epoch !== state.epoch) return;
    const item = { time: new Date().toISOString(), source: state.mode, question, text: answer };
    state.observations = appendObservation(state.observations, item);
    addEntry(item);
    if (automatic) state.lastAutomaticFingerprint = current.fingerprint;
    status('Analysis complete. Frames are not written to disk.');
  } catch (error) {
    if (epoch !== state.epoch) return;
    const message = error.name === 'AbortError' ? 'Local analysis was cancelled or timed out.' : error.message;
    status(`AI analysis failed: ${message}`, true);
    if (automatic) {
      ui.autoToggle.checked = false;
      syncAutoMode();
    }
  } finally {
    clearTimeout(timeoutId);
    if (epoch === state.epoch) {
      state.busy = false;
      state.controller = null;
      syncControls();
    }
  }
}

async function observationTick() {
  if (state.busy || !ui.autoToggle.checked) return;
  if (state.mode === 'file' && ui.videoSource.paused) return;
  if (state.mode !== 'share' && state.mode !== 'file') return;
  try {
    const frame = await captureFrame();
    if (state.lastAutomaticFingerprint && frameDifference(frame.fingerprint, state.lastAutomaticFingerprint) < 0.045) return;
    await askAI('Briefly describe this current frame, note visible text relevant to its meaning, and point out meaningful changes suggested by earlier observations. Do not invent events between sampled frames.', frame, true);
  } catch (error) { status(`Observation failed: ${error.message}`, true); }
}
function syncAutoMode() {
  if (state.timer !== null) clearInterval(state.timer);
  state.timer = null;
  if (ui.autoToggle.checked && state.mode !== 'share' && state.mode !== 'file') {
    ui.autoToggle.checked = false;
    status('To observe automatically, first share a screen or open a video file.', true);
  }
  if (ui.autoToggle.checked) {
    const ms = Math.max(6, Number(ui.cadence.value) || 12) * 1000;
    state.timer = setInterval(observationTick, ms);
    void observationTick();
  }
  syncControls();
}

function exportData(extension) {
  if (!state.observations.length) { status('Nothing to export yet. Analyze a frame first.', true); return; }
  const content = extension === 'json' ? JSON.stringify({ version: 1, observations: state.observations }, null, 2) : toMarkdown(state.observations);
  const type = extension === 'json' ? 'application/json' : 'text/markdown';
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `sightline-session-${new Date().toISOString().replace(/[:.]/g, '-') }.${extension}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  status('Observation notes exported to a local file.');
}

async function refreshModels() {
  ui.connection.textContent = 'Checking AI';
  ui.connection.classList.add('offline');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const names = await loadVisionModels(fetch, controller.signal);
    if (!names.length) throw new Error('No installed vision-capable models found. Try ollama pull gemma3:4b.');
    const current = names.includes(state.model) ? state.model : names.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : names[0];
    ui.modelSelect.replaceChildren();
    for (const name of names) {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      ui.modelSelect.appendChild(option);
    }
    ui.modelSelect.value = current;
    state.model = current;
    ui.connection.textContent = 'AI CONNECTED';
    ui.connection.classList.remove('offline');
    status('Connected to local Ollama. Select an installed vision model.');
  } catch (error) {
    ui.connection.textContent = 'AI OFFLINE';
    status(`Local AI unavailable: ${error.name === 'AbortError' ? 'Connection timed out' : error.message}. Start Ollama; for 403/CORS, allow this extension's origin with OLLAMA_ORIGINS (see README), restart Ollama, then Refresh.`, true);
  } finally { clearTimeout(timeout); }
}

ui.tabBtn.addEventListener('click', captureCurrentTab);
ui.shareBtn.addEventListener('click', startScreenShare);
ui.fileBtn.addEventListener('click', openVideoPicker);
ui.fileInput.addEventListener('change', (e) => { void loadVideoFile(e.target.files?.[0]); e.target.value = ''; });
ui.stopBtn.addEventListener('click', resetSource);
ui.snapshotBtn.addEventListener('click', () => void askAI('Describe this current image carefully. Read relevant visible text, and explain what it means. Be specific about uncertainty.'));
ui.questionForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const question = ui.question.value.trim();
  if (!question) { status('Type a question first.', true); return; }
  ui.question.value = '';
  void askAI(question);
});
ui.question.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ui.questionForm.requestSubmit(); }
});
ui.autoToggle.addEventListener('change', syncAutoMode);
ui.cadence.addEventListener('change', () => { if (ui.autoToggle.checked) syncAutoMode(); });
ui.modelSelect.addEventListener('change', () => { state.model = ui.modelSelect.value; });
ui.refreshModels.addEventListener('click', () => void refreshModels());
ui.clearBtn.addEventListener('click', () => {
  state.observations = [];
  ui.conversation.replaceChildren();
  const p = document.createElement('div');
  p.className = 'placeholder';
  p.textContent = 'Session notes cleared. The current captured frame is unchanged.';
  ui.conversation.appendChild(p);
  status('Session notes removed from memory.');
});
ui.exportBtn.addEventListener('click', () => exportData('md'));
ui.exportJsonBtn.addEventListener('click', () => exportData('json'));
window.addEventListener('pagehide', resetSource);
syncControls();
void refreshModels();
