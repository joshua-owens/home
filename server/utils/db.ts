import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import type { DataSource } from 'typeorm'
import { createDataSource } from '../database/data-source'

export type Db = DataSource

let _dbPromise: Promise<DataSource> | null = null

// Promise-cached singleton: concurrent first requests share one initialize().
export function useDb(): Promise<DataSource> {
  if (!_dbPromise) {
    const dataDir = useRuntimeConfig().dataDir
    mkdirSync(join(dataDir, 'uploads'), { recursive: true })
    _dbPromise = createDataSource(join(dataDir, 'sqlite.db'))
  }
  return _dbPromise
}
