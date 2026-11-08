export const TASK_CHECKPOINT_KEY = 'sightline.activeTask.v1';
export const TASK_CHECKPOINT_LIMITS = Object.freeze({ maxGoalChars: 2000, maxTimelineItems: 40, maxStoredBytes: 24000 });

function clean(value, max) { return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max); }

function safeAction(action) {
  if (!action || typeof action !== 'object') return null;
  const safe = { action: clean(action.action, 40) };
  if (action.ref) safe.ref = clean(action.ref, 20);
  if (action.key) safe.key = clean(action.key, 40);
  if (action.direction) safe.direction = clean(action.direction, 20);
  if (Number.isFinite(action.amount)) safe.amount = Math.round(action.amount);
  if (Number.isFinite(action.ms)) safe.ms = Math.round(action.ms);
  return safe;
}

export function sanitizeCheckpointTimeline(timeline = []) {
  return timeline.slice(-TASK_CHECKPOINT_LIMITS.maxTimelineItems).map((item, index) => ({
    n: Number(item?.n) || index + 1,
    snapshotId: clean(item?.snapshotId, 80) || null,
    action: safeAction(item?.action),
    receipt: {
      ok: item?.receipt?.ok === true,
      code: clean(item?.receipt?.code, 80) || null,
      changed: typeof item?.receipt?.changed === 'boolean' ? item.receipt.changed : undefined,
    },
  }));
}

export function createTaskCheckpoint({ taskId, goal, mode = 'assist', model = '', status = 'running', timeline = [], actionsUsed = 0, tabId = null, lastSnapshotId = null, requiresReview = false, updatedAt = new Date().toISOString() }) {
  const checkpoint = {
    version: 1,
    taskId: clean(taskId, 100),
    goal: clean(goal, TASK_CHECKPOINT_LIMITS.maxGoalChars),
    mode: ['observe', 'assist', 'autonomous'].includes(mode) ? mode : 'assist',
    model: clean(model, 110),
    status: ['running', 'interrupted', 'completed', 'failed'].includes(status) ? status : 'running',
    actionsUsed: Math.max(0, Math.min(1000, Number(actionsUsed) || 0)),
    tabId: Number.isInteger(tabId) && tabId > 0 ? tabId : null,
    lastSnapshotId: clean(lastSnapshotId, 80) || null,
    requiresReview: requiresReview === true,
    timeline: sanitizeCheckpointTimeline(timeline),
    updatedAt: clean(updatedAt, 60),
  };
  if (!checkpoint.taskId || !checkpoint.goal) throw new Error('Checkpoint taskId and goal are required.');
  if (JSON.stringify(checkpoint).length > TASK_CHECKPOINT_LIMITS.maxStoredBytes) throw new Error('Checkpoint exceeds storage budget.');
  return checkpoint;
}

function sessionStore(chromeApi) {
  const store = chromeApi?.storage?.session;
  if (!store?.get || !store?.set || !store?.remove) throw new Error('Chrome session storage is unavailable.');
  return store;
}

export async function saveTaskCheckpoint(checkpoint, chromeApi = chrome) {
  const value = createTaskCheckpoint(checkpoint);
  await sessionStore(chromeApi).set({ [TASK_CHECKPOINT_KEY]: value });
  return value;
}

export async function loadTaskCheckpoint(chromeApi = chrome) {
  const result = await sessionStore(chromeApi).get(TASK_CHECKPOINT_KEY);
  const value = result?.[TASK_CHECKPOINT_KEY];
  if (!value || value.version !== 1) return null;
  try { return createTaskCheckpoint(value); } catch { return null; }
}

export async function clearTaskCheckpoint(chromeApi = chrome) {
  await sessionStore(chromeApi).remove(TASK_CHECKPOINT_KEY);
}
