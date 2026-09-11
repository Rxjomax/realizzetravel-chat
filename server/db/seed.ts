import bcrypt from 'bcryptjs';
import { dbGet, dbQuery, dbRun, dbTransaction } from './database';
import { WhatsAppService } from '../services/whatsapp.service';

export async function seedDatabase(): Promise<void> {
  // 0. Auto-migrate existing DB records if any mention VooLivre or legacy domain
  try {
    dbRun("INSERT OR IGNORE INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES ('org_realizzetravel', 'RealizzeTravel', 'realizzetravel', 'ENTERPRISE', datetime('now'), datetime('now'))");
    dbRun("INSERT OR IGNORE INTO organizations (id, name, slug, plan, created_at, updated_at) VALUES ('org_voolivre', 'RealizzeTravel', 'realizzetravel', 'ENTERPRISE', datetime('now'), datetime('now'))");
    dbRun("UPDATE organizations SET name = 'RealizzeTravel', slug = 'realizzetravel'");
    dbRun("UPDATE users SET organization_id = 'org_realizzetravel', email = REPLACE(email, '@voolivre.com.br', '@realizzetravel.com.br')");
    dbRun("UPDATE customers SET organization_id = 'org_realizzetravel'");
    dbRun("UPDATE conversations SET organization_id = 'org_realizzetravel'");
    dbRun("UPDATE messages SET organization_id = 'org_realizzetravel', content = REPLACE(REPLACE(content, 'VooLivre', 'RealizzeTravel'), 'RealizzeTravel Viagens', 'RealizzeTravel')");
    dbRun("UPDATE settings SET value = REPLACE(REPLACE(REPLACE(value, 'VooLivre', 'RealizzeTravel'), '@voolivre', '@realizzetravel'), 'RealizzeTravel Viagens & Turismo', 'RealizzeTravel')");
    dbRun("UPDATE audit_logs SET organization_id = 'org_realizzetravel', metadata = REPLACE(REPLACE(metadata, 'VooLivre', 'RealizzeTravel'), 'RealizzeTravel Viagens', 'RealizzeTravel')");

    // Clean up empty fake conversations from previous runs
    try {
      dbRun(
        `DELETE FROM conversations 
         WHERE (organization_id = 'org_realizzetravel' OR organization_id = 'org_voolivre')
           AND (whatsapp_jid IS NULL OR whatsapp_jid = '')
           AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = conversations.id)
           AND id NOT IN ('conv_camila', 'conv_juliana', 'conv_matheus', 'conv_rodrigo')`
      );
    } catch {}

    // Standardize user roles and labels: Admin, Supervisor, and Consultores 1 to 6
    dbRun("UPDATE users SET name = 'Carlos Santos (Administrador)', email = 'admin@realizzetravel.com.br' WHERE id = 'usr_admin'");
    dbRun("UPDATE users SET name = 'Renata Lima (Supervisora)', email = 'supervisor@realizzetravel.com.br' WHERE id = 'usr_supervisor'");
    dbRun("UPDATE users SET name = 'Consultor 1 (João Silva)', email = 'consultor1@realizzetravel.com.br' WHERE id = 'usr_joao'");
    dbRun("UPDATE users SET name = 'Consultor 2 (Maria Oliveira)', email = 'consultor2@realizzetravel.com.br' WHERE id = 'usr_maria'");
    dbRun("UPDATE users SET name = 'Consultor 3 (Pedro Souza)', email = 'consultor3@realizzetravel.com.br' WHERE id = 'usr_pedro'");
    dbRun("UPDATE users SET name = 'Consultor 4 (Ana Paula)', email = 'consultor4@realizzetravel.com.br' WHERE id = 'usr_anapaula'");

    const now = new Date().toISOString();

    // Ensure WhatsApp configuration is pre-configured with the VPS Evolution API
    const currentWaRow = dbGet<{ value: string }>("SELECT value FROM settings WHERE key = 'whatsapp_config'");
    if (currentWaRow && currentWaRow.value) {
      try {
        const parsed = JSON.parse(currentWaRow.value);
        // Pre-configure Evolution API defaults so user can immediately scan QR code
        if (!parsed.gatewayUrl || parsed.instanceName === 'realizze-travel' || parsed.providerType !== 'EVOLUTION_API') {
          parsed.providerType = 'EVOLUTION_API';
          parsed.gatewayUrl = process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080';
          parsed.apiKey = process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026';
          parsed.instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial';
          dbRun("UPDATE settings SET value = ? WHERE key = 'whatsapp_config'", [JSON.stringify(parsed)]);
        }
      } catch {}
    } else {
      dbRun(
        `INSERT INTO settings (id, organization_id, key, value, created_at, updated_at)
         VALUES (?, ?, 'whatsapp_config', ?, ?, ?)`,
        [
          'set_wa_config',
          'org_realizzetravel',
          JSON.stringify({
            providerType: 'EVOLUTION_API',
            gatewayUrl: process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080',
            apiKey: process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026',
            instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial',
            status: 'DISCONNECTED',
            qrCodeBase64: null,
            phoneConnected: null,
            batteryLevel: null,
          }),
          now,
          now,
        ]
      );
    }

    // Seed users if not exist
    const defaultPw = await bcrypt.hash('viagens123', 10);
    const anaExists = dbGet('SELECT id FROM users WHERE id = ? OR email = ?', ['usr_anapaula', 'consultor4@realizzetravel.com.br']);
    if (!anaExists) {
      dbRun(
        `INSERT INTO users (id, organization_id, name, email, password_hash, role, status, avatar, created_at, updated_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['usr_anapaula', 'org_realizzetravel', 'Consultor 4 (Ana Paula)', 'consultor4@realizzetravel.com.br', defaultPw, 'AGENT', 'ONLINE', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=face', now, now, now]
      );
    }
    const lucasExists = dbGet('SELECT id FROM users WHERE id = ? OR email = ?', ['usr_lucas', 'consultor5@realizzetravel.com.br']);
    if (!lucasExists) {
      dbRun(
        `INSERT INTO users (id, organization_id, name, email, password_hash, role, status, avatar, created_at, updated_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['usr_lucas', 'org_realizzetravel', 'Consultor 5 (Lucas Ferreira)', 'consultor5@realizzetravel.com.br', defaultPw, 'AGENT', 'ONLINE', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face', now, now, now]
      );
    }
    const beatrizExists = dbGet('SELECT id FROM users WHERE id = ? OR email = ?', ['usr_beatriz', 'consultor6@realizzetravel.com.br']);
    if (!beatrizExists) {
      dbRun(
        `INSERT INTO users (id, organization_id, name, email, password_hash, role, status, avatar, created_at, updated_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['usr_beatriz', 'org_realizzetravel', 'Consultor 6 (Beatriz Costa)', 'consultor6@realizzetravel.com.br', defaultPw, 'AGENT', 'ONLINE', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop&crop=face', now, now, now]
      );
    }

    // Restore / ensure Camila's chat history is complete
    const camilaConv = dbGet<any>("SELECT c.id as conv_id, cust.id as cust_id FROM conversations c JOIN customers cust ON cust.id = c.customer_id WHERE cust.name LIKE '%Camila%' OR cust.phone LIKE '%33695432727%' LIMIT 1");
    if (camilaConv) {
      const msgsToEnsure = [
        { sender_type: 'CUSTOMER', sender_id: camilaConv.cust_id, content: 'que meu filho adoeceu e entrou para o antibiótico pela primeira vez e acabou que não fizemos foi nada kkkkk', time: '2026-09-06T18:44:00.000Z' },
        { sender_type: 'CUSTOMER', sender_id: camilaConv.cust_id, content: 'foi o custo benefício mesmo. Ter q pegar voo tb..', time: '2026-09-06T18:44:30.000Z' },
        { sender_type: 'AGENT', sender_id: 'usr_joao', content: 'Eita Camila, melhoras para o pequeno', time: '2026-09-06T20:02:00.000Z' },
        { sender_type: 'AGENT', sender_id: 'usr_joao', content: 'Caso precise de algo, algum hotel ou ate mesmo passeio por aqui tambem voce fala', time: '2026-09-06T20:03:00.000Z' },
        { sender_type: 'CUSTOMER', sender_id: camilaConv.cust_id, content: 'Olá! Gostaria de atendimento com a Realizze Travel para minha viagem.', time: '2026-09-06T20:03:30.000Z' },
        { sender_type: 'AGENT', sender_id: 'usr_joao', content: '*[Consultor 1]*: Olá Camila, Tudo bem? Eu sou um dos representantes da RealizzeTravel!!! Somos especialistas em realizar sonhos, vamos iniciar sua jornada?', time: '2026-09-06T21:52:00.000Z' }
      ];
      for (const m of msgsToEnsure) {
        const exists = dbGet<any>('SELECT id FROM messages WHERE conversation_id = ? AND content = ? LIMIT 1', [camilaConv.conv_id, m.content]);
        if (!exists) {
          const msgId = `msg_camila_${Math.random().toString(36).substring(7)}`;
          dbRun(
            `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, status, created_at)
             VALUES (?, 'org_realizzetravel', ?, ?, ?, 'text', ?, 'delivered', ?)`,
            [msgId, camilaConv.conv_id, m.sender_type, m.sender_id, m.content, m.time]
          );
        }
      }
      dbRun("DELETE FROM messages WHERE conversation_id = ? AND content = 'Conversa sincronizada'", [camilaConv.conv_id]);
    }
  } catch (err) {
    console.warn('Notice running branding migration:', err);
  }

  const existingUsers = dbQuery<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (existingUsers[0]?.count > 0) {
    return; // Already seeded
  }

  console.log('🌱 Seeding initial database for RealizzeTravel...');

  const passwordHash = await bcrypt.hash('viagens123', 10);
  const orgId = 'org_realizzetravel';
  const now = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 7200 * 1000).toISOString();
  const yesterday = new Date(Date.now() - 86400 * 1000).toISOString();

  dbTransaction(() => {
    // 1. Organization
    dbRun(
      `INSERT INTO organizations (id, name, slug, plan, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orgId, 'RealizzeTravel', 'realizzetravel', 'BUSINESS', now, now]
    );

    // 2. Users: Admin, Supervisor, and Consultores 1 to 6
    const users = [
      {
        id: 'usr_admin',
        name: 'Carlos Santos (Administrador)',
        email: 'admin@realizzetravel.com.br',
        role: 'ADMIN',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'usr_supervisor',
        name: 'Renata Lima (Supervisora)',
        email: 'supervisor@realizzetravel.com.br',
        role: 'SUPERVISOR',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'usr_joao',
        name: 'Consultor 1 (João Silva)',
        email: 'consultor1@realizzetravel.com.br',
        role: 'AGENT',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'usr_maria',
        name: 'Consultor 2 (Maria Oliveira)',
        email: 'consultor2@realizzetravel.com.br',
        role: 'AGENT',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'usr_pedro',
        name: 'Consultor 3 (Pedro Souza)',
        email: 'consultor3@realizzetravel.com.br',
        role: 'AGENT',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'usr_anapaula',
        name: 'Consultor 4 (Ana Paula)',
        email: 'consultor4@realizzetravel.com.br',
        role: 'AGENT',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'usr_lucas',
        name: 'Consultor 5 (Lucas Ferreira)',
        email: 'consultor5@realizzetravel.com.br',
        role: 'AGENT',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'usr_beatriz',
        name: 'Consultor 6 (Beatriz Costa)',
        email: 'consultor6@realizzetravel.com.br',
        role: 'AGENT',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop&crop=face',
      },
    ];

    for (const u of users) {
      dbRun(
        `INSERT INTO users (id, organization_id, name, email, password_hash, role, status, avatar, created_at, updated_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, orgId, u.name, u.email, passwordHash, u.role, u.status, u.avatar, now, now, now]
      );
    }

    // 3. Settings (Clean WhatsApp connection state ready for real agency pairing)
    dbRun(
      `INSERT INTO settings (id, organization_id, key, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'set_wa_config',
        orgId,
        'whatsapp_config',
        JSON.stringify({
          providerType: 'EVOLUTION_API',
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
          businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
          verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'viagens_whatsapp_verify_token_2026',
          instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'realizze-oficial',
          gatewayUrl: process.env.EVOLUTION_GATEWAY_URL || 'http://151.244.40.72:8080',
          apiKey: process.env.EVOLUTION_API_KEY || 'Realizze@SecretKey2026',
          qrCodeBase64: null,
          phoneConnected: null,
          batteryLevel: null,
          status: 'DISCONNECTED',
        }),
        now,
        now,
      ]
    );

    // 4. Default Seed Customers
    const customers = [
      {
        id: 'cust_camila',
        name: 'Camila Rodrigues',
        phone: '+5581999991111',
        email: 'camila.rodrigues@email.com',
        destination_interest: 'Maragogi - AL (Resort All Inclusive)',
        travel_date: '2026-11-15',
        passenger_count: 2,
        budget: 'R$ 7.500,00',
        notes: 'Preferência por quarto de frente para o mar com café da manhã incluso.',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'cust_juliana',
        name: 'Juliana Costa',
        phone: '+5581999993333',
        email: 'juliana.costa@email.com',
        destination_interest: 'Gramado & Canela - RS',
        travel_date: '2026-12-01',
        passenger_count: 4,
        budget: 'R$ 12.000,00',
        notes: 'Viagem em família com 2 crianças.',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'cust_matheus',
        name: 'Matheus Silva',
        phone: '+5581999992222',
        email: 'matheus.silva@email.com',
        destination_interest: 'Cancún, México',
        travel_date: '2027-01-20',
        passenger_count: 2,
        budget: 'R$ 15.000,00',
        notes: 'Lua de mel. Busca opção com passeios aos Cenotes.',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'cust_rodrigo',
        name: 'Rodrigo Santos',
        phone: '+5581999994444',
        email: 'rodrigo.santos@email.com',
        destination_interest: 'Cruzeiro pelo Caribe',
        travel_date: '2026-10-10',
        passenger_count: 2,
        budget: 'R$ 10.000,00',
        notes: 'Saindo de Miami ou Port Canaveral.',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'cust_gabriel',
        name: 'Gabriel Alves',
        phone: '+5581999995555',
        email: 'gabriel.alves@email.com',
        destination_interest: 'Orlando - Disney World',
        travel_date: '2026-09-01',
        passenger_count: 3,
        budget: 'R$ 22.000,00',
        notes: 'Pacote fechado com ingressos para 4 parques.',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&h=120&fit=crop&crop=face',
      },
    ];

    for (const c of customers) {
      dbRun(
        `INSERT INTO customers (id, organization_id, name, phone, email, destination_interest, travel_date, passenger_count, budget, notes, avatar, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, orgId, c.name, c.phone, c.email, c.destination_interest, c.travel_date, c.passenger_count, c.budget, c.notes, c.avatar, yesterday, now]
      );
    }

    // 5. Default Seed Conversations
    const conversations = [
      {
        id: 'conv_camila',
        customer_id: 'cust_camila',
        assigned_user_id: 'usr_joao', // Consultor 1
        status: 'OPEN',
        priority: 'HIGH',
        last_message_at: now,
      },
      {
        id: 'conv_juliana',
        customer_id: 'cust_juliana',
        assigned_user_id: 'usr_joao', // Consultor 1
        status: 'OPEN',
        priority: 'MEDIUM',
        last_message_at: oneHourAgo,
      },
      {
        id: 'conv_matheus',
        customer_id: 'cust_matheus',
        assigned_user_id: null, // WAITING
        status: 'WAITING',
        priority: 'HIGH',
        last_message_at: twoHoursAgo,
      },
      {
        id: 'conv_rodrigo',
        customer_id: 'cust_rodrigo',
        assigned_user_id: 'usr_maria', // Consultor 2
        status: 'OPEN',
        priority: 'MEDIUM',
        last_message_at: yesterday,
      },
      {
        id: 'conv_gabriel',
        customer_id: 'cust_gabriel',
        assigned_user_id: 'usr_joao', // Consultor 1
        status: 'CLOSED',
        priority: 'LOW',
        last_message_at: yesterday,
      },
    ];

    for (const conv of conversations) {
      dbRun(
        `INSERT INTO conversations (id, organization_id, customer_id, assigned_user_id, status, priority, created_at, updated_at, last_message_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [conv.id, orgId, conv.customer_id, conv.assigned_user_id, conv.status, conv.priority, yesterday, now, conv.last_message_at]
      );
    }

    // 6. Default Seed Messages
    const seedMsgs = [
      {
        id: 'msg_cam_1',
        conversation_id: 'conv_camila',
        sender_type: 'CUSTOMER',
        sender_id: 'cust_camila',
        content: 'Olá! Gostaria de um orçamento para o Salinas Maragogi em novembro.',
        created_at: twoHoursAgo,
      },
      {
        id: 'msg_cam_2',
        conversation_id: 'conv_camila',
        sender_type: 'AGENT',
        sender_id: 'usr_joao',
        content: 'Olá Camila! Tudo bem? Meu nome é João (Consultor 1). Já estou montando uma cotação especial All Inclusive para você!',
        created_at: oneHourAgo,
      },
      {
        id: 'msg_cam_3',
        conversation_id: 'conv_camila',
        sender_type: 'CUSTOMER',
        sender_id: 'cust_camila',
        content: 'Perfeito João, fico no aguardo! Pode incluir voo direto saindo do Recife?',
        created_at: now,
      },
      {
        id: 'msg_jul_1',
        conversation_id: 'conv_juliana',
        sender_type: 'CUSTOMER',
        sender_id: 'cust_juliana',
        content: 'Bom dia! Vocês têm pacotes para o Natal Luz em Gramado com hotel perto da Av. Borges de Medeiros?',
        created_at: twoHoursAgo,
      },
      {
        id: 'msg_jul_2',
        conversation_id: 'conv_juliana',
        sender_type: 'AGENT',
        sender_id: 'usr_joao',
        content: 'Bom dia Juliana! Temos sim, reservamos os melhores hotéis centrais. Quantas noites vocês pretendem ficar?',
        created_at: oneHourAgo,
      },
      {
        id: 'msg_mat_1',
        conversation_id: 'conv_matheus',
        sender_type: 'CUSTOMER',
        sender_id: 'cust_matheus',
        content: 'Olá, gostaria de saber os valores para Cancún em janeiro para 2 pessoas.',
        created_at: twoHoursAgo,
      },
    ];

    for (const m of seedMsgs) {
      dbRun(
        `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'text', ?, 'delivered', ?)`,
        [m.id, orgId, m.conversation_id, m.sender_type, m.sender_id, m.content, m.created_at]
      );
    }

    // 7. Initial Audit Log
    dbRun(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'log_init_system',
        orgId,
        'usr_admin',
        'SYSTEM_INITIALIZED',
        JSON.stringify({ message: 'Sistema RealizzeTravel inicializado. Pronto para atendimento.' }),
        now,
      ]
    );
  });

  console.log('✅ Initial database seeded cleanly with staff users, seed conversations, and agency configuration.');

  // Trigger sync of real WhatsApp chats and messages in background
  setTimeout(() => {
    WhatsAppService.syncEvolutionChats(orgId).catch((err) => {
      console.warn('Background WhatsApp sync error during seed:', err);
    });
  }, 500);
}
