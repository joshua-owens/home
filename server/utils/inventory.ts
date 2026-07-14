import { InventoryItem } from '../database/entities'
import type { Db } from './db'

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

export async function createInventoryItem(db: Db, input: InventoryInput): Promise<InventoryItem> {
  const repo = db.getRepository(InventoryItem)
  return repo.save(repo.create(input))
}

export async function updateInventoryItem(db: Db, id: number, input: Partial<InventoryInput>): Promise<InventoryItem> {
  const repo = db.getRepository(InventoryItem)
  const existing = await repo.findOneBy({ id })
  if (!existing) throw new Error(`Inventory item ${id} not found`)

  // Only overwrite fields present in input
  const whitelisted: Partial<InventoryItem> = {}
  if (input.name !== undefined) whitelisted.name = input.name
  if (input.location !== undefined) whitelisted.location = input.location
  if (input.brand !== undefined) whitelisted.brand = input.brand
  if (input.model !== undefined) whitelisted.model = input.model
  if (input.serial !== undefined) whitelisted.serial = input.serial
  if (input.purchaseDate !== undefined) whitelisted.purchaseDate = input.purchaseDate
  if (input.warrantyExpiry !== undefined) whitelisted.warrantyExpiry = input.warrantyExpiry
  if (input.notes !== undefined) whitelisted.notes = input.notes

  return repo.save({ ...existing, ...whitelisted })
}

export async function deleteInventoryItem(db: Db, id: number): Promise<void> {
  await db.getRepository(InventoryItem).delete(id)
}
