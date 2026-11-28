import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  deleteReference,
  hydrateReferenceCatalog,
  mergeReferenceKind,
  listReference,
  resetReferenceCatalogForTests,
  upsertReference,
} from '../../backend/src/services/referenceCatalog.js'
import { readJsonFile, writeJsonFile } from '../../backend/src/services/localJson.js'

const FILE = 'reference-catalog.json'

describe('mergeReferenceKind', () => {
  beforeEach(() => {
    resetReferenceCatalogForTests()
  })

  it('adds new catalog rows without wiping existing ones', async () => {
    await mergeReferenceKind('magic', [{ name: 'Arcana', description: 'Magia arcana' }])
    await mergeReferenceKind('magic', [{ name: 'Divina', description: 'Magia divina' }])
    const names = listReference('magic').map((row) => row.name)
    expect(names).toContain('Arcana')
    expect(names).toContain('Divina')
  })

  it('skips duplicate name with same description', async () => {
    const first = await mergeReferenceKind('relic', [{ name: 'Talismã', description: 'Proteção' }])
    const second = await mergeReferenceKind('relic', [{ name: 'Talismã', description: 'Proteção' }])
    expect(first.added).toBe(1)
    expect(second.skipped).toBe(1)
    expect(listReference('relic').filter((r) => r.name === 'Talismã')).toHaveLength(1)
  })

  it('updates description when name matches but text differs', async () => {
    await mergeReferenceKind('faith', [{ name: 'Luz', description: 'Versão A' }])
    const updated = await mergeReferenceKind('faith', [{ name: 'Luz', description: 'Versão B' }])
    expect(updated.updated).toBe(1)
    expect(listReference('faith').find((r) => r.name === 'Luz')?.description).toBe('Versão B')
  })

  it('deletes an entry from the catalog by id', async () => {
    await mergeReferenceKind('magic', [{ name: 'Necromancia', description: 'Rituais da morte' }])
    const created = listReference('magic').find((r) => r.name === 'Necromancia')
    expect(created).toBeTruthy()
    expect(await deleteReference(created!.id)).toBe(true)
    expect(listReference('magic').some((r) => r.id === created!.id)).toBe(false)
    expect(await deleteReference('inexistente')).toBe(false)
  })
})

describe('reference catalog file snapshot', () => {
  let tmpDir: string | null = null

  beforeEach(() => {
    resetReferenceCatalogForTests()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beladona-ref-'))
    process.env.BELADONA_DATA_DIR = tmpDir
  })

  afterEach(() => {
    delete process.env.BELADONA_DATA_DIR
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
    tmpDir = null
  })

  it('persists merged rows to local json backup when data dir is configured', async () => {
    await mergeReferenceKind('equipment_type', [{ name: 'Armadura', description: 'Peças de proteção' }])
    const local = readJsonFile<Array<{ name: string }>>(FILE)
    expect(local?.some((row) => row.name === 'Armadura')).toBe(true)
  })

  it('persists edits and deletions across snapshot reloads without resurrecting removed items', async () => {
    const saved = await upsertReference({
      kind: 'magic',
      name: 'Taumaturgia',
      description: 'Versão inicial',
    })
    const edited = await upsertReference({
      id: saved.id,
      kind: 'magic',
      name: 'Taumaturgia',
      description: 'Versão atualizada',
    })
    expect(edited.id).toBe(saved.id)
    expect(readJsonFile<Array<{ id: string; description: string }>>(FILE)).toEqual([
      expect.objectContaining({ id: saved.id, description: 'Versão atualizada' }),
    ])

    const kept = await upsertReference({
      kind: 'magic',
      name: 'Necromancia',
      description: 'Mantida',
    })
    expect(await deleteReference(saved.id)).toBe(true)

    const diskRows = readJsonFile<Array<{ id: string; name: string }>>(FILE)
    expect(diskRows?.map((r) => r.id)).toEqual([kept.id])

    // Simula reinicialização lendo o arquivo salvo em disco
    writeJsonFile(FILE, diskRows)
    resetReferenceCatalogForTests()
    writeJsonFile(FILE, diskRows)
    await hydrateReferenceCatalog()
    expect(listReference('magic').map((r) => r.name)).toEqual(['Necromancia'])
  })
})
