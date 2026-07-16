import { join } from 'node:path'
export function uploadsDir(): string {
  return join(useRuntimeConfig().dataDir, 'uploads')
}
