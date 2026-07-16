import { User } from '../../database/entities'

export default defineEventHandler(async () =>
  (await useDb()).getRepository(User).find({ select: { id: true, username: true, displayName: true } }))
