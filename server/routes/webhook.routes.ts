import { Router, Request, Response } from 'express';
import { WhatsAppService } from '../services/whatsapp.service';
import { dbGet, dbRun } from '../db/database';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../auth/middleware';

export const webhookRouter = Router();

// GET /webhooks/whatsapp - Meta Webhook Verification
webhookRouter.get('/webhooks/whatsapp', (req: Request, res: Response): void => {
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

// POST /webhooks/whatsapp - Meta Inbound Webhook
webhookRouter.post('/webhooks/whatsapp', (req: Request, res: Response): void => {
  try {
    WhatsAppService.handleInboundWebhook(req.body);
    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Error handling WhatsApp webhook:', error);
    res.status(500).send('SERVER_ERROR');
  }
});

// POST /api/webhooks/simulate-inbound - Simulation tool for testing WhatsApp incoming messages
webhookRouter.post('/api/webhooks/simulate-inbound', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const { name, phone, message } = req.body;
    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Mensagem é obrigatória para simular recebimento.' });
      return;
    }

    const orgId = req.user!.organization_id;
    const result = WhatsAppService.processInboundMessage({
      organizationId: orgId,
      name: name?.trim() || 'Novo Cliente WhatsApp',
      phone: phone?.trim() || `+55 11 9${Math.floor(10000000 + Math.random() * 90000000)}`,
      content: message.trim(),
      messageType: 'text',
      whatsappMessageId: `sim_wamid_${Date.now()}`,
    });

    const statusDesc = result.status === 'ASSIGNED'
      ? 'Cliente distribuído e atribuído automaticamente (Rodízio)!'
      : 'Cliente colocado na Fila de Espera (Aguardando atendimento manual).';

    res.json({
      success: true,
      message: `Mensagem processada com sucesso! ${statusDesc}${result.autoReplySent ? ' Resposta automática enviada.' : ''}`,
      details: result,
    });
  } catch (error) {
    console.error('Error simulating message:', error);
    res.status(500).json({ error: 'Erro ao simular recebimento.' });
  }
});

// GET /api/settings/whatsapp
webhookRouter.get('/api/settings/whatsapp', authenticateToken, requireRole(['ADMIN', 'SUPERVISOR']), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const row = dbGet<{ value: string }>('SELECT value FROM settings WHERE organization_id = ? AND key = ?', [
      orgId,
      'whatsapp_config',
    ]);

    let config = {
      phoneNumberId: '',
      businessAccountId: '',
      accessToken: '',
      verifyToken: 'viagens_whatsapp_verify_token_2026',
      status: 'DISCONNECTED',
    };

    if (row && row.value) {
      try {
        const parsed = JSON.parse(row.value);
        config = {
          phoneNumberId: parsed.phoneNumberId || '',
          businessAccountId: parsed.businessAccountId || '',
          accessToken: parsed.accessToken ? '••••••••••••••••' + parsed.accessToken.slice(-6) : '',
          verifyToken: parsed.verifyToken || 'viagens_whatsapp_verify_token_2026',
          status: parsed.status || 'CONNECTED',
        };
      } catch (e) {}
    }

    res.json({ config });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações do WhatsApp.' });
  }
});

// PUT /api/settings/whatsapp
webhookRouter.put('/api/settings/whatsapp', authenticateToken, requireRole(['ADMIN']), (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const { phoneNumberId, businessAccountId, accessToken, verifyToken } = req.body;
    const now = new Date().toISOString();

    const existingRow = dbGet<{ value: string }>(
      'SELECT value FROM settings WHERE organization_id = ? AND key = ?',
      [orgId, 'whatsapp_config']
    );

    let currentToken = '';
    if (existingRow && existingRow.value) {
      try {
        const current = JSON.parse(existingRow.value);
        currentToken = current.accessToken || '';
      } catch (e) {}
    }

    const tokenToSave =
      accessToken && !accessToken.includes('••••') ? accessToken.trim() : currentToken;

    const newConfig = {
      phoneNumberId: phoneNumberId?.trim() || '',
      businessAccountId: businessAccountId?.trim() || '',
      accessToken: tokenToSave,
      verifyToken: verifyToken?.trim() || 'viagens_whatsapp_verify_token_2026',
      status: tokenToSave && phoneNumberId ? 'CONNECTED' : 'DISCONNECTED',
    };

    dbRun(
      `INSERT INTO settings (id, organization_id, key, value, created_at, updated_at)
       VALUES (?, ?, 'whatsapp_config', ?, ?, ?)
       ON CONFLICT(organization_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [`set_wa_${orgId}`, orgId, JSON.stringify(newConfig), now, now]
    );

    res.json({ success: true, message: 'Configurações do WhatsApp salvas com sucesso.' });
  } catch (error) {
    console.error('Error saving WhatsApp settings:', error);
    res.status(500).json({ error: 'Erro ao salvar credenciais do WhatsApp.' });
  }
});
