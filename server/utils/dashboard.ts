import { Project, Quote, Expense, InventoryItem } from '../database/entities'
import { listProjects } from './projects'
import type { Db } from './db'
import { localDateString } from './dates'

function withinDays(dateStr: string | null, days: number, now: Date): boolean {
  if (!dateStr) return false

  // Lexical comparison of local YYYY-MM-DD strings, inclusive on both ends
  const today = localDateString(now)
  const windowEndDate = new Date(now)
  windowEndDate.setDate(windowEndDate.getDate() + days)

  return dateStr >= today && dateStr <= localDateString(windowEndDate)
}

export async function dashboardData(db: Db, now = new Date()) {
  const lists = await listProjects(db)
  const nameById = new Map((await db.getRepository(Project).find()).map(project => [project.id, project.name]))
  const expiringQuotes = (await db.getRepository(Quote).findBy({ status: 'pending' }))
    .filter(quote => withinDays(quote.validUntil, 14, now))
    .map(quote => ({ ...quote, projectName: nameById.get(quote.projectId) ?? '' }))
  const expiringWarranties = (await db.getRepository(InventoryItem).find())
    .filter(item => withinDays(item.warrantyExpiry, 60, now))
  const recentExpenses = await db.getRepository(Expense).find({ order: { date: 'DESC' }, take: 10 })
  return { active: lists.active, backlog: lists.backlog, recentExpenses, expiringQuotes, expiringWarranties }
}
