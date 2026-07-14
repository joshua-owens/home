import { deleteProject } from '../../utils/projects'
import { deleteAttachmentsFor } from '../../utils/attachments'
import { uploadsDir } from '../../utils/uploads'
import { Quote, Expense } from '../../database/entities'
export default defineEventHandler(async (event) => {
  const db = await useDb(); const dir = uploadsDir()
  const id = Number(getRouterParam(event, 'id'))
  for (const q of await db.getRepository(Quote).findBy({ projectId: id }))
    await deleteAttachmentsFor(db, dir, 'quote', q.id)
  for (const e of await db.getRepository(Expense).findBy({ projectId: id }))
    await deleteAttachmentsFor(db, dir, 'expense', e.id)
  await deleteAttachmentsFor(db, dir, 'project', id)
  await deleteProject(db, id)
  return { ok: true }
})
