import { beforeEach, describe, expect, it } from 'vitest'
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

  it('adds new catalog rows without wiping existing ones', () => {
    mergeReferenceKind('magic', [{ name: 'Arcana', description: 'Magia arcana' }])
    mergeReferenceKind('magic', [{ name: 'Divina', description: 'Magia divina' }])
    const names = listReference('magic').map((row) => row.name)
    expect(names).toContain('Arcana')
    expect(names).toContain('Divina')
  })

  it('skips duplicate name with same description', () => {
    const first = mergeReferenceKind('relic', [{ name: 'Talismã', description: 'Proteção' }])
    const second = mergeReferenceKind('relic', [{ name: 'Talismã', description: 'Proteção' }])
    expect(first.added).toBe(1)
    expect(second.skipped).toBe(1)
    expect(listReference('relic').filter((r) => r.name === 'Talismã')).toHaveLength(1)
  })

  it('updates description when name matches but text differs', () => {
    mergeReferenceKind('faith', [{ name: 'Luz', description: 'Versão A' }])
    const updated = mergeReferenceKind('faith', [{ name: 'Luz', description: 'Versão B' }])
    expect(updated.updated).toBe(1)
    expect(listReference('faith').find((r) => r.name === 'Luz')?.description).toBe('Versão B')
  })
})

describe('reference catalog file snapshot', () => {
  it('persists merged rows to local json backup', () => {
    mergeReferenceKind('equipment_type', [{ name: 'Armadura', description: 'Peças de proteção' }])
    const local = readJsonFile<Array<{ name: string }>>(FILE)
    expect(local?.some((row) => row.name === 'Armadura')).toBe(true)
  })
})
