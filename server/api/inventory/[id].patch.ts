import { InventoryItem } from '../../database/entities'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const repo = (await useDb()).getRepository(InventoryItem)
  const existing = await repo.findOneBy({ id })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Inventory item not found' })

  const body = await readBody(event)

  // Whitelist only allowed fields to prevent mass-assignment
  const whitelisted = {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.location !== undefined && { location: body.location }),
    ...(body.brand !== undefined && { brand: body.brand }),
    ...(body.model !== undefined && { model: body.model }),
    ...(body.serial !== undefined && { serial: body.serial }),
    ...(body.purchaseDate !== undefined && { purchaseDate: body.purchaseDate }),
    ...(body.warrantyExpiry !== undefined && { warrantyExpiry: body.warrantyExpiry }),
    ...(body.notes !== undefined && { notes: body.notes }),
  }

  return repo.save({ ...existing, ...whitelisted })
})
