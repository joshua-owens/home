<script setup lang="ts">
import type { Project } from '~~/server/database/entities'
const props = defineProps<{ projects: Project[]; draggable?: boolean }>()
const emit = defineEmits<{ reorder: [orderedIds: number[]] }>()
const dragIndex = ref<number | null>(null)
const items = computed(() => props.projects)

function onDrop(targetIndex: number) {
  if (dragIndex.value === null || dragIndex.value === targetIndex) return
  const ids = items.value.map(p => p.id)
  const [moved] = ids.splice(dragIndex.value, 1)
  ids.splice(targetIndex, 0, moved!)
  emit('reorder', ids)
  dragIndex.value = null
}
const statusColor: Record<string, string> = {
  idea: 'neutral', on_hold: 'warning', researching: 'info',
  quoting: 'info', in_progress: 'primary', done: 'success',
}
</script>

<template>
  <ul class="space-y-2">
    <li v-for="(p, i) in items" :key="p.id"
        :draggable="draggable" class="cursor-pointer"
        @dragstart="dragIndex = i" @dragover.prevent @drop="onDrop(i)">
      <UCard @click="navigateTo(`/projects/${p.id}`)">
        <div class="flex items-center gap-3">
          <UIcon v-if="draggable" name="i-lucide-grip-vertical" class="text-dimmed" />
          <span class="font-medium flex-1">{{ p.name }}</span>
          <UBadge :color="statusColor[p.status]" variant="subtle">{{ p.status.replace('_', ' ') }}</UBadge>
        </div>
      </UCard>
    </li>
  </ul>
</template>
