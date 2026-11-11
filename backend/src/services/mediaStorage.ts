import { getSupabaseAdmin } from './supabaseClient.js'

/** Foto e banner de jogador e narrador. */
export const PROFILE_BUCKET = 'perfil'

/**
 * Imagens de loja e glossário no mesmo bucket.
 * O nome não leva barra: o Storage rejeita "/".
 * Dentro dele, as pastas são loja/ e glossario/.
 */
export const CATALOG_BUCKET = 'loja-glossario'

type ParsedImage = { buffer: Buffer; contentType: string; ext: string }

function parseDataUrl(dataUrl: string): ParsedImage | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl)
  if (!match) return null
  const contentType = match[1].toLowerCase()
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('gif')
        ? 'gif'
        : 'jpg'
  return { buffer: Buffer.from(match[2], 'base64'), contentType, ext }
}

function safeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '_')
}

export function catalogImageFolder(input: { kind?: string; shopCategory?: string }): 'loja' | 'glossario' {
  if (input.kind === 'equipment' || input.kind === 'consumable' || input.shopCategory) return 'loja'
  return 'glossario'
}

export async function ensureMediaBuckets() {
  const sb = getSupabaseAdmin()
  if (!sb) return
  for (const id of [PROFILE_BUCKET, CATALOG_BUCKET]) {
    const { error } = await sb.storage.createBucket(id, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    })
    if (error && !/already exists|duplicate/i.test(error.message)) {
      console.warn(`[storage] bucket ${id}:`, error.message)
    }
  }
}

async function upload(bucket: string, path: string, image: ParsedImage) {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const { error } = await sb.storage.from(bucket).upload(path, image.buffer, {
    contentType: image.contentType,
    upsert: true,
  })
  if (error) {
    console.warn(`[storage] upload ${bucket}/${path}:`, error.message)
    return null
  }
  const publicUrl = sb.storage.from(bucket).getPublicUrl(path).data.publicUrl
  return `${publicUrl}?v=${Date.now()}`
}

/** Grava avatar ou banner. Se não for data URL, devolve o valor original. */
export async function storeProfileImage(
  email: string,
  slot: 'avatar' | 'banner',
  value: string | null | undefined,
) {
  if (value == null || !value.startsWith('data:image/')) return value
  const parsed = parseDataUrl(value)
  if (!parsed) return value
  const url = await upload(PROFILE_BUCKET, `${safeKey(email)}/${slot}.${parsed.ext}`, parsed)
  return url ?? value
}

/** Grava a ilustração da loja ou do glossário e devolve a URL pública. */
export async function storeCatalogImage(
  folder: 'loja' | 'glossario',
  entityId: string,
  value: string | undefined,
) {
  if (!value?.startsWith('data:image/')) return value
  const parsed = parseDataUrl(value)
  if (!parsed) return value
  const url = await upload(CATALOG_BUCKET, `${folder}/${entityId}.${parsed.ext}`, parsed)
  return url ?? value
}
