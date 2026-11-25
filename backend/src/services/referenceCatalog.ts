import { randomUUID } from 'crypto'
import { readJsonFile, writeJsonFile } from './localJson.js'
import { getSupabaseAdmin } from './supabaseClient.js'

export const REFERENCE_KINDS = [
  'faith',
  'mortal_order',
  'monster_type',
  'equipment_type',
  'magic',
  'relic',
  'subclass',
] as const

export type ReferenceKind = (typeof REFERENCE_KINDS)[number]

export type ReferenceEntry = {
  id: string
  kind: ReferenceKind
  name: string
  description: string
  className: string
  faithPath: '' | 'luz' | 'trevas'
  sortOrder: number
  updatedAt: string
}

const FILE = 'reference-catalog.json'
const REFRESH_TTL_MS = 30_000
const entries = new Map<string, ReferenceEntry>()
let lastRefreshedAt = 0
let refreshInFlight: Promise<void> | null = null

function isKind(value: string): value is ReferenceKind {
  return (REFERENCE_KINDS as readonly string[]).includes(value)
}

const KIND_FROM_SHEET: Record<string, ReferenceKind> = {
  magic_type: 'magic',
  relic_amulet_type: 'relic',
  relic_type: 'relic',
}

function kindFromSheet(value: string): ReferenceKind | null {
  if (isKind(value)) return value
  return KIND_FROM_SHEET[value] ?? null
}

function snapshot() {
  writeJsonFile(FILE, [...entries.values()])
}

export function listReference(kind?: ReferenceKind) {
  return [...entries.values()]
    .filter((row) => (kind ? row.kind === kind : true))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'))
}

function sameText(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

function findSameEntry(kind: ReferenceKind, name: string, className: string) {
  return [...entries.values()].find(
    (row) => row.kind === kind && sameText(row.name, name) && sameText(row.className, className),
  )
}

/** Acrescenta linhas novas. Nome igual com a mesma descrição é duplicata e fica de fora. */
export async function mergeReferenceKind(kind: ReferenceKind, rows: Array<Partial<ReferenceEntry> & { name: string }>) {
  const now = new Date().toISOString()
  const added: ReferenceEntry[] = []
  const updated: ReferenceEntry[] = []
  let skipped = 0
  for (const row of rows) {
    const name = row.name.trim()
    if (!name) continue
    const className = kind === 'subclass' ? row.className?.trim() ?? '' : ''
    const description = row.description?.trim() ?? ''
    const faithPath = kind === 'faith' && (row.faithPath === 'luz' || row.faithPath === 'trevas') ? row.faithPath : ''
    const existing =
      findSameEntry(kind, name, className) ??
      added.find((row) => sameText(row.name, name) && sameText(row.className, className)) ??
      updated.find((row) => sameText(row.name, name) && sameText(row.className, className))
    if (existing) {
      if (sameText(existing.description, description) && existing.faithPath === faithPath) {
        skipped += 1
        continue
      }
      const next = {
        ...existing,
        description: description || existing.description,
        faithPath: faithPath || existing.faithPath,
        updatedAt: now,
      }
      const addedIndex = added.findIndex((item) => item.id === existing.id)
      if (addedIndex >= 0) {
        added[addedIndex] = next
        continue
      }
      const updatedIndex = updated.findIndex((item) => item.id === existing.id)
      if (updatedIndex >= 0) updated[updatedIndex] = next
      else updated.push(next)
      continue
    }
    added.push({
      id: randomUUID(),
      kind,
      name,
      description,
      className,
      faithPath,
      sortOrder: row.sortOrder ?? listReference(kind).length + added.length,
      updatedAt: now,
    })
  }
  await upsertReferenceRows([...added, ...updated])
  for (const row of [...added, ...updated]) entries.set(row.id, row)
  snapshot()
  return { added: added.length, updated: updated.length, skipped, items: listReference(kind) }
}

export async function upsertReference(input: Partial<ReferenceEntry> & { kind: ReferenceKind; name: string }) {
  const current = input.id ? entries.get(input.id) : undefined
  const row: ReferenceEntry = {
    id: current?.id ?? input.id ?? randomUUID(),
    kind: input.kind,
    name: input.name.trim(),
    description: input.description?.trim() ?? current?.description ?? '',
    className: input.kind === 'subclass' ? input.className?.trim() || current?.className || '' : '',
    faithPath:
      input.kind === 'faith' && (input.faithPath === 'luz' || input.faithPath === 'trevas')
        ? input.faithPath
        : input.kind === 'faith'
          ? current?.faithPath ?? ''
          : '',
    sortOrder: input.sortOrder ?? current?.sortOrder ?? listReference(input.kind).length,
    updatedAt: new Date().toISOString(),
  }
  await upsertReferenceRows([row])
  entries.set(row.id, row)
  snapshot()
  return row
}

export async function deleteReference(id: string) {
  const row = entries.get(id)
  if (!row) return false
  const sb = process.env.NODE_ENV === 'test' ? null : getSupabaseAdmin()
  if (sb) {
    const { error } = await sb.from('CatalogoReferencia').delete().eq('id', id)
    if (error) {
      console.warn('[catálogo] Falha ao excluir:', error.message)
      throw new Error('Não foi possível excluir no banco. O item continua no catálogo.')
    }
  }
  entries.delete(id)
  lastRefreshedAt = Date.now()
  snapshot()
  return true
}

function dbRecord(row: ReferenceEntry) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    class_name: row.className,
    faith_path: row.faithPath,
    sort_order: row.sortOrder,
    updated_at: row.updatedAt,
  }
}

