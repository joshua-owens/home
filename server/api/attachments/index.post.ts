import { validateUpload, saveAttachment, isValidOwner, type OwnerType } from '../../utils/attachments'
import { uploadsDir } from '../../utils/uploads'

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, statusMessage: 'multipart form required' })
  const field = (n: string) => form.find(f => f.name === n)?.data.toString()
  const file = form.find(f => f.name === 'file')
  if (!file?.filename) throw createError({ statusCode: 400, statusMessage: 'file required' })
  const ownerType = field('ownerType') as OwnerType
  const ownerId = Number(field('ownerId'))
  if (!isValidOwner(ownerType, ownerId)) throw createError({ statusCode: 400, statusMessage: 'invalid ownerType or ownerId' })
  const mimeType = file.type ?? 'application/octet-stream'
  const err = validateUpload(file.filename, mimeType, file.data.length)
  if (err) throw createError({ statusCode: 400, statusMessage: err })
  return saveAttachment(await useDb(), uploadsDir(), { ownerType, ownerId, filename: file.filename, mimeType, data: file.data })
})
