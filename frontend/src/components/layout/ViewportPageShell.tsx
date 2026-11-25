import type { ReactNode } from 'react'

/** Página única centrada na altura da tela (login, recuperar senha, ajuda). */
export function ViewportPageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`flex min-h-svh min-h-dvh w-full min-w-0 flex-col overflow-x-clip bg-surface-container-lowest ${className}`}
    >
      <main className="safe-px safe-pb safe-pt flex min-h-0 w-full min-w-0 flex-1 flex-col items-center overflow-x-clip overflow-y-auto px-4 py-4">
        <div className="my-auto flex w-full min-w-0 flex-col items-center">{children}</div>
      </main>
    </div>
  )
}
