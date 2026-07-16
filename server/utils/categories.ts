import { Category, Expense } from '../database/entities'
import type { Db } from './db'

export async function createCategory(db: Db, input: { name: string }): Promise<Category> {
  const repo = db.getRepository(Category)
  return repo.save(repo.create({ name: input.name.trim().toLowerCase() }))
}

export async function deleteCategory(db: Db, id: number): Promise<void> {
  // Set any expenses referencing this category to null before deleting
  await db.getRepository(Expense).update({ categoryId: id }, { categoryId: null })
  await db.getRepository(Category).delete(id)
}
