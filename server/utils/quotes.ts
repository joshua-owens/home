import { Not } from 'typeorm'
import { Quote } from '../database/entities'
import type { Db } from './db'

const createError = globalThis.createError ?? ((e: any) => Object.assign(new Error(e.statusMessage), e))

export function isExpired(q: Pick<Quote, 'status' | 'validUntil'>, now = new Date()): boolean {
  return q.status === 'pending' && !!q.validUntil && new Date(q.validUntil) < now
}

export async function createQuote(db: Db, input: { projectId: number; companyName: string; amount: number; contactInfo?: string; scopeNotes?: string; dateReceived?: string; validUntil?: string }): Promise<Quote> {
  const repo = db.getRepository(Quote)
  return repo.save(repo.create(input))
}

export async function updateQuote(db: Db, id: number, patch: Partial<Omit<Quote, 'id' | 'projectId'>>): Promise<Quote> {
  const repo = db.getRepository(Quote)
  const existing = await repo.findOneBy({ id })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Quote not found' })
  return repo.save({ ...existing, ...patch })
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
