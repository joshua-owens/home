import { InventoryItem } from '../../database/entities'
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.name?.trim()) throw createError({ statusCode: 400, statusMessage: 'name required' })
  const repo = (await useDb()).getRepository(InventoryItem)
  return repo.save(repo.create(body))
})
