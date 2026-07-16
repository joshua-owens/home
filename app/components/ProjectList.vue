<script setup lang="ts">
import type { Project } from '~~/server/database/entities'
const props = defineProps<{ projects: Project[]; draggable?: boolean }>()
const emit = defineEmits<{ reorder: [orderedIds: number[]] }>()
const dragIndex = ref<number | null>(null)
const items = computed(() => props.projects)

function onDrop(targetIndex: number) {
  if (dragIndex.value === null || dragIndex.value === targetIndex) return
  const ids = items.value.map(project => project.id)
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
    <li v-for="(project, index) in items" :key="project.id"
        :draggable="draggable" class="cursor-pointer"
        @dragstart="dragIndex = index" @dragover.prevent @drop="onDrop(index)">
      <UCard @click="navigateTo(`/projects/${project.id}`)">
        <div class="flex items-center gap-3">
          <UIcon v-if="draggable" name="i-lucide-grip-vertical" class="text-dimmed" />
          <span class="font-medium flex-1">{{ project.name }}</span>
          <UBadge :color="statusColor[project.status]" variant="subtle">{{ project.status.replace('_', ' ') }}</UBadge>
        </div>
      </UCard>
    </li>
  </ul>
</template>
