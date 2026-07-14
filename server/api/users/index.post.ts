import { createUser } from '../../utils/users'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string; displayName: string }>(event)
  if (!body?.username || !body?.password || body.password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Username and password (min 8 chars) required' })
  const u = await createUser(await useDb(), { ...body, displayName: body.displayName || body.username })
  return { id: u.id, username: u.username, displayName: u.displayName }
})
