import Fastify from "fastify";
const app = Fastify({ logger: true });
const modules = ["auth", "users", "organizations", "customers", "drones", "fleet", "orders", "packages", "missions", "routes", "telemetry", "geofences", "weather", "alerts", "incidents", "deliveries", "notifications", "analytics", "audit"];
app.get("/health", async () => ({ status: "ok", service: "api" }));
app.get("/api/v1/modules", async () => ({ modules }));
await app.listen({ port: Number(process.env.API_PORT ?? 3001), host: "0.0.0.0" });
//# sourceMappingURL=server.js.map