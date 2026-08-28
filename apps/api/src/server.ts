import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { closeDb } from "./infrastructure/db/client.js";

const app = buildApp({ logger: true });

async function start() {
  try {
    await app.listen({
      port: env.API_PORT,
      host: env.API_HOST
    });
    console.log(`[skynav-api] Server running at http://${env.API_HOST}:${env.API_PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`[skynav-api] Received ${signal}. Shutting down gracefully...`);
  try {
    await app.close();
    await closeDb();
    console.log("[skynav-api] Shutdown complete.");
    process.exit(0);
  } catch (err) {
    console.error("[skynav-api] Error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

start();
