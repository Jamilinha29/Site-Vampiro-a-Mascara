import { createHash, randomBytes } from 'crypto'
import { getSupabaseAdmin } from './supabaseClient.js'
import { sendTransactionalEmail } from './resendClient.js'

const THIRTY_MINUTES = 30 * 60 * 1000

type ResetRecord = { userId: string; email: string; expiresAt: number }

const records = new Map<string, ResetRecord>()

export const RECOVERY_PUBLIC_MESSAGE =
  'Se este correio tiver uma conta, o corvo sai com o caminho para um selo novo. O caminho vale por 30 minutos.'

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function createRecoveryToken(userId: string, email: string, ttlMs = THIRTY_MINUTES) {
  const token = randomBytes(32).toString('base64url')
  records.set(hashToken(token), { userId, email: email.toLowerCase(), expiresAt: Date.now() + ttlMs })
  return token
}

export function peekRecoveryToken(token: string) {
  const row = records.get(hashToken(token))
  if (!row) return null
  if (row.expiresAt <= Date.now()) {
    records.delete(hashToken(token))
    return null
  }
  return row
}

export function dropRecoveryToken(token: string) {
  records.delete(hashToken(token))
}

function appOrigin() {
  const explicit = process.env.PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const cors = process.env.CORS_ORIGIN?.split(',')[0]?.trim()
  return (cors || 'http://localhost:5173').replace(/\/$/, '')
}

async function findAuthUser(email: string) {
  const sb = getSupabaseAdmin()
  if (!sb) return null
  const target = email.trim().toLowerCase()
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data.users.length) return null
    const found = data.users.find((user) => user.email?.toLowerCase() === target)
    if (found?.id && found.email) return { id: found.id, email: found.email }
    if (data.users.length < 200) return null
  }
  return null
}

export async function requestPasswordRecovery(email: string) {
  if (process.env.NODE_ENV === 'test') return
  const user = await findAuthUser(email)
  if (!user) return
  const token = createRecoveryToken(user.id, user.email)
  const link = `${appOrigin()}/auth/recover?token=${encodeURIComponent(token)}`
  const sent = await sendTransactionalEmail({
    to: user.email,
    subject: 'Novo selo da Beladona',
    html: `<p>Alguém pediu um selo novo para esta conta.</p><p><a href="${link}">Escolher o selo novo</a></p><p>O caminho expira em 30 minutos. Se não foi você, ignore este corvo.</p>`,
  })
  if (!sent.ok) {
    dropRecoveryToken(token)
    console.warn('[auth] Recuperação não enviada. Confira RESEND_API_KEY e RESEND_FROM. Motivo:', sent.reason)
  }
}

export async function confirmPasswordRecovery(token: string, password: string) {
  const row = peekRecoveryToken(token)
  if (!row) return { ok: false as const, message: 'Este caminho expirou ou já foi usado. Peça outro corvo.' }
  const sb = getSupabaseAdmin()
  if (!sb) return { ok: false as const, message: 'A troca de selo não está disponível neste servidor.' }
  const { error } = await sb.auth.admin.updateUserById(row.userId, { password })
  if (error) return { ok: false as const, message: 'Não foi possível gravar o selo novo. Peça outro corvo.' }
  dropRecoveryToken(token)
  return { ok: true as const }
}
