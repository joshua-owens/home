import { Not } from 'typeorm'
import { Quote } from '../database/entities'
import type { Db } from './db'

const createError = globalThis.createError ?? ((e: any) => Object.assign(new Error(e.statusMessage), e))

export function isExpired(q: Pick<Quote, 'status' | 'validUntil'>, now = new Date()): boolean {
  if (q.status !== 'pending' || !q.validUntil) return false

  // Build local date string (YYYY-MM-DD) from now parameter
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const localTodayString = `${year}-${month}-${day}`

  // Compare lexically: quote is expired only if validUntil is strictly BEFORE today
  return q.validUntil < localTodayString
}

export async function createQuote(db: Db, input: { projectId: number; companyName: string; amount: number; contactInfo?: string; scopeNotes?: string; dateReceived?: string; validUntil?: string }): Promise<Quote> {
  const repo = db.getRepository(Quote)
  // Whitelist fields at runtime — TS types erase, and a stray `id` in the
  // input would make save() upsert over an existing row.
  return repo.save(repo.create({
    projectId: input.projectId,
    companyName: input.companyName,
    amount: input.amount,
    ...(input.contactInfo !== undefined && { contactInfo: input.contactInfo }),
    ...(input.scopeNotes !== undefined && { scopeNotes: input.scopeNotes }),
    ...(input.dateReceived !== undefined && { dateReceived: input.dateReceived }),
    ...(input.validUntil !== undefined && { validUntil: input.validUntil }),
  }))
}

export async function updateQuote(db: Db, id: number, patch: Partial<Omit<Quote, 'id' | 'projectId'>>): Promise<Quote> {
  const repo = db.getRepository(Quote)
  const existing = await repo.findOneBy({ id })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Quote not found' })

  // Whitelist only allowed fields to prevent mass-assignment
  const whitelisted = {
    ...(patch.companyName !== undefined && { companyName: patch.companyName }),
    ...(patch.contactInfo !== undefined && { contactInfo: patch.contactInfo }),
    ...(patch.amount !== undefined && { amount: patch.amount }),
    ...(patch.scopeNotes !== undefined && { scopeNotes: patch.scopeNotes }),
    ...(patch.dateReceived !== undefined && { dateReceived: patch.dateReceived }),
    ...(patch.validUntil !== undefined && { validUntil: patch.validUntil }),
    ...(patch.status !== undefined && { status: patch.status }),
  }

  return repo.save({ ...existing, ...whitelisted })
}

export async function listQuotes(db: Db, projectId: number, opts: { includeDeclined?: boolean } = {}): Promise<(Quote & { expired: boolean })[]> {
  const where = opts.includeDeclined
    ? { projectId }
    : { projectId, status: Not('declined' as const) }
  const rows = await db.getRepository(Quote).find({ where })
  return rows.map(q => ({ ...q, expired: isExpired(q) }))
}

export async function acceptedTotal(db: Db, projectId: number): Promise<number> {
  const rows = await db.getRepository(Quote).findBy({ projectId, status: 'accepted' })
  return rows.reduce((sum, q) => sum + q.amount, 0)
}
