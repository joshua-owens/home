import { listAttachments, type OwnerType } from '../../utils/attachments'
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  return listAttachments(await useDb(), query.ownerType as OwnerType, Number(query.ownerId))
})
