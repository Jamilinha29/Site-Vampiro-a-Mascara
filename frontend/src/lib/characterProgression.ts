export const MIN_CHARACTER_LEVEL = 0
export const MAX_CHARACTER_LEVEL = 10
export const SUBCLASS_CHOICE_LEVEL = 5
export const SECOND_SUBCLASS_CHOICE_LEVEL = 7
export const STARTING_CHARACTER_XP = 0
export const VITALS_PER_LEVEL = 5

/**
 * Mesmo cálculo do servidor (`progressionRules.ts`):
 * - Nível 0 -> 1: 25 XP
 * - Níveis 1..9: 50 * nível * (nível + 1) / 2
 * - Nível 10: 0 XP (nível máximo)
 */
export function xpRequiredToAdvance(level: number): number {
  if (level < MIN_CHARACTER_LEVEL || level >= MAX_CHARACTER_LEVEL) return 0
  if (level === 0) return 25
  return (50 * level * (level + 1)) / 2
}

export function needsSubclassChoice(character: {
  level: number
  subclass?: string | null
  characterClass?: string | null
  identity?: { house?: string | null } | null
}): boolean {
  const hasClass = Boolean(character.characterClass || character.identity?.house)
  return character.level >= SUBCLASS_CHOICE_LEVEL && !character.subclass && hasClass
}

export function needsSecondarySubclassChoice(character: {
  level: number
  secondarySubclass?: string | null
  characterClass?: string | null
  identity?: { house?: string | null } | null
}): boolean {
  const hasClass = Boolean(character.characterClass || character.identity?.house)
  return character.level >= SECOND_SUBCLASS_CHOICE_LEVEL && !character.secondarySubclass && hasClass
}

export function normalizeProgression(input: {
  level: number
  xp?: { current?: number; toNext?: number } | null
  subclass?: string | null
  secondarySubclass?: string | null
  characterClass?: string | null
  identity?: { house?: string | null } | null
}) {
  const level = Math.max(
    MIN_CHARACTER_LEVEL,
    Math.min(MAX_CHARACTER_LEVEL, Math.floor(input.level ?? MIN_CHARACTER_LEVEL)),
  )
  const toNext = xpRequiredToAdvance(level)
  const current = Math.max(0, Math.floor(input.xp?.current ?? 0))
  const hasClass = input.characterClass !== undefined || input.identity !== undefined
    ? Boolean(input.characterClass || input.identity?.house)
    : true
  return {
    level,
    xp: { current, toNext },
    needsSubclassChoice: level >= SUBCLASS_CHOICE_LEVEL && !input.subclass && hasClass,
    needsSecondarySubclassChoice:
      level >= SECOND_SUBCLASS_CHOICE_LEVEL && !input.secondarySubclass && hasClass,
  }
}
