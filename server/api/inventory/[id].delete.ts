import { InventoryItem } from '../../database/entities'
import { deleteAttachmentsFor } from '../../utils/attachments'
import { uploadsDir } from '../../utils/uploads'
export default defineEventHandler(async (event) => {
  const db = await useDb()
  const id = Number(getRouterParam(event, 'id'))
  await deleteAttachmentsFor(db, uploadsDir(), 'inventory_item', id)
  await db.getRepository(InventoryItem).delete(id)
  return { ok: true }
})
