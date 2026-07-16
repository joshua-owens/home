import 'reflect-metadata'
import { Entity, PrimaryGeneratedColumn, PrimaryColumn, Column, BeforeInsert } from 'typeorm'

export type ProjectStatusValue = 'idea' | 'researching' | 'quoting' | 'in_progress' | 'done' | 'on_hold'
export type QuoteStatusValue = 'pending' | 'accepted' | 'declined'
export type ReportStatusValue = 'pending' | 'complete' | 'failed'
export type OwnerTypeValue = 'project' | 'quote' | 'expense' | 'inventory_item'

@Entity('users')
export class User {
  @PrimaryGeneratedColumn() id!: number
  @Column('text', { unique: true }) username!: string
  @Column('text', { name: 'password_hash' }) passwordHash!: string
  @Column('text', { name: 'display_name' }) displayName!: string
  @Column('text', { name: 'created_at' }) createdAt!: string
  @BeforeInsert() _setCreatedAt() { if (!this.createdAt) this.createdAt = new Date().toISOString() }
}

@Entity('household_settings')
export class HouseholdSettings {
  @PrimaryColumn('integer') id!: number // singleton row id=1
  @Column('text', { default: '' }) region!: string
  @Column('text', { name: 'house_facts', default: '' }) houseFacts!: string
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn() id!: number
  @Column('text') name!: string
  @Column('text', { default: '' }) description!: string
  @Column('text', { default: 'idea' }) status!: ProjectStatusValue
  @Column('integer', { default: 0 }) rank!: number // position within its list (Backlog or Active)
  @Column('integer', { name: 'created_by', nullable: true }) createdBy!: number | null
  @Column('text', { name: 'created_at' }) createdAt!: string
  @Column('text', { name: 'updated_at' }) updatedAt!: string
  @BeforeInsert() _initTimestamps() {
    const now = new Date().toISOString()
    if (!this.createdAt) this.createdAt = now
    if (!this.updatedAt) this.updatedAt = now
  }
}

@Entity('quotes')
export class Quote {
  @PrimaryGeneratedColumn() id!: number
  @Column('integer', { name: 'project_id' }) projectId!: number
  @Column('text', { name: 'company_name' }) companyName!: string
  @Column('text', { name: 'contact_info', default: '' }) contactInfo!: string
  @Column('real') amount!: number
  @Column('text', { name: 'scope_notes', default: '' }) scopeNotes!: string
  @Column('text', { name: 'date_received', nullable: true }) dateReceived!: string | null
  @Column('text', { name: 'valid_until', nullable: true }) validUntil!: string | null
  @Column('text', { default: 'pending' }) status!: QuoteStatusValue
}

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn() id!: number
  @Column('text', { unique: true }) name!: string
}

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn() id!: number
  @Column('integer', { name: 'project_id', nullable: true }) projectId!: number | null // null = general home expense
  @Column('integer', { name: 'category_id', nullable: true }) categoryId!: number | null
  @Column('real') amount!: number
  @Column('text') date!: string
  @Column('text', { default: '' }) vendor!: string
  @Column('text', { default: '' }) note!: string
}

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn() id!: number
  @Column('text') name!: string
  @Column('text', { default: '' }) location!: string
  @Column('text', { default: '' }) brand!: string
  @Column('text', { default: '' }) model!: string
  @Column('text', { default: '' }) serial!: string
  @Column('text', { name: 'purchase_date', nullable: true }) purchaseDate!: string | null
  @Column('text', { name: 'warranty_expiry', nullable: true }) warrantyExpiry!: string | null
  @Column('text', { default: '' }) notes!: string
}

@Entity('research_reports')
export class ResearchReport {
  @PrimaryGeneratedColumn() id!: number
  @Column('integer', { name: 'project_id' }) projectId!: number
  @Column('text', { default: 'pending' }) status!: ReportStatusValue
  @Column('text', { default: '' }) body!: string
  @Column('text', { nullable: true }) error!: string | null
  @Column('text', { default: '' }) model!: string
  @Column('text', { name: 'created_at' }) createdAt!: string
  @BeforeInsert() _setCreatedAt() { if (!this.createdAt) this.createdAt = new Date().toISOString() }
}

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn() id!: number
  @Column('text', { name: 'owner_type' }) ownerType!: OwnerTypeValue
  @Column('integer', { name: 'owner_id' }) ownerId!: number
  @Column('text') filename!: string
  @Column('text', { name: 'mime_type' }) mimeType!: string
  @Column('integer') size!: number
  @Column('text', { name: 'disk_path' }) diskPath!: string // relative to DATA_DIR/uploads
  @Column('text', { name: 'created_at' }) createdAt!: string
  @BeforeInsert() _setCreatedAt() { if (!this.createdAt) this.createdAt = new Date().toISOString() }
}

export const entities = [User, HouseholdSettings, Project, Quote, Category, Expense, InventoryItem, ResearchReport, Attachment]
