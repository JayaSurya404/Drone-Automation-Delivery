export interface MetricLabels {
  [key: string]: string | number;
}

export interface MetricSnapshot {
  timestamp: string;
  uptimeSeconds: number;
  memory: {
    heapUsedBytes: number;
    heapTotalBytes: number;
    rssBytes: number;
    externalBytes: number;
  };
  counters: Record<string, { value: number; labeled?: Record<string, number> }>;
  gauges: Record<string, number>;
}

export class MetricsRegistry {
  private readonly counters = new Map<string, { total: number; labeled: Map<string, number> }>();
  private readonly gauges = new Map<string, number>();
  private readonly startTime = Date.now();

  constructor() {
    // Initialize common counters
    this.initCounter("http_requests_total");
    this.initCounter("http_errors_total");
    this.initCounter("auth_failures_total");
    this.initCounter("rate_limit_exceeded_total");
    this.initCounter("ws_connections_total");
    this.initCounter("ws_disconnections_total");
    this.initCounter("telemetry_frames_ingested_total");
    this.initCounter("outbox_events_processed_total");
    this.initCounter("outbox_events_failed_total");
    this.initCounter("notifications_sent_total");
    this.initCounter("twin_reconciliations_detected_total");

    // Initialize gauges
    this.setGauge("ws_active_connections", 0);
  }

  private initCounter(name: string): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, { total: 0, labeled: new Map() });
    }
  }

  public incrementCounter(name: string, by = 1, labels?: MetricLabels): void {
    this.initCounter(name);
    const counter = this.counters.get(name)!;
    counter.total += by;

    if (labels) {
      const labelKey = Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      const current = counter.labeled.get(labelKey) || 0;
      counter.labeled.set(labelKey, current + by);
    }
  }

  public setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  public getCounterValue(name: string): number {
    return this.counters.get(name)?.total || 0;
  }

  public getGaugeValue(name: string): number {
    return this.gauges.get(name) || 0;
  }

  public getSnapshot(): MetricSnapshot {
    const mem = process.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    const serializedCounters: MetricSnapshot["counters"] = {};
    for (const [name, counter] of this.counters.entries()) {
      const labeledObj: Record<string, number> = {};
      for (const [k, v] of counter.labeled.entries()) {
        labeledObj[k] = v;
      }
      serializedCounters[name] = {
        value: counter.total,
        labeled: Object.keys(labeledObj).length > 0 ? labeledObj : undefined
      };
    }

    const serializedGauges: MetricSnapshot["gauges"] = {};
    for (const [name, value] of this.gauges.entries()) {
      serializedGauges[name] = value;
    }

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      memory: {
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        rssBytes: mem.rss,
        externalBytes: mem.external
      },
      counters: serializedCounters,
      gauges: serializedGauges
    };
  }

  public reset(): void {
    for (const counter of this.counters.values()) {
      counter.total = 0;
      counter.labeled.clear();
    }
    this.gauges.clear();
    this.setGauge("ws_active_connections", 0);
  }
}

export const metricsRegistry = new MetricsRegistry();
