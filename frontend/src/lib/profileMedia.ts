export const PROFILE_IMAGE_MAX_BYTES = 900_000

export function readProfileImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > PROFILE_IMAGE_MAX_BYTES) {
      reject(new Error('Imagem muito grande (máx. ~900 KB).'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}
