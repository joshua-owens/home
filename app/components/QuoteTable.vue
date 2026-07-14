<script setup lang="ts">
type QuoteRow = { id: number; companyName: string; contactInfo: string; amount: number; scopeNotes: string; validUntil: string | null; status: string; expired: boolean }
defineProps<{ quotes: QuoteRow[] }>()
defineEmits<{ accept: [id: number]; decline: [id: number]; revive: [id: number] }>()
const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
</script>

<template>
  <table class="w-full text-sm">
    <thead>
      <tr class="text-left border-b border-default">
        <th class="py-2">Company</th><th>Amount</th><th>Scope</th><th>Valid until</th><th>Status</th><th />
      </tr>
    </thead>
    <tbody>
      <tr v-for="q in quotes" :key="q.id" class="border-b border-default">
        <td class="py-2 font-medium">{{ q.companyName }}<div class="text-dimmed text-xs">{{ q.contactInfo }}</div></td>
        <td>{{ fmt(q.amount) }}</td>
        <td class="max-w-48 truncate">{{ q.scopeNotes }}</td>
        <td>
          {{ q.validUntil ?? '—' }}
          <UBadge v-if="q.expired" color="warning" variant="subtle">expired</UBadge>
        </td>
        <td><UBadge :color="q.status === 'accepted' ? 'success' : q.status === 'declined' ? 'neutral' : 'info'" variant="subtle">{{ q.status }}</UBadge></td>
        <td class="text-right space-x-1">
          <UButton v-if="q.status !== 'accepted'" size="xs" :data-test="`accept-${q.id}`" @click="$emit('accept', q.id)">Accept</UButton>
          <UButton v-if="q.status !== 'declined'" size="xs" variant="ghost" :data-test="`decline-${q.id}`" @click="$emit('decline', q.id)">Decline</UButton>
          <UButton v-else size="xs" variant="ghost" :data-test="`revive-${q.id}`" @click="$emit('revive', q.id)">Revive</UButton>
        </td>
      </tr>
    </tbody>
  </table>
</template>
