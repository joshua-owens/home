import { ResearchReport, Project, HouseholdSettings, Quote } from '../database/entities'
import type { Db } from './db'

type Settings = { region: string; houseFacts: string }

// Minimal shape of the OpenAI SDK used here, so tests can pass a lightweight fake.
export type ChatCompletionClient = {
  chat: {
    completions: {
      create: (
        body: { model: string; messages: { role: 'user'; content: string }[] },
        options?: { signal?: AbortSignal },
      ) => Promise<{ choices?: { message?: { content?: string | null } }[] }>
    }
  }
}

export function buildResearchPrompt(project: Project, settings: Settings, quotes: Pick<Quote, 'companyName' | 'amount' | 'scopeNotes' | 'status'>[]): string {
  const parts = [
    `You are a home-improvement research assistant. Research the following homeowner project and produce a markdown report with these sections: Overview of options, Typical cost ranges (equipment and installation, itemized), Factors that affect price, Questions to ask contractors, Red flags to watch for in quotes.`,
    `## Project\n${project.name}\n${project.description}`,
  ]
  if (settings.region) parts.push(`## Location\n${settings.region}\nGive cost estimates for this region, not national averages.`)
  if (settings.houseFacts) parts.push(`## House details\n${settings.houseFacts}`)
  if (quotes.length) {
    const lines = quotes.map(quote => `- ${quote.companyName}: $${quote.amount} (${quote.status})${quote.scopeNotes ? ` — ${quote.scopeNotes}` : ''}`)
    parts.push(`## Quotes received so far\n${lines.join('\n')}\nSanity-check these against typical pricing and note any that look high or low.`)
  }
  return parts.join('\n\n')
}

const DEFAULT_TIMEOUT = 5 * 60 * 1000

export async function runResearch(db: Db, projectId: number, opts: { client: ChatCompletionClient; model: string; timeoutMs?: number }): Promise<ResearchReport> {
  const project = await db.getRepository(Project).findOneBy({ id: projectId })
  if (!project) throw new Error('Project not found')
  const settings = (await db.getRepository(HouseholdSettings).findOneBy({ id: 1 }))!
  const projectQuotes = await db.getRepository(Quote).findBy({ projectId })

  const repo = db.getRepository(ResearchReport)
  const report = await repo.save(repo.create({ projectId, status: 'pending', model: opts.model }))

  const finish = (patch: Partial<ResearchReport>) => repo.save({ ...report, ...patch })

  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const completion = await Promise.race([
      // signal must go in the SDK's second (request options) argument —
      // in the body it would be ignored and the request never aborted.
      opts.client.chat.completions.create(
        {
          model: opts.model,
          messages: [{ role: 'user', content: buildResearchPrompt(project, settings, projectQuotes) }],
        },
        { signal: controller.signal },
      ),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort()
          reject(new Error('Research timed out after 5 minutes'))
        }, opts.timeoutMs ?? DEFAULT_TIMEOUT)
      }),
    ])
    const body = completion.choices?.[0]?.message?.content ?? ''
    if (!body) return await finish({ status: 'failed', error: 'Model returned empty response' })
    return await finish({ status: 'complete', body })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    try {
      return await finish({ status: 'failed', error: errorMessage })
    } catch (finishError) {
      console.error('Original error:', errorMessage, 'Finish error:', String(finishError))
      return { ...report, status: 'failed', error: errorMessage } as ResearchReport
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function sweepOrphanedReports(db: Db): Promise<number> {
  const result = await db.getRepository(ResearchReport).update(
    { status: 'pending' },
    { status: 'failed', error: 'interrupted by restart' },
  )
  return result.affected ?? 0
}

export async function listReports(db: Db, projectId: number): Promise<ResearchReport[]> {
  return db.getRepository(ResearchReport).find({ where: { projectId }, order: { id: 'DESC' } })
}
