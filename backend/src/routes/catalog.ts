import { Router } from 'express'
import { listEntities } from '../services/chronicleStore.js'

const CLANS = [
  'Banu Haqim',
  'Brujah',
  'Gangrel',
  'Hecata',
  'Lasombra',
  'Malkavian',
  'Ministry',
  'Nosferatu',
  'Ravnos',
  'Salubri',
  'Toreador',
  'Tremere',
  'Tzimisce',
  'Ventrue',
].map((name, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
}))

export const catalogRouter = Router()

catalogRouter.get('/clans', (_req, res) => {
  res.json(CLANS)
})

/** Catedrais publicadas pelo ADM (archive + faithPath em creatureType ou statsText). */
catalogRouter.get('/cathedrals', (req, res) => {
  const path = String(req.query.path ?? '').toLowerCase()
  const published = listEntities({ kind: 'archive', visibility: 'published' }).filter((e) => {
    const faith = (e.creatureType ?? e.magicType ?? '').toLowerCase()
    const isCathedral =
      e.archiveCategory === 'rituals' ||
      faith === 'luz' ||
      faith === 'trevas' ||
      /catedral|fé|fe\b|ordem sagrada|culto/i.test(`${e.name} ${e.description}`)
    if (!isCathedral) return false
    if (path === 'luz' || path === 'trevas') {
      return faith === path || (!faith && path === 'luz')
    }
    return true
  })

  res.json(
    published.map((e) => ({
      id: e.id,
      name: e.name,
      faithPath: ((e.creatureType ?? e.magicType ?? 'luz').toLowerCase() === 'trevas' ? 'trevas' : 'luz') as
        | 'luz'
        | 'trevas',
      precepts: (e.statsText ?? e.description ?? '')
        .split(/[·|;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6),
    })),
  )
})
