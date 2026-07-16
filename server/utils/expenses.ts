import { Expense } from '../database/entities'
import { acceptedTotal } from './quotes'
import type { Db } from './db'
import { httpError } from './http-error'
import { pickDefined } from './pick'

const UPDATABLE_EXPENSE_FIELDS = ['projectId', 'categoryId', 'amount', 'date', 'vendor', 'note'] as const

export type ExpenseFilter = { projectId?: number; categoryId?: number; from?: string; to?: string }

export async function createExpense(db: Db, input: { projectId?: number; categoryId?: number; amount: number; date: string; vendor?: string; note?: string }): Promise<Expense> {
  const repo = db.getRepository(Expense)
  return repo.save(repo.create(input))
}

export async function updateExpense(db: Db, id: number, patch: Partial<Omit<Expense, 'id'>>): Promise<Expense> {
  const repo = db.getRepository(Expense)
  const existing = await repo.findOneBy({ id })
  if (!existing) throw httpError({ statusCode: 404, statusMessage: 'Expense not found' })

  // Whitelist only allowed fields to prevent mass-assignment
  const whitelisted = pickDefined(patch, UPDATABLE_EXPENSE_FIELDS)

  return repo.save({ ...existing, ...whitelisted })
}

export async function listExpenses(db: Db, filter: ExpenseFilter = {}): Promise<Expense[]> {
  // QueryBuilder because from/to are two conditions on the same `date` column.
  const query = db.getRepository(Expense).createQueryBuilder('expense')
  if (filter.projectId !== undefined) query.andWhere('expense.projectId = :projectId', { projectId: filter.projectId })
  if (filter.categoryId !== undefined) query.andWhere('expense.categoryId = :categoryId', { categoryId: filter.categoryId })
  if (filter.from) query.andWhere('expense.date >= :from', { from: filter.from })
  if (filter.to) query.andWhere('expense.date <= :to', { to: filter.to })
  return query.getMany()
}

export async function expenseTotal(db: Db, filter: ExpenseFilter = {}): Promise<number> {
  return (await listExpenses(db, filter)).reduce((sum, expense) => sum + expense.amount, 0)
}

export async function projectSpend(db: Db, projectId: number): Promise<{ spent: number; quoted: number }> {
  return { spent: await expenseTotal(db, { projectId }), quoted: await acceptedTotal(db, projectId) }
}
