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
import { evaluateClientLiveGate } from '../../frontend/src/lib/mesaSession'
import { AdminShell } from '../../frontend/src/components/layout/AdminShell'
import HomePage from '../../frontend/src/pages/public/HomePage'
import DownloadsPage from '../../frontend/src/pages/user/DownloadsPage'
import AdminDownloadsPage from '../../frontend/src/pages/admin/AdminDownloadsPage'
import AdminCharactersPage from '../../frontend/src/pages/admin/AdminCharactersPage'
import AdminCharactersNewPage from '../../frontend/src/pages/admin/AdminCharactersNewPage'
import SessionsPage from '../../frontend/src/pages/user/SessionsPage'

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

  it('evaluateClientLiveGate only opens live for confirmed participants once scheduled time arrives', () => {
    const now = Date.parse('2026-11-27T20:00:00.000Z')
    const future = '2026-11-27T21:00:00.000Z'
    const due = '2026-11-27T20:00:00.000Z'

    expect(
      evaluateClientLiveGate(
        { status: 'open', scheduledAt: due, hasConfirmedPresence: false, presence: [] },
        'jog@ci.local',
        now,
      ),
    ).toMatchObject({ canEnterLive: false, reason: 'presence_required' })

    expect(
      evaluateClientLiveGate(
        { status: 'open', scheduledAt: future, hasConfirmedPresence: true, presence: [] },
        'jog@ci.local',
        now,
      ),
    ).toMatchObject({ canEnterLive: false, reason: 'before_schedule' })

    expect(
      evaluateClientLiveGate(
        { status: 'scheduled', scheduledAt: due, hasConfirmedPresence: true, presence: [] },
        'jog@ci.local',
        now,
      ),
    ).toMatchObject({ canEnterLive: false, reason: 'not_open' })

    expect(
      evaluateClientLiveGate(
        { status: 'open', scheduledAt: due, hasConfirmedPresence: true, presence: [] },
        'jog@ci.local',
        now,
      ),
    ).toMatchObject({ canEnterLive: true })
  })

  it('AdminShell renders grouped sidebar sections with original colors and centered profile card, and HomePage uses fluid containers', () => {
    useAuthStore.setState({
      session: {
        accessToken: 'tok-nar',
        userId: 'n1',
        email: 'mestre@ci.local',
        displayName: 'mestre',
        role: 'narrator',
      },
      rememberSession: true,
    })

    const { container: shellContainer } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin']}>
          <AdminShell />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByText('Painel principal')).toBeInTheDocument()
    expect(screen.getByText('Gestão da crônica')).toBeInTheDocument()
    expect(screen.getByText('Biblioteca')).toBeInTheDocument()
    expect(screen.getByText('Comunidade')).toBeInTheDocument()
    expect(screen.queryByText('Recursos')).toBeNull()
    expect(screen.getByText('Mestre de Mesa')).toBeInTheDocument()
    expect(screen.getByText('Compêndio')).toBeInTheDocument()
    expect(screen.getByText('Alianças')).toBeInTheDocument()
    expect(screen.getByText('Conquistas e Recompensas')).toBeInTheDocument()
    expect(screen.getByText('Mercado')).toBeInTheDocument()
    const aside = shellContainer.querySelector('aside')
    expect(aside?.className).toContain('border-outline-variant/30')
    expect(shellContainer.querySelector('svg')).toBeNull()

    const asideText = aside?.textContent ?? ''
    expect(asideText.indexOf('Gestão da crônica')).toBeLessThan(asideText.indexOf('Mercado'))
    expect(asideText.indexOf('Mercado')).toBeLessThan(asideText.indexOf('Biblioteca'))
    expect(asideText.indexOf('Ajuda & Suporte')).toBeLessThan(asideText.indexOf('Configurações'))
    expect(asideText.indexOf('Configurações')).toBeLessThan(asideText.indexOf('Sair'))

    cleanup()

    const { container: homeContainer } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(homeContainer.innerHTML).not.toContain('max-w-6xl')
    const headerBanner = screen.getByRole('banner')
    expect(headerBanner).toBeInTheDocument()
    expect(within(headerBanner).queryByText('Entrar')).toBeNull()
    expect(screen.queryByText(/Uma crônica em constante construção/i)).toBeNull()
    expect(screen.queryByText(/Menos informações dispersas/i)).toBeNull()
  })

  it('AdminDownloadsPage and DownloadsPage use renamed sections and group multiple clan PDFs in list mode', async () => {
    vi.spyOn(api, 'adminListEntities').mockResolvedValue([])
    vi.spyOn(api, 'getCatalogClans').mockResolvedValue([
      { id: 'c-ravnos', name: 'Ravnos', slug: 'ravnos' },
      { id: 'c-brujah', name: 'Brujah', slug: 'brujah' },
    ])

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminDownloadsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('button', { name: 'Acontecimentos Passados' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fichas oficiais imprimíveis' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Compêndio' })).toBeInTheDocument()

    cleanup()

    vi.spyOn(api, 'getDownloadsContent').mockImplementation(async (category) => {
      if (category === 'sheets') {
        return {
          handouts: [],
          files: [
            {
              id: 's1',
              kind: 'download',
              name: 'Ficha Ravnos Clássica',
              description: 'Versão padrão',
              visibility: 'published',
              downloadCategory: 'sheets',
              clan: 'Ravnos',
              fileName: 'ravnos-1.pdf',
              fileUrl: 'https://cdn.example.org/ravnos-1.pdf',
              createdAt: '2026-11-27T00:00:00Z',
              updatedAt: '2026-11-27T00:00:00Z',
            },
            {
              id: 's2',
              kind: 'download',
              name: 'Ficha Ravnos Antiga',
              description: 'Idade das Trevas',
              visibility: 'published',
              downloadCategory: 'sheets',
              clan: 'Ravnos',
              fileName: 'ravnos-2.pdf',
              fileUrl: 'https://cdn.example.org/ravnos-2.pdf',
              createdAt: '2026-11-27T00:00:00Z',
              updatedAt: '2026-11-27T00:00:00Z',
            },
            {
              id: 's3',
              kind: 'download',
              name: 'Ficha Ravnos Disciplinas',
              description: 'Quimerismo',
              visibility: 'published',
              downloadCategory: 'sheets',
              clan: 'Ravnos',
              fileName: 'ravnos-3.pdf',
              fileUrl: 'https://cdn.example.org/ravnos-3.pdf',
              createdAt: '2026-11-27T00:00:00Z',
              updatedAt: '2026-11-27T00:00:00Z',
            },
          ],
        }
      }
      return { files: [], handouts: [] }
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DownloadsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Acontecimentos Passados' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fichas oficiais imprimíveis' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Compêndio' })).toBeInTheDocument()

    const ravnosHeading = await screen.findByRole('heading', { name: 'Ravnos' })
    const ravnosBlock = ravnosHeading.closest('article')!
    expect(within(ravnosBlock).getByText('3 arquivos')).toBeInTheDocument()
    expect(within(ravnosBlock).getByText('Ficha Ravnos Clássica')).toBeInTheDocument()
    expect(within(ravnosBlock).getByText('Ficha Ravnos Antiga')).toBeInTheDocument()
    expect(within(ravnosBlock).getByText('Ficha Ravnos Disciplinas')).toBeInTheDocument()
    expect(within(ravnosBlock).getAllByRole('link', { name: /Baixar PDF/i })).toHaveLength(3)
  })

  it('SessionsPage places private table code input below session search and above public/friend tables', () => {
    vi.spyOn(api, 'getScheduledSessions').mockResolvedValue([])
    vi.spyOn(api, 'getMeProfile').mockResolvedValue({
      id: 'p1',
      email: 'jog@ci.local',
      displayName: 'Jog',
      handle: '@jog',
      role: 'player',
      memberSince: '2026-01-01T00:00:00Z',
      avatarUrl: null,
      bannerUrl: null,
      badges: [],
      preferences: {},
      accountMetrics: { characters: 0, sessions: 0, chronicles: 0, totalXp: 0 },
      lineageStats: {},
      characters: [],
    } as never)
    vi.spyOn(api, 'getSessionBoard').mockResolvedValue({ publicTables: [], friendTables: [] })

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ToastProvider>
            <SessionsPage />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const text = container.textContent ?? ''
    const searchIdx = text.indexOf('Procurar sessão')
    const privateIdx = text.indexOf('Mesa privada · código')
    const publicIdx = text.indexOf('Abertas ao público')
    expect(searchIdx).toBeGreaterThanOrEqual(0)
    expect(privateIdx).toBeGreaterThan(searchIdx)
    expect(publicIdx).toBeGreaterThan(privateIdx)
  })

  it('AdminCharactersPage renders user-character-style cards with stats, abilities, classification and alive/dead status, and AdminCharactersNewPage has image + edit inputs', async () => {
    vi.spyOn(api, 'adminListHandouts').mockResolvedValue([])
    vi.spyOn(api, 'adminListEntities').mockImplementation(async (kind) => {
      if (kind === 'npc') {
        return [
          {
            id: 'npc-1',
            kind: 'npc',
            name: 'Lady Carmilla',
            description: 'Conselheira da corte.',
            visibility: 'published',
            creatureType: 'Vampiro',
            threatLevel: 'perigoso',
            lifeStatus: 'alive',
            hpMax: 50,
            manaMax: 30,
            defense: 15,
            abilities: ['Dominação', 'Presença'],
            createdAt: '2026-11-28T00:00:00Z',
            updatedAt: '2026-11-28T00:00:00Z',
          },
        ]
      }
      if (kind === 'monster') {
        return [
          {
            id: 'mon-1',
            kind: 'monster',
            name: 'Cão Sombrio',
            description: 'Fera noturna.',
            visibility: 'published',
            creatureType: 'Bestas da noite',
            threatLevel: 'letal',
            lifeStatus: 'dead',
            hpMax: 80,
            manaMax: 10,
            defense: 14,
            abilities: ['Mordida Sombria'],
            createdAt: '2026-11-28T00:00:00Z',
            updatedAt: '2026-11-28T00:00:00Z',
          },
        ]
      }
      return []
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ToastProvider>
            <AdminCharactersPage />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Lady Carmilla')).toBeInTheDocument()
    expect(screen.getByText('Vivo · aguardando sessão')).toBeInTheDocument()
    expect(screen.getByText(/Classificação: Perigoso/i)).toBeInTheDocument()
    expect(screen.getByText('Dominação')).toBeInTheDocument()
    expect(screen.getByText('Presença')).toBeInTheDocument()
    expect(screen.getAllByText('Defesa').length).toBeGreaterThanOrEqual(1)

    expect(screen.getByText('Cão Sombrio')).toBeInTheDocument()
    expect(screen.getByText('Morto')).toBeInTheDocument()
    expect(screen.getByText(/Classificação: Letal/i)).toBeInTheDocument()
    expect(screen.getByText('Mordida Sombria')).toBeInTheDocument()

    cleanup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminCharactersNewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getAllByText('Classificação').length).toBe(2)
    expect(screen.getAllByText('Estado na crônica').length).toBe(2)
    expect(screen.getAllByText('Defesa').length).toBe(2)
    expect(screen.getAllByText(/Habilidades/i).length).toBe(2)
    expect(screen.getAllByText(/Foto \/ ilustração/i).length).toBe(2)
  })
})
