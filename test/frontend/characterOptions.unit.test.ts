import { describe, expect, it } from 'vitest'
import { CHARACTER_CLASS_OPTIONS, resolveCharacterClass } from '../../frontend/src/lib/characterOptions'

describe('resolveCharacterClass', () => {
  it('prefers explicit characterClass field', () => {
    expect(resolveCharacterClass({ characterClass: 'Combatente', identity: { house: 'Nobre · Guerreiro' } })).toBe(
      'Combatente',
    )
  })

  it('recovers class from identity.house trail', () => {
    expect(resolveCharacterClass({ identity: { house: 'Servo · Caçador' } })).toBe('Caçador')
  })

  it('includes spreadsheet classes used by subclasses import', () => {
    for (const name of ['Combatente', 'Sombra', 'Arcanista', 'Artífice']) {
      expect(CHARACTER_CLASS_OPTIONS).toContain(name)
    }
  })
})
