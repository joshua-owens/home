# Home Projects & Expenses Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A self-hosted Nuxt 4 app for tracking homeowner projects, quotes, expenses, and inventory, with an OpenRouter-backed AI research report feature, deployed as one Docker container.

**Architecture:** Nuxt 4 monolith — Vue frontend (`app/`) plus Nitro server routes (`server/api/`). SQLite via Drizzle ORM on a `/data` volume, which also holds uploaded files. Session-cookie auth via `nuxt-auth-utils`. AI research runs server-side in a background promise with a DB-row lifecycle.

**Tech Stack:** Nuxt 4.x, Nuxt UI 4.x, Drizzle ORM + better-sqlite3, nuxt-auth-utils, OpenAI SDK (pointed at OpenRouter), Vitest.

## Global Constraints

- Nuxt **4.x** and Nuxt UI **4.x** (spec-pinned). Nuxt 4 layout: frontend in `app/`, server in `server/` at repo root.
- Spec: `docs/superpowers/specs/2026-07-11-home-projects-tracker-design.md`. Vocabulary: root `CONTEXT.md` — use **declined** (never "rejected"); **Backlog** = `idea`+`on_hold`, **Active** = `researching`+`quoting`+`in_progress`, each independently ranked.
- Data dir from env `DATA_DIR` (default `./data` in dev, `/data` in Docker): contains `sqlite.db` and `uploads/`.
- Env vars: `OPENROUTER_API_KEY`, `RESEARCH_MODEL`, `NUXT_SESSION_PASSWORD`, `DATA_DIR`.
- All `/api/**` routes except auth/setup routes require a session.
- Hard delete + confirmation everywhere EXCEPT quotes (declined, never deleted).
- Attachments: 25 MB max; mime allowlist `application/pdf`, `image/*`, `text/plain`.
- Project statuses: `idea`, `researching`, `quoting`, `in_progress`, `done`, `on_hold`. Transitions free-form.
- Quote statuses: `pending`, `accepted`, `declined`. "Expired" is derived (pending + past valid_until), never stored.
- Multiple accepted quotes allowed; expected cost = sum of accepted.
- Research: 5-minute timeout; startup sweep marks orphaned `pending` reports `failed`.
- TDD with Vitest for server logic. Commit after every green cycle.

---

### Task 1: Project scaffold

**Files:**
- Create: Nuxt 4 project at repo root (`nuxt.config.ts`, `app/app.vue`, `package.json`, `tsconfig.json`)
- Create: `vitest.config.ts`, `.gitignore`

**Interfaces:**
- Produces: a running `npm run dev` app and `npm test` harness all later tasks build on.

- [ ] **Step 1: Scaffold Nuxt 4**

```bash
npx nuxi@latest init . --packageManager npm --gitInit false
npm install
npx nuxi module add ui        # Nuxt UI 4.x
npx nuxi module add auth-utils # nuxt-auth-utils
npm install drizzle-orm better-sqlite3 openai
npm install -D drizzle-kit vitest @types/better-sqlite3
```

Verify `package.json` has `"nuxt": "^4..."` and `"@nuxt/ui": "^4..."`. If `nuxi init` refuses a non-empty dir, scaffold into `tmp-scaffold/`, move contents up (don't overwrite `docs/`, `CONTEXT.md`, `.git/`), delete `tmp-scaffold/`.

- [ ] **Step 2: Configure**

`nuxt.config.ts`:
```ts
export default defineNuxtConfig({
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    openrouterApiKey: '',       // NUXT_OPENROUTER_API_KEY
    researchModel: '',          // NUXT_RESEARCH_MODEL
    dataDir: './data',          // NUXT_DATA_DIR
  },
})
```

`app/assets/css/main.css`:
```css
@import "tailwindcss";
@import "@nuxt/ui";
```

`app/app.vue`:
```vue
<template>
  <UApp>
    <NuxtPage />
  </UApp>
</template>
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
})
```

Add to `package.json` scripts: `"test": "vitest run"`. Append `data/` and `.env` to `.gitignore`.

- [ ] **Step 3: Verify dev server boots**

Run: `npm run dev` — expect Nuxt 4.x banner and a page at http://localhost:3000 without errors. Stop it. Run `npm test` — expect "no test files found" (exit 0 with passWithNoTests; add `passWithNoTests: true` to vitest config).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold Nuxt 4 app with Nuxt UI, auth-utils, drizzle, vitest"
```

---

### Task 2: Database schema + db util

**Files:**
- Create: `server/database/schema.ts`, `server/utils/db.ts`, `drizzle.config.ts`
- Test: `tests/server/db.test.ts`

**Interfaces:**
- Produces: `useDb(): DrizzleDb` (better-sqlite3-backed, runs migrations on first use); exported Drizzle tables `users, householdSettings, projects, quotes, categories, expenses, inventoryItems, researchReports, attachments` and types `Project`, `Quote`, etc. via `$inferSelect`.
- Test-only: `useTestDb()` creating an in-memory db for unit tests.

- [ ] **Step 1: Write the failing test**

`tests/server/db.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createDb } from '../../server/utils/db'
import { projects, categories } from '../../server/database/schema'

describe('db', () => {
  it('creates schema and seeds default categories', () => {
    const db = createDb(':memory:')
    const cats = db.select().from(categories).all()
    expect(cats.map(c => c.name).sort()).toEqual(
      ['appliance', 'improvement', 'maintenance', 'other', 'utilities'])
    db.insert(projects).values({ name: 'Mini split', status: 'idea', rank: 1 }).run()
    expect(db.select().from(projects).all()).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` — Expected: FAIL, cannot resolve `server/utils/db`.

- [ ] **Step 3: Implement schema and db factory**

`server/database/schema.ts`:
```ts
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const householdSettings = sqliteTable('household_settings', {
  id: integer('id').primaryKey(), // singleton row id=1
  region: text('region').notNull().default(''),
  houseFacts: text('house_facts').notNull().default(''),
})

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  status: text('status', { enum: ['idea', 'researching', 'quoting', 'in_progress', 'done', 'on_hold'] }).notNull().default('idea'),
  rank: integer('rank').notNull().default(0), // position within its list (Backlog or Active)
  createdBy: integer('created_by').references(() => users.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const quotes = sqliteTable('quotes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  contactInfo: text('contact_info').notNull().default(''),
  amount: real('amount').notNull(),
  scopeNotes: text('scope_notes').notNull().default(''),
  dateReceived: text('date_received'),
  validUntil: text('valid_until'),
  status: text('status', { enum: ['pending', 'accepted', 'declined'] }).notNull().default('pending'),
})

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
})

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }), // null = general home expense
  categoryId: integer('category_id').references(() => categories.id),
  amount: real('amount').notNull(),
  date: text('date').notNull(),
  vendor: text('vendor').notNull().default(''),
  note: text('note').notNull().default(''),
})

export const inventoryItems = sqliteTable('inventory_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  location: text('location').notNull().default(''),
  brand: text('brand').notNull().default(''),
  model: text('model').notNull().default(''),
  serial: text('serial').notNull().default(''),
  purchaseDate: text('purchase_date'),
  warrantyExpiry: text('warranty_expiry'),
  notes: text('notes').notNull().default(''),
})

