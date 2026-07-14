import { HouseholdSettings } from '../database/entities'
export default defineEventHandler(async (event) => {
  const body = await readBody<{ region?: string; houseFacts?: string }>(event)
  const repo = (await useDb()).getRepository(HouseholdSettings)
  const existing = await repo.findOneBy({ id: 1 })
  return repo.save({ ...existing, id: 1, region: body.region ?? '', houseFacts: body.houseFacts ?? '' })
})
