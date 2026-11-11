const API_BASE = import.meta.env.VITE_API_URL ?? ''

export type ReferenceEntry = {
  id: string
  kind: string
  name: string
  description: string
  className: string
  faithPath: '' | 'luz' | 'trevas'
  sortOrder: number
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
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
  buyShopItem: (body: { entityId: string; characterId?: string; quantity?: number }) =>
    request<{ remaining: number | null; ownedByYou: number; itemName: string }>('/api/v1/wallets/shop/buy', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getUnreadNotificationCount: () => request<{ count: number }>('/api/v1/notifications/unread-count'),
  getNotifications: () => request<import('../types/notifications').AppNotification[]>('/api/v1/notifications'),
  markNotificationsRead: (body: { ids?: string[]; all?: boolean }) =>
    request<{ count: number }>('/api/v1/notifications/mark-read', { method: 'POST', body: JSON.stringify(body) }),
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
    request<{ accessToken: string; userId: string; email: string; displayName: string; role: string }>(
      '/api/v1/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
    ),
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
    vitals?: { hpDie?: string; manaDie?: string; locked?: boolean }
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
  getShopContent: (category: 'gear' | 'consumables' | 'services') =>
    request<import('../types/chronicle').ChronicleEntity[]>(`/api/v1/content/shop?category=${category}`),
  getBestiaryContent: (tier: 'known' | 'classified' | 'rumors') =>
    request<import('../types/chronicle').ChronicleEntity[]>(`/api/v1/content/bestiary?tier=${tier}`),
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
