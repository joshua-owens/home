import { createQuote } from '../../utils/quotes'
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.projectId || !body?.companyName || typeof body.amount !== 'number')
    throw createError({ statusCode: 400, statusMessage: 'projectId, companyName, amount required' })
  return createQuote(await useDb(), body)
})
