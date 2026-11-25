import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { queryClient } from '../lib/queryClient'
import { getSupabaseBrowser } from '../lib/supabaseBrowser'

const STORAGE_KEY = 'beladona-auth'

export type AuthSession = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  userId: string
  email: string
  displayName: string
  role: 'player' | 'narrator' | 'admin'
}

function getStorageMode(): 'local' | 'session' {
  if (typeof window === 'undefined') return 'local'
  if (window.sessionStorage.getItem(STORAGE_KEY) && !window.localStorage.getItem(STORAGE_KEY)) {
    return 'session'
  }
  return 'local'
}

const smartAuthStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(name) ?? window.sessionStorage.getItem(name)
  },
  setItem: (name, value) => {
    if (typeof window === 'undefined') return
    try {
      const parsed = JSON.parse(value) as { state?: { session?: unknown; rememberSession?: boolean } }
      if (!parsed?.state?.session) {
        window.localStorage.removeItem(name)
        window.sessionStorage.removeItem(name)
        return
      }
      const remember = parsed?.state?.rememberSession ?? true
      if (remember) {
        window.localStorage.setItem(name, value)
        window.sessionStorage.removeItem(name)
      } else {
        window.sessionStorage.setItem(name, value)
        window.localStorage.removeItem(name)
      }
    } catch {
      window.localStorage.setItem(name, value)
    }
  },
  removeItem: (name) => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(name)
    window.sessionStorage.removeItem(name)
  },
}

type AuthState = {
  session: AuthSession | null
  rememberSession: boolean
  setSession: (session: AuthSession | null, remember?: boolean) => void
  updateSession: (patch: Partial<AuthSession>) => void
  clearSession: () => void
  logout: () => void
}

function clearAuthSideEffects() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
    window.sessionStorage.removeItem(STORAGE_KEY)
  }
  queryClient.clear()
  const sb = getSupabaseBrowser()
  if (sb) {
    void sb.auth.signOut().catch(() => {})
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      rememberSession: getStorageMode() === 'local',
      setSession: (session, remember) => {
        if (!session) {
          clearAuthSideEffects()
          set({ session: null })
          return
        }
        set((state) => ({
          session,
          rememberSession: remember ?? state.rememberSession,
        }))
      },
      updateSession: (patch) => {
        const cur = get().session
        if (!cur) return
        set({ session: { ...cur, ...patch } })
      },
      clearSession: () => {
        clearAuthSideEffects()
        set({ session: null })
      },
      logout: () => {
        clearAuthSideEffects()
        set({ session: null })
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => smartAuthStorage),
      partialize: (state) => ({
        session: state.session,
        rememberSession: state.rememberSession,
      }),
    },
  ),
)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    void useAuthStore.persist.rehydrate()
  })
}
