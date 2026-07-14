<script setup lang="ts">
const route = useRoute()
const id = Number(route.params.id)
const { data: project, refresh: refreshProject } = await useFetch(`/api/projects/${id}`)
const showDeclined = ref(false)
const { data: quotes, refresh: refreshQuotes } = await useFetch(`/api/projects/${id}/quotes`, { query: computed(() => ({ includeDeclined: String(showDeclined.value) })) })
const { data: spend, refresh: refreshSpend } = await useFetch(`/api/projects/${id}/spend`)
const { data: expenses, refresh: refreshExpenses } = await useFetch('/api/expenses', { query: { projectId: id } })
const showNewQuote = ref(false)
const statuses = ['idea', 'researching', 'quoting', 'in_progress', 'on_hold', 'done']
const toast = useToast()
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

async function setStatus(status: string) {
  await $fetch(`/api/projects/${id}`, { method: 'PATCH', body: { status } })
  await refreshProject()
}
async function setQuoteStatus(quoteId: number, status: string) {
  await $fetch(`/api/quotes/${quoteId}`, { method: 'PATCH', body: { status } })
  await Promise.all([refreshQuotes(), refreshSpend()])
}
async function removeProject() {
  await $fetch(`/api/projects/${id}`, { method: 'DELETE' })
  toast.add({ title: 'Project deleted' })
  navigateTo('/projects')
}
const tabs = [
  { label: 'Overview', slot: 'overview' }, { label: 'Quotes', slot: 'quotes' },
  { label: 'Expenses', slot: 'expenses' }, { label: 'Research', slot: 'research' },
]
</script>

<template>
  <div v-if="project" class="max-w-3xl space-y-6">
    <div class="flex items-center gap-3">
      <h1 class="text-2xl font-bold flex-1">{{ project.name }}</h1>
      <USelect :model-value="project.status" :items="statuses" @update:model-value="setStatus" />
      <ConfirmDelete :label="`project “${project.name}”`" @confirm="removeProject" />
    </div>
    <UTabs :items="tabs">
      <template #overview>
        <p class="whitespace-pre-wrap py-4">{{ project.description || 'No description.' }}</p>
        <AttachmentList owner-type="project" :owner-id="id" />
      </template>
      <template #quotes>
        <div class="py-4 space-y-4">
          <div class="flex items-center justify-between">
            <USwitch v-model="showDeclined" label="Show declined" />
            <UButton icon="i-lucide-plus" size="sm" @click="showNewQuote = true">New quote</UButton>
          </div>
          <QuoteTable :quotes="quotes ?? []"
            @accept="qid => setQuoteStatus(qid, 'accepted')"
            @decline="qid => setQuoteStatus(qid, 'declined')"
            @revive="qid => setQuoteStatus(qid, 'pending')" />
          <QuoteFormModal v-model:open="showNewQuote" :project-id="id" @created="refreshQuotes(); refreshSpend()" />
        </div>
      </template>
      <template #expenses>
        <div class="py-4 space-y-4">
          <UAlert v-if="spend" :title="`Spent ${fmt(spend.spent)} of ${fmt(spend.quoted)} accepted quotes`"
            :color="spend.spent > spend.quoted ? 'warning' : 'info'" variant="subtle" />
          <ul class="text-sm space-y-1">
            <li v-for="e in expenses" :key="e.id" class="flex justify-between border-b border-default py-1">
              <span>{{ e.date }} — {{ e.vendor }} {{ e.note && `(${e.note})` }}</span><span>{{ fmt(e.amount) }}</span>
            </li>
          </ul>
          <p class="text-dimmed text-sm">Add expenses from the Expenses page and link them to this project.</p>
        </div>
      </template>
      <template #research>
        <div class="py-4"><ResearchPanel :project-id="id" /></div>
      </template>
    </UTabs>
  </div>
</template>
