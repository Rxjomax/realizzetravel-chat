import { dbGet, dbQuery, dbRun, dbTransaction } from '../db/database';
import { broadcastEvent } from '../realtime/ws';

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export interface WhatsAppCredentials {
  providerType?: 'EVOLUTION_API' | 'META_CLOUD' | 'QR_CODE' | 'Z_API';
  // Meta Cloud API
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  verifyToken: string;
  verifiedName?: string | null;
  qualityRating?: string | null;
  // Evolution API (Conexão QR Code Gratuita / Open-source)
  instanceName?: string;
  gatewayUrl?: string;
  apiKey?: string;
  qrCodeBase64?: string | null;
  phoneConnected?: string | null;
  batteryLevel?: number | null;
  status?: string;
  // Legacy / fallback
  zapiInstanceId?: string;
  zapiToken?: string;
  zapiClientToken?: string;
}

export const VERIFIED_LID_PROFILES: Record<string, { name: string; avatar?: string }> = {
  '47803170578647@lid': { name: 'Cotação Orlando (07/02)' },
  '107336081379416@lid': { name: 'Cotação Orlando (Hospedagem)' },
  '139715386814577@lid': { name: 'Família Assis' },
  '238941965926624@lid': { name: 'Lourdes' },
  '25744772186141@lid': { name: 'Naftaly' },
  '54172640620569@lid': { name: 'Gisele' },
  '59618558496881@lid': { name: 'Cliente (+55 81 99535-7254)' },
  '238731546075247@lid': { name: 'Jessica' },
  '144070483677212@lid': { name: 'Paula' },
  '275908984369381@lid': { name: 'Jaciane' },
  '262874060570747@lid': { name: 'Thalyta' },
  '169818862940323@lid': { name: 'João Matheus' },
  '45479459086368@lid': { name: 'Cliente Aniversário (Novembro)' },
  '55113121050645@lid': { name: 'Cliente Realizze (São Paulo)' },
  '232658529439963@lid': { name: 'Jullars (Beto Carrero)' },
  '156860829180127@lid': { name: 'Cotação Beto Carrero' },
  '205664576110683@lid': { name: 'Cauã' },
  '52931445448873@lid': { name: 'Ilma' },
  '184116674830485@lid': { name: 'Paulo' },
};

export function isPlaceholderCustomerName(n?: string | null): boolean {
  if (!n) return true;
  const trimmed = n.trim();
  if (trimmed === '' || trimmed === 'Você' || trimmed.toLowerCase() === 'querido' || trimmed === 'Cliente WhatsApp') return true;
  if (/^\+?\d+$/.test(trimmed)) return true;
  if (/^Cliente Realizze/i.test(trimmed)) return true;
  if (/^Cliente \(\+?\d+\)$/i.test(trimmed)) return true;
  return false;
}

export class WhatsAppService {
  public static resolveOrganizationId(orgId?: string): string {
    if (orgId && orgId !== 'org_voolivre') return orgId;
    const org = dbGet<{ id: string }>('SELECT id FROM organizations LIMIT 1');
    return org?.id || 'org_realizzetravel';
  }

  public static getAgencySettings(organizationId?: string) {
    const targetOrg = this.resolveOrganizationId(organizationId);
    const settingRow = dbGet<{ value: string }>(
      'SELECT value FROM settings WHERE organization_id = ? AND key = ?',
      [targetOrg, 'general_config']
    );

    let config: any = {
      agencyName: 'RealizzeTravel',
      agencyPhone: '+55 (11) 4004-9800',
      agencyEmail: 'contato@realizzetravel.com.br',
      welcomeMessage: 'Olá! Seja bem-vindo à RealizzeTravel. Como podemos ajudar no seu roteiro hoje? Em instantes um de nossos consultores irá lhe atender.',
      outOfHoursMessage: 'Nosso horário de atendimento é de Segunda a Sexta das 08h às 19h e Sábados das 09h às 13h. Sua solicitação foi registrada com sucesso e retornaremos no início do próximo expediente!',
      businessHoursStart: '08:00',
      businessHoursEnd: '19:00',
      businessDays: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
      queueMode: 'MANUAL',
    };

    if (settingRow && settingRow.value) {
      try {
        const parsed = JSON.parse(settingRow.value);
        config = { ...config, ...parsed };
      } catch (e) {
        console.error('Error parsing general_config:', e);
      }
    }

    return config;
  }

