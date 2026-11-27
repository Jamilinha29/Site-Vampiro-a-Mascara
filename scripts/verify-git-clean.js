#!/usr/bin/env node
/**
 * Falha se arquivos sensíveis, backups ou segredos estiverem staged/tracked (ou no bundle compilado).
 * Uso: npm run verify:git | npm run verify:bundle
 */
const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const checkDistRequired = process.argv.includes('--check-dist')

function tracked(pattern) {
  try {
    return execSync(`git ls-files ${pattern}`, { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const forbidden = ['.env', '.env.local', '.env.production', '.env.staging', 'beladona-backup.json']
for (const name of forbidden) {
  if (tracked(name)) {
    console.error(`[verify:git] ${name} está no índice do Git — remova com git rm --cached.`)
    process.exit(1)
  }
}

const all = execSync('git ls-files', { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)

const secretPatterns = [
  { name: 'Supabase service/secret key', regex: /\bsb_secret_(?!test|exemplo|fake|dummy|placeholder)[A-Za-z0-9_-]{10,}\b/ },
  { name: 'Resend API key', regex: /\bre_(?!test|exemplo|fake|dummy|placeholder)[A-Za-z0-9_]{16,}\b/ },
  { name: 'Private key PEM', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Real JWT token', regex: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/ },
]

function containsServiceRoleJwt(content) {
  const matches = content.match(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g) ?? []
  for (const token of matches) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
      if (payload?.role === 'service_role') return true
    } catch {
      // ignora strings que não são JWT JSON válidos
    }
  }
  return false
}

for (const rel of all) {
  if (/\.(sql\.gz|dump|enc|pem|key|p12|pfx)$/i.test(rel) || /(^|\/)(backup|dump)[^/]*\.sql$/i.test(rel)) {
    console.error(`[verify:git] Arquivo sensível ou dump de banco rastreado: ${rel}`)
    process.exit(1)
  }
  if (rel === '.env.example') continue
  const abs = path.join(root, rel)
  if (!fs.existsSync(abs) || fs.statSync(abs).size > 512_000) continue
  const text = fs.readFileSync(abs, 'utf8')
  for (const pattern of secretPatterns) {
    if (pattern.regex.test(text)) {
      console.error(`[verify:git] ${pattern.name} encontrado em ${rel}`)
      process.exit(1)
    }
  }
}

const dataTracked = all.filter((f) => f.startsWith('backend/data/') || f.startsWith('backups/'))
if (dataTracked.length) {
  console.error('[verify:git] Dados/backups locais não devem ir para o Git:', dataTracked.join(', '))
  process.exit(1)
}

const distDir = path.join(root, 'frontend', 'dist')
if (checkDistRequired && !fs.existsSync(distDir)) {
  console.error('[verify:git] --check-dist solicitado, mas frontend/dist não existe. Execute o build primeiro.')
  process.exit(1)
}
if (fs.existsSync(distDir)) {
  const stack = [distDir]
  while (stack.length) {
    const cur = stack.pop()
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      if (!/\.(js|css|html)$/i.test(entry.name)) continue
      const content = fs.readFileSync(full, 'utf8')
      if (
        /\bsb_secret_[A-Za-z0-9_-]{10,}\b/.test(content) ||
        /\bre_[A-Za-z0-9_]{16,}\b/.test(content) ||
        /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content) ||
        containsServiceRoleJwt(content)
      ) {
        console.error(`[verify:git] Segredo de servidor vazou no bundle público: ${path.relative(root, full)}`)
        process.exit(1)
      }
    }
  }
}

console.log('[verify:git] OK — sem .env, dumps ou segredos no Git nem no bundle.')
