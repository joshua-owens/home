<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()
const state = reactive({ name: '', location: '', brand: '', model: '', serial: '', purchaseDate: '', warrantyExpiry: '', notes: '' })
const toast = useToast()
async function submit() {
  try {
    await $fetch('/api/inventory', { method: 'POST', body: { ...state, purchaseDate: state.purchaseDate || undefined, warrantyExpiry: state.warrantyExpiry || undefined } })
    open.value = false
    emit('created')
  } catch (submitError) {
    const message = (submitError as { data?: { statusMessage?: string } }).data?.statusMessage
    toast.add({ title: message ?? 'Failed to create item', color: 'error' })
  }
}
</script>

<template>
  <UModal v-model:open="open" title="New inventory item">
    <template #body>
      <form class="space-y-3" @submit.prevent="submit">
        <UInput v-model="state.name" placeholder="Name" autofocus />
        <UInput v-model="state.location" placeholder="Location" />
        <UInput v-model="state.brand" placeholder="Brand" />
        <UInput v-model="state.model" placeholder="Model" />
        <UInput v-model="state.serial" placeholder="Serial" />
        <UInput v-model="state.purchaseDate" type="date" />
        <UInput v-model="state.warrantyExpiry" type="date" />
        <UTextarea v-model="state.notes" placeholder="Notes" />
        <UButton type="submit" block>Add item</UButton>
      </form>
    </template>
  </UModal>
</template>
