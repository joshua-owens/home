import { User } from '../../../database/entities'
import { hashPw } from '../../../utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ password: string }>(event)
  if (!body?.password || body.password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Password min 8 chars' })
  const id = Number(getRouterParam(event, 'id'))
  const res = await (await useDb()).getRepository(User).update(id, { passwordHash: hashPw(body.password) })
  if (!res.affected) throw createError({ statusCode: 404, statusMessage: 'User not found' })
  return { ok: true }
})
