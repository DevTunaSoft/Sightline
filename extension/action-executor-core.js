import { validateAction } from './action-protocol.js';

const MUTATING_ACTIONS = new Set(['click', 'type', 'clear', 'select', 'check', 'uncheck', 'navigate', 'pressKey']);

function receipt(action, ok, details = {}) {
  return Object.freeze({
    version: 1,
    action: action.action,
    ok,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

export async function executeValidatedAction(input, adapter, signal) {
  const validated = validateAction(input);
  if (!validated.ok) return receipt({ action: String(input?.action || 'invalid') }, false, { error: validated.reason, code: 'INVALID_ACTION' });
  const action = validated.action;
  if (signal?.aborted) return receipt(action, false, { error: 'Task cancelled.', code: 'ABORTED' });
  if (!adapter || typeof adapter !== 'object') return receipt(action, false, { error: 'Executor adapter unavailable.', code: 'NO_ADAPTER' });

  try {
    if (action.ref && typeof adapter.hasRef === 'function' && !adapter.hasRef(action.ref)) {
      return receipt(action, false, { ref: action.ref, error: 'Element reference is stale or unavailable.', code: 'STALE_REF' });
    }
    const handler = adapter[action.action];
    if (typeof handler !== 'function') return receipt(action, false, { error: 'Action is not implemented by this adapter.', code: 'UNSUPPORTED_BY_ADAPTER' });
    const result = await handler(action, { signal });
    if (signal?.aborted) {
      const uncertain = MUTATING_ACTIONS.has(action.action);
      return receipt(action, false, {
        error: uncertain ? 'Action may have changed the page before cancellation; reconcile before retry.' : 'Task cancelled.',
        code: uncertain ? 'UNKNOWN_EFFECT' : 'ABORTED',
      });
    }
    return receipt(action, result?.ok !== false, { ...(result || {}) });
  } catch {
    // The handler may have committed a side effect before failing. In that
    // case a retry could duplicate a send, payment or deletion. Never echo
    // provider exception messages, which can contain private page text.
    const uncertain = MUTATING_ACTIONS.has(action.action);
    return receipt(action, false, {
      error: uncertain ? 'Action outcome is uncertain; inspect the page before retry.' : 'Action failed.',
      code: uncertain ? 'UNKNOWN_EFFECT' : 'EXECUTION_ERROR',
    });
  }
}
