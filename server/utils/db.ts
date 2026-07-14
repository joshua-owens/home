import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import * as schema from '../database/schema'

export type Db = BetterSQLite3Database<typeof schema>

const DDL = `
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS household_settings (id INTEGER PRIMARY KEY, region TEXT NOT NULL DEFAULT '', house_facts TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'idea', rank INTEGER NOT NULL DEFAULT 0, created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS quotes (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, company_name TEXT NOT NULL, contact_info TEXT NOT NULL DEFAULT '', amount REAL NOT NULL, scope_notes TEXT NOT NULL DEFAULT '', date_received TEXT, valid_until TEXT, status TEXT NOT NULL DEFAULT 'pending');
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, category_id INTEGER REFERENCES categories(id), amount REAL NOT NULL, date TEXT NOT NULL, vendor TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS inventory_items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, location TEXT NOT NULL DEFAULT '', brand TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', serial TEXT NOT NULL DEFAULT '', purchase_date TEXT, warranty_expiry TEXT, notes TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS research_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'pending', body TEXT NOT NULL DEFAULT '', error TEXT, model TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attachments (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_type TEXT NOT NULL, owner_id INTEGER NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, disk_path TEXT NOT NULL, created_at TEXT NOT NULL);
`

const DEFAULT_CATEGORIES = ['maintenance', 'improvement', 'utilities', 'appliance', 'other']

export function createDb(path: string): Db {
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(DDL)
  const insert = sqlite.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)')
  for (const c of DEFAULT_CATEGORIES) insert.run(c)
  sqlite.prepare('INSERT OR IGNORE INTO household_settings (id) VALUES (1)').run()
  return drizzle(sqlite, { schema })
}

let _db: Db | null = null
export function useDb(): Db {
  if (!_db) {
    const dataDir = useRuntimeConfig().dataDir
    mkdirSync(join(dataDir, 'uploads'), { recursive: true })
    _db = createDb(join(dataDir, 'sqlite.db'))
  }
  return _db
}
