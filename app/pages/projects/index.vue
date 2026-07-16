<script setup lang="ts">
const { data: lists, refresh } = await useFetch('/api/projects')
const showNew = ref(false)
const toast = useToast()
async function reorder(list: 'backlog' | 'active', orderedIds: number[]) {
  try {
    await $fetch('/api/projects/reorder', { method: 'POST', body: { list, orderedIds } })
    await refresh()
  } catch { toast.add({ title: 'Reorder failed', color: 'error' }) }
}
</script>

<template>
  <div class="space-y-8 max-w-2xl">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Projects</h1>
      <UButton icon="i-lucide-plus" @click="showNew = true">New project</UButton>
    </div>
    <section>
      <h2 class="font-semibold mb-3">Active</h2>
      <ProjectList :projects="lists?.active ?? []" draggable @reorder="ids => reorder('active', ids)" />
    </section>
    <section>
      <h2 class="font-semibold mb-3">Backlog</h2>
      <ProjectList :projects="lists?.backlog ?? []" draggable @reorder="ids => reorder('backlog', ids)" />
    </section>
    <UCollapsible>
      <UButton variant="ghost" trailing-icon="i-lucide-chevron-down">Done ({{ lists?.done.length ?? 0 }})</UButton>
      <template #content><ProjectList :projects="lists?.done ?? []" /></template>
    </UCollapsible>
    <ProjectFormModal v-model:open="showNew" @created="refresh()" />
  </div>
</template>
