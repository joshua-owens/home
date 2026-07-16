<script setup lang="ts">
const filters = reactive({ categoryId: undefined as number | undefined, projectId: 0, from: '', to: '' })
const query = computed(() => ({
  ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
  ...(filters.projectId ? { projectId: filters.projectId } : {}),
  ...(filters.from ? { from: filters.from } : {}),
  ...(filters.to ? { to: filters.to } : {}),
}))
const { data: expenses, refresh } = await useFetch('/api/expenses', { query })
const { data: categories } = await useFetch('/api/categories')
const { data: projects } = await useFetch('/api/projects')
const categoryItems = computed(() => [{ label: 'All categories', value: undefined }, ...(categories.value ?? []).map(category => ({ label: category.name, value: category.id }))])
const projectItems = computed(() => [
  { label: 'All projects', value: 0 },
  ...(['active', 'backlog', 'done'] as const).flatMap(listName =>
    (projects.value?.[listName] ?? []).map(project => ({ label: project.name, value: project.id }))),
])
const categoryName = (id: number | null) => categories.value?.find(category => category.id === id)?.name ?? ''
const total = computed(() => (expenses.value ?? []).reduce((sum, expense) => sum + expense.amount, 0))
const showNew = ref(false)
async function remove(id: number) {
  await $fetch(`/api/expenses/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="max-w-3xl space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Expenses</h1>
      <UButton icon="i-lucide-plus" @click="showNew = true">New expense</UButton>
    </div>
    <div class="flex gap-2 items-end">
      <USelect v-model="filters.projectId" :items="projectItems" value-key="value" class="w-44" />
      <USelect v-model="filters.categoryId" :items="categoryItems" value-key="value" class="w-44" />
      <UInput v-model="filters.from" type="date" /><UInput v-model="filters.to" type="date" />
      <div class="ml-auto font-semibold">Total: {{ formatCurrency(total) }}</div>
    </div>
    <table class="w-full text-sm">
      <thead><tr class="text-left border-b border-default"><th class="py-2">Date</th><th>Vendor</th><th>Category</th><th>Note</th><th class="text-right">Amount</th><th /></tr></thead>
      <tbody>
        <tr v-for="expense in expenses" :key="expense.id" class="border-b border-default">
          <td class="py-2">{{ expense.date }}</td><td>{{ expense.vendor }}</td><td>{{ categoryName(expense.categoryId) }}</td><td>{{ expense.note }}</td>
          <td class="text-right">{{ formatCurrency(expense.amount) }}</td>
          <td class="text-right"><ConfirmDelete :label="`expense ${formatCurrency(expense.amount)}`" @confirm="remove(expense.id)" /></td>
        </tr>
      </tbody>
    </table>
    <ExpenseFormModal v-model:open="showNew" @created="refresh()" />
  </div>
</template>
