import { describe, it, expect } from 'vitest'
import { createDataSource } from '../../server/database/data-source'
import { createProject } from '../../server/utils/projects'
import { createQuote } from '../../server/utils/quotes'
import { buildResearchPrompt, runResearch, sweepOrphanedReports } from '../../server/utils/research'
import { ResearchReport, HouseholdSettings } from '../../server/database/entities'

function fakeClient(reply: string | Error) {
  return {
    chat: { completions: { create: async () => {
      if (reply instanceof Error) throw reply
      return { choices: [{ message: { content: reply } }] }
    } } },
  } as any
}

describe('research', () => {
  it('builds a prompt containing project, region, and quotes', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'Mini split install', description: 'Addition, no ductwork' })
    await createQuote(db, { projectId: p.id, companyName: 'HVAC Co', amount: 8000 })
    await db.getRepository(HouseholdSettings).update({ id: 1 }, { region: 'Boston, MA' })
    const settings = (await db.getRepository(HouseholdSettings).findOneBy({ id: 1 }))!
    const quotes = [{ companyName: 'HVAC Co', amount: 8000, scopeNotes: '', status: 'pending' }] as any
    const prompt = buildResearchPrompt(p, settings, quotes)
    expect(prompt).toContain('Mini split install')
    expect(prompt).toContain('Boston, MA')
    expect(prompt).toContain('HVAC Co')
    expect(prompt).toContain('8000')
    await db.destroy()
  })

  it('marks report complete on success and failed on error', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'Mini split' })
    const ok = await runResearch(db, p.id, { client: fakeClient('# Report\nCosts...'), model: 'test-model' })
    expect(ok.status).toBe('complete')
    expect(ok.body).toContain('Costs')
    expect(ok.model).toBe('test-model')
    const bad = await runResearch(db, p.id, { client: fakeClient(new Error('rate limited')), model: 'test-model' })
    expect(bad.status).toBe('failed')
    expect(bad.error).toContain('rate limited')
    await db.destroy()
  })

  it('sweeps orphaned pending reports to failed', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'X' })
    const repo = db.getRepository(ResearchReport)
    await repo.save(repo.create({ projectId: p.id, status: 'pending' }))
    expect(await sweepOrphanedReports(db)).toBe(1)
    const r = (await repo.find())[0]!
    expect(r.status).toBe('failed')
    expect(r.error).toMatch(/interrupted by restart/i)
    await db.destroy()
  })
})
