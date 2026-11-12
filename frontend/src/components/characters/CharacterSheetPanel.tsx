import { useState, type ReactNode } from 'react'
import { DotRating } from '../domain/DotRating'
import type { CreatedSkill, ProfileCharacterSummary } from '../../types/profile'
import { resolveSheetKind, type SheetKind } from '../../lib/characterSheetKind'
import { SUBCLASS_CHOICE_LEVEL } from '../../lib/characterProgression'
import { IDENTITY_EDIT_LIMIT, MAX_PATRONS, type IdentityFieldKey } from '../../lib/characterOptions'
import {
  abilitySlotLimits,
  canRaiseAbility,
  countActiveAbilities,
} from '../../lib/characterAbilityRules'
import {
  mergeSheetStat,
  PATH_KEY,
  readSheetStat,
  SHEET_ABILITY_GROUPS,
  SHEET_ATTR_GROUPS,
  SHEET_BACKGROUNDS,
  SHEET_VIRTUES,
} from '../../lib/characterSheetStats'
import type { AbilityCategory } from '../../stores/characterWizardStore'
type Props = {
  character: ProfileCharacterSummary
  playerName?: string
  onPatchIdentity?: (
    patch: Partial<Record<IdentityFieldKey, string | null>>,
  ) => Promise<void>
  onChangeSheetStats?: (stats: Record<string, number>) => Promise<void>
  saving?: boolean
}

function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 px-3 py-2">
      <p className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">{label}</p>
      <p className="mt-0.5 text-sm text-on-surface">{value || '—'}</p>
      {hint ? <p className="mt-1 text-[10px] text-on-surface-variant">{hint}</p> : null}
    </div>
  )
}