export const researchReports = sqliteTable('research_reports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['pending', 'complete', 'failed'] }).notNull().default('pending'),
  body: text('body').notNull().default(''),
  error: text('error'),
  model: text('model').notNull().default(''),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const attachments = sqliteTable('attachments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ownerType: text('owner_type', { enum: ['project', 'quote', 'expense', 'inventory_item'] }).notNull(),
  ownerId: integer('owner_id').notNull(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  diskPath: text('disk_path').notNull(), // relative to DATA_DIR/uploads
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export type Project = typeof projects.$inferSelect
export type Quote = typeof quotes.$inferSelect
export type Expense = typeof expenses.$inferSelect
export type InventoryItem = typeof inventoryItems.$inferSelect
export type ResearchReport = typeof researchReports.$inferSelect
export type Attachment = typeof attachments.$inferSelect
export type User = typeof users.$inferSelect
```

`server/utils/db.ts`:
```ts
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
```

Note: `createDb` is pure (testable without Nuxt); only `useDb` touches `useRuntimeConfig`. Keep DDL and Drizzle schema in sync by hand — one schema, no drizzle-kit migrations needed at this scale (drizzle-kit stays available for future use).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` — Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add server tests drizzle.config.ts 2>/dev/null; git add -A && git commit -m "feat: database schema, db factory with seeded categories"
```

---

### Task 3: Auth — first-run setup, login, session guard

**Files:**
- Create: `server/api/auth/setup.post.ts`, `server/api/auth/login.post.ts`, `server/api/auth/logout.post.ts`, `server/api/auth/status.get.ts`
- Create: `server/middleware/auth.ts`
- Create: `server/utils/users.ts`
- Test: `tests/server/users.test.ts`

**Interfaces:**
- Consumes: `createDb`/`useDb`, `users` table (Task 2). `nuxt-auth-utils` provides `hashPassword`, `verifyPassword`, `setUserSession`, `requireUserSession`, `getUserSession`.
- Produces: `createUser(db, { username, password, displayName }): Promise<User>`, `authenticate(db, username, password): Promise<User | null>`, `countUsers(db): number`. Session user shape: `{ id: number, username: string, displayName: string }`. Routes: `POST /api/auth/setup` (only when 0 users), `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/status → { needsSetup: boolean, loggedIn: boolean }`.

- [ ] **Step 1: Write the failing test**

`tests/server/users.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createDb } from '../../server/utils/db'
import { createUser, authenticate, countUsers } from '../../server/utils/users'

describe('users', () => {
  it('creates a user and authenticates with correct password only', async () => {
    const db = createDb(':memory:')
    expect(countUsers(db)).toBe(0)
    const u = await createUser(db, { username: 'jess', password: 'hunter22', displayName: 'Jess' })
    expect(u.username).toBe('jess')
    expect(u.passwordHash).not.toContain('hunter22')
    expect(countUsers(db)).toBe(1)
    expect(await authenticate(db, 'jess', 'hunter22')).toMatchObject({ username: 'jess' })
    expect(await authenticate(db, 'jess', 'wrong')).toBeNull()
    expect(await authenticate(db, 'nobody', 'x')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` — Expected: FAIL, `server/utils/users` not found.

- [ ] **Step 3: Implement users util**

`server/utils/users.ts` — use `scrypt` from `node:crypto` directly so the util is testable outside Nitro (nuxt-auth-utils' `hashPassword` is only available in Nitro context):
```ts
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { users, type User } from '../database/schema'
import type { Db } from './db'

export function hashPw(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

export function verifyPw(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex'))
}

export async function createUser(db: Db, input: { username: string; password: string; displayName: string }): Promise<User> {
  const [u] = db.insert(users).values({
    username: input.username.trim().toLowerCase(),
    passwordHash: hashPw(input.password),
    displayName: input.displayName,
  }).returning().all()
  return u!
}

export async function authenticate(db: Db, username: string, password: string): Promise<User | null> {
  const u = db.select().from(users).where(eq(users.username, username.trim().toLowerCase())).get()
  if (!u || !verifyPw(password, u.passwordHash)) return null
  return u
}

export function countUsers(db: Db): number {
  return db.select().from(users).all().length
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Add routes and guard middleware**

`server/middleware/auth.ts`:
```ts
export default defineEventHandler(async (event) => {
  const path = event.path
  if (!path.startsWith('/api/')) return
  if (path.startsWith('/api/auth/')) return
  const session = await getUserSession(event)
  if (!session.user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
})
```

`server/api/auth/status.get.ts`:
```ts
import { countUsers } from '../../utils/users'
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  return { needsSetup: countUsers(useDb()) === 0, loggedIn: !!session.user }
})
```

`server/api/auth/setup.post.ts`:
```ts
import { countUsers, createUser } from '../../utils/users'
export default defineEventHandler(async (event) => {
  const db = useDb()
  if (countUsers(db) > 0) throw createError({ statusCode: 403, statusMessage: 'Setup already completed' })
  const body = await readBody<{ username: string; password: string; displayName: string }>(event)
  if (!body?.username || !body?.password || body.password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Username and password (min 8 chars) required' })
  const u = await createUser(db, { ...body, displayName: body.displayName || body.username })
  await setUserSession(event, { user: { id: u.id, username: u.username, displayName: u.displayName } })
  return { ok: true }
})
```

`server/api/auth/login.post.ts`:
```ts
import { authenticate } from '../../utils/users'
export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string }>(event)
  const u = await authenticate(useDb(), body?.username ?? '', body?.password ?? '')
  if (!u) throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  await setUserSession(event, { user: { id: u.id, username: u.username, displayName: u.displayName } })
  return { ok: true }
})
```

`server/api/auth/logout.post.ts`:
```ts
export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { ok: true }
})
```

- [ ] **Step 6: Verify manually**

Set `NUXT_SESSION_PASSWORD` (32+ chars) in `.env`. Run `npm run dev`, then:
```bash
curl -s http://localhost:3000/api/auth/status          # {"needsSetup":true,"loggedIn":false}
curl -s -X POST http://localhost:3000/api/auth/setup -H 'content-type: application/json' -d '{"username":"me","password":"password123","displayName":"Me"}'   # {"ok":true}
curl -s http://localhost:3000/api/projects              # 401 (guard works; route doesn't exist yet but guard fires first)
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: auth with first-run setup, login/logout, API session guard"
```

---

### Task 4: Projects CRUD + Backlog/Active ranking

**Files:**
- Create: `server/utils/projects.ts`
- Create: `server/api/projects/index.get.ts`, `server/api/projects/index.post.ts`, `server/api/projects/[id].get.ts`, `server/api/projects/[id].patch.ts`, `server/api/projects/[id].delete.ts`, `server/api/projects/reorder.post.ts`
- Test: `tests/server/projects.test.ts`

**Interfaces:**
- Consumes: `createDb`/`useDb`, `projects` table.
- Produces: `listId(status): 'backlog' | 'active' | 'done'` (backlog = idea/on_hold; active = researching/quoting/in_progress); `createProject(db, input): Project` (appends to bottom of its list); `updateProject(db, id, patch): Project` (status change across lists re-appends to bottom of target list); `reorderList(db, list: 'backlog'|'active', orderedIds: number[]): void`; `deleteProject(db, id): void` (cascades via FK; attachment file cleanup added in Task 7). Routes mirror these; `GET /api/projects` returns `{ backlog: Project[], active: Project[], done: Project[] }` each rank-ordered.

- [ ] **Step 1: Write the failing test**

`tests/server/projects.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createDb } from '../../server/utils/db'
import { createProject, updateProject, reorderList, listProjects, listId } from '../../server/utils/projects'

describe('projects ranking', () => {
  it('maps statuses to lists', () => {
    expect(listId('idea')).toBe('backlog')
    expect(listId('on_hold')).toBe('backlog')
    expect(listId('researching')).toBe('active')
    expect(listId('quoting')).toBe('active')
    expect(listId('in_progress')).toBe('active')
    expect(listId('done')).toBe('done')
  })

  it('appends new projects to the bottom of their list', () => {
    const db = createDb(':memory:')
    const a = createProject(db, { name: 'A', status: 'idea' })
    const b = createProject(db, { name: 'B', status: 'idea' })
    expect(b.rank).toBeGreaterThan(a.rank)
  })

  it('moving Backlog→Active appends to bottom of Active', () => {
    const db = createDb(':memory:')
    const active1 = createProject(db, { name: 'Active1', status: 'quoting' })
    const idea = createProject(db, { name: 'Idea', status: 'idea' })
    const moved = updateProject(db, idea.id, { status: 'researching' })
    expect(moved.rank).toBeGreaterThan(active1.rank)
    const { active } = listProjects(db)
    expect(active.map(p => p.name)).toEqual(['Active1', 'Idea'])
  })

  it('reorders a list without touching the other', () => {
    const db = createDb(':memory:')
    const i1 = createProject(db, { name: 'I1', status: 'idea' })
    const i2 = createProject(db, { name: 'I2', status: 'idea' })
    const a1 = createProject(db, { name: 'A1', status: 'in_progress' })
    reorderList(db, 'backlog', [i2.id, i1.id])
    const lists = listProjects(db)
    expect(lists.backlog.map(p => p.name)).toEqual(['I2', 'I1'])
    expect(lists.active.map(p => p.name)).toEqual(['A1'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` — Expected: FAIL, `server/utils/projects` not found.

- [ ] **Step 3: Implement projects util**

`server/utils/projects.ts`:
```ts
import { eq, inArray, asc } from 'drizzle-orm'
import { projects, type Project } from '../database/schema'
import type { Db } from './db'

export type ProjectStatus = Project['status']
export type ListName = 'backlog' | 'active' | 'done'

const LIST_STATUSES: Record<ListName, ProjectStatus[]> = {
  backlog: ['idea', 'on_hold'],
  active: ['researching', 'quoting', 'in_progress'],
  done: ['done'],
}

export function listId(status: ProjectStatus): ListName {
  if (LIST_STATUSES.backlog.includes(status)) return 'backlog'
  if (LIST_STATUSES.active.includes(status)) return 'active'
  return 'done'
}

function nextRank(db: Db, list: ListName): number {
  const rows = db.select({ rank: projects.rank }).from(projects)
    .where(inArray(projects.status, LIST_STATUSES[list])).all()
  return rows.length ? Math.max(...rows.map(r => r.rank)) + 1 : 1
}

export function createProject(db: Db, input: { name: string; description?: string; status?: ProjectStatus; createdBy?: number }): Project {
  const status = input.status ?? 'idea'
  const [p] = db.insert(projects).values({
    name: input.name,
    description: input.description ?? '',
    status,
    rank: nextRank(db, listId(status)),
    createdBy: input.createdBy,
  }).returning().all()
  return p!
}

export function updateProject(db: Db, id: number, patch: Partial<Pick<Project, 'name' | 'description' | 'status'>>): Project {
  const existing = db.select().from(projects).where(eq(projects.id, id)).get()
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  let rank = existing.rank
  if (patch.status && listId(patch.status) !== listId(existing.status))
    rank = nextRank(db, listId(patch.status))
  const [p] = db.update(projects)
    .set({ ...patch, rank, updatedAt: new Date().toISOString() })
    .where(eq(projects.id, id)).returning().all()
  return p!
}

export function reorderList(db: Db, list: Exclude<ListName, 'done'>, orderedIds: number[]): void {
  orderedIds.forEach((id, i) => {
    db.update(projects).set({ rank: i + 1 }).where(eq(projects.id, id)).run()
  })
}

export function listProjects(db: Db): Record<ListName, Project[]> {
  const all = db.select().from(projects).orderBy(asc(projects.rank)).all()
  return {
    backlog: all.filter(p => listId(p.status) === 'backlog'),
    active: all.filter(p => listId(p.status) === 'active'),
    done: all.filter(p => listId(p.status) === 'done'),
  }
}

export function deleteProject(db: Db, id: number): void {
  db.delete(projects).where(eq(projects.id, id)).run()
}
```

`createError` is auto-imported in Nitro but not in Vitest — add a tiny guard at top of the file:
```ts
const createError = globalThis.createError ?? ((e: any) => Object.assign(new Error(e.statusMessage), e))
```
(Place above the functions; keep the Nitro version when available.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` — Expected: PASS (all projects tests green).

- [ ] **Step 5: Add API routes**

`server/api/projects/index.get.ts`:
```ts
import { listProjects } from '../../utils/projects'
export default defineEventHandler(() => listProjects(useDb()))
```

`server/api/projects/index.post.ts`:
```ts
import { createProject } from '../../utils/projects'
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.name) throw createError({ statusCode: 400, statusMessage: 'Name required' })
  const session = await getUserSession(event)
  return createProject(useDb(), { ...body, createdBy: (session.user as any)?.id })
})
```

`server/api/projects/[id].get.ts`:
```ts
import { eq } from 'drizzle-orm'
import { projects } from '../../database/schema'
export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  const p = useDb().select().from(projects).where(eq(projects.id, id)).get()
  if (!p) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  return p
})
```

`server/api/projects/[id].patch.ts`:
```ts
import { updateProject } from '../../utils/projects'
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  return updateProject(useDb(), id, await readBody(event))
})
```

`server/api/projects/[id].delete.ts`:
```ts
import { deleteProject } from '../../utils/projects'
export default defineEventHandler((event) => {
  deleteProject(useDb(), Number(getRouterParam(event, 'id')))
  return { ok: true }
})
```

`server/api/projects/reorder.post.ts`:
```ts
import { reorderList } from '../../utils/projects'
export default defineEventHandler(async (event) => {
  const body = await readBody<{ list: 'backlog' | 'active'; orderedIds: number[] }>(event)
  if (!body?.list || !Array.isArray(body.orderedIds))
    throw createError({ statusCode: 400, statusMessage: 'list and orderedIds required' })
  reorderList(useDb(), body.list, body.orderedIds)
  return { ok: true }
})
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: projects CRUD with independent backlog/active ranking"
```

---

### Task 5: Quotes CRUD + derived expiry

**Files:**
- Create: `server/utils/quotes.ts`
- Create: `server/api/projects/[id]/quotes.get.ts`, `server/api/quotes/index.post.ts`, `server/api/quotes/[id].patch.ts`
- Test: `tests/server/quotes.test.ts`

**Interfaces:**
- Consumes: `quotes` table, project routes (Task 4).
- Produces: `isExpired(quote, now?: Date): boolean` (pending + validUntil past); `acceptedTotal(db, projectId): number`; quote CRUD via routes. **No DELETE route for quotes — deliberate.** `GET /api/projects/:id/quotes?includeDeclined=true` returns quotes each decorated with `expired: boolean`; declined excluded by default.

- [ ] **Step 1: Write the failing test**

`tests/server/quotes.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createDb } from '../../server/utils/db'
import { createProject } from '../../server/utils/projects'
import { isExpired, acceptedTotal, listQuotes, createQuote, updateQuote } from '../../server/utils/quotes'

describe('quotes', () => {
  const now = new Date('2026-07-12T00:00:00Z')

  it('derives expiry only for pending quotes past valid-until', () => {
    expect(isExpired({ status: 'pending', validUntil: '2026-07-01' } as any, now)).toBe(true)
    expect(isExpired({ status: 'pending', validUntil: '2026-08-01' } as any, now)).toBe(false)
    expect(isExpired({ status: 'accepted', validUntil: '2026-07-01' } as any, now)).toBe(false)
    expect(isExpired({ status: 'pending', validUntil: null } as any, now)).toBe(false)
  })

  it('sums accepted quotes; hides declined by default but keeps them revivable', () => {
    const db = createDb(':memory:')
    const p = createProject(db, { name: 'Mini split' })
    const q1 = createQuote(db, { projectId: p.id, companyName: 'HVAC Co', amount: 8000 })
    const q2 = createQuote(db, { projectId: p.id, companyName: 'Sparky', amount: 1500 })
    const q3 = createQuote(db, { projectId: p.id, companyName: 'Overpriced Inc', amount: 15000 })
    updateQuote(db, q1.id, { status: 'accepted' })
    updateQuote(db, q2.id, { status: 'accepted' })
    updateQuote(db, q3.id, { status: 'declined' })
    expect(acceptedTotal(db, p.id)).toBe(9500)
    expect(listQuotes(db, p.id).map(q => q.companyName)).toEqual(['HVAC Co', 'Sparky'])
    expect(listQuotes(db, p.id, { includeDeclined: true })).toHaveLength(3)
    const revived = updateQuote(db, q3.id, { status: 'pending' })
    expect(revived.status).toBe('pending')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` — Expected: FAIL, `server/utils/quotes` not found.

- [ ] **Step 3: Implement quotes util**

`server/utils/quotes.ts`:
```ts
import { eq, and, ne } from 'drizzle-orm'
import { quotes, type Quote } from '../database/schema'
import type { Db } from './db'

export function isExpired(q: Pick<Quote, 'status' | 'validUntil'>, now = new Date()): boolean {
  return q.status === 'pending' && !!q.validUntil && new Date(q.validUntil) < now
}

export function createQuote(db: Db, input: { projectId: number; companyName: string; amount: number; contactInfo?: string; scopeNotes?: string; dateReceived?: string; validUntil?: string }): Quote {
  const [q] = db.insert(quotes).values(input).returning().all()
  return q!
}

export function updateQuote(db: Db, id: number, patch: Partial<Omit<Quote, 'id' | 'projectId'>>): Quote {
  const [q] = db.update(quotes).set(patch).where(eq(quotes.id, id)).returning().all()
  if (!q) throw createError({ statusCode: 404, statusMessage: 'Quote not found' })
  return q
}

export function listQuotes(db: Db, projectId: number, opts: { includeDeclined?: boolean } = {}): (Quote & { expired: boolean })[] {
  const where = opts.includeDeclined
    ? eq(quotes.projectId, projectId)
    : and(eq(quotes.projectId, projectId), ne(quotes.status, 'declined'))
  return db.select().from(quotes).where(where).all().map(q => ({ ...q, expired: isExpired(q) }))
}

export function acceptedTotal(db: Db, projectId: number): number {
  return db.select().from(quotes)
    .where(and(eq(quotes.projectId, projectId), eq(quotes.status, 'accepted')))
    .all().reduce((sum, q) => sum + q.amount, 0)
}

const createError = globalThis.createError ?? ((e: any) => Object.assign(new Error(e.statusMessage), e))
```

(Hoist the `createError` guard above `updateQuote` — same pattern as Task 4.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Add routes**

`server/api/projects/[id]/quotes.get.ts`:
```ts
import { listQuotes } from '../../../utils/quotes'
export default defineEventHandler((event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  const includeDeclined = getQuery(event).includeDeclined === 'true'
  return listQuotes(useDb(), projectId, { includeDeclined })
})
```

`server/api/quotes/index.post.ts`:
```ts
import { createQuote } from '../../utils/quotes'
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.projectId || !body?.companyName || typeof body.amount !== 'number')
    throw createError({ statusCode: 400, statusMessage: 'projectId, companyName, amount required' })
  return createQuote(useDb(), body)
})
```

`server/api/quotes/[id].patch.ts`:
```ts
import { updateQuote } from '../../utils/quotes'
export default defineEventHandler(async (event) =>
  updateQuote(useDb(), Number(getRouterParam(event, 'id')), await readBody(event)))
```

Do NOT create `server/api/quotes/[id].delete.ts` — quotes are declined, never deleted (spec).

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: quotes with derived expiry, declined-not-deleted, accepted totals"
```

---

### Task 6: Expenses + categories, inventory, household settings

**Files:**
- Create: `server/utils/expenses.ts`
- Create: `server/api/expenses/index.get.ts`, `server/api/expenses/index.post.ts`, `server/api/expenses/[id].patch.ts`, `server/api/expenses/[id].delete.ts`
- Create: `server/api/categories/index.get.ts`, `server/api/categories/index.post.ts`
- Create: `server/api/inventory/index.get.ts`, `server/api/inventory/index.post.ts`, `server/api/inventory/[id].patch.ts`, `server/api/inventory/[id].delete.ts`
- Create: `server/api/settings.get.ts`, `server/api/settings.patch.ts`
- Test: `tests/server/expenses.test.ts`

**Interfaces:**
- Consumes: tables from Task 2, `acceptedTotal` (Task 5).
- Produces: `listExpenses(db, filter?: { projectId?, categoryId?, from?, to? }): Expense[]`; `expenseTotal(db, filter?): number`; `projectSpend(db, projectId): { spent: number, quoted: number }` (quoted = `acceptedTotal`). Routes: expenses CRUD (`GET /api/expenses` accepts `projectId`, `categoryId`, `from`, `to` query params), categories list/create, inventory CRUD, `GET/PATCH /api/settings` (singleton HouseholdSettings row id=1, fields `region`, `houseFacts`).

- [ ] **Step 1: Write the failing test**

`tests/server/expenses.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createDb } from '../../server/utils/db'
import { createProject } from '../../server/utils/projects'
import { createQuote, updateQuote } from '../../server/utils/quotes'
import { createExpense, listExpenses, expenseTotal, projectSpend } from '../../server/utils/expenses'

describe('expenses', () => {
  it('filters by project/date and totals; computes project spend vs quoted', () => {
    const db = createDb(':memory:')
    const p = createProject(db, { name: 'Mini split' })
    const q = createQuote(db, { projectId: p.id, companyName: 'HVAC Co', amount: 8000 })
    updateQuote(db, q.id, { status: 'accepted' })
    createExpense(db, { projectId: p.id, amount: 4000, date: '2026-07-01', vendor: 'HVAC Co' })
    createExpense(db, { projectId: p.id, amount: 30, date: '2026-07-10', vendor: 'Hardware store' })
    createExpense(db, { amount: 120, date: '2026-07-05', vendor: 'Utility' }) // standalone
    expect(listExpenses(db)).toHaveLength(3)
    expect(listExpenses(db, { projectId: p.id })).toHaveLength(2)
    expect(listExpenses(db, { from: '2026-07-04', to: '2026-07-11' })).toHaveLength(2)
    expect(expenseTotal(db, { projectId: p.id })).toBe(4030)
    expect(projectSpend(db, p.id)).toEqual({ spent: 4030, quoted: 8000 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` — Expected: FAIL, `server/utils/expenses` not found.

- [ ] **Step 3: Implement expenses util**

`server/utils/expenses.ts`:
```ts
import { eq, and, gte, lte, type SQL } from 'drizzle-orm'
import { expenses, type Expense } from '../database/schema'
import { acceptedTotal } from './quotes'
import type { Db } from './db'

export type ExpenseFilter = { projectId?: number; categoryId?: number; from?: string; to?: string }

function whereClause(filter: ExpenseFilter): SQL | undefined {
  const conds: SQL[] = []
  if (filter.projectId !== undefined) conds.push(eq(expenses.projectId, filter.projectId))
  if (filter.categoryId !== undefined) conds.push(eq(expenses.categoryId, filter.categoryId))
  if (filter.from) conds.push(gte(expenses.date, filter.from))
  if (filter.to) conds.push(lte(expenses.date, filter.to))
  return conds.length ? and(...conds) : undefined
}

export function createExpense(db: Db, input: { projectId?: number; categoryId?: number; amount: number; date: string; vendor?: string; note?: string }): Expense {
  const [e] = db.insert(expenses).values(input).returning().all()
  return e!
}

export function listExpenses(db: Db, filter: ExpenseFilter = {}): Expense[] {
  const w = whereClause(filter)
  const q = db.select().from(expenses)
  return (w ? q.where(w) : q).all()
}

export function expenseTotal(db: Db, filter: ExpenseFilter = {}): number {
  return listExpenses(db, filter).reduce((s, e) => s + e.amount, 0)
}

export function projectSpend(db: Db, projectId: number): { spent: number; quoted: number } {
  return { spent: expenseTotal(db, { projectId }), quoted: acceptedTotal(db, projectId) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Add routes (expenses, categories, inventory, settings)**

`server/api/expenses/index.get.ts`:
```ts
import { listExpenses } from '../../utils/expenses'
export default defineEventHandler((event) => {
  const q = getQuery(event)
  return listExpenses(useDb(), {
    projectId: q.projectId ? Number(q.projectId) : undefined,
    categoryId: q.categoryId ? Number(q.categoryId) : undefined,
    from: q.from as string | undefined,
    to: q.to as string | undefined,
  })
})
```

`server/api/expenses/index.post.ts`:
```ts
import { createExpense } from '../../utils/expenses'
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (typeof body?.amount !== 'number' || !body?.date)
    throw createError({ statusCode: 400, statusMessage: 'amount and date required' })
  return createExpense(useDb(), body)
})
```

`server/api/expenses/[id].patch.ts`:
```ts
import { eq } from 'drizzle-orm'
import { expenses } from '../../database/schema'
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const [e] = useDb().update(expenses).set(await readBody(event)).where(eq(expenses.id, id)).returning().all()
  if (!e) throw createError({ statusCode: 404, statusMessage: 'Expense not found' })
  return e
})
```

`server/api/expenses/[id].delete.ts`:
```ts
import { eq } from 'drizzle-orm'
import { expenses } from '../../database/schema'
export default defineEventHandler((event) => {
  useDb().delete(expenses).where(eq(expenses.id, Number(getRouterParam(event, 'id')))).run()
  return { ok: true }
})
```

`server/api/categories/index.get.ts`:
```ts
import { categories } from '../../database/schema'
export default defineEventHandler(() => useDb().select().from(categories).all())
```

`server/api/categories/index.post.ts`:
```ts
import { categories } from '../../database/schema'
export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string }>(event)
  if (!body?.name?.trim()) throw createError({ statusCode: 400, statusMessage: 'name required' })
  const [c] = useDb().insert(categories).values({ name: body.name.trim().toLowerCase() }).returning().all()
  return c
})
```

Inventory routes follow the identical CRUD pattern on `inventoryItems` (`server/api/inventory/index.get.ts` returns all rows; `index.post.ts` requires `name`; `[id].patch.ts` and `[id].delete.ts` mirror the expense routes with `inventoryItems` substituted — copy those two files and swap the table import and error message to 'Inventory item not found').

`server/api/settings.get.ts`:
```ts
import { eq } from 'drizzle-orm'
import { householdSettings } from '../database/schema'
export default defineEventHandler(() =>
  useDb().select().from(householdSettings).where(eq(householdSettings.id, 1)).get())
