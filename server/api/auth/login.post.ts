import { authenticate } from '../../utils/users'
export default defineEventHandler(async (event) => {
  const body = await readBody<{ username: string; password: string }>(event)
  const u = await authenticate(await useDb(), body?.username ?? '', body?.password ?? '')
  if (!u) throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' })
  await setUserSession(event, { user: { id: u.id, username: u.username, displayName: u.displayName } })
  return { ok: true }
})
