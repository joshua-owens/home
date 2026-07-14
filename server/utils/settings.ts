import { HouseholdSettings } from '../database/entities'
import type { Db } from './db'

const SINGLETON_ID = 1

export async function initializeSettings(db: Db, input: { region?: string; houseFacts?: string }): Promise<HouseholdSettings> {
  const repo = db.getRepository(HouseholdSettings)
  // Delete if exists (for testing), then create fresh
  await repo.delete(SINGLETON_ID)
  return repo.save(repo.create({
    id: SINGLETON_ID,
    region: input.region ?? '',
    houseFacts: input.houseFacts ?? '',
  }))
}

export async function updateSettings(db: Db, patch: { region?: string; houseFacts?: string }): Promise<HouseholdSettings> {
  const repo = db.getRepository(HouseholdSettings)

  // Load existing singleton (or create if doesn't exist)
  let existing = await repo.findOneBy({ id: SINGLETON_ID })
  if (!existing) {
    existing = await repo.save(repo.create({
      id: SINGLETON_ID,
      region: '',
      houseFacts: '',
    }))
  }

  // Only overwrite fields present in patch
  const updated: Partial<HouseholdSettings> = {}
  if (patch.region !== undefined) updated.region = patch.region
  if (patch.houseFacts !== undefined) updated.houseFacts = patch.houseFacts

  return repo.save({ ...existing, ...updated })
}
