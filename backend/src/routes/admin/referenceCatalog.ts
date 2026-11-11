import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../../middlewares/optionalUser.js'
import { requireNarrator } from '../../middlewares/requireNarrator.js'
import {
  REFERENCE_KINDS,
  deleteReference,
  listReference,
  mergeReferenceKind,
  refreshReferenceFromDatabase,
  upsertReference,
  type ReferenceKind,
} from '../../services/referenceCatalog.js'

export const adminReferenceRouter = Router()
adminReferenceRouter.use(requireUser, requireNarrator)

const kindSchema = z.enum(REFERENCE_KINDS)

const entrySchema = z.object({
  id: z.string().min(1).max(80).optional(),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional().default(''),
  className: z.string().max(80).optional().default(''),
  faithPath: z.enum(['', 'luz', 'trevas']).optional().default(''),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
})

adminReferenceRouter.get('/:kind', async (req, res) => {
  const kind = kindSchema.safeParse(req.params.kind)
  if (!kind.success) {
    res.status(400).json({ error: { message: 'Catálogo desconhecido' } })
    return
  }
  await refreshReferenceFromDatabase()
  res.json(listReference(kind.data))
})

adminReferenceRouter.post('/:kind', (req, res, next) => {
  try {
    const kind = kindSchema.parse(req.params.kind)
    const body = entrySchema.parse(req.body)
    res.status(201).json(upsertReference({ ...body, kind }))
  } catch (error) {
    next(error)
  }
})

adminReferenceRouter.put('/:kind', (req, res, next) => {
  try {
    const kind = kindSchema.parse(req.params.kind) as ReferenceKind
    const rows = z.array(entrySchema).max(500).parse(req.body)
    res.json(mergeReferenceKind(kind, rows))
  } catch (error) {
    next(error)
  }
})

adminReferenceRouter.delete('/:kind/:id', (req, res) => {
  const ok = deleteReference(req.params.id)
  if (!ok) {
    res.status(404).json({ error: { message: 'Item não encontrado' } })
    return
  }
  res.status(204).send()
})
