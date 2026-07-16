<script setup lang="ts">
const props = defineProps<{ projectId: number }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()
const state = reactive({ companyName: '', contactInfo: '', amount: 0, scopeNotes: '', dateReceived: '', validUntil: '' })
const toast = useToast()
async function submit() {
  try {
    await $fetch('/api/quotes', { method: 'POST', body: { ...state, amount: Number(state.amount), projectId: props.projectId, dateReceived: state.dateReceived || undefined, validUntil: state.validUntil || undefined } })
    open.value = false
    emit('created')
  } catch (submitError) {
    const message = (submitError as { data?: { statusMessage?: string } }).data?.statusMessage
    toast.add({ title: message ?? 'Failed to create quote', color: 'error' })
  }
}
</script>

<template>
  <UModal v-model:open="open" title="New quote">
    <template #body>
      <form class="space-y-3" @submit.prevent="submit">
        <UInput v-model="state.companyName" placeholder="Company" autofocus />
        <UInput v-model="state.contactInfo" placeholder="Contact info" />
        <UInput v-model.number="state.amount" type="number" step="0.01" placeholder="Amount ($)" />
        <UTextarea v-model="state.scopeNotes" placeholder="Scope notes" />
        <UInput v-model="state.dateReceived" type="date" />
        <UInput v-model="state.validUntil" type="date" />
        <UButton type="submit" block>Add quote</UButton>
      </form>
    </template>
  </UModal>
</template>
