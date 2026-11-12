// Trusted input through Chrome's debugger API (Chrome DevTools Protocol).
// Used only for visible, user-approved actions on the approved task tab.
// Chrome shows its "started debugging this browser" banner while attached;
// this module never hides it and never attaches to tabs it was not given.
const CDP_VERSION = '1.3';

export class CdpInputError extends Error {
  constructor(code, message) { super(message); this.name = 'CdpInputError'; this.code = code; }
}

export function createCdpInput(chromeApi = chrome, { isApprovedTab = () => false } = {}) {
  async function withTab(tabId, work) {
    if (!Number.isInteger(tabId) || tabId <= 0 || !isApprovedTab(tabId)) {
      throw new CdpInputError('TAB_NOT_APPROVED', 'Debugger input is only allowed on the approved task tab.');
    }
    const target = { tabId };
    try {
      await chromeApi.debugger.attach(target, CDP_VERSION);
    } catch (error) {
      throw new CdpInputError('ATTACH_FAILED', `Could not attach debugger: ${String(error?.message || error).slice(0, 160)}`);
    }
    try {
      return await work(target);
    } finally {
      try { await chromeApi.debugger.detach(target); } catch { /* already detached */ }
    }
  }

  return {
    // Clicks at viewport coordinates after validating they are finite and on screen.
    click(tabId, x, y) {
      if (![x, y].every(Number.isFinite) || x < 0 || y < 0) {
        return Promise.reject(new CdpInputError('BAD_COORDINATES', 'Click coordinates must be finite and on screen.'));
      }
      return withTab(tabId, async target => {
        const point = { x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 };
        await chromeApi.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { ...point, type: 'mousePressed' });
        await chromeApi.debugger.sendCommand(target, 'Input.dispatchMouseEvent', { ...point, type: 'mouseReleased' });
        return { ok: true };
      });
    },
    // Types text into the focused element. Caller must have confirmed the target is not sensitive.
    insertText(tabId, text) {
      const value = String(text ?? '');
      if (value.length > 2000) return Promise.reject(new CdpInputError('TEXT_TOO_LONG', 'Text is longer than 2000 characters.'));
      return withTab(tabId, async target => {
        await chromeApi.debugger.sendCommand(target, 'Input.insertText', { text: value });
        return { ok: true, characters: value.length };
      });
    },
  };
}
