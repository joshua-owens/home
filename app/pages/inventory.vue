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

  // Build local date strings for lexical comparison (YYYY-MM-DD)
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const todayString = `${year}-${month}-${day}`

  // Calculate +60 days from today
  const plus60Date = new Date(now)
  plus60Date.setDate(plus60Date.getDate() + 60)
  const plus60Year = plus60Date.getFullYear()
  const plus60Month = String(plus60Date.getMonth() + 1).padStart(2, '0')
  const plus60Day = String(plus60Date.getDate()).padStart(2, '0')
  const plus60String = `${plus60Year}-${plus60Month}-${plus60Day}`

  if (expiry < todayString) return { label: 'warranty expired', color: 'warning' }
  if (expiry <= plus60String) return { label: 'warranty expiring', color: 'warning' }
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
