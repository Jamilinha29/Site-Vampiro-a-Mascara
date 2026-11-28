import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getSupabaseBrowser } from '../../lib/supabaseBrowser'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import { AuthAmbient, AuthHeader } from './AuthChrome'

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
    <div className="auth-portal-shell relative flex w-full min-w-0 flex-col overflow-hidden bg-surface-container-lowest text-on-surface">
      <AuthAmbient />
      <AuthHeader />
      <main className="safe-pb relative z-10 flex min-h-0 w-full flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 rounded-xl border border-outline-variant bg-surface-container-low/95 p-8 text-center shadow-2xl backdrop-blur-md">
          <p className="font-label-sm text-xs tracking-[0.25em] text-secondary uppercase">Crônicas de Beladona</p>
          <h1 className="font-serif text-xl font-semibold text-on-surface">
            {error ? 'Não foi possível abrir o portal' : 'Validando seu selo…'}
          </h1>
          {error ? (
            <>
              <p className="text-sm text-primary">{error}</p>
              <div className="pt-2">
                <Link to="/auth/login" className="btn-secondary inline-flex px-4 py-2 text-sm">
                  Voltar ao login
                </Link>
              </div>
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">Conectando sua sessão ao acervo da crônica.</p>
          )}
        </div>
      </main>
    </div>
  )
}
