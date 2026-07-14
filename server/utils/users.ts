import 'reflect-metadata'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { User } from '../database/entities'
import type { Db } from './db'

export function hashPw(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

export function verifyPw(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex'))
}

export async function createUser(db: Db, input: { username: string; password: string; displayName: string }): Promise<User> {
  const repo = db.getRepository(User)
  return repo.save(repo.create({
    username: input.username.trim().toLowerCase(),
    passwordHash: hashPw(input.password),
    displayName: input.displayName,
  }))
}

export async function authenticate(db: Db, username: string, password: string): Promise<User | null> {
  const u = await db.getRepository(User).findOneBy({ username: username.trim().toLowerCase() })
  if (!u || !verifyPw(password, u.passwordHash)) return null
  return u
}

export async function countUsers(db: Db): Promise<number> {
  return db.getRepository(User).count()
}
