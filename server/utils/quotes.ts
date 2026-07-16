import { Not } from 'typeorm'
import { Quote } from '../database/entities'
import type { Db } from './db'
import { localDateString } from './dates'
import { httpError } from './http-error'
import { pickDefined } from './pick'

const UPDATABLE_QUOTE_FIELDS = [
  'companyName',
  'contactInfo',
  'amount',
  'scopeNotes',
  'dateReceived',
  'validUntil',
  'status',
] as const

export function isExpired(quote: Pick<Quote, 'status' | 'validUntil'>, now = new Date()): boolean {
  if (quote.status !== 'pending' || !quote.validUntil) return false
  // Compare lexically: quote is expired only if validUntil is strictly BEFORE today
  return quote.validUntil < localDateString(now)
}

export async function createQuote(db: Db, input: { projectId: number; companyName: string; amount: number; contactInfo?: string; scopeNotes?: string; dateReceived?: string; validUntil?: string }): Promise<Quote> {
  const repo = db.getRepository(Quote)
  // Whitelist fields at runtime — TS types erase, and a stray `id` in the
  // input would make save() upsert over an existing row.
  return repo.save(repo.create({
    projectId: input.projectId,
    companyName: input.companyName,
    amount: input.amount,
    ...pickDefined(input, ['contactInfo', 'scopeNotes', 'dateReceived', 'validUntil'] as const),
  }))
}

export async function updateQuote(db: Db, id: number, patch: Partial<Omit<Quote, 'id' | 'projectId'>>): Promise<Quote> {
  const repo = db.getRepository(Quote)
  const existing = await repo.findOneBy({ id })
  if (!existing) throw httpError({ statusCode: 404, statusMessage: 'Quote not found' })

  // Whitelist only allowed fields to prevent mass-assignment
  const whitelisted = pickDefined(patch, UPDATABLE_QUOTE_FIELDS)

  return repo.save({ ...existing, ...whitelisted })
}

export async function listQuotes(db: Db, projectId: number, opts: { includeDeclined?: boolean } = {}): Promise<(Quote & { expired: boolean })[]> {
  const where = opts.includeDeclined
    ? { projectId }
    : { projectId, status: Not('declined' as const) }
  const quotes = await db.getRepository(Quote).find({ where })
  return quotes.map(quote => ({ ...quote, expired: isExpired(quote) }))
}

export async function acceptedTotal(db: Db, projectId: number): Promise<number> {
  const accepted = await db.getRepository(Quote).findBy({ projectId, status: 'accepted' })
  return accepted.reduce((sum, quote) => sum + quote.amount, 0)
}
