// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
import { AdminShopEditor } from '../../frontend/src/components/admin/AdminShopEditor'
import SessionsPage from '../../frontend/src/pages/user/SessionsPage'
import RecoverPage from '../../frontend/src/features/auth/RecoverPage'
import CodexHelpPage from '../../frontend/src/pages/public/CodexHelpPage'
import AdminReferencePage from '../../frontend/src/pages/admin/AdminReferencePage'
import AdminSessionsPage from '../../frontend/src/pages/admin/AdminSessionsPage'

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
          onChangeInventory={async () => { }}
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
          onChangeInventory={async () => { }}
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
    expect(within(headerBanner).getByRole('link', { name: /Entrar na crônica/i })).toHaveAttribute('href', '/auth/login')
    const desktopNav = within(headerBanner).getByRole('navigation', { name: 'Seções iniciais' })
    const loreLink = within(desktopNav).getByRole('link', { name: 'Lore' })
    expect(loreLink).toHaveAttribute('href', '#universo')
    expect(loreLink.className).not.toContain('bg-surface-container-low/65')
    expect(within(desktopNav).getByRole('link', { name: 'Mesa' })).toHaveAttribute('href', '#plataforma')
    expect(within(desktopNav).getByRole('link', { name: 'Ritual' })).toHaveAttribute('href', '#jornada')
    expect(screen.queryByText('Criar minha conta')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Suporte de acesso' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Conclave & Mesas' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Central de contato' })).toBeNull()
    expect(screen.queryByText('Projeto oficial')).toBeNull()
    expect(screen.queryByText('Mesa Segura')).toBeNull()
    expect(screen.queryByText(/@handle/i)).toBeNull()
    expect(screen.queryByText(/Código ID/i)).toBeNull()
    expect(screen.queryByText(/Uma crônica em constante construção/i)).toBeNull()
    expect(screen.queryByText(/Menos informações dispersas/i)).toBeNull()

    cleanup()

    render(
      <MemoryRouter>
        <CodexHelpPage />
      </MemoryRouter>,
    )
    const codexHeader = screen.getByRole('banner')
    expect(within(codexHeader).getByRole('link', { name: 'Voltar para a página inicial' })).toHaveAttribute('href', '/')
    expect(within(codexHeader).queryByText('Página inicial')).toBeNull()
    expect(within(codexHeader).queryByText('Suporte e contatos')).toBeNull()
    expect(within(codexHeader).queryByText('Entrar na crônica')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Códice de Beladona' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '4. Moedas, Mercado e Ferreiro' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '6. Alianças, conquistas e suporte' })).toBeInTheDocument()
    expect(screen.queryByText(/@handle/i)).toBeNull()
    expect(screen.queryByText(/Código ID/i)).toBeNull()
  })

  it('AdminDownloadsPage and DownloadsPage separate species sheets from clan book PDFs in list mode', async () => {
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
              id: 'sh-1',
              kind: 'download',
              name: 'Ficha Vampiro Oficial',
              description: 'Modelo padrão',
              visibility: 'published',
              downloadCategory: 'sheets',
              sheetType: 'Vampiro',
              fileName: 'ficha-vampiro.pdf',
              fileUrl: 'https://cdn.example.org/ficha-vampiro.pdf',
              createdAt: '2026-11-27T00:00:00Z',
              updatedAt: '2026-11-27T00:00:00Z',
            },
            {
              id: 'sh-2',
              kind: 'download',
              name: 'Ficha Mortal Oficial',
              description: 'Caçador e civil',
              visibility: 'published',
              downloadCategory: 'sheets',
              sheetType: 'Mortal',
              fileName: 'ficha-mortal.pdf',
              fileUrl: 'https://cdn.example.org/ficha-mortal.pdf',
              createdAt: '2026-11-27T00:00:00Z',
              updatedAt: '2026-11-27T00:00:00Z',
            },
          ],
        }
      }
      if (category === 'rules') {
        return {
          handouts: [],
          files: [
            {
              id: 'b1',
              kind: 'download',
              name: 'Livro Ravnos I',
              description: 'História do clã',
              visibility: 'published',
              downloadCategory: 'rules',
              clan: 'Ravnos',
              fileName: 'ravnos-1.pdf',
              fileUrl: 'https://cdn.example.org/ravnos-1.pdf',
              createdAt: '2026-11-27T00:00:00Z',
              updatedAt: '2026-11-27T00:00:00Z',
            },
            {
              id: 'b2',
              kind: 'download',
              name: 'Livro Ravnos II',
              description: 'Tradições',
              visibility: 'published',
              downloadCategory: 'rules',
              clan: 'Ravnos',
              fileName: 'ravnos-2.pdf',
              fileUrl: 'https://cdn.example.org/ravnos-2.pdf',
              createdAt: '2026-11-27T00:00:00Z',
              updatedAt: '2026-11-27T00:00:00Z',
            },
            {
              id: 'b3',
              kind: 'download',
              name: 'Livro Ravnos III',
              description: 'Quimerismo',
              visibility: 'published',
              downloadCategory: 'rules',
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

    expect(await screen.findByText('Ficha Vampiro Oficial')).toBeInTheDocument()
    const vampiroHeading = screen.getByRole('heading', { name: 'Vampiro' })
    const vampiroBlock = vampiroHeading.closest('article')!
    expect(within(vampiroBlock).getByText('Ficha Vampiro Oficial')).toBeInTheDocument()
    expect(within(vampiroBlock).getByRole('link', { name: /Baixar PDF/i })).toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'Mortal' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Outras espécies' })).toBeInTheDocument()

    const ravnosHeading = await screen.findByRole('heading', { name: 'Ravnos' })
    const ravnosBlock = ravnosHeading.closest('article')!
    expect(within(ravnosBlock).getByText('3 livros')).toBeInTheDocument()
    expect(within(ravnosBlock).getByText('Livro Ravnos I')).toBeInTheDocument()
    expect(within(ravnosBlock).getByText('Livro Ravnos II')).toBeInTheDocument()
    expect(within(ravnosBlock).getByText('Livro Ravnos III')).toBeInTheDocument()
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

  it('AdminCharactersPage moves abilities and weapons into a floating dice/combat sheet modal and AdminCharactersNewPage includes weapons input', async () => {
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
            weapons: ['Adaga Prateada'],
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
            weapons: ['Presas Sombrias'],
            primaryAttackName: 'Investida',
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
    expect(screen.getAllByText('Defesa').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Dominação')).not.toBeInTheDocument()
    expect(screen.queryByText('Presença')).not.toBeInTheDocument()
    expect(screen.queryByText('Mordida Sombria')).not.toBeInTheDocument()
    expect(screen.queryByText('Nenhuma habilidade registrada.')).not.toBeInTheDocument()

    expect(screen.getByText('Cão Sombrio')).toBeInTheDocument()
    expect(screen.getByText('Morto')).toBeInTheDocument()
    expect(screen.getByText(/Classificação: Letal/i)).toBeInTheDocument()

    const sheetButtons = screen.getAllByRole('button', { name: 'Ficha de dados' })
    expect(sheetButtons).toHaveLength(2)

    fireEvent.click(sheetButtons[0])
    const npcDialog = screen.getByRole('dialog', { name: /Lady Carmilla/i })
    expect(within(npcDialog).getByText('Dominação')).toBeInTheDocument()
    expect(within(npcDialog).getByText('Presença')).toBeInTheDocument()
    expect(within(npcDialog).getByText('Adaga Prateada')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Ficha de dados' })[1])
    const monDialog = screen.getByRole('dialog', { name: /Cão Sombrio/i })
    expect(within(monDialog).getByText('Mordida Sombria')).toBeInTheDocument()
    expect(within(monDialog).getByText('Presas Sombrias')).toBeInTheDocument()
    expect(within(monDialog).getByText('Investida')).toBeInTheDocument()

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
    expect(screen.getAllByText(/Armas usadas/i).length).toBe(2)
    expect(screen.getAllByText(/Foto \/ ilustração/i).length).toBe(2)
  })

  it('RecoverPage renders the updated recovery block layout and handles email request and reset mode', async () => {
    const reqSpy = vi
      .spyOn(api, 'requestPasswordRecovery')
      .mockResolvedValue({ message: 'Instruções enviadas.' })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/auth/recover']}>
          <ToastProvider>
            <RecoverPage />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Recuperação de senha' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /As Crônicas de Beladona/i })).toHaveAttribute('href', '/')
    expect(
      screen.getByText('Informe seu e-mail para receber o link de redefinição de senha.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Se não encontrar o e-mail, verifique sua caixa de spam.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para o login' })).toHaveAttribute('href', '/auth/login')

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'valerius@corte.org' } })
    const submitBtn = screen.getByRole('button', { name: 'Enviar link' })
    fireEvent.submit(submitBtn.closest('form')!)

    expect(await screen.findByRole('button', { name: 'Link enviado' })).toBeDisabled()
    expect(reqSpy).toHaveBeenCalledWith('valerius@corte.org')

    cleanup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/auth/recover?token_hash=hash-123']}>
          <ToastProvider>
            <RecoverPage />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Redefinir senha' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nova senha')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmar nova senha')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar nova senha' })).toBeInTheDocument()
  })

  it('AdminReferencePage renders Excluir beside Editar and keeps inline Editar working across catalog kinds', async () => {
    const faithRows = [
      {
        id: 'faith-1',
        kind: 'faith',
        name: 'Catedral da Aurora',
        description: 'Luz antiga.',
        className: '',
        faithPath: 'luz' as const,
        sortOrder: 0,
      },
    ]
    const magicRows = [
      {
        id: 'magic-1',
        kind: 'magic',
        name: 'Taumaturgia',
        description: 'Magia do sangue.',
        className: '',
        faithPath: '' as const,
        sortOrder: 0,
      },
    ]

    vi.spyOn(api, 'adminListReference').mockImplementation(async (kind) =>
      kind === 'faith' ? faithRows : magicRows,
    )
    const addSpy = vi.spyOn(api, 'adminAddReference').mockResolvedValue({
      ...magicRows[0],
      description: 'Magia do sangue atualizada.',
    })
    const deleteSpy = vi.spyOn(api, 'adminDeleteReference').mockResolvedValue(undefined)

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AdminReferencePage />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Catedral da Aurora')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Item excluído.')).toBeInTheDocument()
    expect(deleteSpy).toHaveBeenCalledWith('faith', 'faith-1')

    fireEvent.click(screen.getByRole('button', { name: 'Magia' }))
    expect(await screen.findByText('Taumaturgia')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Item atualizado.')).toBeInTheDocument()
    expect(addSpy).toHaveBeenCalledWith('magic', {
      id: 'magic-1',
      name: 'Taumaturgia',
      description: 'Magia do sangue.',
      className: '',
      faithPath: '',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Item excluído.')).toBeInTheDocument()
    expect(deleteSpy).toHaveBeenCalledWith('magic', 'magic-1')
  })

  it('AdminSessionsPage places active and closed session blocks side by side', async () => {
    vi.spyOn(api, 'adminListScheduledSessions').mockResolvedValue([])
    vi.spyOn(api, 'adminListHandouts').mockResolvedValue([])

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ToastProvider>
            <AdminSessionsPage />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const activeHeading = await screen.findByRole('heading', { name: 'Mesas em andamento' })
    const closedHeading = screen.getByRole('heading', { name: 'Mesas encerradas' })
    const gridContainer = activeHeading.closest('section')?.parentElement
    expect(gridContainer).toBe(closedHeading.closest('section')?.parentElement)
    expect(gridContainer?.className).toContain('lg:grid-cols-2')
  })

  it('AdminShopEditor renders Nome da Crônica and Mestres as select lists and submits selected table scopes', async () => {
    vi.spyOn(api, 'adminListEntities').mockResolvedValue([])
    vi.spyOn(api, 'adminShopLevels').mockResolvedValue({})
    vi.spyOn(api, 'adminListReference').mockResolvedValue([])
    vi.spyOn(api, 'adminListScheduledSessions').mockResolvedValue([
      {
        id: 'sess-1',
        title: 'Mesa Ativa',
        chronicleName: 'Queda de Beladona',
        scheduledAt: '2026-11-29T20:00:00.000Z',
        accessCode: 'ABC123',
        status: 'open',
        activeDurationMs: 0,
        presence: [],
        seats: [],
        createdAt: '2026-11-28T00:00:00.000Z',
      },
    ])
    vi.spyOn(api, 'adminListMasters').mockResolvedValue([
      { email: 'valerius@corte.local', displayName: 'Mestre Valerius', role: 'narrator' },
    ])
    const createSpy = vi.spyOn(api, 'adminCreateEntity').mockResolvedValue({
      id: 'item-1',
      kind: 'equipment',
      name: 'Espada Lunar',
      description: '',
      visibility: 'draft',
      createdAt: '2026-11-28T00:00:00.000Z',
      updatedAt: '2026-11-28T00:00:00.000Z',
    })
    vi.spyOn(api, 'adminSetShopLevel').mockResolvedValue({ entityId: 'item-1', requiredLevel: 1 })
    vi.spyOn(api, 'adminPublishEntity').mockResolvedValue({
      id: 'item-1',
      kind: 'equipment',
      name: 'Espada Lunar',
      description: '',
      visibility: 'published',
      createdAt: '2026-11-28T00:00:00.000Z',
      updatedAt: '2026-11-28T00:00:00.000Z',
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ToastProvider>
            <AdminShopEditor />
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const chronicleSelect = screen.getByLabelText('Nome da Crônica') as HTMLSelectElement
    const masterSelect = screen.getByLabelText('Mestres') as HTMLSelectElement
    expect(chronicleSelect.tagName).toBe('SELECT')
    expect(masterSelect.tagName).toBe('SELECT')

    expect(await screen.findByRole('option', { name: 'Queda de Beladona · mesa ativa' })).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'Mestre Valerius · Narrador' })).toBeInTheDocument()
    expect(screen.getByText(/apenas para exibir o item na mesa ativa; no mercado global ele não aparece/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Espada Lunar' } })
    fireEvent.change(chronicleSelect, { target: { value: 'Queda de Beladona' } })
    fireEvent.change(masterSelect, { target: { value: 'valerius@corte.local' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar e publicar' }))

    await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveValue(''))
    expect(chronicleSelect).toHaveValue('')
    expect(masterSelect).toHaveValue('')
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Espada Lunar',
        chronicleScope: 'Queda de Beladona',
        narratorScope: 'valerius@corte.local',
      }),
    )
  })
})
