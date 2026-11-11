import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useAuthStore, type AuthSession } from '../../stores/authStore'
import { useToast } from '../../components/ui/ToastProvider'
import { BrandLogo } from '../../components/brand/BrandLogo'

type Mode = 'login' | 'register'

type Props = {
  mode?: Mode
}

export default function AuthPortalPage({ mode: initialMode = 'login' }: Props) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const navigate = useNavigate()
  const setSession = useAuthStore((s) => s.setSession)
  const { push } = useToast()

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.login(email, password),
    onSuccess: (data) => {
      const session: AuthSession = {
        accessToken: data.accessToken,
        userId: data.userId,
        email: data.email,
        displayName: data.displayName,
        role: data.role as AuthSession['role'],
      }
      setSession(session)
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
      const session: AuthSession = {
        accessToken: data.accessToken,
        userId: data.userId,
        email: data.email,
        displayName: data.displayName,
        role,
      }
      setSession(session)
      push('Conclave aberto. Bem-vindo, mestre.', 'success')
      navigate('/admin')
    },
    onError: () => push('Login do mestre recusado.', 'error'),
  })

  const registerMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.register(payload),
    onSuccess: (data) => {
      const session: AuthSession = {
        accessToken: data.accessToken,
        userId: data.userId,
        email: data.email,
        displayName: data.displayName,
        role: data.role as AuthSession['role'],
      }
      setSession(session)
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
      <Ambient />
      <AuthHeader />
      <main className="auth-portal-main">
        <div className="relative w-full max-w-5xl shrink-0 overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low/95 shadow-2xl backdrop-blur-md">
          <div className="grid w-full grid-cols-1 lg:grid-cols-2 lg:items-stretch">
            <LoginColumn
              mode={mode}
              setMode={setMode}
              onSubmit={(email, password) => loginMutation.mutate({ email, password })}
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
            className="slide-panel-transition absolute inset-y-0 right-0 z-30 hidden w-1/2 flex-col items-center justify-between overflow-hidden border-outline-variant/40 bg-surface-container p-4 shadow-2xl md:p-5 lg:flex"
            style={{ transform: sliderTransform, borderRight: mode === 'register' ? '1px solid rgba(89,65,65,0.4)' : undefined, borderLeft: mode === 'login' ? '1px solid rgba(89,65,65,0.4)' : undefined }}
          >
            <SliderPanel mode={mode} />
          </div>
        </div>
      </main>
      <AuthFooter />
    </div>
  )
}

function Ambient() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-container/20 via-surface-container-lowest/95 to-surface-container-lowest" />
      <div className="ambient-torch-glow absolute -top-32 left-1/4 h-[34rem] w-[34rem] rounded-full bg-primary-container/20 blur-[140px]" />
      <div
        className="ambient-torch-glow absolute top-1/2 -right-20 h-96 w-96 rounded-full bg-secondary-container/20 blur-[120px]"
        style={{ animationDelay: '2.5s' }}
      />
    </div>
  )
}

function AuthHeader() {
  return (
    <>
      <header className="safe-px safe-pt relative z-20 flex w-full min-w-0 shrink-0 items-center justify-between gap-2 border-b border-outline-variant/40 bg-surface-container-lowest/85 py-1.5 shadow-md backdrop-blur-md sm:py-2">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2.5 rounded-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary sm:gap-3.5"
        >
          <BrandLogo size="xs" withGlow className="shrink-0" />
          <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2.5">
            <span className="truncate font-label-md text-[10px] font-bold tracking-widest uppercase sm:text-xs">
              Vampiro: A Idade das Trevas
            </span>
            <span className="hidden text-xs text-outline-variant sm:inline">•</span>
            <span className="truncate font-serif text-[10px] tracking-wider text-secondary italic sm:text-xs">
              As Crônicas de Beladona
            </span>
          </div>
        </Link>
        <Link
          to="/ajuda/codice"
          className="group flex shrink-0 items-center gap-1 rounded border border-outline-variant/40 bg-surface-container-low px-2 py-1.5 text-xs text-secondary shadow-sm transition hover:border-secondary/50 hover:text-white sm:gap-1.5 sm:px-3"
        >
          <span className="material-symbols-outlined text-sm text-secondary group-hover:text-primary">help_outline</span>
          <span className="hidden font-medium sm:inline">Códice de Acesso</span>
        </Link>
      </header>
      <div className="relative z-10 h-px w-full bg-gradient-to-r from-transparent via-outline-variant/60 to-transparent" />
    </>
  )
}

