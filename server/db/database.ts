import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
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

  const SQL = await initSqlJs();

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
