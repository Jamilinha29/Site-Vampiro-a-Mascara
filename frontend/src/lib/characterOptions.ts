/** Fés genéricas (vampiros / outras espécies). */
export const FAITH_OPTIONS = [
  'Cristianismo',
  'Islamismo',
  'Judaísmo',
  'Paganismo',
  'Heregia',
  'Ateísmo / ceticismo',
  'Culto ancestral',
  'Sem fé declarada',
] as const

/** Caminhos de fé (catedrais vêm do catálogo ADM). */
export const MORTAL_FAITH_PATHS = [
  { id: 'luz', label: 'Luz' },
  { id: 'trevas', label: 'Trevas' },
] as const

export type MortalFaithPathId = (typeof MORTAL_FAITH_PATHS)[number]['id']

/** Clãs / ordens mortais (caçadores etc.) — não são clãs vampíricos. */
export const MORTAL_CLAN_OPTIONS = [
  'Inquisidores',
  'Caçadores da Aurora',
  'Guardiões do Véu',
  'Irmandade do Martelo',
  'Vigilantes de Santiago',
  'Companhia da Cruz Quebrada',
  'Ordem do Lumen',
  'Mercenários da Máscara',
  'Sem ordem',
] as const

/** Status especiais de clã além do catálogo oficial. */
export const CLAN_STATUS_OPTIONS = ['Traído', 'Expulso'] as const

export const OTHER_SPECIES_OPTIONS = [
  {
    id: 'lupino',
    label: 'Lupino',
    types: ['Garou', 'Metis', 'Rokea', 'Bastet', 'Nuwisha', 'Outro'],
  },
  {
    id: 'feerico',
    label: 'Feérico',
    types: ['Sidhe', 'Pooka', 'Redcap', 'Troll', 'Sluagh', 'Outro'],
  },
  {
    id: 'mago',
    label: 'Mago',
    types: ['Hermético', 'Verbena', 'Celestial', 'Eutanatos', 'Outro'],
  },
  {
    id: 'fantasma',
    label: 'Fantasma / Espectro',
    types: ['Wraith', 'Espectro', 'Renascido', 'Outro'],
  },
  {
    id: 'dhampir',
    label: 'Dhampir',
    types: ['Puro-sangue', 'Mestiço', 'Outro'],
  },
  {
    id: 'anao',
    label: 'Anão',
    types: ['Clã das pedras', 'Errante', 'Outro'],
  },
  {
    id: 'outro',
    label: 'Outro',
    types: ['Criatura única', 'Indefinido'],
  },
] as const

export const SOCIAL_RANK_BY_SPECIES: Record<string, readonly string[]> = {
  mortal: ['Civil', 'Camponês'],
  vampiro: ['Nobre', 'Servo'],
  outros: ['Fera de baixo escalão', 'Nobre', 'Servo'],
}

export function resolveCharacterClass(character: {
  characterClass?: string | null
  identity?: { house?: string | null } | null
}) {
  if (character.characterClass) return character.characterClass
  const house = character.identity?.house
  if (!house) return null
  const parts = house.split(' · ').map((part) => part.trim()).filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if ((CHARACTER_CLASS_OPTIONS as readonly string[]).includes(parts[i])) return parts[i]
  }
  return null
}

export const CHARACTER_CLASS_OPTIONS = [
  'Guerreiro',
  'Cavaleiro',
  'Clérigo',
  'Monge',
  'Ladino',
  'Caçador',
  'Erudito',
  'Diplomata',
  'Artesão',
  'Camponês',
  'Mercante',
  'Feiticeiro',
  'Bardo',
  'Combatente',
  'Sombra',
  'Arcanista',
  'Devoto',
  'Guardião',
  'Artífice',
  'Outro',
] as const

/** Dado de CA fixo da classe. O jogador rola; não escolhe o dado. */
const CLASS_ARMOR_DIE: Record<(typeof CHARACTER_CLASS_OPTIONS)[number], string> = {
  Guerreiro: 'D10',
  Cavaleiro: 'D12',
  Clérigo: 'D8',
  Monge: 'D8',
  Ladino: 'D8',
  Caçador: 'D8',
  Erudito: 'D6',
  Diplomata: 'D6',
  Artesão: 'D6',
  Camponês: 'D4',
  Mercante: 'D6',
  Feiticeiro: 'D6',
  Bardo: 'D8',
  Combatente: 'D10',
  Sombra: 'D6',
  Arcanista: 'D6',
  Devoto: 'D8',
  Guardião: 'D12',
  Artífice: 'D8',
  Outro: 'D8',
}

export function classArmorDie(characterClass: string | null | undefined) {
  if (!characterClass) return null
  return CLASS_ARMOR_DIE[characterClass as keyof typeof CLASS_ARMOR_DIE] ?? 'D8'
}

export const NPC_CREATURE_TYPES = [
  'Mortal',
  'Vampiro',
  'Anão',
  'Fantasma',
  'Dhampir',
  'Feérico',
  'Mago',
  'Outro',
] as const

export const MONSTER_CREATURE_TYPES = [
  'Vampiro',
  'Lobisomem',
  'Ghost / Espectro',
  'Demônio',
  'Colosso',
  'Bestas da noite',
  'Constructo',
  'Outro',
] as const

export type IdentityFieldKey = 'house' | 'nature' | 'concept' | 'residence' | 'demeanor'

export const IDENTITY_EDIT_LIMIT = 2
export const MAX_PATRONS = 2

export function formatMortalFaithValue(pathLabel: string, cathedralLabel: string, precept: string) {
  return `${pathLabel} · ${cathedralLabel} · ${precept}`
}

export function parseMortalFaith(value: string | null | undefined) {
  if (!value) return { pathId: '' as '' | MortalFaithPathId, cathedralId: '', precept: '' }
  const [pathLabel, cathedralLabel, precept = ''] = value.split(' · ').map((s) => s.trim())
  const path = MORTAL_FAITH_PATHS.find((p) => p.label === pathLabel)
  return {
    pathId: (path?.id ?? '') as '' | MortalFaithPathId,
    cathedralId: cathedralLabel,
    precept,
  }
}