function AuthFooter() {
  return (
    <footer className="safe-px safe-pb relative z-10 shrink-0 border-t border-outline-variant/40 bg-surface-container-lowest/90 py-1.5 backdrop-blur sm:py-2">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1 text-center md:flex-row md:gap-2 md:text-left">
        <p className="flex items-center gap-2 text-[10px] text-on-surface-variant sm:text-xs">
          <span className="material-symbols-outlined text-sm text-primary">military_tech</span>
          © Vampiro: A Idade das Trevas — As Crônicas de Beladona
        </p>
        <nav className="hidden flex-wrap items-center justify-center gap-5 text-xs text-on-surface-variant sm:flex">
          <Link to="/ajuda/codice" className="flex items-center gap-1 hover:text-primary">
            <span className="material-symbols-outlined text-xs">menu_book</span>
            Códice da Máscara
          </Link>
          <a href="/#estatutos" className="flex items-center gap-1 hover:text-primary">
            <span className="material-symbols-outlined text-xs">gavel</span>
            Estatutos da Noite
          </a>
        </nav>
      </div>
    </footer>
  )
}

function TabSwitcher({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="mb-2 flex justify-center">
      <div className="inline-flex w-full items-center gap-1.5 rounded border border-outline-variant/60 bg-surface-container-lowest/90 p-1 shadow-inner">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-center font-label-md text-xs tracking-wider uppercase transition ${
            mode === 'login'
              ? 'border border-primary-container/70 bg-primary-container/20 font-bold text-primary shadow-sm'
              : 'border border-transparent font-semibold text-on-surface-variant hover:bg-surface-container/70 hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-base">vpn_key</span>
          Entrar nas Trevas
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={`flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-center font-label-md text-xs tracking-wider uppercase transition ${
            mode === 'register'
              ? 'border border-secondary/70 bg-secondary/15 font-bold text-secondary shadow-sm'
              : 'border border-transparent font-semibold text-on-surface-variant hover:bg-surface-container/70 hover:text-secondary'
          }`}
        >
          <span className="material-symbols-outlined text-base">history_edu</span>
          Forjar Linhagem
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
  onSubmit: (email: string, password: string) => void
  loading: boolean
  onAdminSubmit: (email: string, password: string) => void
  adminLoading: boolean
}) {
  const emailId = useId()
  const passId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)

  if (mode !== 'login') return null

  return (
    <div className="flex flex-col p-3 sm:p-4 lg:col-start-1">
      <div>
        <TabSwitcher mode={mode} setMode={setMode} />
        <div className="auth-portal-heading mb-3 flex items-center border-b border-outline-variant/40 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="material-symbols-outlined shrink-0 text-xl text-primary">vpn_key</span>
            <div className="min-w-0">
              <h2 className="font-headline-sm text-sm font-bold tracking-wider text-primary uppercase md:text-base">
                Entrar nas Trevas
              </h2>
              <p className="auth-portal-subtitle text-[10px] font-medium tracking-wide text-on-surface-variant">
                Identificação nobiliárquica sob a Máscara
              </p>
            </div>
          </div>
        </div>
        <form
          className="space-y-2.5 [&_.input-feudal]:py-2 [&_.input-feudal]:pl-9"
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit(email, password)
          }}
        >
          <Field label="Correio Feudal ou Nome de Guerra" required hint="ex: valerius@corte-noturna.org" id={emailId}>
            <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-lg text-outline">shield_person</span>
            <input
              id={emailId}
              className="input-feudal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </Field>
          <Field label="Selo Secreto (Senha)" required id={passId} action={<Link to="/auth/recover" className="text-xs text-secondary hover:underline">Esqueci o Selo</Link>}>
            <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-lg text-outline">lock</span>
            <input
              id={passId}
              type={showPass ? 'text' : 'password'}
              className="input-feudal pr-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button type="button" className="absolute right-3 text-outline hover:text-on-surface" onClick={() => setShowPass((s) => !s)} aria-label="Revelar senha">
              <span className="material-symbols-outlined text-lg">{showPass ? 'visibility_off' : 'visibility'}</span>
            </button>
          </Field>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-on-surface-variant">
            <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-outline-variant text-primary-container focus:ring-primary-container" />
            Manter Vigília Ativa (Lembrar sessão)
          </label>
          <button type="submit" className="btn-primary w-full py-2 text-sm" disabled={loading}>
            <span className="material-symbols-outlined text-lg">meeting_room</span>
            {loading ? 'Abrindo…' : 'Adentrar o Santuário'}
          </button>
        </form>

        <AuthSocialExtras
          googleContext="login"
          compact
          showAdminLogin={showAdminLogin}
          onToggleAdmin={() => setShowAdminLogin((v) => !v)}
          onAdminSubmit={onAdminSubmit}
          adminLoading={adminLoading}
        />
        <AuthAdminModal
          open={showAdminLogin}
          onClose={() => setShowAdminLogin(false)}
          onAdminSubmit={onAdminSubmit}
          adminLoading={adminLoading}
        />
      </div>
    </div>
  )
}

