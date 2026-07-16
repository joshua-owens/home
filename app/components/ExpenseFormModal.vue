<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()
const { data: lists } = await useFetch('/api/projects')
const { data: categories } = await useFetch('/api/categories')
const projectItems = computed(() => [
  { label: '— none (general home expense) —', value: 0 },
  ...(['active', 'backlog', 'done'] as const).flatMap(listName =>
    (lists.value?.[listName] ?? []).map(project => ({ label: project.name, value: project.id }))),
])
const categoryItems = computed(() => (categories.value ?? []).map(category => ({ label: category.name, value: category.id })))
const state = reactive({ amount: 0, date: new Date().toISOString().slice(0, 10), vendor: '', note: '', projectId: 0, categoryId: undefined as number | undefined })
const toast = useToast()
async function submit() {
  try {
    await $fetch('/api/expenses', { method: 'POST', body: { ...state, amount: Number(state.amount), projectId: state.projectId || undefined } })
    open.value = false
    emit('created')
  } catch (submitError) {
    const message = (submitError as { data?: { statusMessage?: string } }).data?.statusMessage
    toast.add({ title: message ?? 'Failed to create expense', color: 'error' })
  }
}
</script>

<template>
  <UModal v-model:open="open" title="New expense">
    <template #body>
      <form class="space-y-3" @submit.prevent="submit">
        <UInput v-model.number="state.amount" type="number" step="0.01" placeholder="Amount ($)" autofocus />
        <UInput v-model="state.date" type="date" />
        <UInput v-model="state.vendor" placeholder="Vendor" />
        <UInput v-model="state.note" placeholder="Note" />
        <USelect v-model="state.projectId" :items="projectItems" value-key="value" />
        <USelect v-model="state.categoryId" :items="categoryItems" value-key="value" placeholder="Category" />
        <UButton type="submit" block>Add expense</UButton>
      </form>
    </template>
  </UModal>
</template>
