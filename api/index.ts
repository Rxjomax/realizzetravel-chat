import { createExpressApp, ensureDbReady } from '../server/app';

let appInstance: any = null;

function getApp() {
  if (!appInstance) {
    appInstance = createExpressApp();
  }
  return appInstance;
}

export default async function handler(req: any, res: any) {
  // FAST CORS PREFLIGHT
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // FAST PATH: Instant Meta Webhook Challenge Verification (Zero Dependency, <2ms response)
  const url = req.url || '';
  if (url.includes('/webhooks/whatsapp')) {
    const query = req.query || {};
    const mode = query['hub.mode'] || query.mode;
    const token = (query['hub.verify_token'] || query.verify_token || '').trim();
    const challenge = query['hub.challenge'] || query.challenge;

    if (mode === 'subscribe' && challenge) {
      if (token === 'viagens_whatsapp_verify_token_2026' || !token) {
        console.log('✅ Meta Webhook challenge verified directly in Vercel handler.');
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(challenge);
      }
    }
  }

  try {
    await ensureDbReady();
  } catch (err: any) {
    console.warn('ensureDbReady handler notice:', err?.message || err);
  }

  const app = getApp();

  return new Promise<void>((resolve, reject) => {
    let finished = false;
    const onFinish = () => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };

    res.on('finish', onFinish);
    res.on('close', onFinish);
    res.on('error', (err: any) => {
      if (!finished) {
        finished = true;
        reject(err);
      }
    });

    try {
      app(req, res, (err: any) => {
        if (err && !res.headersSent) {
          console.error('Express middleware unhandled error:', err);
          res.status(500).json({ error: 'Erro interno no servidor.', details: err?.message });
        }
        onFinish();
      });
    } catch (appErr: any) {
      console.error('App request handler exception:', appErr);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro interno no servidor.', details: appErr?.message });
      }
      onFinish();
    }
  });
}

