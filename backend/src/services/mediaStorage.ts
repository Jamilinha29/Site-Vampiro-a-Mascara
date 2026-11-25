import { randomUUID } from 'node:crypto'
import { ValidationError } from './errors.js'
import { getSupabaseAdmin } from './supabaseClient.js'

/** Foto e banner. O endereço público não leva o e-mail. */
export const PROFILE_BUCKET = 'perfil'

/** Loja, glossário e bestiário publicados. */
export const CATALOG_BUCKET = 'loja-glossario'

/** Mapas, pistas e downloads. O objeto não fica em URL pública. */
export const PRIVATE_BUCKET = 'revelacoes'

const MAX_BYTES = 2 * 1024 * 1024
const PRIVATE_PREFIX = 'private://'
const ALLOWED_PRIVATE_BUCKETS = new Set([PRIVATE_BUCKET])

type ParsedAsset = { buffer: Buffer; contentType: string; ext: string }

const ALLOWED_IMAGES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_DOWNLOADS = new Set([...ALLOWED_IMAGES, 'application/pdf'])

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
  if (contentType === 'application/pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  }
  return false
}

export function inspectImage(dataUrl: string): ParsedAsset {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl)
  if (!match) throw new ValidationError('Imagem inválida. Use JPEG, PNG, WebP ou GIF.')
  const contentType = match[1].toLowerCase()
  if (!ALLOWED_IMAGES.has(contentType)) throw new ValidationError('Imagem inválida. Use JPEG, PNG, WebP ou GIF.')
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64')
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    throw new ValidationError('Imagem inválida. O arquivo precisa ter até 2 MB.')
  }
  if (!matchesMagic(contentType, buffer)) {
    throw new ValidationError('Imagem inválida. O conteúdo não corresponde ao formato.')
  }
  const ext =
    contentType === 'image/png'
      ? 'png'
      : contentType === 'image/webp'
        ? 'webp'
        : contentType === 'image/gif'
          ? 'gif'
          : 'jpg'
  return { buffer, contentType, ext }
}

export function inspectDownloadAsset(dataUrl: string): ParsedAsset {
  const match = /^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl)
  if (!match) throw new ValidationError('Arquivo inválido. Use PDF, JPEG, PNG, WebP ou GIF.')
  const contentType = match[1].toLowerCase()
  if (!ALLOWED_DOWNLOADS.has(contentType)) {
    throw new ValidationError('Tipo de arquivo não permitido. Use PDF, JPEG, PNG, WebP ou GIF.')
  }
  const buffer = Buffer.from(match[2].replace(/\s/g, ''), 'base64')
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    throw new ValidationError('Arquivo acima do limite de 2 MB.')
  }
  if (!matchesMagic(contentType, buffer)) {
    throw new ValidationError('Arquivo inválido. O conteúdo não corresponde ao formato informado.')
  }
  const ext =
    contentType === 'application/pdf'
      ? 'pdf'
      : contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : contentType === 'image/gif'
            ? 'gif'
            : 'jpg'
  return { buffer, contentType, ext }
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '')
  if (!host) return true
  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true
  }
  const parts = host.split('.').map((p) => Number(p))
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = parts
    if (a === 10 || a === 127 || a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
  }
  return false
}

export function isSafePublicMediaUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith(PRIVATE_PREFIX)) return false
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    return !isPrivateOrLocalHostname(parsed.hostname)
  } catch {
    return false
  }
}

