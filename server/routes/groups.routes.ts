import { Router, Response } from 'express';
import { dbGet, dbQuery, dbRun, dbTransaction } from '../db/database';
import { authenticateToken, flexibleAuth, AuthenticatedRequest } from '../auth/middleware';
import { WhatsAppService } from '../services/whatsapp.service';
import { broadcastEvent } from '../realtime/ws';

export const groupsRouter = Router();

// Seed default agency groups if empty
function ensureDefaultGroups(organizationId: string) {
  const existingCount = dbGet<{ count: number }>(
    'SELECT COUNT(*) as count FROM whatsapp_groups WHERE organization_id = ?',
    [organizationId]
  )?.count || 0;

  if (existingCount > 0) return;

  const now = new Date().toISOString();
  const sampleGroups = [
    {
      id: 'grp_vip_nordeste_oficial',
      name: 'VIP Nordeste - Clientes Especiais',
      description: 'Grupo VIP com promoções exclusivas para Porto de Galinhas, Maragogi e Fernando de Noronha',
      destination_focus: 'Porto de Galinhas & Maragogi',
      participant_count: 18,
      avatar: 'https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?w=150&auto=format&fit=crop&q=80',
      last_message: 'Pacote Réveillon com aéreo + resort all inclusive disponível!',
      messages: [
        {
          id: 'gmsg_seed_1',
          sender_name: 'Daniele Consultora',
          sender_phone: '(81) 99535-7254',
          content: 'Bom dia pessoal! Acabamos de liberar uma condição especial para os resorts em Muro Alto para novembro e Réveillon.',
          is_from_agency: 1,
          created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
        },
        {
          id: 'gmsg_seed_2',
          sender_name: 'Carlos Eduardo',
          sender_phone: '5511999887766',
          content: 'Daniele, essa condição inclui transfer saindo do aeroporto de Recife?',
          is_from_agency: 0,
          created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        },
        {
          id: 'gmsg_seed_3',
          sender_name: 'Daniele Consultora',
          sender_phone: '(81) 99535-7254',
          content: 'Sim, Carlos! Transfer in/out privativo incluso para reservas confirmadas esta semana.',
          is_from_agency: 1,
          created_at: new Date(Date.now() - 1800000).toISOString(),
        },
      ],
    },
    {
      id: 'grp_disney_2026_oficial',
      name: 'Caravana Disney & Orlando 2026/2027',
      description: 'Grupo preparatório para famílias em viagem aos parques Disney e Universal em Orlando',
      destination_focus: 'Disney & Universal',
      participant_count: 24,
      avatar: 'https://images.unsplash.com/photo-1576176539998-0237d1ac6a85?w=150&auto=format&fit=crop&q=80',
      last_message: 'Informações sobre agendamento de visto e ingressos Park Hopper.',
      messages: [
        {
          id: 'gmsg_seed_4',
          sender_name: 'Equipe RealizzeTravel',
          sender_phone: '(81) 99535-7254',
          content: 'Atenção aos viajantes da Caravana: os ingressos promocionais 14 Dias Ilimitados da Disney estão com valor congelado até o fim do mês.',
          is_from_agency: 1,
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
    },
    {
      id: 'grp_cruzeiros_msc_oficial',
      name: 'Cruzeiros MSC & Costa - Temporada BR',
      description: 'Grupo com ofertas de cabines com varanda e all-inclusive de bebidas na costa brasileira',
      destination_focus: 'Cruzeiros Marítimos',
      participant_count: 16,
      avatar: 'https://images.unsplash.com/photo-1548574505-5e239809ee19?w=150&auto=format&fit=crop&q=80',
      last_message: 'Cabine com varanda no MSC Grandiosa em oferta relâmpago.',
      messages: [
        {
          id: 'gmsg_seed_5',
          sender_name: 'Equipe RealizzeTravel',
          sender_phone: '(81) 99535-7254',
          content: 'Últimas 3 cabines com varanda para o cruzeiro de Natal saindo de Santos/Salvador.',
          is_from_agency: 1,
          created_at: new Date(Date.now() - 14400000).toISOString(),
        },
      ],
    },
    {
      id: 'grp_gramado_natal_oficial',
      name: 'Natal Luz Gramado & Serra Gaúcha',
      description: 'Roteiros de inverno e Natal Luz com passeios Maria Fumaça e Snowland',
      destination_focus: 'Gramado & Canela',
      participant_count: 14,
      avatar: 'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?w=150&auto=format&fit=crop&q=80',
      last_message: 'Ingressos do show Nativitaten incluídos no pacote completo.',
      messages: [],
    },
  ];

  dbTransaction(() => {
    for (const g of sampleGroups) {
      dbRun(
        `INSERT INTO whatsapp_groups (id, organization_id, name, description, participant_count, avatar, last_message, last_message_at, destination_focus, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [g.id, organizationId, g.name, g.description, g.participant_count, g.avatar, g.last_message, now, g.destination_focus, now, now]
      );

      for (const m of g.messages) {
        dbRun(
          `INSERT INTO whatsapp_group_messages (id, group_id, sender_name, sender_phone, content, is_from_agency, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [m.id, g.id, m.sender_name, m.sender_phone, m.content, m.is_from_agency, m.created_at]
        );
      }
    }
  });
}

// GET /api/whatsapp/groups - List all WhatsApp groups with messages
groupsRouter.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;

    // Seed defaults if table is empty
    ensureDefaultGroups(orgId);

    // Try background sync with Evolution API if connected (non-blocking)
    try {
      const creds = WhatsAppService.getCredentials(orgId);
      if (creds.status === 'CONNECTED' && creds.gatewayUrl) {
        // Non-blocking trigger
        WhatsAppService.syncEvolutionGroups(orgId).catch(() => {});
      }
    } catch {}

    const rows = dbQuery<any>(
      `SELECT * FROM whatsapp_groups 
       WHERE organization_id = ? 
       ORDER BY datetime(last_message_at) DESC`,
      [orgId]
    );

    const groups = rows.map((g) => {
      const messages = dbQuery<any>(
        `SELECT id, group_id, sender_name, sender_phone, content, is_from_agency, media_url, created_at
         FROM whatsapp_group_messages
         WHERE group_id = ?
         ORDER BY datetime(created_at) ASC`,
        [g.id]
      ).map(m => ({
        ...m,
        is_from_agency: Boolean(m.is_from_agency),
      }));

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        member_count: g.participant_count || 1,
        avatar_url: g.avatar,
        last_message: g.last_message,
        last_message_at: g.last_message_at,
        destination_focus: g.destination_focus,
        messages,
      };
    });

    res.json({ success: true, groups });
  } catch (error) {
    console.error('Error fetching WhatsApp groups:', error);
    res.status(500).json({ error: 'Erro ao listar grupos do WhatsApp.' });
  }
});