```

`server/api/settings.patch.ts`:
```ts
import { eq } from 'drizzle-orm'
import { householdSettings } from '../database/schema'
export default defineEventHandler(async (event) => {
  const body = await readBody<{ region?: string; houseFacts?: string }>(event)
  const [s] = useDb().update(householdSettings)
    .set({ region: body.region ?? '', houseFacts: body.houseFacts ?? '' })
    .where(eq(householdSettings.id, 1)).returning().all()
  return s
})
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: expenses with filters/totals, categories, inventory, household settings"
```

---

### Task 7: Attachments (upload, download, delete, cascade cleanup)

**Files:**
- Create: `server/utils/attachments.ts`
- Create: `server/api/attachments/index.post.ts`, `server/api/attachments/[id].get.ts`, `server/api/attachments/[id].delete.ts`, `server/api/attachments/index.get.ts`
- Modify: `server/utils/projects.ts` (deleteProject also removes attachment files), `server/api/expenses/[id].delete.ts`, inventory delete route (same)
- Test: `tests/server/attachments.test.ts`

**Interfaces:**
- Consumes: `attachments` table; `DATA_DIR/uploads` layout from Task 2.
- Produces: `validateUpload(filename, mimeType, size): string | null` (returns error message or null; 25 MB cap; allow `application/pdf`, `image/*`, `text/plain`); `saveAttachment(db, uploadsDir, { ownerType, ownerId, filename, mimeType, data: Buffer }): Attachment`; `deleteAttachmentsFor(db, uploadsDir, ownerType, ownerId): void` (removes rows AND files); `deleteAttachment(db, uploadsDir, id): void`. Route `POST /api/attachments` takes multipart form data (fields: `ownerType`, `ownerId`, file); `GET /api/attachments?ownerType=quote&ownerId=5` lists; `GET /api/attachments/:id` streams the file with content-type.

- [ ] **Step 1: Write the failing test**

`tests/server/attachments.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDb } from '../../server/utils/db'
import { validateUpload, saveAttachment, deleteAttachmentsFor, listAttachments } from '../../server/utils/attachments'

describe('attachments', () => {
  it('validates size and mime type', () => {
    expect(validateUpload('a.pdf', 'application/pdf', 1000)).toBeNull()
    expect(validateUpload('a.png', 'image/png', 1000)).toBeNull()
    expect(validateUpload('a.exe', 'application/x-msdownload', 1000)).toMatch(/type/i)
    expect(validateUpload('a.pdf', 'application/pdf', 26 * 1024 * 1024)).toMatch(/25 MB/i)
  })

  it('saves file to disk and removes files on owner cleanup', () => {
    const db = createDb(':memory:')
    const dir = mkdtempSync(join(tmpdir(), 'uploads-'))
    const a = saveAttachment(db, dir, { ownerType: 'quote', ownerId: 1, filename: 'quote.pdf', mimeType: 'application/pdf', data: Buffer.from('pdf!') })
    expect(existsSync(join(dir, a.diskPath))).toBe(true)
    expect(listAttachments(db, 'quote', 1)).toHaveLength(1)
    deleteAttachmentsFor(db, dir, 'quote', 1)
    expect(existsSync(join(dir, a.diskPath))).toBe(false)
    expect(listAttachments(db, 'quote', 1)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement attachments util**

`server/utils/attachments.ts`:
```ts
import { randomUUID } from 'node:crypto'
import { writeFileSync, rmSync } from 'node:fs'
import { join, extname } from 'node:path'
import { eq, and } from 'drizzle-orm'
import { attachments, type Attachment } from '../database/schema'
import type { Db } from './db'

const MAX_SIZE = 25 * 1024 * 1024
const ALLOWED = (m: string) => m === 'application/pdf' || m === 'text/plain' || m.startsWith('image/')
export type OwnerType = Attachment['ownerType']

export function validateUpload(filename: string, mimeType: string, size: number): string | null {
  if (!ALLOWED(mimeType)) return `File type ${mimeType} not allowed (pdf, images, txt only)`
  if (size > MAX_SIZE) return 'File exceeds 25 MB limit'
  return null
}

export function saveAttachment(db: Db, uploadsDir: string, input: { ownerType: OwnerType; ownerId: number; filename: string; mimeType: string; data: Buffer }): Attachment {
  const diskPath = `${randomUUID()}${extname(input.filename)}`
  writeFileSync(join(uploadsDir, diskPath), input.data)
  const [a] = db.insert(attachments).values({
    ownerType: input.ownerType, ownerId: input.ownerId,
    filename: input.filename, mimeType: input.mimeType,
    size: input.data.length, diskPath,
  }).returning().all()
  return a!
}

export function listAttachments(db: Db, ownerType: OwnerType, ownerId: number): Attachment[] {
  return db.select().from(attachments)
    .where(and(eq(attachments.ownerType, ownerType), eq(attachments.ownerId, ownerId))).all()
}

export function deleteAttachment(db: Db, uploadsDir: string, id: number): void {
  const a = db.select().from(attachments).where(eq(attachments.id, id)).get()
  if (!a) return
  rmSync(join(uploadsDir, a.diskPath), { force: true })
  db.delete(attachments).where(eq(attachments.id, id)).run()
}

export function deleteAttachmentsFor(db: Db, uploadsDir: string, ownerType: OwnerType, ownerId: number): void {
  for (const a of listAttachments(db, ownerType, ownerId)) deleteAttachment(db, uploadsDir, a.id)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Add routes and wire cascade cleanup**

Add `server/utils/uploads.ts`:
```ts
import { join } from 'node:path'
export function uploadsDir(): string {
  return join(useRuntimeConfig().dataDir, 'uploads')
}
```

`server/api/attachments/index.post.ts`:
```ts
import { validateUpload, saveAttachment, type OwnerType } from '../../utils/attachments'
import { uploadsDir } from '../../utils/uploads'
export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, statusMessage: 'multipart form required' })
  const field = (n: string) => form.find(f => f.name === n)?.data.toString()
  const file = form.find(f => f.name === 'file')
  if (!file?.filename) throw createError({ statusCode: 400, statusMessage: 'file required' })
  const ownerType = field('ownerType') as OwnerType
  const ownerId = Number(field('ownerId'))
  const mimeType = file.type ?? 'application/octet-stream'
  const err = validateUpload(file.filename, mimeType, file.data.length)
  if (err) throw createError({ statusCode: 400, statusMessage: err })
  return saveAttachment(useDb(), uploadsDir(), { ownerType, ownerId, filename: file.filename, mimeType, data: file.data })
})
```

`server/api/attachments/index.get.ts`:
```ts
import { listAttachments, type OwnerType } from '../../utils/attachments'
export default defineEventHandler((event) => {
  const q = getQuery(event)
  return listAttachments(useDb(), q.ownerType as OwnerType, Number(q.ownerId))
})
```

`server/api/attachments/[id].get.ts`:
```ts
import { eq } from 'drizzle-orm'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { attachments } from '../../database/schema'
import { uploadsDir } from '../../utils/uploads'
export default defineEventHandler((event) => {
  const a = useDb().select().from(attachments)
    .where(eq(attachments.id, Number(getRouterParam(event, 'id')))).get()
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  setHeader(event, 'content-type', a.mimeType)
  setHeader(event, 'content-disposition', `inline; filename="${a.filename.replace(/"/g, '')}"`)
  return sendStream(event, createReadStream(join(uploadsDir(), a.diskPath)))
})
```

`server/api/attachments/[id].delete.ts`:
```ts
import { deleteAttachment } from '../../utils/attachments'
import { uploadsDir } from '../../utils/uploads'
export default defineEventHandler((event) => {
  deleteAttachment(useDb(), uploadsDir(), Number(getRouterParam(event, 'id')))
  return { ok: true }
})
```

Wire cascade file cleanup — in `server/api/projects/[id].delete.ts`, before `deleteProject`, delete attachment files for the project, its quotes, and its expenses:
```ts
import { eq } from 'drizzle-orm'
import { deleteProject } from '../../utils/projects'
import { deleteAttachmentsFor } from '../../utils/attachments'
import { uploadsDir } from '../../utils/uploads'
import { quotes, expenses } from '../../database/schema'
export default defineEventHandler((event) => {
  const db = useDb(); const dir = uploadsDir()
  const id = Number(getRouterParam(event, 'id'))
  for (const q of db.select().from(quotes).where(eq(quotes.projectId, id)).all())
    deleteAttachmentsFor(db, dir, 'quote', q.id)
  for (const e of db.select().from(expenses).where(eq(expenses.projectId, id)).all())
    deleteAttachmentsFor(db, dir, 'expense', e.id)
  deleteAttachmentsFor(db, dir, 'project', id)
  deleteProject(db, id)
  return { ok: true }
})
```
Similarly add `deleteAttachmentsFor(db, uploadsDir(), 'expense', id)` before the row delete in `server/api/expenses/[id].delete.ts`, and `'inventory_item'` in the inventory delete route.

- [ ] **Step 6: Run all tests, commit**

Run: `npm test` — Expected: all PASS.
```bash
git add -A && git commit -m "feat: attachments with validation, streaming, cascade file cleanup"
```

---

### Task 8: Research report engine

**Files:**
- Create: `server/utils/research.ts`, `server/plugins/research-sweep.ts`
- Create: `server/api/projects/[id]/research.post.ts`, `server/api/projects/[id]/research.get.ts`
- Test: `tests/server/research.test.ts`

**Interfaces:**
- Consumes: `researchReports`, `projects`, `householdSettings`, `quotes` tables; OpenAI SDK.
- Produces: `buildResearchPrompt(project, settings, quotes): string`; `runResearch(db, projectId, opts: { client, model, timeoutMs? }): Promise<ResearchReport>` (creates pending row, calls model, marks complete/failed; default timeout 5 min); `sweepOrphanedReports(db): number` (pending → failed "interrupted by restart", returns count). Routes: `POST /api/projects/:id/research` (fire-and-forget, returns pending report row), `GET /api/projects/:id/research` (all reports, newest first — the UI polls this).

- [ ] **Step 1: Write the failing test**

`tests/server/research.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createDb } from '../../server/utils/db'
import { createProject } from '../../server/utils/projects'
import { createQuote } from '../../server/utils/quotes'
import { buildResearchPrompt, runResearch, sweepOrphanedReports } from '../../server/utils/research'
import { researchReports, householdSettings } from '../../server/database/schema'
import { eq } from 'drizzle-orm'

function fakeClient(reply: string | Error) {
  return {
    chat: { completions: { create: async () => {
      if (reply instanceof Error) throw reply
      return { choices: [{ message: { content: reply } }] }
    } } },
  } as any
}

describe('research', () => {
  it('builds a prompt containing project, region, and quotes', () => {
    const db = createDb(':memory:')
    const p = createProject(db, { name: 'Mini split install', description: 'Addition, no ductwork' })
    createQuote(db, { projectId: p.id, companyName: 'HVAC Co', amount: 8000 })
    db.update(householdSettings).set({ region: 'Boston, MA' }).where(eq(householdSettings.id, 1)).run()
    const settings = db.select().from(householdSettings).where(eq(householdSettings.id, 1)).get()!
    const quotes = [{ companyName: 'HVAC Co', amount: 8000, scopeNotes: '', status: 'pending' }] as any
    const prompt = buildResearchPrompt(p, settings, quotes)
    expect(prompt).toContain('Mini split install')
    expect(prompt).toContain('Boston, MA')
    expect(prompt).toContain('HVAC Co')
    expect(prompt).toContain('8000')
  })

  it('marks report complete on success and failed on error', async () => {
    const db = createDb(':memory:')
    const p = createProject(db, { name: 'Mini split' })
    const ok = await runResearch(db, p.id, { client: fakeClient('# Report\nCosts...'), model: 'test-model' })
    expect(ok.status).toBe('complete')
    expect(ok.body).toContain('Costs')
    expect(ok.model).toBe('test-model')
    const bad = await runResearch(db, p.id, { client: fakeClient(new Error('rate limited')), model: 'test-model' })
    expect(bad.status).toBe('failed')
    expect(bad.error).toContain('rate limited')
  })

  it('sweeps orphaned pending reports to failed', () => {
    const db = createDb(':memory:')
    const p = createProject(db, { name: 'X' })
    db.insert(researchReports).values({ projectId: p.id, status: 'pending' }).run()
    expect(sweepOrphanedReports(db)).toBe(1)
    const r = db.select().from(researchReports).all()[0]!
    expect(r.status).toBe('failed')
    expect(r.error).toMatch(/interrupted by restart/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement research util**

`server/utils/research.ts`:
```ts
import { eq, desc } from 'drizzle-orm'
import { researchReports, projects, householdSettings, quotes as quotesTable, type ResearchReport, type Project, type Quote } from '../database/schema'
import type { Db } from './db'

type Settings = { region: string; houseFacts: string }

export function buildResearchPrompt(project: Project, settings: Settings, quotes: Pick<Quote, 'companyName' | 'amount' | 'scopeNotes' | 'status'>[]): string {
  const parts = [
    `You are a home-improvement research assistant. Research the following homeowner project and produce a markdown report with these sections: Overview of options, Typical cost ranges (equipment and installation, itemized), Factors that affect price, Questions to ask contractors, Red flags to watch for in quotes.`,
    `## Project\n${project.name}\n${project.description}`,
  ]
  if (settings.region) parts.push(`## Location\n${settings.region}\nGive cost estimates for this region, not national averages.`)
  if (settings.houseFacts) parts.push(`## House details\n${settings.houseFacts}`)
  if (quotes.length) {
    const lines = quotes.map(q => `- ${q.companyName}: $${q.amount} (${q.status})${q.scopeNotes ? ` — ${q.scopeNotes}` : ''}`)
    parts.push(`## Quotes received so far\n${lines.join('\n')}\nSanity-check these against typical pricing and note any that look high or low.`)
  }
  return parts.join('\n\n')
}

const DEFAULT_TIMEOUT = 5 * 60 * 1000

export async function runResearch(db: Db, projectId: number, opts: { client: any; model: string; timeoutMs?: number }): Promise<ResearchReport> {
  const project = db.select().from(projects).where(eq(projects.id, projectId)).get()
  if (!project) throw new Error('Project not found')
  const settings = db.select().from(householdSettings).where(eq(householdSettings.id, 1)).get()!
  const projectQuotes = db.select().from(quotesTable).where(eq(quotesTable.projectId, projectId)).all()

  const [report] = db.insert(researchReports)
    .values({ projectId, status: 'pending', model: opts.model }).returning().all()

  const finish = (patch: Partial<ResearchReport>) =>
    db.update(researchReports).set(patch).where(eq(researchReports.id, report!.id)).returning().all()[0]!

  try {
    const completion = await Promise.race([
      opts.client.chat.completions.create({
        model: opts.model,
        messages: [{ role: 'user', content: buildResearchPrompt(project, settings, projectQuotes) }],
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Research timed out after 5 minutes')), opts.timeoutMs ?? DEFAULT_TIMEOUT)),
    ]) as any
    const body = completion.choices?.[0]?.message?.content ?? ''
    if (!body) return finish({ status: 'failed', error: 'Model returned empty response' })
    return finish({ status: 'complete', body })
  } catch (e: any) {
    return finish({ status: 'failed', error: String(e?.message ?? e) })
  }
}

export function sweepOrphanedReports(db: Db): number {
  return db.update(researchReports)
    .set({ status: 'failed', error: 'interrupted by restart' })
    .where(eq(researchReports.status, 'pending')).returning().all().length
}

export function listReports(db: Db, projectId: number): ResearchReport[] {
  return db.select().from(researchReports)
    .where(eq(researchReports.projectId, projectId))
    .orderBy(desc(researchReports.id)).all()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` — Expected: PASS. (Timeout path is covered implicitly by the error path; the fake never delays.)

- [ ] **Step 5: Add routes and startup sweep plugin**

`server/api/projects/[id]/research.post.ts`:
```ts
import OpenAI from 'openai'
import { runResearch } from '../../../utils/research'
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  if (!config.openrouterApiKey || !config.researchModel)
    throw createError({ statusCode: 503, statusMessage: 'Research not configured: set NUXT_OPENROUTER_API_KEY and NUXT_RESEARCH_MODEL' })
  const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: config.openrouterApiKey })
  const projectId = Number(getRouterParam(event, 'id'))
  // Fire and forget: runResearch creates the pending row synchronously enough to poll,
  // but we return immediately and let it finish in the background.
  const promise = runResearch(useDb(), projectId, { client, model: config.researchModel })
  promise.catch(() => {}) // failures are persisted on the row
  return { started: true }
})
```

`server/api/projects/[id]/research.get.ts`:
```ts
import { listReports } from '../../../utils/research'
export default defineEventHandler((event) =>
  listReports(useDb(), Number(getRouterParam(event, 'id'))))
```

`server/plugins/research-sweep.ts`:
```ts
import { sweepOrphanedReports } from '../utils/research'
export default defineNitroPlugin(() => {
  const n = sweepOrphanedReports(useDb())
  if (n > 0) console.log(`[research] marked ${n} orphaned pending report(s) as failed`)
})
```

- [ ] **Step 6: Run all tests, commit**

Run: `npm test` — Expected: all PASS.
```bash
git add -A && git commit -m "feat: AI research reports via OpenRouter with timeout and restart sweep"
```

---

### Task 9: Auth UI — login, first-run setup, route middleware

**Files:**
- Create: `app/pages/login.vue`, `app/pages/setup.vue`, `app/middleware/auth.global.ts`, `app/layouts/default.vue`

**Interfaces:**
- Consumes: `/api/auth/*` routes (Task 3); `useUserSession()` composable from nuxt-auth-utils.
- Produces: global route middleware redirecting logged-out users to `/login` (or `/setup` when `needsSetup`); `default` layout with Nuxt UI sidebar nav (Dashboard `/`, Projects `/projects`, Expenses `/expenses`, Inventory `/inventory`, Settings `/settings`) and a logout button. All later pages assume this layout.

- [ ] **Step 1: Middleware**

`app/middleware/auth.global.ts`:
```ts
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path === '/setup') return
  const { loggedIn, fetch: refresh } = useUserSession()
  await refresh()
  if (loggedIn.value) return
  const status = await $fetch('/api/auth/status')
  return navigateTo(status.needsSetup ? '/setup' : '/login')
})
```

- [ ] **Step 2: Login and setup pages**

`app/pages/login.vue`:
```vue
<script setup lang="ts">
definePageMeta({ layout: false })
const state = reactive({ username: '', password: '' })
const error = ref('')
const { fetch: refreshSession } = useUserSession()
async function submit() {
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: state })
    await refreshSession()
    navigateTo('/')
  } catch { error.value = 'Invalid username or password' }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <UCard class="w-80">
      <template #header><h1 class="font-semibold">House — Sign in</h1></template>
      <form class="space-y-4" @submit.prevent="submit">
        <UInput v-model="state.username" placeholder="Username" autofocus />
        <UInput v-model="state.password" type="password" placeholder="Password" />
        <UAlert v-if="error" color="error" :title="error" />
        <UButton type="submit" block>Sign in</UButton>
      </form>
    </UCard>
  </div>
</template>
```

`app/pages/setup.vue` — same shape with `displayName` field, posts to `/api/auth/setup`, and on mount redirects to `/login` if `(await $fetch('/api/auth/status')).needsSetup === false`:
```vue
<script setup lang="ts">
definePageMeta({ layout: false })
const state = reactive({ username: '', password: '', displayName: '' })
const error = ref('')
const { fetch: refreshSession } = useUserSession()
onMounted(async () => {
  const s = await $fetch('/api/auth/status')
  if (!s.needsSetup) navigateTo('/login')
})
async function submit() {
  error.value = ''
  try {
    await $fetch('/api/auth/setup', { method: 'POST', body: state })
    await refreshSession()
    navigateTo('/')
  } catch (e: any) { error.value = e?.data?.statusMessage ?? 'Setup failed' }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <UCard class="w-80">
      <template #header><h1 class="font-semibold">Welcome — create the first account</h1></template>
      <form class="space-y-4" @submit.prevent="submit">
        <UInput v-model="state.displayName" placeholder="Display name" autofocus />
        <UInput v-model="state.username" placeholder="Username" />
        <UInput v-model="state.password" type="password" placeholder="Password (min 8 chars)" />
        <UAlert v-if="error" color="error" :title="error" />
        <UButton type="submit" block>Create account</UButton>
      </form>
    </UCard>
  </div>
</template>
```

- [ ] **Step 3: Default layout with sidebar**

`app/layouts/default.vue`:
```vue
<script setup lang="ts">
const { user, clear } = useUserSession()
async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  navigateTo('/login')
}
const links = [
  { label: 'Dashboard', icon: 'i-lucide-home', to: '/' },
  { label: 'Projects', icon: 'i-lucide-hammer', to: '/projects' },
  { label: 'Expenses', icon: 'i-lucide-receipt', to: '/expenses' },
  { label: 'Inventory', icon: 'i-lucide-package', to: '/inventory' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
]
</script>

<template>
  <div class="flex min-h-screen">
    <aside class="w-56 border-r border-default p-4 flex flex-col gap-2 max-md:hidden">
      <div class="font-bold mb-4">🏠 House</div>
      <UNavigationMenu orientation="vertical" :items="links" />
      <div class="mt-auto text-sm">
        <div class="mb-2">{{ user?.displayName }}</div>
        <UButton variant="ghost" size="sm" icon="i-lucide-log-out" @click="logout">Log out</UButton>
      </div>
    </aside>
    <main class="flex-1 p-6 overflow-x-auto">
      <div class="md:hidden mb-4"><UNavigationMenu :items="links" /></div>
      <slot />
    </main>
  </div>
</template>
```

Create a placeholder `app/pages/index.vue` (`<template><div>Dashboard</div></template>`) so the app renders.

- [ ] **Step 4: Verify manually**

`npm run dev`, open http://localhost:3000 — expect redirect to `/setup` on a fresh db (or `/login` if you created a user in Task 3). Complete setup/login; expect sidebar layout with nav links.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: login/setup pages, global auth middleware, sidebar layout"
```

---

### Task 10: Projects UI — list, create, drag-to-reorder

**Files:**
- Create: `app/pages/projects/index.vue`, `app/components/ProjectList.vue`, `app/components/ProjectFormModal.vue`

**Interfaces:**
- Consumes: `GET/POST /api/projects`, `POST /api/projects/reorder` (Task 4).
- Produces: `/projects` page with Backlog and Active sections (each drag-reorderable via native HTML drag events — no extra dependency), Done section (collapsed), "New project" modal. `ProjectList` emits `reorder(orderedIds: number[])` and navigates to `/projects/{id}` on click.

- [ ] **Step 1: ProjectList component with native drag-and-drop**

`app/components/ProjectList.vue`:
```vue
<script setup lang="ts">
import type { Project } from '~~/server/database/schema'
const props = defineProps<{ projects: Project[]; draggable?: boolean }>()
const emit = defineEmits<{ reorder: [orderedIds: number[]] }>()
const dragIndex = ref<number | null>(null)
const items = computed(() => props.projects)

function onDrop(targetIndex: number) {
  if (dragIndex.value === null || dragIndex.value === targetIndex) return
  const ids = items.value.map(p => p.id)
  const [moved] = ids.splice(dragIndex.value, 1)
  ids.splice(targetIndex, 0, moved!)
  emit('reorder', ids)
  dragIndex.value = null
}
const statusColor: Record<string, string> = {
  idea: 'neutral', on_hold: 'warning', researching: 'info',
  quoting: 'info', in_progress: 'primary', done: 'success',
}
</script>

<template>
  <ul class="space-y-2">
    <li v-for="(p, i) in items" :key="p.id"
        :draggable="draggable" class="cursor-pointer"
        @dragstart="dragIndex = i" @dragover.prevent @drop="onDrop(i)">
      <UCard @click="navigateTo(`/projects/${p.id}`)">
        <div class="flex items-center gap-3">
          <UIcon v-if="draggable" name="i-lucide-grip-vertical" class="text-dimmed" />
          <span class="font-medium flex-1">{{ p.name }}</span>
          <UBadge :color="statusColor[p.status]" variant="subtle">{{ p.status.replace('_', ' ') }}</UBadge>
        </div>
      </UCard>
    </li>
  </ul>
</template>
```

- [ ] **Step 2: Form modal and page**

`app/components/ProjectFormModal.vue`:
```vue
<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()
const state = reactive({ name: '', description: '', status: 'idea' })
const statuses = ['idea', 'researching', 'quoting', 'in_progress', 'on_hold', 'done']
const toast = useToast()
async function submit() {
  try {
    await $fetch('/api/projects', { method: 'POST', body: state })
    open.value = false
    Object.assign(state, { name: '', description: '', status: 'idea' })
    emit('created')
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage ?? 'Failed to create project', color: 'error' })
  }
}
</script>

<template>
  <UModal v-model:open="open" title="New project">
    <template #body>
      <form class="space-y-4" @submit.prevent="submit">
        <UInput v-model="state.name" placeholder="Project name" autofocus />
        <UTextarea v-model="state.description" placeholder="Description" />
        <USelect v-model="state.status" :items="statuses" />
        <UButton type="submit" block>Create</UButton>
      </form>
    </template>
  </UModal>
</template>
```

`app/pages/projects/index.vue`:
```vue
<script setup lang="ts">
const { data: lists, refresh } = await useFetch('/api/projects')
const showNew = ref(false)
const toast = useToast()
async function reorder(list: 'backlog' | 'active', orderedIds: number[]) {
  try {
    await $fetch('/api/projects/reorder', { method: 'POST', body: { list, orderedIds } })
    await refresh()
  } catch { toast.add({ title: 'Reorder failed', color: 'error' }) }
}
</script>

<template>
  <div class="space-y-8 max-w-2xl">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Projects</h1>
      <UButton icon="i-lucide-plus" @click="showNew = true">New project</UButton>
    </div>
    <section>
      <h2 class="font-semibold mb-3">Active</h2>
      <ProjectList :projects="lists?.active ?? []" draggable @reorder="ids => reorder('active', ids)" />
    </section>
    <section>
      <h2 class="font-semibold mb-3">Backlog</h2>
      <ProjectList :projects="lists?.backlog ?? []" draggable @reorder="ids => reorder('backlog', ids)" />
    </section>
    <UCollapsible>
      <UButton variant="ghost" trailing-icon="i-lucide-chevron-down">Done ({{ lists?.done.length ?? 0 }})</UButton>
      <template #content><ProjectList :projects="lists?.done ?? []" /></template>
    </UCollapsible>
    <ProjectFormModal v-model:open="showNew" @created="refresh()" />
  </div>
</template>
```

- [ ] **Step 3: Verify manually**

`npm run dev` → `/projects`: create three projects (two `idea`, one `in_progress`), drag Backlog items to swap order, reload page — order persists; Active list untouched.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: projects page with backlog/active sections and drag-to-reorder"
```

---

### Task 11: Project detail page — overview, quotes tab, expenses tab

**Files:**
- Create: `app/pages/projects/[id].vue`, `app/components/QuoteTable.vue`, `app/components/QuoteFormModal.vue`, `app/components/AttachmentList.vue`, `app/components/ConfirmDelete.vue`
- Test: `tests/components/QuoteTable.test.ts` (component test per spec)

**Interfaces:**
- Consumes: `GET /api/projects/:id`, `PATCH/DELETE /api/projects/:id`, `GET /api/projects/:id/quotes`, `POST /api/quotes`, `PATCH /api/quotes/:id`, `GET/POST/DELETE /api/attachments`, `projectSpend` data via a new tiny route below.
- Produces: `/projects/:id` with tabs Overview / Quotes / Expenses / Research (Research tab filled in Task 12). `QuoteTable` props `{ quotes: (Quote & { expired: boolean })[] }`, emits `accept(id)`, `decline(id)`, `revive(id)`. `ConfirmDelete` is the reusable confirmation modal (props `{ label: string }`, emits `confirm`) used by every delete in the app. Also create route `server/api/projects/[id]/spend.get.ts` returning `projectSpend`.

- [ ] **Step 1: Add spend route**

`server/api/projects/[id]/spend.get.ts`:
```ts
import { projectSpend } from '../../../utils/expenses'
export default defineEventHandler((event) =>
  projectSpend(useDb(), Number(getRouterParam(event, 'id'))))
```

- [ ] **Step 2: Write failing component test for QuoteTable**

Install test deps: `npm install -D @vue/test-utils happy-dom @vitejs/plugin-vue`, and in `vitest.config.ts` add vue plugin + `environment: 'happy-dom'`:
```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  test: { include: ['tests/**/*.test.ts'], passWithNoTests: true, environment: 'happy-dom' },
})
```

`tests/components/QuoteTable.test.ts` — test the component's rendering logic with Nuxt UI components stubbed:
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuoteTable from '../../app/components/QuoteTable.vue'

const quotes = [
  { id: 1, companyName: 'HVAC Co', amount: 8000, status: 'pending', expired: true, scopeNotes: '', contactInfo: '', validUntil: '2026-01-01', dateReceived: null, projectId: 1 },
  { id: 2, companyName: 'CoolAir', amount: 9500, status: 'accepted', expired: false, scopeNotes: '', contactInfo: '', validUntil: null, dateReceived: null, projectId: 1 },
]
const stubs = { UBadge: { template: '<span><slot /></span>' }, UButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' } }

describe('QuoteTable', () => {
  it('shows an expired badge only for expired quotes', () => {
    const w = mount(QuoteTable, { props: { quotes }, global: { stubs } })
    const rows = w.findAll('tbody tr')
    expect(rows[0]!.text()).toContain('expired')
    expect(rows[1]!.text()).not.toContain('expired')
  })

  it('emits accept with the quote id', async () => {
    const w = mount(QuoteTable, { props: { quotes }, global: { stubs } })
    await w.find('[data-test="accept-1"]').trigger('click')
    expect(w.emitted('accept')).toEqual([[1]])
  })
})
```

