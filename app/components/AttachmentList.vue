<script setup lang="ts">
const props = defineProps<{ ownerType: string; ownerId: number }>()
const { data: files, refresh } = await useFetch('/api/attachments', { query: { ownerType: props.ownerType, ownerId: props.ownerId } })
const toast = useToast()
async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const form = new FormData()
  form.append('ownerType', props.ownerType)
  form.append('ownerId', String(props.ownerId))
  form.append('file', file)
  try {
    await $fetch('/api/attachments', { method: 'POST', body: form })
    await refresh()
  } catch (err: any) {
    toast.add({ title: err?.data?.statusMessage ?? 'Upload failed', color: 'error' })
  } finally { input.value = '' }
}
async function remove(id: number) {
  await $fetch(`/api/attachments/${id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="space-y-2">
    <div v-for="f in files" :key="f.id" class="flex items-center gap-2 text-sm">
      <a :href="`/api/attachments/${f.id}`" target="_blank" class="text-primary underline flex-1">{{ f.filename }}</a>
      <ConfirmDelete :label="f.filename" @confirm="remove(f.id)" />
    </div>
    <input type="file" accept="application/pdf,image/*,text/plain" @change="upload">
  </div>
</template>
