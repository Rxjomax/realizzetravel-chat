import express from 'express';
import { getDatabase } from './db/database';
import { seedDatabase } from './db/seed';
import { authRouter } from './routes/auth.routes';
import { usersRouter } from './routes/users.routes';
import { conversationsRouter } from './routes/conversations.routes';
import { customersRouter } from './routes/customers.routes';
import { webhookRouter } from './routes/webhook.routes';
import { settingsRouter } from './routes/settings.routes';

import { WhatsAppService } from './services/whatsapp.service';
import { WebhookRelayService } from './services/webhook-relay.service';

let dbInitialized = false;
let initPromise: Promise<void> | null = null;

export async function ensureDbReady(): Promise<void> {
  if (dbInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await getDatabase();
        await seedDatabase();
        dbInitialized = true;
        
        // Auto-sync active WhatsApp chats from Z-API into desk
        WhatsAppService.syncZapiRecentChats('org_realizzetravel').catch((e) => {
          console.warn('Auto Z-API sync notice on startup:', e.message);
        });

        // Only start long-running SSE relay in local/container dev, not inside short-lived Serverless lambdas
        const isServerless = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
        if (!isServerless) {
          WebhookRelayService.start().catch((e) => {
            console.warn('Webhook Relay notice:', e.message);
          });
        }
      } catch (err: any) {
        console.error('ensureDbReady initialization error:', err);
      }
    })();
  }
  return initPromise;
}

export function createExpressApp(): express.Express {
  const app = express();

  // Body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // CORS & Options
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }
    next();
  });

  // Health check - instant response
  app.get(['/api/health', '/health'], (req, res) => {
    res.json({
      status: 'ok',
      service: 'Central WhatsApp Viagens',
      timestamp: new Date().toISOString(),
    });
  });

  // Middleware to ensure DB is initialized on incoming requests
  app.use(async (req, res, next) => {
    try {
      await ensureDbReady();
      next();
    } catch (err: any) {
      console.error('Database initialization error:', err);
      next();
    }
  });

  // API Routes (mounted both on /api/... and root in case Vercel rewrites or strips /api)
  app.use(['/api/auth', '/auth'], authRouter);
  app.use(['/api/users', '/users'], usersRouter);
  app.use(['/api/conversations', '/conversations'], conversationsRouter);
  app.use(['/api/customers', '/customers'], customersRouter);
  app.use(['/api/settings', '/settings'], settingsRouter);
  app.use(['/api', '/'], webhookRouter);

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Ocorreu um erro interno no servidor. Tente novamente.' });
  });

  return app;
}