Run: `npm test` — Expected: FAIL (component missing).

- [ ] **Step 3: Implement QuoteTable**

`app/components/QuoteTable.vue`:
```vue
<script setup lang="ts">
type QuoteRow = { id: number; companyName: string; contactInfo: string; amount: number; scopeNotes: string; validUntil: string | null; status: string; expired: boolean }
defineProps<{ quotes: QuoteRow[] }>()
defineEmits<{ accept: [id: number]; decline: [id: number]; revive: [id: number] }>()
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
</script>

<template>
  <table class="w-full text-sm">
    <thead>
      <tr class="text-left border-b border-default">
        <th class="py-2">Company</th><th>Amount</th><th>Scope</th><th>Valid until</th><th>Status</th><th />
      </tr>
    </thead>
    <tbody>
      <tr v-for="q in quotes" :key="q.id" class="border-b border-default">
        <td class="py-2 font-medium">{{ q.companyName }}<div class="text-dimmed text-xs">{{ q.contactInfo }}</div></td>
        <td>{{ fmt(q.amount) }}</td>
        <td class="max-w-48 truncate">{{ q.scopeNotes }}</td>
        <td>
          {{ q.validUntil ?? '—' }}
          <UBadge v-if="q.expired" color="warning" variant="subtle">expired</UBadge>
        </td>
        <td><UBadge :color="q.status === 'accepted' ? 'success' : q.status === 'declined' ? 'neutral' : 'info'" variant="subtle">{{ q.status }}</UBadge></td>
        <td class="text-right space-x-1">
          <UButton v-if="q.status !== 'accepted'" size="xs" :data-test="`accept-${q.id}`" @click="$emit('accept', q.id)">Accept</UButton>
          <UButton v-if="q.status !== 'declined'" size="xs" variant="ghost" :data-test="`decline-${q.id}`" @click="$emit('decline', q.id)">Decline</UButton>
          <UButton v-else size="xs" variant="ghost" :data-test="`revive-${q.id}`" @click="$emit('revive', q.id)">Revive</UButton>
        </td>
      </tr>
    </tbody>
  </table>
</template>
```

