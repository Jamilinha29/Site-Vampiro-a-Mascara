export type CampaignRules = {
  version: number
  maxLevel: number
  subclassLevel: number
  startingXp: number
  shopBudgetCopper: number
  updatedAt: string
}

const fallback: CampaignRules = {
  version: 1,
  maxLevel: 20,
  subclassLevel: 7,
  startingXp: 0,
  shopBudgetCopper: 0,
  updatedAt: '',
}

let rules: CampaignRules = { ...fallback }

export function readRules() {
  return { ...rules }
}

export function writeRules(next: CampaignRules) {
  rules = { ...next }
}
