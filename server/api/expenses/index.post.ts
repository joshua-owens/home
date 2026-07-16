import { createExpense } from '../../utils/expenses'
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (typeof body?.amount !== 'number' || !body?.date)
    throw createError({ statusCode: 400, statusMessage: 'amount and date required' })
  return createExpense(await useDb(), body)
})
