<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [] }>()
const state = reactive({ name: '', description: '', status: 'idea' })
const statuses = ['idea', 'researching', 'quoting', 'in_progress', 'on_hold', 'done']
const toast = useToast()
async function submit() {
  try {
    await $fetch('/api/projects', { method: 'POST', body: state })
    open.value = false
    Object.assign(state, { name: '', description: '', status: 'idea' })
    emit('created')
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage ?? 'Failed to create project', color: 'error' })
  }
}
</script>

<template>
  <UModal v-model:open="open" title="New project">
    <template #body>
      <form class="space-y-4" @submit.prevent="submit">
        <UInput v-model="state.name" placeholder="Project name" autofocus />
        <UTextarea v-model="state.description" placeholder="Description" />
        <USelect v-model="state.status" :items="statuses" />
        <UButton type="submit" block>Create</UButton>
      </form>
    </template>
  </UModal>
</template>
