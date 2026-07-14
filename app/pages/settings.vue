<script setup lang="ts">
const { data: settings } = await useFetch('/api/settings')
const { data: userList, refresh: refreshUsers } = await useFetch('/api/users')
const { data: cats, refresh: refreshCats } = await useFetch('/api/categories')
const toast = useToast()
const household = reactive({ region: settings.value?.region ?? '', houseFacts: settings.value?.houseFacts ?? '' })
const newCat = ref('')
const newUser = reactive({ username: '', password: '', displayName: '' })
const resetTarget = ref<{ id: number; password: string } | null>(null)

async function saveHousehold() {
  await $fetch('/api/settings', { method: 'PATCH', body: household })
  toast.add({ title: 'Household settings saved' })
}
async function addCategory() {
  if (!newCat.value.trim()) return
  await $fetch('/api/categories', { method: 'POST', body: { name: newCat.value } })
  newCat.value = ''
  await refreshCats()
}
async function addUser() {
  try {
    await $fetch('/api/users', { method: 'POST', body: newUser })
    Object.assign(newUser, { username: '', password: '', displayName: '' })
    await refreshUsers()
    toast.add({ title: 'Account created' })
  } catch (e: any) { toast.add({ title: e?.data?.statusMessage ?? 'Failed', color: 'error' }) }
}
async function resetPassword() {
  if (!resetTarget.value) return
  try {
    await $fetch(`/api/users/${resetTarget.value.id}/password`, { method: 'POST', body: { password: resetTarget.value.password } })
    toast.add({ title: 'Password updated' })
    resetTarget.value = null
  } catch (e: any) { toast.add({ title: e?.data?.statusMessage ?? 'Failed', color: 'error' }) }
}
</script>

<template>
  <div class="max-w-xl space-y-8">
    <h1 class="text-2xl font-bold">Settings</h1>
    <UCard>
      <template #header>Household (used by AI research)</template>
      <form class="space-y-3" @submit.prevent="saveHousehold">
        <UInput v-model="household.region" placeholder="Region / metro / ZIP, e.g. Boston, MA" />
        <UTextarea v-model="household.houseFacts" placeholder="House facts: year built, sq ft, etc." />
        <UButton type="submit">Save</UButton>
      </form>
    </UCard>
    <UCard>
      <template #header>Expense categories</template>
      <div class="flex flex-wrap gap-2 mb-3"><UBadge v-for="c in cats" :key="c.id" variant="subtle">{{ c.name }}</UBadge></div>
      <form class="flex gap-2" @submit.prevent="addCategory">
        <UInput v-model="newCat" placeholder="New category" class="flex-1" />
        <UButton type="submit">Add</UButton>
      </form>
    </UCard>
    <UCard>
      <template #header>Accounts</template>
      <div v-for="u in userList" :key="u.id" class="flex items-center gap-2 py-1">
        <span class="flex-1">{{ u.displayName }} <span class="text-dimmed">({{ u.username }})</span></span>
        <UButton size="xs" variant="ghost" @click="resetTarget = { id: u.id, password: '' }">Reset password</UButton>
      </div>
      <form class="flex gap-2 mt-4" @submit.prevent="addUser">
        <UInput v-model="newUser.displayName" placeholder="Name" />
        <UInput v-model="newUser.username" placeholder="Username" />
        <UInput v-model="newUser.password" type="password" placeholder="Password" />
        <UButton type="submit">Add</UButton>
      </form>
      <UModal :open="!!resetTarget" title="Reset password" @update:open="resetTarget = null">
        <template #body>
          <form class="space-y-3" @submit.prevent="resetPassword">
            <UInput v-if="resetTarget" v-model="resetTarget.password" type="password" placeholder="New password (min 8 chars)" autofocus />
            <UButton type="submit" block>Set password</UButton>
          </form>
        </template>
      </UModal>
    </UCard>
  </div>
</template>
