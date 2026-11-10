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

export async function dbLoadEntities(): Promise<ChronicleEntity[] | null> {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { data, error } = await sb.from(TABLE).select('payload').order('updated_at', { ascending: false })
  if (error) {
    console.warn('[supabase] Falha ao carregar entidades:', error.message)
    return null
  }
  return (data ?? []).map((row) => row.payload as ChronicleEntity)
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
