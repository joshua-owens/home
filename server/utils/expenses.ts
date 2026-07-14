import { Expense } from '../database/entities'
import { acceptedTotal } from './quotes'
import type { Db } from './db'

export type ExpenseFilter = { projectId?: number; categoryId?: number; from?: string; to?: string }

export async function createExpense(db: Db, input: { projectId?: number; categoryId?: number; amount: number; date: string; vendor?: string; note?: string }): Promise<Expense> {
  const repo = db.getRepository(Expense)
  return repo.save(repo.create(input))
}

export async function listExpenses(db: Db, filter: ExpenseFilter = {}): Promise<Expense[]> {
  // QueryBuilder because from/to are two conditions on the same `date` column.
  const qb = db.getRepository(Expense).createQueryBuilder('e')
  if (filter.projectId !== undefined) qb.andWhere('e.projectId = :projectId', { projectId: filter.projectId })
  if (filter.categoryId !== undefined) qb.andWhere('e.categoryId = :categoryId', { categoryId: filter.categoryId })
  if (filter.from) qb.andWhere('e.date >= :from', { from: filter.from })
  if (filter.to) qb.andWhere('e.date <= :to', { to: filter.to })
  return qb.getMany()
}

export async function expenseTotal(db: Db, filter: ExpenseFilter = {}): Promise<number> {
  return (await listExpenses(db, filter)).reduce((s, e) => s + e.amount, 0)
}

export async function projectSpend(db: Db, projectId: number): Promise<{ spent: number; quoted: number }> {
  return { spent: await expenseTotal(db, { projectId }), quoted: await acceptedTotal(db, projectId) }
}
