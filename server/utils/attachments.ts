import { randomUUID } from 'node:crypto'
import { writeFileSync, rmSync } from 'node:fs'
import { join, extname } from 'node:path'
import { Attachment, type OwnerTypeValue } from '../database/entities'
import type { Db } from './db'

const MAX_SIZE = 25 * 1024 * 1024
const VALID_OWNER_TYPES: OwnerTypeValue[] = ['project', 'quote', 'expense', 'inventory_item']

// Strict mime validation: reject parameters, whitespace, CRLF, path traversal
function isValidMimeType(mimeType: string): boolean {
  // Reject if contains any whitespace, CRLF, or parameters
  if (/[\s\r\n;]/.test(mimeType)) return false

  // Exactly allowed types
  if (mimeType === 'application/pdf') return true
  if (mimeType === 'text/plain') return true

  // Image/* with strict pattern: subtype must start with letter, then alphanumeric/dot/plus/hyphen
  if (/^image\/[a-zA-Z][a-zA-Z0-9.+-]*$/.test(mimeType)) return true

  return false
}

export type OwnerType = OwnerTypeValue

export function validateUpload(filename: string, mimeType: string, size: number): string | null {
  if (!isValidMimeType(mimeType)) return `File type ${mimeType} not allowed (pdf, images, txt only)`
  if (size > MAX_SIZE) return 'File exceeds 25 MB limit'
  return null
}

export function isValidOwner(ownerType: OwnerType, ownerId: number): boolean {
  // Verify ownerType is a valid type
  if (!ownerType || !VALID_OWNER_TYPES.includes(ownerType)) return false

  // Verify ownerId is a positive integer
  if (!Number.isInteger(ownerId) || ownerId <= 0) return false

  return true
}

export async function saveAttachment(db: Db, uploadsDir: string, input: { ownerType: OwnerType; ownerId: number; filename: string; mimeType: string; data: Buffer }): Promise<Attachment> {
  // Stored filename is generated server-side (never derived from client input), so
  // it cannot be used to escape uploadsDir via '..' or path separators.
  const diskPath = `${randomUUID()}${extname(input.filename)}`
  const fullPath = join(uploadsDir, diskPath)
  writeFileSync(fullPath, input.data)

  const repo = db.getRepository(Attachment)
  try {
    return await repo.save(repo.create({
      ownerType: input.ownerType, ownerId: input.ownerId,
      filename: input.filename, mimeType: input.mimeType,
      size: input.data.length, diskPath,
    }))
  } catch (error) {
    // If DB insert fails, clean up the orphaned file
    rmSync(fullPath, { force: true })
    throw error
  }
}

export async function listAttachments(db: Db, ownerType: OwnerType, ownerId: number): Promise<Attachment[]> {
  return db.getRepository(Attachment).findBy({ ownerType, ownerId })
}

export async function deleteAttachment(db: Db, uploadsDir: string, id: number): Promise<void> {
  const repo = db.getRepository(Attachment)
  const a = await repo.findOneBy({ id })
  if (!a) return
  rmSync(join(uploadsDir, a.diskPath), { force: true })
  await repo.delete(id)
}

export async function deleteAttachmentsFor(db: Db, uploadsDir: string, ownerType: OwnerType, ownerId: number): Promise<void> {
  for (const a of await listAttachments(db, ownerType, ownerId)) await deleteAttachment(db, uploadsDir, a.id)
}
