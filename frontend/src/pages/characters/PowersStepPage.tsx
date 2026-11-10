import type { ReactNode } from 'react'
import { CreatedSkillsPanel } from '../../components/characters/CreatedSkillsPanel'
import { DotRating } from '../../components/domain/DotRating'
import {
  abilityBandAllotment,
  abilitySlotLimits,
  canRaiseAbility,
  countActiveAbilities,
} from '../../lib/characterAbilityRules'
import {
  ABILITY_GROUPS,
  useCharacterWizardStore,
  type AbilityCategory,
} from '../../stores/characterWizardStore'
import { CharacterWizardLayout } from './CharacterWizardLayout'

/** Criação = nível 1 (faixa 1–3). */
const CREATION_LEVEL = 1

export default function PowersStepPage() {
  const abilities = useCharacterWizardStore((s) => s.abilities)
  const setAbility = useCharacterWizardStore((s) => s.setAbility)
  const createdSkills = useCharacterWizardStore((s) => s.createdSkills)
  const setCreatedSkills = useCharacterWizardStore((s) => s.setCreatedSkills)

  const limits = abilitySlotLimits(CREATION_LEVEL)
  const band = abilityBandAllotment(CREATION_LEVEL)

  return (
    <CharacterWizardLayout>
      <Section
        number="01"
        title="Habilidades Feudais"
        hint={`Níveis 1–3: escolha ${band.Talentos} talentos, ${band.Perícias} perícias e ${band.Conhecimentos} conhecimento (1 ponto na criação; evolução até 4 pts). Níveis 4–5: +1 de cada. Níveis 6–10: +1 ou +2 de cada.`}
      >
        <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
          {(
            [
              ['Talentos', limits.Talentos],
              ['Perícias', limits.Perícias],
              ['Conhecimentos', limits.Conhecimentos],
            ] as const
          ).map(([cat, cap]) => {
            const group = ABILITY_GROUPS.find((g) => g.category === cat)!
            const used = countActiveAbilities(abilities, group.items)
            return (
              <span
                key={cat}
                className={`rounded border px-2.5 py-1 font-semibold ${
                  used >= cap
                    ? 'border-primary-container/50 bg-primary-container/10 text-primary'
                    : 'border-secondary/40 bg-secondary/10 text-secondary'
                }`}
              >
                {cat}: {used}/{cap}
              </span>
            )
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {ABILITY_GROUPS.map((group) => {
            const category = group.category as AbilityCategory
            const used = countActiveAbilities(abilities, group.items)
            const cap = limits[category]
            return (
              <div key={group.category} className="rounded-lg border border-outline-variant/35 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-label-sm text-xs tracking-wider text-secondary uppercase">
                    {group.category}
                  </h3>
                  <span className="text-[10px] text-on-surface-variant">
                    {used}/{cap} · máx. {limits.maxDotsAtPick} pt
                  </span>
                </div>
                <ul className="space-y-3">
                  {group.items.map((a) => {
                    const value = abilities[a.key] ?? 0
                    return (
                      <li key={a.key} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-on-surface">{a.label}</span>
                        <DotRating
                          value={value}
                          min={0}
                          max={limits.maxDotsAtPick}
                          onChange={(next) => {
                            if (
                              !canRaiseAbility({
                                level: CREATION_LEVEL,
                                category,
                                abilities,
                                categoryKeys: group.items,
                                abilityKey: a.key,
                                nextValue: next,
                                creationMode: true,
                              })
                            ) {
                              return
                            }
                            setAbility(a.key, next)
                          }}
                        />
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      </Section>

      <Section
        number="02"
        title="Habilidades Criadas"
        hint="Nome, dado, atributo, modificador e descrição — salvas na ficha."
        tracker={`${createdSkills.length} criada${createdSkills.length === 1 ? '' : 's'}`}
      >
        <div className="rounded-lg border border-outline-variant/35 bg-surface-container-lowest/30 p-4">
          <CreatedSkillsPanel skills={createdSkills} onChange={setCreatedSkills} />
        </div>
      </Section>
    </CharacterWizardLayout>
  )
}

function Section({
  number,
  title,
  hint,
  tracker,
  children,
}: {
  number: string
  title: string
  hint?: string
  tracker?: string
  children: ReactNode
}) {
  return (
    <section className="mb-10 last:mb-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] text-secondary uppercase">Seção {number}</p>
          <h2 className="mt-1 font-serif text-xl text-on-surface md:text-2xl">{title}</h2>
          {hint ? <p className="mt-1 text-xs text-on-surface-variant">{hint}</p> : null}
        </div>
        {tracker ? (
          <span className="rounded border border-secondary/40 bg-secondary/10 px-3 py-1.5 text-[11px] font-semibold text-secondary">
            {tracker}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  )
}
