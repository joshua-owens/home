// Lockout escape hatch: run inside the container.
// Usage: node scripts/reset-password.mjs <username> <new-password>
import Database from 'better-sqlite3'
import { randomBytes, scryptSync } from 'node:crypto'
import { join } from 'node:path'

const [username, password] = process.argv.slice(2)
if (!username || !password || password.length < 8) {
  console.error('Usage: node scripts/reset-password.mjs <username> <new-password (min 8 chars)>')
  process.exit(1)
}
const dataDir = process.env.NUXT_DATA_DIR ?? '/data'
const db = new Database(join(dataDir, 'sqlite.db'))
const salt = randomBytes(16).toString('hex')
const hash = `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
const result = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(hash, username.toLowerCase())
console.log(result.changes ? `Password reset for ${username}` : `No user named ${username}`)
process.exit(result.changes ? 0 : 1)
