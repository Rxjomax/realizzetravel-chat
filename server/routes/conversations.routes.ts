import { Router, Response } from 'express';
import { dbGet, dbQuery, dbRun, dbTransaction } from '../db/database';
import { authenticateToken, AuthenticatedRequest } from '../auth/middleware';
import { broadcastEvent } from '../realtime/ws';
import { WhatsAppService } from '../services/whatsapp.service';

export const conversationsRouter = Router();

// GET /api/conversations/metrics/summary - Dashboard metrics
conversationsRouter.get('/metrics/summary', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const userId = req.user!.id;

    const waitingCount = dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM conversations WHERE organization_id = ? AND status = 'WAITING'",
      [orgId]
    )?.count || 0;

    const openCount = dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM conversations WHERE organization_id = ? AND status IN ('OPEN', 'ASSIGNED')",
      [orgId]
    )?.count || 0;

    const myCount = dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM conversations WHERE organization_id = ? AND status IN ('OPEN', 'ASSIGNED') AND assigned_user_id = ?",
      [orgId, userId]
    )?.count || 0;

    const closedTodayCount = dbGet<{ count: number }>(
      "SELECT COUNT(*) as count FROM conversations WHERE organization_id = ? AND status = 'CLOSED' AND date(closed_at) = date('now')",
      [orgId]
    )?.count || 0;

    const totalCustomersCount = dbGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM customers WHERE organization_id = ?',
      [orgId]
    )?.count || 0;

    res.json({
      waitingCount,
      openCount,
      myCount,
      closedTodayCount,
      totalCustomersCount,
      avgResponseMinutes: 0,
      avgHandleMinutes: 0,
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Erro ao calcular métricas de atendimento.' });
  }
});

