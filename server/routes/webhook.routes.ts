import { Router, Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';

export const webhookRouter = Router();

// Match any webhook URL variants
const WEBHOOK_PATHS = [
  '/webhooks/whatsapp',
  '/api/webhooks/whatsapp',
  '/webhook/whatsapp',
  '/api/webhook/whatsapp',
  '/api/whatsapp/webhook',
  '/whatsapp/webhook',
  '/webhooks/zapi',
  '/api/webhooks/zapi',
  '/webhook/zapi',
  '/api/webhook/zapi',
  '/webhooks/evolution',
  '/api/webhooks/evolution',
  '/webhook/evolution',
  '/api/webhook/evolution',
  '/zapi',
  '/api/zapi',
  '/webhooks/*',
  '/webhook/*',
];

// GET - Meta Webhook Verification & Test
webhookRouter.get(WEBHOOK_PATHS, (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  if (mode && token && challenge) {
    const verifiedChallenge = WhatsAppService.verifyWebhookChallenge(mode, token, challenge);
    if (verifiedChallenge) {
      console.log('✅ WhatsApp Webhook verified successfully by Meta challenge.');
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send(verifiedChallenge);
      return;
    }
  }

  res.status(200).json({ status: 'OK', message: 'Webhook endpoint active' });
});

// GET - Meta Media Download Proxy
webhookRouter.get(['/api/whatsapp/media/:mediaId', '/whatsapp/media/:mediaId'], async (req: Request, res: Response): Promise<void> => {
  try {
    const { mediaId } = req.params;
    const creds = WhatsAppService.getCredentials();
    if (!creds.accessToken) {
      res.status(401).json({ error: 'Meta Access Token não configurado.' });
      return;
    }

    // 1. Get media URL from Meta Graph API
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });

    if (!metaRes.ok) {
      res.status(metaRes.status).json({ error: 'Erro ao obter mídia da Meta.' });
      return;
    }

    const metaData: any = await metaRes.json();
    const mediaUrl = metaData.url;
    const mimeType = metaData.mime_type || 'application/octet-stream';

    // 2. Fetch binary stream with Bearer authorization
    const binRes = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${creds.accessToken}` },
    });

    if (!binRes.ok) {
      res.status(binRes.status).json({ error: 'Erro ao baixar arquivo da Meta.' });
      return;
    }

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const arrayBuffer = await binRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Error streaming WhatsApp media:', err);
    res.status(500).json({ error: 'Erro interno ao processar mídia.' });
  }
});

// POST - Meta, Z-API & Evolution Inbound Webhook
webhookRouter.post(WEBHOOK_PATHS, (req: Request, res: Response): void => {
  try {
    const body = req.body;
    console.log('📥 INCOMING WEBHOOK RECEIVED on path:', req.originalUrl || req.url, 'BODY:', JSON.stringify(body).slice(0, 300));
    WhatsAppService.handleInboundWebhook(body);
    res.status(200).json({ status: 'SUCCESS', message: 'EVENT_RECEIVED' });
  } catch (error) {
    console.error('Error handling WhatsApp webhook:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});


