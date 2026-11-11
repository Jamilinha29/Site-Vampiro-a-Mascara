import type { ChronicleEntity } from './chronicleStore.js'
import { getSupabaseAdmin } from './supabaseClient.js'

const TABLE = 'chronicle_entities'

type DbRow = {
  id: string
  kind: string
  visibility: string
  payload: ChronicleEntity
  created_at: string
  updated_at: string
}

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
  let classification = rawClassification.toLowerCase()
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

/** Planilha gravada nas colunas entra no mesmo formato que o payload do glossário. */
export function entityFromDbRow(row: Record<string, unknown>): ChronicleEntity | null {
  const payload =
    row.payload && typeof row.payload === 'object' ? (row.payload as Partial<ChronicleEntity>) : {}
  const name = firstText(payload.name, row.name)
  const kind = firstText(payload.kind, row.kind)
  if (!name || !KINDS.has(kind)) return null
  const visibility = firstText(payload.visibility, row.visibility) || 'published'
  const placed = placeArchive(firstText(payload.archiveCategory, row.archive_category), firstText(payload.classification, row.classification))
  const classification = (placed.classification || undefined) as ChronicleEntity['classification']
  const threatLevel = normalizeThreat(payload.threatLevel)
  return {
    ...payload,
    id: firstText(payload.id, row.id),
    kind: kind as ChronicleEntity['kind'],
    name,
    description: firstText(payload.description, row.description, payload.narratorNotes),
    visibility: visibility === 'draft' ? 'draft' : 'published',
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
    createdAt: firstText(payload.createdAt, row.created_at) || new Date().toISOString(),
    updatedAt: firstText(payload.updatedAt, row.updated_at) || new Date().toISOString(),
  }
}

export async function dbLoadEntities(): Promise<ChronicleEntity[] | null> {
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
  const sb = getSupabaseAdmin()
  if (!sb) return []
  const { data, error } = await sb.from('reference_catalog').select('id, name, description').eq('kind', 'grimoire_spell')
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

export async function dbUpsertEntity(row: ChronicleEntity): Promise<void> {
  const sb = getSupabaseAdmin()
  if (!sb) return
  const record = {
    id: row.id,
    kind: row.kind,
    visibility: row.visibility,
    payload: row,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  }
  const { error } = await sb.from(TABLE).upsert(record, { onConflict: 'id' })
  if (error) console.warn('[supabase] Falha ao salvar entidade:', row.id, error.message)
}

export async function dbDeleteEntity(id: string): Promise<void> {
  const sb = getSupabaseAdmin()
  if (!sb) return
  const { error } = await sb.from(TABLE).delete().eq('id', id)
  if (error) console.warn('[supabase] Falha ao excluir entidade:', id, error.message)
}
