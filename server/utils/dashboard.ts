import { Project, Quote, Expense, InventoryItem } from '../database/entities'
import { listProjects } from './projects'
import type { Db } from './db'

function getLocalDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function withinDays(dateStr: string | null, days: number, now: Date): boolean {
  if (!dateStr) return false

  // Build local date strings for lexical comparison (YYYY-MM-DD)
  const today = getLocalDateString(now)

  // Calculate the end of the window (today + days)
  const windowEndDate = new Date(now)
  windowEndDate.setDate(windowEndDate.getDate() + days)
  const windowEnd = getLocalDateString(windowEndDate)

  // Include if dateStr is within [today, windowEnd] (inclusive on both ends)
  return dateStr >= today && dateStr <= windowEnd
}

export async function dashboardData(db: Db, now = new Date()) {
  const lists = await listProjects(db)
  const nameById = new Map((await db.getRepository(Project).find()).map(p => [p.id, p.name]))
  const expiringQuotes = (await db.getRepository(Quote).findBy({ status: 'pending' }))
    .filter(q => withinDays(q.validUntil, 14, now))
    .map(q => ({ ...q, projectName: nameById.get(q.projectId) ?? '' }))
  const expiringWarranties = (await db.getRepository(InventoryItem).find())
    .filter(i => withinDays(i.warrantyExpiry, 60, now))
  const recentExpenses = await db.getRepository(Expense).find({ order: { date: 'DESC' }, take: 10 })
  return { active: lists.active, backlog: lists.backlog, recentExpenses, expiringQuotes, expiringWarranties }
}
