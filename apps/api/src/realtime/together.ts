/**
 * Measures how long both study partners are in their room at the same time ("together time").
 * Study XP is earned on together time, not on wall-clock time since the invite was accepted.
 *
 * In memory per room key, like presence: a server restart loses only the segment that was running.
 */
export class TogetherClock {
  private readonly since = new Map<string, number>();

  /**
   * Call after anyone joins or leaves. Returns the length of the together-segment that just ended (0 when nothing
   * ended), so the caller can add it to the session's stored total.
   */
  update(key: string, together: boolean, now = Date.now()): number {
    const start = this.since.get(key);
    if (together) {
      if (start === undefined) this.since.set(key, now);
      return 0;
    }
    if (start === undefined) return 0;
    this.since.delete(key);
    return Math.max(0, now - start);
  }

  /** Ends the running segment (session ended) and returns its length. */
  flush(key: string, now = Date.now()): number {
    return this.update(key, false, now);
  }

  /** When the running segment started, or null when the partners are apart. */
  sinceOf(key: string): number | null {
    return this.since.get(key) ?? null;
  }

  /** Length of the running segment so far. */
  running(key: string, now = Date.now()): number {
    const start = this.since.get(key);
    return start === undefined ? 0 : Math.max(0, now - start);
  }

  clear() {
    this.since.clear();
  }
}
