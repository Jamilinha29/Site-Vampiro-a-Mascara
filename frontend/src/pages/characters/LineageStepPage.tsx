import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MORTAL_CLAN_OPTIONS, OTHER_SPECIES_OPTIONS } from '../../lib/characterOptions'
import { api } from '../../services/api'
import {
  useCharacterWizardStore,
  type FaithOrientation,
} from '../../stores/characterWizardStore'
import { CharacterWizardLayout } from './CharacterWizardLayout'

const SPECIES = [
  {
    id: 'vampiro',
    label: 'Vampiro / Cainita',
    badge: 'Opção padrão',
    desc: 'Predador da noite marcado pelo sangue de Caim. Fraquezas do clã e sede eternas.',
    icon: 'nightlight',
  },
  {
    id: 'mortal',
    label: 'Mortal / Ghoul / Caçador',
    desc: 'Humanos, servos do sangue ou caçadores da fé que andam entre as trevas.',
    icon: 'person',
  },
  {
    id: 'outros',
    label: 'Outras espécies',
    desc: 'Seres ocultos — escolha a espécie e, em seguida, o tipo. Requer aprovação do narrador.',
    icon: 'pets',
  },
]

const FAITH_ORIENTATIONS: { id: FaithOrientation; label: string; desc: string; accent: 'gold' | 'red' | 'muted' }[] = [
  {
    id: 'depois',
    label: 'Decidir depois',
    desc: 'Recomendado para novos jogadores. A orientação de fé fica oculta na próxima etapa.',
    accent: 'gold',
  },
  {
    id: 'verdadeira',
    label: 'Fé Verdadeira',
    desc: 'Rara. Devotos cuja fé fere a própria Noite — abre o caminho da Luz.',
    accent: 'red',
  },
  {
    id: 'paganismo',
    label: 'Paganismo',
    desc: 'Crenças antigas e cultos esquecidos — abre o caminho das Trevas.',
    accent: 'muted',
  },
]

