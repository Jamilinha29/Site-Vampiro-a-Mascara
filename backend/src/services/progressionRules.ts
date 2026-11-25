/**
 * Contrato único de progressão da crônica no backend:
 * - Níveis 0 a 10
 * - Subclasse I desbloqueada no nível 5
 * - Subclasse II (adicional) desbloqueada no nível 7
 */
export const MIN_CHARACTER_LEVEL = 0
export const MAX_CHARACTER_LEVEL = 10
export const SUBCLASS_CHOICE_LEVEL = 5
export const SECOND_SUBCLASS_CHOICE_LEVEL = 7
export const STARTING_CHARACTER_XP = 0
export const VITALS_PER_LEVEL = 5

/**
 * XP necessário para sair do nível `level` e ir para `level + 1`.
 * Nível 0 -> 1 = 25; níveis 1..9 = 50 * L * (L + 1) / 2; nível 10 = 0 (máximo).
 */
export function xpRequiredToAdvance(level: number): number {
  if (level < MIN_CHARACTER_LEVEL || level >= MAX_CHARACTER_LEVEL) return 0
  if (level === 0) return 25
  return (50 * level * (level + 1)) / 2
}
