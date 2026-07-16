import { createFirstUser } from '../../utils/users'
export default defineEventHandler(async (event) => {
  const db = await useDb()
  const body = await readBody<{ username: string; password: string; displayName: string }>(event)
  if (!body?.username || !body?.password || body.password.length < 8)
    throw createError({ statusCode: 400, statusMessage: 'Username and password (min 8 chars) required' })
  const u = await createFirstUser(db, { ...body, displayName: body.displayName || body.username })
  if (!u) throw createError({ statusCode: 403, statusMessage: 'Setup already completed' })
  await setUserSession(event, { user: { id: u.id, username: u.username, displayName: u.displayName } })
  return { ok: true }
})
