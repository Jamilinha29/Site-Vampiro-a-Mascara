import type { AbilityCategory } from '../stores/characterWizardStore'

export type AbilitySlotLimits = {
  Talentos: number
  Perícias: number
  Conhecimentos: number
  /** Máximo de pontos na criação / escolha inicial da faixa. */
  maxDotsAtPick: number
  /** Após evolução por sessão/desenvolvimento (+1). */
  maxDotsEvolved: number
}

/**
 * Quantas perícias o personagem pode ter ativas (dots > 0) em cada categoria,
 * conforme a faixa de nível.
 *
 * - Nível 1–3: 3 Talentos, 2 Perícias, 1 Conhecimento
 * - Nível 4–5: 1 de cada (cota da faixa; somada à anterior na UI de evolução)
 * - Nível 6–10: 1 ou 2 de cada (usa o teto 2)
 *
 * Totais cumulativos usados na ficha:
 * - 1–3 → 3 / 2 / 1
 * - 4–5 → 4 / 3 / 2
 * - 6–10 → 6 / 5 / 4
 */
export function abilitySlotLimits(level: number): AbilitySlotLimits {
  const lv = Math.max(1, Math.floor(level || 1))
  if (lv <= 3) {
    return { Talentos: 3, Perícias: 2, Conhecimentos: 1, maxDotsAtPick: 1, maxDotsEvolved: 4 }
  }
  if (lv <= 5) {
    return { Talentos: 4, Perícias: 3, Conhecimentos: 2, maxDotsAtPick: 1, maxDotsEvolved: 4 }
  }
  if (lv <= 10) {
    return { Talentos: 6, Perícias: 5, Conhecimentos: 4, maxDotsAtPick: 2, maxDotsEvolved: 4 }
  }
  return { Talentos: 6, Perícias: 5, Conhecimentos: 4, maxDotsAtPick: 2, maxDotsEvolved: 4 }
}

/** Cota apenas da faixa atual (para textos de ajuda). */
export function abilityBandAllotment(level: number): AbilitySlotLimits {
  const lv = Math.max(1, Math.floor(level || 1))
  if (lv <= 3) {
    return { Talentos: 3, Perícias: 2, Conhecimentos: 1, maxDotsAtPick: 1, maxDotsEvolved: 4 }
  }
  if (lv <= 5) {
    return { Talentos: 1, Perícias: 1, Conhecimentos: 1, maxDotsAtPick: 1, maxDotsEvolved: 4 }
  }
  if (lv <= 10) {
    return { Talentos: 2, Perícias: 2, Conhecimentos: 2, maxDotsAtPick: 2, maxDotsEvolved: 4 }
  }
  return { Talentos: 2, Perícias: 2, Conhecimentos: 2, maxDotsAtPick: 2, maxDotsEvolved: 4 }
}

export function countActiveAbilities(
  abilities: Record<string, number>,
  keys: readonly { key: string }[],
) {
  return keys.reduce((n, item) => n + ((abilities[item.key] ?? 0) > 0 ? 1 : 0), 0)
}

export function canRaiseAbility(opts: {
  level: number
  category: AbilityCategory
  abilities: Record<string, number>
  categoryKeys: readonly { key: string }[]
  abilityKey: string
  nextValue: number
  /** Na criação (nível 1 do wizard) usa maxDotsAtPick; depois maxDotsEvolved. */
  creationMode?: boolean
}) {
  const limits = abilitySlotLimits(opts.level)
  const maxDots = opts.creationMode ? limits.maxDotsAtPick : limits.maxDotsEvolved
  if (opts.nextValue < 0 || opts.nextValue > maxDots) return false

  const current = opts.abilities[opts.abilityKey] ?? 0
  const active = countActiveAbilities(opts.abilities, opts.categoryKeys)
  const slotCap = limits[opts.category]

  if (opts.nextValue > 0 && current === 0 && active >= slotCap) return false
  return true
}

export const VITAL_DICE = ['D4', 'D6', 'D8', 'D10', 'D12', 'D20'] as const
export type VitalDie = (typeof VITAL_DICE)[number]

export function dieMax(die: string): number {
  const m = /^D(\d+)$/i.exec(die.trim())
  return m ? Number(m[1]) : 10
}

/** +5 HP e +5 Mana por nível ganho. */
export const VITALS_PER_LEVEL = 5
/** XP atual ao criar o personagem (barra 0 / toNext). */
export const STARTING_CHARACTER_XP = 0
