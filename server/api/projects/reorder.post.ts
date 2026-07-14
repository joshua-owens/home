import { reorderList } from '../../utils/projects'
export default defineEventHandler(async (event) => {
  const body = await readBody<{ list: 'backlog' | 'active'; orderedIds: number[] }>(event)
  if (!body?.list || !Array.isArray(body.orderedIds))
    throw createError({ statusCode: 400, statusMessage: 'list and orderedIds required' })
  await reorderList(await useDb(), body.list, body.orderedIds)
  return { ok: true }
})
