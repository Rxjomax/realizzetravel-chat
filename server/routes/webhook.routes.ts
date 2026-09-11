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

function createFallbackAudioBuffer(seconds = 3): Buffer {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * seconds);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);

  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const notes = [523.25, 659.25, 783.99, 1046.50];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(Math.floor(t * 1.5), notes.length - 1);
    const freq = notes[noteIdx];
    const localT = (t * 1.5) % 1.0;
    const env = Math.exp(-localT * 3.5);
    const val = (
      Math.sin(2 * Math.PI * freq * t) * 0.4 +
      Math.sin(2 * Math.PI * (freq * 2) * t) * 0.2 +
      Math.sin(2 * Math.PI * (freq * 3) * t) * 0.08
    ) * env * 0.35;
    const clamped = Math.max(-1, Math.min(1, val));
    const int16Val = Math.floor(clamped * 32767);
    buffer.writeInt16LE(int16Val, 44 + i * 2);
  }

  return buffer;
}

// GET - Universal Media Proxy for Audio/Images over HTTPS
webhookRouter.get(['/api/media/proxy', '/media/proxy'], async (req: Request, res: Response): Promise<void> => {
  try {
    const rawUrlParam = (req.query.url as string) || '';
    const msgIdParam = (req.query.msgId as string) || '';

    // 1. If base64 data URL
    if (rawUrlParam && rawUrlParam.startsWith('data:')) {
      const matches = rawUrlParam.match(/^data:([\w\/+-]+);base64,(.+)$/);
      if (matches) {
        const mime = matches[1];
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', mime.includes('audio') ? mime : 'audio/ogg');
        res.setHeader('Content-Length', buffer.length);
        res.setHeader('Accept-Ranges', 'bytes');
        res.status(200).send(buffer);
        return;
      }
    }

    const gatewayUrl = (process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
    const apiKey = (process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026').trim();
    const instanceName = (process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial').trim();

    // 2. If targetUrl is HTTP/HTTPS, fetch server-side with apikey headers
    if (rawUrlParam && (rawUrlParam.startsWith('http://') || rawUrlParam.startsWith('https://'))) {
      try {
        const fetchRes = await fetch(rawUrlParam, {
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`,
          },
        });
        if (fetchRes.ok) {
          const contentType = fetchRes.headers.get('content-type') || 'audio/ogg';
          const arrayBuf = await fetchRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          res.setHeader('Content-Type', contentType.includes('audio') ? contentType : 'audio/ogg');
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Accept-Ranges', 'bytes');
          res.status(200).send(buffer);
          return;
        }
      } catch {}
    }

    // 3. Try Evolution API downloadMedia if msgId is available
    if (msgIdParam) {
      try {
        const evoRes = await fetch(`${gatewayUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey,
          },
          body: JSON.stringify({
            message: { key: { id: msgIdParam } },
            convertToMp3: true,
          }),
        });
        if (evoRes.ok) {
          const data: any = await evoRes.json();
          const b64 = data?.base64 || data?.media;
          if (b64) {
            const cleanB64 = b64.replace(/^data:[^;]+;base64,/, '');
            const buffer = Buffer.from(cleanB64, 'base64');
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Length', buffer.length);
            res.setHeader('Accept-Ranges', 'bytes');
            res.status(200).send(buffer);
            return;
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Media proxy error:', err);
  }

  const fallbackWav = createFallbackAudioBuffer(3);
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Content-Length', fallbackWav.length);
  res.setHeader('Accept-Ranges', 'bytes');
  res.status(200).send(fallbackWav);
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


