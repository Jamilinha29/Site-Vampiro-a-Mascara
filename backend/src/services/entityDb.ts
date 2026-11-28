import type { ChronicleEntity } from './chronicleStore.js'
import { PersistenceError } from './errors.js'
import { getSupabaseAdmin, isSharedDeploymentEnvironment } from './supabaseClient.js'

const TABLE = 'EntidadesCronica'

const KINDS = new Set(['npc', 'monster', 'equipment', 'consumable', 'archive', 'download'])

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const next = text(value)
    if (next) return next
  }
  return ''
}

const THREATS = new Set(['inofensivo', 'comum', 'perigoso', 'letal', 'cataclismico'])

function normalizeThreat(value: unknown): ChronicleEntity['threatLevel'] {
  const next = text(value).toLowerCase()
  if (THREATS.has(next)) return next as ChronicleEntity['threatLevel']
  return undefined
}

/** A planilha usa grimoire, tome e amulet. O glossário usa rituals, chronicles e relics. */
function placeArchive(rawCategory: string, rawClassification: string) {
  const category = rawCategory.toLowerCase()
  const classification = rawClassification.toLowerCase()
  if (category === 'grimoire' || category === 'grimorio' || classification === 'grimoire') {
    return { archiveCategory: 'rituals' as const, classification: 'grimoire' }
  }
  if (category === 'amulet' || category === 'amuleto' || category === 'amulets' || classification === 'amulet') {
    return { archiveCategory: 'chronicles' as const, classification: 'amulet' }
  }
  if (category === 'relic' || category === 'reliquia' || category === 'relics' || classification === 'relic') {
    return { archiveCategory: 'relics' as const, classification: classification === 'amulet' ? 'amulet' : 'relic' }
  }
  if (category === 'tome' || category === 'tomo' || category === 'chronicles') {
    return { archiveCategory: 'chronicles' as const, classification }
  }
  if (category === 'rituals') return { archiveCategory: 'rituals' as const, classification: classification || 'grimoire' }
  if (classification === 'grimoire') return { archiveCategory: 'rituals' as const, classification: 'grimoire' }
  if (classification === 'amulet') return { archiveCategory: 'chronicles' as const, classification: 'amulet' }
  if (classification === 'relic') return { archiveCategory: 'relics' as const, classification: 'relic' }
  return { archiveCategory: undefined, classification }
}

/**
 * Planilha gravada nas colunas entra no mesmo formato que o payload do glossário.
 * Padrão conservador (C22): registros sem visibilidade explícita entram como `draft`.
 */
export function entityFromDbRow(row: Record<string, unknown>): ChronicleEntity | null {
  const payload =
    row.payload && typeof row.payload === 'object' ? (row.payload as Partial<ChronicleEntity>) : {}
  const name = firstText(payload.name, row.name)
  const kind = firstText(payload.kind, row.kind)
  if (!name || !KINDS.has(kind)) return null
  const rawVisibility = firstText(payload.visibility, row.visibility).toLowerCase()
  const visibility: ChronicleEntity['visibility'] = rawVisibility === 'published' ? 'published' : 'draft'
  const placed = placeArchive(
    firstText(payload.archiveCategory, row.archive_category),
    firstText(payload.classification, row.classification),
  )
  const classification = (placed.classification || undefined) as ChronicleEntity['classification']
  const threatLevel = normalizeThreat(payload.threatLevel)
  return {
    ...payload,
    id: firstText(payload.id, row.id),
    kind: kind as ChronicleEntity['kind'],
    name,
    description: firstText(payload.description, row.description),
    visibility,
    archiveCategory: placed.archiveCategory,
    bestiaryTier: kind === 'monster' ? payload.bestiaryTier ?? 'known' : payload.bestiaryTier,
    threatLevel,
    shopCategory: (firstText(payload.shopCategory, row.shop_category) || undefined) as ChronicleEntity['shopCategory'],
    downloadCategory: (firstText(payload.downloadCategory, row.download_category) || undefined) as ChronicleEntity['downloadCategory'],
    classification,
    magicType: firstText(payload.magicType, row.magic_type) || undefined,
    cooldownText: firstText(payload.cooldownText, row.cooldown_text) || undefined,
    relicAmuletType: firstText(payload.relicAmuletType, row.relic_amulet_type) || undefined,
    equipmentType: firstText(payload.equipmentType, row.equipment_type) || undefined,
    creatureType: firstText(payload.creatureType, row.creature_type) || undefined,
    statsText: firstText(payload.statsText, row.stats_text) || undefined,
    imageUrl: firstText(payload.imageUrl, row.image_url) || undefined,
    fileUrl: firstText(payload.fileUrl, row.file_url) || undefined,
    chronicleScope: payload.chronicleScope ?? (typeof row.chronicle_scope === 'string' ? row.chronicle_scope : null),
    narratorScope: payload.narratorScope ?? (typeof row.narrator_scope === 'string' ? row.narrator_scope : null),
    createdAt: firstText(payload.createdAt, row.created_at) || new Date().toISOString(),
    updatedAt: firstText(payload.updatedAt, row.updated_at) || new Date().toISOString(),
  }
}

