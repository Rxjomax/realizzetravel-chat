import bcrypt from 'bcryptjs';
import { dbGet, dbQuery, dbRun, dbTransaction } from './database';

export async function seedDatabase(): Promise<void> {
  // 0. Auto-migrate existing DB records if any mention VooLivre or legacy domain
  try {
    dbRun("UPDATE organizations SET name = 'RealizzeTravel Viagens & Turismo', slug = 'realizzetravel' WHERE slug = 'voolivre' OR name LIKE '%VooLivre%'");
    dbRun("UPDATE users SET email = REPLACE(email, '@voolivre.com.br', '@realizzetravel.com.br')");
    dbRun("UPDATE messages SET content = REPLACE(content, 'VooLivre', 'RealizzeTravel')");
    dbRun("UPDATE settings SET value = REPLACE(REPLACE(value, 'VooLivre', 'RealizzeTravel'), '@voolivre', '@realizzetravel')");
    dbRun("UPDATE audit_logs SET metadata = REPLACE(metadata, 'VooLivre', 'RealizzeTravel')");
  } catch (err) {
    console.warn('Notice running branding migration:', err);
  }

  const existingUsers = dbQuery<{ count: number }>('SELECT COUNT(*) as count FROM users');
  if (existingUsers[0]?.count > 0) {
    return; // Already seeded
  }

  console.log('🌱 Seeding initial database for RealizzeTravel Viagens...');

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
      [orgId, 'RealizzeTravel Viagens & Turismo', 'realizzetravel', 'BUSINESS', now, now]
    );

    // 2. Users (1 Admin, 1 Supervisor, 3 Agents)
    const users = [
      {
        id: 'usr_admin',
        name: 'Carlos Santos',
        email: 'admin@realizzetravel.com.br',
        role: 'ADMIN',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'usr_supervisor',
        name: 'Renata Lima',
        email: 'supervisor@realizzetravel.com.br',
        role: 'SUPERVISOR',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'usr_joao',
        name: 'João Silva',
        email: 'joao@realizzetravel.com.br',
        role: 'AGENT',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'usr_maria',
        name: 'Maria Oliveira',
        email: 'maria@realizzetravel.com.br',
        role: 'AGENT',
        status: 'ONLINE',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=face',
      },
      {
        id: 'usr_pedro',
        name: 'Pedro Souza',
        email: 'pedro@realizzetravel.com.br',
        role: 'AGENT',
        status: 'OFFLINE',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&h=120&fit=crop&crop=face',
      },
    ];

    for (const u of users) {
      dbRun(
        `INSERT INTO users (id, organization_id, name, email, password_hash, role, status, avatar, created_at, updated_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [u.id, orgId, u.name, u.email, passwordHash, u.role, u.status, u.avatar, now, now, now]
      );
    }

    // 3. Customers (10 travel leads)
    const customers = [
      {
        id: 'cst_1',
        name: 'Carlos Alberto Ferreira',
        phone: '+55 11 98765-4321',
        email: 'carlos.alberto@email.com',
        notes: 'Interesse em pacote com tudo incluído para casal e 1 criança',
        destination: 'Porto Seguro, BA',
        travel_date: '2026-11-15',
        passengers: 3,
        budget: 'R$ 6.500',
      },
      {
        id: 'cst_2',
        name: 'Fernanda Souza Brandão',
        phone: '+55 21 99876-5432',
        email: 'fernanda.souza@email.com',
        notes: 'Procura voo direto saindo do Galeão no período matutino',
        destination: 'Recife, PE',
        travel_date: '2026-10-08',
        passengers: 2,
        budget: 'R$ 3.200',
      },
      {
        id: 'cst_3',
        name: 'Rodrigo Mendes Teixeira',
        phone: '+55 31 98765-1234',
        email: 'rodrigo.mendes@email.com',
        notes: 'Cruzeiro de Réveillon pela costa brasileira com varanda',
        destination: 'Cruzeiro Costa / MSC',
        travel_date: '2026-12-28',
        passengers: 2,
        budget: 'R$ 14.000',
      },
      {
        id: 'cst_4',
        name: 'Juliana Paes Vasconcelos',
        phone: '+55 41 97654-3210',
        email: 'juliana.paes@email.com',
        notes: 'Resort com piscina aquecida e atrações infantis',
        destination: 'Gramado & Canela, RS',
        travel_date: '2026-09-20',
        passengers: 4,
        budget: 'R$ 8.900',
      },
      {
        id: 'cst_5',
        name: 'Lucas Moura Barbosa',
        phone: '+55 61 98123-4567',
        email: 'lucas.moura@email.com',
        notes: 'Ingressos parques Disney + Universal e hospedagem em Kissimmee',
        destination: 'Orlando, EUA',
        travel_date: '2027-01-10',
        passengers: 3,
        budget: 'R$ 28.000',
      },
      {
        id: 'cst_6',
        name: 'Camila Queiroz Antunes',
        phone: '+55 71 99234-5678',
        email: 'camila.queiroz@email.com',
        notes: 'Transfer privativo aeroporto para Praia do Forte',
        destination: 'Salvador e Litoral Norte, BA',
        travel_date: '2026-10-02',
        passengers: 2,
        budget: 'R$ 1.800',
      },
      {
        id: 'cst_7',
        name: 'Gabriel Medina Ramos',
        phone: '+55 81 98345-6789',
        email: 'gabriel.medina@email.com',
        notes: 'Cobertura de seguro viagem 60k USD para espaço Schengen',
        destination: 'Portugal e Espanha',
        travel_date: '2026-11-01',
        passengers: 1,
        budget: 'R$ 950',
      },
      {
        id: 'cst_8',
        name: 'Beatriz Arantes Silveira',
        phone: '+55 85 99456-7890',
        email: 'beatriz.arantes@email.com',
        notes: 'Pousada de charme com vista para o Morro do Pico',
        destination: 'Fernando de Noronha, PE',
        travel_date: '2026-12-05',
        passengers: 2,
        budget: 'R$ 16.500',
      },
      {
        id: 'cst_9',
        name: 'Thiago Martins Carvalho',
        phone: '+55 19 98567-8901',
        email: 'thiago.martins@email.com',
        notes: 'Passaporte 2 dias de parque + hotel em Penha/Balneário',
        destination: 'Beto Carrero World, SC',
        travel_date: '2026-10-12',
        passengers: 4,
        budget: 'R$ 4.200',
      },
      {
        id: 'cst_10',
        name: 'Larissa Manoela Becker',
        phone: '+55 51 99678-9012',
        email: 'larissa.m@email.com',
        notes: 'Aulas de esqui e hotel no Cerro Catedral',
        destination: 'Bariloche, Argentina',
        travel_date: '2026-09-28',
        passengers: 2,
        budget: 'R$ 12.000',
      },
    ];

    for (const c of customers) {
      dbRun(
        `INSERT INTO customers (id, organization_id, name, phone, email, notes, destination_interest, travel_date, passenger_count, budget, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, orgId, c.name, c.phone, c.email, c.notes, c.destination, c.travel_date, c.passengers, c.budget, yesterday, now]
      );
    }

    // 4. Conversations (20 conversations across WAITING, OPEN, CLOSED)
    const convData = [
      // 6 WAITING in queue (available to be claimed via "Atender")
      { id: 'cnv_wait_1', cust: 'cst_1', status: 'WAITING', prio: 'HIGH', assigned: null, time: now, msg: 'Oi! Gostaria de saber o valor de um pacote para Porto Seguro em novembro para 2 adultos e 1 criança de 6 anos.' },
      { id: 'cnv_wait_2', cust: 'cst_2', status: 'WAITING', prio: 'MEDIUM', assigned: null, time: oneHourAgo, msg: 'Olá, vocês têm passagens aéreas promocionais para Recife na primeira semana de outubro?' },
      { id: 'cnv_wait_3', cust: 'cst_3', status: 'WAITING', prio: 'URGENT', assigned: null, time: twoHoursAgo, msg: 'Boa tarde! Quero cotar cabine externa com varanda para o cruzeiro de Réveillon.' },
      { id: 'cnv_wait_4', cust: 'cst_8', status: 'WAITING', prio: 'HIGH', assigned: null, time: yesterday, msg: 'Olá RealizzeTravel! Estamos planejando nossa lua de mel em Fernando de Noronha, vocês cuidam das taxas ambientais?' },
      { id: 'cnv_wait_5', cust: 'cst_9', status: 'WAITING', prio: 'LOW', assigned: null, time: yesterday, msg: 'Boa tarde! Qual é o valor do pacote para o feriado de 12 de outubro no Beto Carrero?' },
      { id: 'cnv_wait_6', cust: 'cst_10', status: 'WAITING', prio: 'MEDIUM', assigned: null, time: yesterday, msg: 'Oi, ainda dá tempo de pegar neve em Bariloche no final de setembro? Temos interesse em 7 noites.' },

      // 8 OPEN (Assigned to João, Maria, Pedro)
      { id: 'cnv_open_1', cust: 'cst_4', status: 'OPEN', prio: 'HIGH', assigned: 'usr_joao', time: now, msg: 'Excelente João, a opção com café da manhã e transfer do aeroporto de Porto Alegre ficou ótima!' },
      { id: 'cnv_open_2', cust: 'cst_5', status: 'OPEN', prio: 'URGENT', assigned: 'usr_maria', time: oneHourAgo, msg: 'Maria, conseguimos incluir o ingresso do Volcano Bay e o FastPass?' },
      { id: 'cnv_open_3', cust: 'cst_6', status: 'OPEN', prio: 'MEDIUM', assigned: 'usr_pedro', time: twoHoursAgo, msg: 'Perfeito Pedro, qual o ponto de encontro para a van no aeroporto de Salvador?' },
      { id: 'cnv_open_4', cust: 'cst_7', status: 'OPEN', prio: 'LOW', assigned: 'usr_joao', time: yesterday, msg: 'Obrigado João, acabei de enviar meus dados de passaporte para a apólice do seguro.' },
      { id: 'cnv_open_5', cust: 'cst_1', status: 'OPEN', prio: 'MEDIUM', assigned: 'usr_maria', time: yesterday, msg: 'Maria, o hotel tem recreação para crianças pequenas durante o dia todo?' },
      { id: 'cnv_open_6', cust: 'cst_2', status: 'OPEN', prio: 'LOW', assigned: 'usr_joao', time: yesterday, msg: 'Consigo despachar uma bagagem de 23kg inclusa nessa tarifa?' },
      { id: 'cnv_open_7', cust: 'cst_3', status: 'OPEN', prio: 'HIGH', assigned: 'usr_maria', time: yesterday, msg: 'Ótimo, o pacote de bebidas all-inclusive na cabine é o pacote Easy Plus?' },
      { id: 'cnv_open_8', cust: 'cst_4', status: 'OPEN', prio: 'MEDIUM', assigned: 'usr_pedro', time: yesterday, msg: 'Pedro, você consegue segurar essa reserva até amanhã de manhã?' },

      // 6 CLOSED (Historical resolved tickets)
      { id: 'cnv_cls_1', cust: 'cst_5', status: 'CLOSED', prio: 'MEDIUM', assigned: 'usr_joao', time: yesterday, msg: 'Vouchers emitidos e enviados por e-mail com sucesso. Boa viagem!' },
      { id: 'cnv_cls_2', cust: 'cst_6', status: 'CLOSED', prio: 'LOW', assigned: 'usr_maria', time: yesterday, msg: 'Atendimento concluído. Reserva confirmada no resort.' },
      { id: 'cnv_cls_3', cust: 'cst_7', status: 'CLOSED', prio: 'LOW', assigned: 'usr_pedro', time: yesterday, msg: 'Apólice do seguro viagem emitida. Tenha uma excelente viagem pela Europa!' },
      { id: 'cnv_cls_4', cust: 'cst_8', status: 'CLOSED', prio: 'HIGH', assigned: 'usr_joao', time: yesterday, msg: 'Pagamento aprovado. Parabéns pelo casamento e ótima estadia em Noronha!' },
      { id: 'cnv_cls_5', cust: 'cst_9', status: 'CLOSED', prio: 'MEDIUM', assigned: 'usr_maria', time: yesterday, msg: 'Ingressos do parque e reserva de van enviadas. Qualquer dúvida estamos à disposição.' },
      { id: 'cnv_cls_6', cust: 'cst_10', status: 'CLOSED', prio: 'HIGH', assigned: 'usr_pedro', time: yesterday, msg: 'Reserva e passagens de Bariloche 100% confirmadas. Boas férias!' },
    ];

    for (const c of convData) {
      dbRun(
        `INSERT INTO conversations (id, organization_id, customer_id, assigned_user_id, status, priority, created_at, updated_at, closed_at, closed_by_user_id, last_message_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          c.id,
          orgId,
          c.cust,
          c.assigned,
          c.status,
          c.prio,
          c.time,
          c.time,
          c.status === 'CLOSED' ? c.time : null,
          c.status === 'CLOSED' ? c.assigned : null,
          c.time,
        ]
      );

      // Add conversation event
      dbRun(
        `INSERT INTO conversation_events (id, conversation_id, user_id, event_type, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `evt_${c.id}_init`,
          c.id,
          c.assigned,
          c.status === 'WAITING' ? 'CREATED' : c.status === 'OPEN' ? 'ASSIGNED' : 'CLOSED',
          JSON.stringify({ note: `Conversa inicializada no estado ${c.status}` }),
          c.time,
        ]
      );
    }

    // 5. Messages for conversations
    let msgIndex = 1;
    for (const c of convData) {
      // First customer inbound message
      dbRun(
        `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, whatsapp_message_id, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `msg_${msgIndex++}`,
          orgId,
          c.id,
          'CUSTOMER',
          c.cust,
          'text',
          c.msg,
          `wamid.HBgL${Date.now()}_${msgIndex}`,
          'read',
          c.time,
        ]
      );

      // If OPEN or CLOSED, add attendant reply
      if (c.status === 'OPEN' || c.status === 'CLOSED') {
        dbRun(
          `INSERT INTO messages (id, organization_id, conversation_id, sender_type, sender_id, message_type, content, whatsapp_message_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `msg_${msgIndex++}`,
            orgId,
            c.id,
            'AGENT',
            c.assigned || 'usr_joao',
            'text',
            'Olá! Sou da equipe RealizzeTravel Viagens. Analisei seu pedido e separei as melhores opções disponíveis para suas datas com condições especiais.',
            `wamid.HBgL${Date.now()}_${msgIndex}`,
            'read',
            c.time,
          ]
        );
      }
    }

    // 6. Settings
    dbRun(
      `INSERT INTO settings (id, organization_id, key, value, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'set_wa_config',
        orgId,
        'whatsapp_config',
        JSON.stringify({
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '104829381948291',
          businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '205938491823948',
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
          verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'viagens_whatsapp_verify_token_2026',
          status: 'CONNECTED',
        }),
        now,
        now,
      ]
    );

    // 7. Initial Audit Log
    dbRun(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'log_init_system',
        orgId,
        'usr_admin',
        'SYSTEM_INITIALIZED',
        JSON.stringify({ message: 'Sistema RealizzeTravel Viagens inicializado com dados demonstrativos.' }),
        now,
      ]
    );
  });

  console.log('✅ Initial database seeded successfully with 5 users, 10 customers, 20 conversations, and messages.');
}