function AuthSocialExtras({
  googleContext,
  allowAdmin = true,
  compact = false,
  showAdminLogin,
  onToggleAdmin,
  onAdminSubmit,
  adminLoading,
}: {
  googleContext: 'login' | 'register'
  allowAdmin?: boolean
  compact?: boolean
  showAdminLogin?: boolean
  onToggleAdmin?: () => void
  onAdminSubmit?: (email: string, password: string) => void
  adminLoading?: boolean
}) {
  return (
    <div className={`${compact ? 'mt-2 space-y-2' : 'mt-2.5 space-y-2.5'}`}>
      {!compact ? <AuthOuDivider /> : null}
      {allowAdmin ? (
        <>
          <div className={`grid gap-2 ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'}`}>
            <GoogleAuthButton context={googleContext} className={compact ? 'hidden sm:inline-flex' : ''} />
            <button
              type="button"
              className={`inline-flex w-full items-center justify-center gap-1.5 rounded border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition ${
                showAdminLogin
                  ? 'border-secondary bg-secondary/15 text-secondary'
                  : 'border-outline-variant/60 bg-surface-container text-on-surface-variant hover:border-secondary/50 hover:text-secondary'
              }`}
              onClick={onToggleAdmin}
              aria-expanded={showAdminLogin}
            >
              <span className="material-symbols-outlined text-base">admin_panel_settings</span>
              ADM
            </button>
          </div>
          {showAdminLogin && onAdminSubmit ? (
            <div className="hidden lg:block">
              <AdminMasterPanel onAdminSubmit={onAdminSubmit} adminLoading={adminLoading ?? false} />
            </div>
          ) : null}
        </>
      ) : (
        <GoogleAuthButton context={googleContext} className="w-full" />
      )}
    </div>
  )
}

function AuthAdminModal({
  open,
  onClose,
  onAdminSubmit,
  adminLoading,
}: {
  open: boolean
  onClose: () => void
  onAdminSubmit: (email: string, password: string) => void
  adminLoading: boolean
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-admin-modal-title"
    >
      <button type="button" className="absolute inset-0 bg-black/65" aria-label="Fechar" onClick={onClose} />
      <div className="safe-pb relative z-10 w-full max-w-md max-h-[min(85dvh,32rem)] overflow-y-auto overscroll-y-contain rounded-xl border border-secondary/40 bg-surface-container-high p-1 shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/30 px-3 py-2">
          <p id="auth-admin-modal-title" className="text-xs font-bold tracking-wider text-secondary uppercase">
            Login do mestre
          </p>
          <button
            type="button"
            className="rounded p-1 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            onClick={onClose}
            aria-label="Fechar painel"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <AdminMasterPanel
          onAdminSubmit={(email, password) => {
            onAdminSubmit(email, password)
          }}
          adminLoading={adminLoading}
          className="border-0 bg-transparent shadow-none"
        />
      </div>
    </div>
  )
}

function AdminMasterPanel({
  onAdminSubmit,
  adminLoading,
  className = '',
}: {
  onAdminSubmit: (email: string, password: string) => void
  adminLoading: boolean
  className?: string
}) {
  const adminEmailId = useId()
  const adminPassId = useId()
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  return (
    <div className={`space-y-2 rounded-lg border border-secondary/35 bg-secondary/5 p-2.5 sm:p-3 ${className}`}>
      <div className="flex items-center gap-2 border-b border-secondary/20 pb-2">
        <span className="material-symbols-outlined text-secondary">military_tech</span>
        <div>
          <p className="text-xs font-bold tracking-wider text-secondary uppercase">Login do mestre</p>
          <p className="text-[11px] text-on-surface-variant">Use correio narrador@… ou mestre@…</p>
        </div>
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          onAdminSubmit(adminEmail, adminPassword)
        }}
      >
        <Field label="Correio do conclave" required id={adminEmailId}>
          <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-lg text-outline">shield_person</span>
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
          <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-lg text-outline">lock</span>
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
        <button type="submit" className="btn-primary w-full py-2.5 text-sm" disabled={adminLoading}>
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

function googleStubMessage(context: 'login' | 'register' | 'admin') {
  if (context === 'register') return 'Cadastro pelo Google será habilitado na crônica oficial.'
  if (context === 'admin') return 'Entrada de mestre pelo Google será habilitada na crônica oficial.'
  return 'Entrada pelo Google será habilitada na crônica oficial.'
}

