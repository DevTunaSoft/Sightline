import { observeActiveTab } from './browser-bridge.js';
import { runBrowserTask } from './browser-task-runner.js';
import { saveTaskCheckpoint, loadTaskCheckpoint, clearTaskCheckpoint } from './task-checkpoint.js';

const byId = id => document.getElementById(id);
const ui = {
  tag: byId('agentTag'), mode: byId('agentMode'), goal: byId('agentGoal'),
  observe: byId('observePageBtn'), run: byId('runTaskBtn'), stop: byId('stopTaskBtn'),
  progress: byId('agentProgress'), card: byId('confirmCard'), text: byId('confirmText'),
  confirm: byId('confirmActionBtn'), cancel: byId('cancelActionBtn'), model: byId('modelSelect'),
};

const state = { running: false, controller: null, pendingConfirmation: null, resume: null, checkpoint: null, taskId: null };

function sync() {
  ui.run.disabled = state.running;
  ui.observe.disabled = state.running;
  ui.stop.disabled = !state.running;
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
  return ['Progress', String(event?.type || 'update')];
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
    state.resume = { timeline: checkpoint.timeline, actionsUsed: checkpoint.actionsUsed };
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

async function runTask() {
  const goal = ui.goal.value.trim();
  if (!goal) { clearProgress('Enter a browser task first.'); return; }
  if (state.running) return;
  state.controller = new AbortController();
  state.running = true;
  state.taskId = state.taskId || (globalThis.crypto?.randomUUID?.() || `task-${Date.now()}`);
  try {
    try {
      state.checkpoint = await saveTaskCheckpoint({
        taskId: state.taskId, goal, mode: ui.mode.value, model: ui.model.value, status: 'running',
        timeline: state.resume?.timeline || [], actionsUsed: state.resume?.actionsUsed || 0, requiresReview: false,
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
            timeline: checkpointState.timeline, actionsUsed: checkpointState.actionsUsed,
            lastSnapshotId: checkpointState.snapshotId, requiresReview: false,
          }, chrome);
        } catch (checkpointError) {
          addProgress('Checkpoint', `Could not save resume point: ${checkpointError.message}`);
        }
      },
    });
    if (result.ok) {
      addProgress('Complete', result.result || `Finished in ${result.timeline.length} action(s)`);
      try { await clearTaskCheckpoint(chrome); } catch {}
      state.resume = null; state.checkpoint = null; state.taskId = null;
    } else {
      addProgress('Stopped', `${result.code || 'Task did not complete'}${result.error ? `: ${result.error}` : ''}`);
      if (state.checkpoint) {
        try {
          state.checkpoint = await saveTaskCheckpoint({ ...state.checkpoint, status: 'interrupted', requiresReview: state.checkpoint.requiresReview === true }, chrome);
          state.resume = { timeline: state.checkpoint.timeline, actionsUsed: state.checkpoint.actionsUsed };
        } catch {}
      }
    }
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
void restoreInterruptedTask();
