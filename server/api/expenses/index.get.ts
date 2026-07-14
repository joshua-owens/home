import { listExpenses } from '../../utils/expenses'
export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  return listExpenses(await useDb(), {
    projectId: q.projectId ? Number(q.projectId) : undefined,
    categoryId: q.categoryId ? Number(q.categoryId) : undefined,
    from: q.from as string | undefined,
    to: q.to as string | undefined,
  })
})
