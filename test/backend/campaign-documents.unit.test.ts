import { describe, expect, it } from 'vitest'
import { chooseDocument, documentWeight } from '../../backend/src/services/campaignDocuments.js'

describe('chooseDocument', () => {
  it('keeps the copy that has records when the other is empty', () => {
    const local = { updatedAt: '2026-11-18T00:00:00.000Z', body: [{ email: 'a@b.c' }] }
    const remote = { updatedAt: '2026-11-18T01:00:00.000Z', body: [] }
    expect(chooseDocument(local, remote)).toBe(local)
    expect(documentWeight(remote.body)).toBe(0)
  })

  it('keeps the newer copy when both have records', () => {
    const local = { updatedAt: '2026-11-18T00:00:00.000Z', body: [{ id: 'old' }] }
    const remote = { updatedAt: '2026-11-18T02:00:00.000Z', body: [{ id: 'new' }] }
    expect(chooseDocument(local, remote)?.body).toEqual([{ id: 'new' }])
  })
})
