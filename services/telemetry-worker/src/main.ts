import { TelemetryWorker } from "./worker.js";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

console.log("[skynav-telemetry-worker] Initializing Telemetry Worker...");
console.log(`[skynav-telemetry-worker] Redis target: ${redisUrl.replace(/:[^:@]+@/, ":****@")}`);

const worker = new TelemetryWorker({
  redisUrl,
  onError: (err, raw) => {
    console.error("[skynav-telemetry-worker] Error processing telemetry frame:", err.message, raw ? `(Payload: ${raw.slice(0, 100)}...)` : "");
  }
});

async function start() {
  try {
    await worker.start();
    console.log("[skynav-telemetry-worker] Telemetry Worker is active and listening for telemetry frames.");

    // Periodic heartbeat log (every 60s)
    const metricsTimer = setInterval(() => {
      console.log("[skynav-telemetry-worker] Metrics:", JSON.stringify(worker.metrics));
    }, 60_000);
    metricsTimer.unref();
  } catch (err) {
    console.error("[skynav-telemetry-worker] Fatal startup error:", err);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.log(`[skynav-telemetry-worker] Received ${signal}. Shutting down worker gracefully...`);
  try {
    await worker.stop();
    console.log("[skynav-telemetry-worker] Telemetry Worker shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("[skynav-telemetry-worker] Error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();
