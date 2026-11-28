import { useId, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useAuthStore, type AuthSession } from '../../stores/authStore'
import { getSupabaseBrowser } from '../../lib/supabaseBrowser'
import { useToast } from '../../components/ui/useToast'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { AuthAmbient, AuthHeader } from './AuthChrome'

function sessionFromLogin(data: {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  userId: string
  email: string
  displayName: string
  role: string
}): AuthSession {
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: data.expiresAt,
    userId: data.userId,
    email: data.email,
    displayName: data.displayName,
    role: data.role as AuthSession['role'],
  }
}

type Mode = 'login' | 'register'

type Props = {
  mode?: Mode
}

export default function AuthPortalPage({ mode: initialMode = 'login' }: Props) {
  const [overrideMode, setOverrideMode] = useState<{ base: Mode; mode: Mode } | null>(null)
  const mode = overrideMode && overrideMode.base === initialMode ? overrideMode.mode : initialMode
  const setMode = (next: Mode) => setOverrideMode({ base: initialMode, mode: next })
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const { push } = useToast()

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string; remember: boolean }) =>
      api.login(email, password),
    onSuccess: (data, vars) => {
      setSession(sessionFromLogin(data), vars.remember)
      push('Santuário aberto. Boa caçada.', 'success')
      const dest = data.role === 'narrator' || data.role === 'admin' ? '/admin' : '/user'
      navigate(dest)
    },
    onError: (err: Error) => push(err.message || 'Selo ou correio feudal recusados.', 'error'),
  })

  const adminLoginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.login(email, password),
    onSuccess: (data) => {
      const role = data.role as AuthSession['role']
      if (role !== 'narrator' && role !== 'admin') {
        push('Este correio não possui selo de narrador. Use narrador@… ou mestre@…', 'error')
        return
      }
      setSession(sessionFromLogin({ ...data, role }), true)
      push('Conclave aberto. Bem-vindo, mestre.', 'success')
      navigate('/admin')
    },
    onError: (err: Error) => push(err.message || 'Login do mestre recusado.', 'error'),
  })

  const registerMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.register(payload),
    onSuccess: (data) => {
      setSession(sessionFromLogin(data), true)
      push('Linhagem registrada. Boa caçada.', 'success')
      const dest = data.role === 'narrator' || data.role === 'admin' ? '/admin' : '/user'
      navigate(dest)
    },
    onError: (err: Error) => {
      const msg = err.message || 'Não foi possível forjar a linhagem.'
      if (/confirme o e-mail/i.test(msg)) {
        push(msg, 'info')
        setMode('login')
        return
      }
      push(msg, 'error')
    },
  })

  const sliderTransform = mode === 'login' ? 'translateX(0%)' : 'translateX(-100%)'

  return (
    <div className="auth-portal auth-portal-shell auth-portal-compact relative flex w-full min-w-0 flex-col overflow-hidden bg-surface-container-lowest text-on-surface selection:bg-primary-container selection:text-white">
      <AuthAmbient />
      <AuthHeader />
      <main className="auth-portal-main">
        <div className="auth-portal-fit">
        <div className="auth-portal-card relative shrink-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low/95 shadow-2xl backdrop-blur-md">
          <div className="grid w-full grid-cols-1 lg:grid-cols-2 lg:items-stretch">
            <LoginColumn
              mode={mode}
              setMode={setMode}
              onSubmit={(email, password, remember) => loginMutation.mutate({ email, password, remember })}
              loading={loginMutation.isPending}
              onAdminSubmit={(email, password) => adminLoginMutation.mutate({ email, password })}
              adminLoading={adminLoginMutation.isPending}
            />
            <RegisterColumn
              mode={mode}
              setMode={setMode}
              onSubmit={(payload) => registerMutation.mutate(payload)}
              loading={registerMutation.isPending}
            />
          </div>

          <div
            className="slide-panel-transition absolute inset-y-0 right-0 z-30 hidden w-1/2 flex-col items-center justify-between gap-4 overflow-hidden border-outline-variant/40 bg-surface-container p-6 shadow-2xl lg:flex lg:p-7"
            style={{ transform: sliderTransform, borderRight: mode === 'register' ? '1px solid rgba(89,65,65,0.4)' : undefined, borderLeft: mode === 'login' ? '1px solid rgba(89,65,65,0.4)' : undefined }}
          >
            <SliderPanel mode={mode} />
          </div>
        </div>
        </div>
      </main>
    </div>
  )
}

