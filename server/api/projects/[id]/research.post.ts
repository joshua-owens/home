import OpenAI from 'openai'
import { runResearch } from '../../../utils/research'
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.openrouterApiKey || !config.researchModel)
    throw createError({ statusCode: 503, statusMessage: 'Research not configured: set NUXT_OPENROUTER_API_KEY and NUXT_RESEARCH_MODEL' })
  const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: config.openrouterApiKey })
  const projectId = Number(getRouterParam(event, 'id'))
  const db = await useDb()
  // Fire and forget: return immediately and let generation finish in the background.
  const promise = runResearch(db, projectId, { client, model: config.researchModel })
  promise.catch(() => {}) // failures are persisted on the row
  return { started: true }
})
