const DEFAULT_LIMITS = Object.freeze({
  maxActions: 40,
  maxDurationMs: 120000,
  maxRepeatedState: 3,
  maxRepeatedAction: 3,
});

function nowMs(clock) { return Number(clock?.() ?? Date.now()); }
function actionKey(action) {
  if (!action || typeof action !== 'object') return 'invalid';
  return JSON.stringify({ action: action.action, ref: action.ref, url: action.url, key: action.key, value: action.value, text: action.text });
}

export class TaskProgressGuard {
  constructor(options = {}) {
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
    this.clock = options.clock;
    this.startedAt = nowMs(this.clock);
    this.actions = Math.max(0, Math.min(this.limits.maxActions, Number(options.initialActions) || 0));
    this.lastSnapshotId = null;
    this.repeatedState = 0;
    this.lastActionKey = null;
    this.repeatedAction = 0;
  }

  beforeAction(action, snapshotId) {
    const elapsed = nowMs(this.clock) - this.startedAt;
    if (elapsed > this.limits.maxDurationMs) return { ok: false, code: 'TIME_BUDGET_EXCEEDED' };
    if (this.actions >= this.limits.maxActions) return { ok: false, code: 'ACTION_BUDGET_EXCEEDED' };

    if (snapshotId && snapshotId === this.lastSnapshotId) this.repeatedState += 1;
    else this.repeatedState = 0;
    this.lastSnapshotId = snapshotId || null;
    if (this.repeatedState >= this.limits.maxRepeatedState) return { ok: false, code: 'REPEATED_STATE_STALL' };

    const key = actionKey(action);
    if (key === this.lastActionKey) this.repeatedAction += 1;
    else this.repeatedAction = 0;
    this.lastActionKey = key;
    if (this.repeatedAction >= this.limits.maxRepeatedAction) return { ok: false, code: 'REPEATED_ACTION_STALL' };

    this.actions += 1;
    return { ok: true, actionNumber: this.actions, elapsedMs: elapsed };
  }
}

export async function runTaskLoop({ goal, observe, plan, execute, verify, signal, limits, clock, resume = null, onCheckpoint = null }) {
  if (typeof goal !== 'string' || !goal.trim()) throw new Error('Task goal is required.');
  for (const fn of [observe, plan, execute, verify]) if (typeof fn !== 'function') throw new Error('Task loop dependency missing.');
  const resumeTimeline = Array.isArray(resume?.timeline) ? resume.timeline.slice(-40) : [];
  const initialActions = Math.max(Number(resume?.actionsUsed) || 0, resumeTimeline.length);
  const guard = new TaskProgressGuard({ limits, clock, initialActions });
  const timeline = [...resumeTimeline];

  while (true) {
    if (signal?.aborted) return { ok: false, code: 'ABORTED', timeline };
    const snapshot = await observe({ signal });
    if (!snapshot || typeof snapshot !== 'object') return { ok: false, code: 'OBSERVE_FAILED', timeline };

    const decision = await plan({ goal: goal.trim(), snapshot, timeline: timeline.slice(-8), signal });
    if (!decision || typeof decision !== 'object') return { ok: false, code: 'PLAN_FAILED', timeline };
    if (decision.done === true) return { ok: true, code: 'COMPLETED', result: decision.result, timeline };
    if (!decision.action) return { ok: false, code: 'NO_ACTION', timeline };

    const allowed = guard.beforeAction(decision.action, snapshot.snapshotId);
    if (!allowed.ok) return { ok: false, code: allowed.code, timeline };

    const receipt = await execute(decision.action, { signal, snapshot });
    timeline.push({ n: allowed.actionNumber, snapshotId: snapshot.snapshotId || null, action: decision.action, receipt });
    if (typeof onCheckpoint === 'function') {
      await onCheckpoint({ timeline: [...timeline], actionsUsed: guard.actions, snapshotId: snapshot.snapshotId || null });
    }
    if (!receipt?.ok) return { ok: false, code: receipt?.code || 'ACTION_FAILED', timeline };

    const verdict = await verify({ goal: goal.trim(), before: snapshot, action: decision.action, receipt, signal });
    if (verdict?.done === true) return { ok: true, code: 'COMPLETED', result: verdict.result, timeline };
    if (verdict?.ok === false && verdict?.fatal === true) return { ok: false, code: verdict.code || 'VERIFY_FAILED', timeline };
  }
}

export const TASK_LOOP_LIMITS = DEFAULT_LIMITS;
