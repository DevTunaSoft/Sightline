export const PERFORMANCE_BUDGETS = Object.freeze({
  maxSnapshotChars: 48000,
  maxSnapshotElements: 300,
  maxForegroundInference: 1,
  maxTaskActions: 40,
  maxTaskDurationMs: 120000,
  targetExtensionWorkingSetMb: 150,
});

export class TimingBook {
  constructor(clock = () => performance.now()) {
    this.clock = clock;
    this.samples = new Map();
  }

  async measure(name, fn) {
    const start = this.clock();
    try { return await fn(); }
    finally {
      const duration = Math.max(0, this.clock() - start);
      const list = this.samples.get(name) || [];
      list.push(duration);
      if (list.length > 100) list.splice(0, list.length - 100);
      this.samples.set(name, list);
    }
  }

  summary(name) {
    const list = this.samples.get(name) || [];
    if (!list.length) return { count: 0, minMs: 0, maxMs: 0, avgMs: 0 };
    const total = list.reduce((sum, value) => sum + value, 0);
    return { count: list.length, minMs: Math.min(...list), maxMs: Math.max(...list), avgMs: total / list.length };
  }
}

export class InferenceGate {
  constructor(maxConcurrent = PERFORMANCE_BUDGETS.maxForegroundInference) {
    this.maxConcurrent = Math.max(1, Number(maxConcurrent) || 1);
    this.active = 0;
  }

  async run(fn) {
    if (this.active >= this.maxConcurrent) throw new Error('Inference concurrency budget exceeded.');
    this.active += 1;
    try { return await fn(); }
    finally { this.active -= 1; }
  }
}
