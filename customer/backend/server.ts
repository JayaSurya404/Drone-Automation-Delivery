import { getCustomerEnv } from './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { initDb, queryOne } from './db/database.js';
import { verifyCustomerToken } from './middleware/auth.js';
import { droneTrackingService } from './services/droneTrackingService.js';

// Route imports
import authRoutes from './routes/auth.js';
import categoriesRoutes from './routes/categories.js';
import productsRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import wishlistRoutes from './routes/wishlist.js';
import addressesRoutes from './routes/addresses.js';
import checkoutRoutes from './routes/checkout.js';
import ordersRoutes from './routes/orders.js';
import trackingRoutes from './routes/tracking.js';
import notificationsRoutes from './routes/notifications.js';
import reviewsRoutes from './routes/reviews.js';
import supportRoutes from './routes/support.js';
import healthRoutes from './routes/health.js';
import airspaceRoutes from './routes/airspace.js';
import internalRoutes from './routes/internal.js';
import { verifySmtpConnection } from './services/emailService.js';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = getCustomerEnv();

// Initialize database
initDb();

const app = express();
const PORT = env.PORT;

// Middleware
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
  skip: (req) => req.path === '/health' || req.path.startsWith('/internal/'),
  message: { error: 'Rate limit exceeded. Please slow down.' },
});

const internalTelemetryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/verify-account', authLimiter);
app.use('/api/auth/resend-verification', authLimiter);
app.use('/api/internal', internalTelemetryLimiter);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      console.log(`[API] ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/addresses', addressesRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/airspace', airspaceRoutes);
app.use('/api/internal', internalRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected internal server error occurred.',
  });
});

// Create HTTP Server
const server = http.createServer(app);

// WebSocket Server for Realtime Drone Telemetry (with CORS Origin enforcement)
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const host = req.headers.host || 'localhost';
  const parsedUrl = new URL(req.url || '', `http://${host}`);

  if (parsedUrl.pathname !== '/ws') {
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

  const authHeader = req.headers['authorization'];
  const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = parsedUrl.searchParams.get('token') || bearer;
  const authResult = verifyCustomerToken(token);
  if (!authResult.user) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const orderId = parsedUrl.searchParams.get('orderId');
  if (orderId) {
    const order = queryOne<any>('SELECT customer_id FROM orders WHERE id = ?', [orderId]);
    if (!order || order.customer_id !== authResult.user.id) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
});

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const orderId = url.searchParams.get('orderId');

  if (!orderId) {
    ws.send(JSON.stringify({ error: 'orderId parameter required' }));
    ws.close();
    return;
  }

  // Send initial snapshot
  const initialSnapshot = droneTrackingService.getTrackingSnapshot(orderId);
  if (initialSnapshot) {
    ws.send(JSON.stringify({ type: 'SNAPSHOT', data: initialSnapshot }));
  }

  // Subscribe to live telemetry updates
  const unsubscribe = droneTrackingService.subscribe(orderId, (telemetry) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'TELEMETRY_UPDATE', data: telemetry }));
    }
  });

  ws.on('close', () => {
    unsubscribe();
  });
});

server.listen(Number(PORT), '0.0.0.0', async () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SkyNav Autonomous Drone Backend Running on port ${PORT}`);
  console.log(`📡 REST API: http://localhost:${PORT}/api`);
  console.log(`🛸 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
  try {
    const smtpStatus = await verifySmtpConnection();
    console.log(`📧 Email Delivery Service: [${smtpStatus.mode}] (Verified: ${smtpStatus.verified})`);
  } catch (err: any) {
    console.warn(`📧 Email Delivery Service: Check failed (${err.message})`);
  }
  console.log(`======================================================\n`);
});

export { app, server };
