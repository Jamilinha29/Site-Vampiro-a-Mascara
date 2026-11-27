import { getSupabaseAnonClient, isSupabaseAuthConfigured } from './supabaseAuth.js'
import { getSupabaseAdmin } from './supabaseClient.js'

export const RECOVERY_PUBLIC_MESSAGE =
  'Se este correio tiver uma conta com senha, enviaremos as instruções para redefinir o selo. O link expira conforme a política de segurança.'

function appOrigin() {
  const explicit = process.env.PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const cors = process.env.CORS_ORIGIN?.split(',')[0]?.trim()
  return (cors || 'http://localhost:5173').replace(/\/$/, '')
}

/** Verifica se o JWT possui método de autenticação `recovery` em `amr` (impede uso de access_token comum). */
export function hasRecoveryAmrClaim(jwt: string): boolean {
  const parts = jwt.split('.')
  if (parts.length !== 3) return false
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      amr?: Array<string | { method?: string }>
    }
    if (!Array.isArray(payload.amr)) return false
    return payload.amr.some((entry) =>
      typeof entry === 'string' ? entry === 'recovery' : entry?.method === 'recovery',
    )
  } catch {
    return false
  }
}

export function getRecoveryCapabilities() {
  const supabaseAuthActive = isSupabaseAuthConfigured()
  const customSmtpVerified = process.env.SUPABASE_SMTP_VERIFIED === 'true'
  return {
    supabaseAuthActive,
    externalEmailDeliveryConfirmed: customSmtpVerified,
    note: customSmtpVerified
      ? 'Recuperação de senha ativa.'
      : 'Recuperação de senha disponível conforme configuração de envio do servidor.',
  }
}

/**
 * Solicita recuperação de senha diretamente ao Supabase Auth (sem tokens em memória).
 * Nunca revela se o e-mail existe ou registra tokens/links nos logs.
 */
export async function requestPasswordRecovery(email: string) {
  if (process.env.NODE_ENV === 'test') return
  const sb = getSupabaseAnonClient()
  if (!sb) return
  const redirectTo = `${appOrigin()}/auth/recover`
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo })
  if (error) {
    console.warn('[auth] resetPasswordForEmail recusado pelo provedor:', error.message)
  }
}

/**
 * Conclui a redefinição validando estritamente um token de recuperação emitido pelo Supabase Auth.
 * Sobrevive a reinícios do servidor e múltiplas instâncias (sem Map local).
 */
export async function confirmPasswordRecovery(
  tokenOrHash: string,
  password: string,
  options?: { type?: 'token' | 'token_hash' },
) {
  const sb = getSupabaseAnonClient()
  if (!sb || !isSupabaseAuthConfigured()) {
    return {
      ok: false as const,
      message: 'A troca de selo exige Supabase Auth configurado neste servidor.',
    }
  }

  if (options?.type === 'token_hash') {
    const { data, error } = await sb.auth.verifyOtp({
      token_hash: tokenOrHash,
      type: 'recovery',
    })
    if (error || !data.user?.id) {
      return { ok: false as const, message: 'Este caminho expirou ou já foi usado. Peça outro corvo.' }
    }
    const admin = getSupabaseAdmin()
    if (!admin) {
      return { ok: false as const, message: 'A troca de selo não está disponível neste servidor.' }
    }
    const { error: updateErr } = await admin.auth.admin.updateUserById(data.user.id, { password })
    if (updateErr) {
      return { ok: false as const, message: 'Não foi possível gravar o selo novo. Peça outro corvo.' }
    }
    return { ok: true as const }
  }

  // Aceita apenas JWT de sessão originada em fluxo de recuperação (amr inclui "recovery")
  if (!hasRecoveryAmrClaim(tokenOrHash)) {
    return { ok: false as const, message: 'Este caminho expirou ou já foi usado. Peça outro corvo.' }
  }
  const { data, error } = await sb.auth.getUser(tokenOrHash)
  if (error || !data.user?.id) {
    return { ok: false as const, message: 'Este caminho expirou ou já foi usado. Peça outro corvo.' }
  }
  const admin = getSupabaseAdmin()
  if (!admin) {
    return { ok: false as const, message: 'A troca de selo não está disponível neste servidor.' }
  }
  const { error: updateErr } = await admin.auth.admin.updateUserById(data.user.id, { password })
  if (updateErr) {
    return { ok: false as const, message: 'Não foi possível gravar o selo novo. Peça outro corvo.' }
  }
  return { ok: true as const }
}
