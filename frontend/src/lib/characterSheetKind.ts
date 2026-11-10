export type SheetKind = 'mortal' | 'vampire' | 'other'

export type ResourceProfile = {
  showHp: boolean
  showMana: boolean
  showBlood: boolean
  showWill: boolean
  manaLabel: string
  secondaryEssenceLabel?: string
}

const BLOOD_WILL_KEYWORDS = [
  'vampiro',
  'cainita',
  'garou',
  'lobisomem',
  'wraith',
  'espectro',
  'demônio',
  'demonio',
]

const MANA_KEYWORDS = [
  'mortal',
  'caçador',
  'cacador',
  'humana',
  'humano',
  'mago',
  'feiticeiro',
  'feérico',
  'feerico',
  'fada',
  'changeling',
  'mutante',
]

export function resolveSheetKind(species: string | null | undefined): SheetKind {
  const s = (species ?? '').toLowerCase()
  if (s.includes('vampiro') || s.includes('cainita')) return 'vampire'
  if (s.includes('mortal') || s.includes('caçador') || s.includes('cacador') || s.includes('humana') || s.includes('humano')) {
    return 'mortal'
  }
  return 'other'
}

export function resolveResourceProfile(species: string | null | undefined): ResourceProfile {
  const kind = resolveSheetKind(species)
  const s = (species ?? '').toLowerCase()

  if (kind === 'vampire') {
    return {
      showHp: true,
      showMana: false,
      showBlood: true,
      showWill: true,
      manaLabel: 'Mana',
    }
  }

  if (kind === 'mortal') {
    return {
      showHp: true,
      showMana: true,
      showBlood: false,
      showWill: false,
      manaLabel: 'Mana',
    }
  }

  const usesBlood = BLOOD_WILL_KEYWORDS.some((k) => s.includes(k))
  const usesMana =
    MANA_KEYWORDS.some((k) => s.includes(k)) ||
    s.includes('fé') ||
    s.includes('fe ') ||
    s.includes('glamour') ||
    s.includes('arcano')

  if (usesBlood && !usesMana) {
    return {
      showHp: true,
      showMana: false,
      showBlood: true,
      showWill: true,
      manaLabel: 'Mana',
    }
  }

  const isFae = s.includes('fé') || s.includes('feer') || s.includes('fada') || s.includes('glamour') || s.includes('changeling')
  return {
    showHp: true,
    showMana: true,
    showBlood: false,
    showWill: true,
    manaLabel: isFae ? 'Glamour' : 'Mana',
    secondaryEssenceLabel: isFae ? 'Essência dos Sonhos' : undefined,
  }
}
