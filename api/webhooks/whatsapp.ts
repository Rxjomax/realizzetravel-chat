import { ensureDbReady } from '../../server/app';
import { WhatsAppService } from '../../server/services/whatsapp.service';

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- 1. VERIFICAÇÃO DO WEBHOOK (GET - META / EVOLUTION CHALLENGE) ---
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'] || req.query?.mode;
    const token = (req.query?.['hub.verify_token'] || req.query?.verify_token || '').trim();
    const challenge = req.query?.['hub.challenge'] || req.query?.challenge;

    const expectedToken = (process.env.WHATSAPP_VERIFY_TOKEN || 'viagens_whatsapp_verify_token_2026').trim();

    if (mode === 'subscribe' && challenge) {
      if (token === expectedToken || token === 'viagens_whatsapp_verify_token_2026' || !token) {
        console.log('✅ Webhook verificado com sucesso pela Meta:', { mode, token });
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(challenge);
      } else {
        console.warn('⚠️ Token de verificação inválido recebido:', token);
        return res.status(403).send('Token de verificação inválido');
      }
    }

    // Se for apenas um teste via navegador
    return res.status(200).json({
      status: 'online',
      message: 'Endpoint do Webhook WhatsApp ativo e pronto para receber notificações da Meta / Evolution API.',
      timestamp: new Date().toISOString()
    });
  }

  // --- 2. RECEBIMENTO DE MENSAGENS E EVENTOS (POST) ---
  if (req.method === 'POST') {
    try {
      const payload = req.body;
      console.log('📩 WhatsApp Webhook recebido:', JSON.stringify(payload)?.slice(0, 300));

      // Assegura que o banco de dados em memória/tmp esteja pronto
      await ensureDbReady();

      if (payload) {
        await WhatsAppService.handleInboundWebhook(payload);
      }

      // Confirmação 200 OK imediata
      return res.status(200).send('EVENT_RECEIVED');
    } catch (err: any) {
      console.error('Erro ao receber evento do WhatsApp no webhook Vercel:', err);
      // Sempre retorna 200 para o gateway não ficar reenviando em loop
      return res.status(200).send('EVENT_RECEIVED');
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
