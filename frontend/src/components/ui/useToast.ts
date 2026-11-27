import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export type ToastContextValue = {
  push: (message: string, kind?: ToastKind) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
