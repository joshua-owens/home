import { describe, it, expect } from 'vitest'
import { createDataSource } from '../../server/database/data-source'
import { Category, Expense } from '../../server/database/entities'
import { createCategory, deleteCategory } from '../../server/utils/categories'
import { createExpense } from '../../server/utils/expenses'

describe('categories', () => {
  it('creates a category', async () => {
    const db = await createDataSource(':memory:')
    const category = await createCategory(db, { name: 'Plumbing' })
    expect(category.id).toBeDefined()
    expect(category.name).toBe('plumbing')
    await db.destroy()
  })

  it('deletes a category and leaves referencing expenses with null categoryId', async () => {
    const db = await createDataSource(':memory:')
    const category = await createCategory(db, { name: 'Plumbing' })
    const expense = await createExpense(db, { categoryId: category.id, amount: 100, date: '2026-07-01' })

    expect(expense.categoryId).toBe(category.id)

    await deleteCategory(db, category.id)

    const expenseRepo = db.getRepository(Expense)
    const updatedExpense = await expenseRepo.findOneBy({ id: expense.id })
    expect(updatedExpense?.categoryId).toBeNull()

    await db.destroy()
  })
})
