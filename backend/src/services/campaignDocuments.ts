import { readJsonFile, writeJsonFile } from './localJson.js'
import { getSupabaseAdmin } from './supabaseClient.js'

type Envelope<T> = { updatedAt: string; body: T }

const TABLE = 'DocumentosCampanha'
let chain: Promise<void> = Promise.resolve()
let warnedMissing = false

export function documentWeight(body: unknown) {
  if (Array.isArray(body)) return body.length
  if (body && typeof body === 'object') return Object.keys(body as object).length
  return body == null ? 0 : 1
}

/** Escolhe a cópia mais nova. Uma cópia vazia não apaga a que tem dados. */
export function chooseDocument<T>(local: Envelope<T> | null, remote: Envelope<T> | null): Envelope<T> | null {
  if (!local) return remote
  if (!remote) return local
  const localWeight = documentWeight(local.body)
  const remoteWeight = documentWeight(remote.body)
  if (localWeight === 0 && remoteWeight > 0) return remote
  if (remoteWeight === 0 && localWeight > 0) return local
  return remote.updatedAt >= local.updatedAt ? remote : local
}

function localName(id: string) {
  return `state-${id}.json`
}

async function upsertDocument(id: string, envelope: Envelope<unknown>) {
  if (process.env.NODE_ENV === 'test') return
  const sb = getSupabaseAdmin()
  if (!sb) return
  const { error } = await sb.from(TABLE).upsert(
    { id, payload: envelope, updated_at: envelope.updatedAt },
    { onConflict: 'id' },
  )
  if (!error) return
  const missing = /DocumentosCampanha|campaign_documents|schema cache|does not exist/i.test(error.message)
  if (missing) {
    if (!warnedMissing) {
      console.warn('[estado] Tabela DocumentosCampanha ainda não existe. A cópia local foi mantida. Aplique as migrações do Supabase.')
      warnedMissing = true
    }
    return
  }
  console.warn('[estado] Falha ao gravar', id, error.message)
  throw new Error('Não foi possível gravar o estado da campanha no banco. A cópia local foi mantida.')
}

export function rememberDocument(id: string, body: unknown) {
  if (process.env.NODE_ENV === 'test') return
  const envelope: Envelope<unknown> = { updatedAt: new Date().toISOString(), body }
  writeJsonFile(localName(id), envelope)
  const job = chain.catch(() => undefined).then(() => upsertDocument(id, envelope))
  chain = job.then(
    () => undefined,
    () => undefined,
  )
}

export function flushDurableState() {
  return chain
}

export async function loadDocument<T>(id: string): Promise<Envelope<T> | null> {
  if (process.env.NODE_ENV === 'test') return null
  const local = readJsonFile<Envelope<T>>(localName(id))
  const sb = getSupabaseAdmin()
  if (!sb) return local
  const { data, error } = await sb.from(TABLE).select('payload').eq('id', id).maybeSingle()
  if (error) {
    if (!/DocumentosCampanha|campaign_documents|schema cache|does not exist/i.test(error.message)) {
      console.warn('[estado] Falha ao ler', id, error.message)
    }
    return local
  }
  const remote = (data?.payload ?? null) as Envelope<T> | null
  const chosen = chooseDocument(local, remote)
  if (!chosen) return null
  writeJsonFile(localName(id), chosen)
  if (chosen !== remote) await upsertDocument(id, chosen)
  return chosen
}
