import { validateUpload, saveAttachment, type OwnerType } from '../../utils/attachments'
import { uploadsDir } from '../../utils/uploads'

const VALID_OWNER_TYPES: OwnerType[] = ['project', 'quote', 'expense', 'inventory_item']

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, statusMessage: 'multipart form required' })
  const field = (n: string) => form.find(f => f.name === n)?.data.toString()
  const file = form.find(f => f.name === 'file')
  if (!file?.filename) throw createError({ statusCode: 400, statusMessage: 'file required' })
  const ownerType = field('ownerType') as OwnerType
  if (!VALID_OWNER_TYPES.includes(ownerType)) throw createError({ statusCode: 400, statusMessage: 'invalid ownerType' })
  const ownerId = Number(field('ownerId'))
  if (!Number.isInteger(ownerId)) throw createError({ statusCode: 400, statusMessage: 'invalid ownerId' })
  const mimeType = file.type ?? 'application/octet-stream'
  const err = validateUpload(file.filename, mimeType, file.data.length)
  if (err) throw createError({ statusCode: 400, statusMessage: err })
  return saveAttachment(await useDb(), uploadsDir(), { ownerType, ownerId, filename: file.filename, mimeType, data: file.data })
})
