import { describe, it, expect } from 'vitest'
import { createDataSource } from '../../server/database/data-source'
import { createUser, authenticate, countUsers } from '../../server/utils/users'

describe('users', () => {
  it('creates a user and authenticates with correct password only', async () => {
    const db = await createDataSource(':memory:')
    expect(await countUsers(db)).toBe(0)
    const u = await createUser(db, { username: 'jess', password: 'hunter22', displayName: 'Jess' })
    expect(u.username).toBe('jess')
    expect(u.passwordHash).not.toContain('hunter22')
    expect(await countUsers(db)).toBe(1)
    expect(await authenticate(db, 'jess', 'hunter22')).toMatchObject({ username: 'jess' })
    expect(await authenticate(db, 'jess', 'wrong')).toBeNull()
    expect(await authenticate(db, 'nobody', 'x')).toBeNull()
    await db.destroy()
  })
})
