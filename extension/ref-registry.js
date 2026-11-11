export class RefRegistry {
  constructor(maxRefs = 300) {
    // A caller-supplied Infinity or enormous cap must not retain unbounded DOM
    // nodes. Match the observer's existing 300-element hard ceiling.
    const requested = Number(maxRefs) || 300; // Keep prior null/zero fallback behavior.
    this.maxRefs = Number.isFinite(requested)
      ? Math.min(300, Math.max(1, Math.floor(requested)))
      : 300;
    this.snapshotId = null;
    this.refs = new Map();
  }

  replace(snapshotId, entries) {
    if (typeof snapshotId !== 'string' || !snapshotId) throw new Error('snapshotId is required.');
    this.refs.clear();
    this.snapshotId = snapshotId;
    let count = 0;
    for (const entry of entries || []) {
      if (count >= this.maxRefs) break;
      const ref = entry?.ref;
      if (typeof ref !== 'string' || !/^@e[1-9]\d{0,4}$/.test(ref)) continue;
      this.refs.set(ref, entry.value);
      count += 1;
    }
    return count;
  }

  has(ref, snapshotId = this.snapshotId) {
    return snapshotId === this.snapshotId && this.refs.has(ref);
  }

  resolve(ref, snapshotId = this.snapshotId) {
    if (snapshotId !== this.snapshotId) return null;
    return this.refs.get(ref) ?? null;
  }

  clear() {
    this.refs.clear();
    this.snapshotId = null;
  }
}
