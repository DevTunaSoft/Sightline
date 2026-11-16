// Validates where a debugger click would land. Pure logic, no DOM or browser access.
// The page agent reports a located element; these rules decide whether the
// click may proceed. Any doubt returns a refusal code, never a guessed point.

export const CLICK_POINT_LIMITS = Object.freeze({ tolerancePx: 2 });

export function validateLocateResult(result, { expectedSnapshotId, viewport } = {}) {
  if (!result || result.ok !== true) return refuse('LOCATE_FAILED', 'The element could not be located.');
  if (result.snapshotId !== expectedSnapshotId) return refuse('STALE_TARGET', 'The page changed before the click.');
  if (result.sensitive === true) return refuse('SENSITIVE_TARGET', 'Sensitive elements are never clicked by the agent.');
  if (result.inFrame === true) return refuse('FRAME_TARGET', 'Clicks inside frames are not supported yet.');
  const rect = result.rect;
  if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) {
    return refuse('LOCATE_FAILED', 'The element has no usable position.');
  }
  if (!(rect.width > 0 && rect.height > 0)) return refuse('LOCATE_FAILED', 'The element is not visible.');
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  const width = Number(viewport?.width);
  const height = Number(viewport?.height);
  if (!(Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0)) {
    return refuse('LOCATE_FAILED', 'Viewport size is unknown.');
  }
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return refuse('OFFSCREEN_TARGET', 'The element is outside the visible area.');
  }
  return { ok: true, point: { x: Math.round(x), y: Math.round(y) } };
}

// Compares a fresh locate with the point that was approved, right before clicking.
export function isSamePoint(a, b, tolerance = CLICK_POINT_LIMITS.tolerancePx) {
  return Boolean(a && b && Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance);
}

function refuse(code, error) { return { ok: false, code, error }; }
