import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { Attachment } from '../../database/entities'
import { uploadsDir } from '../../utils/uploads'
export default defineEventHandler(async (event) => {
  const a = await (await useDb()).getRepository(Attachment)
    .findOneBy({ id: Number(getRouterParam(event, 'id')) })
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  setHeader(event, 'content-type', a.mimeType)
  setHeader(event, 'content-disposition', `inline; filename="${a.filename.replace(/"/g, '')}"`)
  // a.diskPath is server-generated at save time (see saveAttachment) and is the only
  // path source used here — never derived from client-supplied input.
  return sendStream(event, createReadStream(join(uploadsDir(), a.diskPath)))
})
