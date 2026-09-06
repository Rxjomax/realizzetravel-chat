import { Router, Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';
import { dbGet, dbRun } from '../db/database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';

export const webhookRouter = Router();

// GET /webhooks/whatsapp - Meta Webhook Verification
webhookRouter.get(['/webhooks/whatsapp', '/api/webhooks/whatsapp'], (req: Request, res: Response): void => {
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

  res.status(403).send('Forbidden');
});

// POST /webhooks/whatsapp - Meta Inbound & QR Code Gateway Webhook
webhookRouter.post(['/webhooks/whatsapp', '/api/webhooks/whatsapp', '/api/webhooks/evolution', '/api/webhooks/zapi'], (req: Request, res: Response): void => {
  try {
    WhatsAppService.handleInboundWebhook(req.body);
    res.status(200).json({ status: 'SUCCESS', message: 'EVENT_RECEIVED' });
  } catch (error) {
    console.error('Error handling WhatsApp webhook:', error);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});


