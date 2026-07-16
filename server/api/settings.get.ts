import { HouseholdSettings } from '../database/entities'
export default defineEventHandler(async () =>
  (await useDb()).getRepository(HouseholdSettings).findOneBy({ id: 1 }))
