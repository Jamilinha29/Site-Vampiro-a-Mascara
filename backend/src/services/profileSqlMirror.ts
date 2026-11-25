import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from './supabaseClient.js'
import type { ProfileCharacter, UserProfile } from './profileStore.js'
import { listProfiles } from './profileStore.js'

const PROFILE_TABLES = ['PerfisJogadores', 'player_profiles'] as const
const CHARACTER_TABLES = ['Personagens', 'characters'] as const
const SCHEMA_RETRY_COOLDOWN_MS = 10 * 60_000

let syncTimer: ReturnType<typeof setTimeout> | null = null
let resolvedProfileTable: string | null = null
let resolvedCharacterTable: string | null = null
let mirrorDisabledUntil = 0

export function asUuid(id: string) {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return id
  const hex = createHash('sha256').update(id).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

async function upsertOnFirstTable(
  kind: 'profile' | 'character',
  tables: readonly string[],
  row: Record<string, unknown>,
  onConflict: string,
): Promise<string | null> {
  if (Date.now() < mirrorDisabledUntil) return null
  const admin = getSupabaseAdmin()
  if (!admin) return null
  const preferred = kind === 'profile' ? resolvedProfileTable : resolvedCharacterTable
  const candidates = preferred ? [preferred] : tables
  for (const table of candidates) {
    const { data, error } = await admin.from(table).upsert(row, { onConflict }).select('id').maybeSingle()
    if (!error && data && typeof data === 'object' && 'id' in data) {
      if (kind === 'profile') resolvedProfileTable = table
      else resolvedCharacterTable = table
      return String((data as { id: string }).id)
    }
    const missingTable = error?.message?.includes('does not exist') || error?.code === 'PGRST205'
    const missingCol = error?.code === 'PGRST204' || error?.code === '42703' || /column .* does not exist/i.test(error?.message ?? '')
    if (missingCol) {
      mirrorDisabledUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
      return null
    }
    if (!missingTable) {
      console.warn(`[sql-mirror] ${table}: ${error?.message ?? 'falha'}`)
    }
  }
  if (preferred === null) {
    mirrorDisabledUntil = Date.now() + SCHEMA_RETRY_COOLDOWN_MS
  }
  return null
}

function profileRow(profile: UserProfile) {
  return {
    id: asUuid(profile.userId || profile.email),
    email: profile.email.trim().toLowerCase(),
    display_name: profile.displayName,
    handle: profile.handle,
    role: profile.role,
    member_since: profile.memberSince || new Date().toISOString(),
    avatar_url: profile.avatarUrl,
    banner_url: profile.bannerUrl,
    badges: profile.badges ?? [],
    preferences: profile.preferences ?? {},
    account_metrics: profile.accountMetrics ?? {},
    lineage_stats: profile.lineageStats ?? {},
    updated_at: new Date().toISOString(),
  }
}

function characterRow(profileId: string, character: ProfileCharacter) {
  return {
    id: asUuid(character.id),
    profile_id: profileId,
    name: character.name,
    species: character.species,
    clan: character.clan ?? null,
    level: character.level,
    is_primary: Boolean(character.isPrimary),
    show_on_home: Boolean(character.showOnHome),
    portrait_url: character.portraitUrl ?? null,
    hp_current: character.hp.current,
    hp_max: character.hp.max,
    blood_current: character.blood?.current ?? null,
    blood_max: character.blood?.max ?? null,
    mana_current: character.mana?.current ?? null,
    mana_max: character.mana?.max ?? null,
    will_current: character.will?.current ?? null,
    will_max: character.will?.max ?? null,
    xp_current: character.xp?.current ?? 0,
    xp_to_next: character.xp?.toNext ?? 0,
    subclass: character.subclass ?? null,
    secondary_subclass: character.secondarySubclass ?? null,
    character_class: character.characterClass ?? null,
    sheet_revision: character.sheetRevision ?? 0,
    needs_rule_review: Boolean(character.needsRuleReview),
    rule_review_note: character.ruleReviewNote ?? null,
    carry_capacity_kg: character.carryCapacityKg ?? 0,
    identity: character.identity ?? {},
    vitals: character.vitals ?? null,
    balance_stats: character.balanceStats ?? null,
    sheet_payload: character,
    updated_at: new Date().toISOString(),
  }
}

export async function mirrorProfileToSql(profile: UserProfile) {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') return
  const profileId = await upsertOnFirstTable('profile', PROFILE_TABLES, profileRow(profile), 'email')
  if (!profileId) return
  for (const character of profile.characters) {
    await upsertOnFirstTable('character', CHARACTER_TABLES, characterRow(profileId, character), 'id')
  }
}

export async function mirrorAllProfilesToSql() {
  if (process.env.NODE_ENV === 'test' && process.env.BELADONA_TEST_USE_ENV !== 'true') return
  for (const profile of listProfiles()) {
    await mirrorProfileToSql(profile)
  }
}

export function scheduleProfileSqlMirror() {
  if (process.env.NODE_ENV === 'test') return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    void mirrorAllProfilesToSql().catch((err) => {
      console.warn('[sql-mirror]', err instanceof Error ? err.message : err)
    })
  }, 1200)
}
