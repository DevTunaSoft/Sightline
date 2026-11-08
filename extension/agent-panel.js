import { observeActiveTab } from './browser-bridge.js';
import { runBrowserTask } from './browser-task-runner.js';
import { runBrowserAcceptanceSelfTest } from './browser-self-test.js';
import { runLocalAIBrowserSelfTest } from './local-ai-self-test.js';
import { saveTaskCheckpoint, loadTaskCheckpoint, clearTaskCheckpoint } from './task-checkpoint.js';

const byId = id => document.getElementById(id);
const ui = {
  tag: byId('agentTag'), mode: byId('agentMode'), goal: byId('agentGoal'), aiTest: byId('localAiSelfTestBtn'),
  observe: byId('observePageBtn'), selfTest: byId('browserSelfTestBtn'), run: byId('runTaskBtn'), stop: byId('stopTaskBtn'), taskCancel: byId('cancelTaskBtn'),
  progress: byId('agentProgress'), report: byId('exportAgentReportBtn'), card: byId('confirmCard'), text: byId('confirmText'),
  confirm: byId('confirmActionBtn'), cancel: byId('cancelActionBtn'), model: byId('modelSelect'),
};

const state = { running: false, controller: null, pendingConfirmation: null, resume: null, checkpoint: null, taskId: null, stopIntent: null, lastReport: null };

function sync() {
  ui.run.disabled = state.running;
  ui.observe.disabled = state.running;
  ui.selfTest.disabled = state.running;
  ui.aiTest.disabled = state.running;
  ui.stop.disabled = !state.running;
  ui.taskCancel.disabled = !state.running;
  ui.report.disabled = state.running || !state.lastReport;
  ui.mode.disabled = state.running;
  ui.goal.disabled = state.running;
  ui.tag.textContent = state.running ? 'RUNNING' : state.resume ? 'RESUME READY' : 'READY';
}

function clearProgress(message = 'No browser task is running.') {
  ui.progress.replaceChildren();
  const item = document.createElement('div');
  item.className = 'placeholder compact';
  item.textContent = message;
  ui.progress.appendChild(item);
}

function addProgress(label, detail = '') {
  ui.progress.querySelector('.placeholder')?.remove();
  const line = document.createElement('div');
  line.className = 'progress-line';
  const strong = document.createElement('strong');
  strong.textContent = label;
  line.append(strong, document.createTextNode(detail ? ` — ${detail}` : ''));
  ui.progress.appendChild(line);
  while (ui.progress.children.length > 40) ui.progress.firstChild.remove();
  ui.progress.scrollTop = ui.progress.scrollHeight;
}

function describeProgress(event) {
  if (event?.type === 'observed') return ['Observed', `${event.elementCount} controls · ${event.snapshotId}`];
  if (event?.type === 'planned') {
    const decision = event.decision;
    if (decision?.done) return ['Planner', `Complete: ${decision.result || 'task complete'}`];
    return ['Planner', `${decision?.action?.action || 'action'}${decision?.action?.ref ? ` ${decision.action.ref}` : ''}`];
  }
  if (event?.type === 'executed') return ['Executed', `${event.action?.action || 'action'} · ${event.result?.ok ? 'OK' : event.result?.code || 'failed'}`];
  if (event?.type === 'recovered') return ['Recovered', `${event.code} · re-observed and re-planning`];
  if (event?.type === 'vision-started') return ['Vision fallback', event.reason || 'Semantic page data was insufficient'];
  if (event?.type === 'vision-complete') return ['Vision complete', `${event.chars || 0} characters of bounded visual context`];
  if (event?.type === 'site-verified') return ['Verified', (event.verification?.evidence || []).join(' · ') || 'Site-specific evidence recorded'];
  return ['Progress', String(event?.type || 'update')];
}

function buildSafeReport(result) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    outcome: {
      ok: result?.ok === true,
      code: result?.code || null,
      actions: Array.isArray(result?.timeline) ? result.timeline.length : 0,
    },
    diagnostics: result?.diagnostics || { version: 1, events: [] },
    performance: result?.performance || {},
  };
}

