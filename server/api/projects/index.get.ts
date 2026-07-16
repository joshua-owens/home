import { listProjects } from '../../utils/projects'
export default defineEventHandler(async () => listProjects(await useDb()))
