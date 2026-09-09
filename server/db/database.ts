import fs from 'fs';
import path from 'path';
import type { Database as SqlJsDatabase } from 'sql.js';
// @ts-ignore
import initSqlAsm from 'sql.js/dist/sql-asm.js';
import { SCHEMA_SQL } from './schema.constant';

let dbInstance: SqlJsDatabase | null = null;
const isVercel = process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const DATA_DIR = isVercel ? '/tmp/data' : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.sqlite');

export async function getDatabase(): Promise<SqlJsDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (dirErr) {
    console.warn('Notice creating DATA_DIR:', dirErr);
  }

  const initFn = typeof initSqlAsm === 'function' ? initSqlAsm : (initSqlAsm as any)?.default;
  const SQL = await initFn();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Error loading existing database file, creating fresh DB:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');

  // Run schema initialization (first check filesystem, then fallback to bundled SCHEMA_SQL)
  let schemaSql = '';
  const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    try {
      schemaSql = fs.readFileSync(schemaPath, 'utf8');
    } catch {
      schemaSql = SCHEMA_SQL;
    }
  } else {
    schemaSql = SCHEMA_SQL;
  }

  if (schemaSql) {
    dbInstance.run(schemaSql);
    try {
      dbInstance.run('ALTER TABLE customers ADD COLUMN avatar TEXT;');
    } catch {}
    try {
      dbInstance.run('ALTER TABLE conversations ADD COLUMN reminder_date TEXT;');
    } catch {}
    try {
      dbInstance.run('ALTER TABLE conversations ADD COLUMN reminder_note TEXT;');
    } catch {}
    try {
      dbInstance.run("ALTER TABLE conversations ADD COLUMN reminder_status TEXT DEFAULT 'PENDING';");
    } catch {}
    try {
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS whatsapp_groups (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          participant_count INTEGER DEFAULT 0,
          avatar TEXT,
          last_message TEXT,
          last_message_at TEXT NOT NULL,
          destination_focus TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        );
      `);
      dbInstance.run(`
        CREATE TABLE IF NOT EXISTS whatsapp_group_messages (
          id TEXT PRIMARY KEY,
          group_id TEXT NOT NULL,
          sender_name TEXT NOT NULL,
          sender_phone TEXT,
          content TEXT NOT NULL,
          is_from_agency INTEGER DEFAULT 0,
          media_url TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (group_id) REFERENCES whatsapp_groups(id) ON DELETE CASCADE
        );
      `);
    } catch {}
    saveDatabase();
  }

  return dbInstance;
}

let inTransaction = false;

export function saveDatabase(): void {
  if (!dbInstance || inTransaction) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}

export function dbQuery<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call getDatabase() first.');
  }

  const stmt = dbInstance.prepare(sql);
  try {
    stmt.bind(params);
    const results: T[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    return results;
  } finally {
    stmt.free();
  }
}

export function dbGet<T = any>(sql: string, params: any[] = []): T | null {
  const rows = dbQuery<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function dbRun(sql: string, params: any[] = []): { changes: number } {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call getDatabase() first.');
  }

  dbInstance.run(sql, params);
  const changes = dbInstance.getRowsModified();
  saveDatabase();
  return { changes };
}

export function dbTransaction<T>(fn: () => T): T {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call getDatabase() first.');
  }

  if (inTransaction) {
    return fn();
  }

  inTransaction = true;
  dbInstance.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    dbInstance.run('COMMIT;');
    inTransaction = false;
    saveDatabase();
    return result;
  } catch (err) {
    try {
      dbInstance.run('ROLLBACK;');
    } catch (rbErr) {
      console.error('Failed to rollback transaction:', rbErr);
    }
    inTransaction = false;
    throw err;
  }
}
