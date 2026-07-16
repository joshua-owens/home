import { describe, it, expect } from 'vitest'
import { createDataSource } from '../../server/database/data-source'
import { Project } from '../../server/database/entities'
import { createProject, updateProject, reorderList, listProjects, listId } from '../../server/utils/projects'

describe('projects ranking', () => {
  it('maps statuses to lists', () => {
    expect(listId('idea')).toBe('backlog')
    expect(listId('on_hold')).toBe('backlog')
    expect(listId('researching')).toBe('active')
    expect(listId('quoting')).toBe('active')
    expect(listId('in_progress')).toBe('active')
    expect(listId('done')).toBe('done')
  })

  it('appends new projects to the bottom of their list', async () => {
    const db = await createDataSource(':memory:')
    const a = await createProject(db, { name: 'A', status: 'idea' })
    const b = await createProject(db, { name: 'B', status: 'idea' })
    expect(b.rank).toBeGreaterThan(a.rank)
    await db.destroy()
  })

  it('moving Backlog→Active appends to bottom of Active', async () => {
    const db = await createDataSource(':memory:')
    const active1 = await createProject(db, { name: 'Active1', status: 'quoting' })
    const idea = await createProject(db, { name: 'Idea', status: 'idea' })
    const moved = await updateProject(db, idea.id, { status: 'researching' })
    expect(moved.rank).toBeGreaterThan(active1.rank)
    const { active } = await listProjects(db)
    expect(active.map(p => p.name)).toEqual(['Active1', 'Idea'])
    await db.destroy()
  })

  it('reorders a list without touching the other', async () => {
    const db = await createDataSource(':memory:')
    const i1 = await createProject(db, { name: 'I1', status: 'idea' })
    const i2 = await createProject(db, { name: 'I2', status: 'idea' })
    const a1 = await createProject(db, { name: 'A1', status: 'in_progress' })
    await reorderList(db, 'backlog', [i2.id, i1.id])
    const lists = await listProjects(db)
    expect(lists.backlog.map(p => p.name)).toEqual(['I2', 'I1'])
    expect(lists.active.map(p => p.name)).toEqual(['A1'])
    await db.destroy()
  })

  it('ignores extra keys in patch (mass-assignment protection)', async () => {
    const db = await createDataSource(':memory:')
    const original = await createProject(db, { name: 'Original', status: 'idea' })
    const originalId = original.id
    const originalCreatedAt = original.createdAt
    const originalRank = original.rank

    // Create another project to verify we don't accidentally modify it
    const other = await createProject(db, { name: 'Other', status: 'idea' })
    const otherId = other.id

    // Attempt to patch with extra keys (id, createdAt, rank) alongside valid status change
    const patched = await updateProject(db, originalId, {
      status: 'researching',
      id: otherId, // Try to change the ID
      createdAt: '1970-01-01T00:00:00Z', // Try to change createdAt
      rank: 999, // Try to change rank
    } as any)

    // Verify the valid field was updated
    expect(patched.status).toBe('researching')

    // Verify extra fields were NOT changed
    expect(patched.id).toBe(originalId)
    expect(patched.createdAt).toBe(originalCreatedAt)
    expect(patched.rank).not.toBe(999) // Rank should be recomputed for list change, not set to 999

    // Verify other project was not affected
    const otherAfter = await db.getRepository(Project).findOneBy({ id: otherId })
    expect(otherAfter).toBeDefined()
    expect(otherAfter!.name).toBe('Other')

    await db.destroy()
  })
})
