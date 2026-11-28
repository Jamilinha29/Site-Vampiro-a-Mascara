import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
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

const CARD_CLASS =
  'w-full max-w-[36rem] shrink-0 rounded-xl border border-outline-variant/45 bg-surface-container-low/95 px-6 py-7 shadow-[0_20px_50px_-14px_rgba(0,0,0,0.85)] backdrop-blur-md sm:px-10 sm:py-9'
const LABEL_CLASS = 'block font-serif text-sm font-semibold text-on-surface'
const INPUT_CLASS =
  'mt-2 h-12 w-full rounded-md border border-outline-variant/55 bg-surface-container-lowest px-3.5 text-sm text-on-surface placeholder:text-outline/55 transition focus:border-secondary/80 focus:ring-1 focus:ring-secondary/40 focus:outline-none'
const SUBMIT_BUTTON_CLASS =
  'mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-md border border-inverse-primary/35 bg-[#761a29] px-4 py-3 text-xs font-bold tracking-[0.08em] text-white uppercase shadow-md shadow-black/40 transition hover:bg-primary-container active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 sm:text-[0.9rem]'

function PadlockIcon() {
  return (
    <svg
      className="h-7 w-7 text-inverse-primary/90"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="10.5" width="16" height="10.5" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <circle cx="12" cy="15" r="1" />
      <path d="M12 16v1.75" />
    </svg>
  )
}

function RecoveryCardShell({
  title,
  subtitle,
  footerNote,
  onSubmit,
  children,
}: {
  title: string
  subtitle: string
  footerNote: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  children: ReactNode
}) {
  return (
    <form className={CARD_CLASS} onSubmit={onSubmit}>
      <div className="pl-4">
        <div className="mb-3">
          <PadlockIcon />
        </div>
        <div className="relative">
          <span
            className="absolute -left-4 top-0.5 bottom-0.5 w-1 rounded-full bg-inverse-primary/90"
            aria-hidden="true"
          />
          <h1 className="font-serif text-[1.65rem] leading-tight font-bold tracking-tight text-on-surface sm:text-[2rem]">
            {title}
          </h1>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-secondary/90 sm:text-[0.95rem]">
          {subtitle}
        </p>
      </div>

      <div className="mt-7">{children}</div>

      <div className="mt-5 text-center">
        <Link
          to="/auth/login"
          className="text-sm text-secondary/90 underline decoration-secondary/55 underline-offset-4 transition hover:text-secondary hover:decoration-secondary"
        >
          Voltar para o login
        </Link>
      </div>

      <div className="mt-6 border-t border-outline-variant/35 pt-5 text-center">
        <p className="text-xs leading-relaxed text-on-surface-variant/75">{footerNote}</p>
      </div>
    </form>
  )
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  toggleLabel,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  show: boolean
  onToggleShow: () => void
  toggleLabel: string
}) {
  return (
    <div>
      <label className={LABEL_CLASS} htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          minLength={8}
          autoComplete="new-password"
          className={`${INPUT_CLASS} pr-11`}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 text-outline transition hover:text-on-surface"
          onClick={onToggleShow}
          aria-label={toggleLabel}
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    </div>
  )
}

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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [sent, setSent] = useState(false)
  const [done, setDone] = useState(false)

  const token = exchangedToken || parsedUrl.token
  const tokenHash = parsedUrl.tokenHash
  const code = parsedUrl.code
  const urlError = exchangeError || parsedUrl.urlError

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
    onError: (err: Error) => push(err.message || 'Não foi possível enviar o link de recuperação.', 'error'),
  })

  const confirm = useMutation({
    mutationFn: async () => {
      if (password !== confirmPassword) {
        throw new Error('As duas senhas não conferem.')
      }
      if (hasSupabaseRecoverySession) {
        const sb = getSupabaseBrowser()
        if (sb) {
          const { error } = await sb.auth.updateUser({ password })
          if (error) {
            throw new Error(error.message || 'Não foi possível salvar a nova senha.')
          }
          await sb.auth.signOut().catch(() => {})
          return { message: 'Nova senha salva. Entre com ela no login.' }
        }
      }
      return api.confirmPasswordRecovery(token || tokenHash, password, Boolean(tokenHash && !token))
    },
    onSuccess: (res) => {
      setDone(true)
      push(res.message, 'success')
    },
    onError: (err: Error) => push(err.message || 'Não foi possível salvar a nova senha.', 'error'),
  })

  return (
    <ViewportPageShell>
      {hasResetMode ? (
        <RecoveryCardShell
          title="Redefinir senha"
          subtitle="Escolha uma nova senha com pelo menos 8 caracteres para acessar sua conta."
          footerNote="Após salvar, utilize sua nova senha para entrar na crônica."
          onSubmit={(event) => {
            event.preventDefault()
            if (!done) confirm.mutate()
          }}
        >
          <div className="space-y-4">
            <PasswordField
              id="password"
              label="Nova senha"
              value={password}
              onChange={setPassword}
              show={showPassword}
              onToggleShow={() => setShowPassword((prev) => !prev)}
              toggleLabel="Revelar nova senha"
            />
            <PasswordField
              id="confirmPassword"
              label="Confirmar nova senha"
              value={confirmPassword}
              onChange={setConfirmPassword}
              show={showConfirmPassword}
              onToggleShow={() => setShowConfirmPassword((prev) => !prev)}
              toggleLabel="Revelar confirmação de senha"
            />
          </div>
          {done ? (
            <p
              role="status"
              className="mt-4 rounded-md border border-secondary/30 bg-secondary/10 px-3.5 py-2.5 text-center text-xs leading-relaxed text-secondary"
            >
              Senha atualizada com sucesso. Você já pode entrar com sua nova senha.
            </p>
          ) : null}
          <button type="submit" className={SUBMIT_BUTTON_CLASS} disabled={confirm.isPending || done}>
            {done ? 'Senha atualizada' : confirm.isPending ? 'Salvando…' : 'Salvar nova senha'}
          </button>
        </RecoveryCardShell>
      ) : (
        <RecoveryCardShell
          title="Recuperação de senha"
          subtitle="Informe seu e-mail para receber o link de redefinição de senha."
          footerNote="Se não encontrar o e-mail, verifique sua caixa de spam."
          onSubmit={(event) => {
            event.preventDefault()
            if (!sent) request.mutate()
          }}
        >
          {urlError ? (
            <p
              role="alert"
              className="mb-4 rounded-md border border-red-900/60 bg-red-950/35 px-3.5 py-2.5 text-xs leading-relaxed text-red-200"
            >
              Este link expirou ou é inválido. Solicite um novo envio abaixo.
            </p>
          ) : null}
          <label className={LABEL_CLASS} htmlFor="email">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={INPUT_CLASS}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {sent ? (
            <p
              role="status"
              className="mt-4 rounded-md border border-secondary/30 bg-secondary/10 px-3.5 py-2.5 text-center text-xs leading-relaxed text-secondary"
            >
              Se este e-mail estiver cadastrado, enviaremos as instruções de redefinição em instantes.
            </p>
          ) : null}
          <button type="submit" className={SUBMIT_BUTTON_CLASS} disabled={request.isPending || sent}>
            {sent ? 'Link enviado' : request.isPending ? 'Enviando…' : 'Enviar link'}
          </button>
        </RecoveryCardShell>
      )}
    </ViewportPageShell>
  )
}
