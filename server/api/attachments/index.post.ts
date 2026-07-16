import { validateUpload, saveAttachment, isValidOwner, type OwnerType } from '../../utils/attachments'
import { uploadsDir } from '../../utils/uploads'

export default defineEventHandler(async (event) => {
  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, statusMessage: 'multipart form required' })
  const fieldValue = (name: string) => form.find(part => part.name === name)?.data.toString()
  const file = form.find(part => part.name === 'file')
  if (!file?.filename) throw createError({ statusCode: 400, statusMessage: 'file required' })
  const ownerType = fieldValue('ownerType') as OwnerType
  const ownerId = Number(fieldValue('ownerId'))
  if (!isValidOwner(ownerType, ownerId)) throw createError({ statusCode: 400, statusMessage: 'invalid ownerType or ownerId' })
  const mimeType = file.type ?? 'application/octet-stream'
  const validationError = validateUpload(file.filename, mimeType, file.data.length)
  if (validationError) throw createError({ statusCode: 400, statusMessage: validationError })
  return saveAttachment(await useDb(), uploadsDir(), { ownerType, ownerId, filename: file.filename, mimeType, data: file.data })
})
