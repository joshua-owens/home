<script setup lang="ts">
definePageMeta({ layout: false })
const state = reactive({ username: '', password: '' })
const error = ref('')
const { fetch: refreshSession } = useUserSession()
async function submit() {
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: state })
    await refreshSession()
    navigateTo('/')
  } catch { error.value = 'Invalid username or password' }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <UCard class="w-80">
      <template #header><h1 class="font-semibold">House — Sign in</h1></template>
      <form class="space-y-4" @submit.prevent="submit">
        <UInput v-model="state.username" placeholder="Username" autofocus />
        <UInput v-model="state.password" type="password" placeholder="Password" />
        <UAlert v-if="error" color="error" :title="error" />
        <UButton type="submit" block>Sign in</UButton>
      </form>
    </UCard>
  </div>
</template>
