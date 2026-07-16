import { listReports } from '../../../utils/research'
export default defineEventHandler(async (event) =>
  listReports(await useDb(), Number(getRouterParam(event, 'id'))))
