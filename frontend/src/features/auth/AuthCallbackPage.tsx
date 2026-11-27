import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getSupabaseBrowser } from '../../lib/supabaseBrowser'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'

const pkceExchangeCache = new Map<string, Promise<{ error: Error | null }>>()

export function AuthCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function finalize() {
      const sb = getSupabaseBrowser()
      if (!sb) {
        if (active) setError('Autenticação Supabase não configurada neste navegador.')
        return
      }

      const type = params.get('type')
      const code = params.get('code')
      const flow = params.get('flow') === 'adm' ? 'adm' : 'player'

      // Redireciona recuperação antes de consumir o código PKCE de uso único
      if (type === 'recovery') {
        const hash = window.location.hash || ''
        navigate(`/auth/recover${window.location.search}${hash}`, { replace: true })
        return
      }

      try {
        if (code) {
          let pending = pkceExchangeCache.get(code)
          if (!pending) {
            pending = sb.auth.exchangeCodeForSession(code).then(({ error: exErr }) => ({ error: exErr }))
            pkceExchangeCache.set(code, pending)
          }
          const { error: exErr } = await pending
          if (exErr) throw exErr
        }

        const { data, error: sessErr } = await sb.auth.getSession()
        if (sessErr) throw sessErr
        const session = data.session

        if (!session?.access_token || !session.user?.email) {
          throw new Error('Não foi possível validar o retorno da autenticação.')
        }

        const displayName =
          String(
            session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email.split('@')[0] ||
              'Viajante',
          )

        setSession(
          {
            accessToken: session.access_token,
            refreshToken: session.refresh_token ?? undefined,
            expiresAt: session.expires_at ?? undefined,
            userId: session.user.id,
            email: session.user.email,
            displayName,
            role: 'player',
          },
          true,
        )

        const profile = await api.meProfile()
        const resolvedRole = (profile.role === 'admin' || profile.role === 'narrator'
          ? profile.role
          : 'player') as 'player' | 'narrator' | 'admin'

        setSession(
          {
            accessToken: session.access_token,
            refreshToken: session.refresh_token ?? undefined,
            expiresAt: session.expires_at ?? undefined,
            userId: session.user.id,
            email: profile.email,
            displayName: profile.displayName || displayName,
            role: resolvedRole,
          },
          true,
        )

        if (flow === 'adm') {
          if (resolvedRole !== 'admin' && resolvedRole !== 'narrator') {
            useAuthStore.getState().logout()
            if (active) {
              setError('Esta conta Google não tem permissão de narrador ou administrador no portal ADM.')
            }
            return
          }
          navigate('/admin', { replace: true })
          return
        }

        navigate('/user', { replace: true })
      } catch (err) {
        useAuthStore.getState().clearSession()
        if (active) {
          setError(err instanceof Error ? err.message : 'Falha ao concluir autenticação com o provedor.')
        }
      }
    }

    void finalize()
    return () => {
      active = false
    }
  }, [navigate, params, setSession])

  return (
    <main className="min-h-screen bg-[#0c0a0d] text-[#f3eadc] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-[#3a2830] bg-[#161116] p-8 text-center space-y-4">
        <p className="text-xs uppercase tracking-[0.25em] text-[#c89b54]">Crônicas de Beladona</p>
        <h1 className="text-xl font-semibold">
          {error ? 'Não foi possível abrir o portal' : 'Validando seu selo…'}
        </h1>
        {error ? (
          <>
            <p className="text-sm text-[#e09f9f]">{error}</p>
            <div className="pt-2">
              <Link
                to="/auth/login"
                className="inline-flex items-center justify-center rounded-lg border border-[#c89b54]/60 px-4 py-2 text-sm text-[#f3eadc] hover:bg-[#c89b54]/15"
              >
                Voltar ao login
              </Link>
            </div>
          </>
        ) : (
          <p className="text-sm text-[#b9a79d]">Conectando sua sessão ao acervo da crônica.</p>
        )}
      </div>
    </main>
  )
}
