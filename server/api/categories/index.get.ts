import { Category } from '../../database/entities'
export default defineEventHandler(async () => (await useDb()).getRepository(Category).find())
