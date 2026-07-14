import { describe, it, expect } from 'vitest'
import { createDataSource } from '../../server/database/data-source'
import { createProject } from '../../server/utils/projects'
import { createQuote } from '../../server/utils/quotes'
import { dashboardData } from '../../server/utils/dashboard'
import { InventoryItem } from '../../server/database/entities'

describe('dashboard', () => {
  const now = new Date('2026-07-12T00:00:00Z')

  // Helper to derive local date strings from now
  function getLocalDateString(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

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

  it('includes quotes expiring exactly today', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'Test', status: 'quoting' })
    const today = getLocalDateString(now)
    await createQuote(db, { projectId: p.id, companyName: 'Today', amount: 1, validUntil: today })
    const d = await dashboardData(db, now)
    expect(d.expiringQuotes.map(q => q.companyName)).toEqual(['Today'])
    await db.destroy()
  })

  it('includes quotes expiring exactly in 14 days', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'Test', status: 'quoting' })
    const day14 = getLocalDateString(addDays(now, 14))
    await createQuote(db, { projectId: p.id, companyName: 'Day14', amount: 1, validUntil: day14 })
    const d = await dashboardData(db, now)
    expect(d.expiringQuotes.map(q => q.companyName)).toEqual(['Day14'])
    await db.destroy()
  })

  it('excludes quotes expiring after 14 days', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'Test', status: 'quoting' })
    const day15 = getLocalDateString(addDays(now, 15))
    await createQuote(db, { projectId: p.id, companyName: 'Day15', amount: 1, validUntil: day15 })
    const d = await dashboardData(db, now)
    expect(d.expiringQuotes).toHaveLength(0)
    await db.destroy()
  })

  it('excludes quotes that expired yesterday', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'Test', status: 'quoting' })
    const yesterday = getLocalDateString(addDays(now, -1))
    await createQuote(db, { projectId: p.id, companyName: 'Yesterday', amount: 1, validUntil: yesterday })
    const d = await dashboardData(db, now)
    expect(d.expiringQuotes).toHaveLength(0)
    await db.destroy()
  })

  it('includes warranties expiring exactly in 60 days', async () => {
    const db = await createDataSource(':memory:')
    const day60 = getLocalDateString(addDays(now, 60))
    const inv = db.getRepository(InventoryItem)
    await inv.save(inv.create({ name: 'Day60', warrantyExpiry: day60 }))
    const d = await dashboardData(db, now)
    expect(d.expiringWarranties.map(i => i.name)).toEqual(['Day60'])
    await db.destroy()
  })

  it('excludes warranties expiring after 60 days', async () => {
    const db = await createDataSource(':memory:')
    const day61 = getLocalDateString(addDays(now, 61))
    const inv = db.getRepository(InventoryItem)
    await inv.save(inv.create({ name: 'Day61', warrantyExpiry: day61 }))
    const d = await dashboardData(db, now)
    expect(d.expiringWarranties).toHaveLength(0)
    await db.destroy()
  })
})
