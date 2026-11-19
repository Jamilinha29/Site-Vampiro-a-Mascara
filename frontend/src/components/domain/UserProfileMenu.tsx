import { useEffect, useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'

function roleSubtitle(role: string | undefined) {
  if (role === 'narrator' || role === 'admin') return 'Mestre de Mesa'
  return 'Jogador da Corte'
}

export function UserProfileMenu({ context = 'player' }: { context?: 'player' | 'admin' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const session = useAuthStore((s) => s.session)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative border-l border-outline-variant pl-3">
      <button
        type="button"
        className="flex items-center gap-2.5 rounded py-0.5 text-left transition hover:opacity-90"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="relative shrink-0">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-secondary/70 bg-surface-container-high shadow-sm">
            <span className="material-symbols-outlined text-lg text-outline">person</span>
          </div>
          <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" title="Online" />
        </div>
        <div className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="max-w-[9rem] truncate text-sm font-semibold text-on-surface">{session?.displayName ?? 'Perfil'}</span>
          <span className="font-label-sm text-[11px] tracking-wide text-secondary uppercase">
            {roleSubtitle(session?.role)}
          </span>
        </div>
        <span className="material-symbols-outlined hidden text-base text-outline-variant sm:inline">
          expand_more
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute top-full right-0 z-50 mt-2 min-w-[12rem] rounded border border-outline-variant bg-surface-container-high py-1 shadow-lg"
        >
          <Link
            to={context === 'admin' ? '/admin/profile' : '/user/profile'}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
            onClick={() => setOpen(false)}
          >
            <span className="material-symbols-outlined text-base text-secondary">person</span>
            Meu perfil
          </Link>
          <Link
            to={context === 'admin' ? '/admin/settings' : '/user/settings'}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
            onClick={() => setOpen(false)}
          >
            <span className="material-symbols-outlined text-base text-secondary">tune</span>
            Configurações
          </Link>
          {context === 'player' && (session?.role === 'narrator' || session?.role === 'admin') ? (
            <Link
              to="/admin"
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container"
              onClick={() => setOpen(false)}
            >
              <span className="material-symbols-outlined text-base text-secondary">home</span>
              Início do mestre
            </Link>
          ) : null}
          <hr className="my-1 border-outline-variant/40" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-on-surface-variant hover:bg-surface-container hover:text-primary"
            onClick={() => {
              setOpen(false)
              logout()
              navigate('/auth/login')
            }}
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Sair
          </button>
        </div>
      ) : null}
    </div>
  )
}
