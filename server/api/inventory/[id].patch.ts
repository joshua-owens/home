import { updateInventoryItem } from '../../utils/inventory'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  return updateInventoryItem(await useDb(), id, await readBody(event))
})
