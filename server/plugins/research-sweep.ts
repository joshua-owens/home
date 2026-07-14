import { sweepOrphanedReports } from '../utils/research'
export default defineNitroPlugin(async () => {
  const n = await sweepOrphanedReports(await useDb())
  if (n > 0) console.log(`[research] marked ${n} orphaned pending report(s) as failed`)
})
