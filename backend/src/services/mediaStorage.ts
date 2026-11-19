import { randomUUID } from 'crypto'
import { getSupabaseAdmin } from './supabaseClient.js'

/** Foto e banner. O endereço público não leva o e-mail. */
export const PROFILE_BUCKET = 'perfil'

/** Loja, glossário e bestiário publicados. */
export const CATALOG_BUCKET = 'loja-glossario'

/** Mapas, pistas e downloads. O objeto não fica em URL pública. */
export const PRIVATE_BUCKET = 'revelacoes'

const MAX_BYTES = 2 * 1024 * 1024
const PRIVATE_PREFIX = 'private://'

type ParsedImage = { buffer: Buffer; contentType: string; ext: string }

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function catalogImageFolder(input: { kind?: string; shopCategory?: string }): 'loja' | 'glossario' {
  if (input.kind === 'equipment' || input.kind === 'consumable' || input.shopCategory) return 'loja'
  return 'glossario'
}

export function catalogImageIsPrivate(input: { kind?: string }) {
  return input.kind === 'download'
}

function matchesMagic(contentType: string, buffer: Buffer) {
  if (contentType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  if (contentType === 'image/png') return buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  if (contentType === 'image/gif') return buffer.subarray(0, 4).toString('ascii') === 'GIF8'
  if (contentType === 'image/webp') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  }
  return false
}

export function inspectImage(dataUrl: string): ParsedImage {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl)
  if (!match) throw new Error('Imagem inválida. Use JPEG, PNG, WebP ou GIF.')
  const contentType = match[1].toLowerCase()
  if (!ALLOWED.has(contentType)) throw new Error('Imagem inválida. Use JPEG, PNG, WebP ou GIF.')
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64')
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    throw new Error('Imagem inválida. O arquivo precisa ter até 2 MB.')
  }
  if (!matchesMagic(contentType, buffer)) throw new Error('Imagem inválida. O conteúdo não corresponde ao formato.')
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : contentType === 'image/gif' ? 'gif' : 'jpg'
  return { buffer, contentType, ext }
}

export function profileObjectPath(slot: 'avatar' | 'banner', ext: string) {
  return `${randomUUID()}/${slot}.${ext}`
}

export async function ensureMediaBuckets() {
  const sb = getSupabaseAdmin()
  if (!sb) return
  const buckets = [
    { id: PROFILE_BUCKET, isPublic: true },
    { id: CATALOG_BUCKET, isPublic: true },
    { id: PRIVATE_BUCKET, isPublic: false },
  ]
  for (const bucket of buckets) {
    const { error } = await sb.storage.createBucket(bucket.id, {
      public: bucket.isPublic,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [...ALLOWED],
    })
    if (error && !/already exists|duplicate/i.test(error.message)) {
      console.warn(`[storage] bucket ${bucket.id}:`, error.message)
    }
  }
}

async function uploadPublic(bucket: string, path: string, image: ParsedImage) {
  const sb = getSupabaseAdmin()
  if (!sb) throw new Error('Não foi possível guardar a imagem. O armazenamento não está configurado.')
  const { error } = await sb.storage.from(bucket).upload(path, image.buffer, {
    contentType: image.contentType,
    upsert: false,
  })
  if (error) {
    console.warn(`[storage] upload ${bucket}/${path}:`, error.message)
    throw new Error('Não foi possível guardar a imagem. A versão anterior continua valendo.')
  }
  const publicUrl = sb.storage.from(bucket).getPublicUrl(path).data.publicUrl
  return `${publicUrl}?v=${Date.now()}`
}

async function uploadPrivate(path: string, image: ParsedImage) {
  const sb = getSupabaseAdmin()
  if (!sb) throw new Error('Não foi possível guardar a imagem. O armazenamento não está configurado.')
  const { error } = await sb.storage.from(PRIVATE_BUCKET).upload(path, image.buffer, {
    contentType: image.contentType,
    upsert: false,
  })
  if (error) {
    console.warn(`[storage] upload ${PRIVATE_BUCKET}/${path}:`, error.message)
    throw new Error('Não foi possível guardar a imagem. A versão anterior continua valendo.')
  }
  return `${PRIVATE_PREFIX}${PRIVATE_BUCKET}/${path}`
}

export async function readableImageUrl(url?: string | null) {
  if (!url || !url.startsWith(PRIVATE_PREFIX)) return url
  const rest = url.slice(PRIVATE_PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return undefined
  const bucket = rest.slice(0, slash)
  const path = rest.slice(slash + 1)
  const sb = getSupabaseAdmin()
  if (!sb) return undefined
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 10 * 60)
  if (error || !data?.signedUrl) return undefined
  return data.signedUrl
}

export async function withReadableImages<T extends { imageUrl?: string | null }>(rows: T[]) {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      imageUrl: await readableImageUrl(row.imageUrl),
    })),
  )
}

/** Grava avatar ou banner. Endereço http já salvo passa direto. */
export async function storeProfileImage(slot: 'avatar' | 'banner', value: string | null | undefined) {
  if (value == null || !value.startsWith('data:image/')) return value
  const parsed = inspectImage(value)
  return uploadPublic(PROFILE_BUCKET, profileObjectPath(slot, parsed.ext), parsed)
}

/** Grava ilustração pública ou, no caso de download, objeto privado. */
export async function storeCatalogImage(
  folder: 'loja' | 'glossario',
  entityId: string,
  value: string | undefined,
  access: 'public' | 'private' = 'public',
) {
  if (!value?.startsWith('data:image/')) return value
  const parsed = inspectImage(value)
  if (access === 'private') return uploadPrivate(`${entityId}.${parsed.ext}`, parsed)
  return uploadPublic(CATALOG_BUCKET, `${folder}/${entityId}-${randomUUID()}.${parsed.ext}`, parsed)
}
