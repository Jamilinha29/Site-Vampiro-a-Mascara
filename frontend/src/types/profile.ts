export type UserProfile = {
  userId: string
  email: string
  displayName: string
  handle: string
  role: string
  memberSince: string
  avatarUrl: string | null
  bannerUrl: string | null
  badges: string[]
  preferences: {
    fiefOrigin: string | null
    narrativePreference: string | null
    bio: string | null
    visibility: 'private' | 'court' | 'open'
    notifySessions: boolean
    notifyChronicle: boolean
    courtTitle: string | null
    chronicleSlogan: string | null
    archiveFocus: string | null
    defaultRpgTitle: string | null
  }
  accountMetrics: {
    characters: number | null
    sessions: number | null
    chronicles: number | null
    totalXp: number | null
  }
  lineageStats: {
    charactersCreated: number | null
    sessionsParticipated: number | null
    hoursPlayed: number | null
    chronicleWins: number | null
    xpAccumulated: number | null
    favoriteClass: string | null
  }
  characters: ProfileCharacterSummary[]
}

export type CharacterInventoryItem = {
  id: string
  name: string
  description?: string
  category: 'weapon' | 'armor' | 'elixir' | 'ritual' | 'material' | 'trinket' | 'other'
  rarity: 'comum' | 'incomum' | 'raro' | 'ancestral' | 'proibido'
  weightKg: number
  equipped?: boolean
  slot?: 'head' | 'torso' | 'hands' | 'feet' | 'rings' | 'accessory' | null
  status?: 'ok' | 'broken' | 'cooldown' | 'drop'
  statsLabel?: string
  durability?: { current: number; max: number }
}

/** Habilidades criadas pelo jogador (ficha + uso na sessão). */
export type CreatedSkill = {
  id: string
  name: string
  die: string
  attribute: string
  attributeMod: number
  howItWorks: string
  /** Custo de mana ao usar na sessão (0 = sem custo). */
  manaCost?: number
}

export type CharacterIdentity = {
  faith?: string | null
  house?: string | null
  nature?: string | null
  demeanor?: string | null
  concept?: string | null
  residence?: string | null
  patrons: string[]
  chronicleName?: string | null
  editCounts: {
    house: number
    nature: number
    demeanor: number
    concept: number
    residence: number
  }
}

export type CharacterVitalsMeta = {
  hpDie?: string | null
  manaDie?: string | null
  caDie?: string | null
  caValue?: number | null
  /** Após o jogador informar HP/Mana na criação, não pode alterar (só +5/nível). */
  locked?: boolean
}

export type ProfileCharacterSummary = {
  id: string
  name: string
  species: string
  clan?: string
  level: number
  isPrimary?: boolean
  showOnHome?: boolean
  portraitUrl?: string | null
  hp: { current: number; max: number }
  blood?: { current: number; max: number }
  mana?: { current: number; max: number }
  will?: { current: number; max: number }
  xp?: { current: number; toNext: number }
  subclass?: string | null
  characterClass?: string | null
  identity?: CharacterIdentity
  inventory?: CharacterInventoryItem[]
  createdSkills?: CreatedSkill[]
  carryCapacityKg?: number
  vitals?: CharacterVitalsMeta | null
  /** Atributos, habilidades, virtudes, antecedentes (bolinhas da ficha). */
  balanceStats?: Record<string, number> | null
}

export type BalanceStatsResponse =
  | { found: false }
  | { found: true; hasData: false; characterName: string }
  | {
      found: true
      hasData: true
      characterName: string
      axes: { key: string; label: string; value: number }[]
      balancePercent: number
    }
