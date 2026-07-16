<script setup lang="ts">
const { data: items, refresh } = await useFetch('/api/inventory')
const search = ref('')
const showNew = ref(false)
const filtered = computed(() => {
  const searchText = search.value.toLowerCase()
  return (items.value ?? []).filter(item =>
    [item.name, item.location, item.brand, item.model].join(' ').toLowerCase().includes(searchText))
})
function warrantyBadge(expiry: string | null): { label: string; color: string } | null {
  if (!expiry) return null

  // Compare lexically against local YYYY-MM-DD strings
  const now = new Date()
  const today = localDateString(now)
  const inSixtyDays = new Date(now)
  inSixtyDays.setDate(inSixtyDays.getDate() + 60)

  if (expiry < today) return { label: 'warranty expired', color: 'warning' }
  if (expiry <= localDateString(inSixtyDays)) return { label: 'warranty expiring', color: 'warning' }
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
    <UCard v-for="item in filtered" :key="item.id">
      <div class="flex items-center gap-3">
        <div class="flex-1">
          <div class="font-medium">{{ item.name }}</div>
          <div class="text-sm text-dimmed">{{ [item.brand, item.model, item.location].filter(Boolean).join(' · ') }}</div>
        </div>
        <UBadge v-if="warrantyBadge(item.warrantyExpiry)" :color="warrantyBadge(item.warrantyExpiry)!.color" variant="subtle">
          {{ warrantyBadge(item.warrantyExpiry)!.label }}
        </UBadge>
        <ConfirmDelete :label="item.name" @confirm="remove(item.id)" />
      </div>
      <AttachmentList class="mt-3" owner-type="inventory_item" :owner-id="item.id" />
    </UCard>
    <InventoryFormModal v-model:open="showNew" @created="refresh()" />
  </div>
</template>
