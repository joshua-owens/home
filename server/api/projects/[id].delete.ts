import { deleteProject } from '../../utils/projects'
export default defineEventHandler(async (event) => {
  await deleteProject(await useDb(), Number(getRouterParam(event, 'id')))
  return { ok: true }
})