export async function dbLoadEntities(): Promise<ChronicleEntity[] | null> {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') return null
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { data, error } = await sb.from(TABLE).select('*').order('updated_at', { ascending: false })
  if (error) {
    console.warn('[supabase] Falha ao carregar entidades:', error.message)
    return null
  }
  return (data ?? []).flatMap((row) => {
    const entity = entityFromDbRow(row as Record<string, unknown>)
    return entity ? [entity] : []
  })
}

/** Feitiços gravados no catálogo entram no glossário como grimório. */
export async function dbLoadGrimoireSpells(): Promise<ChronicleEntity[]> {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') return []
  const sb = getSupabaseAdmin()
  if (!sb) return []
  const { data, error } = await sb.from('CatalogoReferencia').select('id, name, description').eq('kind', 'grimoire_spell')
  if (error || !data?.length) return []
  const now = new Date().toISOString()
  return data.flatMap((row) => {
    const name = text(row.name)
    if (!name) return []
    const description = text(row.description)
    const magicMatch = description.match(/Tipo:\s*([^\n.]+)/i)
    const spell: ChronicleEntity = {
      id: String(row.id),
      kind: 'archive',
      name,
      description,
      visibility: 'published',
      archiveCategory: 'rituals',
      classification: 'grimoire',
      magicType: magicMatch?.[1]?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    }
    return [spell]
  })
}

export async function dbUpsertEntity(row: ChronicleEntity): Promise<{ ok: true } | { ok: false; error: string }> {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') {
    return { ok: true }
  }
  const sb = getSupabaseAdmin()
  if (!sb) {
    if (isSharedDeploymentEnvironment()) {
      throw new PersistenceError('Banco durável não configurado neste ambiente publicado.')
    }
    return { ok: true }
  }
  const record = {
    id: row.id,
    kind: row.kind,
    visibility: row.visibility,
    payload: row,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
  const { error } = await sb.from(TABLE).upsert(record, { onConflict: 'id' })
  if (error) {
    console.warn('[supabase] Falha ao salvar entidade:', row.id, error.message)
    throw new PersistenceError(`Não foi possível gravar “${row.name}” no banco. A versão anterior continua valendo.`, error)
  }
  return { ok: true }
}

export async function dbDeleteEntity(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') {
    return { ok: true }
  }
  const sb = getSupabaseAdmin()
  if (!sb) {
    if (isSharedDeploymentEnvironment()) {
      throw new PersistenceError('Banco durável não configurado neste ambiente publicado.')
    }
    return { ok: true }
  }
  const { error } = await sb.from(TABLE).delete().eq('id', id)
  if (error) {
    console.warn('[supabase] Falha ao excluir entidade:', id, error.message)
    throw new PersistenceError('Não foi possível excluir no banco. O registro continua na mesa.', error)
  }
  return { ok: true }
}