// GET /api/conversations/reports/commercial - Dynamic Real Reports and Commercial Analytics
conversationsRouter.get('/reports/commercial', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;

    // 1. Get closed conversation events to accurately extract WON, LOST, saleValue, lostReason
    const closedEvents = dbQuery<{
      user_id: string;
      metadata: string;
      created_at: string;
    }>(
      `SELECT e.user_id, e.metadata, e.created_at
       FROM conversation_events e
       JOIN conversations c ON c.id = e.conversation_id
       WHERE c.organization_id = ? AND e.event_type = 'CLOSED'
       ORDER BY e.created_at DESC`,
      [orgId]
    );

    let wonCount = 0;
    let lostCount = 0;
    let totalSalesVolume = 0;
    const lostReasonsMap: Record<string, number> = {};

    // User metrics map
    const userStatsMap: Record<string, { totalChats: number; won: number; revenue: number }> = {};

    closedEvents.forEach((evt) => {
      let meta: any = {};
      try {
        if (evt.metadata) meta = JSON.parse(evt.metadata);
      } catch {}

      const outcome = meta.outcome || 'WON';
      const saleValue = Number(meta.saleValue) || 0;
      const lostReason = meta.lostReason || 'Outros motivos';

      if (evt.user_id) {
        if (!userStatsMap[evt.user_id]) {
          userStatsMap[evt.user_id] = { totalChats: 0, won: 0, revenue: 0 };
        }
        userStatsMap[evt.user_id].totalChats += 1;
      }

      if (outcome === 'WON') {
        wonCount += 1;
        totalSalesVolume += saleValue;
        if (evt.user_id && userStatsMap[evt.user_id]) {
          userStatsMap[evt.user_id].won += 1;
          userStatsMap[evt.user_id].revenue += saleValue;
        }
      } else {
        lostCount += 1;
        lostReasonsMap[lostReason] = (lostReasonsMap[lostReason] || 0) + 1;
      }
    });

    const totalClosed = wonCount + lostCount;
    const conversionRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 1000) / 10 : 0;
    const avgTicket = wonCount > 0 ? Math.round(totalSalesVolume / wonCount) : 0;

    const lostReasons = Object.entries(lostReasonsMap)
      .map(([reason, count]) => ({
        reason,
        count,
        percent: lostCount > 0 ? Math.round((count / lostCount) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // 2. Aggregate destination interest from customers
    const destRows = dbQuery<{ destination_interest: string; count: number }>(
      `SELECT destination_interest, COUNT(*) as count
       FROM customers
       WHERE organization_id = ? AND destination_interest IS NOT NULL AND TRIM(destination_interest) != ''
       GROUP BY destination_interest
       ORDER BY count DESC`,
      [orgId]
    );

    const totalDestCount = destRows.reduce((sum, r) => sum + r.count, 0);
    const destinationStats = destRows.map((r) => ({
      name: r.destination_interest,
      count: r.count,
      category: 'Destino',
      percentage: totalDestCount > 0 ? Math.round((r.count / totalDestCount) * 100) : 0,
    }));

    // 3. User performance table
    const users = dbQuery<{ id: string; name: string; email: string; role: string; status: string; avatar: string }>(
      `SELECT id, name, email, role, status, avatar FROM users WHERE organization_id = ? ORDER BY name ASC`,
      [orgId]
    );

    // Also count all conversations currently or ever assigned to users
    const userAssignedCounts = dbQuery<{ assigned_user_id: string; count: number }>(
      `SELECT assigned_user_id, COUNT(*) as count FROM conversations WHERE organization_id = ? AND assigned_user_id IS NOT NULL GROUP BY assigned_user_id`,
      [orgId]
    );
    const assignedMap: Record<string, number> = {};
    userAssignedCounts.forEach(r => { assignedMap[r.assigned_user_id] = r.count; });

    const attendantsPerformance = users.map((u) => {
      const perf = userStatsMap[u.id] || { totalChats: 0, won: 0, revenue: 0 };
      const totalChats = Math.max(perf.totalChats, assignedMap[u.id] || 0);
      const won = perf.won;
      const rate = totalChats > 0 ? `${Math.round((won / totalChats) * 1000) / 10}%` : '0%';
      const revenue = `R$ ${perf.revenue.toLocaleString('pt-BR')}`;
      const avgTime = '-';
      const score = '★ 5.0';

      return {
        id: u.id,
        name: u.name,
        role: u.role,
        status: u.status,
        avatar: u.avatar,
        totalChats,
        won,
        rate,
        revenue,
        avgTime,
        score,
      };
    });

    res.json({
      salesStats: {
        totalClosed,
        wonCount,
        lostCount,
        conversionRate,
        totalSalesVolume,
        avgTicket,
        lostReasons,
      },
      destinationStats,
      attendantsPerformance,
    });
  } catch (error) {
    console.error('Error getting commercial reports:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório comercial.' });
  }
});

