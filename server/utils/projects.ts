import { In } from 'typeorm'
import { Project, type ProjectStatusValue } from '../database/entities'
import type { Db } from './db'
import { httpError } from './http-error'
import { pickDefined } from './pick'

export type ProjectStatus = ProjectStatusValue
export type ListName = 'backlog' | 'active' | 'done'

const LIST_STATUSES: Record<ListName, ProjectStatus[]> = {
  backlog: ['idea', 'on_hold'],
  active: ['researching', 'quoting', 'in_progress'],
  done: ['done'],
}

export function listId(status: ProjectStatus): ListName {
  if (LIST_STATUSES.backlog.includes(status)) return 'backlog'
  if (LIST_STATUSES.active.includes(status)) return 'active'
  return 'done'
}

async function nextRank(db: Db, list: ListName): Promise<number> {
  const rows = await db.getRepository(Project).find({
    where: { status: In(LIST_STATUSES[list]) },
    select: { rank: true },
  })
  return rows.length ? Math.max(...rows.map(row => row.rank)) + 1 : 1
}

export async function createProject(db: Db, input: { name: string; description?: string; status?: ProjectStatus; createdBy?: number }): Promise<Project> {
  const status = input.status ?? 'idea'
  const repo = db.getRepository(Project)
  return repo.save(repo.create({
    name: input.name,
    description: input.description ?? '',
    status,
    rank: await nextRank(db, listId(status)),
    createdBy: input.createdBy ?? null,
  }))
}

export async function updateProject(db: Db, id: number, patch: Partial<Pick<Project, 'name' | 'description' | 'status'>>): Promise<Project> {
  const repo = db.getRepository(Project)
  const existing = await repo.findOneBy({ id })
  if (!existing) throw httpError({ statusCode: 404, statusMessage: 'Project not found' })
  let rank = existing.rank
  if (patch.status && listId(patch.status) !== listId(existing.status))
    rank = await nextRank(db, listId(patch.status))

  // Whitelist only allowed fields to prevent mass-assignment
  const whitelisted = pickDefined(patch, ['name', 'description', 'status'] as const)

  return repo.save({ ...existing, ...whitelisted, rank, updatedAt: new Date().toISOString() })
}

export async function reorderList(db: Db, list: Exclude<ListName, 'done'>, orderedIds: number[]): Promise<void> {
  const repo = db.getRepository(Project)
  for (const [index, id] of orderedIds.entries())
    await repo.update(id, { rank: index + 1 })
}

export async function listProjects(db: Db): Promise<Record<ListName, Project[]>> {
  const all = await db.getRepository(Project).find({ order: { rank: 'ASC' } })
  return {
    backlog: all.filter(project => listId(project.status) === 'backlog'),
    active: all.filter(project => listId(project.status) === 'active'),
    done: all.filter(project => listId(project.status) === 'done'),
  }
}

export async function deleteProject(db: Db, id: number): Promise<void> {
  await db.getRepository(Project).delete(id)
}