Run: `npm test` — Expected: PASS.

- [ ] **Step 4: Shared ConfirmDelete + AttachmentList components**

`app/components/ConfirmDelete.vue`:
```vue
<script setup lang="ts">
defineProps<{ label: string }>()
const emit = defineEmits<{ confirm: [] }>()
const open = ref(false)
</script>

<template>
  <UButton color="error" variant="ghost" size="xs" icon="i-lucide-trash-2" @click="open = true" />
  <UModal v-model:open="open" :title="`Delete ${label}?`">
    <template #body>
      <p class="mb-4">This permanently deletes {{ label }} and its files. There is no undo.</p>
      <div class="flex gap-2 justify-end">
        <UButton variant="ghost" @click="open = false">Cancel</UButton>
        <UButton color="error" @click="open = false; emit('confirm')">Delete</UButton>
      </div>
    </template>
  </UModal>
</template>
```

`app/components/AttachmentList.vue`:
```vue
<script setup lang="ts">
const props = defineProps<{ ownerType: string; ownerId: number }>()
const { data: files, refresh } = await useFetch('/api/attachments', { query: { ownerType: props.ownerType, ownerId: props.ownerId } })
const toast = useToast()
async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const form = new FormData()
  form.append('ownerType', props.ownerType)
  form.append('ownerId', String(props.ownerId))
  form.append('file', file)
  try {
    await $fetch('/api/attachments', { method: 'POST', body: form })
    await refresh()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'Upload failed', color: 'error' })
  } finally { input.value = '' }
}
async function remove(id: number) {
  await $fetch(`/api/attachments/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="f in files" :key="f.id" class="flex items-center gap-2 text-sm">
      <a :href="`/api/attachments/${f.id}`" target="_blank" class="text-primary underline flex-1">{{ f.filename }}</a>
      <ConfirmDelete :label="f.filename" @confirm="remove(f.id)" />
    </div>
    <input type="file" accept="application/pdf,image/*,text/plain" @change="upload">
  </div>