// GET /api/conversations - List conversations with filters and search
conversationsRouter.get('/', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const { status, filter, search } = req.query;
    const userId = req.user!.id;

    // Regra de Negócio: Se o atendente não interagir no chat em 1 dia (24h), o cliente volta para aguardando
    try {
      dbRun(
        `UPDATE conversations
         SET status = 'WAITING', assigned_user_id = NULL, updated_at = datetime('now')
         WHERE (organization_id = ? OR organization_id = 'org_realizzetravel' OR organization_id = 'org_voolivre')
           AND status IN ('OPEN', 'ASSIGNED')
           AND assigned_user_id IS NOT NULL
           AND (strftime('%s', 'now') - strftime('%s', updated_at)) > 86400
           AND (strftime('%s', 'now') - strftime('%s', COALESCE(last_message_at, updated_at))) > 86400`,
        [orgId]
      );
    } catch (e) {
      // Ignored if error
    }

    let sql = `
      SELECT
        c.id, c.organization_id, c.customer_id, c.assigned_user_id, c.status, c.priority,
        c.created_at, c.updated_at, c.closed_at, c.closed_by_user_id, c.last_message_at,
        cust.name as customer_name, cust.phone as customer_phone, cust.email as customer_email,
        cust.destination_interest, cust.travel_date, cust.passenger_count, cust.budget, cust.notes as customer_notes,
        u.name as assigned_user_name, u.email as assigned_user_email, u.avatar as assigned_user_avatar
      FROM conversations c
      JOIN customers cust ON cust.id = c.customer_id
      LEFT JOIN users u ON u.id = c.assigned_user_id
      WHERE (c.organization_id = ? OR c.organization_id = 'org_realizzetravel' OR c.organization_id = 'org_voolivre')
    `;
    const params: any[] = [orgId];

    const normFilter = String(filter || status || '').toUpperCase();
    if (normFilter === 'WAITING' || normFilter === 'AGUARDANDO') {
      sql += " AND c.status = 'WAITING'";
    } else if (normFilter === 'OPEN' || normFilter === 'EM ATENDIMENTO' || normFilter === 'ANDAMENTO') {
      sql += " AND c.status IN ('OPEN', 'ASSIGNED')";
    } else if (normFilter === 'MY' || normFilter === 'MINE' || normFilter === 'MINHAS') {
      sql += " AND c.status IN ('OPEN', 'ASSIGNED') AND c.assigned_user_id = ?";
      params.push(userId);
    } else if (normFilter === 'CLOSED' || normFilter === 'ENCERRADAS' || normFilter === 'FINALIZADAS') {
      sql += " AND c.status = 'CLOSED'";
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = `%${search.trim()}%`;
      sql += ` AND (
        cust.name LIKE ? OR
        cust.phone LIKE ? OR
        EXISTS (
          SELECT 1 FROM messages m
          WHERE m.conversation_id = c.id AND m.content LIKE ?
        )
      )`;
      params.push(term, term, term);
    }

    // Order: WAITING first with highest priority & oldest wait time, then latest message
    sql += `
      ORDER BY
        CASE WHEN c.status = 'WAITING' THEN 0 ELSE 1 END,
        c.last_message_at DESC
    `;

    const rows = dbQuery<any>(sql, params);

    // Enrich with last message & unread counts
    const conversations = rows.map((r) => {
      const lastMsg = dbGet<any>(
        'SELECT id, sender_type, content, message_type, status, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
        [r.id]
      );

      return {
        id: r.id,
        organization_id: r.organization_id,
        customer_id: r.customer_id,
        assigned_user_id: r.assigned_user_id,
        status: r.status,
        priority: r.priority,
        created_at: r.created_at,
        updated_at: r.updated_at,
        closed_at: r.closed_at,
        closed_by_user_id: r.closed_by_user_id,
        last_message_at: r.last_message_at,
        customer: {
          id: r.customer_id,
          name: r.customer_name,
          phone: r.customer_phone,
          email: r.customer_email,
          destination_interest: r.destination_interest,
          travel_date: r.travel_date,
          passenger_count: r.passenger_count,
          budget: r.budget,
          notes: r.customer_notes,
        },
        assigned_user: r.assigned_user_id
          ? {
              id: r.assigned_user_id,
              name: r.assigned_user_name,
              email: r.assigned_user_email,
              avatar: r.assigned_user_avatar,
            }
          : null,
        last_message: lastMsg || null,
        unread_count: r.status === 'WAITING' ? 1 : 0,
      };
    });

    res.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Erro ao listar conversas.' });
  }
});

