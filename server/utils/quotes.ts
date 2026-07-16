import { Not } from 'typeorm'
import { Quote } from '../database/entities'
import type { Db } from './db'
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

  // Build local date string (YYYY-MM-DD) from now parameter
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const localTodayString = `${year}-${month}-${day}`

  // Compare lexically: quote is expired only if validUntil is strictly BEFORE today
  return quote.validUntil < localTodayString
}

export async function createQuote(db: Db, input: { projectId: number; companyName: string; amount: number; contactInfo?: string; scopeNotes?: string; dateReceived?: string; validUntil?: string }): Promise<Quote> {
  const repo = db.getRepository(Quote)
  return repo.save(repo.create(input))
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
