<script setup lang="ts">
const { data: settings } = await useFetch('/api/settings')
const { data: userList, refresh: refreshUsers } = await useFetch('/api/users')
const { data: categories, refresh: refreshCategories } = await useFetch('/api/categories')
const toast = useToast()
const household = reactive({ region: settings.value?.region ?? '', houseFacts: settings.value?.houseFacts ?? '' })
const newCategory = ref('')
const newUser = reactive({ username: '', password: '', displayName: '' })
const resetTarget = ref<{ id: number; password: string } | null>(null)

async function saveHousehold() {
  await $fetch('/api/settings', { method: 'PATCH', body: household })
  toast.add({ title: 'Household settings saved' })
}
async function addCategory() {
  if (!newCategory.value.trim()) return
  await $fetch('/api/categories', { method: 'POST', body: { name: newCategory.value } })
  newCategory.value = ''
  await refreshCategories()
}
async function addUser() {
  try {
    await $fetch('/api/users', { method: 'POST', body: newUser })
    Object.assign(newUser, { username: '', password: '', displayName: '' })
    await refreshUsers()
    toast.add({ title: 'Account created' })
  } catch (addError) {
    const message = (addError as { data?: { statusMessage?: string } }).data?.statusMessage
    toast.add({ title: message ?? 'Failed to create account', color: 'error' })
  }
}
async function resetPassword() {
  if (!resetTarget.value) return
  try {
    await $fetch(`/api/users/${resetTarget.value.id}/password`, { method: 'POST', body: { password: resetTarget.value.password } })
    toast.add({ title: 'Password updated' })
    resetTarget.value = null
  } catch (resetError) {
    const message = (resetError as { data?: { statusMessage?: string } }).data?.statusMessage
    toast.add({ title: message ?? 'Failed to reset password', color: 'error' })
  }
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
      <div class="flex flex-wrap gap-2 mb-3"><UBadge v-for="category in categories" :key="category.id" variant="subtle">{{ category.name }}</UBadge></div>
      <form class="flex gap-2" @submit.prevent="addCategory">
        <UInput v-model="newCategory" placeholder="New category" class="flex-1" />
        <UButton type="submit">Add</UButton>
      </form>
    </UCard>
    <UCard>
      <template #header>Accounts</template>
      <div v-for="account in userList" :key="account.id" class="flex items-center gap-2 py-1">
        <span class="flex-1">{{ account.displayName }} <span class="text-dimmed">({{ account.username }})</span></span>
        <UButton size="xs" variant="ghost" @click="resetTarget = { id: account.id, password: '' }">Reset password</UButton>
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
