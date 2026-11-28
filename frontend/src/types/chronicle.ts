export type EntityKind = 'npc' | 'monster' | 'equipment' | 'consumable' | 'archive' | 'download'

export type AttributeMod = {
  attr: string
  value: number
}

export type ChronicleEntity = {
  id: string
  kind: EntityKind
  name: string
  description: string
  visibility: 'draft' | 'published'
  archiveCategory?: 'chronicles' | 'relics' | 'rituals'
  shopCategory?: 'gear' | 'consumables' | 'services'
  downloadCategory?: 'rules' | 'sheets' | 'handouts'
  clan?: string
  bestiaryTier?: 'known' | 'classified' | 'rumors'
  /** Glossário: grimório | amuleto | relíquia | monstro */
  classification?: 'grimoire' | 'amulet' | 'relic' | 'monster'
  creatureType?: string
  threatLevel?: 'inofensivo' | 'comum' | 'perigoso' | 'letal' | 'cataclismico'
  rarity?: 'comum' | 'incomum' | 'raro' | 'ancestral' | 'proibido'
  weightKg?: number
  imageUrl?: string
  hpMax?: number
  manaMax?: number
  defense?: number
  abilities?: string[]
  lifeStatus?: 'alive' | 'dead'
  location?: string
  attributeMods?: AttributeMod[]
  relicAmuletType?: string
  magicType?: string
  cooldownText?: string
  equipmentType?: string
  serviceType?: string
  consumableKind?: 'daily' | 'food'
  stockTotal?: number
  statsText?: string
  priceGold?: number
  priceSilver?: number
  priceCopper?: number
  fileName?: string
  fileUrl?: string
  creatureSize?: string
  creatureSpeed?: string
  creatureSenses?: string
  defenseNote?: string
  primaryAttackName?: string
  primaryAttackDesc?: string
  secondaryAttackName?: string
  secondaryAttackDesc?: string
  sceneTrigger?: string
  narratorNotes?: string
  chronicleScope?: string | null
  narratorScope?: string | null
  revealed?: string[]
  creatureStats?: { for: number; des: number; vig: number; int: number; sab: number; car: number }
  passiveTraits?: string[]
  createdAt: string
  updatedAt: string
}

export type SessionHandout = {
  id: string
  title: string
  status: 'pending_close' | 'closed'
  narrativeSummary: string
  narratorWhisper?: string
  scheduledSessionId?: string
  chronicleName?: string
  npcIds: string[]
  monstersSlain: Array<{ entityId: string; name: string; statsText?: string }>
  participants: Array<{
    displayName: string
    characterName: string
    rewards: Array<{
      type: 'equipment' | 'consumable' | 'currency' | 'xp'
      label: string
      entityId?: string
      gold?: number
      silver?: number
      xp?: number
    }>
  }>
  missions: Array<{ title: string; priority: 'baixa' | 'media' | 'alta' }>
  sceneThreats?: SceneThreat[]
  sceneNpcs?: SceneNpc[]
  chronicleAmbience?: ChronicleAmbience
  restMode?: boolean
  publishedToPlayers: boolean
  createdAt: string
  closedAt?: string
}

export type SessionPresence = {
  email?: string
  displayName: string
  confirmedAt: string
  isMe?: boolean
}

export type SessionSeat = {
  email?: string
  displayName: string
  characterId: string
  characterName: string
  joinedAt: string
  leftAt?: string
  isMe?: boolean
}

export type SessionActionRecord = {
  id: string
  sessionId: string
  actorName: string
  characterId?: string
  kind: 'declaration' | 'skill' | 'damage' | 'potion' | 'turn_end' | 'round_end' | 'system'
  summary: string
  detail?: string
  createdAt: string
}