function exportAgentReport() {
  if (!state.lastReport) return;
  const blob = new Blob([JSON.stringify(state.lastReport, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sightline-agent-report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function resolveConfirmation(value) {
  const pending = state.pendingConfirmation;
  state.pendingConfirmation = null;
  ui.card.hidden = true;
  if (pending) pending(Boolean(value));
}

async function markCheckpointForReview() {
  if (!state.checkpoint) return;
  try {
    state.checkpoint = await saveTaskCheckpoint({ ...state.checkpoint, requiresReview: true, status: 'interrupted' }, chrome);
  } catch {
    // Checkpoint failure must never authorize or block the confirmation itself.
  }
}

function requestConfirmation({ action, target, risk, skill, preview }) {
  if (state.pendingConfirmation) resolveConfirmation(false);
  void markCheckpointForReview();
  return new Promise(resolve => {
    state.pendingConfirmation = resolve;
    const targetName = target?.name || target?.role || action?.ref || 'this control';
    const parts = [
      risk?.reason || 'This action may have an external effect.',
      `Requested: ${action?.action || 'action'} on “${targetName}”.`,
    ];
    if (skill?.name && preview) {
      if (Number.isFinite(preview.visibleCount)) parts.push(`${skill.name} currently shows ${preview.visibleCount} matching messages/results.`);
      if (Array.isArray(preview.messageSamples) && preview.messageSamples.length) {
        parts.push(`Sample: ${preview.messageSamples.slice(0, 3).map(item => item.name).join(' | ')}`);
      }
    }
    ui.text.textContent = parts.join(' ');
    ui.card.hidden = false;
  });
}

async function observePage() {
  try {
    ui.tag.textContent = 'OBSERVING';
    const result = await observeActiveTab(chrome);
    clearProgress('');
    addProgress('Page ready', `${result.snapshot.elements.length} interactive controls found`);
    const sample = result.snapshot.elements.slice(0, 12)
      .map(element => `${element.ref} ${element.role} “${element.name || '(unnamed)'}”`).join('\n');
    if (sample) {
      const summary = document.createElement('div');
      summary.className = 'agent-summary';
      summary.textContent = sample;
      ui.progress.appendChild(summary);
    }
  } catch (error) {
    clearProgress(`Page observation failed: ${error.message}`);
    ui.tag.textContent = 'ERROR';
  } finally {
    if (!state.running && ui.tag.textContent !== 'ERROR') ui.tag.textContent = 'READY';
  }
}

async function restoreInterruptedTask() {
  try {
    const checkpoint = await loadTaskCheckpoint(chrome);
    if (!checkpoint || !['running', 'interrupted', 'failed'].includes(checkpoint.status)) return;
    state.resume = { timeline: checkpoint.timeline, actionsUsed: checkpoint.actionsUsed, visionFallbacksUsed: checkpoint.visionFallbacksUsed, tabId: checkpoint.tabId, taskOrigin: checkpoint.taskOrigin };
    state.checkpoint = checkpoint;
    state.taskId = checkpoint.taskId;
    ui.goal.value = checkpoint.goal;
    ui.mode.value = checkpoint.mode;
    if ([...ui.model.options].some(option => option.value === checkpoint.model)) ui.model.value = checkpoint.model;
    clearProgress(checkpoint.requiresReview
      ? 'Interrupted task restored. A prior consequential action was awaiting review; it will require fresh confirmation.'
      : `Interrupted task restored with ${checkpoint.actionsUsed} action(s) already counted. Click Run task to resume.`);
    sync();
  } catch (error) {
    addProgress('Checkpoint', `Could not restore prior task: ${error.message}`);
  }
}

async function runLocalAISelfTest() {
  if (state.running) return;
  state.running = true;
  state.lastReport = null;
  clearProgress('Testing extension-to-Ollama connection and local vision inference…');
  sync();
  try {
    const report = await runLocalAIBrowserSelfTest({ model: ui.model.value }, fetch);
    state.lastReport = {
      version: 1,
      type: 'local-ai-self-test',
      generatedAt: new Date().toISOString(),
      outcome: { ok: report.ok === true, code: report.code || null },
      model: report.model || null,
      inferenceMs: Number.isFinite(report.inferenceMs) ? report.inferenceMs : null,
      responseChars: Number.isFinite(report.responseChars) ? report.responseChars : null,
      checks: (report.checks || []).map(check => ({
        name: String(check.name || '').slice(0, 120),
        ok: check.ok === true,
        detail: String(check.detail || '').slice(0, 300),
      })),
    };
    for (const check of report.checks || []) {
      addProgress(check.ok ? 'PASS' : 'FAIL', `${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
    }
    addProgress(report.ok ? 'Local AI ready' : 'Local AI test stopped', report.code || (report.ok ? 'PASS' : 'FAIL'));
  } catch (error) {
    addProgress('Local AI test error', error.message);
  } finally {
    state.running = false;
    sync();
  }
}

async function runBrowserSelfTest() {
  if (state.running) return;
  state.running = true;
  state.lastReport = null;
  clearProgress('Running deterministic installed-browser self-test…');
  sync();
  try {
    const report = await runBrowserAcceptanceSelfTest(chrome);
    state.lastReport = {
      version: 1,
      type: 'browser-self-test',
      generatedAt: new Date().toISOString(),
      outcome: { ok: report.ok === true, code: report.code || null },
      checks: (report.checks || []).map(check => ({
        name: String(check.name || '').slice(0, 120),
        ok: check.ok === true,
        detail: String(check.detail || '').slice(0, 300),
      })),
    };
    for (const check of report.checks || []) {
      addProgress(check.ok ? 'PASS' : 'FAIL', `${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
    }
    addProgress(report.ok ? 'Self-test complete' : 'Self-test stopped', report.code || (report.ok ? 'PASS' : 'FAIL'));
  } catch (error) {
    addProgress('Self-test error', error.message);
  } finally {
    state.running = false;
    sync();
  }
}

async function runTask() {
  const goal = ui.goal.value.trim();
  if (!goal) { clearProgress('Enter a browser task first.'); return; }
  if (state.running) return;
  state.controller = new AbortController();
  state.running = true;
  state.lastReport = null;
  state.taskId = state.taskId || (globalThis.crypto?.randomUUID?.() || `task-${Date.now()}`);
  try {
    try {
      state.checkpoint = await saveTaskCheckpoint({
        taskId: state.taskId, goal, mode: ui.mode.value, model: ui.model.value, status: 'running',
        timeline: state.resume?.timeline || [], actionsUsed: state.resume?.actionsUsed || 0, visionFallbacksUsed: state.resume?.visionFallbacksUsed || 0, requiresReview: false,
      }, chrome);
    } catch (checkpointError) {
      addProgress('Checkpoint', `Resumability unavailable: ${checkpointError.message}`);
    }
    clearProgress(state.resume ? 'Resuming browser task…' : 'Starting browser task…');
    sync();
    const result = await runBrowserTask({
      goal,
      model: ui.model.value,
      mode: ui.mode.value,
      chromeApi: chrome,
      fetchImpl: fetch,
      signal: state.controller.signal,
      limits: { maxActions: 40, maxDurationMs: 120000, maxRepeatedState: 3, maxRepeatedAction: 3 },
      onProgress(event) { const [label, detail] = describeProgress(event); addProgress(label, detail); },
      confirmAction: requestConfirmation,
      resume: state.resume,
      onCheckpoint: async checkpointState => {
        try {
          state.checkpoint = await saveTaskCheckpoint({
            taskId: state.taskId, goal, mode: ui.mode.value, model: ui.model.value, status: 'running',
            timeline: checkpointState.timeline, actionsUsed: checkpointState.actionsUsed, visionFallbacksUsed: checkpointState.visionFallbacksUsed, tabId: checkpointState.tabId, taskOrigin: checkpointState.taskOrigin,
            lastSnapshotId: checkpointState.snapshotId, requiresReview: false,
          }, chrome);
        } catch (checkpointError) {
          addProgress('Checkpoint', `Could not save resume point: ${checkpointError.message}`);
        }
      },
    });
    state.lastReport = buildSafeReport(result);
    if (result.ok) {
      addProgress('Complete', result.result || `Finished in ${result.timeline.length} action(s)`);
      try { await clearTaskCheckpoint(chrome); } catch {}
      state.resume = null; state.checkpoint = null; state.taskId = null;
    } else {
      const cancelledTask = result.code === 'TASK_CANCELLED';
      if (result.code === 'USER_DECLINED_ACTION') {
        addProgress('Stopped', 'You declined the requested consequential action. This task is closed.');
        try { await clearTaskCheckpoint(chrome); } catch {}
        state.resume = null; state.checkpoint = null; state.taskId = null;
      } else if (cancelledTask && state.stopIntent === 'cancel') {
        addProgress('Cancelled', 'Task checkpoint cleared.');
        try { await clearTaskCheckpoint(chrome); } catch {}
        state.resume = null; state.checkpoint = null; state.taskId = null;
      } else if (cancelledTask && state.stopIntent === 'pause') {
        addProgress('Paused', 'Task can be resumed from its latest sanitized checkpoint.');
        if (state.checkpoint) {
          try {
            state.checkpoint = await saveTaskCheckpoint({ ...state.checkpoint, status: 'interrupted', requiresReview: state.checkpoint.requiresReview === true }, chrome);
            state.resume = {
              timeline: state.checkpoint.timeline,
              actionsUsed: state.checkpoint.actionsUsed,
              visionFallbacksUsed: state.checkpoint.visionFallbacksUsed,
              tabId: state.checkpoint.tabId,
              taskOrigin: state.checkpoint.taskOrigin
            };
          } catch {}
        }
      } else {
      const deadTaskTab = ['TASK_TAB_UNAVAILABLE', 'UNSUPPORTED_TASK_TAB'].includes(result.code);
      if (deadTaskTab) {
        addProgress('Resume cleared', `${result.error || 'The original task tab is unavailable.'} Run again to start fresh on the current tab.`);
        try { await clearTaskCheckpoint(chrome); } catch {}
        state.resume = null; state.checkpoint = null; state.taskId = null;
      } else {
        addProgress('Stopped', `${result.code || 'Task did not complete'}${result.error ? `: ${result.error}` : ''}`);
        if (state.checkpoint) {
          try {
            state.checkpoint = await saveTaskCheckpoint({ ...state.checkpoint, status: 'interrupted', requiresReview: state.checkpoint.requiresReview === true }, chrome);
            state.resume = { timeline: state.checkpoint.timeline, actionsUsed: state.checkpoint.actionsUsed, visionFallbacksUsed: state.checkpoint.visionFallbacksUsed, tabId: state.checkpoint.tabId, taskOrigin: state.checkpoint.taskOrigin };
          } catch {}
        }
      }
      }
    }
  } catch (error) {
    addProgress('Error', error.name === 'AbortError' ? 'Task cancelled' : error.message);
  } finally {
    if (state.pendingConfirmation) resolveConfirmation(false);
    state.controller = null;
    state.running = false;
    state.stopIntent = null;
    sync();
  }
}

function pauseTask() {
  state.stopIntent = 'pause';
  state.controller?.abort();
  if (state.pendingConfirmation) resolveConfirmation(false);
  addProgress('Pausing', 'Execution cancellation requested; checkpoint will be retained.');
}

function cancelTask() {
  state.stopIntent = 'cancel';
  state.controller?.abort();
  if (state.pendingConfirmation) resolveConfirmation(false);
  addProgress('Cancelling', 'Execution cancellation requested; checkpoint will be cleared.');
}

if (Object.values(ui).some(value => !value)) throw new Error('Sightline browser-agent UI is incomplete.');
ui.observe.addEventListener('click', () => void observePage());
ui.selfTest.addEventListener('click', () => void runBrowserSelfTest());
ui.aiTest.addEventListener('click', () => void runLocalAISelfTest());
ui.run.addEventListener('click', () => void runTask());
ui.stop.addEventListener('click', pauseTask);
ui.taskCancel.addEventListener('click', cancelTask);
ui.report.addEventListener('click', exportAgentReport);
ui.confirm.addEventListener('click', () => resolveConfirmation(true));
ui.cancel.addEventListener('click', () => resolveConfirmation(false));
window.addEventListener('pagehide', pauseTask);
sync();
void restoreInterruptedTask();
