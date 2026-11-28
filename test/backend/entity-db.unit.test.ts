import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { entityFromDbRow } from '../../backend/src/services/entityDb.js'
import {
  createEntity,
  deleteEntity,
  hydrateEntitiesFromDatabase,
  listEntities,
  resetEntitiesForTests,
  updateEntity,
} from '../../backend/src/services/chronicleStore.js'
import { readJsonFile } from '../../backend/src/services/localJson.js'

describe('entityFromDbRow', () => {
  it('maps spreadsheet columns into glossary-ready archive rows', () => {
    const entity = entityFromDbRow({
      id: 'row-1',
      kind: 'archive',
      name: 'Grimório das Marcas',
      visibility: 'draft',
      archive_category: 'grimoire',
      description: 'Ritual de proteção',
      payload: {},
    })
    expect(entity).not.toBeNull()
    expect(entity?.archiveCategory).toBe('rituals')
    expect(entity?.classification).toBe('grimoire')
    expect(entity?.name).toBe('Grimório das Marcas')
  })

  it('maps shop equipment from payload and columns', () => {
    const entity = entityFromDbRow({
      id: 'row-2',
      kind: 'equipment',
      name: 'Bolsa',
      shop_category: 'gear',
      payload: { shopCategory: 'gear', equipmentType: 'Cotidiano' },
    })
    expect(entity?.kind).toBe('equipment')
    expect(entity?.shopCategory).toBe('gear')
  })

  it('skips rows without name or kind', () => {
    expect(entityFromDbRow({ id: 'x', kind: 'equipment', name: '' })).toBeNull()
    expect(entityFromDbRow({ id: 'x', kind: 'invalid', name: 'Teste' })).toBeNull()
  })
})

describe('chronicle entities snapshot persistence', () => {
  let tmpDir: string | null = null

  beforeEach(() => {
    resetEntitiesForTests()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beladona-ent-'))
    process.env.BELADONA_DATA_DIR = tmpDir
  })

  afterEach(() => {
    delete process.env.BELADONA_DATA_DIR
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
    tmpDir = null
  })

  it('persists create, update and delete across restart hydration', async () => {
    const created = await createEntity({
      kind: 'archive',
      name: 'Códice Antigo',
      description: 'Primeira edição',
      visibility: 'published',
    })
    await updateEntity(created.id, { description: 'Edição revisada' })
    const second = await createEntity({
      kind: 'equipment',
      name: 'Adaga de Prata',
      description: 'Forjada no conclave',
      visibility: 'published',
    })
    expect(await deleteEntity(created.id)).toBe(true)

    const saved = readJsonFile<Array<{ id: string; name: string }>>('chronicle-entities.json')
    expect(saved?.map((row) => row.id)).toEqual([second.id])

    resetEntitiesForTests()
    await hydrateEntitiesFromDatabase()
    expect(listEntities().map((row) => row.id)).toEqual([second.id])
  })
})