function EditableIdentityField({
  label,
  field,
  value,
  editsUsed,
  onSave,
  saving,
}: {
  label: string
  field: IdentityFieldKey
  value: string
  editsUsed: number
  onSave?: (field: IdentityFieldKey, next: string) => Promise<void>
  saving?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const remaining = Math.max(0, IDENTITY_EDIT_LIMIT - editsUsed)
  const locked = remaining <= 0 || !onSave

  if (!editing) {
    return (
      <button
        type="button"
        disabled={locked}
        onClick={() => {
          setDraft(value)
          setEditing(true)
        }}
        className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 px-3 py-2 text-left transition hover:border-secondary/40 disabled:cursor-default disabled:hover:border-outline-variant/30"
      >
        <p className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">{label}</p>
        <p className="mt-0.5 text-sm text-on-surface">{value || '—'}</p>
        <p className="mt-1 text-[10px] text-on-surface-variant">
          {locked ? 'Edições esgotadas (máx. 2)' : `${remaining} edição(ões) restante(s)`}
        </p>
      </button>
    )
  }

  return (
    <div className="rounded border border-secondary/40 bg-secondary/5 px-3 py-2">
      <p className="text-[10px] font-semibold tracking-wider text-secondary uppercase">{label}</p>
      <input
        className="input-feudal mt-1 pl-3 normal-case"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn-secondary text-[10px]" onClick={() => setEditing(false)}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary text-[10px]"
          disabled={saving}
          onClick={() => void onSave?.(field, draft.trim()).then(() => setEditing(false))}
        >
          Salvar
        </button>
      </div>
    </div>
  )
}

function IdentityGrid({ character, playerName, onPatchIdentity, saving }: Props) {
  const idn = character.identity
  const patrons = idn?.patrons ?? []

  async function saveField(field: IdentityFieldKey, next: string) {
    await onPatchIdentity?.({ [field]: next || null })
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Nome" value={character.name} />
      <Field label="Jogador" value={playerName ?? '—'} hint="Não editável" />
      <Field
        label="Crônica"
        value={idn?.chronicleName || 'Beladona'}
        hint="Atualiza conforme as sessões do personagem"
      />
      <Field label="Espécie" value={character.species} hint="Definida na criação" />
      <EditableIdentityField
        label="Casa & legado"
        field="house"
        value={idn?.house ?? ''}
        editsUsed={idn?.editCounts.house ?? 0}
        onSave={onPatchIdentity ? saveField : undefined}
        saving={saving}
      />
      <Field
        label="Patrono"
        value={patrons.length ? patrons.join(' · ') : '—'}
        hint={`Definido na sessão · máx. ${MAX_PATRONS}`}
      />
      <Field label="Natureza" value={idn?.nature ?? ''} hint="Definida na criação" />
      <Field label="Comportamento" value={idn?.demeanor ?? ''} hint="Definida na criação" />
      <EditableIdentityField
        label="Conceito"
        field="concept"
        value={idn?.concept ?? ''}
        editsUsed={idn?.editCounts.concept ?? 0}
        onSave={onPatchIdentity ? saveField : undefined}
        saving={saving}
      />
      <EditableIdentityField
        label="Residência"
        field="residence"
        value={idn?.residence ?? ''}
        editsUsed={idn?.editCounts.residence ?? 0}
        onSave={onPatchIdentity ? saveField : undefined}
        saving={saving}
      />
      <Field
        label="Subclasse"
        value={
          character.subclass ??
          (character.level >= SUBCLASS_CHOICE_LEVEL ? 'Pendente (nível 7+)' : 'Disponível no nível 7')
        }
      />
      <Field label="Fé" value={idn?.faith ?? '—'} />
      <Field label="Clã" value={character.clan ?? '—'} />
    </div>
  )
}

function SectionCard({
  title,
  children,
  compact,
}: {
  title: string
  children: ReactNode
  compact?: boolean
}) {
  return (
    <section className={`mesa-panel ${compact ? 'space-y-2 p-3 sm:p-4' : 'space-y-4 p-4 sm:p-5'}`}>
      <h3 className="font-label-sm text-xs text-secondary uppercase">{title}</h3>
      {children}
    </section>
  )
}

function useSheetStats(props: Props) {
  const stats = props.character.balanceStats ?? {}
  const editable = !!props.onChangeSheetStats

  async function setStat(key: string, value: number) {
    if (!props.onChangeSheetStats) return
    await props.onChangeSheetStats(mergeSheetStat(stats, key, value))
  }

  return { stats, editable, setStat, saving: props.saving }
}

function AttributesAndAbilities(props: Props) {
  const { stats, editable, setStat, saving } = useSheetStats(props)
  const level = props.character.level ?? 1
  const limits = abilitySlotLimits(level)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Atributos" compact>
        <div className="grid gap-2 sm:grid-cols-3">
          {SHEET_ATTR_GROUPS.map((g) => (
            <div key={g.title}>
              <h4 className="mb-1 text-[10px] font-semibold tracking-wider text-secondary uppercase">{g.title}</h4>
              <ul className="space-y-1">
                {g.items.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-on-surface-variant">{item.label}</span>
                    <DotRating
                      value={readSheetStat(stats, item.key, 0)}
                      min={0}
                      max={5}
                      readOnly={!editable || saving}
                      onChange={editable ? (v) => void setStat(item.key, v) : undefined}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Habilidades">
        <p className="mb-3 text-[11px] text-on-surface-variant">
          Nível {level}: até {limits.Talentos} talentos, {limits.Perícias} perícias, {limits.Conhecimentos}{' '}
          conhecimentos · cada uma pode evoluir até {limits.maxDotsEvolved} pts.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {SHEET_ABILITY_GROUPS.map((g) => {
            const category = g.category as AbilityCategory
            const used = countActiveAbilities(stats, g.items)
            const cap = limits[category]
            return (
              <div key={g.title}>
                <h4 className="mb-2 text-[10px] font-semibold tracking-wider text-secondary uppercase">
                  {g.title}{' '}
                  <span className="text-on-surface-variant">
                    ({used}/{cap})
                  </span>
                </h4>
                <ul className="space-y-1.5">
                  {g.items.map((item) => {
                    const value = readSheetStat(stats, item.key, 0)
                    return (
                      <li key={item.key} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-on-surface-variant">{item.label}</span>
                        <DotRating
                          value={value}
                          min={0}
                          max={limits.maxDotsEvolved}
                          readOnly={!editable || saving}
                          onChange={
                            editable
                              ? (next) => {
                                  if (
                                    !canRaiseAbility({
                                      level,
                                      category,
                                      abilities: stats,
                                      categoryKeys: g.items,
                                      abilityKey: item.key,
                                      nextValue: next,
                                      creationMode: false,
                                    })
                                  ) {
                                    return
                                  }
                                  void setStat(item.key, next)
                                }
                              : undefined
                          }
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

function PathAndVirtues(props: Props & { title?: string; virtueLabels?: readonly { key: string; label: string }[] }) {
  const { stats, editable, setStat, saving } = useSheetStats(props)
  const virtues = props.virtueLabels ?? SHEET_VIRTUES
  const path = readSheetStat(stats, PATH_KEY, 0)

  return (
    <SectionCard title={props.title ?? 'Trilha & virtudes'}>
      <p className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">Trilha / Humanidade</p>
      <div className="mt-2 mb-4">
        <DotRating
          value={path}
          min={0}
          max={10}
          readOnly={!editable || saving}
          onChange={editable ? (v) => void setStat(PATH_KEY, v) : undefined}
        />
      </div>
      <ul className="space-y-2">
        {virtues.map((v) => (
          <li key={v.key} className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">{v.label}</span>
            <DotRating
              value={readSheetStat(stats, v.key, 0)}
              min={0}
              max={5}
              tone="gold"
              readOnly={!editable || saving}
              onChange={editable ? (n) => void setStat(v.key, n) : undefined}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

function BackgroundsAndResources(props: Props) {
  const { stats, editable, setStat, saving } = useSheetStats(props)

  return (
    <SectionCard title="Antecedentes & recursos">
      <p className="mb-3 text-xs text-on-surface-variant">
        Vantagens da vida do personagem: dinheiro e posses (Recursos), pessoas que ajudam (Aliados) e
        rede de informações (Contatos). Não é reserva de mana.
      </p>
      <ul className="space-y-2">
        {SHEET_BACKGROUNDS.map((b) => (
          <li key={b.key} className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">{b.label}</span>
            <DotRating
              value={readSheetStat(stats, b.key, 0)}
              min={0}
              max={5}
              readOnly={!editable || saving}
              onChange={editable ? (v) => void setStat(b.key, v) : undefined}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

function formatSkillAttr(skill: CreatedSkill) {
  const mod = skill.attributeMod >= 0 ? `+${skill.attributeMod}` : `${skill.attributeMod}`
  const mana = (skill.manaCost ?? 0) > 0 ? ` · mana ${skill.manaCost}` : ''
  return `${skill.attribute} ${mod}${mana}`
}

/** Na ficha: só nome + atributo (ex.: Dano +3). Edição fica no menu Habilidades. */
function CreatedSkillsSection({ character }: Props) {
  const skills = character.createdSkills ?? []
  return (
    <SectionCard title="Habilidades próprias">
      {skills.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          Nenhuma habilidade — crie e edite no menu Habilidades.
        </p>
      ) : (
        <ul className="space-y-2">
          {skills.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-outline-variant/30 bg-surface-container-lowest/40 px-3 py-2"
            >
              <span className="font-serif text-sm text-on-surface">{s.name}</span>
              <span className="text-xs tracking-wide text-secondary uppercase">{formatSkillAttr(s)}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function MortalSheet(props: Props) {
  return (
    <div className="space-y-4">
      <SectionCard title="Identidade & vínculos">
        <IdentityGrid {...props} />
      </SectionCard>
      <AttributesAndAbilities {...props} />
      <CreatedSkillsSection {...props} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PathAndVirtues {...props} title="Virtudes & caminho" />
        <BackgroundsAndResources {...props} />
      </div>
    </div>
  )
}

function VampireSheet(props: Props) {
  return (
    <div className="space-y-4">
      <SectionCard title="Identidade & linhagem">
        <IdentityGrid {...props} />
      </SectionCard>
      <AttributesAndAbilities {...props} />
      <CreatedSkillsSection {...props} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PathAndVirtues {...props} />
        <BackgroundsAndResources {...props} />
      </div>
    </div>
  )
}

function OtherSpeciesSheet(props: Props) {
  const { character } = props
  const s = character.species.toLowerCase()
  const isFae =
    s.includes('fé') ||
    s.includes('feer') ||
    s.includes('fada') ||
    s.includes('glamour') ||
    s.includes('changeling')
  const pathTitle = isFae ? 'Trilha do Juramento Feérico' : 'Trilha & virtudes'

  return (
    <div className="space-y-4">
      <SectionCard title="Identidade & linhagem">
        <IdentityGrid {...props} />
      </SectionCard>
      <AttributesAndAbilities {...props} />
      <CreatedSkillsSection {...props} />
      <div className="grid gap-4 lg:grid-cols-2">
        <PathAndVirtues
          {...props}
          title={pathTitle}
          virtueLabels={
            isFae
              ? [
                  { key: 'nobreza', label: 'Nobreza' },
                  { key: 'coragem', label: 'Coragem' },
                  { key: 'esperteza', label: 'Esperteza' },
                ]
              : SHEET_VIRTUES
          }
        />
        <BackgroundsAndResources {...props} />
      </div>
    </div>
  )
}

const SHEETS: Record<SheetKind, (props: Props) => ReactNode> = {
  mortal: MortalSheet,
  vampire: VampireSheet,
  other: OtherSpeciesSheet,
}

export function CharacterSheetPanel(props: Props) {
  const kind = resolveSheetKind(props.character.species)
  const Sheet = SHEETS[kind]
  return <Sheet {...props} />
}