// GET /api/whatsapp/groups/:id - Single group details with messages
groupsRouter.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const groupId = req.params.id;

    const group = dbGet<any>(
      'SELECT * FROM whatsapp_groups WHERE id = ? AND organization_id = ?',
      [groupId, orgId]
    );

    if (!group) {
      res.status(404).json({ error: 'Grupo não encontrado.' });
      return;
    }

    const messages = dbQuery<any>(
      `SELECT id, group_id, sender_name, sender_phone, content, is_from_agency, media_url, created_at
       FROM whatsapp_group_messages
       WHERE group_id = ?
       ORDER BY datetime(created_at) ASC`,
      [groupId]
    ).map(m => ({
      ...m,
      is_from_agency: Boolean(m.is_from_agency),
    }));

    res.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        member_count: group.participant_count || 1,
        avatar_url: group.avatar,
        last_message: group.last_message,
        last_message_at: group.last_message_at,
        destination_focus: group.destination_focus,
        messages,
      },
    });
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Erro ao carregar mensagens do grupo.' });
  }
});

// POST /api/whatsapp/groups/:id/messages - Send message to group
groupsRouter.post('/:id/messages', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organization_id;
    const groupId = req.params.id;
    const { content } = req.body || {};

    if (!content || !String(content).trim()) {
      res.status(400).json({ error: 'Conteúdo da mensagem é obrigatório.' });
      return;
    }

    const senderName = req.user!.name || 'Consultor Realizze';
    const result = await WhatsAppService.sendGroupMessage({
      organizationId: orgId,
      groupId,
      content: String(content).trim(),
      senderName,
      senderId: req.user!.id,
    });

    res.json({
      success: true,
      message: {
        id: result.messageId,
        group_id: groupId,
        sender_name: senderName,
        content: String(content).trim(),
        is_from_agency: true,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error sending group message:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem no grupo.' });
  }
});

// POST /api/whatsapp/groups/sync - Force sync groups from Evolution API
groupsRouter.post('/sync', flexibleAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organization_id || 'org_realizzetravel';
    const syncRes = await WhatsAppService.syncEvolutionGroups(orgId);

    res.json({
      success: true,
      count: syncRes.count,
      message: `${syncRes.count} grupos sincronizados com sucesso do WhatsApp!`,
    });
  } catch (error) {
    console.error('Error syncing groups:', error);
    res.status(500).json({ error: 'Erro ao sincronizar grupos do WhatsApp.' });
  }
});
