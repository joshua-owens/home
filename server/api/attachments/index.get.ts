import { listAttachments, type OwnerType } from '../../utils/attachments'
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  return listAttachments(await useDb(), q.ownerType as OwnerType, Number(q.ownerId))
})
