import { InventoryItem } from '../database/entities'
import type { Db } from './db'
import { httpError } from './http-error'
import { pickDefined } from './pick'

export type InventoryInput = {
  name: string
  location?: string
  brand?: string
  model?: string
  serial?: string
  purchaseDate?: string | null
  warrantyExpiry?: string | null
  notes?: string
}

const UPDATABLE_INVENTORY_FIELDS = [
  'name',
  'location',
  'brand',
  'model',
  'serial',
  'purchaseDate',
  'warrantyExpiry',
  'notes',
] as const

export async function createInventoryItem(db: Db, input: InventoryInput): Promise<InventoryItem> {
  const repo = db.getRepository(InventoryItem)
  return repo.save(repo.create(input))
}

export async function updateInventoryItem(db: Db, id: number, patch: Partial<InventoryInput>): Promise<InventoryItem> {
  const repo = db.getRepository(InventoryItem)
  const existing = await repo.findOneBy({ id })
  if (!existing) throw httpError({ statusCode: 404, statusMessage: 'Inventory item not found' })

  // Whitelist only allowed fields to prevent mass-assignment
  const whitelisted = pickDefined(patch, UPDATABLE_INVENTORY_FIELDS)

  return repo.save({ ...existing, ...whitelisted })
}

export async function deleteInventoryItem(db: Db, id: number): Promise<void> {
  await db.getRepository(InventoryItem).delete(id)
}
