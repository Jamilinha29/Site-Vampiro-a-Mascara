import { MAX_CHARACTER_LEVEL, SUBCLASS_CHOICE_LEVEL, SECOND_SUBCLASS_CHOICE_LEVEL } from './progressionRules.js'

export type CampaignRules = {
  version: number
  maxLevel: number
  subclassLevel: number
  secondarySubclassLevel: number
  startingXp: number
  shopBudgetCopper: number
  updatedAt: string
}

const fallback: CampaignRules = {
  version: 1,
  maxLevel: MAX_CHARACTER_LEVEL,
  subclassLevel: SUBCLASS_CHOICE_LEVEL,
  secondarySubclassLevel: SECOND_SUBCLASS_CHOICE_LEVEL,
  startingXp: 0,
  shopBudgetCopper: 0,
  updatedAt: '',
}

let rules: CampaignRules = { ...fallback }

export function readRules(): CampaignRules {
  return { ...rules }
}

export function writeRules(next: Partial<CampaignRules> & Pick<CampaignRules, 'version' | 'maxLevel' | 'subclassLevel'>) {
  rules = {
    ...fallback,
    ...next,
    maxLevel: Math.min(MAX_CHARACTER_LEVEL, Math.max(1, next.maxLevel)),
    subclassLevel: Math.min(MAX_CHARACTER_LEVEL, Math.max(1, next.subclassLevel)),
    secondarySubclassLevel: Math.min(
      MAX_CHARACTER_LEVEL,
      Math.max(1, next.secondarySubclassLevel ?? SECOND_SUBCLASS_CHOICE_LEVEL),
    ),
  }
}

export function resetRulesForTests() {
  rules = { ...fallback }
}
