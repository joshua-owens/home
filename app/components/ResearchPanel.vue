<script setup lang="ts">
import { marked } from 'marked'
const props = defineProps<{ projectId: number }>()
const { data: reports, refresh } = await useFetch(`/api/projects/${props.projectId}/research`)
const toast = useToast()
const hasPending = computed(() => reports.value?.some(r => r.status === 'pending') ?? false)

let timer: ReturnType<typeof setInterval> | null = null
watch(hasPending, (pending) => {
  if (pending && !timer) timer = setInterval(refresh, 3000)
  if (!pending && timer) { clearInterval(timer); timer = null }
}, { immediate: true })
onUnmounted(() => { if (timer) clearInterval(timer) })

async function run() {
  try {
    await $fetch(`/api/projects/${props.projectId}/research`, { method: 'POST' })
    await refresh()
  } catch (e: any) {
    toast.add({ title: e?.data?.statusMessage ?? 'Failed to start research', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <UButton icon="i-lucide-sparkles" :loading="hasPending" :disabled="hasPending" @click="run">
      {{ hasPending ? 'Researching…' : 'Run research' }}
    </UButton>
    <UCard v-for="r in reports" :key="r.id">
      <template #header>
        <div class="flex items-center gap-2 text-sm">
          <UBadge :color="r.status === 'complete' ? 'success' : r.status === 'failed' ? 'error' : 'info'" variant="subtle">{{ r.status }}</UBadge>
          <span class="text-dimmed">{{ new Date(r.createdAt).toLocaleString() }} · {{ r.model }}</span>
        </div>
      </template>
      <UAlert v-if="r.status === 'failed'" color="error" :title="r.error ?? 'Unknown error'" />
      <div v-else-if="r.status === 'complete'" class="prose prose-sm dark:prose-invert max-w-none" v-html="marked(r.body)" />
      <p v-else class="text-dimmed text-sm">Working…</p>
    </UCard>
  </div>
</template>
