<script setup lang="ts">
const { user, clear } = useUserSession()
async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  navigateTo('/login')
}
const links = [
  { label: 'Dashboard', icon: 'i-lucide-home', to: '/' },
  { label: 'Projects', icon: 'i-lucide-hammer', to: '/projects' },
  { label: 'Expenses', icon: 'i-lucide-receipt', to: '/expenses' },
  { label: 'Inventory', icon: 'i-lucide-package', to: '/inventory' },
  { label: 'Settings', icon: 'i-lucide-settings', to: '/settings' },
]
</script>

<template>
  <div class="flex min-h-screen">
    <aside class="w-56 border-r border-default p-4 flex flex-col gap-2 max-md:hidden">
      <div class="font-bold mb-4">🏠 House</div>
      <UNavigationMenu orientation="vertical" :items="links" />
      <div class="mt-auto text-sm">
        <div class="mb-2">{{ user?.displayName }}</div>
        <UButton variant="ghost" size="sm" icon="i-lucide-log-out" @click="logout">Log out</UButton>
      </div>
    </aside>
    <main class="flex-1 p-6 overflow-x-auto">
      <div class="md:hidden mb-4 flex items-center justify-between gap-2">
        <UNavigationMenu :items="links" />
        <UButton variant="ghost" size="sm" icon="i-lucide-log-out" :title="`Log out ${user?.displayName ?? ''}`" @click="logout" />
      </div>
      <slot />
    </main>
  </div>
</template>
