import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '../../data')

export function readJsonFile<T>(filename: string): T | null {
  const path = join(dataDir, filename)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch (error) {
    console.warn(`[local] Falha ao ler ${filename}:`, error instanceof Error ? error.message : error)
    return null
  }
}

export function writeJsonFile(filename: string, value: unknown) {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(join(dataDir, filename), JSON.stringify(value), 'utf8')
}
