import { dbGet, dbQuery, dbRun, dbTransaction } from '../db/database';
import { broadcastEvent } from '../realtime/ws';

export interface WhatsAppCredentials {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  verifyToken: string;
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
      agencyName: 'RealizzeTravel Viagens & Turismo',
      agencyPhone: '+55 (11) 4004-9800',
      agencyEmail: 'contato@realizzetravel.com.br',
      welcomeMessage: 'Olá! Seja bem-vindo à RealizzeTravel Viagens. Como podemos ajudar no seu roteiro hoje? Em instantes um de nossos consultores de turismo irá lhe atender.',
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

  private static getCredentials(organizationId?: string): WhatsAppCredentials {
    const targetOrg = this.resolveOrganizationId(organizationId);
    const settingRow = dbGet<{ value: string }>(
      'SELECT value FROM settings WHERE organization_id = ? AND key = ?',
      [targetOrg, 'whatsapp_config']
    );

    if (settingRow && settingRow.value) {
      try {
        const parsed = JSON.parse(settingRow.value);
        return {
          phoneNumberId: parsed.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
          businessAccountId: parsed.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
          accessToken: parsed.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
          verifyToken: parsed.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || 'viagens_whatsapp_verify_token_2026',
        };
      } catch (e) {
        console.error('Error parsing whatsapp_config JSON:', e);
      }
    }

    return {
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'viagens_whatsapp_verify_token_2026',
    };
  }

