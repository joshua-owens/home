import { describe, it, expect } from 'vitest'
import { createDataSource } from '../../server/database/data-source'
import { InventoryItem } from '../../server/database/entities'
import { createInventoryItem, updateInventoryItem, deleteInventoryItem } from '../../server/utils/inventory'

describe('inventory', () => {
  it('creates an inventory item', async () => {
    const db = await createDataSource(':memory:')
    const item = await createInventoryItem(db, { name: 'HVAC Unit', brand: 'Daikin', location: 'Attic' })
    expect(item.id).toBeDefined()
    expect(item.name).toBe('HVAC Unit')
    expect(item.brand).toBe('Daikin')
    expect(item.location).toBe('Attic')
    await db.destroy()
  })

  it('updates an inventory item with partial data', async () => {
    const db = await createDataSource(':memory:')
    const item = await createInventoryItem(db, { name: 'HVAC Unit', brand: 'Daikin', location: 'Attic', model: 'X100' })
    const updated = await updateInventoryItem(db, item.id, { location: 'Basement' })
    expect(updated.name).toBe('HVAC Unit')
    expect(updated.brand).toBe('Daikin')
    expect(updated.location).toBe('Basement')
    expect(updated.model).toBe('X100')
    await db.destroy()
  })

  it('deletes an inventory item', async () => {
    const db = await createDataSource(':memory:')
    const item = await createInventoryItem(db, { name: 'HVAC Unit' })
    await deleteInventoryItem(db, item.id)
    const repo = db.getRepository(InventoryItem)
    const deleted = await repo.findOneBy({ id: item.id })
    expect(deleted).toBeNull()
    await db.destroy()
  })
})
