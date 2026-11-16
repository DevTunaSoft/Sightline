export const DIAGNOSTIC_LIMITS = Object.freeze({
  maxEvents: 200,
  maxMessageChars: 500,
  maxDetailsChars: 2000,
});

const SECRET_PATTERN = /(password|passwd|authorization|bearer|api[_-]?key|token|access[_-]?token|refresh[_-]?token|cookie|secret)/i;
const FAILURE_CLASSES = new Set(['CODE', 'TEST', 'ENVIRONMENT', 'EXTERNAL_SERVICE', 'PERMISSION', 'HARDWARE', 'DESIGN', 'USER_CANCELLED', 'UNKNOWN']);

function bounded(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function sanitizeDiagnosticValue(value, depth = 0) {
  if (depth > 4) return '[TRUNCATED]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return bounded(value, DIAGNOSTIC_LIMITS.maxDetailsChars);
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeDiagnosticValue(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value).slice(0, 30)) {
      out[key] = SECRET_PATTERN.test(key) ? '[REDACTED]' : sanitizeDiagnosticValue(item, depth + 1);
    }
    return out;
  }
  return bounded(value, DIAGNOSTIC_LIMITS.maxDetailsChars);
}

export function classifyFailure(errorOrCode) {
  const text = bounded(errorOrCode?.code || errorOrCode?.message || errorOrCode, 500).toLowerCase();
  if (!text) return 'UNKNOWN';
  if (/abort|cancel/.test(text)) return 'USER_CANCELLED';
  if (/permission|denied|not allowed|active tab|receiver/.test(text)) return 'PERMISSION';
  if (/ollama|network|fetch|connection|timeout|http 5|service/.test(text)) return 'EXTERNAL_SERVICE';
  if (/memory|out of memory|gpu|cpu|hardware/.test(text)) return 'HARDWARE';
  if (/administrator|blocked by|environment/.test(text)) return 'ENVIRONMENT';
  if (/test|assert/.test(text)) return 'TEST';
  if (/schema|invalid action|stale|execution|planner|observe|snapshot/.test(text)) return 'CODE';
  return 'UNKNOWN';
}

export class DiagnosticLedger {
  constructor(limit = DIAGNOSTIC_LIMITS.maxEvents, clock = () => new Date().toISOString()) {
    this.limit = Math.max(10, Math.min(1000, Number(limit) || DIAGNOSTIC_LIMITS.maxEvents));
    this.clock = clock;
    this.events = [];
  }

  record(type, message, details = {}) {
    const event = Object.freeze({
      at: this.clock(),
      type: bounded(type, 60) || 'event',
      message: bounded(message, DIAGNOSTIC_LIMITS.maxMessageChars),
      details: sanitizeDiagnosticValue(details),
    });
    this.events.push(event);
    if (this.events.length > this.limit) this.events.splice(0, this.events.length - this.limit);
    return event;
  }

  failure(errorOrCode, details = {}) {
    const failureClass = classifyFailure(errorOrCode);
    return this.record('failure', bounded(errorOrCode?.message || errorOrCode?.code || errorOrCode, 500), { failureClass, ...details });
  }

  export() {
    return { version: 1, events: [...this.events] };
  }
}

export function assertFailureClass(value) {
  if (!FAILURE_CLASSES.has(value)) throw new Error('Unknown failure class.');
  return value;
}
