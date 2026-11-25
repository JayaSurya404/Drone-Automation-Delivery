import { getAdminEnv } from './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { WebSocketServer } from 'ws';
import { initDb } from './db/database.js';
import { requireAdmin, verifyAdminJwt } from './middleware/auth.js';
import { telemetryEngine } from './services/telemetryEngine.js';

import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import ordersRoutes from './routes/orders.js';
import dispatchRoutes from './routes/dispatch.js';
import missionsRoutes from './routes/missions.js';
import fleetRoutes from './routes/fleet.js';
import internalRoutes from './routes/internal.js';
import operationsRoutes from './routes/operations.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = getAdminEnv();

// Initialize SQLite database schema
initDb();

const app = express();
const PORT = env.PORT;

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS policy.`));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/images', express.static(path.resolve(__dirname, 'public/images')));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/api/health',
  message: { error: 'Rate limit exceeded. Please slow down.' },
});

app.use('/api', apiLimiter);
app.use('/api/admin/auth/login', authLimiter);

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

// Admin REST API Routes (/login is public, all other /api/admin/* enforce requireAdmin)
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/products', requireAdmin, productsRoutes);
app.use('/api/admin/orders', requireAdmin, ordersRoutes);
app.use('/api/admin/dispatch', requireAdmin, dispatchRoutes);
app.use('/api/admin/missions', requireAdmin, missionsRoutes);
app.use('/api/admin/fleet', requireAdmin, fleetRoutes);
app.use('/api/admin', requireAdmin, operationsRoutes);
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

// Fleet Realtime Telemetry WebSocket (JWT-authenticated via Authorization header or ?token= query param)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const host = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url || '', `http://${host}`);

  if (parsedUrl.pathname !== '/ws/admin') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const origin = req.headers.origin;
  if (origin && !env.CORS_ORIGINS.includes(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const authHeader = req.headers.authorization;
  const bearerToken =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : null;
  const queryToken = parsedUrl.searchParams.get('token');
  const admin = verifyAdminJwt(bearerToken || queryToken);

  if (!admin) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, admin);
  });
});

wss.on('connection', (ws) => {
  console.log('📡 [ADMIN-WS] Authenticated cockpit connected to fleet telemetry stream');
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
