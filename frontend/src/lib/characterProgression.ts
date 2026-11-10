/** Nível máximo alcançável por XP. */
export const MAX_CHARACTER_LEVEL = 20

/** Nível em que o jogador escolhe a subclasse. */
export const SUBCLASS_CHOICE_LEVEL = 7

/**
 * XP necessário para sair do nível `level` e ir para `level + 1`.
 * Exemplos: 1→2 = 50, 2→3 = 150, 3→4 = 300.
 */
export function xpRequiredToAdvance(level: number): number {
  if (level < 1 || level >= MAX_CHARACTER_LEVEL) return 0
  return (50 * level * (level + 1)) / 2
}

export type XpPool = {
  current: number
  toNext: number
}

export type ProgressionState = {
  level: number
  xp: XpPool
  subclass: string | null
  needsSubclassChoice: boolean
  leveledUp: boolean
}

/** Normaliza XP/nível a partir dos dados persistidos (ou defaults). */
export function normalizeProgression(input: {
  level?: number
  xp?: { current?: number; toNext?: number } | null
  subclass?: string | null
}): ProgressionState {
  const level = Math.min(MAX_CHARACTER_LEVEL, Math.max(1, Math.floor(input.level ?? 1)))
  const toNext = level >= MAX_CHARACTER_LEVEL ? 0 : xpRequiredToAdvance(level)
  const current = Math.max(0, Math.floor(input.xp?.current ?? 0))
  const subclass = input.subclass ?? null
  return {
    level,
    xp: { current: Math.min(current, toNext || current), toNext },
    subclass,
    needsSubclassChoice: level >= SUBCLASS_CHOICE_LEVEL && !subclass,
    leveledUp: false,
  }
}

/**
 * Aplica ganho de XP e sobe de nível automaticamente enquanto a barra estiver cheia.
 * Overflow carrega para o próximo nível.
 */
export function applyXpGain(
  state: ProgressionState,
  amount: number,
): ProgressionState {
  if (amount <= 0 || state.level >= MAX_CHARACTER_LEVEL) return state

  let level = state.level
  let current = state.xp.current + Math.floor(amount)
  let toNext = xpRequiredToAdvance(level)
  let leveledUp = false
  let subclass = state.subclass

  while (level < MAX_CHARACTER_LEVEL && toNext > 0 && current >= toNext) {
    current -= toNext
    level += 1
    leveledUp = true
    toNext = level >= MAX_CHARACTER_LEVEL ? 0 : xpRequiredToAdvance(level)
  }

  if (level >= MAX_CHARACTER_LEVEL) {
    current = 0
    toNext = 0
  }

  return {
    level,
    xp: { current, toNext },
    subclass,
    needsSubclassChoice: level >= SUBCLASS_CHOICE_LEVEL && !subclass,
    leveledUp,
  }
}
