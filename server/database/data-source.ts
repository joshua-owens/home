import 'reflect-metadata'
import { join } from 'node:path'
import { DataSource } from 'typeorm'
import { entities, Category, HouseholdSettings } from './entities'
import { InitSchema1720000000000 } from './migrations/1720000000000-InitSchema'

const DEFAULT_CATEGORIES = ['maintenance', 'improvement', 'utilities', 'appliance', 'other']

export function makeDataSource(database: string): DataSource {
  return new DataSource({
    type: 'better-sqlite3',
    database,
    entities,
    migrations: [InitSchema1720000000000],
    synchronize: false,     // schema comes only from migrations
    migrationsRun: true,    // apply pending migrations on initialize()
    prepareDatabase: (db) => {
      db.pragma('journal_mode = WAL')
      db.pragma('foreign_keys = ON')
    },
  })
}

async function seed(ds: DataSource): Promise<void> {
  await ds.getRepository(Category).createQueryBuilder()
    .insert().orIgnore().values(DEFAULT_CATEGORIES.map(name => ({ name }))).execute()
  await ds.getRepository(HouseholdSettings).createQueryBuilder()
    .insert().orIgnore().values({ id: 1 }).execute()
}

export async function createDataSource(path: string): Promise<DataSource> {
  const ds = makeDataSource(path)
  await ds.initialize()   // runs migrations (migrationsRun: true)
  await seed(ds)          // INSERT-OR-IGNORE default categories + settings singleton
  return ds
}

// Default export for the TypeORM CLI (`npm run migration:generate|run`).
export default makeDataSource(join(process.env.NUXT_DATA_DIR ?? './data', 'sqlite.db'))
