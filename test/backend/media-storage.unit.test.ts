import { describe, expect, it } from 'vitest'
import { downloadStorageFolder, inspectDownloadAsset, inspectImage, profileObjectPath } from '../../backend/src/services/mediaStorage.js'

const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64')}`
const pdf = `data:application/pdf;base64,${Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n').toString('base64')}`

describe('inspectImage', () => {
  it('accepts a png whose bytes match the format', () => {
    expect(inspectImage(png).ext).toBe('png')
  })

  it('rejects a file whose bytes do not match the declared format', () => {
    const fake = `data:image/png;base64,${Buffer.from('nao-e-png').toString('base64')}`
    expect(() => inspectImage(fake)).toThrow(/inválida/)
  })

  it('builds a profile path without the email', () => {
    const path = profileObjectPath('avatar', 'png')
    expect(path.endsWith('/avatar.png')).toBe(true)
    expect(path.includes('@')).toBe(false)
  })

  it('accepts PDF download assets and maps species sheets vs clan books into storage folders', () => {
    expect(inspectDownloadAsset(pdf).ext).toBe('pdf')
    expect(downloadStorageFolder({ downloadCategory: 'sheets', sheetType: 'Vampiro' })).toBe('fichas/vampiro')
    expect(downloadStorageFolder({ downloadCategory: 'sheets', sheetType: 'Outras espécies' })).toBe(
      'fichas/outras-especies',
    )
    expect(downloadStorageFolder({ downloadCategory: 'rules', clan: 'Ravnos' })).toBe('compendio/ravnos')
    expect(downloadStorageFolder({ downloadCategory: 'rules', clan: 'Banu Haqim' })).toBe('compendio/banu-haqim')
    expect(downloadStorageFolder({ downloadCategory: 'handouts' })).toBe('acontecimentos')
  })
})
