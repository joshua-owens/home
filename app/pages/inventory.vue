<script setup lang="ts">
const { data: items, refresh } = await useFetch('/api/inventory')
const search = ref('')
const showNew = ref(false)
const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return (items.value ?? []).filter(i => [i.name, i.location, i.brand, i.model].join(' ').toLowerCase().includes(q))
})
function warrantyBadge(expiry: string | null): { label: string; color: string } | null {
  if (!expiry) return null
  const days = (new Date(expiry).getTime() - Date.now()) / 86_400_000
  if (days < 0) return { label: 'warranty expired', color: 'neutral' }
  if (days <= 60) return { label: 'warranty expiring', color: 'warning' }
  return { label: 'under warranty', color: 'success' }
}
async function remove(id: number) {
  await $fetch(`/api/inventory/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="max-w-3xl space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Inventory</h1>
      <UButton icon="i-lucide-plus" @click="showNew = true">New item</UButton>
    </div>
    <UInput v-model="search" icon="i-lucide-search" placeholder="Search name, location, brand…" />
    <UCard v-for="i in filtered" :key="i.id">
      <div class="flex items-center gap-3">
        <div class="flex-1">
          <div class="font-medium">{{ i.name }}</div>
          <div class="text-sm text-dimmed">{{ [i.brand, i.model, i.location].filter(Boolean).join(' · ') }}</div>
        </div>
        <UBadge v-if="warrantyBadge(i.warrantyExpiry)" :color="warrantyBadge(i.warrantyExpiry)!.color" variant="subtle">
          {{ warrantyBadge(i.warrantyExpiry)!.label }}
        </UBadge>
        <ConfirmDelete :label="i.name" @confirm="remove(i.id)" />
      </div>
      <AttachmentList class="mt-3" owner-type="inventory_item" :owner-id="i.id" />
    </UCard>
    <InventoryFormModal v-model:open="showNew" @created="refresh()" />
  </div>
</template>
