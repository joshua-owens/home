import { Expense } from '../../database/entities'

const createError = globalThis.createError ?? ((e: any) => Object.assign(new Error(e.statusMessage), e))

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const repo = (await useDb()).getRepository(Expense)
  const existing = await repo.findOneBy({ id })
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Expense not found' })

  const body = await readBody(event)

  // Whitelist only allowed fields to prevent mass-assignment
  const whitelisted = {
    ...(body.projectId !== undefined && { projectId: body.projectId }),
    ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
    ...(body.amount !== undefined && { amount: body.amount }),
    ...(body.date !== undefined && { date: body.date }),
    ...(body.vendor !== undefined && { vendor: body.vendor }),
    ...(body.note !== undefined && { note: body.note }),
  }

  return repo.save({ ...existing, ...whitelisted })
})