function TabSwitcher({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="auth-portal-tabs mb-4 flex justify-center">
      <div className="inline-flex w-full items-center gap-2 rounded-md border border-outline-variant/60 bg-surface-container-lowest/90 p-1.5 shadow-inner">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex flex-1 items-center justify-center gap-2 rounded px-4 py-2.5 text-center font-label-md text-xs tracking-wider uppercase transition sm:text-sm ${
            mode === 'login'
              ? 'border border-primary-container/70 bg-primary-container/20 font-bold text-primary shadow-sm'
              : 'border border-transparent font-semibold text-on-surface-variant hover:bg-surface-container/70 hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-lg">vpn_key</span>
          Entrar
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`flex flex-1 items-center justify-center gap-2 rounded px-4 py-2.5 text-center font-label-md text-xs tracking-wider uppercase transition sm:text-sm ${
            mode === 'register'
              ? 'border border-primary-container/70 bg-primary-container/20 font-bold text-primary shadow-sm'
              : 'border border-transparent font-semibold text-on-surface-variant hover:bg-surface-container/70 hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-lg">history_edu</span>
          Criar conta
        </button>
      </div>
    </div>
  )
}

function LoginColumn({
  mode,
  setMode,
  onSubmit,
  loading,
  onAdminSubmit,
  adminLoading,
}: {
  mode: Mode
  setMode: (m: Mode) => void
  onSubmit: (email: string, password: string, remember: boolean) => void
  loading: boolean
  onAdminSubmit: (email: string, password: string) => void
  adminLoading: boolean
}) {
  const emailId = useId()
  const passId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPass, setShowPass] = useState(false)
  const [adminMode, setAdminMode] = useState(false)

  if (mode !== 'login') return null

  return (
    <div className="auth-portal-column flex flex-col justify-center lg:col-start-1">
      <div>
        <TabSwitcher mode={mode} setMode={setMode} />
        {adminMode ? (
          <>
            <div className="auth-portal-heading mb-4 flex items-center justify-between gap-2 border-b border-outline-variant/40 pb-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="material-symbols-outlined shrink-0 text-2xl text-secondary">military_tech</span>
                <div className="min-w-0">
                  <h2 className="font-headline-sm text-lg font-bold tracking-wider text-secondary uppercase md:text-xl">
                    Login do mestre
                  </h2>
                  <p className="auth-portal-subtitle text-xs font-medium tracking-wide text-on-surface-variant">
                    Correio narrador@… ou mestre@…
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-secondary hover:underline"
                onClick={() => setAdminMode(false)}
              >
                Voltar
              </button>
            </div>
            <AdminMasterPanel onAdminSubmit={onAdminSubmit} adminLoading={adminLoading} bare />
          </>
        ) : (
          <>
            <div className="auth-portal-heading mb-4 flex items-center border-b border-outline-variant/40 pb-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="material-symbols-outlined shrink-0 text-2xl text-primary">vpn_key</span>
                <div className="min-w-0">
                  <h2 className="font-headline-sm text-xl font-semibold text-on-surface md:text-2xl">
                    Boas-vindas à sua crônica
                  </h2>
                  <p className="auth-portal-subtitle mt-0.5 text-sm text-on-surface-variant">
                    Entre para continuar a sua história.
                  </p>
                </div>
              </div>
            </div>
            <form
              className="auth-portal-form [&_.input-feudal]:py-2.5 [&_.input-feudal]:pl-11 [&_.input-feudal]:text-sm"
              onSubmit={(e) => {
                e.preventDefault()
                onSubmit(email, password, remember)
              }}
            >
              <Field label="E-mail de acesso" required hint="ex: valerius@corte-noturna.org" id={emailId}>
                <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-xl text-outline">shield_person</span>
                <input
                  id={emailId}
                  type="email"
                  className="input-feudal"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </Field>
              <Field label="Senha" required id={passId} action={<Link to="/auth/recover" className="text-xs text-secondary hover:underline sm:text-sm">Esqueci minha senha</Link>}>
                <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-xl text-outline">lock</span>
                <input
                  id={passId}
                  type={showPass ? 'text' : 'password'}
                  className="input-feudal pr-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="absolute right-3.5 text-outline hover:text-on-surface" onClick={() => setShowPass((s) => !s)} aria-label="Revelar senha">
                  <span className="material-symbols-outlined text-xl">{showPass ? 'visibility_off' : 'visibility'}</span>
                </button>
              </Field>
              <label className="flex cursor-pointer items-center gap-2.5 text-xs text-on-surface-variant sm:text-sm">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-outline-variant text-primary-container focus:ring-primary-container"
                />
                Lembrar sessão
              </label>
              <button type="submit" className="btn-primary w-full py-3 text-sm normal-case tracking-normal sm:text-base" disabled={loading}>
                <span className="material-symbols-outlined text-xl">meeting_room</span>
                {loading ? 'Abrindo…' : 'Entrar na crônica'}
              </button>
            </form>
            <AuthSocialExtras googleContext="login" compact onOpenAdmin={() => setAdminMode(true)} />
          </>
        )}
      </div>
    </div>
  )
}

function AuthSocialExtras({
  googleContext,
  allowAdmin = true,
  compact = false,
  onOpenAdmin,
}: {
  googleContext: 'login' | 'register'
  allowAdmin?: boolean
  compact?: boolean
  onOpenAdmin?: () => void
}) {
  return (
    <div className={`${compact ? 'mt-4 space-y-3' : 'mt-4 space-y-3'}`}>
      {!compact ? <AuthOuDivider /> : null}
      {allowAdmin ? (
        <div className="grid grid-cols-2 gap-3">
          <GoogleAuthButton context={googleContext} className="w-full" />
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded border border-outline-variant/60 bg-surface-container px-4 py-2.5 text-xs font-semibold tracking-wider text-on-surface-variant uppercase transition hover:border-secondary/50 hover:text-secondary sm:text-sm"
            onClick={onOpenAdmin}
          >
            <span className="material-symbols-outlined text-lg">admin_panel_settings</span>
            ADM
          </button>
        </div>
      ) : (
        <GoogleAuthButton context={googleContext} className="w-full" />
      )}
    </div>
  )
}

function AdminMasterPanel({
  onAdminSubmit,
  adminLoading,
  className = '',
  bare = false,
}: {
  onAdminSubmit: (email: string, password: string) => void
  adminLoading: boolean
  className?: string
  bare?: boolean
}) {
  const adminEmailId = useId()
  const adminPassId = useId()
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  return (
    <div className={bare ? `space-y-3 ${className}` : `space-y-2.5 rounded-lg border border-secondary/35 bg-secondary/5 p-3 sm:p-4 ${className}`}>
      {bare ? null : (
        <div className="flex items-center gap-2 border-b border-secondary/20 pb-2">
          <span className="material-symbols-outlined text-secondary">military_tech</span>
          <div>
            <p className="text-xs font-bold tracking-wider text-secondary uppercase">Login do mestre</p>
            <p className="text-[11px] text-on-surface-variant">Use correio narrador@… ou mestre@…</p>
          </div>
        </div>
      )}
      <form
        className="space-y-3 [&_.input-feudal]:py-2.5 [&_.input-feudal]:pl-11 [&_.input-feudal]:text-sm"
        onSubmit={(e) => {
          e.preventDefault()
          onAdminSubmit(adminEmail, adminPassword)
        }}
      >
        <Field label="Correio do conclave" required id={adminEmailId}>
          <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-xl text-outline">shield_person</span>
          <input
            id={adminEmailId}
            type="email"
            className="input-feudal"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
            autoComplete="username"
            placeholder="narrador@beladona.local"
          />
        </Field>
        <Field label="Selo secreto" required id={adminPassId}>
          <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-xl text-outline">lock</span>
          <input
            id={adminPassId}
            type="password"
            className="input-feudal"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="current-password"
          />
        </Field>
        <button type="submit" className="btn-primary w-full py-3 text-sm sm:text-base" disabled={adminLoading}>
          {adminLoading ? 'Validando…' : 'Entrar — Início do mestre'}
        </button>
      </form>
      <AuthOuDivider />
      <GoogleAuthButton context="admin" className="w-full" />
    </div>
  )
}

function AuthOuDivider() {
  return (
    <div className="relative flex items-center gap-3 pt-0.5">
      <span className="h-px flex-1 bg-outline-variant/50" aria-hidden />
      <span className="text-[10px] font-semibold tracking-widest text-on-surface-variant uppercase">ou</span>
      <span className="h-px flex-1 bg-outline-variant/50" aria-hidden />
    </div>
  )
}

function GoogleAuthButton({ context, className = '' }: { context: 'login' | 'register' | 'admin'; className?: string }) {
  const { push } = useToast()
  const [busy, setBusy] = useState(false)

  async function handleGoogle() {
    const sb = getSupabaseBrowser()
    if (!sb) {
      push('Entrada pelo Google não está configurada neste ambiente.', 'info')
      return
    }
    setBusy(true)
    try {
      const flow = context === 'admin' ? 'adm' : 'player'
      const redirectTo = `${window.location.origin}/auth/callback?flow=${flow}`
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) {
        push(error.message || 'Falha ao iniciar autenticação com Google.', 'error')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      className={`btn-secondary inline-flex items-center justify-center gap-2 py-2.5 text-xs sm:text-sm ${className}`}
      onClick={() => void handleGoogle()}
    >
      <GoogleIcon />
      {busy ? 'Conectando…' : 'Google'}
    </button>
  )
}

function RegisterColumn({
  mode,
  setMode,
  onSubmit,
  loading,
}: {
  mode: Mode
  setMode: (m: Mode) => void
  onSubmit: (payload: Record<string, unknown>) => void
  loading: boolean
}) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(true)
  const [marketing, setMarketing] = useState(false)

  if (mode !== 'register') return null

  return (
    <div className="auth-portal-column flex flex-col justify-center lg:col-start-2">
      <div>
        <TabSwitcher mode={mode} setMode={setMode} />
        <div className="auth-portal-heading mb-4 flex items-center border-b border-outline-variant/40 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="material-symbols-outlined shrink-0 text-2xl text-secondary">history_edu</span>
            <div className="min-w-0">
              <h2 className="font-headline-sm text-xl font-semibold text-on-surface md:text-2xl">
                Criar conta
              </h2>
              <p className="auth-portal-subtitle mt-0.5 text-sm text-on-surface-variant">
                Seu próximo capítulo começa aqui.
              </p>
            </div>
          </div>
        </div>
        <form
          className="auth-portal-form [&_.input-feudal]:py-2.5 [&_.input-feudal]:pl-11 [&_.input-feudal]:text-sm"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit({
              displayName,
              email,
              password,
              termsAccepted: terms,
              marketingOptIn: marketing,
            })
          }}
        >
          <Field label="Nome de exibição" required>
            <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-xl text-outline">assignment_ind</span>
            <input className="input-feudal" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="Preencha com seu nome" />
          </Field>
          <Field label="E-mail" required>
            <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-xl text-outline">mail</span>
            <input type="email" className="input-feudal" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Senha" required>
            <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-xl text-outline">lock</span>
            <input type="password" className="input-feudal" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Mínimo de 8 caracteres" />
          </Field>
          <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-on-surface-variant sm:text-[13px]">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required className="mt-0.5 h-4 w-4 rounded border-outline-variant text-primary-container" />
            Aceito as Tradições de Caim e os Estatutos de Beladona.
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-snug text-on-surface-variant sm:text-[13px]">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-outline-variant text-primary-container" />
            Desejo receber avisos da crônica por corvo mensageiro.
          </label>
          <button type="submit" className="btn-primary w-full py-3 text-sm normal-case tracking-normal sm:text-base" disabled={loading}>
            <span className="material-symbols-outlined text-xl">history_edu</span>
            {loading ? 'Criando…' : 'Criar conta'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  id,
  action,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  id?: string
  action?: React.ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase sm:text-[13px]">
          {label}
          {required ? <span className="text-primary">*</span> : null}
        </label>
        {hint ? <span className="text-xs text-secondary opacity-85">{hint}</span> : action}
      </div>
      <div className="relative flex items-center">{children}</div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function SliderPanel({ mode }: { mode: Mode }) {
  const quote =
    mode === 'login'
      ? '"Toda escolha deixa uma marca. Toda história guarda um segredo."'
      : '"Há histórias que só começam quando os caminhos se encontram."'

  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary-container/20 via-surface-container-high/90 to-surface-container-lowest" />
      <div className="relative z-10 flex w-full items-center justify-between border-b border-outline-variant/30 pb-3 text-xs tracking-widest uppercase">
        <span className="flex items-center gap-1.5 text-secondary">
          <span className="material-symbols-outlined text-base text-primary">token</span>
          Um universo compartilhado
        </span>
        <span className="text-outline">Beladona</span>
      </div>
      <div className="relative z-10 flex w-full flex-col items-center py-2">
        <Link
          to="/"
          className="relative flex aspect-square w-full max-w-[11rem] items-center justify-center rounded-full transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary xl:max-w-[12.5rem]"
          aria-label="Voltar à página inicial"
        >
          <div className="pointer-events-none absolute inset-0 animate-pulse rounded-full border border-dashed border-outline-variant/40" />
          <div className="pointer-events-none absolute inset-3 rounded-full border border-secondary/25" />
          <BrandLogo size="hero" withGlow className="relative z-10 h-28 sm:h-32 xl:h-36" />
        </Link>
        <p className="mt-3.5 max-w-xs px-2 text-center font-serif text-sm leading-relaxed text-on-surface-variant italic">{quote}</p>
      </div>
      <div className="relative z-10 flex w-full items-center justify-between border-t border-outline-variant/30 pt-3 text-xs text-outline">
        <span className="flex items-center gap-1.5 text-on-surface-variant">
          <span className="material-symbols-outlined text-sm text-primary">verified_user</span>
          Fichas · Sessões · Acervo
        </span>
        <span className="flex items-center gap-1.5 text-secondary">
          <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
          Sua história continua
        </span>
      </div>
    </>
  )
}