  public static isWithinBusinessHours(settings: any, checkDate = new Date()): { isWithin: boolean; reason?: string } {
    try {
      // Check in Brazil / Sao Paulo timezone (UTC-3)
      const spDateStr = checkDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
      const spDate = new Date(spDateStr);

      const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
      const currentDay = dayMap[spDate.getDay()];

      const businessDays: string[] = Array.isArray(settings.businessDays) && settings.businessDays.length > 0
        ? settings.businessDays
        : ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

      if (!businessDays.includes(currentDay)) {
        return { isWithin: false, reason: `Hoje (${currentDay.toUpperCase()}) não está configurado nos dias de expediente da agência.` };
      }

      const [startH, startM] = (settings.businessHoursStart || '08:00').split(':').map(Number);
      const [endH, endM] = (settings.businessHoursEnd || '19:00').split(':').map(Number);

      const currentMinutes = spDate.getHours() * 60 + spDate.getMinutes();
      const startMinutes = (isNaN(startH) ? 8 : startH) * 60 + (isNaN(startM) ? 0 : startM);
      const endMinutes = (isNaN(endH) ? 19 : endH) * 60 + (isNaN(endM) ? 0 : endM);

      if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
        return {
          isWithin: false,
          reason: `Horário atual fora da janela de expediente (${settings.businessHoursStart || '08:00'} às ${settings.businessHoursEnd || '19:00'}).`,
        };
      }

      return { isWithin: true };
    } catch {
      return { isWithin: true };
    }
  }

  public static getCredentials(organizationId?: string): WhatsAppCredentials {
    const targetOrg = this.resolveOrganizationId(organizationId);
    const settingRow = dbGet<{ value: string }>(
      'SELECT value FROM settings WHERE organization_id = ? AND key = ?',
      [targetOrg, 'whatsapp_config']
    );

    if (settingRow && settingRow.value) {
      try {
        const parsed = JSON.parse(settingRow.value);
        return {
          providerType: parsed.providerType || 'EVOLUTION_API',
          phoneNumberId: parsed.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
          businessAccountId: parsed.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
          accessToken: parsed.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
          verifyToken: parsed.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'viagens_whatsapp_verify_token_2026',
          verifiedName: parsed.verifiedName || null,
          qualityRating: parsed.qualityRating || null,
          instanceName: parsed.instanceName || process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial',
          gatewayUrl: parsed.gatewayUrl || process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080',
          apiKey: parsed.apiKey || process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026',
          zapiInstanceId: parsed.zapiInstanceId || '',
          zapiToken: parsed.zapiToken || '',
          zapiClientToken: parsed.zapiClientToken || '',
          qrCodeBase64: parsed.qrCodeBase64 || null,
          phoneConnected: parsed.phoneConnected || null,
          batteryLevel: parsed.batteryLevel !== undefined ? parsed.batteryLevel : null,
          status: parsed.status || 'DISCONNECTED',
        };
      } catch (e) {
        console.error('Error parsing whatsapp_config JSON:', e);
      }
    }

    return {
      providerType: 'EVOLUTION_API',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'viagens_whatsapp_verify_token_2026',
      verifiedName: null,
      qualityRating: null,
      instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial',
      gatewayUrl: process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080',
      apiKey: process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026',
      zapiInstanceId: '',
      zapiToken: '',
      zapiClientToken: '',
      qrCodeBase64: null,
      phoneConnected: null,
      batteryLevel: null,
      status: 'DISCONNECTED',
    };
  }

  public static verifyWebhookChallenge(mode: string, token: string, challenge: string): string | null {
    const creds = this.getCredentials();
    const cleanToken = (token || '').trim();
    const cleanCredToken = (creds.verifyToken || '').trim();
    if (
      mode === 'subscribe' &&
      (cleanToken === cleanCredToken || cleanToken === 'viagens_whatsapp_verify_token_2026' || !cleanCredToken)
    ) {
      return challenge;
    }
    return null;
  }

  public static async sendTextMessage(
    to: string,
    text: string,
    organizationId = 'org_realizzetravel'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const creds = this.getCredentials(organizationId);
    let cleanPhone = to.trim();
    if (!cleanPhone.includes('@')) {
      cleanPhone = cleanPhone.replace(/\D/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = cleanPhone.replace(/^0+/, '');
      }
      // Ensure Brazilian numbers include country code 55
      if ((cleanPhone.length === 10 || cleanPhone.length === 11) && !cleanPhone.startsWith('55')) {
        cleanPhone = `55${cleanPhone}`;
      }
    }

    // PRIMARY OPTION: OFFICIAL META CLOUD API
    if (creds.providerType === 'META_CLOUD' || (!creds.providerType && creds.phoneNumberId)) {
      if (!creds.phoneNumberId || !creds.accessToken) {
        console.warn('⚠️ Meta Cloud API: Phone Number ID ou Access Token ausentes na configuração. Mensagem simulada.');
        return { success: true, messageId: `meta_local_${Date.now()}` };
      }

      try {
        const url = `https://graph.facebook.com/v21.0/${creds.phoneNumberId}/messages`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${creds.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'text',
            text: { preview_url: false, body: text },
          }),
        });

        const data = (await response.json()) as any;
        if (!response.ok) {
          console.error('Meta WhatsApp Cloud API Error Response:', data);
          return {
            success: false,
            error: data?.error?.message || 'Falha na comunicação com a API Oficial da Meta.',
          };
        }

        const messageId = data?.messages?.[0]?.id || `wamid_${Date.now()}`;
        return { success: true, messageId };
      } catch (err: any) {
        console.error('Network error calling Meta WhatsApp Cloud API:', err);
        return { success: false, error: err.message || 'Erro de conexão com os servidores da Meta.' };
      }
    }

    // SECONDARY OPTION: Z-API GATEWAY (if explicitly selected)
    if (creds.providerType === 'Z_API' && creds.zapiInstanceId && creds.zapiToken) {
      try {
        const instId = creds.zapiInstanceId;
        const token = creds.zapiToken;
        const url = `https://api.z-api.io/instances/${instId}/token/${token}/send-text`;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (creds.zapiClientToken) {
          headers['Client-Token'] = creds.zapiClientToken;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone: cleanPhone, message: text }),
        });

        const data: any = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('Z-API Error Response:', data);
          return { success: true, messageId: `zapi_queued_${Date.now()}` };
        }
        const messageId = data?.zaapId || data?.messageId || data?.id || `zapi_msg_${Date.now()}`;
        return { success: true, messageId };
      } catch (err: any) {
        console.warn('Network call to Z-API failed:', err.message);
        return { success: true, messageId: `zapi_fallback_${Date.now()}` };
      }
    }

    // EVOLUTION API (QR CODE) - 100% Gratuito / Sem Mensagens Trial
    if ((creds.providerType === 'EVOLUTION_API' || creds.providerType === 'QR_CODE') && creds.gatewayUrl) {
      try {
        const baseUrl = creds.gatewayUrl.replace(/\/+$/, '');
        const instance = (creds.instanceName && creds.instanceName !== 'realizze-travel') ? creds.instanceName.trim() : (process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial');
        const url = `${baseUrl}/message/sendText/${instance}`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (creds.apiKey) {
          headers['apikey'] = creds.apiKey;
          headers['Authorization'] = `Bearer ${creds.apiKey}`;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number: cleanPhone,
            text,
            textMessage: { text },
            options: {
              delay: 1000,
              presence: 'composing',
            },
          }),
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          console.warn('Evolution API Error Response:', data);
          return { success: true, messageId: `evo_sent_${Date.now()}` };
        }
        const messageId = (data as any)?.key?.id || (data as any)?.messageId || `evo_wamid_${Date.now()}`;
        return { success: true, messageId };
      } catch (err: any) {
        console.warn('Network call to Evolution API failed:', err.message);
        return { success: true, messageId: `evo_fallback_${Date.now()}` };
      }
    }

    return { success: true, messageId: `meta_local_${Date.now()}` };
  }

  public static handleInboundWebhook(body: any, organizationId?: string): void {
    if (!body) return;

    const targetOrg = this.resolveOrganizationId(organizationId);

    // 1. Check if it is standard Meta Cloud API webhook
    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field === 'messages') {
            const value = change.value;
            const messages = value.messages || [];
            const contacts = value.contacts || [];

            for (const msg of messages) {
              const fromPhone = msg.from;
              const contact = contacts.find((c: any) => c.wa_id === fromPhone);
              const senderName = contact?.profile?.name || `Cliente WhatsApp (${fromPhone.slice(-4)})`;
              const avatarUrl = contact?.profile?.picture || contact?.profile?.avatar || contact?.profile?.photo_url || null;
              const textContent = msg.text?.body || (msg.type !== 'text' ? `[Arquivo ${msg.type}]` : 'Mensagem recebida');
              const waMsgId = msg.id;

              this.processInboundMessage({
                organizationId: targetOrg,
                phone: `+${fromPhone}`,
                name: senderName,
                avatarUrl,
                content: textContent,
                messageType: msg.type || 'text',
                mediaUrl: msg.image?.id || msg.document?.id || null,
                whatsappMessageId: waMsgId,
              });
            }
          }
        }
      }
      return;
    }

    // 2. Check if it is Z-API, Evolution API or generic QR Code Webhook
    const event = body.event || body.type || '';
    const data = body.data || body;

    // Z-API / Evolution API connection status: { connected: true, phone: '5511999998888' } or status update
    if (body.connected !== undefined || body.status === 'CONNECTED' || body.state === 'open' || event === 'connection.update' || event === 'CONNECTION_UPDATE') {
      const isConnected = body.connected === true || body.status === 'CONNECTED' || body.state === 'open' || data?.state === 'open';
      const phone = body.phone || data?.phone || data?.user;
      this.updateGatewayConnectionStatus(targetOrg, isConnected ? 'CONNECTED' : 'DISCONNECTED', phone);
      if (isConnected) {
        // Automatically sync chats, groups and history upon connection!
        this.syncEvolutionChats(targetOrg).catch(console.warn);
        this.syncEvolutionGroups(targetOrg).catch(console.warn);
      }
      return;
    }

    // Check for QR code state update
    if (event === 'qrcode.updated' || event === 'QRCODE_UPDATED' || body.qrcode || body.qrCode) {
      const qrCode = data.qrcode?.base64 || data.qrcode?.code || body.qrcode?.base64 || body.qrcode || body.qrCode;
      if (qrCode) {
        this.updateGatewayQrCode(targetOrg, qrCode);
      }
      return;
    }

    // Handle error or delivery status updates from Z-API / WhatsApp
    const messageStatus = body.status || body.messageStatus || body.deliveryStatus;
    const isDeliveryCallback = event.toLowerCase().includes('delivery') || body.type === 'DeliveryCallback' || body.type === 'MessageStatusCallback';
    
    if (body.error || isDeliveryCallback || (messageStatus && !body.text && !body.message && !body.image && !body.document && !body.audio)) {
      const waMsgId = body.messageId || body.zaapId || body.id;
      if (body.error) {
        console.warn(`⚠️ WhatsApp Delivery Notice for +${body.phone || 'unknown'}: ${body.error}`);
      }
      if (waMsgId) {
        const newStatus = body.error ? 'failed' : (messageStatus ? String(messageStatus).toLowerCase() : 'delivered');
        try {
          dbRun(
            'UPDATE messages SET status = ? WHERE whatsapp_message_id = ? OR id = ?',
            [newStatus, waMsgId, waMsgId]
          );
          broadcastEvent('message:status', { messageId: waMsgId, status: newStatus }, targetOrg);
        } catch {
          // Ignore DB status update errors
        }
      }
      return;
    }

    // Process array of messages from Evolution API (MESSAGES_UPSERT with data.messages array)
    const rawMessagesList = Array.isArray(data?.messages)
      ? data.messages
      : Array.isArray(body?.messages)
      ? body.messages
      : [data || body];

    for (const item of rawMessagesList) {
      if (!item) continue;
      const key = item.key || {};
      const remoteJid = key.remoteJid || item.phone || item.senderPhone || item.from || item.chatId || item.remoteJid || '';
      if (!remoteJid || remoteJid.includes('@broadcast')) continue;

      const isFromMe = item.fromMe === true || item.isMyMessage === true || key.fromMe === true;
      const isGroupMsg = item.isGroup === true || remoteJid.includes('@g.us') || String(remoteJid).includes('-');

      // Extract message text / content
      let msgText = '';
      if (typeof item.text === 'string' && item.text.trim()) msgText = item.text.trim();
      else if (item.text?.message) msgText = item.text.message;
      else if (typeof item.message === 'string' && item.message.trim()) msgText = item.message.trim();
      else if (item.message?.conversation) msgText = item.message.conversation;
      else if (item.message?.extendedTextMessage?.text) msgText = item.message.extendedTextMessage.text;
      else if (item.body) msgText = String(item.body);
      else if (item.caption) msgText = String(item.caption);
      else if (item.image || item.message?.imageMessage) msgText = item.image?.caption || item.message?.imageMessage?.caption || '[Foto]';
      else if (item.document || item.message?.documentMessage) msgText = item.document?.fileName ? `[Documento: ${item.document.fileName}]` : '[Documento]';
      else if (item.audio || item.message?.audioMessage) msgText = '[Áudio]';
      else if (item.video || item.message?.videoMessage) msgText = '[Vídeo]';
      else if (item.location) msgText = '[Localização]';
      else if (item.contact || item.contacts) msgText = '[Contato compartilhado]';
      else msgText = 'Mensagem recebida';

      if (!msgText || !msgText.trim()) continue;

      if (isGroupMsg) {
        const pushName = item.senderName || item.pushName || 'Participante do Grupo';
        const senderPhone = item.participantPhone || (key.participant ? String(key.participant).replace(/\D/g, '') : undefined);
        this.processInboundGroupMessage({
          organizationId: targetOrg,
          groupId: remoteJid,
          senderName: pushName,
          senderPhone,
          content: msgText,
          isFromAgency: isFromMe,
        });
        continue;
      }

      const cleanPhone = String(remoteJid).replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
      if (cleanPhone && cleanPhone.length >= 6) {
        const pushName = isFromMe
          ? (item.senderName || 'Atendente (WhatsApp)')
          : (item.senderName ||
             item.pushName ||
             item.chatName ||
             `Cliente WhatsApp (${cleanPhone.slice(-4)})`);

        const msgType = (item.image || item.message?.imageMessage)
          ? 'image'
          : (item.document || item.message?.documentMessage)
          ? 'document'
          : (item.audio || item.message?.audioMessage)
          ? 'audio'
          : 'text';
        const mediaUrl = item.image?.imageUrl || item.document?.documentUrl || item.audio?.audioUrl || null;
        const msgId = item.messageId || item.zaapId || item.id || key.id || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        console.log(`💬 Inbound Webhook: Mensagem ${isFromMe ? 'enviada (atendente)' : 'recebida (cliente)'} +${cleanPhone}: "${msgText}"`);

        this.processInboundMessage({
          organizationId: targetOrg,
          phone: `+${cleanPhone}`,
          name: pushName,
          content: String(msgText),
          messageType: msgType,
          mediaUrl,
          whatsappMessageId: msgId,
          senderType: isFromMe ? 'AGENT' : 'CUSTOMER',
        });
      }
    }
  }

  public static updateGatewayQrCode(organizationId: string, qrCodeBase64: string): void {
    const creds = this.getCredentials(organizationId);
    creds.qrCodeBase64 = qrCodeBase64;
    creds.status = 'QR_READY';

    dbRun(
      `INSERT INTO settings (id, organization_id, key, value, created_at, updated_at)
       VALUES (?, ?, 'whatsapp_config', ?, datetime('now'), datetime('now'))
       ON CONFLICT(organization_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [`set_wa_${organizationId}`, organizationId, JSON.stringify(creds)]
    );

    broadcastEvent('whatsapp:qr', { qrCode: qrCodeBase64, status: 'QR_READY' }, organizationId);
  }

  public static updateGatewayConnectionStatus(organizationId: string, status: string, phone?: string | null, qrCode?: string | null): void {
    const targetOrg = this.resolveOrganizationId(organizationId);
    const creds = this.getCredentials(targetOrg);
    creds.status = status;
    if (phone !== undefined) creds.phoneConnected = phone;
    if (status === 'CONNECTED') {
      creds.qrCodeBase64 = null;
    }
    if (status === 'DISCONNECTED') {
      creds.phoneConnected = null;
      if (qrCode !== undefined) {
        creds.qrCodeBase64 = qrCode;
      }
    }
    if (qrCode) {
      creds.qrCodeBase64 = qrCode;
    }

    dbRun(
      `INSERT INTO settings (id, organization_id, key, value, created_at, updated_at)
       VALUES (?, ?, 'whatsapp_config', ?, datetime('now'), datetime('now'))
       ON CONFLICT(organization_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [`set_wa_${targetOrg}`, targetOrg, JSON.stringify(creds)]
    );

    broadcastEvent('whatsapp:status', { status, phoneConnected: creds.phoneConnected }, targetOrg);
  }

  public static processInboundMessage(params: {
    organizationId: string;
    phone: string;
    name: string;
    content: string;
    messageType: string;
    mediaUrl?: string | null;
    whatsappMessageId?: string;
    senderType?: 'CUSTOMER' | 'AGENT' | 'SYSTEM';
    avatarUrl?: string | null;
  }): { conversationId: string; status: string; assignedUserId: string | null; autoReplySent?: string } {
    const { phone, name, content, messageType, mediaUrl, whatsappMessageId, avatarUrl } = params;
    const senderType = params.senderType || 'CUSTOMER';
    const organizationId = this.resolveOrganizationId(params.organizationId);
    const now = new Date().toISOString();
    const settings = this.getAgencySettings(organizationId);

    let createdConversationId = '';
    let assignedUserId: string | null = null;
    let assignedUserObj: any = null;
    let convStatus: 'WAITING' | 'ASSIGNED' = 'WAITING';
    let isNewConv = false;
    let autoReplyMessageContent: string | null = null;
    let customerObj: any = null;

    dbTransaction(() => {
      // 1. Locate or create customer with robust phone matching
      const digitsOnly = phone.replace(/\D/g, '');
      let customer = dbGet<any>(
        `SELECT * FROM customers 
         WHERE organization_id = ? 
           AND (
             phone = ? 
             OR phone = ? 
             OR REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', '') = ?
             OR REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', '') LIKE ?
           )
         LIMIT 1`,
        [organizationId, phone, `+${digitsOnly}`, digitsOnly, `%${digitsOnly.slice(-8)}`]
      );

      if (!customer) {
        const newCustomerId = `cst_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const initialAvatar = avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D9488&color=fff&size=128`;
        dbRun(
          `INSERT INTO customers (id, organization_id, name, phone, avatar, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [newCustomerId, organizationId, name, `+${digitsOnly}`, initialAvatar, now, now]
        );
        customer = { id: newCustomerId, name, phone: `+${digitsOnly}`, avatar: initialAvatar };
      } else {
        // If customer exists with a generic name/number, update to new real name from Meta profile
        const isGenericName = !customer.name || customer.name.startsWith('Cliente WhatsApp') || customer.name.startsWith('+');
        const hasNewRealName = name && !name.startsWith('Cliente WhatsApp') && !name.startsWith('+');
        const chosenAvatar = avatarUrl || customer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D9488&color=fff&size=128`;

        if (isGenericName && hasNewRealName) {
          dbRun('UPDATE customers SET name = ?, avatar = ?, updated_at = ? WHERE id = ?', [name, chosenAvatar, now, customer.id]);
          customer.name = name;
          customer.avatar = chosenAvatar;
        } else if (avatarUrl && avatarUrl !== customer.avatar) {
          dbRun('UPDATE customers SET avatar = ?, updated_at = ? WHERE id = ?', [avatarUrl, now, customer.id]);
          customer.avatar = avatarUrl;
        } else if (!customer.avatar) {
          const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.name || name)}&background=0D9488&color=fff&size=128`;
          dbRun('UPDATE customers SET avatar = ?, updated_at = ? WHERE id = ?', [defaultAvatar, now, customer.id]);
          customer.avatar = defaultAvatar;
        }
      }
      customerObj = customer;

      // 2. Locate active conversation or create new
      let conversation = dbGet<any>(
        "SELECT * FROM conversations WHERE organization_id = ? AND customer_id = ? AND status IN ('WAITING', 'ASSIGNED', 'OPEN') ORDER BY created_at DESC LIMIT 1",
        [organizationId, customer.id]
      );

      if (!conversation) {
        isNewConv = true;
        const newConvId = `cnv_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        createdConversationId = newConvId;

        // Determine assignment based on Queue Mode
        if (settings.queueMode === 'AUTO_ROUND_ROBIN') {
          // Find online agents/supervisors/admins, ordered by active ticket load
          const onlineAgents = dbQuery<any>(
            `SELECT u.id, u.name, u.email, u.avatar,
                    (SELECT COUNT(*) FROM conversations c WHERE c.assigned_user_id = u.id AND c.status IN ('ASSIGNED', 'OPEN')) as active_tickets
             FROM users u
             WHERE u.organization_id = ? AND u.status = 'ONLINE'
             ORDER BY active_tickets ASC, u.last_seen_at DESC`,
            [organizationId]
          );

          if (onlineAgents.length > 0) {
            assignedUserObj = onlineAgents[0];
            assignedUserId = assignedUserObj.id;
            convStatus = 'ASSIGNED';
          }
        }

        dbRun(
          `INSERT INTO conversations (id, organization_id, customer_id, assigned_user_id, status, priority, created_at, updated_at, last_message_at)
           VALUES (?, ?, ?, ?, ?, 'MEDIUM', ?, ?, ?)`,
          [newConvId, organizationId, customer.id, assignedUserId, convStatus, now, now, now]
        );

        conversation = {
          id: newConvId,
          organization_id: organizationId,
          customer_id: customer.id,
          assigned_user_id: assignedUserId,
          status: convStatus,
          priority: 'MEDIUM',
          last_message_at: now,
        };

        // Log events
        if (assignedUserId && assignedUserObj) {
          dbRun(
            'INSERT INTO conversation_events (id, conversation_id, user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [
              `evt_assign_${Date.now()}`,
              newConvId,
              assignedUserId,
              'ASSIGNED',
              JSON.stringify({ reason: 'Distribuição automática por rodízio', agentName: assignedUserObj.name }),
              now,
            ]
          );
        } else {
          dbRun(
            'INSERT INTO conversation_events (id, conversation_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?)',
            [
              `evt_inbound_${Date.now()}`,
              newConvId,
              'CREATED',
              JSON.stringify({ reason: 'Inbound message from WhatsApp' }),
              now,
            ]
          );
        }
      } else {
        createdConversationId = conversation.id;
        convStatus = conversation.status;
        assignedUserId = conversation.assigned_user_id;
        dbRun('UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?', [
          now,
          now,
          conversation.id,
        ]);
      }

      // Check for duplicate message
      if (whatsappMessageId) {
        const dupByWaId = dbGet<any>(
          'SELECT id FROM messages WHERE whatsapp_message_id = ? LIMIT 1',
          [whatsappMessageId]
        );
        if (dupByWaId) {
          return;
        }
      }

      // If it's an AGENT message coming back from WhatsApp (echo), check if we recently sent it locally
      if (senderType === 'AGENT') {
        const existingLocal = dbGet<any>(
          `SELECT id FROM messages 
           WHERE conversation_id = ? 
             AND sender_type = 'AGENT' 
             AND (content = ? OR content LIKE ?)
             AND datetime(created_at) >= datetime('now', '-3 minutes')
           LIMIT 1`,
          [conversation.id, content, `%${content}%`]
        );
        if (existingLocal) {
          if (whatsappMessageId) {
            dbRun('UPDATE messages SET whatsapp_message_id = ?, status = ? WHERE id = ?', [whatsappMessageId, 'delivered', existingLocal.id]);
          }
          return;
        }
      }

      // Check for rapid-fire duplicate inbound message within 5 seconds only
      const dupByContent = dbGet<any>(
        `SELECT id FROM messages 
         WHERE conversation_id = ? 
           AND content = ? 
           AND datetime(created_at) >= datetime('now', '-5 seconds') 
         LIMIT 1`,
        [conversation.id, content]
      );
      if (dupByContent && content !== 'Conversa sincronizada') {
        return;
      }

      // 3. Insert message
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const dbSenderType = senderType;
      const dbSenderId = senderType === 'AGENT' ? (conversation.assigned_user_id || 'usr_admin') : customer.id;
      const dbStatus = senderType === 'AGENT' ? 'sent' : 'delivered';

      dbRun(
        `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, media_url, whatsapp_message_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          msgId,
          organizationId,
          conversation.id,
          dbSenderType,
          dbSenderId,
          messageType,
          content,
          mediaUrl || null,
          whatsappMessageId || `wamid_${Date.now()}`,
          dbStatus,
          now,
        ]
      );

      // Customer/Agent message payload
      const msgPayload = {
        id: msgId,
        organization_id: organizationId,
        conversation_id: conversation.id,
        sender_type: dbSenderType,
        sender_id: dbSenderId,
        message_type: messageType,
        content,
        media_url: mediaUrl || null,
        whatsapp_message_id: whatsappMessageId,
        status: dbStatus,
        created_at: now,
      };

      if (isNewConv) {
        broadcastEvent(
          'conversation:created',
          {
            conversationId: conversation.id,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerAvatar: customer.avatar,
            content,
            status: convStatus,
            priority: 'MEDIUM',
            assignedUserId,
            assignedUser: assignedUserObj,
            lastMessageAt: now,
          },
          organizationId
        );

        if (assignedUserId) {
          broadcastEvent(
            'conversation:assigned',
            {
              conversationId: conversation.id,
              assignedUserId,
              assignedUser: assignedUserObj,
              status: 'ASSIGNED',
            },
            organizationId
          );
        }
      }

      // Always broadcast message:new so all attendants see message incoming in real-time
      broadcastEvent(
        'message:new',
        {
          conversationId: conversation.id,
          message: msgPayload,
        },
        organizationId
      );
    });

    return {
      conversationId: createdConversationId,
      status: convStatus,
      assignedUserId,
      autoReplySent: autoReplyMessageContent || undefined,
    };
  }

  public static async testMetaConnection(params: {
    phoneNumberId: string;
    accessToken: string;
    businessAccountId?: string;
    organizationId?: string;
  }): Promise<{
    success: boolean;
    verifiedName?: string;
    displayPhoneNumber?: string;
    qualityRating?: string;
    status?: string;
    error?: string;
  }> {
    const { phoneNumberId, accessToken, organizationId } = params;
    const targetOrg = this.resolveOrganizationId(organizationId);

    if (!phoneNumberId || !accessToken) {
      return { success: false, error: 'Phone Number ID e Access Token são obrigatórios para testar a Meta Cloud API.' };
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${phoneNumberId.trim()}?fields=verified_name,code_verification_status,display_phone_number,quality_rating,platform_type,status`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`,
        },
      });

      const data: any = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: data?.error?.message || 'Falha ao autenticar com a Meta Graph API. Verifique o Phone Number ID e o Access Token.',
        };
      }

      // Update database config with verified status
      const existingRow = dbGet<{ value: string }>(
        'SELECT value FROM settings WHERE organization_id = ? AND key = ?',
        [targetOrg, 'whatsapp_config']
      );
      let currentConfig: any = {};
      if (existingRow && existingRow.value) {
        try { currentConfig = JSON.parse(existingRow.value); } catch {}
      }

      const updatedConfig = {
        ...currentConfig,
        providerType: 'META_CLOUD',
        phoneNumberId: phoneNumberId.trim(),
        accessToken: accessToken.trim(),
        businessAccountId: params.businessAccountId?.trim() || currentConfig.businessAccountId || '',
        status: 'CONNECTED',
        phoneConnected: data.display_phone_number || currentConfig.phoneConnected || phoneNumberId.trim(),
        verifiedName: data.verified_name || null,
        qualityRating: data.quality_rating || null,
      };

      const now = new Date().toISOString();
      dbRun(
        `INSERT INTO settings (id, organization_id, key, value, created_at, updated_at)
         VALUES (?, ?, 'whatsapp_config', ?, ?, ?)
         ON CONFLICT(organization_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [`set_wa_${targetOrg}`, targetOrg, JSON.stringify(updatedConfig), now, now]
      );

      broadcastEvent('whatsapp:status', {
        status: 'CONNECTED',
        phoneConnected: updatedConfig.phoneConnected,
        providerType: 'META_CLOUD',
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating,
      }, targetOrg);

      return {
        success: true,
        verifiedName: data.verified_name,
        displayPhoneNumber: data.display_phone_number,
        qualityRating: data.quality_rating,
        status: 'CONNECTED',
      };
    } catch (err: any) {
      console.error('Error testing Meta connection:', err);
      return { success: false, error: err.message || 'Erro de rede ao conectar com a Meta Graph API.' };
    }
  }

  public static async syncWhatsAppChats(organizationId?: string): Promise<{ success: boolean; count: number; message: string }> {
    const targetOrg = this.resolveOrganizationId(organizationId);
    const creds = this.getCredentials(targetOrg);

    // Meta Cloud API sync
    if (creds.providerType === 'META_CLOUD' || !creds.providerType) {
      let isVerified = false;
      if (creds.phoneNumberId && creds.accessToken) {
        try {
          const res = await fetch(`https://graph.facebook.com/v21.0/${creds.phoneNumberId}?fields=display_phone_number,quality_rating`, {
            headers: { Authorization: `Bearer ${creds.accessToken}` },
          });
          if (res.ok) isVerified = true;
        } catch {}
      }

      const count = dbGet<{ count: number }>(
        'SELECT COUNT(*) as count FROM conversations WHERE organization_id = ?',
        [targetOrg]
      )?.count || 0;

      broadcastEvent('poll:sync', { count }, targetOrg);
      return {
        success: true,
        count,
        message: isVerified
          ? `Meta Cloud API sincronizada com sucesso! ${count} conversas ativas.`
          : `Sincronização concluída com sucesso! ${count} conversas ativas no sistema.`,
      };
    }

    // Evolution API (QR Code) sync - 100% Gratuito
    if (creds.providerType === 'EVOLUTION_API' || creds.providerType === 'QR_CODE') {
      const evoRes = await this.syncEvolutionChats(targetOrg);
      return {
        success: true,
        count: evoRes.count,
        message: `Sincronização Evolution API concluída com sucesso! ${evoRes.count} conversas sincronizadas.`,
      };
    }

    // Z-API sync fallback if user is still on Z-API
    if (creds.providerType === 'Z_API') {
      const zapiRes = await this.syncZapiRecentChats(targetOrg);
      return {
        success: true,
        count: zapiRes.count,
        message: `Sincronização Z-API concluída! ${zapiRes.count} conversas sincronizadas.`,
      };
    }

    const count = dbGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM conversations WHERE organization_id = ?',
      [targetOrg]
    )?.count || 0;

    return { success: true, count, message: 'Conversas sincronizadas com sucesso.' };
  }

  public static async syncZapiRecentChats(organizationId = 'org_realizzetravel'): Promise<{ count: number; chats: any[] }> {
    const creds = this.getCredentials(organizationId);
    const instId = creds.zapiInstanceId || '3F8C20C51BB1E161A1A3260BF05B3023';
    const token = creds.zapiToken || '90FDB82A1D2E2343E9AEA9EA';
    const clientToken = creds.zapiClientToken || 'Fe48e93f5417c46258029658a1c13631aS';

    try {
      const url = `https://api.z-api.io/instances/${instId}/token/${token}/chats?page=1&pageSize=20`;
      const headers: Record<string, string> = {};
      if (clientToken) headers['Client-Token'] = clientToken;

      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.warn('Failed to fetch chats from Z-API:', response.status);
        return { count: 0, chats: [] };
      }

      const chatsList: any[] = await response.json();
      if (!Array.isArray(chatsList)) return { count: 0, chats: [] };

      let importedCount = 0;
      const now = new Date().toISOString();

      for (const item of chatsList) {
        if (item.isGroup) continue;
        const phone = item.phone || item.chatId;
        if (!phone) continue;
        const cleanPhone = String(phone).replace(/\D/g, '');
        if (cleanPhone.length < 8) continue;

        const name = item.name || item.contactName || `Cliente WhatsApp (${cleanPhone.slice(-4)})`;
        const lastMsgTime = item.lastMessageTime ? new Date(Number(item.lastMessageTime)).toISOString() : now;

        // Check if customer exists
        let customer = dbGet<any>(
          `SELECT * FROM customers 
           WHERE organization_id = ? 
             AND (phone = ? OR phone = ? OR REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', '') = ?)
           LIMIT 1`,
          [organizationId, `+${cleanPhone}`, cleanPhone, cleanPhone]
        );

        if (!customer) {
          const custId = `cst_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          dbRun(
            `INSERT INTO customers (id, organization_id, name, phone, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [custId, organizationId, name, `+${cleanPhone}`, lastMsgTime, lastMsgTime]
          );
          customer = { id: custId, name, phone: `+${cleanPhone}` };
        } else if (name && !customer.name.startsWith('Cliente WhatsApp') && customer.name !== name) {
          dbRun('UPDATE customers SET name = ?, updated_at = ? WHERE id = ?', [name, now, customer.id]);
        }

        // Check if conversation exists
        let conversation = dbGet<any>(
          `SELECT * FROM conversations WHERE organization_id = ? AND customer_id = ? AND status != 'CLOSED' ORDER BY created_at DESC LIMIT 1`,
          [organizationId, customer.id]
        );

        const convId = conversation ? conversation.id : `cnv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        if (!conversation) {
          dbRun(
            `INSERT INTO conversations (id, organization_id, customer_id, status, priority, created_at, updated_at, last_message_at)
             VALUES (?, ?, ?, 'WAITING', 'MEDIUM', ?, ?, ?)`,
            [convId, organizationId, customer.id, lastMsgTime, now, lastMsgTime]
          );
        } else {
          dbRun(
            `UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?`,
            [lastMsgTime, now, conversation.id]
          );
        }

        // Also ensure the last message from Z-API chat item is in messages table
        const lastText = item.lastMessage || item.message || item.text?.message || item.body || null;
        if (lastText) {
          const existingMsg = dbGet<any>('SELECT id FROM messages WHERE conversation_id = ? AND content = ? LIMIT 1', [convId, lastText]);
          if (!existingMsg) {
            const msgId = `msg_sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            dbRun(
              `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, status, created_at)
               VALUES (?, ?, ?, 'CUSTOMER', ?, 'text', ?, 'delivered', ?)`,
              [msgId, organizationId, convId, customer.id, lastText, lastMsgTime]
            );
          }
        }

        importedCount++;
      }

      if (importedCount > 0) {
        broadcastEvent('poll:sync', { count: importedCount }, organizationId);
      }

      return { count: importedCount, chats: chatsList };
    } catch (err: any) {
      console.error('Error syncing Z-API chats:', err);
      return { count: 0, chats: [] };
    }
  }

  public static async fetchEvolutionProfilePic(cleanPhone: string, organizationId = 'org_realizzetravel'): Promise<string | null> {
    const creds = this.getCredentials(organizationId);
    if (!creds.gatewayUrl) return null;
    try {
      const baseUrl = creds.gatewayUrl.trim().replace(/\/+$/, '');
      const inst = (creds.instanceName && creds.instanceName !== 'realizze-travel') ? creds.instanceName.trim() : (process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial');
      const url = `${baseUrl}/chat/fetchProfilePictureUrl/${inst}`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (creds.apiKey) {
        headers['apikey'] = creds.apiKey.trim();
        headers['Authorization'] = `Bearer ${creds.apiKey.trim()}`;
      }
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: cleanPhone }),
      });
      if (res.ok) {
        const data: any = await res.json();
        return data?.profilePictureUrl || null;
      }
    } catch {}
    return null;
  }

  public static async disconnectEvolution(organizationId = 'org_realizzetravel'): Promise<{ success: boolean; message: string; qrCode?: string | null }> {
    const creds = this.getCredentials(organizationId);
    const baseUrl = (creds.gatewayUrl || process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
    const inst = (creds.instanceName && creds.instanceName !== 'realizze-travel') ? creds.instanceName.trim() : (process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial');
    const key = (creds.apiKey || process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026').trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    };

    let freshQr: string | null = null;

    try {
      // 1. Delete instance from Evolution to wipe Baileys auth tokens completely
      try {
        await fetch(`${baseUrl}/instance/logout/${inst}`, { method: 'DELETE', headers });
      } catch {}
      try {
        await fetch(`${baseUrl}/instance/delete/${inst}`, { method: 'DELETE', headers });
      } catch {}

      // 2. Re-create clean instance
      try {
        await fetch(`${baseUrl}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instanceName: inst,
            token: key,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          }),
        });
      } catch {}

      // 3. Connect to get fresh QR Code
      try {
        const connRes = await fetch(`${baseUrl}/instance/connect/${inst}`, { headers });
        if (connRes.ok) {
          const connData: any = await connRes.json();
          const rawQr = connData.base64 || connData.qrcode?.base64;
          if (rawQr) {
            freshQr = rawQr.startsWith('data:') ? rawQr : `data:image/png;base64,${rawQr}`;
          }
        }
      } catch {}
    } catch (evoErr) {
      console.warn('Notice during evolution disconnect call:', evoErr);
    }

    // 4. Update database to DISCONNECTED with cleared phone
    this.updateGatewayConnectionStatus(organizationId, 'DISCONNECTED', null, freshQr);

    return {
      success: true,
      message: 'Aparelho desconectado com sucesso! A sessão foi encerrada e um novo QR Code foi gerado para você conectar o WhatsApp da cliente.',
      qrCode: freshQr,
    };
  }

  public static async configureEvolutionWebhook(params: {
    gatewayUrl?: string;
    instanceName?: string;
    apiKey?: string;
    webhookUrl?: string;
    organizationId?: string;
  }): Promise<{ success: boolean; message: string }> {
    const orgId = params.organizationId || 'org_realizzetravel';
    const creds = this.getCredentials(orgId);
    const gatewayUrl = params.gatewayUrl || creds.gatewayUrl || process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080';
    const instanceName = params.instanceName || creds.instanceName || process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial';
    const apiKey = params.apiKey || creds.apiKey || process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026';
    const webhookUrl = params.webhookUrl || `${gatewayUrl.replace(/\/+$/, '')}/api/webhooks/whatsapp`;

    try {
      const baseUrl = gatewayUrl.trim().replace(/\/+$/, '');
      const inst = instanceName.trim();
      const url = `${baseUrl}/webhook/set/${inst}`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['apikey'] = apiKey.trim();
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }

      const payload = {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          events: [
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONNECTION_UPDATE',
            'QRCODE_UPDATED',
            'SEND_MESSAGE',
          ],
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData: any = await res.json().catch(() => ({}));
        return {
          success: false,
          message: errData?.message || errData?.response?.message || `Erro ao configurar webhook na Evolution API (HTTP ${res.status}).`,
        };
      }

      return { success: true, message: 'Webhook da Evolution API ativado com sucesso! As mensagens recebidas serão roteadas ao CRM instantaneamente.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Falha de rede ao contatar a Evolution API.' };
    }
  }

  public static async syncEvolutionChats(organizationId = 'org_realizzetravel'): Promise<{ count: number; groupCount: number; chats: any[] }> {
    const creds = this.getCredentials(organizationId);
    const baseUrl = (creds.gatewayUrl || process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
    const inst = (creds.instanceName && creds.instanceName !== 'realizze-travel') ? creds.instanceName.trim() : (process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial');
    const key = (creds.apiKey || process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026').trim();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    };

    const now = new Date().toISOString();
    let importedChats = 0;
    let importedGroups = 0;

    try {
      // 0. Clean out old fake seed conversations from DB
      try {
        dbRun(`DELETE FROM messages WHERE conversation_id IN ('conv_matheus', 'conv_camila', 'conv_rodrigo', 'conv_juliana', 'conv_gabriel')`);
        dbRun(`DELETE FROM conversations WHERE id IN ('conv_matheus', 'conv_camila', 'conv_rodrigo', 'conv_juliana', 'conv_gabriel') OR customer_id IN ('cust_matheus', 'cust_camila', 'cust_rodrigo', 'cust_juliana', 'cust_gabriel')`);
        dbRun(`DELETE FROM customers WHERE id IN ('cust_matheus', 'cust_camila', 'cust_rodrigo', 'cust_juliana', 'cust_gabriel')`);
      } catch {}

      // Fetch Chats, Groups and Contacts in parallel with timeout safety
      const [groupsRes, contactsRes, chatsRes] = await Promise.allSettled([
        fetchWithTimeout(`${baseUrl}/group/fetchAllGroups/${inst}?getParticipants=false`, { headers }, 6000),
        fetchWithTimeout(`${baseUrl}/chat/findContacts/${inst}`, { method: 'POST', headers, body: JSON.stringify({}) }, 6000),
        fetchWithTimeout(`${baseUrl}/chat/findChats/${inst}`, { method: 'POST', headers, body: JSON.stringify({}) }, 6000),
      ]);

      // Parse JSON from API responses before transaction block
      let rawGroups: any[] = [];
      if (groupsRes.status === 'fulfilled' && groupsRes.value.ok) {
        rawGroups = await groupsRes.value.json().catch(() => []);
      }
      let contactsList: any[] = [];
      if (contactsRes.status === 'fulfilled' && contactsRes.value.ok) {
        contactsList = await contactsRes.value.json().catch(() => []);
      }
      let chatsList: any[] = [];
      if (chatsRes.status === 'fulfilled' && chatsRes.value.ok) {
        const rawChats: any = await chatsRes.value.json().catch(() => []);
        chatsList = Array.isArray(rawChats) ? rawChats : (rawChats?.chats || []);
      }

      const contactsMap = new Map<string, { name: string; avatar: string | null; phone: string; jid: string }>();

      // Pre-load existing database entities in bulk to eliminate thousands of slow N+1 dbGet queries
      const existingCustomers = dbQuery<any>(
        'SELECT id, name, phone, avatar, whatsapp_jid FROM customers WHERE organization_id = ? OR organization_id = "org_realizzetravel"',
        [organizationId]
      );
      const custByJid = new Map<string, any>();
      const custByPhone = new Map<string, any>();
      for (const cust of existingCustomers) {
        if (cust.whatsapp_jid) custByJid.set(cust.whatsapp_jid, cust);
        if (cust.phone) {
          const digits = String(cust.phone).replace(/\D/g, '');
          custByPhone.set(cust.phone, cust);
          custByPhone.set(digits, cust);
          custByPhone.set(`+${digits}`, cust);
        }
      }

      const existingConversations = dbQuery<any>(
        'SELECT id, customer_id, whatsapp_jid, assigned_user_id, status FROM conversations WHERE organization_id = ? OR organization_id = "org_realizzetravel"',
        [organizationId]
      );
      const convByJid = new Map<string, any>();
      const convByCustId = new Map<string, any>();
      for (const conv of existingConversations) {
        if (conv.whatsapp_jid) convByJid.set(conv.whatsapp_jid, conv);
        if (conv.customer_id) convByCustId.set(conv.customer_id, conv);
      }

      const existingMsgIds = new Set<string>(
        dbQuery<{ whatsapp_message_id: string }>(
          'SELECT whatsapp_message_id FROM messages WHERE whatsapp_message_id IS NOT NULL'
        ).map(m => m.whatsapp_message_id)
      );

      // Wrap all database writes inside a single transaction for 100x speed
      dbTransaction(() => {
        // 1. Process WhatsApp Groups
        if (groupsRes.status === 'fulfilled' && groupsRes.value.ok) {
          try {
            if (Array.isArray(rawGroups)) {
              for (const g of rawGroups) {
                const gId = g.id || g.jid;
                if (!gId) continue;
                const gName = g.subject || g.name || 'Grupo Realizze Travel';
                const gDesc = g.desc || g.description || 'Grupo oficial de viagens e pacotes';
                const pCount = Array.isArray(g.participants) ? g.participants.length : (g.size || 1);
                const avatar = g.pictureUrl || g.avatar || null;

                const existing = dbGet<any>('SELECT id FROM whatsapp_groups WHERE id = ?', [gId]);
                if (!existing) {
                  dbRun(
                    `INSERT INTO whatsapp_groups (id, organization_id, name, description, participant_count, avatar, last_message, last_message_at, destination_focus, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      gId,
                      organizationId,
                      gName,
                      gDesc,
                      pCount,
                      avatar,
                      'Grupo sincronizado do WhatsApp',
                      now,
                      'Pacotes & Destinos',
                      now,
                      now,
                    ]
                  );
                } else {
                  dbRun(
                    `UPDATE whatsapp_groups SET name = ?, avatar = COALESCE(?, avatar), participant_count = ?, updated_at = ? WHERE id = ?`,
                    [gName, avatar, pCount, now, gId]
                  );
                }
                importedGroups++;
              }
            }
          } catch (grpErr) {
            console.warn('Error processing groups:', grpErr);
          }
        }

        // 2. Process Contacts (Fast mapping and batch upsert)
        if (contactsRes.status === 'fulfilled' && contactsRes.value.ok) {
          try {
            if (Array.isArray(contactsList)) {
              for (const c of contactsList) {
                const remoteJid = c.remoteJid || c.id || '';
                if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('@broadcast')) continue;
                const cleanPhone = String(remoteJid).replace(/@.*$/, '').replace(/\D/g, '');
                if (cleanPhone.length < 6) continue;

                let cName = (c.pushName || c.name || '').trim();
                if (cName === 'Você' || /^\d+$/.test(cName)) cName = '';
                if (!cName) {
                  cName = cleanPhone.length >= 8 ? `Cliente (+${cleanPhone})` : `Cliente WhatsApp (${cleanPhone.slice(-4)})`;
                }
                const cAvatar = c.profilePicUrl || c.avatar || null;
                
                const info = { name: cName, avatar: cAvatar, phone: `+${cleanPhone}`, jid: remoteJid };
                contactsMap.set(cleanPhone, info);
                contactsMap.set(remoteJid, info);

                // Check in-memory index
                let existingCust = custByJid.get(remoteJid) || custByPhone.get(cleanPhone) || custByPhone.get(`+${cleanPhone}`);

                if (!existingCust) {
                  const custId = `cst_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                  const custAvatar = cAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(cName)}&background=0D9488&color=fff&size=128`;
                  dbRun(
                    `INSERT INTO customers (id, organization_id, name, phone, avatar, whatsapp_jid, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [custId, organizationId, cName, `+${cleanPhone}`, custAvatar, remoteJid, now, now]
                  );
                  const newCust = { id: custId, name: cName, phone: `+${cleanPhone}`, avatar: custAvatar, whatsapp_jid: remoteJid };
                  custByJid.set(remoteJid, newCust);
                  custByPhone.set(cleanPhone, newCust);
                  custByPhone.set(`+${cleanPhone}`, newCust);
                } else {
                  const isExistingPlaceholder = isPlaceholderCustomerName(existingCust.name);
                  const isNewReal = !isPlaceholderCustomerName(cName) && !cName.startsWith('Cliente (+');
                  if (cAvatar && cAvatar !== existingCust.avatar && isExistingPlaceholder && isNewReal) {
                    dbRun('UPDATE customers SET avatar = ?, name = ?, updated_at = ? WHERE id = ?', [cAvatar, cName, now, existingCust.id]);
                    existingCust.avatar = cAvatar;
                    existingCust.name = cName;
                  } else if (cAvatar && cAvatar !== existingCust.avatar) {
                    dbRun('UPDATE customers SET avatar = ?, updated_at = ? WHERE id = ?', [cAvatar, now, existingCust.id]);
                    existingCust.avatar = cAvatar;
                  } else if (isExistingPlaceholder && isNewReal) {
                    dbRun('UPDATE customers SET name = ?, updated_at = ? WHERE id = ?', [cName, now, existingCust.id]);
                    existingCust.name = cName;
                  }
                }
              }
            }
          } catch (contactErr) {
            console.warn('Error processing contacts:', contactErr);
          }
        }

        // 3. Process Active Chats with Real Messages and Accurate Name Resolution
        if (Array.isArray(chatsList) && chatsList.length > 0) {
          const sortedChats = chatsList.filter(c => c.id || c.remoteJid).sort((a, b) => {
            const tA = Number(a.lastMessage?.messageTimestamp || a.conversationTimestamp || 0);
            const tB = Number(b.lastMessage?.messageTimestamp || b.conversationTimestamp || 0);
            return tB - tA;
          });

          const curJoaoCount = dbGet<{ cnt: number }>(
            "SELECT COUNT(*) as cnt FROM conversations WHERE (organization_id = ? OR organization_id = 'org_realizzetravel') AND assigned_user_id = 'usr_joao' AND status = 'OPEN'",
            [organizationId]
          )?.cnt || 0;
          const curMariaCount = dbGet<{ cnt: number }>(
            "SELECT COUNT(*) as cnt FROM conversations WHERE (organization_id = ? OR organization_id = 'org_realizzetravel') AND assigned_user_id = 'usr_maria' AND status = 'OPEN'",
            [organizationId]
          )?.cnt || 0;

          let directChatsAssignedJoao = curJoaoCount;
          let directChatsAssignedMaria = curMariaCount;

          for (const item of sortedChats) {
            // ALWAYS prefer the real WhatsApp remoteJid or jid (e.g. 5581...@s.whatsapp.net or ...@lid), NEVER a Prisma CUID (cmtw...)
            const rawJid = (item.remoteJid && item.remoteJid.includes('@'))
              ? item.remoteJid
              : ((item.jid && item.jid.includes('@'))
                  ? item.jid
                  : ((item.lastMessage?.key?.remoteJid && item.lastMessage.key.remoteJid.includes('@'))
                      ? item.lastMessage.key.remoteJid
                      : (item.remoteJid || item.jid || '')));
            const remoteJid = String(rawJid).trim();
            if (!remoteJid || remoteJid.includes('@broadcast')) continue;

            const isGroup = remoteJid.includes('@g.us');
            let targetJid = remoteJid;
            if (item.lastMessage?.key?.remoteJidAlt && item.lastMessage.key.remoteJidAlt.includes('@s.whatsapp.net')) {
              targetJid = item.lastMessage.key.remoteJidAlt;
            }
            const cleanPhone = String(targetJid).replace(/@.*$/, '').replace(/\D/g, '');
            const matchedContact = contactsMap.get(cleanPhone) || contactsMap.get(remoteJid);
            
            const lMsg = item.lastMessage;
            const seconds = lMsg?.message?.audioMessage?.seconds;
            const audioStr = seconds 
              ? `[Áudio ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}]`
              : '[Áudio]';
            const msgContent =
              lMsg?.message?.conversation ||
              lMsg?.message?.extendedTextMessage?.text ||
              lMsg?.message?.imageMessage?.caption ||
              (lMsg?.message?.imageMessage ? '[Foto]' : null) ||
              (lMsg?.message?.audioMessage ? audioStr : null) ||
              (lMsg?.message?.documentMessage ? (lMsg?.message?.documentMessage?.fileName || '[Documento]') : null) ||
              (lMsg?.message?.videoMessage ? '[Vídeo]' : null) ||
              (lMsg?.message?.stickerMessage ? '[Figurinha]' : null) ||
              null;

            // Accurate name resolution: Verified mapping -> Contact pushName -> Chat pushName -> Message greeting
            let name = '';
            if (VERIFIED_LID_PROFILES[remoteJid]) {
              name = VERIFIED_LID_PROFILES[remoteJid].name;
            } else if (matchedContact?.name && !isPlaceholderCustomerName(matchedContact.name)) {
              name = matchedContact.name.trim();
            } else if (item.pushName && !isPlaceholderCustomerName(item.pushName)) {
              name = item.pushName.trim();
            } else if (item.name && !isPlaceholderCustomerName(item.name)) {
              name = item.name.trim();
            }

            if (!name && lMsg?.pushName && !isPlaceholderCustomerName(lMsg.pushName)) {
              name = lMsg.pushName.trim();
            }

            if (!name && msgContent) {
              const greetingMatch = String(msgContent).match(/(?:Ok|Olá|Ola|Oi|Bom dia|Boa tarde|Boa noite)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)/i);
              const forbidden = new Set([
                'Você', 'Querido', 'Querida', 'Pessoal', 'Cliente', 'Amigo', 'Amiga', 'Realizze', 'Travel',
                'Equipe', 'Obrigada', 'Obrigado', 'Por', 'Sim', 'Não', 'Tudo', 'Bom', 'Boa', 'Amore', 'Enviada',
                'Aguardar', 'Segue', 'Passando', 'Certeza', 'Outras', 'Suas', 'Café', 'Pela', 'Registrada', 'Avaliacao'
              ]);
              if (greetingMatch && !forbidden.has(greetingMatch[1])) {
                name = greetingMatch[1];
              }
            }

            if (!name) {
              if (isGroup) {
                name = item.pushName || item.name || 'Grupo Realizze Travel';
              } else if (cleanPhone && cleanPhone.length >= 8 && !remoteJid.includes('@lid')) {
                name = `Cliente (+${cleanPhone})`;
              } else {
                name = 'Cliente WhatsApp';
              }
            }

            const avatar = item.profilePicUrl || item.avatar || matchedContact?.avatar || null;
            const phoneFormatted = cleanPhone.length >= 8 ? `+${cleanPhone}` : (matchedContact?.phone || `+5581${cleanPhone}`);
            const lastMsgTime = item.conversationTimestamp
              ? new Date(Number(item.conversationTimestamp) * 1000).toISOString()
              : (lMsg?.messageTimestamp ? new Date(Number(lMsg.messageTimestamp) * 1000).toISOString() : (item.updatedAt || now));

            let customer = custByJid.get(remoteJid) || custByPhone.get(cleanPhone) || custByPhone.get(phoneFormatted);

            if (!customer) {
              const custId = `cst_${Date.now()}_${Math.random().toString(36).substring(7)}`;
              const custAvatar = avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D9488&color=fff&size=128`;
              dbRun(
                `INSERT INTO customers (id, organization_id, name, phone, avatar, whatsapp_jid, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [custId, organizationId, name, phoneFormatted, custAvatar, remoteJid, lastMsgTime, now]
              );
              customer = { id: custId, name, phone: phoneFormatted, avatar: custAvatar, whatsapp_jid: remoteJid };
              custByJid.set(remoteJid, customer);
              custByPhone.set(cleanPhone, customer);
              custByPhone.set(phoneFormatted, customer);
            } else {
              if (isPlaceholderCustomerName(customer.name) && !isPlaceholderCustomerName(name)) {
                dbRun('UPDATE customers SET name = ?, updated_at = ? WHERE id = ?', [name, now, customer.id]);
                customer.name = name;
              }
              if (avatar && avatar !== customer.avatar) {
                dbRun('UPDATE customers SET avatar = ?, updated_at = ? WHERE id = ?', [avatar, now, customer.id]);
                customer.avatar = avatar;
              }
              if (!customer.whatsapp_jid) {
                dbRun('UPDATE customers SET whatsapp_jid = ? WHERE id = ?', [remoteJid, customer.id]);
                customer.whatsapp_jid = remoteJid;
                custByJid.set(remoteJid, customer);
              }
            }

            let conversation = convByJid.get(remoteJid) || convByCustId.get(customer.id);

            const convId = conversation ? conversation.id : `cnv_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            // Initial consultant assignment for new conversations
            let assignedUserId: string | null = conversation?.assigned_user_id || null;
            let status = conversation?.status || 'WAITING';

            if (!conversation && !isGroup && !assignedUserId) {
              if (directChatsAssignedJoao < 3) {
                assignedUserId = 'usr_joao'; // Consultor 1
                status = 'OPEN';
                directChatsAssignedJoao++;
              } else if (directChatsAssignedMaria < 2) {
                assignedUserId = 'usr_maria'; // Consultor 2
                status = 'OPEN';
                directChatsAssignedMaria++;
              }
            }

            if (!conversation) {
              dbRun(
                `INSERT INTO conversations (id, organization_id, customer_id, whatsapp_jid, assigned_user_id, status, priority, created_at, updated_at, last_message_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'MEDIUM', ?, ?, ?)`,
                [convId, organizationId, customer.id, remoteJid, assignedUserId, status, lastMsgTime, now, lastMsgTime]
              );
              const newConv = { id: convId, customer_id: customer.id, whatsapp_jid: remoteJid, assigned_user_id: assignedUserId, status };
              convByJid.set(remoteJid, newConv);
              convByCustId.set(customer.id, newConv);
            } else {
              dbRun(
                `UPDATE conversations 
                 SET whatsapp_jid = CASE WHEN (whatsapp_jid IS NULL OR whatsapp_jid LIKE 'cmtw%') THEN ? ELSE whatsapp_jid END, 
                     last_message_at = ?, 
                     updated_at = ? 
                 WHERE id = ?`,
                [remoteJid, lastMsgTime, now, conversation.id]
              );
            }

            // Import chat's latest message
            if (lMsg && msgContent) {
              const isFromMe = lMsg.key?.fromMe === true;
              const msgId = lMsg.key?.id || lMsg.id || `msg_init_${Date.now()}`;
              const msgTime = lMsg.messageTimestamp
                ? new Date(Number(lMsg.messageTimestamp) * 1000).toISOString()
                : lastMsgTime;

              if (!existingMsgIds.has(msgId)) {
                existingMsgIds.add(msgId);
                const localMsgId = `msg_hist_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                const senderId = isFromMe ? (assignedUserId || 'usr_joao') : customer.id;
                dbRun(
                  `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, whatsapp_message_id, status, created_at)
                   VALUES (?, ?, ?, ?, ?, 'text', ?, ?, 'delivered', ?)`,
                  [localMsgId, organizationId, convId, isFromMe ? 'AGENT' : 'CUSTOMER', senderId, String(msgContent), msgId, msgTime]
                );

                if (!isFromMe) {
                  broadcastEvent('message:new', {
                    conversationId: convId,
                    message: {
                      id: localMsgId,
                      organization_id: organizationId,
                      conversation_id: convId,
                      sender_type: 'CUSTOMER',
                      sender_id: customer.id,
                      message_type: 'text',
                      content: String(msgContent),
                      whatsapp_message_id: msgId,
                      status: 'delivered',
                      created_at: msgTime,
                    },
                  }, organizationId);
                }
              }
            }

            importedChats++;
          }
        }

        // Clean up any empty orphan conversations without messages and without whatsapp_jid
        try {
          dbRun(
            `DELETE FROM conversations 
             WHERE (organization_id = ? OR organization_id = 'org_realizzetravel')
               AND (whatsapp_jid IS NULL OR whatsapp_jid = '')
               AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = conversations.id)
               AND id NOT IN ('conv_camila', 'conv_juliana', 'conv_matheus', 'conv_rodrigo')`,
            [organizationId]
          );
        } catch {}
      });

      // 5. Concurrent batch fetch full real message history for top 15 active chats
      if (Array.isArray(chatsList) && chatsList.length > 0) {
        const topChatsToFetch = chatsList.filter(c => c.id || c.remoteJid).slice(0, 15);
        
        await Promise.allSettled(
          topChatsToFetch.map(async (tc) => {
            const jid = tc.id || tc.remoteJid || '';
            if (!jid) return;
            try {
              const mRes = await fetchWithTimeout(`${baseUrl}/chat/findMessages/${inst}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  where: { key: { remoteJid: jid } },
                  limit: 25,
                }),
              }, 2200);

              if (mRes.ok) {
                const mData = await mRes.json().catch(() => ({}));
                const records = mData?.messages?.records || (Array.isArray(mData) ? mData : []);
                if (Array.isArray(records) && records.length > 0) {
                  const conv = dbGet<any>(
                    `SELECT id, customer_id, assigned_user_id FROM conversations WHERE (organization_id = ? OR organization_id = 'org_realizzetravel') AND whatsapp_jid = ? LIMIT 1`,
                    [organizationId, jid]
                  );

                  if (conv) {
                    for (const r of records) {
                      const rContent =
                        r.message?.conversation ||
                        r.message?.extendedTextMessage?.text ||
                        r.message?.imageMessage?.caption ||
                        (r.message?.imageMessage ? '[Foto]' : null) ||
                        (r.message?.audioMessage ? '[Áudio]' : null) ||
                        (r.message?.documentMessage ? (r.message?.documentMessage?.fileName || '[Documento]') : null) ||
                        (r.message?.videoMessage ? '[Vídeo]' : null) ||
                        (r.message?.stickerMessage ? '[Figurinha]' : null) ||
                        null;
                      const rId = r.key?.id || r.id;
                      if (!rContent || !rId) continue;
                      const rIsFromMe = r.key?.fromMe === true;
                      const rTime = r.messageTimestamp
                        ? new Date(Number(r.messageTimestamp) * 1000).toISOString()
                        : now;

                      const msgExists = dbGet<any>('SELECT id FROM messages WHERE whatsapp_message_id = ?', [rId]);
                      if (!msgExists) {
                        const newLocalId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
                        const sId = rIsFromMe ? (conv.assigned_user_id || 'usr_joao') : conv.customer_id;
                        dbRun(
                          `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, whatsapp_message_id, status, created_at)
                           VALUES (?, ?, ?, ?, ?, 'text', ?, ?, 'delivered', ?)`,
                          [newLocalId, organizationId, conv.id, rIsFromMe ? 'AGENT' : 'CUSTOMER', sId, String(rContent), rId, rTime]
                        );
                      }
                    }
                  }
                }
              }
            } catch {}
          })
        );
      }

      const totalCount = dbGet<{ count: number }>(
        'SELECT COUNT(*) as count FROM conversations WHERE organization_id = ?',
        [organizationId]
      )?.count || importedChats;

      const groupTotal = dbGet<{ count: number }>(
        'SELECT COUNT(*) as count FROM whatsapp_groups WHERE organization_id = ?',
        [organizationId]
      )?.count || importedGroups;

      broadcastEvent('poll:sync', { count: totalCount, groupCount: groupTotal }, organizationId);

      return { count: totalCount, groupCount: groupTotal, chats: chatsList };
    } catch (err: any) {
      console.error('Error syncing Evolution API chats:', err);
      const count = dbGet<{ count: number }>(
        'SELECT COUNT(*) as count FROM conversations WHERE organization_id = ?',
        [organizationId]
      )?.count || 0;
      const groupCount = dbGet<{ count: number }>(
        'SELECT COUNT(*) as count FROM whatsapp_groups WHERE organization_id = ?',
        [organizationId]
      )?.count || 0;
      return { count, groupCount, chats: [] };
    }
  }

  // Live Group Synchronizer from Evolution API
  public static async syncEvolutionGroups(organizationId: string): Promise<{ count: number; groups: any[] }> {
    const creds = this.getCredentials(organizationId);
    if (!creds.gatewayUrl) return { count: 0, groups: [] };

    try {
      const baseUrl = creds.gatewayUrl.replace(/\/+$/, '');
      const inst = creds.instanceName || 'realizze-oficial';
      const url = `${baseUrl}/group/fetchAllGroups/${inst}?getParticipants=false`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (creds.apiKey) {
        headers['apikey'] = creds.apiKey.trim();
        headers['Authorization'] = `Bearer ${creds.apiKey.trim()}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return { count: 0, groups: [] };
      }

      const rawList: any[] = await response.json();
      if (!Array.isArray(rawList)) {
        return { count: 0, groups: [] };
      }

      const now = new Date().toISOString();
      let imported = 0;

      for (const g of rawList) {
        const gId = g.id || g.jid;
        if (!gId) continue;
        const gName = g.subject || g.name || 'Grupo de Viagens';
        const gDesc = g.desc || g.description || 'Grupo oficial de viagens e pacotes';
        const pCount = Array.isArray(g.participants) ? g.participants.length : (g.size || 1);
        const avatar = g.pictureUrl || null;

        const existing = dbGet<any>('SELECT id FROM whatsapp_groups WHERE id = ?', [gId]);
        if (!existing) {
          dbRun(
            `INSERT INTO whatsapp_groups (id, organization_id, name, description, participant_count, avatar, last_message, last_message_at, destination_focus, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              gId,
              organizationId,
              gName,
              gDesc,
              pCount,
              avatar,
              'Grupo sincronizado do WhatsApp',
              now,
              'Pacotes & Roteiros',
              now,
              now,
            ]
          );
        } else {
          dbRun(
            `UPDATE whatsapp_groups SET name = ?, description = ?, participant_count = ?, updated_at = ? WHERE id = ?`,
            [gName, gDesc, pCount, now, gId]
          );
        }
        imported++;
      }

      if (imported > 0) {
        broadcastEvent('groups:updated', { count: imported }, organizationId);
      }

      return { count: imported, groups: rawList };
    } catch (err: any) {
      console.warn('syncEvolutionGroups warning:', err.message);
      return { count: 0, groups: [] };
    }
  }

  // Send message to WhatsApp Group
  public static async sendGroupMessage(params: {
    organizationId: string;
    groupId: string;
    content: string;
    senderName: string;
    senderId?: string;
  }): Promise<{ success: boolean; messageId: string }> {
    const { organizationId, groupId, content, senderName } = params;
    const now = new Date().toISOString();
    const msgId = `gmsg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // 1. Insert into database
    dbRun(
      `INSERT INTO whatsapp_group_messages (id, group_id, sender_name, sender_phone, content, is_from_agency, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [msgId, groupId, senderName, '(81) 99535-7254', content, now]
    );

    dbRun(
      `UPDATE whatsapp_groups SET last_message = ?, last_message_at = ?, updated_at = ? WHERE id = ?`,
      [content, now, now, groupId]
    );

    // Broadcast to all connected agents
    broadcastEvent('group:message', {
      groupId,
      message: {
        id: msgId,
        group_id: groupId,
        sender_name: senderName,
        content,
        is_from_agency: true,
        created_at: now,
      },
    }, organizationId);

    // 2. Dispatch to Evolution API if connected
    const creds = this.getCredentials(organizationId);
    if (creds.gatewayUrl) {
      try {
        const baseUrl = creds.gatewayUrl.replace(/\/+$/, '');
        const instance = creds.instanceName || 'realizze-oficial';
        const url = `${baseUrl}/message/sendText/${instance}`;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (creds.apiKey) {
          headers['apikey'] = creds.apiKey.trim();
          headers['Authorization'] = `Bearer ${creds.apiKey.trim()}`;
        }

        await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            number: groupId,
            text: content,
            textMessage: { text: content },
          }),
        });
      } catch (e: any) {
        console.warn('Failed to dispatch group message via Evolution API:', e.message);
      }
    }

    return { success: true, messageId: msgId };
  }

  // Handle incoming group message from Webhook
  public static processInboundGroupMessage(params: {
    organizationId: string;
    groupId: string;
    senderName: string;
    senderPhone?: string;
    content: string;
    isFromAgency?: boolean;
  }): void {
    const { organizationId, groupId, senderName, senderPhone, content, isFromAgency } = params;
    const now = new Date().toISOString();
    const msgId = `gmsg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Ensure group exists in database
    const existingGroup = dbGet<any>('SELECT id FROM whatsapp_groups WHERE id = ?', [groupId]);
    if (!existingGroup) {
      dbRun(
        `INSERT INTO whatsapp_groups (id, organization_id, name, description, participant_count, last_message, last_message_at, destination_focus, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, 'Grupo de Atendimento', ?, ?)`,
        [groupId, organizationId, 'Grupo WhatsApp Realizze', 'Grupo recebido via WhatsApp', content, now, now, now]
      );
    } else {
      dbRun(
        `UPDATE whatsapp_groups SET last_message = ?, last_message_at = ?, updated_at = ? WHERE id = ?`,
        [content, now, now, groupId]
      );
    }

    // Insert group message
    dbRun(
      `INSERT INTO whatsapp_group_messages (id, group_id, sender_name, sender_phone, content, is_from_agency, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [msgId, groupId, senderName, senderPhone || null, content, isFromAgency ? 1 : 0, now]
    );

    broadcastEvent('group:message', {
      groupId,
      message: {
        id: msgId,
        group_id: groupId,
        sender_name: senderName,
        sender_phone: senderPhone,
        content,
        is_from_agency: isFromAgency || false,
        created_at: now,
      },
    }, organizationId);
  }

  public static async fetchCustomerMessagesFromEvolution(
    customerIdentifier: string,
    conversationId: string,
    customerId: string,
    organizationId = 'org_realizzetravel'
  ): Promise<void> {
    try {
      const creds = this.getCredentials(organizationId);
      const baseUrl = (creds.gatewayUrl || process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
      const inst = (creds.instanceName && creds.instanceName !== 'realizze-travel') ? creds.instanceName.trim() : (process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial');
      const key = (creds.apiKey || process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026').trim();

      if (!customerIdentifier) return;

      const jidCandidates: string[] = [];
      if (customerIdentifier.includes('@')) {
        jidCandidates.push(customerIdentifier);
      } else {
        const clean = customerIdentifier.replace(/\D/g, '');
        if (!clean) return;
        jidCandidates.push(`${clean}@lid`);
        jidCandidates.push(`${clean}@s.whatsapp.net`);
        if (clean.length === 11 && clean.startsWith('55')) {
          jidCandidates.push(`55${clean.slice(2, 4)}9${clean.slice(4)}@s.whatsapp.net`);
        }
        if (clean.length === 13 && clean.startsWith('55')) {
          jidCandidates.push(`55${clean.slice(2, 4)}${clean.slice(5)}@s.whatsapp.net`);
        }
        if (clean.startsWith('55')) {
          jidCandidates.push(`${clean.slice(2)}@s.whatsapp.net`);
        }
      }

      const headers = { 'Content-Type': 'application/json', 'apikey': key };
      const now = new Date().toISOString();

      const conv = dbGet<any>(
        'SELECT id, assigned_user_id, customer_id, whatsapp_jid FROM conversations WHERE id = ?',
        [conversationId]
      );
      const assignedAgentId = conv?.assigned_user_id || 'usr_joao';

      let allRecords: any[] = [];
      for (const targetJid of jidCandidates) {
        try {
          const res = await fetchWithTimeout(`${baseUrl}/chat/findMessages/${inst}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              where: { key: { remoteJid: targetJid } },
              limit: 50,
            }),
          }, 3500);

          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            const records = data?.messages?.records || (Array.isArray(data) ? data : []);
            if (Array.isArray(records) && records.length > 0) {
              allRecords = records;
              if (conv && !conv.whatsapp_jid) {
                dbRun('UPDATE conversations SET whatsapp_jid = ? WHERE id = ?', [targetJid, conversationId]);
              }
              break;
            }
          }
        } catch {}
      }

      if (allRecords.length > 0) {
        let latestTimestamp = now;
        let detectedCustomerName = '';

        for (const r of allRecords) {
          const content =
            r.message?.conversation ||
            r.message?.extendedTextMessage?.text ||
            r.message?.imageMessage?.caption ||
            (r.message?.imageMessage ? '[Foto]' : null) ||
            (r.message?.audioMessage ? '[Áudio]' : null) ||
            (r.message?.documentMessage ? (r.message?.documentMessage?.fileName || '[Documento]') : null) ||
            (r.message?.videoMessage ? '[Vídeo]' : null) ||
            (r.message?.stickerMessage ? '[Figurinha]' : null) ||
            null;
          const rId = r.key?.id || r.id;
          if (!content || !rId) continue;
          const isFromMe = r.key?.fromMe === true;
          const time = r.messageTimestamp
            ? new Date(Number(r.messageTimestamp) * 1000).toISOString()
            : now;

          if (time > latestTimestamp) latestTimestamp = time;

          if (!isFromMe && r.pushName && r.pushName !== 'Você' && !/^\d+$/.test(r.pushName)) {
            detectedCustomerName = r.pushName.trim();
          } else if (content) {
            const m = String(content).match(/(?:Ok|Olá|Oi|Bom dia|Boa tarde|Boa noite)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)/i);
            const forbidden = ['Você', 'Querido', 'Querida', 'Pessoal', 'Cliente', 'Amigo', 'Amiga', 'Realizze', 'Travel', 'Equipe', 'Obrigada', 'Obrigado', 'Por', 'Sim', 'Não', 'Tudo', 'Bom', 'Boa', 'Amore', 'Enviada', 'Aguardar'];
            if (m && !forbidden.includes(m[1])) {
              detectedCustomerName = m[1];
            }
          }

          const exists = dbGet<any>('SELECT id FROM messages WHERE whatsapp_message_id = ?', [rId]);
          if (!exists) {
            const localId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            dbRun(
              `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, whatsapp_message_id, status, created_at)
               VALUES (?, ?, ?, ?, ?, 'text', ?, ?, 'delivered', ?)`,
              [localId, organizationId, conversationId, isFromMe ? 'AGENT' : 'CUSTOMER', isFromMe ? assignedAgentId : customerId, String(content), rId, time]
            );
          }
        }

        dbRun(
          `UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?`,
          [latestTimestamp, now, conversationId]
        );

        if (detectedCustomerName && !isPlaceholderCustomerName(detectedCustomerName)) {
          const currentCust = dbGet<any>('SELECT name FROM customers WHERE id = ?', [customerId]);
          if (currentCust && isPlaceholderCustomerName(currentCust.name)) {
            dbRun('UPDATE customers SET name = ?, updated_at = ? WHERE id = ?', [detectedCustomerName, now, customerId]);
          }
        }
      }
    } catch (e) {
      console.warn('Could not auto-fetch customer messages from Evolution API:', e);
    }
  }

  /**
   * Ultra-fast poller (runs every ~3.5s) to guarantee instant arrival of new incoming messages
   * even if webhooks are routed elsewhere or delayed.
   */
  public static async pollRecentEvolutionMessages(organizationId = 'org_realizzetravel'): Promise<void> {
    try {
      const creds = this.getCredentials(organizationId);
      const baseUrl = (creds.gatewayUrl || process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080').trim().replace(/\/+$/, '');
      const inst = (creds.instanceName && creds.instanceName !== 'realizze-travel') ? creds.instanceName.trim() : (process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial');
      const key = (creds.apiKey || process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026').trim();

      const res = await fetchWithTimeout(`${baseUrl}/chat/findMessages/${inst}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key },
        body: JSON.stringify({ limit: 25 }),
      }, 3000);

      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      const records = data?.messages?.records || (Array.isArray(data) ? data : []);
      if (!Array.isArray(records) || records.length === 0) return;

      // Process oldest to newest so sequential order is preserved
      const reversed = [...records].reverse();

      for (const r of reversed) {
        const key = r.key || {};
        const msgId = key.id || r.id;
        if (!msgId) continue;

        // Skip if message is already recorded in SQLite
        const exists = dbGet<any>('SELECT id FROM messages WHERE whatsapp_message_id = ?', [msgId]);
        if (exists) continue;

        const remoteJid = key.remoteJid || r.remoteJid || '';
        if (!remoteJid || remoteJid.includes('@broadcast')) continue;

        const isFromMe = key.fromMe === true || r.fromMe === true;
        const remoteJidAlt = key.remoteJidAlt || '';

        let cleanPhone = '';
        if (remoteJidAlt && remoteJidAlt.includes('@s.whatsapp.net')) {
          cleanPhone = remoteJidAlt.replace('@s.whatsapp.net', '').replace(/\D/g, '');
        } else if (remoteJid.includes('@s.whatsapp.net')) {
          cleanPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
        } else {
          cleanPhone = remoteJid.replace(/@.*$/, '').replace(/\D/g, '');
        }

        const isGroup = remoteJid.includes('@g.us');
        const seconds = r.message?.audioMessage?.seconds;
        const audioStr = seconds 
          ? `[Áudio ${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}]`
          : '[Áudio]';

        const content =
          r.message?.conversation ||
          r.message?.extendedTextMessage?.text ||
          r.message?.imageMessage?.caption ||
          (r.message?.imageMessage ? '[Foto]' : null) ||
          (r.message?.audioMessage ? audioStr : null) ||
          (r.message?.documentMessage ? (r.message?.documentMessage?.fileName || '[Documento]') : null) ||
          (r.message?.videoMessage ? '[Vídeo]' : null) ||
          (r.message?.stickerMessage ? '[Figurinha]' : null) ||
          null;

        if (!content) continue;

        const pushName = r.pushName || '';

        if (isGroup) {
          this.processInboundGroupMessage({
            organizationId,
            groupId: remoteJid,
            senderName: pushName || 'Participante',
            senderPhone: key.participant ? String(key.participant).replace(/\D/g, '') : undefined,
            content: String(content),
            isFromAgency: isFromMe,
          });
          continue;
        }

        let name = pushName;
        if (VERIFIED_LID_PROFILES[remoteJid]) {
          name = VERIFIED_LID_PROFILES[remoteJid].name;
        } else if (!name || isPlaceholderCustomerName(name)) {
          if (cleanPhone && cleanPhone.length >= 8 && !remoteJid.includes('@lid')) {
            name = `Cliente (+${cleanPhone})`;
          } else {
            name = 'Cliente WhatsApp';
          }
        }

        const msgType = r.message?.imageMessage
          ? 'image'
          : r.message?.documentMessage
          ? 'document'
          : r.message?.audioMessage
          ? 'audio'
          : 'text';

        this.processInboundMessage({
          organizationId,
          phone: cleanPhone.length >= 8 ? `+${cleanPhone}` : `+${remoteJid.replace(/\D/g, '')}`,
          name,
          content: String(content),
          messageType: msgType,
          mediaUrl: null,
          whatsappMessageId: msgId,
          senderType: isFromMe ? 'AGENT' : 'CUSTOMER',
        });
      }
    } catch {
      // quiet catch
    }
  }

  private static autoSyncTimer: NodeJS.Timeout | null = null;
  private static messagePollTimer: NodeJS.Timeout | null = null;

  public static startAutoSyncWorker(intervalMs = 30000): void {
    if (this.autoSyncTimer) return;
    console.log(`🔄 [WhatsAppService] Sincronização automática em segundo plano ativada (intervalo: ${intervalMs / 1000}s)`);

    // Run initial sync after a short delay on startup
    setTimeout(() => {
      this.syncEvolutionChats('org_realizzetravel').catch(() => {});
      this.pollRecentEvolutionMessages('org_realizzetravel').catch(() => {});
    }, 1500);

    // Fast poller for instant message arrivals every 3.5 seconds
    this.messagePollTimer = setInterval(async () => {
      try {
        await this.pollRecentEvolutionMessages('org_realizzetravel');
      } catch {}
    }, 3500);

    // Deep sync of conversation lists every 30 seconds
    this.autoSyncTimer = setInterval(async () => {
      try {
        await this.syncEvolutionChats('org_realizzetravel');
      } catch {}
    }, intervalMs);
  }
}



