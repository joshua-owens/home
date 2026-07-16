import { dashboardData } from '../utils/dashboard'
export default defineEventHandler(async () => dashboardData(await useDb()))
