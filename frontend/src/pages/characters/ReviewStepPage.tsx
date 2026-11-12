import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DotRating } from '../../components/domain/DotRating'
import { classArmorDie, OTHER_SPECIES_OPTIONS } from '../../lib/characterOptions'
import {
  ABILITY_GROUPS,
  ATTRIBUTE_GROUPS,
  useCharacterWizardStore,
} from '../../stores/characterWizardStore'
import { CharacterWizardLayout } from './CharacterWizardLayout'

const SPECIES_LABELS: Record<string, string> = {
  vampiro: 'Vampiros',
  mortal: 'Caçadores',
  outros: 'Outras espécies',
}

const EDIT_LINKS = [
  { label: 'Linhagem & Clã', path: '/user/characters/new/lineage' },
  { label: 'Identidade & Fé', path: '/user/characters/new/identity' },
  { label: 'Arquétipo & Natureza', path: '/user/characters/new/archetype' },
  { label: 'Atributos & Virtudes', path: '/user/characters/new/attributes' },
  { label: 'Habilidades', path: '/user/characters/new/powers' },
]

export default function ReviewStepPage() {
  const store = useCharacterWizardStore()
  const setOathAccepted = useCharacterWizardStore((s) => s.setOathAccepted)
  const humanity = store.virtues.conscience + store.virtues.selfControl

  return (
    <CharacterWizardLayout>
      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-secondary/35 bg-secondary/5 p-5 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-outline-variant/40 bg-surface-container-lowest">
          <span className="material-symbols-outlined text-4xl text-secondary">person</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-serif text-2xl text-on-surface md:text-3xl">
              {store.name.trim() || 'Personagem sem nome'}
            </h2>
            <span className="rounded border border-secondary/50 bg-secondary/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-secondary uppercase">
              Pronto p/ o jogo
            </span>
          </div>
          <p className="mt-1 text-sm text-on-surface-variant">
            {SPECIES_LABELS[store.species ?? ''] ?? 'Espécie indefinida'}
            {store.otherSpeciesKind
              ? ` · ${OTHER_SPECIES_OPTIONS.find((o) => o.id === store.otherSpeciesKind)?.label ?? store.otherSpeciesKind}`
              : ''}
            {store.otherSpeciesType ? ` (${store.otherSpeciesType})` : ''}
            {store.clanName ? ` · Clã ${store.clanName}` : ''}
            {store.title ? ` · ${store.title}` : ''}
          </p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {store.socialRank ? `Condição: ${store.socialRank}` : 'Condição social indefinida'}
            {store.characterClass ? ` · Classe: ${store.characterClass}` : ''}
            {store.sire ? ` · Senhor / Sire: ${store.sire}` : ''}
            {store.concept ? ` · Conceito: ${store.concept}` : ''}
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {EDIT_LINKS.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className="inline-flex items-center gap-1 rounded border border-outline-variant/40 bg-surface-container-low px-3 py-1.5 text-[11px] text-on-surface transition hover:border-secondary hover:text-secondary"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            Editar {link.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <Panel title="Atributos em destaque">
            <div className="grid gap-4 sm:grid-cols-3">
              {ATTRIBUTE_GROUPS.map((group) => (
                <div key={group.category}>
                  <p className="mb-2 text-[10px] font-bold tracking-wider text-secondary uppercase">
                    {group.category}
                  </p>
                  <ul className="space-y-2">
                    {group.items.map((a) => (
                      <li key={a.key} className="flex items-center justify-between gap-2 text-xs">
                        <span>{a.label}</span>
                        <DotRating value={store.attributes[a.key] ?? 1} readOnly />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Habilidades feudais">
            <div className="grid gap-4 sm:grid-cols-3">
              {ABILITY_GROUPS.map((group) => (
                <div key={group.category}>
                  <p className="mb-2 text-[10px] font-bold tracking-wider text-secondary uppercase">
                    {group.category}
                  </p>
                  <ul className="space-y-1.5 text-xs">
                    {group.items.map((a) => {
                      const v = store.abilities[a.key] ?? 0
                      if (!v) return null
                      return (
                        <li key={a.key} className="flex justify-between gap-2">
                          <span>{a.label}</span>
                          <span className="text-secondary">{v}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Habilidades criadas">
            {store.createdSkills.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Nenhuma habilidade criada.</p>
            ) : (
              <ul className="space-y-3">
                {store.createdSkills.map((skill) => (
                  <li key={skill.id} className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 p-3">
                    <p className="font-serif text-sm text-on-surface">{skill.name}</p>
                    <p className="text-[10px] tracking-wide text-secondary uppercase">
                      {skill.die} · {skill.attribute}{' '}
                      {skill.attributeMod >= 0 ? `+${skill.attributeMod}` : skill.attributeMod}
                    </p>
                    {skill.howItWorks ? (
                      <p className="mt-1 text-xs text-on-surface-variant">{skill.howItWorks}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Virtudes & alma">
            <ul className="space-y-2">
              <li className="flex items-center justify-between gap-2 text-sm">
                <span>Consciência</span>
                <DotRating value={store.virtues.conscience} readOnly tone="gold" />
              </li>
              <li className="flex items-center justify-between gap-2 text-sm">
                <span>Autocontrole</span>
                <DotRating value={store.virtues.selfControl} readOnly tone="gold" />
              </li>
              <li className="flex items-center justify-between gap-2 text-sm">
                <span>Coragem</span>
                <DotRating value={store.virtues.courage} readOnly tone="gold" />
              </li>
            </ul>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Humanidade" value={humanity} />
              <MiniStat label="Vontade" value={store.virtues.courage} />
              <MiniStat label="XP" value={0} />
            </div>
          </Panel>

          <Panel title="Vitalidade (travada após criar)">
            <dl className="space-y-2 text-sm">
              <Row label="HP" value={store.hpValue != null ? `${store.hpValue} (${store.hpDie})` : '—'} />
              <Row
                label="Mana"
                value={store.manaValue != null ? `${store.manaValue} (${store.manaDie})` : '—'}
              />
              <Row
                label="CA"
                value={
                  store.caValue != null
                    ? `${store.caValue} (${classArmorDie(store.characterClass) ?? '—'})`
                    : '—'
                }
              />
            </dl>
            <p className="mt-2 text-[11px] text-on-surface-variant">
              Após concluir, HP/Mana não podem ser editados; sobem +5 a cada nível.
            </p>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Arquétipo & máscara">
            <dl className="space-y-2 text-sm">
              <Row label="Natureza" value={store.archetype} />
              <Row label="Comportamento" value={store.demeanor} />
              <Row label="Ambição" value={store.ambition} />
              <Row label="Fraqueza secreta" value={store.secretWeakness} />
              <Row label="Relação com o sire" value={store.sireRelation} />
            </dl>
          </Panel>

          <Panel title="Identidade & fé">
            <dl className="space-y-2 text-sm">
              <Row label="Fé (orientação)" value={faithOrientationLabel(store.faithOrientation)} />
              <Row label="Caminho" value={faithPathLabel(store.faithPath)} />
              <Row label="Catedral" value={store.cathedralName} />
              <Row label="Condição social" value={store.socialRank} />
              <Row label="Classe" value={store.characterClass} />
              <Row label="Origem" value={store.origin} />
            </dl>
          </Panel>

          <Panel title="Juramento de lealdade">
            <p className="mb-3 text-xs text-on-surface-variant">
              Ao concluir, o personagem será inscrito nos registros feudais da crônica. Use os links
              &quot;Editar&quot; acima para corrigir qualquer campo antes de finalizar.
            </p>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={store.oathAccepted}
                onChange={(e) => setOathAccepted(e.target.checked)}
              />
              <span>
                Concordo com as Seis Tradições configuradas para esta mesa e juro lealdade à crônica.
              </span>
            </label>
          </Panel>
        </div>
      </div>
    </CharacterWizardLayout>
  )
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-outline-variant/35 bg-surface-container-low/60 p-4">
      <h3 className="mb-3 font-serif text-lg text-on-surface">{title}</h3>
      {children}
    </section>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="text-right text-on-surface">{value?.trim() || '—'}</dd>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/50 px-2 py-2">
      <p className="text-[9px] tracking-wider text-on-surface-variant uppercase">{label}</p>
      <p className="font-serif text-xl text-on-surface">{value}</p>
    </div>
  )
}

function faithOrientationLabel(v: string | null) {
  if (v === 'depois') return 'Decidir depois'
  if (v === 'verdadeira') return 'Luz'
  if (v === 'paganismo') return 'Trevas'
  return '—'
}

function faithPathLabel(v: string | null) {
  if (v === 'luz') return 'Caminho Iluminado'
  if (v === 'trevas') return 'Caminho Negro'
  return '—'
}
