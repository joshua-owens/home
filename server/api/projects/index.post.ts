import { createProject } from '../../utils/projects'
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!body?.name) throw createError({ statusCode: 400, statusMessage: 'Name required' })
  const session = await getUserSession(event)
  return createProject(await useDb(), { ...body, createdBy: (session.user as any)?.id })
})
