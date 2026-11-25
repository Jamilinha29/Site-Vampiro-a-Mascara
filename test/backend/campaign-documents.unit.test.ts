import { describe, expect, it, vi } from 'vitest'
import {
  checkRemoteDocumentRevision,
  chooseDocument,
  documentWeight,
  setRemoteDocumentBackendForTests,
} from '../../backend/src/services/campaignDocuments.js'

describe('chooseDocument', () => {
  it('keeps the copy that has records when the other is empty', () => {
    const local = { updatedAt: '2026-11-18T00:00:00.000Z', revision: 1, body: [{ email: 'a@b.c' }] }
    const remote = { updatedAt: '2026-11-18T01:00:00.000Z', revision: 2, body: [] }
    expect(chooseDocument(local, remote)).toBe(local)
    expect(documentWeight(remote.body)).toBe(0)
  })

  it('keeps the newer copy when both have records', () => {
    const local = { updatedAt: '2026-11-18T00:00:00.000Z', revision: 1, body: [{ id: 'old' }] }
    const remote = { updatedAt: '2026-11-18T02:00:00.000Z', revision: 2, body: [{ id: 'new' }] }
    expect(chooseDocument(local, remote)?.body).toEqual([{ id: 'new' }])
  })

  it('uses lightweight loadRevision instead of downloading full payload during sync checks', async () => {
    const load = vi.fn(async () => null)
    const loadRevision = vi.fn(async () => 42)
    setRemoteDocumentBackendForTests({
      load,
      loadRevision,
      save: async (_id, env) => env,
    })
    const rev = await checkRemoteDocumentRevision('sessions')
    expect(rev).toBe(42)
    expect(loadRevision).toHaveBeenCalledWith('sessions')
    expect(load).not.toHaveBeenCalled()
    setRemoteDocumentBackendForTests(null)
  })
})
