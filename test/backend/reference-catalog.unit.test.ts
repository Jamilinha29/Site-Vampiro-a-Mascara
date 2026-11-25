import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  mergeReferenceKind,
  listReference,
  resetReferenceCatalogForTests,
} from '../../backend/src/services/referenceCatalog.js'
import { readJsonFile } from '../../backend/src/services/localJson.js'

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
})
