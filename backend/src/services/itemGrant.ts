import { randomUUID } from 'node:crypto'
import type { ChronicleEntity } from './chronicleStore.js'
import { getCharacter, listCharacters, upsertCharacter } from './profileStore.js'

export async function grantEntityToCharacter(
  email: string,
  characterId: string | undefined,
  entity: ChronicleEntity,
  copies = 1,
) {
  const characters = listCharacters(email)
  const exact = characterId ? getCharacter(email, characterId) : null
  if (characterId && !exact) return false
  const character = exact ?? characters.find((c) => c.isPrimary) ?? characters[0]
  if (!character) return false
  const inventory = [...(character.inventory ?? [])]
  const copiesToAdd = Math.max(1, Math.floor(copies))
  for (let i = 0; i < copiesToAdd; i++) {
    inventory.push({
      id: randomUUID(),
      name: entity.name,
      description: entity.description,
      category:
        entity.consumableKind === 'food' || entity.shopCategory === 'consumables'
          ? 'elixir'
          : entity.shopCategory === 'gear'
            ? 'weapon'
            : 'other',
      rarity: entity.rarity ?? 'comum',
      weightKg: entity.weightKg ?? 0.5,
      equipped: false,
      statsLabel: (entity.attributeMods ?? [])
        .map((m) => `${m.value > 0 ? '+' : ''}${m.value} ${m.attr}`)
        .join(', '),
    })
  }
  await upsertCharacter(email, { ...character, inventory })
  return true
}
