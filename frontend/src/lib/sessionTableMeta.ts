import type { ScheduledSession, SessionTableMeta } from '../types/chronicle'

export type SessionTableMetaFormOptions = {
  campaignLocked?: boolean
  sessionLabelReadOnly?: boolean
}

export const SESSION_TABLE_ROWS: { key: keyof SessionTableMeta; label: string }[] = [
  { key: 'campaignName', label: 'Campanha / RPG' },
  { key: 'sessionLabel', label: 'Sessão' },
  { key: 'arcTitle', label: 'Missão (arco)' },
  { key: 'playerGroup', label: 'Grupo' },
]

export const DEFAULT_SESSION_RPG = 'Crônicas do Véu Sombrio'
export const DEFAULT_PLAYER_GROUP = '3–5 jogadores'

export const EMPTY_SESSION_TABLE_META: SessionTableMeta = {
  rpgTitle: '',
  campaignName: '',
  sessionLabel: '',
  arcTitle: '',
  missionTitle: '',
  playerGroup: '',
  targetDuration: '',
  recommendedLevels: '',
}

export function syncCampaignFields(meta: SessionTableMeta): SessionTableMeta {
  const campaign = meta.campaignName?.trim() || meta.rpgTitle?.trim() || ''
  return {
    ...meta,
    campaignName: campaign,
    rpgTitle: campaign,
    missionTitle: meta.arcTitle?.trim() || meta.missionTitle || '',
  }
}

export function newSessionTableMetaDefaults(campaignName = '', sessionLabel = 'Sessão 1'): SessionTableMeta {
  const campaign = campaignName.trim()
  return syncCampaignFields({
    rpgTitle: campaign,
    campaignName: campaign,
    sessionLabel,
    arcTitle: '',
    missionTitle: '',
    playerGroup: DEFAULT_PLAYER_GROUP,
    targetDuration: '',
    recommendedLevels: '',
  })
}

export function resolveSessionTableMeta(session: ScheduledSession): SessionTableMeta {
  const m = session.tableMeta
  const campaign = m?.campaignName?.trim() || m?.rpgTitle?.trim() || session.chronicleName?.trim() || ''
  const arc = m?.arcTitle?.trim() || m?.missionTitle?.trim() || ''
  const sessionLabel =
    m?.sessionLabel?.trim() ||
    session.title?.trim() ||
    formatSessionLabelFromOrdinal(m?.sessionOrdinal) ||
    'Sessão 1'

  return syncCampaignFields({
    rpgTitle: campaign,
    campaignName: campaign,
    sessionLabel,
    arcTitle: arc,
    missionTitle: arc,
    playerGroup: m?.playerGroup?.trim() || DEFAULT_PLAYER_GROUP,
    targetDuration: '',
    recommendedLevels: '',
    sessionOrdinal: m?.sessionOrdinal,
  })
}

export function formatSessionLabelFromOrdinal(ordinal?: number): string {
  if (ordinal == null || Number.isNaN(ordinal)) return ''
  if (Number.isInteger(ordinal)) return `Sessão ${ordinal}`
  return `Sessão ${ordinal.toString().replace('.', ',')}`
}

export function suggestSessionLabel(
  existing: ScheduledSession[],
  campaignName: string,
  continuation = false,
): { label: string; ordinal: number } {
  const key = campaignName.trim().toLowerCase()
  if (!key) return { label: 'Sessão 1', ordinal: 1 }
  const sameCampaign = existing.filter(
    (s) =>
      (s.tableMeta?.campaignName ?? s.chronicleName ?? '').trim().toLowerCase() === key ||
      (s.chronicleName ?? '').trim().toLowerCase() === key,
  )
  if (continuation && sameCampaign.length > 0) {
    const last = sameCampaign[sameCampaign.length - 1]
    const ord = last.tableMeta?.sessionOrdinal ?? sameCampaign.length
    const next = ord + 0.5
    return { label: formatSessionLabelFromOrdinal(next) || `Sessão ${next}`, ordinal: next }
  }
  const nextInt = sameCampaign.length + 1
  return { label: `Sessão ${nextInt}`, ordinal: nextInt }
}

export function isCampaignLocked(meta: SessionTableMeta | undefined, session: ScheduledSession): boolean {
  const campaign = meta?.campaignName?.trim() || meta?.rpgTitle?.trim() || session.chronicleName?.trim()
  return !!campaign
}
