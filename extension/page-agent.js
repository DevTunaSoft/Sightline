import { buildPageSnapshot } from './page-observer.js';
import { hasTargetStructuralEffect } from './page-observer-core.js';
import { RefRegistry } from './ref-registry.js';
import { createDomActionAdapter } from './dom-action-adapter.js';
import { executeValidatedAction } from './action-executor-core.js';
import { gateAction } from './safety-gate.js';

// A confirmation token is an unpredictable, single-use capability, not a
// hash of public page metadata. No secrets or action values are persisted.
function secureConfirmationToken() {
  const crypto = globalThis.crypto;
  if (typeof crypto?.getRandomValues !== 'function') return null;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'confirm-' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function confirmationBinding(snapshot, action, target, context) {
  try {
    const text = JSON.stringify({
      snapshotId: snapshot?.snapshotId || '',
      currentUrl: snapshot?.url || '',
      action,
      target: {
        ref: target?.ref || null,
        role: target?.role || null,
        name: target?.name || null,
        hrefOrigin: target?.state?.hrefOrigin || null,
      },
      taskGoal: String(context.taskGoal || '').slice(0, 2000),
    });
    return text?.length <= 12000 ? text : null;
  } catch {
    return null;
  }
}

export function createPageAgentController(options = {}) {
  const registry = options.registry || new RefRegistry();
  const observe = options.observe || (() => buildPageSnapshot({ registry }));
  const adapterFactory = options.adapterFactory || ((snapshotId) => createDomActionAdapter({ registry, snapshotId }));
  const gate = options.gate || gateAction;
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  let currentSnapshot = null;
  // Exactly one in-memory, short-lived approval challenge per page agent.
  let pendingConfirmation = null;
  const issueToken = options.issueConfirmationToken || secureConfirmationToken;

  async function refresh() {
    const next = await observe();
    if (currentSnapshot?.snapshotId !== next.snapshotId) pendingConfirmation = null;
    currentSnapshot = next;
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
      if (!decision.allowed) {
        if (!decision.confirmationRequired) {
          pendingConfirmation = null;
          return { ok: false, code: 'ACTION_BLOCKED', risk: decision.risk, target };
        }
        const binding = confirmationBinding(currentSnapshot, message.action, target, gateContext);
        if (message.confirmed === true) {
          const accepted = Boolean(binding && pendingConfirmation &&
            pendingConfirmation.binding === binding &&
            pendingConfirmation.key === message.confirmationKey);
          // Consume before executing; duplicate/parallel messages cannot replay it.
          pendingConfirmation = null;
          if (!accepted) return {
            ok: false, code: 'CONFIRMATION_REQUIRED', risk: decision.risk,
            target, confirmationKey: null,
          };
        } else {
          pendingConfirmation = null;
          const confirmationKey = binding ? issueToken() : null;
          if (typeof confirmationKey !== 'string' || !/^confirm-[a-f0-9]{32}$/.test(confirmationKey)) {
            return { ok: false, code: 'CONFIRMATION_UNAVAILABLE', risk: decision.risk, target };
          }
          pendingConfirmation = { key: confirmationKey, binding };
          return { ok: false, code: 'CONFIRMATION_REQUIRED', risk: decision.risk, target, confirmationKey };
        }
      } else {
        // An unrelated safe action invalidates any older pending approval.
        pendingConfirmation = null;
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
