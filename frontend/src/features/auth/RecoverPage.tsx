import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ViewportPageShell } from '../../components/layout/ViewportPageShell'
import { useToast } from '../../components/ui/useToast'
import { getSupabaseBrowser } from '../../lib/supabaseBrowser'
import { api } from '../../services/api'

function extractRecoveryTokenFromUrl(params: URLSearchParams) {
  const queryToken = params.get('token') ?? ''
  const tokenHash = params.get('token_hash') ?? ''
  const code = params.get('code') ?? ''
  if (typeof window === 'undefined') {
    return { token: queryToken, tokenHash, code, urlError: '' }
  }
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const hashToken = hashParams.get('access_token') ?? ''
  const urlError =
    hashParams.get('error_description') ??
    params.get('error_description') ??
    ''
  return {
    token: queryToken || hashToken,
    tokenHash,
    code,
    urlError,
  }
}

const recoveryExchangeCache = new Map<string, Promise<{ accessToken: string | null; error: string | null }>>()

export default function RecoverPage() {
  const [params] = useSearchParams()
  const { push } = useToast()
  const parsedUrl = extractRecoveryTokenFromUrl(params)
  const [exchangedToken, setExchangedToken] = useState('')
  const [exchangeError, setExchangeError] = useState('')
  const [hasSupabaseRecoverySession, setHasSupabaseRecoverySession] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [done, setDone] = useState(false)
  const [statusNote, setStatusNote] = useState<string | null>(null)

  const token = exchangedToken || parsedUrl.token
  const tokenHash = parsedUrl.tokenHash
  const code = parsedUrl.code
  const urlError = exchangeError || parsedUrl.urlError

  useEffect(() => {
    void api
      .getRecoveryStatus()
      .then((info) => {
        if (info?.note) setStatusNote(info.note)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const sb = getSupabaseBrowser()
    if (!sb) return
    let active = true

    const { data: authSub } = sb.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'PASSWORD_RECOVERY' && session?.access_token) {
        setHasSupabaseRecoverySession(true)
        setExchangedToken(session.access_token)
      }
    })

    if (code) {
      let pending = recoveryExchangeCache.get(code)
      if (!pending) {
        pending = sb.auth.exchangeCodeForSession(code).then(({ data, error }) => ({
          accessToken: data.session?.access_token ?? null,
          error: error?.message ?? null,
        }))
        recoveryExchangeCache.set(code, pending)
      }
      void pending.then(({ accessToken, error }) => {
        if (!active) return
        if (error) {
          setExchangeError(error)
          return
        }
        if (accessToken) {
          setHasSupabaseRecoverySession(true)
          setExchangedToken(accessToken)
        }
      })
    }

    return () => {
      active = false
      authSub.subscription.unsubscribe()
    }
  }, [code])

  const hasResetMode = Boolean(token || tokenHash || hasSupabaseRecoverySession)

  const request = useMutation({
    mutationFn: () => api.requestPasswordRecovery(email.trim()),
    onSuccess: (res) => {
      setSent(true)
      push(res.message, 'info')
    },
    onError: (err: Error) => push(err.message || 'O corvo não saiu.', 'error'),
  })

  const confirm = useMutation({
    mutationFn: async () => {
      if (password !== confirmPassword) {
        throw new Error('Os dois selos não conferem.')
      }
      if (hasSupabaseRecoverySession) {
        const sb = getSupabaseBrowser()
        if (sb) {
          const { error } = await sb.auth.updateUser({ password })
          if (error) {
            throw new Error(error.message || 'Não foi possível gravar o selo novo.')
          }
          await sb.auth.signOut().catch(() => {})
          return { message: 'Selo novo gravado. Entre com ele.' }
        }
      }
      return api.confirmPasswordRecovery(token || tokenHash, password, Boolean(tokenHash && !token))
    },
    onSuccess: (res) => {
      setDone(true)
      push(res.message, 'success')
    },
    onError: (err: Error) => push(err.message || 'Não foi possível gravar o selo novo.', 'error'),
  })

  return (
    <ViewportPageShell>
      {hasResetMode ? (
        <form
          className="card-surface w-full max-w-xl shrink-0 p-6 sm:p-8"
          onSubmit={(event) => {
            event.preventDefault()
            if (!done) confirm.mutate()
          }}
        >
          <h1 className="font-headline-md text-xl text-secondary sm:text-2xl">Selo novo</h1>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            Escolha um selo de pelo menos 8 caracteres. Depois entre com ele na porta.
          </p>
          <label className="mt-4 block text-xs font-semibold uppercase" htmlFor="password">
            Selo novo
          </label>
          <input
            id="password"
            type="password"
            minLength={8}
            className="input-feudal mt-1.5 py-2.5 pl-4 text-sm"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <label className="mt-4 block text-xs font-semibold uppercase" htmlFor="confirmPassword">
            Confirmar selo novo
          </label>
          <input
            id="confirmPassword"
            type="password"
            minLength={8}
            className="input-feudal mt-1.5 py-2.5 pl-4 text-sm"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          <button type="submit" className="btn-primary mt-5 w-full py-3 text-sm" disabled={confirm.isPending || done}>
            {done ? 'Selo gravado' : confirm.isPending ? 'Gravando…' : 'Gravar selo'}
          </button>
          <Link to="/auth/login" className="mt-4 block text-center text-sm text-secondary hover:underline">
            Ir para a porta
          </Link>
        </form>
      ) : (
        <form
          className="card-surface w-full max-w-xl shrink-0 p-6 sm:p-8"
          onSubmit={(event) => {
            event.preventDefault()
            if (!sent) request.mutate()
          }}
        >
          <h1 className="font-headline-md text-xl text-secondary sm:text-2xl">Recuperar Selo</h1>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            Informe o correio feudal. Enviaremos instruções se a conta existir, sem revelar se o correio está cadastrado.
          </p>
          {urlError ? (
            <p className="mt-3 rounded border border-red-900/60 bg-red-950/30 p-2.5 text-xs text-red-200">
              Este link expirou ou é inválido. Solicite um novo envio abaixo.
            </p>
          ) : null}
          {statusNote ? (
            <p className="mt-2.5 text-xs text-on-surface-variant">{statusNote}</p>
          ) : null}
          <label className="mt-4 block text-xs font-semibold uppercase" htmlFor="email">
            Correio feudal
          </label>
          <input
            id="email"
            type="email"
            className="input-feudal mt-1.5 py-2.5 pl-4 text-sm"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className="btn-primary mt-5 w-full py-3 text-sm" disabled={request.isPending || sent}>
            {sent ? 'Corvo enviado' : request.isPending ? 'Enviando…' : 'Enviar corvo'}
          </button>
          <Link to="/auth/login" className="mt-4 block text-center text-sm text-secondary hover:underline">
            Voltar
          </Link>
        </form>
      )}
    </ViewportPageShell>
  )
}