function GoogleAuthButton({ context, className = '' }: { context: 'login' | 'register' | 'admin'; className?: string }) {
  const { push } = useToast()
  return (
    <button
      type="button"
      className={`btn-secondary inline-flex items-center justify-center gap-2 py-2 text-xs ${className}`}
      onClick={() => push(googleStubMessage(context), 'info')}
    >
      <GoogleIcon />
      Google
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
    <div className="flex flex-col p-3 sm:p-4 lg:col-start-2">
      <div>
        <TabSwitcher mode={mode} setMode={setMode} />
        <div className="auth-portal-heading mb-3 flex items-center border-b border-outline-variant/40 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="material-symbols-outlined shrink-0 text-xl text-secondary">history_edu</span>
            <div className="min-w-0">
              <h2 className="font-headline-sm text-sm font-bold tracking-wider text-secondary uppercase md:text-base">
                Forjar Linhagem
              </h2>
              <p className="auth-portal-subtitle text-[10px] font-medium tracking-wide text-on-surface-variant">
                Pacto eterno nas Crônicas de Beladona
              </p>
            </div>
          </div>
        </div>
        <form
          className="space-y-2.5 [&_.input-feudal]:py-2 [&_.input-feudal]:pl-9"
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
          <Field label="Título Nobiliárquico" required>
            <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-lg text-outline">assignment_ind</span>
            <input className="input-feudal" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="Preencha com seu nome" />
          </Field>
          <Field label="Correio Feudal" required>
            <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-lg text-outline">mail</span>
            <input type="email" className="input-feudal" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Selo Secreto" required>
            <span className="material-symbols-outlined pointer-events-none absolute left-3.5 text-lg text-outline">lock</span>
            <input type="password" className="input-feudal" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Mínimo 8 runas" />
          </Field>
          <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-on-surface-variant">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required className="mt-0.5 h-3.5 w-3.5 rounded border-outline-variant text-primary-container" />
            Aceito as Tradições de Caim e os Estatutos de Beladona.
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-[11px] leading-snug text-on-surface-variant">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 rounded border-outline-variant text-primary-container" />
            Desejo receber avisos da crônica por corvo mensageiro.
          </label>
          <button type="submit" className="btn-primary w-full py-2 text-sm" disabled={loading}>
            <span className="material-symbols-outlined text-lg">history_edu</span>
            {loading ? 'Forjando…' : 'Forjar Linhagem'}
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
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
          {label}
          {required ? <span className="text-primary">*</span> : null}
        </label>
        {hint ? <span className="text-[11px] text-secondary opacity-80">{hint}</span> : action}
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
      ? '"Apresentai vosso juramento de sangue para transpor as muralhas de Bizâncio e adentrar o santuário sob os eternos auspícios do Códice e da Noite."'
      : '"A noite pertence àqueles que ousam forjar seu próprio destino nas trevas eternas de Beladona."'

  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary-container/20 via-surface-container-high/90 to-surface-container-lowest" />
      <div className="relative z-10 flex w-full items-center justify-between border-b border-outline-variant/30 pb-2 text-[10px] tracking-widest uppercase">
        <span className="flex items-center gap-1.5 text-secondary">
          <span className="material-symbols-outlined text-sm text-primary">token</span>
          Ordinis Sanguinis
        </span>
        <span className="text-outline">Beladona</span>
      </div>
      <div className="relative z-10 my-auto flex w-full flex-col items-center py-1">
        <Link
          to="/"
          className="relative flex aspect-square w-full max-w-[9rem] items-center justify-center rounded-full transition hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-secondary sm:max-w-[10rem] md:max-w-[11rem]"
          aria-label="Voltar à página inicial"
        >
          <div className="pointer-events-none absolute inset-0 animate-pulse rounded-full border border-dashed border-outline-variant/40" />
          <div className="pointer-events-none absolute inset-3 rounded-full border border-secondary/25" />
          <BrandLogo size="lg" withGlow className="relative z-10" />
        </Link>
        <p className="mt-1.5 line-clamp-3 max-w-xs px-2 text-center font-serif text-xs leading-snug text-on-surface-variant italic">{quote}</p>
      </div>
      <div className="relative z-10 flex w-full items-center justify-between border-t border-outline-variant/30 pt-2 text-[11px] text-outline">
        <span className="flex items-center gap-1 text-on-surface-variant">
          <span className="material-symbols-outlined text-xs text-primary">verified_user</span>
          Selo Imperial Ativo
        </span>
        <span className="flex items-center gap-1 text-secondary">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary" />
          Transmissão Sob a Máscara
        </span>
      </div>
    </>
  )
}
