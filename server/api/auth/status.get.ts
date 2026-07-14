import { countUsers } from '../../utils/users'
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  return { needsSetup: (await countUsers(await useDb())) === 0, loggedIn: !!session.user }
})
