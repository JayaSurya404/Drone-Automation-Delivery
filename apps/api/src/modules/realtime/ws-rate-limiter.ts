/**
 * A lightweight per-socket fixed-window rate limiter for inbound
 * `subscribe:*`/`unsubscribe:*` messages — the realtime gateways' one piece
 * of inbound backpressure (outbound telemetry fan-out is throttled
 * separately by `EventCoalescer`). Bounded memory: `clear()` must be called
 * on disconnect so a churn of short-lived connections doesn't leak entries.
 */
export class WsRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  allow(socketId: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(socketId);
    if (!bucket || now >= bucket.resetAt) {
      this.buckets.set(socketId, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (bucket.count >= this.limit) {
      return false;
    }
    bucket.count += 1;
    return true;
  }

  clear(socketId: string): void {
    this.buckets.delete(socketId);
  }

  get trackedSocketCount(): number {
    return this.buckets.size;
  }
}
