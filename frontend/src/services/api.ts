import { useAuthStore } from '../stores/authStore'
import { queryClient } from '../lib/queryClient'

/** Em produção na Vercel, API no mesmo host (`/api/...`). Localhost no bundle = Failed to fetch. */
function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '')
  if (!raw) return ''
  if (import.meta.env.PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw)) {
    return ''
  }
  return raw
}

const API_BASE = resolveApiBase()
const REQUEST_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: unknown

  constructor(status: number, message: string, options?: { code?: string; details?: unknown }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = options?.code
    this.details = options?.details
  }
}

export type ReferenceEntry = {
  id: string
  kind: string
  name: string
  description: string
  className: string
  faithPath: '' | 'luz' | 'trevas'
  sortOrder: number
}

type CampaignRules = {
  version: number
  maxLevel: number
  subclassLevel: number
  secondarySubclassLevel?: number
  startingXp: number
  shopBudgetCopper: number
  updatedAt: string
}
type BoardCard = {
  id: string
  kind: 'mystery' | 'mission' | 'place' | 'pending' | 'npc'
  title: string
  status: 'confirmed' | 'proposed' | 'pending'
  detail: string
  owner: string
  priority: 'baixa' | 'media' | 'alta'
}
type CampaignBackup = {
  profiles?: unknown[]
  sessions?: unknown[]
  handouts?: unknown[]
  wallets?: Record<string, { gold?: number; silver?: number; copper?: number }>
}
type BackupReport = {
  wrote: boolean
  profiles: number
  characters: number
  inventoryItems: number
  sessions: number
  handouts: number
  wallets: number
  gold: number
  silver: number
  copper: number
  imageReferences: number
  storageManifest?: string[]
  storageNote: string
}

type RefreshResult = { token: string | null; unauthorized: boolean }
let refreshInFlight: Promise<RefreshResult> | null = null

async function refreshAccessToken(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async (): Promise<RefreshResult> => {
    const store = useAuthStore.getState()
    const refreshToken = store.session?.refreshToken
    if (!refreshToken || !store.session) return { token: null, unauthorized: true }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const unauthorized = res.status === 401 || res.status === 403
        if (unauthorized) {
          store.clearSession()
          queryClient.clear()
        }
        return { token: null, unauthorized }
      }
      const body = (await res.json()) as { accessToken?: string; refreshToken?: string; expiresAt?: number }
      if (!body.accessToken) return { token: null, unauthorized: true }
      useAuthStore.getState().updateSession({
        accessToken: body.accessToken,
        refreshToken: body.refreshToken ?? refreshToken,
        expiresAt: body.expiresAt,
      })
      return { token: body.accessToken, unauthorized: false }
    } catch {
      return { token: null, unauthorized: false }
    } finally {
      clearTimeout(timeout)
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  const access = useAuthStore.getState().session?.accessToken
  if (access) {
    headers.set('Authorization', `Bearer ${access}`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const upstreamSignal = init?.signal
  const onAbort = () => controller.abort()
  if (upstreamSignal?.aborted) {
    clearTimeout(timeout)
    controller.abort()
  } else {
    upstreamSignal?.addEventListener('abort', onAbort, { once: true })
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: controller.signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError' && !upstreamSignal?.aborted) {
      throw new ApiError(504, 'O servidor demorou para responder. Tente novamente em instantes.', {
        code: 'TIMEOUT',
      })
    }
    const local = !API_BASE || /localhost|127\.0\.0\.1/.test(API_BASE)
    throw new ApiError(
      0,
      local
        ? 'A API local não respondeu. Confira se o servidor em localhost:4000 está no ar.'
        : 'Não foi possível falar com o servidor.',
      { code: 'NETWORK_ERROR' },
    )
  } finally {
    clearTimeout(timeout)
    upstreamSignal?.removeEventListener('abort', onAbort)
  }

  if (res.status === 401 && !retried && !path.startsWith('/api/v1/auth/')) {
    const latestAccess = useAuthStore.getState().session?.accessToken
    if (latestAccess && latestAccess !== access) {
      return request<T>(path, init, true)
    }
    const renewed = await refreshAccessToken()
    if (renewed.token) return request<T>(path, init, true)
    if (renewed.unauthorized) {
      useAuthStore.getState().clearSession()
    }
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? ''
    const body = contentType.includes('application/json')
      ? ((await res.json().catch(() => ({}))) as {
        error?: { code?: string; message?: string; details?: unknown; revision?: number }
      })
      : {}
    const fallbackMessage =
      res.status >= 500
        ? 'O servidor encontrou um erro inesperado. Tente novamente em instantes.'
        : res.status === 401
          ? 'Sua sessão expirou. Entre novamente.'
          : res.status === 403
            ? 'Você não tem permissão para realizar esta ação.'
            : res.status === 404
              ? 'Registro não encontrado.'
              : res.status === 409
                ? 'Conflito de atualização. Recarregue e tente novamente.'
                : 'Não foi possível concluir a solicitação.'
    throw new ApiError(res.status, body.error?.message ?? fallbackMessage, {
      code: body.error?.code,
      details: body.error?.details ?? (body.error?.revision !== undefined ? { revision: body.error.revision } : undefined),
    })
  }
  if (res.status === 204) return undefined as T
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new ApiError(502, 'Resposta inesperada do servidor.', { code: 'INVALID_RESPONSE' })
  }
  const parsed = (await res.json()) as T & {
    error?: { code?: string; message?: string; details?: unknown }
  }
  if (res.status === 202 && parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error?.message) {
    throw new ApiError(202, parsed.error.message, {
      code: parsed.error.code,
      details: parsed.error.details,
    })
  }
  return parsed
}

