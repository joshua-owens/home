import { updateQuote } from '../../utils/quotes'
export default defineEventHandler(async (event) =>
  updateQuote(await useDb(), Number(getRouterParam(event, 'id')), await readBody(event)))
