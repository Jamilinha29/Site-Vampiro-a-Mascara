import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/brand/BrandLogo'

export function AuthAmbient() {
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

export function AuthHeader() {
  return (
    <>
      <header className="safe-pt relative z-20 flex min-h-[5.25rem] w-full min-w-0 shrink-0 items-center justify-between gap-4 border-b border-outline-variant/40 bg-surface-container-lowest/85 px-[clamp(1.25rem,4vw,4.5rem)] py-3 shadow-md backdrop-blur-md">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-3.5 rounded-sm transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <BrandLogo size="sm" withGlow className="h-11 w-11 shrink-0 sm:h-13 sm:w-13" />
          <div className="flex min-w-0 flex-col leading-tight sm:flex-row sm:items-baseline sm:gap-2.5">
            <span className="truncate font-serif text-lg font-semibold text-on-surface sm:text-xl">
              As Crônicas de Beladona
            </span>
            <span className="hidden text-sm text-outline-variant sm:inline">·</span>
            <span className="hidden truncate font-serif text-sm text-secondary italic sm:inline">
              Plataforma da crônica
            </span>
          </div>
        </Link>
        <Link
          to="/ajuda/codice"
          className="group flex shrink-0 items-center gap-2 rounded-md border border-outline-variant/50 bg-surface-container-low px-3.5 py-2 text-xs text-secondary shadow-sm transition hover:border-secondary/60 hover:text-white sm:px-4 sm:py-2.5 sm:text-sm"
        >
          <span className="material-symbols-outlined text-base text-secondary group-hover:text-primary sm:text-lg">
            help_outline
          </span>
          <span className="hidden font-medium sm:inline">Códice de Acesso</span>
        </Link>
      </header>
      <div className="relative z-10 h-px w-full bg-gradient-to-r from-transparent via-outline-variant/60 to-transparent" />
    </>
  )
}
