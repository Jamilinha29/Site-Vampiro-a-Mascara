import { describe, expect, it } from 'vitest'
import { entityFromDbRow } from '../../backend/src/services/entityDb.js'

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