</template>
```

- [ ] **Step 5: QuoteFormModal and the detail page**

`app/components/QuoteFormModal.vue` (same modal pattern as ProjectFormModal — fields companyName, contactInfo, amount (number), scopeNotes, dateReceived, validUntil; posts to `/api/quotes` with `projectId` prop; emits `created`):
```vue
<script setup lang="ts">
const props = defineProps<{ projectId: number }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()
const state = reactive({ companyName: '', contactInfo: '', amount: 0, scopeNotes: '', dateReceived: '', validUntil: '' })
const toast = useToast()
async function submit() {
  try {
    await $fetch('/api/quotes', { method: 'POST', body: { ...state, amount: Number(state.amount), projectId: props.projectId, dateReceived: state.dateReceived || undefined, validUntil: state.validUntil || undefined } })
    open.value = false
    emit('created')
  } catch (e: any) { toast.add({ title: e?.data?.statusMessage ?? 'Failed', color: 'error' }) }
}
</script>

<template>
  <UModal v-model:open="open" title="New quote">
    <template #body>
      <form class="space-y-3" @submit.prevent="submit">
        <UInput v-model="state.companyName" placeholder="Company" autofocus />
        <UInput v-model="state.contactInfo" placeholder="Contact info" />
        <UInput v-model.number="state.amount" type="number" step="0.01" placeholder="Amount ($)" />
        <UTextarea v-model="state.scopeNotes" placeholder="Scope notes" />
        <UInput v-model="state.dateReceived" type="date" />
        <UInput v-model="state.validUntil" type="date" />
        <UButton type="submit" block>Add quote</UButton>
      </form>
    </template>
  </UModal>
</template>
```

`app/pages/projects/[id].vue`:
```vue
<script setup lang="ts">
const route = useRoute()
const id = Number(route.params.id)
const { data: project, refresh: refreshProject } = await useFetch(`/api/projects/${id}`)
const showDeclined = ref(false)
const { data: quotes, refresh: refreshQuotes } = await useFetch(`/api/projects/${id}/quotes`, { query: computed(() => ({ includeDeclined: String(showDeclined.value) })) })
const { data: spend, refresh: refreshSpend } = await useFetch(`/api/projects/${id}/spend`)
const { data: expenses, refresh: refreshExpenses } = await useFetch('/api/expenses', { query: { projectId: id } })
const showNewQuote = ref(false)
const statuses = ['idea', 'researching', 'quoting', 'in_progress', 'on_hold', 'done']
const toast = useToast()
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

async function setStatus(status: string) {
  await $fetch(`/api/projects/${id}`, { method: 'PATCH', body: { status } })
  await refreshProject()
}
async function setQuoteStatus(quoteId: number, status: string) {
  await $fetch(`/api/quotes/${quoteId}`, { method: 'PATCH', body: { status } })
  await Promise.all([refreshQuotes(), refreshSpend()])
}
async function removeProject() {
  await $fetch(`/api/projects/${id}`, { method: 'DELETE' })
  toast.add({ title: 'Project deleted' })
  navigateTo('/projects')
}
const tabs = [
  { label: 'Overview', slot: 'overview' }, { label: 'Quotes', slot: 'quotes' },
  { label: 'Expenses', slot: 'expenses' }, { label: 'Research', slot: 'research' },
]
</script>

<template>
  <div v-if="project" class="max-w-3xl space-y-6">
    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-bold flex-1">{{ project.name }}</h1>
      <USelect :model-value="project.status" :items="statuses" @update:model-value="setStatus" />
      <ConfirmDelete :label="`project “${project.name}”`" @confirm="removeProject" />
    </div>
    <UTabs :items="tabs">
      <template #overview>
        <p class="whitespace-pre-wrap py-4">{{ project.description || 'No description.' }}</p>
        <AttachmentList owner-type="project" :owner-id="id" />
      </template>
      <template #quotes>
        <div class="py-4 space-y-4">
          <div class="flex items-center justify-between">
            <USwitch v-model="showDeclined" label="Show declined" />
            <UButton icon="i-lucide-plus" size="sm" @click="showNewQuote = true">New quote</UButton>
          </div>
          <QuoteTable :quotes="quotes ?? []"
            @accept="qid => setQuoteStatus(qid, 'accepted')"
            @decline="qid => setQuoteStatus(qid, 'declined')"
            @revive="qid => setQuoteStatus(qid, 'pending')" />
          <QuoteFormModal v-model:open="showNewQuote" :project-id="id" @created="refreshQuotes(); refreshSpend()" />
        </div>
      </template>
      <template #expenses>
        <div class="py-4 space-y-4">
          <UAlert v-if="spend" :title="`Spent ${fmt(spend.spent)} of ${fmt(spend.quoted)} accepted quotes`"
            :color="spend.spent > spend.quoted ? 'warning' : 'info'" variant="subtle" />
          <ul class="text-sm space-y-1">
            <li v-for="e in expenses" :key="e.id" class="flex justify-between border-b border-default py-1">
              <span>{{ e.date }} — {{ e.vendor }} {{ e.note && `(${e.note})` }}</span><span>{{ fmt(e.amount) }}</span>
            </li>
          </ul>
          <p class="text-dimmed text-sm">Add expenses from the Expenses page and link them to this project.</p>
        </div>
      </template>
      <template #research>
        <div class="py-4"><ResearchPanel :project-id="id" /></div>
      </template>
    </UTabs>
  </div>
</template>
```

(`ResearchPanel` is created in Task 12 — create a stub `app/components/ResearchPanel.vue` with `<template><div /></template>` and `defineProps<{ projectId: number }>()` now so the page compiles.)

- [ ] **Step 6: Verify manually, run tests, commit**

`npm run dev` → project detail: add a quote, accept it, check spend alert, upload a PDF to Overview, toggle Show declined. `npm test` — all PASS.
```bash
git add -A && git commit -m "feat: project detail page with quotes, expenses, attachments tabs"
```

---

### Task 12: Research UI panel

**Files:**
- Create: `app/components/ResearchPanel.vue` (replace Task 11 stub)
- Modify: none else

**Interfaces:**
- Consumes: `POST /api/projects/:id/research`, `GET /api/projects/:id/research` (Task 8). Reports: `{ id, status: 'pending'|'complete'|'failed', body, error, model, createdAt }`.
- Produces: panel with "Run research" button, 3-second polling while any report is `pending`, rendered markdown for complete reports (use `marked` — `npm install marked`), error alert for failed ones.

- [ ] **Step 1: Implement panel**

```bash
npm install marked
```

`app/components/ResearchPanel.vue`:
```vue
<script setup lang="ts">
import { marked } from 'marked'
const props = defineProps<{ projectId: number }>()
const { data: reports, refresh } = await useFetch(`/api/projects/${props.projectId}/research`)
const toast = useToast()
const hasPending = computed(() => reports.value?.some(r => r.status === 'pending') ?? false)

