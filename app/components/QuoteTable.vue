<script setup lang="ts">
import { formatCurrency } from '../utils/format'
type QuoteRow = { id: number; companyName: string; contactInfo: string; amount: number; scopeNotes: string; validUntil: string | null; status: string; expired: boolean }
defineProps<{ quotes: QuoteRow[] }>()
defineEmits<{ accept: [id: number]; decline: [id: number]; revive: [id: number] }>()
</script>

<template>
  <table class="w-full text-sm">
    <thead>
      <tr class="text-left border-b border-default">
        <th class="py-2">Company</th><th>Amount</th><th>Scope</th><th>Valid until</th><th>Status</th><th />
      </tr>
    </thead>
    <tbody>
      <tr v-for="quote in quotes" :key="quote.id" class="border-b border-default">
        <td class="py-2 font-medium">{{ quote.companyName }}<div class="text-dimmed text-xs">{{ quote.contactInfo }}</div></td>
        <td>{{ formatCurrency(quote.amount) }}</td>
        <td class="max-w-48 truncate">{{ quote.scopeNotes }}</td>
        <td>
          {{ quote.validUntil ?? '—' }}
          <UBadge v-if="quote.expired" color="warning" variant="subtle">expired</UBadge>
        </td>
        <td><UBadge :color="quote.status === 'accepted' ? 'success' : quote.status === 'declined' ? 'neutral' : 'info'" variant="subtle">{{ quote.status }}</UBadge></td>
        <td class="text-right space-x-1">
          <UButton v-if="quote.status !== 'accepted'" size="xs" :data-test="`accept-${quote.id}`" @click="$emit('accept', quote.id)">Accept</UButton>
          <UButton v-if="quote.status !== 'declined'" size="xs" variant="ghost" :data-test="`decline-${quote.id}`" @click="$emit('decline', quote.id)">Decline</UButton>
          <UButton v-else size="xs" variant="ghost" :data-test="`revive-${quote.id}`" @click="$emit('revive', quote.id)">Revive</UButton>
        </td>
      </tr>
    </tbody>
  </table>
</template>
