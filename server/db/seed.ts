import bcrypt from 'bcryptjs';
import { dbGet, dbQuery, dbRun, dbTransaction } from './database';

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

    // Standardize user roles and labels: Admin, Supervisor, and Consultores 1 to 6
    dbRun("UPDATE users SET name = 'Carlos Santos (Administrador)', email = 'admin@realizzetravel.com.br' WHERE id = 'usr_admin'");
    dbRun("UPDATE users SET name = 'Renata Lima (Supervisora)', email = 'supervisor@realizzetravel.com.br' WHERE id = 'usr_supervisor'");
    dbRun("UPDATE users SET name = 'Consultor 1 (João Silva)', email = 'consultor1@realizzetravel.com.br' WHERE id = 'usr_joao'");
    dbRun("UPDATE users SET name = 'Consultor 2 (Maria Oliveira)', email = 'consultor2@realizzetravel.com.br' WHERE id = 'usr_maria'");
    dbRun("UPDATE users SET name = 'Consultor 3 (Pedro Souza)', email = 'consultor3@realizzetravel.com.br' WHERE id = 'usr_pedro'");
    dbRun("UPDATE users SET name = 'Consultor 4 (Ana Paula)', email = 'consultor4@realizzetravel.com.br' WHERE id = 'usr_anapaula'");

    const now = new Date().toISOString();

    // Clean any initial dummy whatsapp config if it still had the hardcoded dummy phone
    const currentWaRow = dbGet<{ value: string }>("SELECT value FROM settings WHERE key = 'whatsapp_config'");
    if (currentWaRow && currentWaRow.value && currentWaRow.value.includes('+55 81 99535-7254')) {
      try {
        const parsed = JSON.parse(currentWaRow.value);
        parsed.phoneConnected = null;
        parsed.status = 'DISCONNECTED';
        parsed.qrCodeBase64 = null;
        dbRun("UPDATE settings SET value = ? WHERE key = 'whatsapp_config'", [JSON.stringify(parsed)]);
      } catch {}
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
          providerType: 'QR_CODE',
          phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
          businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
          accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
          verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'viagens_whatsapp_verify_token_2026',
          instanceName: 'realizze-travel',
          gatewayUrl: '',
          apiKey: '',
          qrCodeBase64: null,
          phoneConnected: null,
          status: 'DISCONNECTED',
        }),
        now,
        now,
      ]
    );

    // 4. Initial Audit Log
    dbRun(
      `INSERT INTO audit_logs (id, organization_id, user_id, action, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'log_init_system',
        orgId,
        'usr_admin',
        'SYSTEM_INITIALIZED',
        JSON.stringify({ message: 'Sistema RealizzeTravel inicializado. Pronto para conexão do WhatsApp da agência.' }),
        now,
      ]
    );
  });

  console.log('✅ Initial database seeded cleanly with staff users and agency configuration.');
}
