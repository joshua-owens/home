// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  nitro: {
    // Nitro's dev/build pipeline compiles server TS via its rollup esbuild
    // plugin (not Vite/oxc). esbuild's default decorator emission is native
    // (ES) decorators, incompatible with TypeORM's legacy decorators +
    // reflect-metadata. Force legacy decorator emission, mirroring the
    // equivalent oxc fix in vitest.config.ts. Do not remove.
    esbuild: {
      options: {
        tsconfigRaw: {
          compilerOptions: {
            experimentalDecorators: true,
          },
        },
      },
    },
  },
  runtimeConfig: {
    openrouterApiKey: '',       // NUXT_OPENROUTER_API_KEY
    researchModel: '',          // NUXT_RESEARCH_MODEL
    dataDir: './data',          // NUXT_DATA_DIR
  },
})
