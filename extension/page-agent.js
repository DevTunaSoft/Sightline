import { buildPageSnapshot } from './page-observer.js';
import { hasTargetStructuralEffect } from './page-observer-core.js';
import { RefRegistry } from './ref-registry.js';
import { createDomActionAdapter } from './dom-action-adapter.js';
import { executeValidatedAction } from './action-executor-core.js';
import { gateAction, actionConfirmationKey } from './safety-gate.js';

export function createPageAgentController(options = {}) {
  const registry = options.registry || new RefRegistry();
  const observe = options.observe || (() => buildPageSnapshot({ registry }));
  const adapterFactory = options.adapterFactory || ((snapshotId) => createDomActionAdapter({ registry, snapshotId }));
  const gate = options.gate || gateAction;
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  let currentSnapshot = null;

  async function refresh() {
    currentSnapshot = await observe();
    return currentSnapshot;
  }

  return {
    async handle(message) {
      if (!message || typeof message !== 'object') return { ok: false, code: 'INVALID_MESSAGE' };
      if (message.type === 'SIGHTLINE_PING') return { ok: true, code: 'READY' };
      if (message.type === 'SIGHTLINE_OBSERVE') return { ok: true, snapshot: await refresh() };
      if (message.type !== 'SIGHTLINE_EXECUTE') return { ok: false, code: 'UNKNOWN_MESSAGE' };

      if (!currentSnapshot || message.snapshotId !== currentSnapshot.snapshotId) {
        return { ok: false, code: 'STALE_SNAPSHOT', snapshot: await refresh() };
      }

      // The planner and confirmation UI may take time. Re-observe the live DOM
      // immediately before execution so cached semantic state can never authorize
      // an action against a page that changed underneath Sightline.
      const liveSnapshot = await refresh();
      if (message.snapshotId !== liveSnapshot.snapshotId) {
        return { ok: false, code: 'STALE_SNAPSHOT', snapshot: liveSnapshot };
      }

      const target = message.action?.ref
        ? liveSnapshot.elements.find(element => element.ref === message.action.ref)
        : null;
      const gateContext = { currentUrl: currentSnapshot.url, taskGoal: message.taskGoal || '' };
      const decision = gate(message.action, target || {}, message.mode || 'assist', gateContext);
      const confirmationKey = decision.confirmationRequired ? actionConfirmationKey(currentSnapshot.snapshotId, message.action, target || {}, gateContext) : null;
      if (!decision.allowed) {
        if (decision.confirmationRequired && message.confirmed === true && message.confirmationKey === confirmationKey) {
          // Confirmation is bound to this exact semantic action, task, and snapshot.
        } else {
          return {
            ok: false,
            code: decision.confirmationRequired ? 'CONFIRMATION_REQUIRED' : 'ACTION_BLOCKED',
            risk: decision.risk,
            target,
            confirmationKey,
          };
        }
      }

      const beforeSnapshotId = currentSnapshot.snapshotId;
      const receipt = await executeValidatedAction(message.action, adapterFactory(beforeSnapshotId));
      if (!receipt.ok) {
        if (receipt.code === 'STALE_REF') return { ok: false, code: 'STALE_REF', receipt, snapshot: await refresh() };
        return { ok: false, code: receipt.code || 'ACTION_FAILED', receipt };
      }
      let snapshot = await refresh();
      const consequential = decision.risk?.level === 'high' || decision.risk?.level === 'critical';
      let changed = hasTargetStructuralEffect(liveSnapshot, snapshot, message.action);
      if (consequential && !changed) {
        for (let attempt = 0; attempt < 3 && !changed; attempt += 1) {
          await sleep(100);
          snapshot = await refresh();
          changed = hasTargetStructuralEffect(liveSnapshot, snapshot, message.action);
        }
      }
      // Generic visible text / snapshot hash movement is not effect proof.
      const verifiedReceipt = { ...receipt, beforeSnapshotId, afterSnapshotId: snapshot.snapshotId, changed };
      if (consequential && !changed) {
        return { ok: false, code: 'NO_VERIFIED_EFFECT', receipt: verifiedReceipt, snapshot };
      }
      return { ok: true, receipt: verifiedReceipt, snapshot };
    },
    getSnapshot: () => currentSnapshot,
  };
}

export function startPageAgent(runtime = globalThis.chrome?.runtime) {
  if (!runtime?.onMessage) throw new Error('Chrome runtime unavailable.');
  if (globalThis.__SIGHTLINE_PAGE_AGENT__) return globalThis.__SIGHTLINE_PAGE_AGENT__;
  const controller = createPageAgentController();
  const listener = (message, _sender, sendResponse) => {
    if (!String(message?.type || '').startsWith('SIGHTLINE_')) return false;
    controller.handle(message)
      .then(sendResponse)
      .catch(error => sendResponse({ ok: false, code: 'PAGE_AGENT_ERROR', error: String(error?.message || error) }));
    return true;
  };
  runtime.onMessage.addListener(listener);
  globalThis.__SIGHTLINE_PAGE_AGENT__ = { controller, listener };
  return globalThis.__SIGHTLINE_PAGE_AGENT__;
}
