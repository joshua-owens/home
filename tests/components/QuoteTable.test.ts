import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import QuoteTable from '../../app/components/QuoteTable.vue'

const quotes = [
  { id: 1, companyName: 'HVAC Co', amount: 8000, status: 'pending', expired: true, scopeNotes: '', contactInfo: '', validUntil: '2026-01-01', dateReceived: null, projectId: 1 },
  { id: 2, companyName: 'CoolAir', amount: 9500, status: 'accepted', expired: false, scopeNotes: '', contactInfo: '', validUntil: null, dateReceived: null, projectId: 1 },
]
const stubs = { UBadge: { template: '<span><slot /></span>' }, UButton: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' } }

describe('QuoteTable', () => {
  it('shows an expired badge only for expired quotes', () => {
    const w = mount(QuoteTable, { props: { quotes }, global: { stubs } })
    const rows = w.findAll('tbody tr')
    expect(rows[0]!.text()).toContain('expired')
    expect(rows[1]!.text()).not.toContain('expired')
  })

  it('emits accept with the quote id', async () => {
    const w = mount(QuoteTable, { props: { quotes }, global: { stubs } })
    await w.find('[data-test="accept-1"]').trigger('click')
    expect(w.emitted('accept')).toEqual([[1]])
  })
})
