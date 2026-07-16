<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
// Report bodies are LLM output (which reads external content) — sanitize
// before v-html or a crafted response is an XSS into the user's session.
const renderMarkdown = (markdown: string) => DOMPurify.sanitize(marked.parse(markdown, { async: false }))
const props = defineProps<{ projectId: number }>()
const { data: reports, refresh } = await useFetch(`/api/projects/${props.projectId}/research`)
const toast = useToast()
const hasPending = computed(() => reports.value?.some(report => report.status === 'pending') ?? false)

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
  } catch (runError) {
    const message = (runError as { data?: { statusMessage?: string } }).data?.statusMessage
    toast.add({ title: message ?? 'Failed to start research', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <UButton icon="i-lucide-sparkles" :loading="hasPending" :disabled="hasPending" @click="run">
      {{ hasPending ? 'Researching…' : 'Run research' }}
    </UButton>
    <UCard v-for="report in reports" :key="report.id">
      <template #header>
        <div class="flex items-center gap-2 text-sm">
          <UBadge :color="report.status === 'complete' ? 'success' : report.status === 'failed' ? 'error' : 'info'" variant="subtle">{{ report.status }}</UBadge>
          <span class="text-dimmed">{{ new Date(report.createdAt).toLocaleString() }} · {{ report.model }}</span>
        </div>
      </template>
      <UAlert v-if="report.status === 'failed'" color="error" :title="report.error ?? 'Unknown error'" />
      <div v-else-if="report.status === 'complete'" class="prose prose-sm dark:prose-invert max-w-none" v-html="renderMarkdown(report.body)" />
      <p v-else class="text-dimmed text-sm">Working…</p>
    </UCard>
  </div>
</template>
