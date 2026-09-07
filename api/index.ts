import { createExpressApp, ensureDbReady } from '../server/app';

let appInstance: any = null;

function getApp() {
  if (!appInstance) {
    appInstance = createExpressApp();
  }
  return appInstance;
}

export default async function handler(req: any, res: any) {
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
    console.error('ensureDbReady handler notice:', err?.message || err);
  }

  try {
    const app = getApp();
    return app(req, res);
  } catch (appErr: any) {
    console.error('App request handler error:', appErr);
    return res.status(500).json({ error: 'Erro interno no servidor.', details: appErr?.message });
  }
}

