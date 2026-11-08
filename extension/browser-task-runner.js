import { runTaskLoop } from './task-loop-core.js';
import { observeActiveTab, executeOnActiveTab } from './browser-bridge.js';
import { planNextAction } from './planner-client.js';

export async function runBrowserTask({
  goal, model, mode = 'assist', chromeApi = chrome, fetchImpl = fetch,
  signal, limits, onProgress = () => {}, confirmAction = null,
}) {
  let cachedSnapshot = null;
  const observe = async () => {
    if (cachedSnapshot) {
      const snapshot = cachedSnapshot;
      cachedSnapshot = null;
      return snapshot;
    }
    const observed = await observeActiveTab(chromeApi);
    onProgress({ type: 'observed', snapshotId: observed.snapshot.snapshotId, elementCount: observed.snapshot.elements.length });
    return observed.snapshot;
  };

  const plan = async ({ goal: taskGoal, snapshot, timeline }) => {
    const decision = await planNextAction({ model, goal: taskGoal, snapshot, timeline, mode }, fetchImpl, signal);
    onProgress({ type: 'planned', decision });
    return decision;
  };

  const execute = async (action, { snapshot }) => {
    let result = await executeOnActiveTab({ action, snapshotId: snapshot.snapshotId, mode }, chromeApi);
    if (result?.code === 'CONFIRMATION_REQUIRED' && typeof confirmAction === 'function') {
      const confirmed = await confirmAction({ action, target: result.target, risk: result.risk, snapshotId: snapshot.snapshotId });
      if (confirmed) result = await executeOnActiveTab({ action, snapshotId: snapshot.snapshotId, mode, confirmed: true }, chromeApi);
    }
    if (result?.snapshot) cachedSnapshot = result.snapshot;
    onProgress({ type: 'executed', action, result });
    return result?.receipt || { ok: false, code: result?.code || 'ACTION_FAILED', error: result?.error };
  };

  const verify = async ({ receipt }) => ({ ok: receipt?.ok === true });
  return runTaskLoop({ goal, observe, plan, execute, verify, signal, limits });
}
