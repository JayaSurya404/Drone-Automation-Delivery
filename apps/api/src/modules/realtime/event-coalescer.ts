/**
 * Leading + trailing throttle keyed per subject (e.g. `drone:<id>:location`)
 * — the first call for a key fires immediately (so a client never waits for
 * its first update), and any further calls within the window are coalesced
 * into a single trailing call carrying the latest data once the window
 * closes. This is what decouples telemetry *ingest* rate (unchanged, still
 * whatever `TelemetryService`/`MissionsService` already do) from WebSocket
 * *broadcast* rate, per `PROJECT_CONTEXT.md` #7 and blueprint Section R.
 *
 * Memory is bounded by the number of distinct keys with an in-flight
 * window — an entry is deleted the moment its window closes with nothing
 * pending, so an idle drone leaves no residue.
 */
export class EventCoalescer {
  private readonly windows = new Map<string, { timer: ReturnType<typeof setTimeout>; pending: (() => void) | null }>();

  schedule(key: string, run: () => void, delayMs: number): void {
    const existing = this.windows.get(key);
    if (!existing) {
      run();
      const timer = setTimeout(() => this.flush(key, delayMs), delayMs);
      this.windows.set(key, { timer, pending: null });
      return;
    }
    existing.pending = run;
  }

  /** Test/shutdown helper — clears all pending timers without firing them. */
  clear(): void {
    for (const entry of this.windows.values()) {
      clearTimeout(entry.timer);
    }
    this.windows.clear();
  }

  get pendingKeyCount(): number {
    return this.windows.size;
  }

  private flush(key: string, delayMs: number): void {
    const entry = this.windows.get(key);
    if (!entry) {
      return;
    }
    if (entry.pending) {
      const run = entry.pending;
      entry.pending = null;
      run();
      entry.timer = setTimeout(() => this.flush(key, delayMs), delayMs);
      return;
    }
    this.windows.delete(key);
  }
}
