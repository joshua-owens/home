import { deleteAttachment } from '../../utils/attachments'
import { uploadsDir } from '../../utils/uploads'
export default defineEventHandler(async (event) => {
  await deleteAttachment(await useDb(), uploadsDir(), Number(getRouterParam(event, 'id')))
  return { ok: true }
})
