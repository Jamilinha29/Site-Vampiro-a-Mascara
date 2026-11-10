import type { CreatedSkill, ProfileCharacter } from './profileStore.js'

export const BALANCE_AXIS_KEYS = [
  'combate',
  'social',
  'investigacao',
  'ocultismo',
  'estrategia',
  'exploracao',
  'sobrevivencia',
  'interpretacao',
] as const

type BalanceAxisKey = (typeof BALANCE_AXIS_KEYS)[number]

const AXIS_LABELS: Record<BalanceAxisKey, string> = {
  combate: 'Combate',
  social: 'Social',
  investigacao: 'Investigação',
  ocultismo: 'Ocultismo',
  estrategia: 'Estratégia',
  exploracao: 'Exploração',
  sobrevivencia: 'Sobrevivência',
  interpretacao: 'Interpretação',
}

const AXIS_CONTRIBUTORS: Record<BalanceAxisKey, readonly string[]> = {
  combate: [
    'forca',
    'destreza',
    'vigor',
    'briga',
    'esquiva',
    'armasBrancas',
    'armasFogo',
    'intimidacao',
    'prontidao',
    'esportes',
  ],
  social: [
    'carisma',
    'manipulacao',
    'aparencia',
    'etiqueta',
    'labia',
    'manha',
    'lideranca',
    'expressao',
    'empatia',
    'performance',
  ],
  investigacao: ['percepcao', 'inteligencia', 'raciocinio', 'investigacao', 'seguranca', 'linguistica'],
  ocultismo: ['ocultismo', 'academicos', 'ciencia', 'medicina', 'humanidade'],
  estrategia: ['raciocinio', 'politica', 'financas', 'direito', 'lideranca', 'manha', 'inteligencia'],
  exploracao: ['furtividade', 'conducao', 'sobrevivencia', 'prontidao', 'percepcao', 'oficios'],
  sobrevivencia: ['vigor', 'sobrevivencia', 'oficios', 'empatiaAnimais', 'esportes', 'destreza'],
  interpretacao: ['expressao', 'performance', 'empatia', 'aparencia', 'labia', 'carisma'],
}

function readDot(stats: Record<string, number> | null | undefined, key: string): number {
  const v = stats?.[key]
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  return Math.max(0, Math.min(5, v))
}

function dotToPercent(dot: number): number {
  return Math.round((dot / 5) * 100)
}

function axisFromSheet(stats: Record<string, number> | null | undefined, axis: BalanceAxisKey): number {
  const keys = AXIS_CONTRIBUTORS[axis]
  const percents = keys.map((k) => dotToPercent(readDot(stats, k)))
  if (percents.length === 0) return 0
  return Math.round(percents.reduce((s, v) => s + v, 0) / percents.length)
}

function skillAxisBoost(skill: CreatedSkill): Partial<Record<BalanceAxisKey, number>> {
  const mod = Math.min(3, Math.max(0, Math.abs(skill.attributeMod))) * 8
  const attr = skill.attribute.toLowerCase()
  if (attr === 'dano' || attr === 'forca' || attr === 'defesa') return { combate: mod }
  if (attr === 'mana' || attr === 'maldicao') return { ocultismo: mod }
  if (attr === 'velocidade') return { exploracao: mod, combate: mod / 2 }
  return { interpretacao: mod / 2, estrategia: mod / 2 }
}

export function computeCharacterBalanceFromSheet(character: ProfileCharacter) {
  const sheet = character.balanceStats ?? {}
  const hasSheetData = Object.values(sheet).some((v) => typeof v === 'number' && v > 0)
  const hasSkills = (character.createdSkills?.length ?? 0) > 0
  const hasData = hasSheetData || hasSkills

  const axisValues: Record<BalanceAxisKey, number> = {
    combate: axisFromSheet(sheet, 'combate'),
    social: axisFromSheet(sheet, 'social'),
    investigacao: axisFromSheet(sheet, 'investigacao'),
    ocultismo: axisFromSheet(sheet, 'ocultismo'),
    estrategia: axisFromSheet(sheet, 'estrategia'),
    exploracao: axisFromSheet(sheet, 'exploracao'),
    sobrevivencia: axisFromSheet(sheet, 'sobrevivencia'),
    interpretacao: axisFromSheet(sheet, 'interpretacao'),
  }

  for (const skill of character.createdSkills ?? []) {
    const boost = skillAxisBoost(skill)
    for (const key of BALANCE_AXIS_KEYS) {
      axisValues[key] = Math.min(100, axisValues[key] + (boost[key] ?? 0))
    }
  }

  const axes = BALANCE_AXIS_KEYS.map((key) => ({
    key,
    label: AXIS_LABELS[key],
    value: axisValues[key],
  }))

  const values = axes.map((a) => a.value)
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const maxDev = Math.max(...values.map((v) => Math.abs(v - mean)))
  const balancePercent = Math.round(Math.max(0, Math.min(100, 100 - maxDev)))

  return { hasData, axes, balancePercent }
}