// GET /api/conversations/:id - Get full conversation with messages
conversationsRouter.get('/:id', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const orgId = req.user!.organization_id;
    const convId = req.params.id;

    const conv = dbGet<any>(
      `SELECT
        c.id, c.organization_id, c.customer_id, c.assigned_user_id, c.status, c.priority,
        c.created_at, c.updated_at, c.closed_at, c.closed_by_user_id, c.last_message_at,
        cust.name as customer_name, cust.phone as customer_phone, cust.email as customer_email,
        cust.destination_interest, cust.travel_date, cust.passenger_count, cust.budget, cust.notes as customer_notes,
        u.name as assigned_user_name, u.email as assigned_user_email, u.avatar as assigned_user_avatar
      FROM conversations c
      JOIN customers cust ON cust.id = c.customer_id
      LEFT JOIN users u ON u.id = c.assigned_user_id
      WHERE c.id = ? AND (c.organization_id = ? OR c.organization_id = 'org_realizzetravel' OR c.organization_id = 'org_voolivre')`,
      [convId, orgId]
    );

    if (!conv) {
      res.status(404).json({ error: 'Conversa não encontrada.' });
      return;
    }

    const messages = dbQuery<any>(
      `SELECT m.*, u.name as sender_name, u.avatar as sender_avatar
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
      [convId]
    );

    const events = dbQuery<any>(
      `SELECT e.*, u.name as user_name
       FROM conversation_events e
       LEFT JOIN users u ON u.id = e.user_id
       WHERE e.conversation_id = ?
       ORDER BY e.created_at ASC`,
      [convId]
    );

    const notes = dbQuery<any>(
      `SELECT n.*, u.name as user_name
       FROM customer_notes n
       LEFT JOIN users u ON u.id = n.user_id
       WHERE n.customer_id = ?
       ORDER BY n.created_at DESC`,
      [conv.customer_id]
    );

    res.json({
      conversation: {
        ...conv,
        customer: {
          id: conv.customer_id,
          name: conv.customer_name,
          phone: conv.customer_phone,
          email: conv.customer_email,
          destination_interest: conv.destination_interest,
          travel_date: conv.travel_date,
          passenger_count: conv.passenger_count,
          budget: conv.budget,
          notes: conv.customer_notes,
        },
        assigned_user: conv.assigned_user_id
          ? {
              id: conv.assigned_user_id,
              name: conv.assigned_user_name,
              email: conv.assigned_user_email,
              avatar: conv.assigned_user_avatar,
            }
          : null,
      },
      messages,
      events,
      notes,
    });
  } catch (error) {
    console.error('Error fetching conversation details:', error);
    res.status(500).json({ error: 'Erro ao buscar detalhes da conversa.' });
  }
});

// POST /api/conversations/:id/assign - ATOMIC ASSIGNMENT WITH STRICT CONCURRENCY CONTROL
conversationsRouter.post('/:id/assign', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const convId = req.params.id;
    const userId = req.user!.id;
    const orgId = req.user!.organization_id;
    const now = new Date().toISOString();

    // Atomic execution inside transaction
    const result = dbTransaction(() => {
      // Check current state with lock
      const current = dbGet<any>(
        'SELECT id, assigned_user_id, status FROM conversations WHERE id = ? AND (organization_id = ? OR organization_id = \'org_realizzetravel\' OR organization_id = \'org_voolivre\')',
        [convId, orgId]
      );

      if (!current) {
        return { error: 'Conversa não encontrada.', status: 404 };
      }

      // Check if already assigned to someone else (only block if it was already OPEN and assigned to someone else)
      if (current.status !== 'WAITING' && current.assigned_user_id && current.assigned_user_id !== userId) {
        const assignedUser = dbGet<any>('SELECT name FROM users WHERE id = ?', [current.assigned_user_id]);
        return {
          error: `Esta conversa já foi assumida por ${assignedUser?.name || 'outro atendente'}.`,
          status: 409,
        };
      }

      // Perform update to assign this conversation and mark OPEN
      dbRun(
        `UPDATE conversations
         SET assigned_user_id = ?, status = 'OPEN', updated_at = ?, last_message_at = ?
         WHERE id = ?`,
        [userId, now, now, convId]
      );

      // Add system message into messages log
      const sysMsgId = `msg_assign_${Date.now()}`;
      dbRun(
        `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, 'SYSTEM', ?, 'text', ?, 'delivered', ?)`,
        [sysMsgId, orgId, convId, userId, `Atendimento iniciado por ${req.user!.name}.`, now]
      );

      // Record event
      dbRun(
        'INSERT INTO conversation_events (id, conversation_id, user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `evt_assign_${Date.now()}`,
          convId,
          userId,
          'ASSIGNED',
          JSON.stringify({ assignedTo: req.user!.name }),
          now,
        ]
      );

      // Record audit log
      dbRun(
        'INSERT INTO audit_logs (id, organization_id, user_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `log_assign_${Date.now()}`,
          orgId,
          userId,
          'CONVERSATION_ASSIGNED',
          JSON.stringify({ conversationId: convId, assignedUser: req.user!.name }),
          now,
        ]
      );

      return { success: true };
    });

    if (result.error) {
      res.status(result.status || 400).json({ error: result.error });
      return;
    }

    // Broadcast realtime event to all attendants
    broadcastEvent('conversation:assigned', {
      conversationId: convId,
      assignedUserId: userId,
      assignedUserName: req.user!.name,
      status: 'OPEN',
      updatedAt: now,
    }, orgId);

    res.json({ success: true, message: 'Conversa assumida com sucesso!' });
  } catch (error) {
    console.error('Error assigning conversation:', error);
    res.status(500).json({ error: 'Erro ao assumir conversa.' });
  }
});

// POST /api/conversations/:id/messages - Send message from attendant
conversationsRouter.post('/:id/messages', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const convId = req.params.id;
    const userId = req.user!.id;
    const orgId = req.user!.organization_id;
    const { content, messageType = 'text', mediaUrl } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Conteúdo da mensagem não pode ser vazio.' });
      return;
    }

    const conv = dbGet<any>(
      'SELECT c.id, c.customer_id, c.assigned_user_id, c.status, cust.phone, cust.name FROM conversations c LEFT JOIN customers cust ON c.customer_id = cust.id WHERE c.id = ? AND c.organization_id = ?',
      [convId, orgId]
    );

    if (!conv) {
      res.status(404).json({ error: 'Conversa não encontrada.' });
      return;
    }

    // Attendant authorization check: only assigned agent (or supervisor/admin) can reply
    if (conv.assigned_user_id && conv.assigned_user_id !== userId && req.user!.role === 'AGENT') {
      res.status(403).json({ error: 'Apenas o atendente responsável pode responder esta conversa.' });
      return;
    }

    const now = new Date().toISOString();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    dbTransaction(() => {
      // Insert message
      dbRun(
        `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, media_url, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [msgId, orgId, convId, 'AGENT', userId, messageType, content.trim(), mediaUrl || null, 'sent', now]
      );

      // Update conversation last_message_at and status if needed
      dbRun(
        `UPDATE conversations
         SET last_message_at = ?, updated_at = ?, status = CASE WHEN status = 'WAITING' THEN 'OPEN' ELSE status END
         WHERE id = ?`,
        [now, now, convId]
      );
    });

    const senderUser = dbGet<{ name: string; avatar: string }>('SELECT name, avatar FROM users WHERE id = ?', [userId]);

    const createdMessage = {
      id: msgId,
      organization_id: orgId,
      conversation_id: convId,
      sender_type: 'AGENT',
      sender_id: userId,
      sender_name: senderUser?.name || req.user!.name,
      sender_avatar: senderUser?.avatar || req.user!.avatar || null,
      message_type: messageType,
      content: content.trim(),
      media_url: mediaUrl || null,
      status: 'sent',
      created_at: now,
    };

    // Broadcast new message via WebSocket
    broadcastEvent('message:new', {
      conversationId: convId,
      message: createdMessage,
    }, orgId);

    // Send to WhatsApp via active integration (Meta Cloud API or QR Code Gateway)
    if (conv?.phone) {
      WhatsAppService.sendTextMessage(conv.phone, content.trim(), orgId).catch((waErr) => {
        console.warn('Warning sending WhatsApp message to external provider:', waErr);
      });
    }

    res.status(201).json({ message: createdMessage });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Não foi possível enviar a mensagem.' });
  }
});

