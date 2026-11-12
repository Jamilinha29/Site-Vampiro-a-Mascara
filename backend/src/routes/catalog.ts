import { Router } from 'express'
import { z } from 'zod'
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

/** Catedrais do catálogo de fé (ADM), filtradas por Luz ou Trevas. */
catalogRouter.get('/cathedrals', async (req, res) => {
  await refreshReferenceFromDatabase()
  const path = String(req.query.path ?? '').toLowerCase()
  const faiths = listReference('faith').filter((row) => {
    if (row.faithPath !== 'luz' && row.faithPath !== 'trevas') return false
    if (path !== 'luz' && path !== 'trevas') return true
    return row.faithPath === path
  })

  res.json(
    faiths.map((row) => ({
      id: row.id,
      name: row.name,
      faithPath: row.faithPath,
      precepts: (row.description ?? '')
        .split(/[·|;]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6),
    })),
  )
})
