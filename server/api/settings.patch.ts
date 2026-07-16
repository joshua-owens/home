import { updateSettings } from '../utils/settings'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ region?: string; houseFacts?: string }>(event)
  const db = await useDb()
  return updateSettings(db, body)
})
