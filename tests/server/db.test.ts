import { describe, it, expect } from 'vitest'
import { createDataSource } from '../../server/database/data-source'
import { Project, Category } from '../../server/database/entities'

describe('db', () => {
  it('runs migrations, creates tables, seeds categories, round-trips a row', async () => {
    const db = await createDataSource(':memory:')
    const cats = await db.getRepository(Category).find()
    expect(cats.map(c => c.name).sort()).toEqual(
      ['appliance', 'improvement', 'maintenance', 'other', 'utilities'])
    const repo = db.getRepository(Project)
    const saved = await repo.save(repo.create({ name: 'Mini split', status: 'idea', rank: 1 }))
    expect(saved.id).toBeGreaterThan(0)
    expect(await repo.find()).toHaveLength(1)
    await db.destroy()
  })
})
