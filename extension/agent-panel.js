import { observeActiveTab } from './browser-bridge.js';
import { runBrowserTask } from './browser-task-runner.js';

const byId = id => document.getElementById(id);
const ui = {
  tag: byId('agentTag'), mode: byId('agentMode'), goal: byId('agentGoal'),
  observe: byId('observePageBtn'), run: byId('runTaskBtn'), stop: byId('stopTaskBtn'),
  progress: byId('agentProgress'), card: byId('confirmCard'), text: byId('confirmText'),
  confirm: byId('confirmActionBtn'), cancel: byId('cancelActionBtn'), model: byId('modelSelect'),
};

const state = { running: false, controller: null, pendingConfirmation: null };

function sync() {
  ui.run.disabled = state.running;
  ui.observe.disabled = state.running;
  ui.stop.disabled = !state.running;
  ui.mode.disabled = state.running;
  ui.goal.disabled = state.running;
  ui.tag.textContent = state.running ? 'RUNNING' : 'READY';
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
  return ['Progress', String(event?.type || 'update')];
}

function resolveConfirmation(value) {
  const pending = state.pendingConfirmation;
  state.pendingConfirmation = null;
  ui.card.hidden = true;
  if (pending) pending(Boolean(value));
}

function requestConfirmation({ action, target, risk }) {
  if (state.pendingConfirmation) resolveConfirmation(false);
  return new Promise(resolve => {
    state.pendingConfirmation = resolve;
    const targetName = target?.name || target?.role || action?.ref || 'this control';
    ui.text.textContent = `${risk?.reason || 'This action may have an external effect.'} Requested: ${action?.action || 'action'} on “${targetName}”.`;
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

async function runTask() {
  const goal = ui.goal.value.trim();
  if (!goal) { clearProgress('Enter a browser task first.'); return; }
  if (state.running) return;
  state.controller = new AbortController();
  state.running = true;
  clearProgress('Starting browser task…');
  sync();
  try {
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
    });
    if (result.ok) addProgress('Complete', result.result || `Finished in ${result.timeline.length} action(s)`);
    else addProgress('Stopped', result.code || 'Task did not complete');
  } catch (error) {
    addProgress('Error', error.name === 'AbortError' ? 'Task cancelled' : error.message);
  } finally {
    if (state.pendingConfirmation) resolveConfirmation(false);
    state.controller = null;
    state.running = false;
    sync();
  }
}

function stopTask() {
  state.controller?.abort();
  if (state.pendingConfirmation) resolveConfirmation(false);
  addProgress('Stopping', 'Cancellation requested');
}

if (Object.values(ui).some(value => !value)) throw new Error('Sightline browser-agent UI is incomplete.');
ui.observe.addEventListener('click', () => void observePage());
ui.run.addEventListener('click', () => void runTask());
ui.stop.addEventListener('click', stopTask);
ui.confirm.addEventListener('click', () => resolveConfirmation(true));
ui.cancel.addEventListener('click', () => resolveConfirmation(false));
window.addEventListener('pagehide', stopTask);
sync();
