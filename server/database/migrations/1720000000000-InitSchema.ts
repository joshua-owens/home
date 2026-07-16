import type { MigrationInterface, QueryRunner } from 'typeorm'

export class InitSchema1720000000000 implements MigrationInterface {
  name = 'InitSchema1720000000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE "users" (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, display_name TEXT NOT NULL, created_at TEXT NOT NULL)`)
    await q.query(`CREATE TABLE "household_settings" (id INTEGER PRIMARY KEY, region TEXT NOT NULL DEFAULT '', house_facts TEXT NOT NULL DEFAULT '')`)
    await q.query(`CREATE TABLE "projects" (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'idea', rank INTEGER NOT NULL DEFAULT 0, created_by INTEGER REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)
    await q.query(`CREATE TABLE "quotes" (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, company_name TEXT NOT NULL, contact_info TEXT NOT NULL DEFAULT '', amount REAL NOT NULL, scope_notes TEXT NOT NULL DEFAULT '', date_received TEXT, valid_until TEXT, status TEXT NOT NULL DEFAULT 'pending')`)
    await q.query(`CREATE TABLE "categories" (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE)`)
    await q.query(`CREATE TABLE "expenses" (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE, category_id INTEGER REFERENCES categories(id), amount REAL NOT NULL, date TEXT NOT NULL, vendor TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '')`)
    await q.query(`CREATE TABLE "inventory_items" (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, location TEXT NOT NULL DEFAULT '', brand TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '', serial TEXT NOT NULL DEFAULT '', purchase_date TEXT, warranty_expiry TEXT, notes TEXT NOT NULL DEFAULT '')`)
    await q.query(`CREATE TABLE "research_reports" (id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'pending', body TEXT NOT NULL DEFAULT '', error TEXT, model TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL)`)
    await q.query(`CREATE TABLE "attachments" (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_type TEXT NOT NULL, owner_id INTEGER NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, disk_path TEXT NOT NULL, created_at TEXT NOT NULL)`)
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of ['attachments', 'research_reports', 'inventory_items', 'expenses', 'categories', 'quotes', 'projects', 'household_settings', 'users'])
      await q.query(`DROP TABLE "${t}"`)
  }
}
