import type { CharacterInventoryItem, ProfileCharacterSummary } from '../types/profile'

export type EquipmentBonuses = {
  mana: number
  ca: number
  hp: number
  /** Bônus por nome de atributo/habilidade (minúsculo). */
  byAttr: Record<string, number>
}

const EMPTY: EquipmentBonuses = { mana: 0, ca: 0, hp: 0, byAttr: {} }

/**
 * Lê `statsLabel` dos itens equipados (ex.: "+10 mana, +2 CA, +1 Força").
 * Soma bônus iguais ( +10 mana e +20 mana → +30 ).
 */
export function sumEquippedBonuses(inventory: CharacterInventoryItem[] | null | undefined): EquipmentBonuses {
  const result: EquipmentBonuses = { mana: 0, ca: 0, hp: 0, byAttr: {} }
  for (const item of inventory ?? []) {
    if (!item.equipped || item.status === 'broken') continue
    const label = item.statsLabel ?? ''
    for (const raw of label.split(/[,;·|]/)) {
      const part = raw.trim()
      if (!part) continue
      const m = part.match(/^([+-]?\d+)\s+(.+)$/i)
      if (!m) continue
      const value = Number(m[1])
      if (!Number.isFinite(value)) continue
      const attr = m[2].trim().toLowerCase()
      if (/mana|energia|glamour|pe\b/.test(attr)) {
        result.mana += value
      } else if (/^ca$|armadura|defesa|classe de armadura|\bac\b/.test(attr)) {
        result.ca += value
      } else if (/^(hp|vida|vitalidade|cura)/.test(attr)) {
        result.hp += value
      } else {
        result.byAttr[attr] = (result.byAttr[attr] ?? 0) + value
      }
    }
  }
  return result
}

export function formatBonus(n: number): string {
  if (n === 0) return ''
  return n > 0 ? `+${n}` : `${n}`
}

/** CA base da ficha (balanceStats.ca) ou 10. */
export function resolveArmorClass(character: ProfileCharacterSummary): {
  base: number
  bonus: number
  total: number
} {
  const base = Math.max(0, Math.floor(character.balanceStats?.ca ?? 10))
  const bonus = sumEquippedBonuses(character.inventory).ca
  return { base, bonus, total: base + bonus }
}

export function resolveManaDisplay(character: ProfileCharacterSummary): {
  current: number
  max: number
  bonus: number
  available: number
} {
  const pool = character.mana ?? { current: 0, max: 0 }
  const bonus = sumEquippedBonuses(character.inventory).mana
  return {
    current: pool.current,
    max: pool.max,
    bonus,
    available: Math.max(0, pool.current + bonus),
  }
}

export function isCharacterDead(character: ProfileCharacterSummary): boolean {
  return character.hp.current <= 0
}

export { EMPTY as EMPTY_EQUIPMENT_BONUSES }
