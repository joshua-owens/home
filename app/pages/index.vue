<script setup lang="ts">
const { data: d, refresh } = await useFetch('/api/dashboard')
const toast = useToast()
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
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
      <ProjectList :projects="d?.active ?? []" draggable @reorder="ids => reorder('active', ids)" />
      <h2 class="font-semibold my-3">Backlog</h2>
      <ProjectList :projects="d?.backlog ?? []" draggable @reorder="ids => reorder('backlog', ids)" />
    </section>
    <section class="space-y-6">
      <UCard v-if="d?.expiringQuotes.length">
        <template #header>⏳ Quotes expiring soon</template>
        <div v-for="q in d.expiringQuotes" :key="q.id" class="text-sm py-1">
          <b>{{ q.companyName }}</b> ({{ q.projectName }}) — {{ fmt(q.amount) }}, valid until {{ q.validUntil }}
        </div>
      </UCard>
      <UCard v-if="d?.expiringWarranties.length">
        <template #header>🛡️ Warranties expiring within 60 days</template>
        <div v-for="i in d.expiringWarranties" :key="i.id" class="text-sm py-1">
          <b>{{ i.name }}</b> — expires {{ i.warrantyExpiry }}
        </div>
      </UCard>
      <UCard>
        <template #header>Recent expenses</template>
        <div v-for="e in d?.recentExpenses ?? []" :key="e.id" class="text-sm py-1 flex justify-between">
          <span>{{ e.date }} — {{ e.vendor }}</span><span>{{ fmt(e.amount) }}</span>
        </div>
        <p v-if="!d?.recentExpenses.length" class="text-dimmed text-sm">No expenses yet.</p>
      </UCard>
    </section>
  </div>
</template>
