import type { ReactNode } from 'react'
import { DotRating } from '../../components/domain/DotRating'
import { dieMax, VITAL_DICE } from '../../lib/characterAbilityRules'
import { classArmorDie } from '../../lib/characterOptions'
import { resolveResourceProfile } from '../../lib/characterSheetKind'
import { ATTRIBUTE_GROUPS, useCharacterWizardStore } from '../../stores/characterWizardStore'
import { CharacterWizardLayout } from './CharacterWizardLayout'

export default function AttributesStepPage() {
  const attributes = useCharacterWizardStore((s) => s.attributes)
  const virtues = useCharacterWizardStore((s) => s.virtues)
  const species = useCharacterWizardStore((s) => s.species)
  const hpDie = useCharacterWizardStore((s) => s.hpDie)
  const hpValue = useCharacterWizardStore((s) => s.hpValue)
  const manaDie = useCharacterWizardStore((s) => s.manaDie)
  const manaValue = useCharacterWizardStore((s) => s.manaValue)
  const caValue = useCharacterWizardStore((s) => s.caValue)
  const characterClass = useCharacterWizardStore((s) => s.characterClass)
  const setAttribute = useCharacterWizardStore((s) => s.setAttribute)
  const setVirtue = useCharacterWizardStore((s) => s.setVirtue)
  const setVitals = useCharacterWizardStore((s) => s.setVitals)

  const resources = resolveResourceProfile(
    species === 'vampiro' ? 'Vampiro' : species === 'mortal' ? 'Mortal' : 'Outras espécies',
  )
  const humanity = virtues.conscience + virtues.selfControl
  const willpower = virtues.courage
  const hpMaxAllowed = dieMax(hpDie)
  const manaMaxAllowed = dieMax(manaDie)
  const caDie = classArmorDie(characterClass)
  const caMaxAllowed = caDie ? dieMax(caDie) : 0

  return (
    <CharacterWizardLayout>
      <Section number="01" title="Atributos Fundamentais">
        <div className="grid gap-6 lg:grid-cols-3">
          {ATTRIBUTE_GROUPS.map((group) => (
            <div key={group.category} className="rounded-lg border border-outline-variant/35 p-4">
              <h3 className="mb-3 font-label-sm text-xs tracking-wider text-secondary uppercase">
                {group.category}
              </h3>
              <ul className="space-y-3">
                {group.items.map((a) => (
                  <li key={a.key} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-on-surface">{a.label}</span>
                    <DotRating
                      value={attributes[a.key] ?? 0}
                      min={0}
                      onChange={(v) => setAttribute(a.key, v)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section number="02" title="Virtudes & Alma" hint="Bolinhas começam vazias.">
        <div className="grid gap-3">
          {(
            [
              { key: 'conscience' as const, label: 'Consciência / Convicção' },
              { key: 'selfControl' as const, label: 'Autocontrole / Instinto' },
              { key: 'courage' as const, label: 'Coragem' },
            ] as const
          ).map((v) => (
            <div
              key={v.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/35 bg-surface-container-low px-4 py-3"
            >
              <span className="text-sm text-on-surface">{v.label}</span>
              <DotRating
                value={virtues[v.key]}
                min={0}
                tone="gold"
                onChange={(next) => setVirtue(v.key, next)}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatBox label="Humanidade" value={humanity} formula="Consciência + Autocontrole" />
          <StatBox label="Vontade Base" value={willpower} formula="Igual à Coragem" />
          <StatBox label="XP" value={0} formula="Começa 0/50 · só o narrador concede" />
        </div>
      </Section>

      <Section
        number="03"
        title="Vitalidade & Energia"
        hint="Escolha o dado de HP e Mana, role fora da tela e informe o resultado. A CA usa o dado da classe, sem escolha. Depois de criar, HP, Mana e CA ficam travados."
      >
        <div className={`grid gap-4 ${resources.showMana ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>
          <VitalField
            label="Dado de HP / Vida"
            die={hpDie}
            value={hpValue}
            max={hpMaxAllowed}
            onDieChange={(d) => setVitals({ hpDie: d, hpValue: null })}
            onValueChange={(v) => setVitals({ hpValue: v })}
          />
          {resources.showMana ? (
            <VitalField
              label={`Dado de ${resources.manaLabel}`}
              die={manaDie}
              value={manaValue}
              max={manaMaxAllowed}
              onDieChange={(d) => setVitals({ manaDie: d, manaValue: null })}
              onValueChange={(v) => setVitals({ manaValue: v })}
            />
          ) : (
            <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest/40 p-4 text-sm text-on-surface-variant">
              Esta espécie usa sangue / vontade em vez de mana — só o HP é definido aqui.
            </div>
          )}
          {caDie ? (
            <VitalField
              label={`Dado de CA · ${characterClass}`}
              die={caDie}
              value={caValue}
              max={caMaxAllowed}
              dieLocked
              onDieChange={() => undefined}
              onValueChange={(v) => setVitals({ caValue: v })}
            />
          ) : (
            <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest/40 p-4 text-sm text-on-surface-variant">
              Escolha a classe na etapa de identidade para liberar o dado de CA.
            </div>
          )}
        </div>
      </Section>
    </CharacterWizardLayout>
  )
}

function VitalField({
  label,
  die,
  value,
  max,
  dieLocked = false,
  onDieChange,
  onValueChange,
}: {
  label: string
  die: string
  value: number | null
  max: number
  dieLocked?: boolean
  onDieChange: (die: string) => void
  onValueChange: (value: number | null) => void
}) {
  return (
    <div className="rounded-lg border border-outline-variant/35 bg-surface-container-low p-4">
      <p className="text-[10px] font-bold tracking-wider text-secondary uppercase">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-[10px] uppercase text-on-surface-variant">
          Dado
          {dieLocked ? (
            <p className="mt-1 rounded border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 font-serif text-lg text-on-surface">
              {die}
            </p>
          ) : (
            <select
              className="input-feudal mt-1 pl-3 normal-case"
              value={die}
              onChange={(e) => onDieChange(e.target.value)}
            >
              {VITAL_DICE.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="block text-[10px] uppercase text-on-surface-variant">
          Valor rolado (1–{max})
          <input
            type="number"
            min={1}
            max={max}
            className="input-feudal mt-1 pl-3"
            value={value ?? ''}
            placeholder="Resultado"
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                onValueChange(null)
                return
              }
              const n = Number(raw)
              if (!Number.isFinite(n)) return
              onValueChange(Math.max(1, Math.min(max, Math.floor(n))))
            }}
          />
        </label>
      </div>
    </div>
  )
}

function StatBox({ label, value, formula }: { label: string; value: number; formula: string }) {
  return (
    <div className="rounded-lg border border-outline-variant/35 bg-surface-container-lowest/40 px-4 py-3 text-center">
      <p className="text-[10px] tracking-wider text-on-surface-variant uppercase">{label}</p>
      <p className="mt-1 font-serif text-2xl text-on-surface">{value}</p>
      <p className="mt-1 text-[10px] text-on-surface-variant">{formula}</p>
    </div>
  )
}

function Section({
  number,
  title,
  hint,
  children,
}: {
  number: string
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <section className="mb-10 last:mb-0">
      <p className="text-[10px] font-bold tracking-[0.2em] text-secondary uppercase">Seção {number}</p>
      <h2 className="mt-1 font-serif text-xl text-on-surface md:text-2xl">{title}</h2>
      {hint ? <p className="mt-1 mb-4 text-xs text-on-surface-variant">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}
