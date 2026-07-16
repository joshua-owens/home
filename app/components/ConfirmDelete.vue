<script setup lang="ts">
defineProps<{ label: string }>()
const emit = defineEmits<{ confirm: [] }>()
const open = ref(false)
</script>

<template>
  <UButton color="error" variant="ghost" size="xs" icon="i-lucide-trash-2" @click="open = true" />
  <UModal v-model:open="open" :title="`Delete ${label}?`">
    <template #body>
      <p class="mb-4">This permanently deletes {{ label }} and its files. There is no undo.</p>
      <div class="flex gap-2 justify-end">
        <UButton variant="ghost" @click="open = false">Cancel</UButton>
        <UButton color="error" @click="open = false; emit('confirm')">Delete</UButton>
      </div>
    </template>
  </UModal>
</template>
