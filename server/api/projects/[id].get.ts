import { Project } from '../../database/entities'
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const p = await (await useDb()).getRepository(Project).findOneBy({ id })
  if (!p) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  return p
})
