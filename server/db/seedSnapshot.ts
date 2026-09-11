import fs from 'fs';
import path from 'path';
import { dbGet, dbRun, dbTransaction } from './database';

export function seedWhatsAppSnapshot(orgId: string = 'org_realizzetravel'): void {
  try {
    const existingCount = dbGet<{ count: number }>(
      'SELECT COUNT(*) as count FROM conversations WHERE organization_id = ? AND whatsapp_jid IS NOT NULL',
      [orgId]
    )?.count || 0;

    if (existingCount >= 10) {
      return;
    }

    const snapshotPath = path.join(__dirname, 'whatsapp_snapshot.json');
    if (!fs.existsSync(snapshotPath)) {
      return;
    }

    const raw = fs.readFileSync(snapshotPath, 'utf8');
    const data = JSON.parse(raw);
    const { customers, conversations, messages, groups } = data;

    dbTransaction(() => {
      // 1. Seed customers
      if (Array.isArray(customers)) {
        for (const cust of customers) {
          dbRun(
            `INSERT OR REPLACE INTO customers (
              id, organization_id, name, phone, email, whatsapp_jid,
              destination_interest, travel_date, passenger_count, budget, notes, avatar, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              cust.id,
              cust.organization_id || orgId,
              cust.name || 'Cliente WhatsApp',
              cust.phone || '',
              cust.email || null,
              cust.whatsapp_jid || null,
              cust.destination_interest || 'Pacote de Viagem',
              cust.travel_date || null,
              cust.passenger_count || 2,
              cust.budget || 'R$ 7.500',
              cust.notes || null,
              cust.avatar || null,
              cust.created_at || new Date().toISOString(),
              cust.updated_at || new Date().toISOString(),
            ]
          );
        }
      }

      // 2. Seed conversations
      if (Array.isArray(conversations)) {
        for (const conv of conversations) {
          dbRun(
            `INSERT OR REPLACE INTO conversations (
              id, organization_id, customer_id, assigned_user_id, whatsapp_jid, status, priority,
              created_at, updated_at, closed_at, closed_by_user_id, last_message_at,
              reminder_date, reminder_note, reminder_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              conv.id,
              conv.organization_id || orgId,
              conv.customer_id,
              conv.assigned_user_id || null,
              conv.whatsapp_jid || null,
              conv.status || 'WAITING',
              conv.priority || 'MEDIUM',
              conv.created_at || new Date().toISOString(),
              conv.updated_at || new Date().toISOString(),
              conv.closed_at || null,
              conv.closed_by_user_id || null,
              conv.last_message_at || conv.updated_at || conv.created_at,
              conv.reminder_date || null,
              conv.reminder_note || null,
              conv.reminder_status || null,
            ]
          );
        }
      }

      // 3. Seed messages
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          dbRun(
            `INSERT OR REPLACE INTO messages (
              id, organization_id, conversation_id, sender_type, sender_id, message_type, content, media_url, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              msg.id,
              msg.organization_id || orgId,
              msg.conversation_id,
              msg.sender_type,
              msg.sender_id,
              msg.message_type || 'text',
              msg.content,
              msg.media_url || null,
              msg.status || 'delivered',
              msg.created_at || new Date().toISOString(),
            ]
          );
        }
      }

      // 4. Seed groups
      if (Array.isArray(groups)) {
        for (const grp of groups) {
          dbRun(
            `INSERT OR REPLACE INTO whatsapp_groups (
              id, organization_id, name, description, participant_count, avatar, last_message, last_message_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              grp.id,
              grp.organization_id || orgId,
              grp.name,
              grp.description || null,
              grp.participant_count || 0,
              grp.avatar || null,
              grp.last_message || null,
              grp.last_message_at || new Date().toISOString(),
              grp.created_at || new Date().toISOString(),
              grp.updated_at || new Date().toISOString(),
            ]
          );
        }
      }
    });

    console.log(`✅ Seeded snapshot with ${conversations?.length || 0} conversations and ${customers?.length || 0} customers.`);
  } catch (err) {
    console.warn('Notice seeding WhatsApp snapshot:', err);
  }
}
