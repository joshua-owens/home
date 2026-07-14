import 'reflect-metadata'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    openrouterApiKey: '',       // NUXT_OPENROUTER_API_KEY
    researchModel: '',          // NUXT_RESEARCH_MODEL
    dataDir: './data',          // NUXT_DATA_DIR
  },
})
