import { describe, it, expect } from 'vitest'
import { createDataSource } from '../../server/database/data-source'
import { createProject } from '../../server/utils/projects'
import { createQuote, updateQuote } from '../../server/utils/quotes'
import { createExpense, listExpenses, expenseTotal, projectSpend } from '../../server/utils/expenses'

describe('expenses', () => {
  it('filters by project/date and totals; computes project spend vs quoted', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'Mini split' })
    const q = await createQuote(db, { projectId: p.id, companyName: 'HVAC Co', amount: 8000 })
    await updateQuote(db, q.id, { status: 'accepted' })
    await createExpense(db, { projectId: p.id, amount: 4000, date: '2026-07-01', vendor: 'HVAC Co' })
    await createExpense(db, { projectId: p.id, amount: 30, date: '2026-07-10', vendor: 'Hardware store' })
    await createExpense(db, { amount: 120, date: '2026-07-05', vendor: 'Utility' }) // standalone
    expect(await listExpenses(db)).toHaveLength(3)
    expect(await listExpenses(db, { projectId: p.id })).toHaveLength(2)
    expect(await listExpenses(db, { from: '2026-07-04', to: '2026-07-11' })).toHaveLength(2)
    expect(await expenseTotal(db, { projectId: p.id })).toBe(4030)
    expect(await projectSpend(db, p.id)).toEqual({ spent: 4030, quoted: 8000 })
    await db.destroy()
  })
})
