import { listExpenses } from '../../utils/expenses'
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  return listExpenses(await useDb(), {
    projectId: query.projectId ? Number(query.projectId) : undefined,
    categoryId: query.categoryId ? Number(query.categoryId) : undefined,
    from: query.from as string | undefined,
    to: query.to as string | undefined,
  })
})
