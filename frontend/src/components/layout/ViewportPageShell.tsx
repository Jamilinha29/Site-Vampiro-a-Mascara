import type { ReactNode } from 'react'

/** Página única centrada na altura da tela (login, recuperar senha, ajuda). */
export function ViewportPageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex min-h-svh min-h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden bg-surface-container-lowest ${className}`}
    >
      <main className="safe-px safe-pb safe-pt flex min-h-0 w-full min-w-0 flex-1 flex-col items-center justify-center overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-3">
        {children}
      </main>
    </div>
  )
}