export const api = {
  getActiveWallet: () =>
    request<{ gold: number; silver: number; copper: number }>('/api/v1/wallets/active'),
  getWalletLedger: () =>
    request<Array<{ id: string; kind: 'credit' | 'debit'; label: string; amount: string; at: string }>>(
      '/api/v1/wallets/ledger',
    ),
  getShopStock: (entityId: string) =>
    request<{ remaining: number | null; ownedByYou: number }>(
      `/api/v1/wallets/shop-stock/${encodeURIComponent(entityId)}`,
    ),
  buyShopItem: (body: { entityId: string; characterId?: string; sessionId?: string; quantity?: number; operationId?: string }) =>
    request<{ remaining: number | null; ownedByYou: number; itemName: string; replayed?: boolean }>('/api/v1/wallets/shop/buy', {
      method: 'POST',
      body: JSON.stringify({ ...body, operationId: body.operationId ?? crypto.randomUUID() }),
    }),
  getUnreadNotificationCount: () => request<{ count: number }>('/api/v1/notifications/unread-count'),
  getNotifications: () => request<import('../types/notifications').AppNotification[]>('/api/v1/notifications'),
  markNotificationsRead: (body: { ids?: string[]; all?: boolean }) =>
    request<{ count: number }>('/api/v1/notifications/mark-read', { method: 'POST', body: JSON.stringify(body) }),
  adminDownloadBackup: () => request<CampaignBackup>('/api/v1/admin/chronicle/backup'),
  adminDrillBackup: (backup: unknown) =>
    request<BackupReport>('/api/v1/admin/chronicle/backup/drill', { method: 'POST', body: JSON.stringify(backup) }),
  adminRestoreBackup: (backup: unknown) =>
    request<BackupReport>('/api/v1/admin/chronicle/backup/restore', {
      method: 'POST',
      body: JSON.stringify({ confirm: 'restaurar-copia', backup }),
    }),
  adminListBoard: () => request<BoardCard[]>('/api/v1/admin/chronicle/board'),
  adminAddBoardCard: (body: Omit<BoardCard, 'id'>) =>
    request<BoardCard>('/api/v1/admin/chronicle/board', { method: 'POST', body: JSON.stringify(body) }),
  adminRemoveBoardCard: (id: string) =>
    request<{ ok: true }>(`/api/v1/admin/chronicle/board/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminGetRules: () => request<CampaignRules>('/api/v1/admin/chronicle/rules'),
  adminValidateStorage: (paths?: string[]) =>
    request<{ total: number; reachable: number; needsManualCheck: number; missing: string[]; note: string }>(
      '/api/v1/admin/chronicle/backup/validate-storage',
      { method: 'POST', body: JSON.stringify(paths?.length ? { paths } : {}) },
    ),
  adminSessionOperations: (sessionId: string) =>
    request<Array<{ id: string; at: string; kind: string; summary: string; email: string }>>(
      `/api/v1/admin/chronicle/sessions/${encodeURIComponent(sessionId)}/operations`,
    ),
  adminImportEntities: (
    rows: unknown[],
    opts?: { fieldMap?: Record<string, string>; preview?: boolean },
  ) =>
    request<
      | { preview: true; create: number; duplicate: number; rejected: number; rejections: Array<{ line: number; message: string }> }
      | { imported: number; skipped: number }
    >(`/api/v1/admin/chronicle/entities/import${opts?.preview ? '?preview=1' : ''}`, {
      method: 'POST',
      body: JSON.stringify(opts?.fieldMap ? { rows, fieldMap: opts.fieldMap } : rows),
    }),
  adminSaveRules: (body: {
    maxLevel: number
    subclassLevel: number
    secondarySubclassLevel?: number
    startingXp?: number
    shopBudgetCopper?: number
    decision: 'keep-existing' | 'mark-review'
  }) =>
    request<{ rules: CampaignRules; affected: Array<{ name: string; reason: string }> }>('/api/v1/admin/chronicle/rules', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminListSecrets: () =>
    request<Array<{ id: string; sessionId: string; entityId: string; audienceEmail: string | null; text: string }>>(
      '/api/v1/admin/chronicle/secrets',
    ),
  adminAddSecret: (body: { sessionId: string; entityId: string; audienceEmail?: string | null; text: string }) =>
    request<{ id: string }>('/api/v1/admin/chronicle/secrets', { method: 'POST', body: JSON.stringify(body) }),
  adminAdvanceTurn: (sessionId: string) =>
    request<{ changed: number }>(`/api/v1/admin/chronicle/sessions/${encodeURIComponent(sessionId)}/advance-turn`, {
      method: 'POST',
    }),
  getSavedFilters: () =>
    request<{ shopCategory?: 'gear' | 'consumables' | 'services'; shopQuery?: string; archiveQuery?: string; archiveRarity?: string }>(
      '/api/v1/me/filters',
    ),
  saveFilters: (body: { shopCategory?: 'gear' | 'consumables' | 'services'; shopQuery?: string; archiveQuery?: string; archiveRarity?: string }) =>
    request<Record<string, string>>('/api/v1/me/filters', { method: 'PUT', body: JSON.stringify(body) }),
  adminListCharacterReviews: () =>
    request<
      Array<{
        email: string
        playerId?: string
        displayName: string
        characterId: string
        name: string
        level: number
        clan: string | null
        subclass?: string | null
        secondarySubclass?: string | null
        needsRuleReview?: boolean
        ruleReviewNote?: string | null
        sheetRevision?: number
        approval?: 'draft' | 'submitted' | 'changes' | 'approved'
        reviewNote: string | null
      }>
    >('/api/v1/admin/chronicle/character-reviews'),
  adminListCharacterRevisions: (email: string, characterId: string) =>
    request<
      Array<{
        id: string
        characterId: string
        profileEmail: string
        revision: number
        reason: string
        actorEmail: string
        createdAt: string
        snapshot: { level?: number; name?: string; sheetRevision?: number }
      }>
    >(
      `/api/v1/admin/chronicle/characters/${encodeURIComponent(email)}/${encodeURIComponent(characterId)}/revisions`,
    ),
  adminRestoreCharacterRevision: (
    email: string,
    characterId: string,
    body: { revisionId: string; dryRun?: boolean; confirm?: 'restaurar-revisao' },
  ) =>
    request(
      `/api/v1/admin/chronicle/characters/${encodeURIComponent(email)}/${encodeURIComponent(characterId)}/restore-revision`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  adminReviewCharacter: (
    email: string,
    characterId: string,
    body: { status: 'approved' | 'changes'; note?: string },
  ) =>
    request<import('../types/profile').ProfileCharacterSummary>(
      `/api/v1/admin/chronicle/characters/${encodeURIComponent(email)}/${encodeURIComponent(characterId)}/review`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  adminListNotices: () =>
    request<Array<{ id: string; title: string; message: string; createdAt: string }>>('/api/v1/notifications/sent'),
  adminSendNotice: (body: { title: string; message: string }) =>
    request<{ id: string; title: string; message: string; createdAt: string }>('/api/v1/notifications/send', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  joinSessionByCode: (code: string) =>
    request<{ sessionId: string }>('/api/v1/sessions/join-by-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),
  getCatalogClans: () => request<{ id: string; name: string; slug: string }[]>('/api/v1/catalog/clans'),
  listReferenceCatalog: (kind: string) =>
    request<ReferenceEntry[]>(`/api/v1/catalog/reference/${kind}`),
  adminListReference: (kind: string) => request<ReferenceEntry[]>(`/api/v1/admin/reference/${kind}`),
  adminSaveReference: (kind: string, rows: Array<Partial<ReferenceEntry> & { name: string }>) =>
    request<{ added: number; updated: number; skipped: number; items: ReferenceEntry[] }>(
      `/api/v1/admin/reference/${kind}`,
      {
        method: 'PUT',
        body: JSON.stringify(rows),
      },
    ),
  adminAddReference: (kind: string, row: Partial<ReferenceEntry> & { name: string }) =>
    request<ReferenceEntry>(`/api/v1/admin/reference/${kind}`, {
      method: 'POST',
      body: JSON.stringify(row),
    }),
  getCatalogSubclasses: (className: string) =>
    request<string[]>(`/api/v1/catalog/subclasses?class=${encodeURIComponent(className)}`),
  getCatalogCathedrals: (path?: 'luz' | 'trevas') =>
    request<
      Array<{
        id: string
        name: string
        faithPath: 'luz' | 'trevas'
        precepts: string[]
      }>
    >(`/api/v1/catalog/cathedrals${path ? `?path=${path}` : ''}`),
  login: (email: string, password: string) =>
    request<{
      accessToken: string
      refreshToken?: string
      expiresAt?: number
      userId: string
      email: string
      displayName: string
      role: string
    }>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  meProfile: () => request<import('../types/profile').UserProfile>('/api/v1/me/profile'),
  getRecoveryStatus: () =>
    request<{ supabaseAuthActive: boolean; externalEmailDeliveryConfirmed: boolean; note: string }>(
      '/api/v1/auth/recovery-status',
    ),
  requestPasswordRecovery: (email: string) =>
    request<{ message: string }>('/api/v1/auth/recover', { method: 'POST', body: JSON.stringify({ email }) }),
  confirmPasswordRecovery: (tokenOrHash: string, password: string, isTokenHash = false) =>
    request<{ message: string }>('/api/v1/auth/recover/confirm', {
      method: 'POST',
      body: JSON.stringify(
        isTokenHash ? { tokenHash: tokenOrHash, password } : { token: tokenOrHash, password },
      ),
    }),
  register: async (payload: Record<string, unknown>) => {
    return request<{
      accessToken: string
      refreshToken?: string
      expiresAt?: number
      userId: string
      email: string
      displayName: string
      role: string
    }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  getMeDashboard: () => request<DashboardPayload>('/api/v1/me/dashboard'),
  getMeProfile: () => request<import('../types/profile').UserProfile>('/api/v1/me/profile'),
  submitCharacter: (characterId: string) =>
    request<import('../types/profile').ProfileCharacterSummary>(`/api/v1/me/characters/${encodeURIComponent(characterId)}/submit`, {
      method: 'POST',
    }),
  listMyOperations: () =>
    request<Array<{ id: string; at: string; summary: string; kind: string }>>('/api/v1/me/operations'),
  rollAtSession: (sessionId: string, body: { formula: string; characterName?: string; secret?: boolean }) =>
    request<{ id: string; formula: string; total: number; dice: number[]; secret: boolean }>(
      `/api/v1/content/sessions/${encodeURIComponent(sessionId)}/rolls`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  listSessionRolls: (sessionId: string) =>
    request<Array<{ id: string; at: string; characterName: string; formula: string; total: number; secret: boolean }>>(
      `/api/v1/content/sessions/${encodeURIComponent(sessionId)}/rolls`,
    ),
  patchMeProfile: (body: { avatarUrl?: string | null; bannerUrl?: string | null }) =>
    request<import('../types/profile').UserProfile>('/api/v1/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  patchMePreferences: (body: Partial<import('../types/profile').UserProfile['preferences']>) =>
    request<import('../types/profile').UserProfile>('/api/v1/me/profile/preferences', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  patchMeAccount: (body: { displayName?: string; handle?: string }) =>
    request<import('../types/profile').UserProfile>('/api/v1/me/profile/account', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  getCharacterBalanceStats: (characterId: string) =>
    request<import('../types/profile').BalanceStatsResponse>(
      `/api/v1/me/characters/${encodeURIComponent(characterId)}/balance-stats`,
    ),
  patchMeCharacter: (
    characterId: string,
    body: {
      name?: string
      clan?: string
      faith?: string | null
      portraitUrl?: string | null
      isPrimary?: boolean
      showOnHome?: boolean
      hp?: { current: number; max: number }
      blood?: { current: number; max: number }
      mana?: { current: number; max: number }
      will?: { current: number; max: number }
      subclass?: string | null
      secondarySubclass?: string | null
      characterClass?: string | null
      expectedRevision?: number
      identityPatch?: Partial<{
        house: string | null
        nature: string | null
        demeanor: string | null
        concept: string | null
        residence: string | null
        sire: string | null
        ambition: string | null
        secretWeakness: string | null
        sireRelation: string | null
      }>
      inventory?: import('../types/profile').CharacterInventoryItem[]
      createdSkills?: import('../types/profile').CreatedSkill[]
      balanceStats?: Record<string, number> | null
    },
  ) =>
    request<import('../types/profile').ProfileCharacterSummary>(
      `/api/v1/me/characters/${encodeURIComponent(characterId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  adminListRegisteredPlayers: () =>
    request<
      Array<{
        id?: string
        publicId?: string
        email?: string
        displayName: string
        handle: string
        memberSince: string
        characters: number
      }>
    >('/api/v1/admin/chronicle/registered-players'),
  createCharacter: (body: {
    name: string
    species: string
    clan?: string
    level?: number
    isPrimary?: boolean
    hp: { current: number; max: number }
    blood?: { current: number; max: number }
    mana?: { current: number; max: number }
    will?: { current: number; max: number }
    startingXp?: number
    vitals?: { hpDie?: string; manaDie?: string; caDie?: string; caValue?: number; locked?: boolean }
    balanceStats?: Record<string, number>
    characterClass?: string | null
  }) =>
    request<{ id: string; name: string }>('/api/v1/me/characters', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  /** Somente ADM — jogador não concede XP a si mesmo. */
  adminAwardCharacterXp: (body: {
    sessionId: string
    participantDisplayName: string
    amount: number
    operationId?: string
  }) =>
    request<import('../types/profile').ProfileCharacterSummary>(
      `/api/v1/admin/chronicle/award-xp`,
      { method: 'POST', body: JSON.stringify({ ...body, operationId: body.operationId ?? crypto.randomUUID() }) },
    ),
  getSessionActions: (sessionId: string) =>
    request<import('../types/chronicle').SessionActionRecord[]>(
      `/api/v1/content/sessions/${encodeURIComponent(sessionId)}/actions`,
    ),
  postSessionAction: (
    sessionId: string,
    body: {
      characterId?: string
      characterName?: string
      kind: import('../types/chronicle').SessionActionRecord['kind']
      summary: string
      detail?: string
    },
  ) =>
    request<import('../types/chronicle').SessionActionRecord>(
      `/api/v1/content/sessions/${encodeURIComponent(sessionId)}/actions`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  adminGetSessionActions: (sessionId: string) =>
    request<import('../types/chronicle').SessionActionRecord[]>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/actions`,
    ),
  adminPatchMesaWhisper: (sessionId: string, narratorWhisper: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/handout/whisper`,
      { method: 'PATCH', body: JSON.stringify({ narratorWhisper }) },
    ),
  adminRotateSessionCode: (sessionId: string) =>
    request<{ accessCode: string; session: import('../types/chronicle').ScheduledSession }>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/rotate-code`,
      { method: 'POST' },
    ),
  getNews: () => request<NewsPost[]>('/api/v1/news'),

  adminListEntities: (kind: import('../types/chronicle').EntityKind) =>
    request<import('../types/chronicle').ChronicleEntity[]>(`/api/v1/admin/chronicle/entities?kind=${encodeURIComponent(kind)}`),
  adminCreateEntity: (body: import('../types/chronicle').CreateEntityPayload) =>
    request<import('../types/chronicle').ChronicleEntity>('/api/v1/admin/chronicle/entities', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminUpdateEntity: (id: string, body: Partial<import('../types/chronicle').CreateEntityPayload>) =>
    request<import('../types/chronicle').ChronicleEntity>(`/api/v1/admin/chronicle/entities/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminPublishEntity: (id: string) =>
    request<import('../types/chronicle').ChronicleEntity>(`/api/v1/admin/chronicle/entities/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
    }),
  adminDeleteEntity: (id: string) =>
    request<void>(`/api/v1/admin/chronicle/entities/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminOpenScheduledSession: (sessionId: string) =>
    request<import('../types/chronicle').ScheduledSession>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/open`,
      { method: 'POST' },
    ),
  adminCloseScheduledSession: (sessionId: string) =>
    request<import('../types/chronicle').ScheduledSession>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/close`,
      { method: 'POST' },
    ),
  adminDeleteScheduledSession: (sessionId: string) =>
    request<void>(`/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),
  adminRescheduleScheduledSession: (sessionId: string) =>
    request<import('../types/chronicle').ScheduledSession>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/reschedule`,
      { method: 'POST' },
    ),
  confirmSessionPresence: (sessionId: string) =>
    request<import('../types/chronicle').ScheduledSession>(`/api/v1/me/sessions/${encodeURIComponent(sessionId)}/presence`, {
      method: 'POST',
    }),
  joinSessionWithCode: (sessionId: string, body: { accessCode: string; characterId: string }) =>
    request<import('../types/chronicle').ScheduledSession>(`/api/v1/me/sessions/${encodeURIComponent(sessionId)}/join`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  leaveSession: (sessionId: string) =>
    request<import('../types/chronicle').ScheduledSession>(`/api/v1/me/sessions/${encodeURIComponent(sessionId)}/leave`, {
      method: 'POST',
    }),
  replaceSessionCharacter: (sessionId: string, characterId: string) =>
    request<import('../types/chronicle').ScheduledSession>(
      `/api/v1/me/sessions/${encodeURIComponent(sessionId)}/replace-character`,
      { method: 'POST', body: JSON.stringify({ characterId }) },
    ),
  adminListHandouts: () => request<import('../types/chronicle').SessionHandout[]>('/api/v1/admin/chronicle/handouts'),
  adminCreateHandout: (body: Omit<import('../types/chronicle').SessionHandout, 'id' | 'createdAt' | 'status' | 'publishedToPlayers' | 'closedAt'>) =>
    request<import('../types/chronicle').SessionHandout>('/api/v1/admin/chronicle/handouts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminPatchHandout: (id: string, body: Partial<import('../types/chronicle').SessionHandout>) =>
    request<import('../types/chronicle').SessionHandout>(`/api/v1/admin/chronicle/handouts/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminListScheduledSessions: () =>
    request<import('../types/chronicle').ScheduledSession[]>('/api/v1/admin/chronicle/scheduled-sessions'),
  adminListLiveMesas: () =>
    request<import('../types/chronicle').LiveMesaSummary[]>('/api/v1/admin/chronicle/live-mesas'),
  adminJoinCoNarrator: (sessionId: string, accessCode = '') =>
    request<import('../types/chronicle').ScheduledSession>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/join-co-narrator`,
      { method: 'POST', body: JSON.stringify({ accessCode }) },
    ),
  adminCreateScheduledSession: (body: {
    title: string
    scheduledAt: string
    chronicleName?: string
    tableMeta?: import('../types/chronicle').SessionTableMeta
    listing?: 'public' | 'private'
    allowCoNarrator?: boolean
  }) =>
    request<import('../types/chronicle').ScheduledSession>('/api/v1/admin/chronicle/scheduled-sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminPatchScheduledSession: (
    sessionId: string,
    body: Partial<{
      title: string
      chronicleName: string
      tableMeta: import('../types/chronicle').SessionTableMeta
      listing: 'public' | 'private'
      allowCoNarrator: boolean
    }>,
  ) =>
    request<import('../types/chronicle').ScheduledSession>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  adminGetMesaHandout: (sessionId: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/handout`,
    ),
  adminPatchMesaHandoutNarrative: (sessionId: string, narrativeSummary: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/handout/narrative`,
      { method: 'PATCH', body: JSON.stringify({ narrativeSummary }) },
    ),
  adminAddSceneThreat: (sessionId: string, entityId: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/scene-threats`,
      { method: 'POST', body: JSON.stringify({ entityId }) },
    ),
  adminApplySceneThreatDelta: (
    sessionId: string,
    threatId: string,
    body: { hpDelta?: number; manaDelta?: number },
  ) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/scene-threats/${encodeURIComponent(threatId)}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  adminRemoveSceneThreat: (sessionId: string, threatId: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/scene-threats/${encodeURIComponent(threatId)}`,
      { method: 'DELETE' },
    ),
  adminAddSceneNpc: (sessionId: string, entityId: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/scene-npcs`,
      { method: 'POST', body: JSON.stringify({ entityId }) },
    ),
  adminRemoveSceneNpc: (sessionId: string, npcId: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/scene-npcs/${encodeURIComponent(npcId)}`,
      { method: 'DELETE' },
    ),
  adminPatchMesaAmbience: (
    sessionId: string,
    body: Partial<import('../types/chronicle').ChronicleAmbience>,
  ) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/handout/ambience`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  adminSetMesaRestMode: (sessionId: string, restMode: boolean) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${encodeURIComponent(sessionId)}/handout/rest-mode`,
      { method: 'PATCH', body: JSON.stringify({ restMode }) },
    ),
  adminSessionLineSeries: () => request<{ label: string; count: number }[]>('/api/v1/admin/chronicle/analytics/session-line'),
  adminPlayerCharacterSeries: () =>
    request<{ label: string; count: number }[]>('/api/v1/admin/chronicle/analytics/player-characters'),
  adminMesaActivityStats: () =>
    request<{
      openMesas: number
      day: { hoursActive: number; sessionsMarked: number; actsClosed: number }
      week: { hoursActive: number; sessionsMarked: number; actsClosed: number }
      month: { hoursActive: number; sessionsMarked: number; actsClosed: number }
    }>('/api/v1/admin/chronicle/analytics/mesa-activity'),

  getArchiveContent: (category: 'chronicles' | 'relics' | 'rituals') =>
    request<import('../types/chronicle').ChronicleEntity[]>(`/api/v1/content/archive?category=${category}`),
  getShopContent: (category: 'gear' | 'consumables' | 'services', sessionId?: string) =>
    request<import('../types/chronicle').ChronicleEntity[]>(
      `/api/v1/content/shop?category=${category}${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`,
    ),
  getBestiaryContent: (tier: 'known' | 'classified' | 'rumors', sessionId?: string) =>
    request<import('../types/chronicle').ChronicleEntity[]>(
      `/api/v1/content/bestiary?tier=${tier}${sessionId ? `&sessionId=${encodeURIComponent(sessionId)}` : ''}`,
    ),
  getDownloadsContent: (category: 'rules' | 'sheets' | 'handouts') =>
    request<{ files: import('../types/chronicle').ChronicleEntity[]; handouts: import('../types/chronicle').SessionHandout[] }>(
      `/api/v1/content/downloads?category=${category}`,
    ),
  getScheduledSessions: () =>
    request<import('../types/chronicle').ScheduledSession[]>('/api/v1/content/scheduled-sessions'),
  getSessionLiveState: (sessionId: string) =>
    request<{
      threats: import('../types/chronicle').SceneThreat[]
      liveBrief: {
        narrativeSummary: string
        restMode: boolean
        chronicleAmbience: import('../types/chronicle').ChronicleAmbience
        sceneNpcs: Array<{ id: string; name: string; description: string }>
      } | null
      myBag: { rewards: import('../types/chronicle').HandoutReward[] }
      actions: import('../types/chronicle').SessionActionRecord[]
      rolls: Array<{ id: string; at: string; characterName: string; formula: string; total: number; secret: boolean }>
    }>(`/api/v1/content/sessions/${encodeURIComponent(sessionId)}/live-state`),
  getSessionSceneThreats: (sessionId: string) =>
    request<import('../types/chronicle').SceneThreat[]>(`/api/v1/content/sessions/${encodeURIComponent(sessionId)}/scene-threats`),
  getSessionLiveBrief: (sessionId: string) =>
    request<{
      narrativeSummary: string
      restMode: boolean
      chronicleAmbience: import('../types/chronicle').ChronicleAmbience
      sceneNpcs: Array<{ id: string; name: string; description: string }>
    }>(`/api/v1/content/sessions/${encodeURIComponent(sessionId)}/live-brief`),
  getSessionMyBag: (sessionId: string) =>
    request<{ rewards: import('../types/chronicle').HandoutReward[] }>(
      `/api/v1/content/sessions/${encodeURIComponent(sessionId)}/my-bag`,
    ),
  getSessionActSummary: (sessionId: string) =>
    request<{
      sessionId: string
      chronicleName: string
      narrativeSummary: string
      closedAt?: string
      published: boolean
    }>(`/api/v1/content/sessions/${encodeURIComponent(sessionId)}/act-summary`),
  getSessionActCanon: (sessionId: string) =>
    request<{
      sessionId: string
      chronicleName: string
      narrativeSummary: string
      closedAt?: string
      published: boolean
      missions: import('../types/chronicle').SessionHandout['missions']
      monstersSlain: import('../types/chronicle').SessionHandout['monstersSlain']
      participants: Array<{ displayName: string; characterName: string }>
    }>(`/api/v1/content/sessions/${encodeURIComponent(sessionId)}/act-canon`),

  getAchievementMural: () =>
    request<
      Array<{
        id: string
        title: string
        description: string
        howToEarn: string
        unlocked: boolean
        unlockedAt: string | null
      }>
    >('/api/v1/court/achievements'),
  getFriends: () =>
    request<{
      friends: Array<{ id?: string; email?: string; displayName: string; handle: string; role?: string; characters: number }>
      incoming: Array<{ id: string; createdAt: string; from: { id?: string; email?: string; displayName: string; handle: string; role?: string; characters?: number } }>
      outgoing?: Array<{ id: string; createdAt: string; to: { id?: string; email?: string; displayName: string; handle: string; role?: string; characters?: number } }>
    }>('/api/v1/court/friends'),
  searchCourtPlayers: (q: string) =>
    request<
      Array<{
        id: string
        email?: string
        displayName: string
        handle: string
        role?: string
        characters: number
        relation: 'none' | 'friend' | 'outgoing' | 'incoming'
        linkId: string | null
      }>
    >(`/api/v1/court/players?q=${encodeURIComponent(q)}`),
  requestFriend: (target: string) =>
    request('/api/v1/court/friends', {
      method: 'POST',
      body: JSON.stringify(target.includes('@') ? { email: target } : { playerId: target }),
    }),
  acceptFriend: (linkId: string) =>
    request(`/api/v1/court/friends/${encodeURIComponent(linkId)}/accept`, { method: 'POST' }),
  removeFriend: (id: string) =>
    request(`/api/v1/court/friends/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getSessionBoard: (q: string) =>
    request<{
      publicTables: SessionBoardCard[]
      friendTables: SessionBoardCard[]
    }>(`/api/v1/court/session-board?q=${encodeURIComponent(q)}`),
  getFerreiro: (sessionId: string, characterId?: string) =>
    request<FerreiroPayload>(
      `/api/v1/court/sessions/${encodeURIComponent(sessionId)}/ferreiro${characterId ? `?characterId=${encodeURIComponent(characterId)}` : ''}`,
    ),
  bidAuction: (auctionId: string, body: { amount: number; coin: CoinCode; characterId?: string }) =>
    request(`/api/v1/court/auctions/${encodeURIComponent(auctionId)}/bid`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  withdrawAuction: (auctionId: string) =>
    request(`/api/v1/court/auctions/${encodeURIComponent(auctionId)}/withdraw`, { method: 'POST' }),
  adminListAchievements: () =>
    request<Array<{ id: string; title: string; description: string; howToEarn: string }>>(
      '/api/v1/court/admin/achievements',
    ),
  adminCreateAchievement: (body: { title: string; description: string; howToEarn: string }) =>
    request('/api/v1/court/admin/achievements', { method: 'POST', body: JSON.stringify(body) }),
  adminDeleteAchievement: (id: string) =>
    request(`/api/v1/court/admin/achievements/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminGrantAchievement: (id: string, target: string) =>
    request(`/api/v1/court/admin/achievements/${encodeURIComponent(id)}/grant`, {
      method: 'POST',
      body: JSON.stringify(target.includes('@') ? { email: target } : { playerId: target }),
    }),
  adminCourtPlayers: () =>
    request<{
      registeredCount: number
      friends: Array<{ id?: string; email?: string; displayName: string; handle: string; characters: number; memberSince: string | null }>
      incoming: Array<{ id: string; createdAt: string; from: { id?: string; email?: string; displayName: string; handle: string; characters: number } }>
      outgoing: Array<{ id: string; createdAt: string; to: { id?: string; email?: string; displayName: string; handle: string; characters: number } }>
      roster: Array<{
        id: string
        email?: string
        displayName: string
        handle: string
        role?: string
        characters: number
        memberSince: string | null
        relation: 'none' | 'friend' | 'outgoing' | 'incoming'
        linkId: string | null
      }>
    }>('/api/v1/court/admin/players'),
  adminAddFriend: (target: string) =>
    request('/api/v1/court/admin/friends', {
      method: 'POST',
      body: JSON.stringify(target.includes('@') ? { email: target } : { playerId: target }),
    }),
  adminRemoveFriend: (idOrEmail: string) =>
    request(`/api/v1/court/admin/friends/${encodeURIComponent(idOrEmail)}`, { method: 'DELETE' }),
  adminGrantCoins: (body: {
    sessionId: string
    participantDisplayName: string
    coin: CoinCode
    amount: number
    operationId?: string
  }) =>
    request('/api/v1/court/admin/grant-coins', {
      method: 'POST',
      body: JSON.stringify({ ...body, operationId: body.operationId ?? crypto.randomUUID() }),
    }),
  adminShopLevels: () => request<Record<string, number>>('/api/v1/court/admin/shop-levels'),
  adminSetShopLevel: (entityId: string, requiredLevel: number) =>
    request(`/api/v1/court/admin/shop-levels/${encodeURIComponent(entityId)}`, {
      method: 'PUT',
      body: JSON.stringify({ requiredLevel }),
    }),
  adminListAuctions: (sessionId: string) =>
    request<AuctionCard[]>(`/api/v1/court/admin/sessions/${encodeURIComponent(sessionId)}/auctions`),
  adminReleaseAuction: (
    sessionId: string,
    body: {
      entityId: string
      requiredLevel: number
      minutes: number
      npcName?: string
      npcAmount?: number
      npcCoin?: CoinCode
    },
  ) =>
    request(`/api/v1/court/admin/sessions/${encodeURIComponent(sessionId)}/auctions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminNpcBid: (auctionId: string, body: { displayName: string; amount: number; coin: CoinCode }) =>
    request(`/api/v1/court/admin/auctions/${encodeURIComponent(auctionId)}/npc-bid`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminCloseAuction: (auctionId: string) =>
    request(`/api/v1/court/admin/auctions/${encodeURIComponent(auctionId)}/close`, { method: 'POST' }),
}

export type CoinCode = 'gold' | 'silver' | 'copper'

export type SessionBoardCard = {
  id: string
  title: string
  scheduledAt: string
  status: 'scheduled' | 'open' | 'closed'
  listing: 'public' | 'private'
  narratorName: string
  seatedNames: string[]
}

export type AuctionCard = {
  id: string
  sessionId: string
  itemName: string
  requiredLevel: number
  endsAt: string
  status: 'open' | 'awarded' | 'cancelled'
  winnerLabel: string | null
  bids: Array<{
    id: string
    displayName: string
    amount: number
    coin: CoinCode
    npc: boolean
    withdrawn: boolean
  }>
  leading: { displayName: string; amount: number; coin: CoinCode; npc: boolean } | null
}

export type FerreiroPayload = {
  level: number
  commerce: Array<{
    id: string
    name: string
    description: string
    shopCategory?: string
    rarity: string
    priceGold: number
    priceSilver: number
    priceCopper: number
    requiredLevel: number
  }>
  auctions: AuctionCard[]
}

export type NewsPost = {
  id: string
  title: string
  excerpt: string
  slug: string
  publishedAt: string
}

export type DashboardPayload = {
  activeChronicle?: { name: string; act: string } | null
  nextSession?: { id: string; title: string; scheduledAt: string; status?: string } | null
  characters: Array<{
    id: string
    name: string
    species: string
    clan?: string
    level?: number
    subclass?: string | null
    secondarySubclass?: string | null
    needsRuleReview?: boolean
    selected?: boolean
    hp: { current: number; max: number }
    blood?: { current: number; max: number }
    will: { current: number; max: number }
    xp: { current: number; max: number }
  }>
}
