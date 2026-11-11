import { Router } from 'express'
import { z } from 'zod'
import { listEntities } from '../services/chronicleStore.js'
import { getSupabaseAdmin } from '../services/supabaseClient.js'
import { listSubclassesForClass } from '../services/subclassCatalog.js'
import { listReference, REFERENCE_KINDS, refreshReferenceFromDatabase } from '../services/referenceCatalog.js'

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

const zKind = z.enum(REFERENCE_KINDS)

export const catalogRouter = Router()

catalogRouter.get('/reference/:kind', async (req, res) => {
  const kind = zKind.safeParse(req.params.kind)
  if (!kind.success) {
    res.status(400).json({ error: { message: 'Catálogo desconhecido' } })
    return
  }
  await refreshReferenceFromDatabase()
  res.json(listReference(kind.data))
})

catalogRouter.get('/subclasses', async (req, res) => {
  const className = String(req.query.class ?? '').trim()
  if (!className) {
    res.json([])
    return
  }
  res.json(await listSubclassesForClass(className))
})

catalogRouter.get('/clans', async (_req, res) => {
  const sb = getSupabaseAdmin()
  if (sb) {
    const { data, error } = await sb
      .from('clans')
      .select('id, name, slug')
      .eq('active', true)
      .order('name', { ascending: true })
    if (!error && data && data.length > 0) {
      res.json(data)
      return
    }
  }
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
