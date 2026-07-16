import { InventoryItem } from '../../database/entities'
import { pickDefined } from '../../utils/pick'
import type { InventoryInput } from '../../utils/inventory'

export default defineEventHandler(async (event) => {
  const body = await readBody<InventoryInput>(event)
  if (!body?.name?.trim()) throw createError({ statusCode: 400, statusMessage: 'name required' })
  const repo = (await useDb()).getRepository(InventoryItem)
  // Whitelist fields at runtime — a stray `id` in the body would make
  // save() upsert over an existing row.
  return repo.save(repo.create({
    name: body.name.trim(),
    ...pickDefined(body, ['location', 'brand', 'model', 'serial', 'purchaseDate', 'warrantyExpiry', 'notes'] as const),
  }))
})
