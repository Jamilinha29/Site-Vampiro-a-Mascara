export const PROFILE_IMAGE_MAX_BYTES = 900_000
export const PROFILE_IMAGE_INPUT_MAX_BYTES = 20 * 1024 * 1024
export const DOWNLOAD_PDF_MAX_BYTES = 2 * 1024 * 1024

export type ProfileImagePreset = 'avatar' | 'banner' | 'default'

const PRESET_BOUNDS: Record<ProfileImagePreset, { maxWidth: number; maxHeight: number }> = {
  avatar: { maxWidth: 512, maxHeight: 512 },
  banner: { maxWidth: 1600, maxHeight: 900 },
  default: { maxWidth: 1280, maxHeight: 1280 },
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

function dataUrlByteSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',')
  if (comma < 0) return dataUrl.length
  const b64 = dataUrl.slice(comma + 1)
  return Math.floor((b64.length * 3) / 4)
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Não foi possível processar a imagem.'))
    }
    img.src = objectUrl
  })
}

function encodeCanvas(canvas: HTMLCanvasElement, mime: 'image/webp' | 'image/jpeg', quality: number): string {
  const out = canvas.toDataURL(mime, quality)
  if (out.startsWith(`data:${mime}`)) return out
  return canvas.toDataURL('image/jpeg', quality)
}

async function adaptRasterImage(file: File, preset: ProfileImagePreset): Promise<string> {
  const img = await loadImageElement(file)
  const srcW = img.naturalWidth || img.width
  const srcH = img.naturalHeight || img.height
  if (!srcW || !srcH) {
    throw new Error('Dimensões inválidas da imagem.')
  }

  const bounds = PRESET_BOUNDS[preset]
  let scale = Math.min(1, bounds.maxWidth / srcW, bounds.maxHeight / srcH)
  const needsResize = scale < 1
  const needsCompress = file.size > PROFILE_IMAGE_MAX_BYTES

  if (!needsResize && !needsCompress && (file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp')) {
    return readFileAsDataUrl(file)
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Não foi possível preparar a imagem para envio.')
  }

  const qualities = [0.86, 0.76, 0.65, 0.52]
  for (let pass = 0; pass < 4; pass++) {
    const targetW = Math.max(1, Math.round(srcW * scale))
    const targetH = Math.max(1, Math.round(srcH * scale))
    canvas.width = targetW
    canvas.height = targetH
    ctx.clearRect(0, 0, targetW, targetH)
    ctx.drawImage(img, 0, 0, targetW, targetH)

    for (const q of qualities) {
      const candidate = encodeCanvas(canvas, 'image/webp', q)
      if (candidate.startsWith('data:image/') && dataUrlByteSize(candidate) <= PROFILE_IMAGE_MAX_BYTES) {
        return candidate
      }
    }
    scale *= 0.75
  }

  throw new Error('Imagem muito grande mesmo após compressão — máx. ~900 KB.')
}

export async function readProfileImageFile(
  file: File,
  options?: { preset?: ProfileImagePreset },
): Promise<string> {
  if (file.size > PROFILE_IMAGE_INPUT_MAX_BYTES) {
    throw new Error('Arquivo muito grande — máx. 20 MB.')
  }

  const isResizableRaster =
    file.type.startsWith('image/') && file.type !== 'image/gif' && file.type !== 'image/svg+xml'

  if (!isResizableRaster) {
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      throw new Error('Arquivo muito grande — máx. ~900 KB.')
    }
    return readFileAsDataUrl(file)
  }

  const preset = options?.preset ?? 'default'
  try {
    return await adaptRasterImage(file, preset)
  } catch (err) {
    if (file.size <= PROFILE_IMAGE_MAX_BYTES) {
      return readFileAsDataUrl(file)
    }
    throw err instanceof Error ? err : new Error('Imagem muito grande — máx. ~900 KB.')
  }
}

export async function readDownloadFile(file: File): Promise<string> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (isPdf) {
    if (file.size > DOWNLOAD_PDF_MAX_BYTES) {
      throw new Error('PDF muito grande — máx. 2 MB.')
    }
    return readFileAsDataUrl(file)
  }
  if (file.type.startsWith('image/')) {
    return readProfileImageFile(file)
  }
  throw new Error('Formato não suportado. Envie um arquivo PDF ou imagem PNG, JPG, WebP ou GIF.')
}
