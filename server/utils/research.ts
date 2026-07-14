import { ResearchReport, Project, HouseholdSettings, Quote } from '../database/entities'
import type { Db } from './db'

type Settings = { region: string; houseFacts: string }

export function buildResearchPrompt(project: Project, settings: Settings, quotes: Pick<Quote, 'companyName' | 'amount' | 'scopeNotes' | 'status'>[]): string {
  const parts = [
    `You are a home-improvement research assistant. Research the following homeowner project and produce a markdown report with these sections: Overview of options, Typical cost ranges (equipment and installation, itemized), Factors that affect price, Questions to ask contractors, Red flags to watch for in quotes.`,
    `## Project\n${project.name}\n${project.description}`,
  ]
  if (settings.region) parts.push(`## Location\n${settings.region}\nGive cost estimates for this region, not national averages.`)
  if (settings.houseFacts) parts.push(`## House details\n${settings.houseFacts}`)
  if (quotes.length) {
    const lines = quotes.map(q => `- ${q.companyName}: $${q.amount} (${q.status})${q.scopeNotes ? ` — ${q.scopeNotes}` : ''}`)
    parts.push(`## Quotes received so far\n${lines.join('\n')}\nSanity-check these against typical pricing and note any that look high or low.`)
  }
  return parts.join('\n\n')
}

const DEFAULT_TIMEOUT = 5 * 60 * 1000

export async function runResearch(db: Db, projectId: number, opts: { client: any; model: string; timeoutMs?: number }): Promise<ResearchReport> {
  const project = await db.getRepository(Project).findOneBy({ id: projectId })
  if (!project) throw new Error('Project not found')
  const settings = (await db.getRepository(HouseholdSettings).findOneBy({ id: 1 }))!
  const projectQuotes = await db.getRepository(Quote).findBy({ projectId })

  const repo = db.getRepository(ResearchReport)
  const report = await repo.save(repo.create({ projectId, status: 'pending', model: opts.model }))

  const finish = (patch: Partial<ResearchReport>) => repo.save({ ...report, ...patch })

  const controller = new AbortController()
  let timeoutId: any

  try {
    const completion = await Promise.race([
      opts.client.chat.completions.create({
        model: opts.model,
        messages: [{ role: 'user', content: buildResearchPrompt(project, settings, projectQuotes) }],
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort()
          reject(new Error('Research timed out after 5 minutes'))
        }, opts.timeoutMs ?? DEFAULT_TIMEOUT)
      }),
    ]) as any
    const body = completion.choices?.[0]?.message?.content ?? ''
    if (!body) return await finish({ status: 'failed', error: 'Model returned empty response' })
    return await finish({ status: 'complete', body })
  } catch (e: any) {
    const errorMsg = String(e?.message ?? e)
    try {
      return await finish({ status: 'failed', error: errorMsg })
    } catch (finishError: any) {
      console.error('Original error:', errorMsg, 'Finish error:', String(finishError?.message ?? finishError))
      return { ...report, status: 'failed', error: errorMsg } as ResearchReport
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function sweepOrphanedReports(db: Db): Promise<number> {
  const res = await db.getRepository(ResearchReport).update(
    { status: 'pending' },
    { status: 'failed', error: 'interrupted by restart' },
  )
  return res.affected ?? 0
}

export async function listReports(db: Db, projectId: number): Promise<ResearchReport[]> {
  return db.getRepository(ResearchReport).find({ where: { projectId }, order: { id: 'DESC' } })
}
