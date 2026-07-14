import { defineConfig } from 'vitest/config'
export default defineConfig({
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
