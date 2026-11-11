import type { ReactNode } from 'react'

/** Página única centrada na altura da tela (login, recuperar senha, ajuda). */
export function ViewportPageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex h-svh max-h-svh flex-col overflow-hidden bg-surface-container-lowest ${className}`}>
      <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-3">
        {children}
      </main>
    </div>
  )
}
