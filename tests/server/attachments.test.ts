import { describe, it, expect } from 'vitest'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDataSource } from '../../server/database/data-source'
import { validateUpload, saveAttachment, deleteAttachmentsFor, listAttachments } from '../../server/utils/attachments'

describe('attachments', () => {
  it('validates size and mime type', () => {
    expect(validateUpload('a.pdf', 'application/pdf', 1000)).toBeNull()
    expect(validateUpload('a.png', 'image/png', 1000)).toBeNull()
    expect(validateUpload('a.exe', 'application/x-msdownload', 1000)).toMatch(/type/i)
    expect(validateUpload('a.pdf', 'application/pdf', 26 * 1024 * 1024)).toMatch(/25 MB/i)
  })

  it('saves file to disk and removes files on owner cleanup', async () => {
    const db = await createDataSource(':memory:')
    const dir = mkdtempSync(join(tmpdir(), 'uploads-'))
    const a = await saveAttachment(db, dir, { ownerType: 'quote', ownerId: 1, filename: 'quote.pdf', mimeType: 'application/pdf', data: Buffer.from('pdf!') })
    expect(existsSync(join(dir, a.diskPath))).toBe(true)
    expect(await listAttachments(db, 'quote', 1)).toHaveLength(1)
    await deleteAttachmentsFor(db, dir, 'quote', 1)
    expect(existsSync(join(dir, a.diskPath))).toBe(false)
    expect(await listAttachments(db, 'quote', 1)).toHaveLength(0)
    await db.destroy()
  })
})