export function parsePrivateObjectRef(url: string): { bucket: string; path: string } | null {
  if (!url || !url.startsWith(PRIVATE_PREFIX)) return null
  const rest = url.slice(PRIVATE_PREFIX.length)
  const slash = rest.indexOf('/')
  if (slash <= 0) return null
  const bucket = rest.slice(0, slash)
  const path = rest.slice(slash + 1)
  if (!ALLOWED_PRIVATE_BUCKETS.has(bucket)) return null
  if (!path || path.includes('..') || path.startsWith('/') || path.includes('\\') || /[?#]/.test(path)) {
    return null
  }
  if (!/^[A-Za-z0-9/_.-]+$/.test(path)) return null
  return { bucket, path }
}

export function profileObjectPath(slot: 'avatar' | 'banner', ext: string) {
  return `${randomUUID()}/${slot}.${ext}`
}

export async function ensureMediaBuckets() {
  const sb = getSupabaseAdmin()
  if (!sb) return
  const publicBuckets = [
    { id: PROFILE_BUCKET, isPublic: true, mimes: [...ALLOWED_IMAGES] },
    { id: CATALOG_BUCKET, isPublic: true, mimes: [...ALLOWED_IMAGES] },
    { id: PRIVATE_BUCKET, isPublic: false, mimes: [...ALLOWED_DOWNLOADS] },
  ]
  for (const bucket of publicBuckets) {
    const { error } = await sb.storage.createBucket(bucket.id, {
      public: bucket.isPublic,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: bucket.mimes,
    })
    if (error && !/already exists|duplicate/i.test(error.message)) {
      console.warn(`[storage] bucket ${bucket.id}:`, error.message)
    }
  }
}

async function uploadPublic(bucket: string, path: string, asset: ParsedAsset) {
  const sb = getSupabaseAdmin()
  if (!sb) throw new Error('Não foi possível guardar a imagem. O armazenamento não está configurado.')
  const { error } = await sb.storage.from(bucket).upload(path, asset.buffer, {
    contentType: asset.contentType,
    upsert: false,
  })
  if (error) {
    console.warn(`[storage] upload ${bucket}/${path}:`, error.message)
    throw new Error('Não foi possível guardar a imagem. A versão anterior continua valendo.')
  }
  const publicUrl = sb.storage.from(bucket).getPublicUrl(path).data.publicUrl
  return `${publicUrl}?v=${Date.now()}`
}

async function uploadPrivate(path: string, asset: ParsedAsset) {
  const sb = getSupabaseAdmin()
  if (!sb) throw new Error('Não foi possível guardar o arquivo. O armazenamento não está configurado.')
  const { error } = await sb.storage.from(PRIVATE_BUCKET).upload(path, asset.buffer, {
    contentType: asset.contentType,
    upsert: false,
  })
  if (error) {
    console.warn(`[storage] upload ${PRIVATE_BUCKET}/${path}:`, error.message)
    throw new Error('Não foi possível guardar o arquivo privado. A versão anterior continua valendo.')
  }
  return `${PRIVATE_PREFIX}${PRIVATE_BUCKET}/${path}`
}

export async function readableImageUrl(url?: string | null) {
  if (!url) return url
  if (!url.startsWith(PRIVATE_PREFIX)) return url
  const parsed = parsePrivateObjectRef(url)
  if (!parsed) return undefined
  const sb = getSupabaseAdmin()
  if (!sb) return undefined
  const { data, error } = await sb.storage.from(parsed.bucket).createSignedUrl(parsed.path, 10 * 60)
  if (error || !data?.signedUrl) return undefined
  return data.signedUrl
}

export async function withReadableImages<T extends { imageUrl?: string | null; fileUrl?: string | null }>(
  rows: T[],
): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      imageUrl: await readableImageUrl(row.imageUrl),
      ...(row.fileUrl !== undefined ? { fileUrl: await readableImageUrl(row.fileUrl) } : {}),
    })),
  )
}

/** Grava avatar ou banner. Impede referências private:// fornecidas pelo cliente. */
export async function storeProfileImage(slot: 'avatar' | 'banner', value: string | null | undefined) {
  if (value == null) return value
  if (value.startsWith(PRIVATE_PREFIX)) {
    throw new ValidationError('Referência privada inválida para foto de perfil.')
  }
  if (!value.startsWith('data:image/')) {
    if (!isSafePublicMediaUrl(value)) {
      throw new ValidationError('URL de imagem inválida.')
    }
    return value
  }
  const parsed = inspectImage(value)
  return uploadPublic(PROFILE_BUCKET, profileObjectPath(slot, parsed.ext), parsed)
}

/** Grava ilustração pública ou, no caso de download, objeto privado. */
export async function storeCatalogImage(
  folder: 'loja' | 'glossario',
  entityId: string,
  value: string | undefined,
  access: 'public' | 'private' = 'public',
  existingUrl?: string,
) {
  if (value == null) return value
  if (value.startsWith(PRIVATE_PREFIX)) {
    if (existingUrl && value === existingUrl && parsePrivateObjectRef(value)) {
      return value
    }
    throw new ValidationError('Referência private:// não pode ser fornecida diretamente pelo cliente.')
  }
  if (!value.startsWith('data:image/')) {
    if (!isSafePublicMediaUrl(value)) {
      throw new ValidationError('URL de imagem inválida.')
    }
    return value
  }
  const parsed = inspectImage(value)
  if (access === 'private') return uploadPrivate(`${entityId}-${randomUUID()}.${parsed.ext}`, parsed)
  return uploadPublic(CATALOG_BUCKET, `${folder}/${entityId}-${randomUUID()}.${parsed.ext}`, parsed)
}

/** Grava arquivo de download no bucket privado `revelacoes`. */
export async function storeCatalogDownloadFile(
  entityId: string,
  value: string | undefined,
  existingUrl?: string,
) {
  if (value == null) return value
  if (value.startsWith(PRIVATE_PREFIX)) {
    if (existingUrl && value === existingUrl && parsePrivateObjectRef(value)) {
      return value
    }
    throw new ValidationError('Referência private:// inválida.')
  }
  if (!value.startsWith('data:')) {
    if (!isSafePublicMediaUrl(value)) {
      throw new ValidationError('URL de arquivo inválida.')
    }
    return value
  }
  const parsed = inspectDownloadAsset(value)
  return uploadPrivate(`downloads/${entityId}-${randomUUID()}.${parsed.ext}`, parsed)
}
