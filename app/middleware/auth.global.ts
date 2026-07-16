export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path === '/setup') return
  const { loggedIn, fetch: refresh } = useUserSession()
  await refresh()
  if (loggedIn.value) return
  const status = await $fetch('/api/auth/status')
  return navigateTo(status.needsSetup ? '/setup' : '/login')
})
