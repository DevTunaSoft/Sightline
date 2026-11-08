import { runTaskLoop } from './task-loop-core.js';
import { observeActiveTab, executeOnActiveTab } from './browser-bridge.js';
import { planNextAction } from './planner-client.js';
import { detectSkillBlocker } from './skill-blockers.js';

export async function runBrowserTask({
  goal, model, mode = 'assist', chromeApi = chrome, fetchImpl = fetch,
  signal, limits, onProgress = () => {}, confirmAction = null,
}) {
  let cachedSnapshot = null;
  const observe = async () => {
    if (cachedSnapshot) {
      const snapshot = cachedSnapshot;
      cachedSnapshot = null;
      const blocker = detectSkillBlocker(snapshot);
      if (blocker) { const error = new Error(blocker.reason); error.code = blocker.code; throw error; }
      return snapshot;
    }
    const observed = await observeActiveTab(chromeApi);
    const blocker = detectSkillBlocker(observed.snapshot);
    if (blocker) {
      const error = new Error(blocker.reason);
      error.code = blocker.code;
      throw error;
    }
    onProgress({ type: 'observed', snapshotId: observed.snapshot.snapshotId, elementCount: observed.snapshot.elements.length });
    return observed.snapshot;
  };

  const plan = async ({ goal: taskGoal, snapshot, timeline }) => {
    const decision = await planNextAction({ model, goal: taskGoal, snapshot, timeline, mode }, fetchImpl, signal);
    onProgress({ type: 'planned', decision });
    return decision;
  };

  const execute = async (action, { snapshot }) => {
    let result = await executeOnActiveTab({ action, snapshotId: snapshot.snapshotId, mode, taskGoal: goal }, chromeApi);
    if (result?.code === 'CONFIRMATION_REQUIRED' && typeof confirmAction === 'function') {
      const confirmed = await confirmAction({ action, target: result.target, risk: result.risk, snapshotId: snapshot.snapshotId });
      if (confirmed) result = await executeOnActiveTab({
        action, snapshotId: snapshot.snapshotId, mode, confirmed: true, confirmationKey: result.confirmationKey, taskGoal: goal,
      }, chromeApi);
    }
    if ((result?.code === 'STALE_SNAPSHOT' || result?.code === 'STALE_REF') && result?.snapshot) {
      cachedSnapshot = result.snapshot;
      onProgress({ type: 'recovered', code: result.code, snapshotId: result.snapshot.snapshotId });
      return { ok: true, code: 'REPLAN_REQUIRED', recoveredFrom: result.code };
    }
    if (result?.snapshot) cachedSnapshot = result.snapshot;
    onProgress({ type: 'executed', action, result });
    return result?.receipt || { ok: false, code: result?.code || 'ACTION_FAILED', error: result?.error };
  };

  const verify = async ({ receipt }) => ({ ok: receipt?.ok === true });
  try {
    return await runTaskLoop({ goal, observe, plan, execute, verify, signal, limits });
  } catch (error) {
    return { ok: false, code: error?.code || 'TASK_ERROR', error: String(error?.message || error), timeline: [] };
  }
}
