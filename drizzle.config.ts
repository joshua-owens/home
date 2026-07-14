import type { Config } from 'drizzle-kit'

export default {
  schema: './server/database/schema.ts',
  out: './drizzle',
  driver: 'better-sqlite',
  dbCredentials: {
    url: './data/sqlite.db',
  },
} satisfies Config
