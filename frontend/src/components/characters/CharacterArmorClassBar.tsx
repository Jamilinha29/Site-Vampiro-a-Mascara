import { computeArmorClass, sumEquippedBonuses } from '../../lib/equipmentMods'
import type { ProfileCharacterSummary } from '../../types/profile'
import { StatBar } from '../domain/StatBar'

export function CharacterArmorClassBar({ character }: { character: ProfileCharacterSummary }) {
  const bonuses = sumEquippedBonuses(character.inventory ?? [])
  const ca = computeArmorClass(character, bonuses)
  return (
    <StatBar
      label="Classe de armadura (CA)"
      current={ca.total}
      max={Math.max(ca.total, ca.base + Math.abs(ca.bonus), 20)}
      bonus={ca.bonus}
      variant="defense"
    />
  )
}
