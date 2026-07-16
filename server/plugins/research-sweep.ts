import { sweepOrphanedReports } from '../utils/research'
export default defineNitroPlugin(async () => {
  const orphanCount = await sweepOrphanedReports(await useDb())
  if (orphanCount > 0) console.log(`[research] marked ${orphanCount} orphaned pending report(s) as failed`)
})