  public static verifyWebhookChallenge(mode: string, token: string, challenge: string): string | null {
    const creds = this.getCredentials();
    if (mode === 'subscribe' && token === creds.verifyToken) {
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

    if (!creds.phoneNumberId || !creds.accessToken) {
      console.warn('⚠️ WhatsApp Cloud API not fully configured with ACCESS_TOKEN or PHONE_NUMBER_ID. Simulating delivery locally.');
      return { success: true, messageId: `mock_wamid_${Date.now()}` };
    }

    try {
      const cleanPhone = to.replace(/\D/g, '');
      const url = `https://graph.facebook.com/v20.0/${creds.phoneNumberId}/messages`;

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
          text: { body: text },
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        console.error('WhatsApp API Error Response:', data);
        return {
          success: false,
          error: data?.error?.message || 'Falha na comunicação com a API do WhatsApp.',
        };
      }

      const messageId = data?.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (err: any) {
      console.error('Network error calling WhatsApp Cloud API:', err);
      return { success: false, error: err.message || 'Erro de conexão com servidor do WhatsApp.' };
    }
  }

  public static handleInboundWebhook(body: any, organizationId?: string): void {
    if (!body || body.object !== 'whatsapp_business_account') {
      return;
    }

    const targetOrg = this.resolveOrganizationId(organizationId);
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
            const textContent = msg.text?.body || (msg.type !== 'text' ? `[Arquivo ${msg.type}]` : 'Mensagem recebida');
            const waMsgId = msg.id;

            this.processInboundMessage({
              organizationId: targetOrg,
              phone: `+${fromPhone}`,
              name: senderName,
              content: textContent,
              messageType: msg.type || 'text',
              mediaUrl: msg.image?.id || msg.document?.id || null,
              whatsappMessageId: waMsgId,
            });
          }
        }
      }
    }
  }

  public static processInboundMessage(params: {
    organizationId: string;
    phone: string;
    name: string;
    content: string;
    messageType: string;
    mediaUrl?: string | null;
    whatsappMessageId?: string;
  }): { conversationId: string; status: string; assignedUserId: string | null; autoReplySent?: string } {
    const { phone, name, content, messageType, mediaUrl, whatsappMessageId } = params;
    const organizationId = this.resolveOrganizationId(params.organizationId);
    const now = new Date().toISOString();
    const settings = this.getAgencySettings(organizationId);

    let createdConversationId = '';
    let assignedUserId: string | null = null;
    let assignedUserObj: any = null;
    let convStatus: 'WAITING' | 'ASSIGNED' = 'WAITING';
    let isNewConv = false;
    let autoReplyMessageContent: string | null = null;
    let autoReplyMsgId = '';
    let autoReplyTime = '';
    let customerObj: any = null;

    dbTransaction(() => {
      // 1. Locate or create customer
      let customer = dbGet<any>('SELECT * FROM customers WHERE organization_id = ? AND phone = ?', [
        organizationId,
        phone,
      ]);

      if (!customer) {
        const newCustomerId = `cst_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        dbRun(
          `INSERT INTO customers (id, organization_id, name, phone, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newCustomerId, organizationId, name, phone, now, now]
        );
        customer = { id: newCustomerId, name, phone };
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

      // 3. Insert customer message
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      dbRun(
        `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, media_url, whatsapp_message_id, status, created_at)
         VALUES (?, ?, ?, 'CUSTOMER', ?, ?, ?, ?, ?, 'delivered', ?)`,
        [
          msgId,
          organizationId,
          conversation.id,
          customer.id,
          messageType,
          content,
          mediaUrl || null,
          whatsappMessageId || `wamid_${Date.now()}`,
          now,
        ]
      );

      // 4. Check Business Hours & Send Automated WhatsApp Message
      const hoursCheck = this.isWithinBusinessHours(settings);

      if (isNewConv) {
        if (!hoursCheck.isWithin && settings.outOfHoursMessage && settings.outOfHoursMessage.trim()) {
          autoReplyMessageContent = settings.outOfHoursMessage.trim();
        } else if (hoursCheck.isWithin && settings.welcomeMessage && settings.welcomeMessage.trim()) {
          autoReplyMessageContent = settings.welcomeMessage.trim();
        }
      } else if (!hoursCheck.isWithin && settings.outOfHoursMessage && settings.outOfHoursMessage.trim()) {
        // For existing conversations outside business hours, check if notice was already sent recently (last 8 hours)
        const recentNotice = dbGet<any>(
          "SELECT id FROM messages WHERE conversation_id = ? AND sender_type = 'SYSTEM' AND created_at > ? LIMIT 1",
          [conversation.id, new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()]
        );
        if (!recentNotice) {
          autoReplyMessageContent = settings.outOfHoursMessage.trim();
        }
      }

      if (autoReplyMessageContent) {
        autoReplyTime = new Date(Date.now() + 500).toISOString();
        autoReplyMsgId = `msg_auto_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        dbRun(
          `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, status, created_at)
           VALUES (?, ?, ?, 'SYSTEM', 'system_bot', 'text', ?, 'delivered', ?)`,
          [autoReplyMsgId, organizationId, conversation.id, autoReplyMessageContent, autoReplyTime]
        );

        dbRun('UPDATE conversations SET last_message_at = ?, updated_at = ? WHERE id = ?', [
          autoReplyTime,
          autoReplyTime,
          conversation.id,
        ]);
      }

      // Customer message payload
      const customerMsgPayload = {
        id: msgId,
        organization_id: organizationId,
        conversation_id: conversation.id,
        sender_type: 'CUSTOMER',
        sender_id: customer.id,
        message_type: messageType,
        content,
        media_url: mediaUrl || null,
        whatsapp_message_id: whatsappMessageId,
        status: 'delivered',
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
            content,
            status: convStatus,
            priority: 'MEDIUM',
            assignedUserId,
            assignedUser: assignedUserObj,
            lastMessageAt: autoReplyTime || now,
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
      } else {
        broadcastEvent(
          'message:new',
          {
            conversationId: conversation.id,
            message: customerMsgPayload,
          },
          organizationId
        );
      }
    });

    // Send auto reply asynchronously through WhatsApp API & broadcast
    if (autoReplyMessageContent) {
      this.sendTextMessage(phone, autoReplyMessageContent, organizationId).catch((err) => {
        console.error('Error dispatching automated message to WhatsApp:', err);
      });

      broadcastEvent(
        'message:new',
        {
          conversationId: createdConversationId,
          message: {
            id: autoReplyMsgId,
            organization_id: organizationId,
            conversation_id: createdConversationId,
            sender_type: 'SYSTEM',
            sender_id: 'system_bot',
            message_type: 'text',
            content: autoReplyMessageContent,
            status: 'delivered',
            created_at: autoReplyTime,
          },
        },
        organizationId
      );
    }

    return {
      conversationId: createdConversationId,
      status: convStatus,
      assignedUserId,
      autoReplySent: autoReplyMessageContent || undefined,
    };
  }
}
