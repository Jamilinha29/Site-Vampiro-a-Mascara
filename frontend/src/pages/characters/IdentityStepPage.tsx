import { useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CHARACTER_CLASS_OPTIONS,
  SOCIAL_RANK_BY_SPECIES,
} from '../../lib/characterOptions'
import { api } from '../../services/api'
import {
  useCharacterWizardStore,
  wizardHasFaith,
  type FaithPathChoice,
} from '../../stores/characterWizardStore'
import { CharacterWizardLayout } from './CharacterWizardLayout'

const FAITH_CARDS: Record<FaithPathChoice, { label: string; desc: string }> = {
  luz: {
    label: 'Caminho Iluminado',
    desc: 'Fé da Luz. Escolha uma catedral publicada pelo narrador.',
  },
  trevas: {
    label: 'Caminho Negro',
    desc: 'Fé das Trevas. Escolha uma catedral publicada pelo narrador.',
  },
}

export default function IdentityStepPage() {
  const store = useCharacterWizardStore()
  const showFaithSection = store.faithOrientation !== 'depois' && store.faithOrientation !== null
  const hasFaith = wizardHasFaith(store)
  const ranks = SOCIAL_RANK_BY_SPECIES[store.species ?? ''] ?? []
  const isNoble = store.socialRank === 'Nobre'

  const faithPath = useCharacterWizardStore((s) => s.faithPath)
  const setFaithPath = useCharacterWizardStore((s) => s.setFaithPath)
  const lockedPath: FaithPathChoice | null =
    store.faithOrientation === 'verdadeira'
      ? 'luz'
      : store.faithOrientation === 'paganismo'
        ? 'trevas'
        : faithPath

  useEffect(() => {
    if (lockedPath && faithPath !== lockedPath) {
      setFaithPath(lockedPath)
    }
  }, [lockedPath, faithPath, setFaithPath])

  const { data: cathedrals = [], isLoading: cathedralsLoading } = useQuery({
    queryKey: ['catalog-cathedrals', lockedPath ?? 'none'],
    queryFn: () => api.getCatalogCathedrals(lockedPath ?? undefined),
    enabled: showFaithSection && !!lockedPath,
  })

  return (
    <CharacterWizardLayout>
      {showFaithSection && lockedPath ? (
        <Section number="01" title="Orientação de Fé & Dogma Espiritual">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-secondary bg-secondary/10 px-4 py-4">
              <span className="font-serif text-base text-on-surface">{FAITH_CARDS[lockedPath].label}</span>
              <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                {FAITH_CARDS[lockedPath].desc}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded border border-secondary/30 bg-secondary/5 p-4">
            <p className="text-[10px] font-bold tracking-wider text-secondary uppercase">
              Catedrais
            </p>
            {cathedralsLoading ? (
              <p className="mt-2 text-sm text-on-surface-variant">Carregando catedrais…</p>
            ) : cathedrals.length === 0 ? (
              <p className="mt-2 text-sm text-on-surface-variant">
                Nenhuma catedral neste caminho. O narrador cadastra em Referências → Fé, com o caminho Luz ou Trevas.
              </p>
            ) : (
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cathedrals.map((c) => {
                  const selected = store.cathedralId === c.id
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => store.setCathedral(c.id, c.name)}
                        className={`w-full rounded border px-3 py-3 text-left transition ${
                          selected
                            ? 'border-primary-container bg-primary-container/10'
                            : 'border-outline-variant/30 bg-surface-container-lowest/40 hover:border-outline-variant'
                        }`}
                      >
                        <p className="text-sm text-on-surface">{c.name}</p>
                        {c.precepts.length ? (
                          <p className="mt-1 text-[10px] text-on-surface-variant">{c.precepts.join(' · ')}</p>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Section>
      ) : null}

      <Section
        number={showFaithSection ? '02' : '01'}
        title="Identidade & Registro do Personagem"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Nome de Batismo ou Nome de Guerra"
            required
            value={store.name}
            onChange={(v) => store.setIdentity({ name: v })}
            placeholder="Ex.: Aldric von Carstein"
          />
          <Field
            label="Título Nobiliárquico ou Epíteto Medieval"
            value={store.title}
            onChange={(v) => store.setIdentity({ title: v })}
            placeholder="Ex.: Cavaleiro da Ordem de São Tiago"
          />

          <label className="block">
            <span className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
              Condição social
            </span>
            <select
              className="input-feudal mt-1 pl-4 normal-case"
              value={store.socialRank ?? ''}
              onChange={(e) => store.setSocialRank(e.target.value || null)}
            >
              <option value="">Selecionar…</option>
              {ranks.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
              Classe
            </span>
            <select
              className="input-feudal mt-1 pl-4 normal-case"
              value={store.characterClass ?? ''}
              onChange={(e) => store.setCharacterClass(e.target.value || null)}
            >
              <option value="">Selecionar…</option>
              {CHARACTER_CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {isNoble ? (
            <Field
              label="Senhor Feudal / Sire de Sangue"
              required
              value={store.sire}
              onChange={(v) => store.setIdentity({ sire: v })}
              placeholder="Ex.: Conde Vencel Rikard de Buda"
            />
          ) : null}

          {hasFaith ? (
            <Field
              label="Conceito Primordial Sintético"
              value={store.concept}
              onChange={(v) => store.setIdentity({ concept: v })}
              placeholder="Ex.: Diplomata Cruzado Rejeitado"
            />
          ) : null}
        </div>
      </Section>
    </CharacterWizardLayout>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold tracking-wider text-on-surface-variant uppercase">
        {label}
        {required ? <span className="text-primary"> *</span> : null}
      </span>
      <input
        className="input-feudal mt-1 pl-4 normal-case"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  )
}

function Section({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="mb-10 last:mb-0">
      <p className="text-[10px] font-bold tracking-[0.2em] text-secondary uppercase">Seção {number}</p>
      <h2 className="mt-1 mb-4 font-serif text-xl text-on-surface md:text-2xl">{title}</h2>
      {children}
    </section>
  )
}
