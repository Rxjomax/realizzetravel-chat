import { Router, Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';

export const webhookRouter = Router();

// Match any webhook URL variants: /webhooks/zapi, /api/webhooks/zapi, /webhook/zapi, /zapi, etc.
const WEBHOOK_PATHS = [
  '/webhooks/whatsapp',
  '/api/webhooks/whatsapp',
  '/webhook/whatsapp',
  '/api/webhook/whatsapp',
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

  if (mode && token) {
    const verifiedChallenge = WhatsAppService.verifyWebhookChallenge(mode, token, challenge);
    if (verifiedChallenge) {
      console.log('✅ WhatsApp Webhook verified successfully by Meta challenge.');
      res.status(200).send(verifiedChallenge);
      return;
    }
  }

  res.status(200).json({ status: 'OK', message: 'Webhook endpoint active' });
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


