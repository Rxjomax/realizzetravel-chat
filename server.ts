import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createExpressApp, ensureDbReady } from './server/app';
import { initWebSocketServer } from './server/realtime/ws';

async function startServer() {
  const PORT = 3000;

  // Initialize DB and Seed Data
  console.log('📦 Initializing database...');
  await ensureDbReady();

  const app = createExpressApp();
  const httpServer = http.createServer(app);

  // Initialize WebSockets
  initWebSocketServer(httpServer);

  // Vite Middleware in Dev, Static in Prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`✈️ Central WhatsApp Viagens Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
});

