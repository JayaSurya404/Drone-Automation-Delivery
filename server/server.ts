import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { initDb } from './db/database.js';
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

dotenv.config();

// Initialize database
initDb();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow configured or proxied origins
  credentials: true,
}));
app.use(express.json());

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

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected internal server error occurred.',
  });
});

// Create HTTP Server
const server = http.createServer(app);

// WebSocket Server for Realtime Drone Telemetry
const wss = new WebSocketServer({ server, path: '/ws' });

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

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SkyLink Autonomous Drone Backend Running on port ${PORT}`);
  console.log(`📡 REST API: http://localhost:${PORT}/api`);
  console.log(`🛸 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`======================================================\n`);
});

export { app, server };
