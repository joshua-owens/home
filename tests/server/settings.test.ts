import { describe, it, expect } from 'vitest'
import { createDataSource } from '../../server/database/data-source'
import { HouseholdSettings } from '../../server/database/entities'
import { updateSettings, initializeSettings } from '../../server/utils/settings'

describe('settings', () => {
  it('performs a true partial update - only overwrites fields present in the patch', async () => {
    const db = await createDataSource(':memory:')

    // Initialize settings with both fields
    await initializeSettings(db, { region: 'US-West', houseFacts: 'Built in 1985' })

    // Patch only region
    const updated = await updateSettings(db, { region: 'US-East' })

    // Verify region was updated
    expect(updated.region).toBe('US-East')
    // Verify houseFacts was NOT blanked out
    expect(updated.houseFacts).toBe('Built in 1985')

    await db.destroy()
  })

  it('patches houseFacts while preserving region', async () => {
    const db = await createDataSource(':memory:')

    await initializeSettings(db, { region: 'US-West', houseFacts: 'Built in 1985' })

    const updated = await updateSettings(db, { houseFacts: 'Renovated in 2020' })

    expect(updated.region).toBe('US-West')
    expect(updated.houseFacts).toBe('Renovated in 2020')

    await db.destroy()
  })

  it('can patch both fields at once', async () => {
    const db = await createDataSource(':memory:')

    await initializeSettings(db, { region: 'US-West', houseFacts: 'Built in 1985' })

    const updated = await updateSettings(db, { region: 'US-East', houseFacts: 'Renovated in 2020' })

    expect(updated.region).toBe('US-East')
    expect(updated.houseFacts).toBe('Renovated in 2020')

    await db.destroy()
  })
})
