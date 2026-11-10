import type { ReactNode } from 'react'
import { useCharacterWizardStore, wizardHasFaith } from '../../stores/characterWizardStore'
import { CharacterWizardLayout } from './CharacterWizardLayout'

const NATURES = [
  {
    id: 'autocrata',
    name: 'Autocrata',
    desc: 'Comanda e exige obediência.',
    willpower: 'Recupera Força de Vontade ao impor sua vontade sobre outros.',
  },
  {
    id: 'penitente',
    name: 'Penitente',
    desc: 'Busca redenção pelo passado.',
    willpower: 'Recupera ao confessar uma falha e aceitar penitência.',
  },
  {
    id: 'rebelde',
    name: 'Rebelde',
    desc: 'Desafia tradições e príncipes.',
    willpower: 'Recupera ao desafiar com sucesso uma autoridade.',
  },
  {
    id: 'solitario',
    name: 'Solitário',
    desc: 'Prefere sombras e autonomia.',
    willpower: 'Recupera ao resolver um problema sem ajuda alheia.',
  },
  {
    id: 'sobrevivente',
    name: 'Sobrevivente',
    desc: 'Adapta-se a qualquer caos.',
    willpower: 'Recupera ao escapar de uma ameaça letal.',
  },
  {
    id: 'visionario',
    name: 'Visionário',
    desc: 'Persegue um destino maior.',
    willpower: 'Recupera ao convencer outros de sua visão.',
  },
]

const DEMEANORS = [
  { id: 'cortesao', name: 'Cortesão', desc: 'Máscara de graça e protocolo na corte.' },
  { id: 'juiz', name: 'Juiz', desc: 'Avalia e sentencia com aparência de equilíbrio.' },
  { id: 'valentao', name: 'Valentão', desc: 'Impõe presença pela intimidação.' },
  { id: 'tradicionalista', name: 'Tradicionalista', desc: 'Defende costumes e hierarquias antigas.' },
  { id: 'benfeitor', name: 'Benfeitor', desc: 'Oferece favores — e cobranças — com sorriso.' },
  { id: 'diplomatico', name: 'Diplomata', desc: 'Media conflitos e esconde o punhal.' },
]

export default function ArchetypeStepPage() {
  const archetype = useCharacterWizardStore((s) => s.archetype)
  const demeanor = useCharacterWizardStore((s) => s.demeanor)
  const ambition = useCharacterWizardStore((s) => s.ambition)
  const secretWeakness = useCharacterWizardStore((s) => s.secretWeakness)
  const sireRelation = useCharacterWizardStore((s) => s.sireRelation)
  const species = useCharacterWizardStore((s) => s.species)
  const faithOrientation = useCharacterWizardStore((s) => s.faithOrientation)
  const faithPath = useCharacterWizardStore((s) => s.faithPath)
  const setArchetype = useCharacterWizardStore((s) => s.setArchetype)
  const setDemeanor = useCharacterWizardStore((s) => s.setDemeanor)
  const setIdentity = useCharacterWizardStore((s) => s.setIdentity)

  const showMotivation = species === 'vampiro' || wizardHasFaith({ faithOrientation, faithPath })

  return (
    <CharacterWizardLayout>
      <Section number="01" title="Selecionar Natureza" hint="A verdadeira alma">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NATURES.map((n) => {
            const selected = archetype === n.name
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setArchetype(n.name)}
                className={`rounded-lg border px-4 py-4 text-left transition ${
                  selected
                    ? 'border-primary-container bg-primary-container/10'
                    : 'border-outline-variant/40 bg-surface-container-low hover:border-outline-variant'
                }`}
              >
                <span className="font-serif text-base text-on-surface">{n.name}</span>
                <span className="mt-1 block text-xs text-on-surface-variant">{n.desc}</span>
                <span className="mt-2 block text-[10px] leading-relaxed text-secondary">{n.willpower}</span>
              </button>
            )
          })}
        </div>
      </Section>

      <Section number="02" title="Selecionar Comportamento" hint="A máscara social">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEMEANORS.map((d) => {
            const selected = demeanor === d.name
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDemeanor(d.name)}
                className={`rounded-lg border px-4 py-4 text-left transition ${
                  selected
                    ? 'border-secondary bg-secondary/10'
                    : 'border-outline-variant/40 bg-surface-container-low hover:border-outline-variant'
                }`}
              >
                <span className="font-serif text-base text-on-surface">{d.name}</span>
                <span className="mt-1 block text-xs text-on-surface-variant">{d.desc}</span>
              </button>
            )
          })}
        </div>
      </Section>

      {showMotivation ? (
        <Section number="03" title="Motivação Feudal & Juramento de Sangue">
          <div className="grid gap-4">
            <label className="block">
              <span className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
                Juramento Sagrado / Ambição
              </span>
              <input
                className="input-feudal mt-1 pl-4 normal-case"
                value={ambition}
                onChange={(e) => setIdentity({ ambition: e.target.value })}
                placeholder="Ex.: Restaurar a linhagem Cainita sobre a cidadela…"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
                Fraqueza Secreta da Alma
              </span>
              <input
                className="input-feudal mt-1 pl-4 normal-case"
                value={secretWeakness}
                onChange={(e) => setIdentity({ secretWeakness: e.target.value })}
                placeholder="Ex.: Pavor irracional do fogo inquisitorial…"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
                Relação com o Senhor (Sire)
              </span>
              <input
                className="input-feudal mt-1 pl-4 normal-case"
                value={sireRelation}
                onChange={(e) => setIdentity({ sireRelation: e.target.value })}
                placeholder="Ex.: Rivalidade silenciosa — busca suplantá-lo…"
              />
            </label>
          </div>
        </Section>
      ) : null}
    </CharacterWizardLayout>
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
      {hint ? <p className="mb-4 text-[11px] tracking-wide text-secondary uppercase">{hint}</p> : <div className="mb-4" />}
      {children}
    </section>
  )
}
