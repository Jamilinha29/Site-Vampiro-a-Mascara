import { ATTRIBUTE_GROUPS, ABILITY_GROUPS } from '../stores/characterWizardStore'

export const SHEET_ATTR_GROUPS = ATTRIBUTE_GROUPS.map((g) => ({
  title: g.category,
  items: g.items.map((i) => ({ key: i.key, label: i.label })),
}))

export const SHEET_ABILITY_GROUPS = ABILITY_GROUPS.map((g) => ({
  title: g.category,
  category: g.category,
  items: g.items.map((i) => ({ key: i.key, label: i.label })),
}))

export const SHEET_VIRTUES = [
  { key: 'consciencia', label: 'Consciência' },
  { key: 'autocontrole', label: 'Autocontrole' },
  { key: 'coragem', label: 'Coragem' },
] as const

export const SHEET_BACKGROUNDS = [
  { key: 'recursos', label: 'Recursos' },
  { key: 'aliados', label: 'Aliados' },
  { key: 'contatos', label: 'Contatos' },
] as const

export const PATH_KEY = 'humanidade'

export function readSheetStat(stats: Record<string, number> | null | undefined, key: string, fallback = 0) {
  const v = stats?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(10, Math.floor(v))) : fallback
}

export function mergeSheetStat(
  stats: Record<string, number> | null | undefined,
  key: string,
  value: number,
): Record<string, number> {
  return {
    ...(stats ?? {}),
    [key]: Math.max(0, Math.min(10, Math.floor(value))),
  }
}
