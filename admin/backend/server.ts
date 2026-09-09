import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer } from 'ws';
import { initDb } from './db/database.js';
import { telemetryEngine } from './services/telemetryEngine.js';

import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';
import dispatchRoutes from './routes/dispatch.js';
import missionsRoutes from './routes/missions.js';
import fleetRoutes from './routes/fleet.js';
import internalRoutes from './routes/internal.js';

dotenv.config();

// Initialize SQLite database schema
initDb();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path !== '/api/health') {
      console.log(`[ADMIN-API] ${req.method} ${req.path} ${res.statusCode} (${Date.now() - start}ms)`);
    }
  });
  next();
});

// Admin REST API Routes
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/products', productsRoutes);
app.use('/api/admin/orders', ordersRoutes);
app.use('/api/admin/dispatch', dispatchRoutes);
app.use('/api/admin/missions', missionsRoutes);
app.use('/api/admin/fleet', fleetRoutes);
app.use('/api/internal', internalRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'admin-backend', port: PORT, timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ADMIN-API Error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

const server = http.createServer(app);

// Fleet Realtime Telemetry WebSocket
const wss = new WebSocketServer({ server, path: '/ws/admin' });
wss.on('connection', (ws) => {
  console.log('📡 [ADMIN-WS] Cockpit connected to fleet telemetry stream');
  telemetryEngine.registerAdminWs(ws);
});

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`\n=============================================================`);
  console.log(`🛸 SkyNav Mission Control & Admin Backend Running on port ${PORT}`);
  console.log(`📡 REST API: http://localhost:${PORT}/api/admin`);
  console.log(`🛰️ WebSocket: ws://localhost:${PORT}/ws/admin`);
  console.log(`=============================================================\n`);
});

export { app, server };
