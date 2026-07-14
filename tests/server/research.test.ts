import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

  it('aborts the request and clears timeout on timeout', async () => {
    const db = await createDataSource(':memory:')
    vi.useFakeTimers()
    try {
      const p = await createProject(db, { name: 'X' })
      let recordedSignal: AbortSignal | undefined
      const neverResolvesClient = {
        chat: { completions: { create: async (opts: any) => {
          recordedSignal = opts.signal
          // Never resolve, just hang
          return new Promise(() => {})
        } } },
      } as any
      const promise = runResearch(db, p.id, { client: neverResolvesClient, model: 'test', timeoutMs: 5000 })
      // Advance past the timeout - this triggers the setTimeout in the timeout promise
      await vi.advanceTimersByTimeAsync(5000)
      const report = await promise
      expect(report.status).toBe('failed')
      expect(report.error).toContain('timed out')
      expect(recordedSignal).toBeDefined()
      expect(recordedSignal?.aborted).toBe(true)
    } finally {
      vi.useRealTimers()
      await db.destroy()
    }
  }, 15000)

  it('handles finish failure in error path without leaking pending', async () => {
    const db = await createDataSource(':memory:')
    const p = await createProject(db, { name: 'X' })
    const repo = db.getRepository(ResearchReport)
    let finishCallCount = 0
    const originalSave = repo.save.bind(repo)
    repo.save = async (entity: any) => {
      finishCallCount++
      if (finishCallCount === 1) {
        // First save (initial pending): success
        return originalSave(entity)
      } else if (finishCallCount === 2) {
        // Second save (error path finish): throw to simulate DB failure
        throw new Error('DB error on finish')
      }
      return originalSave(entity)
    }
    const errClient = fakeClient(new Error('request failed'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const report = await runResearch(db, p.id, { client: errClient, model: 'test' })
    // Verify we get the error report back despite the finish failure
    expect(report.status).toBe('failed')
    expect(report.error).toContain('request failed')
    // Verify console.error was called with both errors
    expect(consoleErrorSpy).toHaveBeenCalled()
    const args = consoleErrorSpy.mock.calls[0]
    expect(args).toContainEqual(expect.any(String)) // original error
    expect(args).toContainEqual(expect.any(String)) // DB error
    consoleErrorSpy.mockRestore()
    await db.destroy()
  })
})
