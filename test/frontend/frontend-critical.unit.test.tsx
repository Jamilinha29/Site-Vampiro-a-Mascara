// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../../frontend/src/lib/queryClient'
import { useAuthStore } from '../../frontend/src/stores/authStore'
import { api, ApiError } from '../../frontend/src/services/api'
import { parseStatsLabel } from '../../frontend/src/lib/equipmentMods'
import {
  MAX_CHARACTER_LEVEL,
  MIN_CHARACTER_LEVEL,
  SECOND_SUBCLASS_CHOICE_LEVEL,
  SUBCLASS_CHOICE_LEVEL,
  normalizeProgression,
  xpRequiredToAdvance,
} from '../../frontend/src/lib/characterProgression'
import { JoinTableModal } from '../../frontend/src/components/domain/JoinTableModal'
import { CharacterInventoryPanel } from '../../frontend/src/components/characters/CharacterInventoryPanel'
import { ToastProvider } from '../../frontend/src/components/ui/ToastProvider'

describe('frontend auth storage, progression, API error contract & modals (T21-T33)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    queryClient.clear()
    useAuthStore.setState({ session: null, rememberSession: true })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('T21/T22: authStore honors rememberSession storage split and logout clears both storages + queryClient', () => {
    const sample = {
      accessToken: 'tok-1',
      refreshToken: 'ref-1',
      userId: 'u1',
      email: 'jog@ci.local',
      displayName: 'Jog',
      role: 'player' as const,
    }

    useAuthStore.getState().setSession(sample, false)
    expect(window.sessionStorage.getItem('beladona-auth')).toBeTruthy()
    expect(window.localStorage.getItem('beladona-auth')).toBeNull()

    useAuthStore.getState().setSession(sample, true)
    expect(window.localStorage.getItem('beladona-auth')).toBeTruthy()
    expect(window.sessionStorage.getItem('beladona-auth')).toBeNull()

    queryClient.setQueryData(['probe'], { ok: true })
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().session).toBeNull()
    expect(window.localStorage.getItem('beladona-auth')).toBeNull()
    expect(window.sessionStorage.getItem('beladona-auth')).toBeNull()
    expect(queryClient.getQueryData(['probe'])).toBeUndefined()
  })

  it('T25: ApiError keeps HTTP status, error code, and details', () => {
    const err = new ApiError(409, 'Conflito', { code: 'CONFLICT', details: { revision: 4 } })
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(409)
    expect(err.code).toBe('CONFLICT')
    expect(err.details).toEqual({ revision: 4 })
  })

  it('T26-T29: progression contract aligns strictly to levels 0-10 with subclasses at 5 and 7', () => {
    expect(MIN_CHARACTER_LEVEL).toBe(0)
    expect(MAX_CHARACTER_LEVEL).toBe(10)
    expect(SUBCLASS_CHOICE_LEVEL).toBe(5)
    expect(SECOND_SUBCLASS_CHOICE_LEVEL).toBe(7)
    expect(xpRequiredToAdvance(0)).toBe(25)
    expect(xpRequiredToAdvance(10)).toBe(0)

    const lvl5 = normalizeProgression({
      level: 5,
      xp: { current: 10 },
      characterClass: 'Ocultista',
      subclass: null,
      secondarySubclass: null,
    })
    expect(lvl5.needsSubclassChoice).toBe(true)
    expect(lvl5.needsSecondarySubclassChoice).toBe(false)

    const lvl7 = normalizeProgression({
      level: 7,
      xp: { current: 10 },
      characterClass: 'Ocultista',
      subclass: 'Taumaturgo',
      secondarySubclass: null,
    })
    expect(lvl7.needsSubclassChoice).toBe(false)
    expect(lvl7.needsSecondarySubclassChoice).toBe(true)
  })

  it('T31: JoinTableModal closes on Escape key', () => {
    const onClose = vi.fn()
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ToastProvider>
            <JoinTableModal open onClose={onClose} />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('T32/T33: CharacterInventoryPanel inspect modal opens on click and closes on Escape', () => {
    render(
      <MemoryRouter>
        <CharacterInventoryPanel
          character={{
            id: 'c1',
            name: 'Dante',
            species: 'Vampiro',
            level: 3,
            hp: { current: 15, max: 15 },
            inventory: [
              {
                id: 'i1',
                name: 'Lâmina Prateada',
                description: 'Forjada no conclave.',
                category: 'weapon',
                rarity: 'raro',
                weightKg: 2.5,
                statsLabel: '+2 ataque',
              },
            ],
          }}
          onChangeInventory={async () => {}}
        />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Inspecionar' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('Forjada no conclave.')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('parseStatsLabel uses word boundaries so furtividade does not match vida/HP and strips duration notes', () => {
    const parsed = parseStatsLabel('+10 mana, +2 defesa (3 turnos), +1 furtividade')
    expect(parsed.hp).toBe(0)
    expect(parsed.mana).toBe(10)
    expect(parsed.defense).toBe(2)
    expect(parsed.skills.furtividade).toBe(1)
  })

  it('authStore clears in-memory session when another tab removes beladona-auth from localStorage', () => {
    useAuthStore.getState().setSession(
      {
        accessToken: 'tok-tab',
        refreshToken: 'ref-tab',
        userId: 'u-tab',
        email: 'tab@ci.local',
        displayName: 'Tab',
        role: 'player',
      },
      true,
    )
    expect(useAuthStore.getState().session?.userId).toBe('u-tab')

    window.localStorage.removeItem('beladona-auth')
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'beladona-auth',
        oldValue: '{}',
        newValue: null,
        storageArea: window.localStorage,
      }),
    )
    expect(useAuthStore.getState().session).toBeNull()
  })

  it('api.register throws ApiError(202) when backend replies with PENDING_CONFIRMATION', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: { code: 'PENDING_CONFIRMATION', message: 'Confirme o e-mail antes de entrar.' },
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    await expect(
      api.register({ email: 'novo@ci.local', password: 'Password123!', displayName: 'Novo' }),
    ).rejects.toMatchObject({
      status: 202,
      code: 'PENDING_CONFIRMATION',
    })
  })

  it('CharacterInventoryPanel handles items with missing weightKg gracefully without crashing', () => {
    render(
      <MemoryRouter>
        <CharacterInventoryPanel
          character={{
            id: 'c2',
            name: 'Selene',
            species: 'Mortal',
            level: 1,
            hp: { current: 10, max: 10 },
            inventory: [
              {
                id: 'i-no-weight',
                name: 'Anel Antigo',
                description: 'Peso legado ausente.',
                category: 'trinket',
                rarity: 'incomum',
                weightKg: undefined as unknown as number,
              },
            ],
          }}
          onChangeInventory={async () => {}}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Anel Antigo')).toBeInTheDocument()
    expect(screen.getByText('0.0 kg')).toBeInTheDocument()
  })
})
