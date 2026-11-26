import { createClient } from '@supabase/supabase-js'
import { isSupabaseAuthConfigured } from './supabaseAuth.js'
import { getSupabaseAdmin } from './supabaseClient.js'

export const RECOVERY_PUBLIC_MESSAGE =
  'Se este correio tiver uma conta com senha, enviaremos as instruções para redefinir o selo. O link expira conforme a política de segurança.'

function appOrigin() {
  const explicit = process.env.PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const cors = process.env.CORS_ORIGIN?.split(',')[0]?.trim()
  return (cors || 'http://localhost:5173').replace(/\/$/, '')
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
  if (!isSupabaseAuthConfigured()) return
  const url = process.env.SUPABASE_URL!.trim()
  const anon = process.env.SUPABASE_ANON_KEY!.trim()
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const redirectTo = `${appOrigin()}/auth/recover`
  const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo })
  if (error) {
    console.warn('[auth] resetPasswordForEmail recusado pelo provedor:', error.message)
  }
}

/**
 * Conclui a redefinição validando o token de recuperação emitido pelo Supabase Auth.
 * Sobrevive a reinícios do servidor e múltiplas instâncias (sem Map local).
 */
export async function confirmPasswordRecovery(
  tokenOrHash: string,
  password: string,
  options?: { type?: 'token' | 'token_hash' },
) {
  if (!isSupabaseAuthConfigured()) {
    return {
      ok: false as const,
      message: 'A troca de selo exige Supabase Auth configurado neste servidor.',
    }
  }
  const url = process.env.SUPABASE_URL!.trim()
  const anon = process.env.SUPABASE_ANON_KEY!.trim()
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })

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

  // Valida access token da sessão de recuperação emitida pelo Supabase Auth
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