// POST /api/conversations/:id/transfer - Transfer conversation to another attendant
conversationsRouter.post('/:id/transfer', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const convId = req.params.id;
    const currentUserId = req.user!.id;
    const orgId = req.user!.organization_id;
    const { targetUserId, reason } = req.body;

    if (!targetUserId) {
      res.status(400).json({ error: 'Selecione o atendente de destino.' });
      return;
    }

    const targetUser = dbGet<any>('SELECT id, name FROM users WHERE id = ? AND organization_id = ?', [targetUserId, orgId]);
    if (!targetUser) {
      res.status(404).json({ error: 'Atendente de destino não encontrado.' });
      return;
    }

    const now = new Date().toISOString();

    dbTransaction(() => {
      dbRun(
        "UPDATE conversations SET assigned_user_id = ?, status = 'OPEN', updated_at = ? WHERE id = ? AND organization_id = ?",
        [targetUserId, now, convId, orgId]
      );

      dbRun(
        'INSERT INTO conversation_events (id, conversation_id, user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `evt_trans_${Date.now()}`,
          convId,
          currentUserId,
          'TRANSFERRED',
          JSON.stringify({ fromUserId: currentUserId, toUserId: targetUserId, toUserName: targetUser.name, reason: reason || 'Transferência solicitada' }),
          now,
        ]
      );

      dbRun(
        'INSERT INTO audit_logs (id, organization_id, user_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `log_trans_${Date.now()}`,
          orgId,
          currentUserId,
          'CONVERSATION_TRANSFERRED',
          JSON.stringify({ conversationId: convId, targetUserId, targetUserName: targetUser.name, reason }),
          now,
        ]
      );
    });

    broadcastEvent('conversation:transferred', {
      conversationId: convId,
      newAssignedUserId: targetUserId,
      newAssignedUserName: targetUser.name,
      transferredBy: req.user!.name,
      reason,
      updatedAt: now,
    }, orgId);

    res.json({ success: true, message: `Conversa transferida para ${targetUser.name}.` });
  } catch (error) {
    console.error('Error transferring conversation:', error);
    res.status(500).json({ error: 'Erro ao transferir atendimento.' });
  }
});

