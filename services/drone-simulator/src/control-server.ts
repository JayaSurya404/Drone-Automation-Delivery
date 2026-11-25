import { createServer, type Server } from "node:http";
import type { Fault, SimDroneState } from "./simulation";

/**
 * A tiny, dev-only HTTP control surface for the standalone simulator process
 * — per the phase-06 requirement that fault scenarios be "triggerable via a
 * dev-only control endpoint or config." No framework dependency (Express
 * etc.) — Node's built-in `http` module is enough for two routes.
 *
 *   GET  /state              -> current in-memory state of every simulated drone
 *   POST /faults/:droneId    -> { "fault": "LOW_BATTERY" | "SIGNAL_LOSS" | "CRASH" }
 *
 * SECURITY (Phase 12): this server has NO authentication — anyone who can
 * reach its port can inject a fault into any simulated drone. That's an
 * accepted trade-off ONLY because it binds to `127.0.0.1` (see `listen()`
 * below) and is never containerized/port-mapped in `docker-compose.yml`.
 * This must never be bound to a non-loopback interface or exposed on a
 * shared/cloud host — there is no credential check to fall back on if it is.
 */
export function startControlServer(port: number, states: Map<string, SimDroneState>): Server {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    if (req.method === "GET" && url.pathname === "/state") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(Array.from(states.values())));
      return;
    }

    const faultMatch = /^\/faults\/([^/]+)$/.exec(url.pathname);
    if (req.method === "POST" && faultMatch) {
      const droneId = faultMatch[1] as string;
      let body = "";
      req.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on("end", () => {
        const state = states.get(droneId);
        if (!state) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unknown droneId — is it in SIMULATOR_DRONE_IDS?" }));
          return;
        }
        try {
          const parsed = JSON.parse(body) as { fault?: Fault };
          if (parsed.fault !== "LOW_BATTERY" && parsed.fault !== "SIGNAL_LOSS" && parsed.fault !== "CRASH") {
            throw new Error("fault must be one of LOW_BATTERY, SIGNAL_LOSS, CRASH");
          }
          state.pendingFault = parsed.fault;
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, droneId, fault: parsed.fault }));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Invalid request body" }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[drone-simulator] control server listening on http://127.0.0.1:${port} (GET /state, POST /faults/:droneId) — loopback only, unauthenticated`);
  });

  return server;
}