export default function LineageStepPage() {
  const species = useCharacterWizardStore((s) => s.species)
  const clanId = useCharacterWizardStore((s) => s.clanId)
  const clanName = useCharacterWizardStore((s) => s.clanName)
  const otherSpeciesKind = useCharacterWizardStore((s) => s.otherSpeciesKind)
  const otherSpeciesType = useCharacterWizardStore((s) => s.otherSpeciesType)
  const faithOrientation = useCharacterWizardStore((s) => s.faithOrientation)
  const setSpecies = useCharacterWizardStore((s) => s.setSpecies)
  const setClan = useCharacterWizardStore((s) => s.setClan)
  const setOtherSpecies = useCharacterWizardStore((s) => s.setOtherSpecies)
  const setFaithOrientation = useCharacterWizardStore((s) => s.setFaithOrientation)
  const [clanQuery, setClanQuery] = useState('')

  const { data: clans } = useQuery({
    queryKey: ['clans'],
    queryFn: () => api.getCatalogClans(),
    enabled: species === 'vampiro',
  })

  const filteredClans = useMemo(() => {
    const list = clans ?? []
    const q = clanQuery.trim().toLowerCase()
    if (!q) return list
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q))
  }, [clans, clanQuery])

  const selectedOther = OTHER_SPECIES_OPTIONS.find((o) => o.id === otherSpeciesKind)

  return (
    <CharacterWizardLayout>
      <Section number="01" title="Definir Natureza Essencial" hint="Escolha a espécie fundamental do personagem.">
        <div className="space-y-3">
          {SPECIES.map((s) => {
            const selected = species === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSpecies(s.id)}
                className={`relative flex w-full items-start gap-4 rounded-lg border px-4 py-4 text-left transition ${
                  selected
                    ? 'border-primary-container bg-primary-container/10 shadow-[inset_0_0_0_1px_rgba(158,27,45,0.4)]'
                    : 'border-outline-variant/40 bg-surface-container-low hover:border-outline-variant'
                }`}
              >
                <span
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    selected ? 'border-primary-container bg-primary-container' : 'border-outline-variant'
                  }`}
                >
                  {selected ? <span className="material-symbols-outlined text-sm text-white">check</span> : null}
                </span>
                <span className="material-symbols-outlined text-2xl text-secondary">{s.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-serif text-lg text-on-surface">{s.label}</span>
                    {s.badge ? (
                      <span className="rounded bg-primary-container/25 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">
                        {s.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{s.desc}</span>
                </span>
              </button>
            )
          })}
        </div>

        {species === 'outros' ? (
          <div className="mt-5 space-y-4">
            <p className="text-[10px] font-bold tracking-wider text-secondary uppercase">Lista de espécies</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {OTHER_SPECIES_OPTIONS.map((opt) => {
                const selected = otherSpeciesKind === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setOtherSpecies(opt.id, null)}
                    className={`rounded-lg border px-3 py-3 text-left transition ${
                      selected
                        ? 'border-primary-container bg-primary-container/10'
                        : 'border-outline-variant/40 bg-surface-container-lowest/50 hover:border-outline-variant'
                    }`}
                  >
                    <span className="font-serif text-sm text-on-surface">{opt.label}</span>
                  </button>
                )
              })}
            </div>

            {selectedOther ? (
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-wider text-secondary uppercase">
                  Tipos de {selectedOther.label}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedOther.types.map((type) => {
                    const selected = otherSpeciesType === type
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setOtherSpecies(selectedOther.id, type)}
                        className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                          selected
                            ? 'border-secondary bg-secondary/10 text-on-surface'
                            : 'border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:border-outline-variant'
                        }`}
                      >
                        {type}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Section>

      {species === 'vampiro' ? (
        <Section
          number="02"
          title="Clã Vampírico na Idade das Trevas"
          hint="Catálogo dos clãs canônicos disponíveis na criação."
          action={
            <div className="relative w-full max-w-xs">
              <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-on-surface-variant">
                search
              </span>
              <input
                className="input-feudal py-2 pl-10 text-sm normal-case"
                placeholder="Filtrar clãs…"
                value={clanQuery}
                onChange={(e) => setClanQuery(e.target.value)}
              />
            </div>
          }
        >
          <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {filteredClans.map((clan) => {
              const selected = clanId === clan.id
              return (
                <button
                  key={clan.id}
                  type="button"
                  onClick={() => setClan(clan.id, clan.name)}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    selected
                      ? 'border-primary-container bg-primary-container/10'
                      : 'border-outline-variant/40 bg-surface-container-lowest/50 hover:border-outline-variant'
                  }`}
                >
                  <span className="font-serif text-base text-on-surface">{clan.name}</span>
                  <span className="mt-1 block text-[10px] tracking-wide text-secondary uppercase">
                    {clan.slug.replace(/-/g, ' ')}
                  </span>
                </button>
              )
            })}
            {!clans?.length ? (
              <p className="text-sm text-on-surface-variant sm:col-span-2">Carregando clãs do catálogo…</p>
            ) : null}
          </div>
        </Section>
      ) : null}

      {species === 'mortal' ? (
        <Section number="02" title="Ordem / Clã de Caçadores" hint="Escolha a ordem mortal que vincula o personagem.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MORTAL_CLAN_OPTIONS.map((name) => {
              const selected = clanName === name
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => setClan(name, name)}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    selected
                      ? 'border-primary-container bg-primary-container/10'
                      : 'border-outline-variant/40 bg-surface-container-lowest/50 hover:border-outline-variant'
                  }`}
                >
                  <span className="font-serif text-sm text-on-surface">{name}</span>
                </button>
              )
            })}
          </div>
        </Section>
      ) : null}

      <Section number="03" title="Orientação Espiritual & Crença" hint="Define se a fé aparece na etapa seguinte.">
        <div className="grid gap-3 md:grid-cols-3">
          {FAITH_ORIENTATIONS.map((f) => {
            const selected = faithOrientation === f.id
            const border =
              selected && f.accent === 'gold'
                ? 'border-secondary bg-secondary/10'
                : selected
                  ? 'border-primary-container bg-primary-container/10'
                  : 'border-outline-variant/40 bg-surface-container-low hover:border-outline-variant'
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFaithOrientation(f.id)}
                className={`rounded-lg border px-4 py-4 text-left transition ${border}`}
              >
                <span className="font-serif text-base text-on-surface">{f.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{f.desc}</span>
              </button>
            )
          })}
        </div>
      </Section>
    </CharacterWizardLayout>
  )
}

function Section({
  number,
  title,
  hint,
  action,
  children,
}: {
  number: string
  title: string
  hint?: string
  action?: ReactNode
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
        {action}
      </div>
      {children}
    </section>
  )
}