/** Metadados exibidos na ficha da mesa (tabela RPG / campanha / arco…). */
export type SessionTableMeta = {
  rpgTitle: string
  campaignName: string
  sessionLabel: string
  arcTitle: string
  missionTitle: string
  playerGroup: string
  targetDuration: string
  recommendedLevels: string
  /** 1, 1.5, 2… para numeração automática da sessão na campanha */
  sessionOrdinal?: number
}

export type ScheduledSession = {
  id: string
  title: string
  scheduledAt: string
  chronicleName?: string
  narratorEmail?: string
  narratorName?: string
  allowCoNarrator?: boolean
  coNarratorEmails?: string[]
  mySeat?: SessionSeat | null
  myPresenceConfirmed?: boolean
  hasConfirmedPresence?: boolean
  scheduledTimeReached?: boolean
  canEnterLive?: boolean
  tableMeta?: SessionTableMeta
  /** Senha/código da mesa gerado na criação. Vazio na lista do jogador. */
  accessCode?: string
  accessCodeRotatedAt?: string
  listing?: 'public' | 'private'
  status: 'scheduled' | 'open' | 'closed'
  startedAt?: string
  endedAt?: string
  lastOpenedAt?: string
  /** Duração acumulada com a mesa aberta (ms). */
  activeDurationMs: number
  presence: SessionPresence[]
  seats: SessionSeat[]
  createdAt: string
}

export type LiveMesaSummary = {
  id: string
  title: string
  chronicleName?: string
  scheduledAt: string
  listing: 'public' | 'private'
  status: 'scheduled' | 'open' | 'closed'
  narratorName: string
  isOwner: boolean
  isCoNarrator: boolean
  allowCoNarrator: boolean
  isSeated: boolean
  hasConfirmedPresence?: boolean
  scheduledTimeReached?: boolean
  canEnterLive?: boolean
  seatedCount: number
  presenceCount: number
}

export type SceneThreat = {
  id: string
  entityId: string
  name: string
  hpCurrent: number
  hpMax: number
  manaCurrent: number
  manaMax: number
}

export type SceneNpc = {
  id: string
  entityId: string
  name: string
  description: string
}

export type ChronicleAmbience = {
  environment: string
  climate: string
  moon: string
  atmosphere: string
}

export type HandoutReward = {
  type: 'equipment' | 'consumable' | 'currency' | 'xp'
  label: string
  entityId?: string
  gold?: number
  silver?: number
  xp?: number
}

export type CreateEntityPayload = {
  kind: EntityKind
  name: string
  description?: string
  archiveCategory?: ChronicleEntity['archiveCategory']
  shopCategory?: ChronicleEntity['shopCategory']
  downloadCategory?: ChronicleEntity['downloadCategory']
  clan?: string
  bestiaryTier?: ChronicleEntity['bestiaryTier']
  classification?: ChronicleEntity['classification']
  creatureType?: string
  threatLevel?: ChronicleEntity['threatLevel']
  rarity?: ChronicleEntity['rarity']
  weightKg?: number
  imageUrl?: string | null
  hpMax?: number
  manaMax?: number
  defense?: number
  abilities?: string[]
  lifeStatus?: 'alive' | 'dead'
  location?: string
  attributeMods?: AttributeMod[]
  relicAmuletType?: string
  magicType?: string
  cooldownText?: string
  equipmentType?: string
  serviceType?: string
  consumableKind?: ChronicleEntity['consumableKind']
  stockTotal?: number
  statsText?: string
  priceGold?: number
  priceSilver?: number
  priceCopper?: number
  fileName?: string
  fileUrl?: string
  creatureSize?: string
  creatureSpeed?: string
  creatureSenses?: string
  defenseNote?: string
  primaryAttackName?: string
  primaryAttackDesc?: string
  secondaryAttackName?: string
  secondaryAttackDesc?: string
  sceneTrigger?: string
  narratorNotes?: string
  chronicleScope?: string | null
  narratorScope?: string | null
  creatureStats?: ChronicleEntity['creatureStats']
  passiveTraits?: string[]
}
