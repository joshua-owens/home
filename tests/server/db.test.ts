import { describe, it, expect } from 'vitest'
import { createDb } from '../../server/utils/db'
import { projects, categories } from '../../server/database/schema'

describe('db', () => {
  it('creates schema and seeds default categories', () => {
    const db = createDb(':memory:')
    const cats = db.select().from(categories).all()
    expect(cats.map(c => c.name).sort()).toEqual(
      ['appliance', 'improvement', 'maintenance', 'other', 'utilities'])
    db.insert(projects).values({ name: 'Mini split', status: 'idea', rank: 1 }).run()
    expect(db.select().from(projects).all()).toHaveLength(1)
  })
})