async function upsertReferenceRows(rows: ReferenceEntry[]) {
  lastRefreshedAt = Date.now()
  if (process.env.NODE_ENV === 'test') return
  const sb = getSupabaseAdmin()
  if (!sb || !rows.length) return
  const { error } = await sb.from('CatalogoReferencia').upsert(rows.map(dbRecord), { onConflict: 'id' })
  if (!error) return
  if (!/duplicate key/i.test(error.message)) {
    console.warn('[catálogo] Falha ao gravar:', error.message)
    throw new Error('Não foi possível gravar o catálogo no banco. A lista anterior continua valendo.')
  }
  for (const row of rows) {
    const record = dbRecord(row)
    const { id: _id, ...rest } = record
    const { data, error: updateError } = await sb
      .from('CatalogoReferencia')
      .update(rest)
      .eq('kind', row.kind)
      .eq('name', row.name)
      .eq('class_name', row.className)
      .select('id')
    if (updateError || !data?.length) {
      console.warn('[catálogo] Falha ao gravar:', updateError?.message ?? error.message)
      throw new Error('Não foi possível gravar o catálogo no banco. A lista anterior continua valendo.')
    }
  }
}

function applyRows(rows: ReferenceEntry[]) {
  entries.clear()
  for (const row of rows) {
    if (!isKind(row.kind) || !row.name) continue
    entries.set(row.id, row)
  }
}

export async function hydrateReferenceCatalog() {
  const local = readJsonFile<ReferenceEntry[]>(FILE)
  if (local?.length) applyRows(local)

  const sb = getSupabaseAdmin()
  if (!sb) {
    if (entries.size) console.log(`[catálogo] ${entries.size} item(ns) da cópia local`)
    return
  }
  const { data, error } = await sb
    .from('CatalogoReferencia')
    .select('id, kind, name, description, class_name, faith_path, sort_order, updated_at')
    .order('sort_order', { ascending: true })
  if (error) {
    console.warn('[catálogo] Supabase indisponível, mantendo cópia local:', error.message)
    return
  }
  if (!data?.length) {
    if (entries.size) console.log(`[catálogo] banco vazio — ${entries.size} item(ns) da cópia local`)
    return
  }
  let added = 0
  for (const raw of data) {
    const kind = kindFromSheet(String(raw.kind))
    if (!kind || !textName(raw.name)) continue
    const className = String(raw.class_name ?? '')
    const description = String(raw.description ?? '')
    const existing = findSameEntry(kind, String(raw.name), className)
    if (existing) continue
    entries.set(String(raw.id), {
      id: String(raw.id),
      kind,
      name: String(raw.name).trim(),
      description,
      className,
      faithPath: raw.faith_path === 'luz' || raw.faith_path === 'trevas' ? raw.faith_path : '',
      sortOrder: Number(raw.sort_order ?? 0),
      updatedAt: String(raw.updated_at ?? new Date().toISOString()),
    })
    added += 1
  }
  if (added) snapshot()
  console.log(`[catálogo] ${entries.size} item(ns) disponíveis (${added} novos do banco)`)
}

function textName(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0
}

export async function refreshReferenceFromDatabase() {
  if (Date.now() - lastRefreshedAt < REFRESH_TTL_MS) return
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = hydrateReferenceCatalog()
    .then(() => {
      lastRefreshedAt = Date.now()
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

/** Só para testes automatizados. */
export function resetReferenceCatalogForTests() {
  entries.clear()
  lastRefreshedAt = 0
  refreshInFlight = null
  writeJsonFile(FILE, [])
}
