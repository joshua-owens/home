import { InventoryItem } from '../../database/entities'
export default defineEventHandler(async (event) => {
  await (await useDb()).getRepository(InventoryItem).delete(Number(getRouterParam(event, 'id')))
  return { ok: true }
})