// POST /api/conversations/:id/close - Close conversation
conversationsRouter.post('/:id/close', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const convId = req.params.id;
    const userId = req.user!.id;
    const orgId = req.user!.organization_id;
    const { outcome, saleValue, lostReason } = req.body || {};
    const now = new Date().toISOString();

    dbTransaction(() => {
      dbRun(
        "UPDATE conversations SET status = 'CLOSED', closed_at = ?, closed_by_user_id = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
        [now, userId, now, convId, orgId]
      );

      dbRun(
        'INSERT INTO conversation_events (id, conversation_id, user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `evt_close_${Date.now()}`,
          convId,
          userId,
          'CLOSED',
          JSON.stringify({ closedBy: req.user!.name, outcome, saleValue, lostReason }),
          now,
        ]
      );

      dbRun(
        'INSERT INTO audit_logs (id, organization_id, user_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `log_close_${Date.now()}`,
          orgId,
          userId,
          'CONVERSATION_CLOSED',
          JSON.stringify({ conversationId: convId, outcome, saleValue, lostReason }),
          now,
        ]
      );
    });

    broadcastEvent('conversation:closed', {
      conversationId: convId,
      closedByUserId: userId,
      closedByUserName: req.user!.name,
      closedAt: now,
      outcome,
      saleValue,
      lostReason,
    }, orgId);

    res.json({ success: true, message: 'Atendimento encerrado com sucesso.' });
  } catch (error) {
    console.error('Error closing conversation:', error);
    res.status(500).json({ error: 'Erro ao encerrar atendimento.' });
  }
});

// POST /api/conversations/:id/reopen - Reopen conversation
conversationsRouter.post('/:id/reopen', authenticateToken, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const convId = req.params.id;
    const userId = req.user!.id;
    const orgId = req.user!.organization_id;
    const now = new Date().toISOString();

    dbTransaction(() => {
      dbRun(
        "UPDATE conversations SET status = 'OPEN', assigned_user_id = ?, closed_at = NULL, closed_by_user_id = NULL, updated_at = ? WHERE id = ? AND organization_id = ?",
        [userId, now, convId, orgId]
      );

      dbRun(
        'INSERT INTO conversation_events (id, conversation_id, user_id, event_type, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [
          `evt_reopen_${Date.now()}`,
          convId,
          userId,
          'REOPENED',
          JSON.stringify({ reopenedBy: req.user!.name }),
          now,
        ]
      );
    });

    broadcastEvent('conversation:reopened', {
      conversationId: convId,
      reopenedByUserId: userId,
      reopenedByUserName: req.user!.name,
      updatedAt: now,
    }, orgId);

    res.json({ success: true, message: 'Atendimento reaberto com sucesso.' });
  } catch (error) {
    console.error('Error reopening conversation:', error);
    res.status(500).json({ error: 'Erro ao reabrir conversa.' });
  }
});
