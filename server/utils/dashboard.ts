import { Project, Quote, Expense, InventoryItem } from '../database/entities'
import { listProjects } from './projects'
import type { Db } from './db'

const DAY = 86_400_000

function withinDays(dateStr: string | null, days: number, now: Date): boolean {
  if (!dateStr) return false
  const diff = new Date(dateStr).getTime() - now.getTime()
  return diff >= 0 && diff <= days * DAY
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
