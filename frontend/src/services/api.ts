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

async function refreshAccessToken() {
  const raw = localStorage.getItem('beladona-auth')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as {
      state?: { session?: { refreshToken?: string; accessToken?: string; expiresAt?: number } }
    }
    const refreshToken = parsed.state?.session?.refreshToken
    if (!refreshToken || !parsed.state?.session) return null
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { accessToken?: string; refreshToken?: string; expiresAt?: number }
    if (!body.accessToken) return null
    parsed.state.session = {
      ...parsed.state.session,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken ?? refreshToken,
      expiresAt: body.expiresAt,
    }
    localStorage.setItem('beladona-auth', JSON.stringify(parsed))
    return body.accessToken
  } catch {
    return null
  }
}

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }

  const token = localStorage.getItem('beladona-auth')
  if (token) {
    try {
      const parsed = JSON.parse(token) as { state?: { session?: { accessToken?: string } } }
      const access = parsed.state?.session?.accessToken
      if (access) headers.set('Authorization', `Bearer ${access}`)
    } catch {
      /* ignore */
    }
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch {
    const local = !API_BASE || /localhost|127\.0\.0\.1/.test(API_BASE)
    throw new Error(
      local
        ? 'A API local não respondeu. Confira se o servidor em localhost:4000 está no ar.'
        : 'Não foi possível falar com o servidor.',
    )
  }
  if (res.status === 401 && !retried && !path.startsWith('/api/v1/auth/')) {
    const renewed = await refreshAccessToken()
    if (renewed) return request<T>(path, init, true)
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
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
        displayName: string
        characterId: string
        name: string
        level: number
        clan: string | null
        approval?: 'draft' | 'submitted' | 'changes' | 'approved'
        reviewNote: string | null
      }>
    >('/api/v1/admin/chronicle/character-reviews'),
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
  requestPasswordRecovery: (email: string) =>
    request<{ message: string }>('/api/v1/auth/recover', { method: 'POST', body: JSON.stringify({ email }) }),
  confirmPasswordRecovery: (token: string, password: string) =>
    request<{ message: string }>('/api/v1/auth/recover/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
  register: async (payload: Record<string, unknown>) => {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    const token = localStorage.getItem('beladona-auth')
    if (token) {
      try {
        const parsed = JSON.parse(token) as { state?: { session?: { accessToken?: string } } }
        const access = parsed.state?.session?.accessToken
        if (access) headers.set('Authorization', `Bearer ${access}`)
      } catch {
        /* ignore */
      }
    }
    const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })
    const body = (await res.json().catch(() => ({}))) as {
      accessToken?: string
      userId?: string
      email?: string
      displayName?: string
      role?: string
      error?: { message?: string }
    }
    if (res.status === 202 || (body.error && !body.accessToken)) {
      throw new Error(body.error?.message ?? 'Não foi possível concluir o cadastro.')
    }
    if (!res.ok) {
      throw new Error(body.error?.message ?? res.statusText)
    }
    return body as { accessToken: string; userId: string; email: string; displayName: string; role: string }
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
  patchMeAccount: (body: { displayName: string }) =>
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
      characterClass?: string | null
      identityPatch?: Partial<{
        house: string | null
        nature: string | null
        demeanor: string | null
        concept: string | null
        residence: string | null
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
        email: string
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
  }) =>
    request<import('../types/profile').ProfileCharacterSummary>(
      `/api/v1/admin/chronicle/award-xp`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  getNews: () => request<NewsPost[]>('/api/v1/news'),

  adminListEntities: (kind: import('../types/chronicle').EntityKind) =>
    request<import('../types/chronicle').ChronicleEntity[]>(`/api/v1/admin/chronicle/entities?kind=${kind}`),
  adminCreateEntity: (body: import('../types/chronicle').CreateEntityPayload) =>
    request<import('../types/chronicle').ChronicleEntity>('/api/v1/admin/chronicle/entities', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminUpdateEntity: (id: string, body: Partial<import('../types/chronicle').CreateEntityPayload>) =>
    request<import('../types/chronicle').ChronicleEntity>(`/api/v1/admin/chronicle/entities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminPublishEntity: (id: string) =>
    request<import('../types/chronicle').ChronicleEntity>(`/api/v1/admin/chronicle/entities/${id}/publish`, {
      method: 'POST',
    }),
  adminDeleteEntity: (id: string) =>
    request<void>(`/api/v1/admin/chronicle/entities/${id}`, { method: 'DELETE' }),
  adminOpenScheduledSession: (sessionId: string) =>
    request<import('../types/chronicle').ScheduledSession>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/open`,
      { method: 'POST' },
    ),
  adminCloseScheduledSession: (sessionId: string) =>
    request<import('../types/chronicle').ScheduledSession>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/close`,
      { method: 'POST' },
    ),
  adminDeleteScheduledSession: (sessionId: string) =>
    request<void>(`/api/v1/admin/chronicle/scheduled-sessions/${sessionId}`, { method: 'DELETE' }),
  adminRescheduleScheduledSession: (sessionId: string) =>
    request<import('../types/chronicle').ScheduledSession>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/reschedule`,
      { method: 'POST' },
    ),
  confirmSessionPresence: (sessionId: string) =>
    request<import('../types/chronicle').ScheduledSession>(`/api/v1/me/sessions/${sessionId}/presence`, {
      method: 'POST',
    }),
  joinSessionWithCode: (sessionId: string, body: { accessCode: string; characterId: string }) =>
    request<import('../types/chronicle').ScheduledSession>(`/api/v1/me/sessions/${sessionId}/join`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  leaveSession: (sessionId: string) =>
    request<import('../types/chronicle').ScheduledSession>(`/api/v1/me/sessions/${sessionId}/leave`, {
      method: 'POST',
    }),
  replaceSessionCharacter: (sessionId: string, characterId: string) =>
    request<import('../types/chronicle').ScheduledSession>(
      `/api/v1/me/sessions/${sessionId}/replace-character`,
      { method: 'POST', body: JSON.stringify({ characterId }) },
    ),
  adminListHandouts: () => request<import('../types/chronicle').SessionHandout[]>('/api/v1/admin/chronicle/handouts'),
  adminCreateHandout: (body: Omit<import('../types/chronicle').SessionHandout, 'id' | 'createdAt' | 'status' | 'publishedToPlayers' | 'closedAt'>) =>
    request<import('../types/chronicle').SessionHandout>('/api/v1/admin/chronicle/handouts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  adminPatchHandout: (id: string, body: Partial<import('../types/chronicle').SessionHandout>) =>
    request<import('../types/chronicle').SessionHandout>(`/api/v1/admin/chronicle/handouts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  adminListScheduledSessions: () =>
    request<import('../types/chronicle').ScheduledSession[]>('/api/v1/admin/chronicle/scheduled-sessions'),
  adminCreateScheduledSession: (body: {
    title: string
    scheduledAt: string
    chronicleName?: string
    tableMeta?: import('../types/chronicle').SessionTableMeta
    listing?: 'public' | 'private'
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
    }>,
  ) =>
    request<import('../types/chronicle').ScheduledSession>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  adminGetMesaHandout: (sessionId: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/handout`,
    ),
  adminPatchMesaHandoutNarrative: (sessionId: string, narrativeSummary: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/handout/narrative`,
      { method: 'PATCH', body: JSON.stringify({ narrativeSummary }) },
    ),
  adminAddSceneThreat: (sessionId: string, entityId: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/scene-threats`,
      { method: 'POST', body: JSON.stringify({ entityId }) },
    ),
  adminApplySceneThreatDelta: (
    sessionId: string,
    threatId: string,
    body: { hpDelta?: number; manaDelta?: number },
  ) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/scene-threats/${threatId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  adminRemoveSceneThreat: (sessionId: string, threatId: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/scene-threats/${threatId}`,
      { method: 'DELETE' },
    ),
  adminAddSceneNpc: (sessionId: string, entityId: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/scene-npcs`,
      { method: 'POST', body: JSON.stringify({ entityId }) },
    ),
  adminRemoveSceneNpc: (sessionId: string, npcId: string) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/scene-npcs/${npcId}`,
      { method: 'DELETE' },
    ),
  adminPatchMesaAmbience: (
    sessionId: string,
    body: Partial<import('../types/chronicle').ChronicleAmbience>,
  ) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/handout/ambience`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  adminSetMesaRestMode: (sessionId: string, restMode: boolean) =>
    request<import('../types/chronicle').SessionHandout>(
      `/api/v1/admin/chronicle/scheduled-sessions/${sessionId}/handout/rest-mode`,
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
  getSessionSceneThreats: (sessionId: string) =>
    request<import('../types/chronicle').SceneThreat[]>(`/api/v1/content/sessions/${sessionId}/scene-threats`),
  getSessionLiveBrief: (sessionId: string) =>
    request<{
      narrativeSummary: string
      restMode: boolean
      chronicleAmbience: import('../types/chronicle').ChronicleAmbience
      sceneNpcs: Array<{ id: string; name: string; description: string }>
    }>(`/api/v1/content/sessions/${sessionId}/live-brief`),
  getSessionMyBag: (sessionId: string) =>
    request<{ rewards: import('../types/chronicle').HandoutReward[] }>(
      `/api/v1/content/sessions/${sessionId}/my-bag`,
    ),
  getSessionActSummary: (sessionId: string) =>
    request<{
      sessionId: string
      chronicleName: string
      narrativeSummary: string
      closedAt?: string
      published: boolean
    }>(`/api/v1/content/sessions/${sessionId}/act-summary`),
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
    }>(`/api/v1/content/sessions/${sessionId}/act-canon`),

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
      friends: Array<{ email: string; displayName: string; handle: string; characters: number }>
      incoming: Array<{ id: string; createdAt: string; from: { email: string; displayName: string; handle: string } }>
    }>('/api/v1/court/friends'),
  searchCourtPlayers: (q: string) =>
    request<
      Array<{
        email: string
        displayName: string
        handle: string
        characters: number
        relation: 'none' | 'friend' | 'outgoing' | 'incoming'
        linkId: string | null
      }>
    >(`/api/v1/court/players?q=${encodeURIComponent(q)}`),
  requestFriend: (email: string) =>
    request('/api/v1/court/friends', { method: 'POST', body: JSON.stringify({ email }) }),
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
  adminGrantAchievement: (id: string, email: string) =>
    request(`/api/v1/court/admin/achievements/${encodeURIComponent(id)}/grant`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  adminCourtPlayers: () =>
    request<{
      registeredCount: number
      friends: Array<{ email: string; displayName: string; handle: string; characters: number; memberSince: string | null }>
      incoming: Array<{ id: string; createdAt: string; from: { email: string; displayName: string; handle: string; characters: number } }>
      outgoing: Array<{ id: string; createdAt: string; to: { email: string; displayName: string; handle: string; characters: number } }>
      roster: Array<{
        email: string
        displayName: string
        handle: string
        characters: number
        memberSince: string | null
        relation: 'none' | 'friend' | 'outgoing' | 'incoming'
        linkId: string | null
      }>
    }>('/api/v1/court/admin/players'),
  adminAddFriend: (email: string) =>
    request('/api/v1/court/admin/friends', { method: 'POST', body: JSON.stringify({ email }) }),
  adminRemoveFriend: (email: string) =>
    request(`/api/v1/court/admin/friends/${encodeURIComponent(email)}`, { method: 'DELETE' }),
  adminGrantCoins: (body: { sessionId: string; participantDisplayName: string; coin: CoinCode; amount: number }) =>
    request('/api/v1/court/admin/grant-coins', { method: 'POST', body: JSON.stringify(body) }),
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
  activeChronicle?: { name: string; act: string }
  nextSession?: { id: string; title: string; scheduledAt: string }
  characters: Array<{
    id: string
    name: string
    species: string
    clan?: string
    selected?: boolean
    hp: { current: number; max: number }
    blood?: { current: number; max: number }
    will: { current: number; max: number }
    xp: { current: number; max: number }
  }>
}
