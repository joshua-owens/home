import { randomUUID } from 'node:crypto'
import { writeFileSync, rmSync } from 'node:fs'
import { join, extname } from 'node:path'
import { Attachment, type OwnerTypeValue } from '../database/entities'
import type { Db } from './db'

const MAX_SIZE = 25 * 1024 * 1024
const ALLOWED = (m: string) => m === 'application/pdf' || m === 'text/plain' || m.startsWith('image/')
export type OwnerType = OwnerTypeValue

export function validateUpload(filename: string, mimeType: string, size: number): string | null {
  if (!ALLOWED(mimeType)) return `File type ${mimeType} not allowed (pdf, images, txt only)`
  if (size > MAX_SIZE) return 'File exceeds 25 MB limit'
  return null
}

export async function saveAttachment(db: Db, uploadsDir: string, input: { ownerType: OwnerType; ownerId: number; filename: string; mimeType: string; data: Buffer }): Promise<Attachment> {
  // Stored filename is generated server-side (never derived from client input), so
  // it cannot be used to escape uploadsDir via '..' or path separators.
  const diskPath = `${randomUUID()}${extname(input.filename)}`
  writeFileSync(join(uploadsDir, diskPath), input.data)
  const repo = db.getRepository(Attachment)
  return repo.save(repo.create({
    ownerType: input.ownerType, ownerId: input.ownerId,
    filename: input.filename, mimeType: input.mimeType,
    size: input.data.length, diskPath,
  }))
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
