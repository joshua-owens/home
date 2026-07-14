<script setup lang="ts">
definePageMeta({ layout: false })
const state = reactive({ username: '', password: '', displayName: '' })
const error = ref('')
const { fetch: refreshSession } = useUserSession()
onMounted(async () => {
  const s = await $fetch('/api/auth/status')
  if (!s.needsSetup) navigateTo('/login')
})
async function submit() {
  error.value = ''
  try {
    await $fetch('/api/auth/setup', { method: 'POST', body: state })
    await refreshSession()
    navigateTo('/')
  } catch (e: any) { error.value = e?.data?.statusMessage ?? 'Setup failed' }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <UCard class="w-80">
      <template #header><h1 class="font-semibold">Welcome — create the first account</h1></template>
      <form class="space-y-4" @submit.prevent="submit">
        <UInput v-model="state.displayName" placeholder="Display name" autofocus />
        <UInput v-model="state.username" placeholder="Username" />
        <UInput v-model="state.password" type="password" placeholder="Password (min 8 chars)" />
        <UAlert v-if="error" color="error" :title="error" />
        <UButton type="submit" block>Create account</UButton>
      </form>
    </UCard>
  </div>
</template>
