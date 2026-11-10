import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AuthSession = {
  accessToken: string
  userId: string
  email: string
  displayName: string
  role: 'player' | 'narrator' | 'admin'
}

type AuthState = {
  session: AuthSession | null
  setSession: (session: AuthSession | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      logout: () => set({ session: null }),
    }),
    { name: 'beladona-auth' },
  ),
)
