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
