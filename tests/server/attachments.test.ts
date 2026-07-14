import { describe, it, expect } from 'vitest'
import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDataSource } from '../../server/database/data-source'
import { validateUpload, saveAttachment, deleteAttachmentsFor, listAttachments, isValidOwner } from '../../server/utils/attachments'

describe('attachments', () => {
  it('validates size and mime type', () => {
    expect(validateUpload('a.pdf', 'application/pdf', 1000)).toBeNull()
    expect(validateUpload('a.png', 'image/png', 1000)).toBeNull()
    expect(validateUpload('a.exe', 'application/x-msdownload', 1000)).toMatch(/type/i)
    expect(validateUpload('a.pdf', 'application/pdf', 26 * 1024 * 1024)).toMatch(/25 MB/i)
  })

  describe('strict mime validation', () => {
    it('accepts exact allowed mimetypes', () => {
      expect(validateUpload('a.pdf', 'application/pdf', 1000)).toBeNull()
      expect(validateUpload('a.txt', 'text/plain', 1000)).toBeNull()
    })

    it('accepts valid image mimetypes with subtype', () => {
      expect(validateUpload('a.png', 'image/png', 1000)).toBeNull()
      expect(validateUpload('a.jpg', 'image/jpeg', 1000)).toBeNull()
      expect(validateUpload('a.gif', 'image/gif', 1000)).toBeNull()
      expect(validateUpload('a.svg', 'image/svg+xml', 1000)).toBeNull()
      expect(validateUpload('a.webp', 'image/webp', 1000)).toBeNull()
    })

    it('rejects mime strings with parameters', () => {
      expect(validateUpload('a.png', 'image/png; charset=utf-8', 1000)).toMatch(/type/i)
      expect(validateUpload('a.pdf', 'application/pdf; version=1.4', 1000)).toMatch(/type/i)
      expect(validateUpload('a.txt', 'text/plain; charset=ISO-8859-1', 1000)).toMatch(/type/i)
    })

    it('rejects mime strings with whitespace', () => {
      expect(validateUpload('a.png', ' image/png', 1000)).toMatch(/type/i)
      expect(validateUpload('a.png', 'image/png ', 1000)).toMatch(/type/i)
      expect(validateUpload('a.pdf', 'application/pdf\t', 1000)).toMatch(/type/i)
    })

    it('rejects mime strings with CRLF injection', () => {
      expect(validateUpload('a.png', 'image/png\r\nX-Injected: 1', 1000)).toMatch(/type/i)
      expect(validateUpload('a.pdf', 'application/pdf\nContent-Type: text/html', 1000)).toMatch(/type/i)
      expect(validateUpload('a.txt', 'text/plain\rSet-Cookie: x=y', 1000)).toMatch(/type/i)
    })

    it('rejects path traversal in image mime', () => {
      expect(validateUpload('a.txt', 'image/../evil', 1000)).toMatch(/type/i)
      expect(validateUpload('a.txt', 'image/..;/exe', 1000)).toMatch(/type/i)
    })

    it('rejects non-standard image subtypes', () => {
      expect(validateUpload('a.txt', 'image/', 1000)).toMatch(/type/i)
      expect(validateUpload('a.txt', 'image/123', 1000)).toMatch(/type/i)
      expect(validateUpload('a.txt', 'image/ png', 1000)).toMatch(/type/i)
    })
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

  describe('orphan file cleanup on save failure', () => {
    it('removes file from disk when repo.save fails', async () => {
      const db = await createDataSource(':memory:')
      const dir = mkdtempSync(join(tmpdir(), 'uploads-'))

      // Destroy the connection to force save to fail
      await db.destroy()

      try {
        await saveAttachment(db, dir, { ownerType: 'quote', ownerId: 1, filename: 'quote.pdf', mimeType: 'application/pdf', data: Buffer.from('pdf!') })
        expect.fail('Expected saveAttachment to throw')
      } catch (e) {
        // Verify error occurred
        expect(e).toBeDefined()
        // Verify file was not left on disk
        const files = await new Promise<string[]>((res) => {
          const fs = require('node:fs')
          fs.readdir(dir, (err: any, files: string[]) => {
            res(files || [])
          })
        })
        expect(files).toHaveLength(0)
      }
    })
  })

  describe('owner type and id validation', () => {
    it('accepts valid owner types with valid id', () => {
      expect(isValidOwner('project', 1)).toBe(true)
      expect(isValidOwner('quote', 1)).toBe(true)
      expect(isValidOwner('expense', 1)).toBe(true)
      expect(isValidOwner('inventory_item', 1)).toBe(true)
    })

    it('accepts large integer ids', () => {
      expect(isValidOwner('project', 999999)).toBe(true)
      expect(isValidOwner('project', Number.MAX_SAFE_INTEGER)).toBe(true)
    })

    it('rejects non-existent owner types', () => {
      expect(isValidOwner('sql-injection', 1)).toBe(false)
      expect(isValidOwner('', 1)).toBe(false)
      expect(isValidOwner('admin', 1)).toBe(false)
    })

    it('rejects invalid owner ids', () => {
      expect(isValidOwner('project', -1)).toBe(false)
      expect(isValidOwner('project', 0)).toBe(false)
      expect(isValidOwner('project', 1.5)).toBe(false)
      expect(isValidOwner('project', NaN)).toBe(false)
    })

    it('rejects when ownerType is falsy', () => {
      expect(isValidOwner(null as any, 1)).toBe(false)
      expect(isValidOwner(undefined as any, 1)).toBe(false)
    })
  })
})
