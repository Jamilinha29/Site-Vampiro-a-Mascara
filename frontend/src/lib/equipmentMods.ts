import type { CharacterInventoryItem, ProfileCharacterSummary } from '../types/profile'

export type EquipmentBonuses = {
  mana: number
  defense: number
  hp: number
  skills: Record<string, number>
}

const emptyBonuses = (): EquipmentBonuses => ({ mana: 0, defense: 0, hp: 0, skills: {} })

/**
 * Interpreta `statsLabel` do inventário (ex.: "+10 mana, +2 defesa, +1 furtividade").
 */
export function parseStatsLabel(statsLabel?: string | null): EquipmentBonuses {
  const out = emptyBonuses()
  if (!statsLabel?.trim()) return out

  const re = /([+-]?\d+)\s*([a-zà-úA-ZÀ-Ú_/.\s]+?)(?=,|$)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(statsLabel)) !== null) {
    const value = Number(m[1])
    if (!Number.isFinite(value)) continue
    const raw = m[2].trim().toLowerCase()
    if (/^(mana|pe|energia|glamour)$/.test(raw) || raw.includes('mana')) {
      out.mana += value
      continue
    }
    if (/^(defesa|ca|armadura|armor|classe de armadura)$/.test(raw) || raw.includes('defesa') || raw === 'ca') {
      out.defense += value
      continue
    }
    if (/^(hp|vida|vitalidade|pv)$/.test(raw) || raw.includes('vitalidade') || raw.includes('vida')) {
      out.hp += value
      continue
    }
    const skillKey = raw.replace(/\s+/g, ' ').trim()
    if (skillKey) out.skills[skillKey] = (out.skills[skillKey] ?? 0) + value
  }
  return out
}

export function sumEquippedBonuses(inventory?: CharacterInventoryItem[] | null): EquipmentBonuses {
  const total = emptyBonuses()
  for (const item of inventory ?? []) {
    if (!item.equipped || item.status === 'broken') continue
    const mod = parseStatsLabel(item.statsLabel)
    total.mana += mod.mana
    total.defense += mod.defense
    total.hp += mod.hp
    for (const [k, v] of Object.entries(mod.skills)) {
      total.skills[k] = (total.skills[k] ?? 0) + v
    }
  }
  return total
}

/** CA rolada na criação (dado da classe) + bônus de equipamento. Sem rolagem, usa 10 + nível. */
export function computeArmorClass(character: ProfileCharacterSummary, bonuses?: EquipmentBonuses) {
  const b = bonuses ?? sumEquippedBonuses(character.inventory)
  const rolled = character.vitals?.caValue
  const base =
    typeof rolled === 'number' && rolled > 0 ? rolled : 10 + Math.max(0, (character.level ?? 1) - 1)
  return { base, bonus: b.defense, total: base + b.defense }
}

export function formatBonus(n: number) {
  if (n === 0) return ''
  return n > 0 ? `+${n}` : `${n}`
}

export function sessionDeadKey(sessionId: string, characterId: string) {
  return `session-dead:${sessionId}:${characterId}`
}

export function isSessionDead(sessionId: string, characterId: string) {
  try {
    return sessionStorage.getItem(sessionDeadKey(sessionId, characterId)) === '1'
  } catch {
    return false
  }
}

export function setSessionDead(sessionId: string, characterId: string, dead: boolean) {
  try {
    if (dead) sessionStorage.setItem(sessionDeadKey(sessionId, characterId), '1')
    else sessionStorage.removeItem(sessionDeadKey(sessionId, characterId))
  } catch {
    /* ignore */
  }
}
