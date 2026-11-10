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
  // A persisted unknown/in-flight action could have changed the page before a
  // crash. Never ask the planner to repeat it automatically.
  if (timeline.some(item => ['UNKNOWN_EFFECT', 'ACTION_IN_FLIGHT', 'NO_VERIFIED_EFFECT'].includes(item?.receipt?.code))) {
    return { ok: false, code: 'ACTION_RECONCILIATION_REQUIRED', timeline };
  }
  const checkpoint = async snapshotId => {
    if (typeof onCheckpoint === 'function')
      await onCheckpoint({ timeline: [...timeline], actionsUsed: guard.actions, snapshotId: snapshotId || null });
  };

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

    // Write-ahead record. Persist before any side effect, or refuse to act.
    const pending = {
      n: allowed.actionNumber, snapshotId: snapshot.snapshotId || null,
      action: decision.action, receipt: { ok: false, code: 'UNKNOWN_EFFECT' },
    };
    timeline.push(pending);
    try {
      await checkpoint(snapshot.snapshotId);
    } catch {
      return { ok: false, code: 'CHECKPOINT_WRITE_FAILED', timeline };
    }

    // Cancellation may occur while a slow storage write is in flight.
    // Never perform the action after the user has already stopped the task.
    if (signal?.aborted) {
      pending.receipt = { ok: false, code: 'ABORTED' };
      try { await checkpoint(snapshot.snapshotId); }
      catch { pending.receipt = { ok: false, code: 'UNKNOWN_EFFECT' }; }
      return { ok: false, code: 'ABORTED', timeline };
    }

    let receipt;
    try {
      receipt = await execute(decision.action, { signal, snapshot });
    } catch {
      // This operation may already have happened. Do not replan or retry.
      return { ok: false, code: 'UNKNOWN_EFFECT', timeline };
    }
    if (!receipt || typeof receipt !== 'object') {
      return { ok: false, code: 'UNKNOWN_EFFECT', timeline };
    }
    // Do not persist an action as successful until its effect has been checked.
    // A crash between execute and verify must leave the durable record unknown.
    if (!receipt.ok) {
      pending.receipt = receipt;
      try { await checkpoint(snapshot.snapshotId); }
      catch {
        pending.receipt = { ok: false, code: 'UNKNOWN_EFFECT' };
        return { ok: false, code: 'CHECKPOINT_WRITE_FAILED', timeline };
      }
      return { ok: false, code: receipt.code || 'ACTION_FAILED', timeline };
    }

    let verdict;
    try {
      verdict = await verify({ goal: goal.trim(), before: snapshot, action: decision.action, receipt, signal });
    } catch {
      return { ok: false, code: 'UNKNOWN_EFFECT', timeline };
    }
    if (verdict?.done !== true && verdict?.ok !== true) {
      pending.receipt = { ok: false, code: 'NO_VERIFIED_EFFECT' };
      try { await checkpoint(snapshot.snapshotId); }
      catch {
        pending.receipt = { ok: false, code: 'UNKNOWN_EFFECT' };
        return { ok: false, code: 'CHECKPOINT_WRITE_FAILED', timeline };
      }
      return { ok: false, code: verdict?.code || 'NO_VERIFIED_EFFECT', timeline };
    }
    pending.receipt = receipt;
    try { await checkpoint(snapshot.snapshotId); }
    catch {
      pending.receipt = { ok: false, code: 'UNKNOWN_EFFECT' };
      return { ok: false, code: 'CHECKPOINT_WRITE_FAILED', timeline };
    }
    if (verdict.done === true) return { ok: true, code: 'COMPLETED', result: verdict.result, timeline };
  }
}

export const TASK_LOOP_LIMITS = DEFAULT_LIMITS;
