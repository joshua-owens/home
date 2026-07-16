import { updateProject } from '../../utils/projects'
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  return updateProject(await useDb(), id, await readBody(event))
})
