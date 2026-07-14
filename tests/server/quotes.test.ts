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

  it('ignores extra keys in patch for updateQuote (mass-assignment protection)', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'Test project' })
    const original = await createQuote(db, { projectId: p.id, companyName: 'Original Co', amount: 1000 })
    const originalId = original.id
    const originalProjectId = original.projectId

    // Attempt to patch with extra keys (id, projectId) alongside valid status change
    const patched = await updateQuote(db, originalId, {
      status: 'accepted',
      id: 999, // Try to change the ID (should be ignored)
      projectId: 999, // Try to change the projectId (should be ignored)
    } as any)

    // Verify the valid field was updated
    expect(patched.status).toBe('accepted')

    // Verify extra fields were NOT changed
    expect(patched.id).toBe(originalId)
    expect(patched.projectId).toBe(originalProjectId)

    await db.destroy()
  })

  it('expiry comparison uses local date, not UTC (today not expired, yesterday expired)', () => {
    // Test with a date at local midnight (not UTC midnight)
    // Using a fixed 'now' date: 2026-07-14 in local time
    const localNow = new Date(2026, 6, 14) // month is 0-indexed, so 6 = July

    // validUntil as date strings (YYYY-MM-DD)
    // Same day as local now should NOT be expired
    expect(isExpired({ status: 'pending', validUntil: '2026-07-14' } as any, localNow)).toBe(false)

    // Day before local now should be expired
    expect(isExpired({ status: 'pending', validUntil: '2026-07-13' } as any, localNow)).toBe(true)

    // Day after local now should NOT be expired
    expect(isExpired({ status: 'pending', validUntil: '2026-07-15' } as any, localNow)).toBe(false)
  })
})
