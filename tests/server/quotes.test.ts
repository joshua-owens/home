import { describe, it, expect } from 'vitest'
import { createDataSource } from '../../server/database/data-source'
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

  it('sums accepted quotes; hides declined by default but keeps them revivable', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'Mini split' })
    const q1 = await createQuote(db, { projectId: p.id, companyName: 'HVAC Co', amount: 8000 })
    const q2 = await createQuote(db, { projectId: p.id, companyName: 'Sparky', amount: 1500 })
    const q3 = await createQuote(db, { projectId: p.id, companyName: 'Overpriced Inc', amount: 15000 })
    await updateQuote(db, q1.id, { status: 'accepted' })
    await updateQuote(db, q2.id, { status: 'accepted' })
    await updateQuote(db, q3.id, { status: 'declined' })
    expect(await acceptedTotal(db, p.id)).toBe(9500)
    expect((await listQuotes(db, p.id)).map(q => q.companyName)).toEqual(['HVAC Co', 'Sparky'])
    expect(await listQuotes(db, p.id, { includeDeclined: true })).toHaveLength(3)
    const revived = await updateQuote(db, q3.id, { status: 'pending' })
    expect(revived.status).toBe('pending')
    await db.destroy()
  })
})
