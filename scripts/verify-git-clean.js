#!/usr/bin/env node
/**
 * Falha se arquivos sensíveis ou dados locais estiverem staged/tracked.
 * Uso: npm run verify:git
 */
const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')

function tracked(pattern) {
  try {
  return execSync(`git ls-files ${pattern}`, { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const forbidden = ['.env', '.env.local', '.env.production']
for (const name of forbidden) {
  if (tracked(name)) {
    console.error(`[verify:git] ${name} está no índice do Git — remova com git rm --cached.`)
    process.exit(1)
  }
}

const all = execSync('git ls-files', { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const secretPattern = /\bsb_secret_[A-Za-z0-9_-]{10,}\b/
const jwtPattern = /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\./

for (const rel of all) {
  if (rel === '.env.example' || rel.startsWith('docs/') || rel.startsWith('test/')) continue
  const abs = path.join(root, rel)
  if (!fs.existsSync(abs) || fs.statSync(abs).size > 512_000) continue
  const text = fs.readFileSync(abs, 'utf8')
  if (secretPattern.test(text)) {
    console.error(`[verify:git] Possível service role em ${rel}`)
    process.exit(1)
  }
  if (jwtPattern.test(text) && !rel.endsWith('.example')) {
    console.error(`[verify:git] Possível JWT real em ${rel} (use placeholders no .env.example).`)
    process.exit(1)
  }
}

const dataTracked = all.filter((f) => f.startsWith('backend/data/'))
if (dataTracked.length) {
  console.error('[verify:git] backend/data/ não deve ir para o Git:', dataTracked.join(', '))
  process.exit(1)
}

console.log('[verify:git] OK — sem .env rastreado nem padrões óbvios de segredo.')