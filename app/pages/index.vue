<script setup lang="ts">
const { data: dashboard, refresh } = await useFetch('/api/dashboard')
const toast = useToast()
async function reorder(list: 'backlog' | 'active', orderedIds: number[]) {
  try {
    await $fetch('/api/projects/reorder', { method: 'POST', body: { list, orderedIds } })
    await refresh()
  } catch { toast.add({ title: 'Reorder failed', color: 'error' }) }
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-2 max-w-5xl">
    <section>
      <h2 class="font-semibold mb-3">Active projects</h2>
      <ProjectList :projects="dashboard?.active ?? []" draggable @reorder="ids => reorder('active', ids)" />
      <h2 class="font-semibold my-3">Backlog</h2>
      <ProjectList :projects="dashboard?.backlog ?? []" draggable @reorder="ids => reorder('backlog', ids)" />
    </section>
    <section class="space-y-6">
      <UCard v-if="dashboard?.expiringQuotes.length">
        <template #header>⏳ Quotes expiring soon</template>
        <div v-for="quote in dashboard.expiringQuotes" :key="quote.id" class="text-sm py-1">
          <b>{{ quote.companyName }}</b> ({{ quote.projectName }}) — {{ formatCurrency(quote.amount) }}, valid until {{ quote.validUntil }}
        </div>
      </UCard>
      <UCard v-if="dashboard?.expiringWarranties.length">
        <template #header>🛡️ Warranties expiring within 60 days</template>
        <div v-for="item in dashboard.expiringWarranties" :key="item.id" class="text-sm py-1">
          <b>{{ item.name }}</b> — expires {{ item.warrantyExpiry }}
        </div>
      </UCard>
      <UCard>
        <template #header>Recent expenses</template>
        <div v-for="expense in dashboard?.recentExpenses ?? []" :key="expense.id" class="text-sm py-1 flex justify-between">
          <span>{{ expense.date }} — {{ expense.vendor }}</span><span>{{ formatCurrency(expense.amount) }}</span>
        </div>
        <p v-if="!dashboard?.recentExpenses.length" class="text-dimmed text-sm">No expenses yet.</p>
      </UCard>
    </section>
  </div>
</template>
