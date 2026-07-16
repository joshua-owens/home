import { updateExpense } from '../../utils/expenses'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  return updateExpense(await useDb(), id, await readBody(event))
})
