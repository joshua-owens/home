import { Category } from '../../database/entities'
export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string }>(event)
  if (!body?.name?.trim()) throw createError({ statusCode: 400, statusMessage: 'name required' })
  const repo = (await useDb()).getRepository(Category)
  return repo.save(repo.create({ name: body.name.trim().toLowerCase() }))
})