let timer: ReturnType<typeof setInterval> | null = null
watch(hasPending, (pending) => {
  if (pending && !timer) timer = setInterval(refresh, 3000)
  if (!pending && timer) { clearInterval(timer); timer = null }
}, { immediate: true })
onUnmounted(() => { if (timer) clearInterval(timer) })

async function run() {
  try {
    await $fetch(`/api/projects/${props.projectId}/research`, { method: 'POST' })
    await refresh()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage ?? 'Failed to start research', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <UButton icon="i-lucide-sparkles" :loading="hasPending" :disabled="hasPending" @click="run">
      {{ hasPending ? 'Researching…' : 'Run research' }}
    </UButton>
    <UCard v-for="r in reports" :key="r.id">
      <template #header>
        <div class="flex items-center gap-2 text-sm">
          <UBadge :color="r.status === 'complete' ? 'success' : r.status === 'failed' ? 'error' : 'info'" variant="subtle">{{ r.status }}</UBadge>
          <span class="text-dimmed">{{ new Date(r.createdAt).toLocaleString() }} · {{ r.model }}</span>
        </div>
      </template>
      <UAlert v-if="r.status === 'failed'" color="error" :title="r.error ?? 'Unknown error'" />
      <div v-else-if="r.status === 'complete'" class="prose prose-sm dark:prose-invert max-w-none" v-html="marked(r.body)" />
      <p v-else class="text-dimmed text-sm">Working…</p>
    </UCard>
  </div>
</template>
```

- [ ] **Step 2: Verify manually**

Set `NUXT_OPENROUTER_API_KEY` and `NUXT_RESEARCH_MODEL` in `.env` (any cheap model for testing). Run research on a project with a description and a region set in Settings — expect pending badge, then a rendered markdown report. Without the env vars, expect a toast: "Research not configured…".

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: research panel with polling and markdown rendering"
```

---

### Task 13: Expenses, Inventory, and Settings pages

**Files:**
- Create: `app/pages/expenses.vue`, `app/pages/inventory.vue`, `app/pages/settings.vue`, `app/components/ExpenseFormModal.vue`, `app/components/InventoryFormModal.vue`

**Interfaces:**
- Consumes: Task 6 routes; `ConfirmDelete`, `AttachmentList` (Task 11); user management route added below.
- Produces: three pages. Also add `server/api/users/index.get.ts`, `server/api/users/index.post.ts`, `server/api/users/[id]/password.post.ts` (any logged-in user can create users and reset any password — no roles per spec).

- [ ] **Step 1: User management routes**

`server/api/users/index.get.ts`:
```ts
import { users } from '../../database/schema'
export default defineEventHandler(() =>
  useDb().select({ id: users.id, username: users.username, displayName: users.displayName }).from(users).all())
```

`server/api/users/index.post.ts`:
```ts
import { createUser } from '../../utils/users'
export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string; displayName: string }>(event)
  if (!body?.username || !body?.password || body.password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Username and password (min 8 chars) required' })
  const u = await createUser(useDb(), { ...body, displayName: body.displayName || body.username })
  return { id: u.id, username: u.username, displayName: u.displayName }
})
```

`server/api/users/[id]/password.post.ts`:
```ts
import { eq } from 'drizzle-orm'
import { users } from '../../../database/schema'
import { hashPw } from '../../../utils/users'
export default defineEventHandler(async (event) => {
  const body = await readBody<{ password: string }>(event)
  if (!body?.password || body.password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Password min 8 chars' })
  const id = Number(getRouterParam(event, 'id'))
  const res = useDb().update(users).set({ passwordHash: hashPw(body.password) }).where(eq(users.id, id)).returning().all()
  if (!res.length) throw createError({ statusCode: 404, statusMessage: 'User not found' })
  return { ok: true }
})
```

- [ ] **Step 2: Expenses page**

`app/components/ExpenseFormModal.vue` (modal pattern as before; fields: amount (number), date (date), vendor, note, optional project select from `/api/projects` flattened, optional category select from `/api/categories`; posts to `/api/expenses`, emits `created`):
```vue
<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()
const { data: lists } = await useFetch('/api/projects')
const { data: cats } = await useFetch('/api/categories')
const projectItems = computed(() => [
  { label: '— none (general home expense) —', value: 0 },
  ...['active', 'backlog', 'done'].flatMap(k => (lists.value?.[k] ?? []).map((p: any) => ({ label: p.name, value: p.id }))),
])
const catItems = computed(() => (cats.value ?? []).map(c => ({ label: c.name, value: c.id })))
const state = reactive({ amount: 0, date: new Date().toISOString().slice(0, 10), vendor: '', note: '', projectId: 0, categoryId: undefined as number | undefined })
const toast = useToast()
async function submit() {
  try {
    await $fetch('/api/expenses', { method: 'POST', body: { ...state, amount: Number(state.amount), projectId: state.projectId || undefined } })
    open.value = false
    emit('created')
  } catch (e: any) { toast.add({ title: e?.data?.statusMessage ?? 'Failed', color: 'error' }) }
}
</script>

<template>
  <UModal v-model:open="open" title="New expense">
    <template #body>
      <form class="space-y-3" @submit.prevent="submit">
        <UInput v-model.number="state.amount" type="number" step="0.01" placeholder="Amount ($)" autofocus />
        <UInput v-model="state.date" type="date" />
        <UInput v-model="state.vendor" placeholder="Vendor" />
        <UInput v-model="state.note" placeholder="Note" />
        <USelect v-model="state.projectId" :items="projectItems" value-key="value" />
        <USelect v-model="state.categoryId" :items="catItems" value-key="value" placeholder="Category" />
        <UButton type="submit" block>Add expense</UButton>
      </form>
    </template>
  </UModal>
</template>
```

`app/pages/expenses.vue`:
```vue
<script setup lang="ts">
const filters = reactive({ categoryId: undefined as number | undefined, from: '', to: '' })
const query = computed(() => ({
  ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
  ...(filters.from ? { from: filters.from } : {}),
  ...(filters.to ? { to: filters.to } : {}),
}))
const { data: expenses, refresh } = await useFetch('/api/expenses', { query })
const { data: cats } = await useFetch('/api/categories')
const catItems = computed(() => [{ label: 'All categories', value: undefined }, ...(cats.value ?? []).map(c => ({ label: c.name, value: c.id }))])
const catName = (id: number | null) => cats.value?.find(c => c.id === id)?.name ?? ''
const total = computed(() => (expenses.value ?? []).reduce((s, e) => s + e.amount, 0))
const showNew = ref(false)
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
async function remove(id: number) {
  await $fetch(`/api/expenses/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="max-w-3xl space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Expenses</h1>
      <UButton icon="i-lucide-plus" @click="showNew = true">New expense</UButton>
    </div>
    <div class="flex gap-2 items-end">
      <USelect v-model="filters.categoryId" :items="catItems" value-key="value" class="w-44" />
      <UInput v-model="filters.from" type="date" /><UInput v-model="filters.to" type="date" />
      <div class="ml-auto font-semibold">Total: {{ fmt(total) }}</div>
    </div>
    <table class="w-full text-sm">
      <thead><tr class="text-left border-b border-default"><th class="py-2">Date</th><th>Vendor</th><th>Category</th><th>Note</th><th class="text-right">Amount</th><th /></tr></thead>
      <tbody>
        <tr v-for="e in expenses" :key="e.id" class="border-b border-default">
          <td class="py-2">{{ e.date }}</td><td>{{ e.vendor }}</td><td>{{ catName(e.categoryId) }}</td><td>{{ e.note }}</td>
          <td class="text-right">{{ fmt(e.amount) }}</td>
          <td class="text-right"><ConfirmDelete :label="`expense ${fmt(e.amount)}`" @confirm="remove(e.id)" /></td>
        </tr>
      </tbody>
    </table>
    <ExpenseFormModal v-model:open="showNew" @created="refresh()" />
  </div>
</template>
```

- [ ] **Step 3: Inventory page**

`app/components/InventoryFormModal.vue` — same modal pattern; fields name (required), location, brand, model, serial, purchaseDate (date), warrantyExpiry (date), notes; posts to `/api/inventory`; emits `created`. Copy `ExpenseFormModal.vue` structure with these fields substituted.

`app/pages/inventory.vue`:
```vue
<script setup lang="ts">
const { data: items, refresh } = await useFetch('/api/inventory')
const search = ref('')
const showNew = ref(false)
const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return (items.value ?? []).filter(i => [i.name, i.location, i.brand, i.model].join(' ').toLowerCase().includes(q))
})
function warrantyBadge(expiry: string | null): { label: string; color: string } | null {
  if (!expiry) return null
  const days = (new Date(expiry).getTime() - Date.now()) / 86_400_000
  if (days < 0) return { label: 'warranty expired', color: 'neutral' }
  if (days <= 60) return { label: 'warranty expiring', color: 'warning' }
  return { label: 'under warranty', color: 'success' }
}
async function remove(id: number) {
  await $fetch(`/api/inventory/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="max-w-3xl space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Inventory</h1>
      <UButton icon="i-lucide-plus" @click="showNew = true">New item</UButton>
    </div>
    <UInput v-model="search" icon="i-lucide-search" placeholder="Search name, location, brand…" />
    <UCard v-for="i in filtered" :key="i.id">
      <div class="flex items-center gap-3">
        <div class="flex-1">
          <div class="font-medium">{{ i.name }}</div>
          <div class="text-sm text-dimmed">{{ [i.brand, i.model, i.location].filter(Boolean).join(' · ') }}</div>
        </div>
        <UBadge v-if="warrantyBadge(i.warrantyExpiry)" :color="warrantyBadge(i.warrantyExpiry)!.color" variant="subtle">
          {{ warrantyBadge(i.warrantyExpiry)!.label }}
        </UBadge>
        <ConfirmDelete :label="i.name" @confirm="remove(i.id)" />
      </div>
      <AttachmentList class="mt-3" owner-type="inventory_item" :owner-id="i.id" />
    </UCard>
    <InventoryFormModal v-model:open="showNew" @created="refresh()" />
  </div>
</template>
```

- [ ] **Step 4: Settings page**

`app/pages/settings.vue` — household settings form, category add, user management:
```vue
<script setup lang="ts">
const { data: settings } = await useFetch('/api/settings')
const { data: userList, refresh: refreshUsers } = await useFetch('/api/users')
const { data: cats, refresh: refreshCats } = await useFetch('/api/categories')
const toast = useToast()
const household = reactive({ region: settings.value?.region ?? '', houseFacts: settings.value?.houseFacts ?? '' })
const newCat = ref('')
const newUser = reactive({ username: '', password: '', displayName: '' })
const resetTarget = ref<{ id: number; password: string } | null>(null)

async function saveHousehold() {
  await $fetch('/api/settings', { method: 'PATCH', body: household })
  toast.add({ title: 'Household settings saved' })
}
async function addCategory() {
  if (!newCat.value.trim()) return
  await $fetch('/api/categories', { method: 'POST', body: { name: newCat.value } })
  newCat.value = ''
  await refreshCats()
}
async function addUser() {
  try {
    await $fetch('/api/users', { method: 'POST', body: newUser })
    Object.assign(newUser, { username: '', password: '', displayName: '' })
    await refreshUsers()
    toast.add({ title: 'Account created' })
  } catch (e: any) { toast.add({ title: e?.data?.statusMessage ?? 'Failed', color: 'error' }) }
}
async function resetPassword() {
  if (!resetTarget.value) return
  try {
    await $fetch(`/api/users/${resetTarget.value.id}/password`, { method: 'POST', body: { password: resetTarget.value.password } })
    toast.add({ title: 'Password updated' })
    resetTarget.value = null
  } catch (e: any) { toast.add({ title: e?.data?.statusMessage ?? 'Failed', color: 'error' }) }
}
</script>

<template>
  <div class="max-w-xl space-y-8">
    <h1 class="text-2xl font-bold">Settings</h1>
    <UCard>
      <template #header>Household (used by AI research)</template>
      <form class="space-y-3" @submit.prevent="saveHousehold">
        <UInput v-model="household.region" placeholder="Region / metro / ZIP, e.g. Boston, MA" />
        <UTextarea v-model="household.houseFacts" placeholder="House facts: year built, sq ft, etc." />
        <UButton type="submit">Save</UButton>
      </form>
    </UCard>
    <UCard>
      <template #header>Expense categories</template>
      <div class="flex flex-wrap gap-2 mb-3"><UBadge v-for="c in cats" :key="c.id" variant="subtle">{{ c.name }}</UBadge></div>
      <form class="flex gap-2" @submit.prevent="addCategory">
        <UInput v-model="newCat" placeholder="New category" class="flex-1" />
        <UButton type="submit">Add</UButton>
      </form>
    </UCard>
    <UCard>
      <template #header>Accounts</template>
      <div v-for="u in userList" :key="u.id" class="flex items-center gap-2 py-1">
        <span class="flex-1">{{ u.displayName }} <span class="text-dimmed">({{ u.username }})</span></span>
        <UButton size="xs" variant="ghost" @click="resetTarget = { id: u.id, password: '' }">Reset password</UButton>
      </div>
      <form class="flex gap-2 mt-4" @submit.prevent="addUser">
        <UInput v-model="newUser.displayName" placeholder="Name" />
        <UInput v-model="newUser.username" placeholder="Username" />
        <UInput v-model="newUser.password" type="password" placeholder="Password" />
        <UButton type="submit">Add</UButton>
      </form>
      <UModal :open="!!resetTarget" title="Reset password" @update:open="resetTarget = null">
        <template #body>
          <form class="space-y-3" @submit.prevent="resetPassword">
            <UInput v-if="resetTarget" v-model="resetTarget.password" type="password" placeholder="New password (min 8 chars)" autofocus />
            <UButton type="submit" block>Set password</UButton>
          </form>
        </template>
      </UModal>
    </UCard>
  </div>
</template>
```

- [ ] **Step 5: Verify manually, commit**

Dev server: add expense with/without project, filter by date; add inventory item with warranty date next month (expect "warranty expiring"); save region; add category; create second account and reset its password; log in as the second account.
```bash
git add -A && git commit -m "feat: expenses, inventory, settings pages with account management"
```

---

### Task 14: Dashboard

**Files:**
- Create: `server/api/dashboard.get.ts`, replace placeholder `app/pages/index.vue`
- Test: `tests/server/dashboard.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `dashboardData(db, now?: Date)` in `server/utils/dashboard.ts` returning `{ active: Project[], backlog: Project[], recentExpenses: Expense[], expiringQuotes: (Quote & { projectName: string })[], expiringWarranties: InventoryItem[] }` — expiring quotes = `pending` with validUntil within 14 days (not yet past); warranties = expiry within 60 days (not yet past); recentExpenses = latest 10 by date. Route `GET /api/dashboard`.

- [ ] **Step 1: Write the failing test**

`tests/server/dashboard.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createDb } from '../../server/utils/db'
import { createProject } from '../../server/utils/projects'
import { createQuote } from '../../server/utils/quotes'
import { dashboardData } from '../../server/utils/dashboard'
import { inventoryItems } from '../../server/database/schema'

describe('dashboard', () => {
  const now = new Date('2026-07-12T00:00:00Z')

  it('surfaces quotes expiring within 14 days and warranties within 60', () => {
    const db = createDb(':memory:')
    const p = createProject(db, { name: 'Mini split', status: 'quoting' })
    createQuote(db, { projectId: p.id, companyName: 'Soon', amount: 1, validUntil: '2026-07-20' })    // in 8 days → included
    createQuote(db, { projectId: p.id, companyName: 'Far', amount: 1, validUntil: '2026-09-01' })     // too far → excluded
    createQuote(db, { projectId: p.id, companyName: 'Past', amount: 1, validUntil: '2026-07-01' })    // already expired → excluded
    db.insert(inventoryItems).values({ name: 'Fridge', warrantyExpiry: '2026-08-15' }).run()  // in 34 days → included
    db.insert(inventoryItems).values({ name: 'Oven', warrantyExpiry: '2027-01-01' }).run()    // too far → excluded
    const d = dashboardData(db, now)
    expect(d.expiringQuotes.map(q => q.companyName)).toEqual(['Soon'])
    expect(d.expiringQuotes[0]!.projectName).toBe('Mini split')
    expect(d.expiringWarranties.map(i => i.name)).toEqual(['Fridge'])
    expect(d.active.map(p2 => p2.name)).toEqual(['Mini split'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` — Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`server/utils/dashboard.ts`:
```ts
import { eq, inArray, desc } from 'drizzle-orm'
import { projects, quotes, expenses, inventoryItems, type Project, type Quote, type Expense, type InventoryItem } from '../database/schema'
import { listProjects } from './projects'
import type { Db } from './db'

const DAY = 86_400_000

function withinDays(dateStr: string | null, days: number, now: Date): boolean {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - now.getTime()
  return diff >= 0 && diff <= days * DAY
}

export function dashboardData(db: Db, now = new Date()) {
  const lists = listProjects(db)
  const nameById = new Map(db.select().from(projects).all().map(p => [p.id, p.name]))
  const expiringQuotes = db.select().from(quotes).where(eq(quotes.status, 'pending')).all()
    .filter(q => withinDays(q.validUntil, 14, now))
    .map(q => ({ ...q, projectName: nameById.get(q.projectId) ?? '' }))
  const expiringWarranties = db.select().from(inventoryItems).all()
    .filter(i => withinDays(i.warrantyExpiry, 60, now))
  const recentExpenses = db.select().from(expenses).orderBy(desc(expenses.date)).limit(10).all()
  return { active: lists.active, backlog: lists.backlog, recentExpenses, expiringQuotes, expiringWarranties }
}
```

`server/api/dashboard.get.ts`:
```ts
import { dashboardData } from '../utils/dashboard'
export default defineEventHandler(() => dashboardData(useDb()))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Dashboard page**

Replace `app/pages/index.vue`:
```vue
<script setup lang="ts">
const { data: d, refresh } = await useFetch('/api/dashboard')
const toast = useToast()
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
async function reorder(list: 'backlog' | 'active', orderedIds: number[]) {
  try {
    await $fetch('/api/projects/reorder', { method: 'POST', body: { list, orderedIds } })
    await refresh()
  } catch { toast.add({ title: 'Reorder failed', color: 'error' }) }
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-2 max-w-5xl">
    <section>
      <h2 class="font-semibold mb-3">Active projects</h2>
      <ProjectList :projects="d?.active ?? []" draggable @reorder="ids => reorder('active', ids)" />
      <h2 class="font-semibold my-3">Backlog</h2>
      <ProjectList :projects="d?.backlog ?? []" draggable @reorder="ids => reorder('backlog', ids)" />
    </section>
    <section class="space-y-6">
      <UCard v-if="d?.expiringQuotes.length">
        <template #header>⏳ Quotes expiring soon</template>
        <div v-for="q in d.expiringQuotes" :key="q.id" class="text-sm py-1">
          <b>{{ q.companyName }}</b> ({{ q.projectName }}) — {{ fmt(q.amount) }}, valid until {{ q.validUntil }}
        </div>
      </UCard>
      <UCard v-if="d?.expiringWarranties.length">
        <template #header>🛡️ Warranties expiring within 60 days</template>
        <div v-for="i in d.expiringWarranties" :key="i.id" class="text-sm py-1">
          <b>{{ i.name }}</b> — expires {{ i.warrantyExpiry }}
        </div>
      </UCard>
      <UCard>
        <template #header>Recent expenses</template>
        <div v-for="e in d?.recentExpenses ?? []" :key="e.id" class="text-sm py-1 flex justify-between">
          <span>{{ e.date }} — {{ e.vendor }}</span><span>{{ fmt(e.amount) }}</span>
        </div>
        <p v-if="!d?.recentExpenses.length" class="text-dimmed text-sm">No expenses yet.</p>
      </UCard>
    </section>
  </div>
</template>
```

- [ ] **Step 6: Verify manually, commit**

Dashboard shows active/backlog with drag reorder, expiring widgets appear with suitable test data.
```bash
git add -A && git commit -m "feat: dashboard with rankings, expiring quotes and warranties, recent expenses"
```

---

### Task 15: Docker + password-reset CLI + docs

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `scripts/reset-password.mjs`, `README.md`

**Interfaces:**
- Consumes: full app.
- Produces: deployable image; `node scripts/reset-password.mjs <username> <newpassword>` run inside the container (lockout escape hatch per spec).

- [ ] **Step 1: Reset-password CLI**

`scripts/reset-password.mjs`:
```js
// Lockout escape hatch: run inside the container.
// Usage: node scripts/reset-password.mjs <username> <new-password>
import Database from 'better-sqlite3'
import { randomBytes, scryptSync } from 'node:crypto'
import { join } from 'node:path'

const [username, password] = process.argv.slice(2)
if (!username || !password || password.length < 8) {
  console.error('Usage: node scripts/reset-password.mjs <username> <new-password (min 8 chars)>')
  process.exit(1)
}
const dataDir = process.env.NUXT_DATA_DIR ?? '/data'
const db = new Database(join(dataDir, 'sqlite.db'))
const salt = randomBytes(16).toString('hex')
const hash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
const res = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, username.toLowerCase())
console.log(res.changes ? `Password reset for ${username}` : `No user named ${username}`)
process.exit(res.changes ? 0 : 1)
```

Verify locally: `NUXT_DATA_DIR=./data node scripts/reset-password.mjs me newpassword123` then log in with the new password.

- [ ] **Step 2: Dockerfile**

`Dockerfile`:
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY scripts ./scripts
RUN npm install --no-save better-sqlite3 2>/dev/null || true
ENV NUXT_DATA_DIR=/data
ENV PORT=3000
EXPOSE 3000
VOLUME /data
CMD ["node", ".output/server/index.mjs"]
```

Note: Nitro bundles dependencies into `.output`, but `better-sqlite3` is a native module — if the build output already includes it under `.output/server/node_modules`, drop the two better-sqlite3 lines. Verify by inspecting the built output before finalizing.

`.dockerignore`:
```
node_modules
.output
.nuxt
data
.git
docs
```

- [ ] **Step 3: Build and smoke-test the image**

```bash
docker build -t house .
docker run --rm -p 3000:3000 -v house-data:/data \
  -e NUXT_SESSION_PASSWORD=$(openssl rand -hex 32) \
  -e NUXT_OPENROUTER_API_KEY=... -e NUXT_RESEARCH_MODEL=... house
```
Expected: app on http://localhost:3000, setup screen on first run, data persists across container restarts (docker volume). Test the reset CLI: `docker exec <ctr> node scripts/reset-password.mjs me newpassword123`.

- [ ] **Step 4: README**

`README.md` — short: what it is, env vars table (`NUXT_SESSION_PASSWORD` required 32+ chars, `NUXT_OPENROUTER_API_KEY`, `NUXT_RESEARCH_MODEL`, `NUXT_DATA_DIR`), Unraid notes (map `/data` to appdata share, LAN-only), backup = copy `/data`, password reset command, dev instructions (`npm install`, `.env`, `npm run dev`, `npm test`).

- [ ] **Step 5: Final check, commit**

Run: `npm test` (all PASS) and `npm run build` (succeeds).
```bash
git add -A && git commit -m "feat: dockerfile, password-reset CLI, README"
```

---

## Self-Review Notes

- **Spec coverage:** projects+ranking (T4/T10), quotes+expiry+declined (T5/T11), expenses+categories (T6/T13), inventory+warranty badges (T6/T13), household settings (T6/T13), research+sweep+timeout (T8/T12), auth+no-roles+CLI reset (T3/T9/T13/T15), attachments+limits+cascade (T7), dashboard windows 14/60 days (T14), Docker/volume/env (T15). Chat assistant correctly absent (out of scope); research context-building isolated in `buildResearchPrompt` for future reuse.
- **Type consistency:** `createDb(path)` / `useDb()` used throughout; `Db` type from `server/utils/db`; quote status strings match schema enums; `ownerType` values match the attachment enum.
- **Known judgment calls baked in:** hand-maintained DDL instead of drizzle-kit migrations (single-schema app, revisit if schema churns); scrypt via node:crypto instead of nuxt-auth-utils hashPassword (testability outside Nitro); native HTML drag events instead of a DnD library (YAGNI).
