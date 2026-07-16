import { defineConfig } from 'vitest/config'
export default defineConfig({
  // Vite 8 transforms TS with oxc; TypeORM entities need legacy decorator
  // emission (native-decorator output breaks reflect-metadata). Do not remove.
  oxc: {
    typescript: {
      experimentalDecorators: true,
    },
    decorator: {
      legacy: true,
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
})
