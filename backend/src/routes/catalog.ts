import { Router } from 'express'
import { z } from 'zod'
import { errorPayload } from '../services/errors.js'
import {
  MAX_CHARACTER_LEVEL,
  MIN_CHARACTER_LEVEL,
  SECOND_SUBCLASS_CHOICE_LEVEL,
  STARTING_CHARACTER_XP,
  SUBCLASS_CHOICE_LEVEL,
  VITALS_PER_LEVEL,
} from '../services/progressionRules.js'
import { listReference, REFERENCE_KINDS, refreshReferenceFromDatabase } from '../services/referenceCatalog.js'
import { readRules } from '../services/rulesState.js'
import { listSubclassesForClass } from '../services/subclassCatalog.js'
import { getSupabaseAdmin } from '../services/supabaseClient.js'

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

catalogRouter.get('/progression', (_req, res) => {
  res.json({
    minLevel: MIN_CHARACTER_LEVEL,
    maxLevel: MAX_CHARACTER_LEVEL,
    subclassLevel: SUBCLASS_CHOICE_LEVEL,
    secondarySubclassLevel: SECOND_SUBCLASS_CHOICE_LEVEL,
    startingXp: STARTING_CHARACTER_XP,
    vitalsPerLevel: VITALS_PER_LEVEL,
    rules: readRules(),
  })
})

catalogRouter.get('/reference/:kind', async (req, res, next) => {
  try {
    const kind = zKind.safeParse(req.params.kind)
    if (!kind.success) {
      res.status(400).json(errorPayload('VALIDATION_ERROR', 'Catálogo desconhecido.', { requestId: req.requestId }))
      return
    }
    await refreshReferenceFromDatabase()
    res.json(listReference(kind.data))
  } catch (e) {
    next(e)
  }
})

catalogRouter.get('/subclasses', async (req, res, next) => {
  try {
    const className = String(req.query.class ?? '').trim()
    if (!className) {
      res.json([])
      return
    }
    res.json(await listSubclassesForClass(className))
  } catch (e) {
    next(e)
  }
})

catalogRouter.get('/clans', async (_req, res, next) => {
  try {
    const sb = getSupabaseAdmin()
    if (sb) {
      const { data, error } = await sb
        .from('Linhagens')
        .select('id, name, slug')
        .eq('active', true)
        .order('name', { ascending: true })
      if (!error && data && data.length > 0) {
        res.json(data)
        return
      }
    }
    res.json(CLANS)
  } catch (e) {
    next(e)
  }
})

/** Catedrais do catálogo de fé (ADM), filtradas por Luz ou Trevas. */
catalogRouter.get('/cathedrals', async (req, res, next) => {
  try {
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
  } catch (e) {
    next(e)
  }
})
