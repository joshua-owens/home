import { InventoryItem } from '../../database/entities'
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.name?.trim()) throw createError({ statusCode: 400, statusMessage: 'name required' })
  const repo = (await useDb()).getRepository(InventoryItem)
  // Whitelist fields at runtime — a stray `id` in the body would make
  // save() upsert over an existing row.
  return repo.save(repo.create({
    name: body.name.trim(),
    ...(body.location !== undefined && { location: body.location }),
    ...(body.brand !== undefined && { brand: body.brand }),
    ...(body.model !== undefined && { model: body.model }),
    ...(body.serial !== undefined && { serial: body.serial }),
    ...(body.purchaseDate !== undefined && { purchaseDate: body.purchaseDate }),
    ...(body.warrantyExpiry !== undefined && { warrantyExpiry: body.warrantyExpiry }),
    ...(body.notes !== undefined && { notes: body.notes }),
  }))
})
