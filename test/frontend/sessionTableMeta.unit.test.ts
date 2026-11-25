import { describe, expect, it } from 'vitest'
import {
  newSessionTableMetaDefaults,
  syncCampaignFields,
  trimSessionTableMeta,
} from '../../frontend/src/lib/sessionTableMeta'

describe('sessionTableMeta spacing handling', () => {
  it('preserves trailing and internal spaces while typing campaign and arc names', () => {
    const base = newSessionTableMetaDefaults('')
    const step1 = syncCampaignFields({ ...base, campaignName: 'Crônica ', rpgTitle: 'Crônica ' })
    expect(step1.campaignName).toBe('Crônica ')
    expect(step1.rpgTitle).toBe('Crônica ')

    const step2 = syncCampaignFields({
      ...step1,
      campaignName: 'Crônica de Sangue',
      rpgTitle: 'Crônica de Sangue',
      arcTitle: 'Ato I ',
      missionTitle: 'Ato I ',
    })
    expect(step2.campaignName).toBe('Crônica de Sangue')
    expect(step2.arcTitle).toBe('Ato I ')
    expect(step2.missionTitle).toBe('Ato I ')
  })

  it('trims leading and trailing spaces only on save normalization', () => {
    const base = newSessionTableMetaDefaults('  Beladona Sangrenta  ', '  Sessão 2  ')
    const trimmed = trimSessionTableMeta({
      ...base,
      arcTitle: '  Noite Vermelha  ',
      playerGroup: '  Mesa Alfa  ',
    })
    expect(trimmed.campaignName).toBe('Beladona Sangrenta')
    expect(trimmed.rpgTitle).toBe('Beladona Sangrenta')
    expect(trimmed.sessionLabel).toBe('Sessão 2')
    expect(trimmed.arcTitle).toBe('Noite Vermelha')
    expect(trimmed.missionTitle).toBe('Noite Vermelha')
    expect(trimmed.playerGroup).toBe('Mesa Alfa')
  })
})
