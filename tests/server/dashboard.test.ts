import { describe, it, expect } from 'vitest'
import { createDataSource } from '../../server/database/data-source'
import { createProject } from '../../server/utils/projects'
import { createQuote } from '../../server/utils/quotes'
import { dashboardData } from '../../server/utils/dashboard'
import { InventoryItem } from '../../server/database/entities'

describe('dashboard', () => {
  const now = new Date('2026-07-12T00:00:00Z')

  it('surfaces quotes expiring within 14 days and warranties within 60', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'Mini split', status: 'quoting' })
    await createQuote(db, { projectId: p.id, companyName: 'Soon', amount: 1, validUntil: '2026-07-20' })    // in 8 days → included
    await createQuote(db, { projectId: p.id, companyName: 'Far', amount: 1, validUntil: '2026-09-01' })     // too far → excluded
    await createQuote(db, { projectId: p.id, companyName: 'Past', amount: 1, validUntil: '2026-07-01' })    // already expired → excluded
    const inv = db.getRepository(InventoryItem)
    await inv.save(inv.create({ name: 'Fridge', warrantyExpiry: '2026-08-15' }))  // in 34 days → included
    await inv.save(inv.create({ name: 'Oven', warrantyExpiry: '2027-01-01' }))    // too far → excluded
    const d = await dashboardData(db, now)
    expect(d.expiringQuotes.map(q => q.companyName)).toEqual(['Soon'])
    expect(d.expiringQuotes[0]!.projectName).toBe('Mini split')
    expect(d.expiringWarranties.map(i => i.name)).toEqual(['Fridge'])
    expect(d.active.map(p2 => p2.name)).toEqual(['Mini split'])
    await db.destroy()
  })
})
