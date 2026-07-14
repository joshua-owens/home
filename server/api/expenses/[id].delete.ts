import { Expense } from '../../database/entities'
export default defineEventHandler(async (event) => {
  await (await useDb()).getRepository(Expense).delete(Number(getRouterParam(event, 'id')))
  return { ok: true }
})
