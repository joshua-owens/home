import { listQuotes } from '../../../utils/quotes'
export default defineEventHandler(async (event) => {
  const projectId = Number(getRouterParam(event, 'id'))
  const includeDeclined = getQuery(event).includeDeclined === 'true'
  return listQuotes(await useDb(), projectId, { includeDeclined })
})
