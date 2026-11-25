import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isSharedDeploymentEnvironment } from './supabaseClient.js'

const defaultDataDir = join(dirname(fileURLToPath(import.meta.url)), '../../data')

export function resolveLocalDataDir() {
  const configured = process.env.BELADONA_DATA_DIR?.trim()
  if (configured) return configured
  return defaultDataDir
}

export function isLocalDiskPersistenceEnabled() {
  if (isSharedDeploymentEnvironment()) return false
  if (process.env.NODE_ENV === 'test' && !process.env.BELADONA_DATA_DIR?.trim()) return false
  return true
}

export function readJsonFile<T>(filename: string): T | null {
  if (!isLocalDiskPersistenceEnabled()) return null
  const filePath = join(resolveLocalDataDir(), filename)
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T
  } catch (error) {
    console.warn(`[local] Falha ao ler ${filename}:`, error instanceof Error ? error.message : error)
    return null
  }
}

/** Escrita atômica via arquivo temporário + rename no mesmo diretório. */
export function writeJsonFile(filename: string, value: unknown) {
  if (!isLocalDiskPersistenceEnabled()) return
  const dir = resolveLocalDataDir()
  mkdirSync(dir, { recursive: true })
  const target = join(dir, filename)
  const tmp = join(dir, `${filename}.${process.pid}.${randomUUID()}.tmp`)
  try {
    writeFileSync(tmp, JSON.stringify(value), 'utf8')
    renameSync(tmp, target)
  } catch (error) {
    try {
      if (existsSync(tmp)) rmSync(tmp, { force: true })
    } catch {
      /* ignore cleanup */
    }
    throw error
  }
}
