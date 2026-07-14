import { projectSpend } from '../../../utils/expenses'
export default defineEventHandler(async (event) =>
  projectSpend(await useDb(), Number(getRouterParam(event, 'id'))))
