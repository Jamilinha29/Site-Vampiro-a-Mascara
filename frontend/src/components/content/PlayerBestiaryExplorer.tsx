import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type { ChronicleEntity } from '../../types/chronicle'
import { StatBar } from '../domain/StatBar'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'

const TIERS = [
  { id: 'known' as const, label: 'Conhecidas' },
  { id: 'classified' as const, label: 'Classificado' },
  { id: 'rumors' as const, label: 'Rumores' },
]

export function PlayerBestiaryExplorer() {
  const [tier, setTier] = useState<(typeof TIERS)[number]['id']>('known')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data = [], isLoading } = useQuery({
    queryKey: playerQueryKeys.bestiary(tier),
    queryFn: () => api.getBestiaryContent(tier),
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.creatureType ?? '').toLowerCase().includes(q) ||
        (e.rarity ?? '').toLowerCase().includes(q),
    )
  }, [data, query])

  const selected = selectedId ? (filtered.find((e) => e.id === selectedId) ?? null) : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-headline-sm text-lg text-on-surface">Glossário geral de ameaças</h2>
          <p className="text-sm text-on-surface-variant">
            Antagonistas e bestas revelados pelo mestre — fichas táticas distintas das fichas de jogador.
          </p>
        </div>
        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-on-surface-variant">
            search
          </span>
          <input
            className="input-feudal w-full pl-10"
            placeholder="Buscar por criatura, tipo, clã…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TIERS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-semibold tracking-wider uppercase ${
              tier === t.id
                ? 'bg-primary-container text-white'
                : 'border border-outline-variant/40 text-on-surface-variant'
            }`}
            onClick={() => {
              setTier(t.id)
              setSelectedId(null)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-on-surface-variant">Consultando bestiário…</p> : null}

      {selected ? (
        <BestiaryDetail entity={selected} tier={tier} audience="player" onClose={() => setSelectedId(null)} />
      ) : null}

      <div>
        <h3 className="font-label-sm mb-3 text-xs text-secondary uppercase">
          Catálogo tático de bestas & antagonistas
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((entity) => (
            <BestiaryCard
              key={entity.id}
              entity={entity}
              tier={tier}
              active={selected?.id === entity.id}
              onOpen={() => setSelectedId(entity.id)}
            />
          ))}
          {!isLoading && filtered.length === 0 ? (
            <p className="text-sm text-on-surface-variant sm:col-span-2 xl:col-span-4">
              Nenhuma ameaça nesta camada.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function BestiaryCard({
  entity,
  tier,
  active,
  onOpen,
}: {
  entity: ChronicleEntity
  tier: string
  active: boolean
  onOpen: () => void
}) {
  const hp = entity.hpMax ?? 40
  const pe = entity.manaMax ?? 20
  const meta = cardMeta(entity, tier)

  return (
    <article
      className={`mesa-panel flex flex-col overflow-hidden p-0 ${
        active ? 'border-primary/60 ring-1 ring-primary/35' : ''
      }`}
    >
      <div className="relative h-36 overflow-hidden bg-surface-container-high">
        {entity.imageUrl ? (
          <img src={entity.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-outline-variant">pest_control</span>
          </div>
        )}
        {entity.rarity === 'ancestral' || entity.rarity === 'proibido' ? (
          <span className="absolute top-2 left-2 rounded border border-secondary/50 bg-surface-container-lowest/90 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-secondary uppercase">
            {entity.rarity === 'proibido' ? 'Boss' : 'Elite'}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col space-y-3 p-4">
        <div>
          <h4 className="font-serif text-lg leading-tight text-on-surface">{entity.name}</h4>
          <p className="mt-1 text-[10px] tracking-wide text-on-surface-variant uppercase">
            {entity.creatureType ?? 'Criatura'} · {tierLabel(tier)}
          </p>
        </div>

        <div className="space-y-2">
          <StatBar label="Vitalidade" current={hp} max={hp} />
          <StatBar label="Energia / mana" current={pe} max={pe} variant="mana" />
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px]">
          {meta.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-on-surface-variant uppercase">{row.label}</dt>
              <dd className="truncate font-medium text-on-surface">{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/50 p-2.5">
          <p className="flex gap-1.5 text-[11px] leading-snug text-on-surface-variant">
            <span className="material-symbols-outlined mt-0.5 shrink-0 text-sm text-secondary">visibility</span>
            <span className="line-clamp-3">{entity.description || 'Sem descrição pública.'}</span>
          </p>
        </div>

        <button type="button" className="btn-primary w-full text-[10px]" onClick={onOpen}>
          Ver ficha completa
        </button>
      </div>
    </article>
  )
}

export function BestiaryDetail({
  entity,
  tier,
  onClose,
  audience = 'player',
}: {
  entity: ChronicleEntity
  tier: string
  onClose?: () => void
  audience?: 'player' | 'narrator'
}) {
  const hp = entity.hpMax ?? 140
  const pe = entity.manaMax ?? 24
  const threat = threatLevel(entity, tier)
  const attrs = attributeGrid(entity)
  const passives = passiveTraits(entity)
  const subtitle = [
    entity.rarity ? capitalize(entity.rarity) : null,
    entity.creatureType,
    tierLabel(tier),
  ]
    .filter(Boolean)
    .join(' / ')

  return (
    <section className="mesa-panel space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-[10px] tracking-wider text-on-surface-variant uppercase">
          Bestiário / {entity.creatureType ?? 'Ameaça'} / {entity.name}
        </p>
        {onClose ? (
          <button
            type="button"
            className="text-on-surface-variant hover:text-on-surface"
            aria-label="Fechar arquivo"
            onClick={onClose}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <div>
            <h3 className="font-serif text-2xl text-secondary">{entity.name}</h3>
            <p className="mt-1 text-xs text-on-surface-variant">{subtitle}</p>
          </div>

          <div className="overflow-hidden rounded border border-outline-variant/40 bg-surface-container-high">
            <div className="flex aspect-square items-center justify-center">
              {entity.imageUrl ? (
                <img src={entity.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-5xl text-outline-variant">pest_control</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <StatBar label="Pontos de vida (HP)" current={hp} max={hp} />
            <StatBar label="Pontos de energia" current={pe} max={pe} variant="mana" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 p-2.5">
              <p className="text-[9px] tracking-wider text-on-surface-variant uppercase">Nível de ameaça</p>
              <p className="mt-1 font-serif text-lg text-secondary">
                {threat}
                <span className="text-sm text-on-surface-variant">/10</span>
              </p>
            </div>
            <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 p-2.5">
              <p className="text-[9px] tracking-wider text-on-surface-variant uppercase">Defesa / armadura</p>
              <p className="mt-1 text-xs text-on-surface">{entity.defenseNote?.trim() || defenseLabel(entity)}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-secondary uppercase">Atributos</p>
            <div className="grid grid-cols-3 gap-1.5">
              {attrs.map((a) => (
                <div
                  key={a.key}
                  className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 px-2 py-1.5 text-center"
                >
                  <p className="text-[9px] tracking-wider text-on-surface-variant uppercase">{a.key}</p>
                  <p className="font-numeric-stat text-sm text-on-surface">{a.value}</p>
                </div>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <dt className="text-on-surface-variant uppercase">Tamanho</dt>
              <dd className="text-on-surface">{entity.creatureSize ?? sizeLabel(entity)}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant uppercase">Velocidade</dt>
              <dd className="text-on-surface">{entity.creatureSpeed ?? speedLabel(entity)}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant uppercase">Sentidos</dt>
              <dd className="text-on-surface">{entity.creatureSenses ?? 'Visão noturna'}</dd>
            </div>
          </dl>

          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-secondary uppercase">Traços passivos</p>
            <ul className="space-y-1.5">
              {passives.map((p) => (
                <li
                  key={p}
                  className="rounded border border-outline-variant/25 bg-surface-container-lowest/30 px-2.5 py-1.5 text-[11px] text-on-surface-variant"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <div className="rounded border border-secondary/35 bg-secondary/5 p-4">
            <p className="text-[10px] font-semibold tracking-wider text-secondary uppercase">
              Combate & comportamento tático
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-secondary/30 bg-surface-container-lowest/40 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-primary uppercase">
                  <span className="material-symbols-outlined text-sm">swords</span>
                  Ataque principal
                </p>
                <p className="mt-2 text-sm text-on-surface">{entity.primaryAttackName ?? 'Golpe devastador'}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {entity.primaryAttackDesc?.trim() ||
                    entity.statsText?.split(/[·\n]/)[0]?.trim() ||
                    'Dano físico bruto em corpo a corpo.'}
                </p>
              </div>
              <div className="rounded border border-secondary/30 bg-surface-container-lowest/40 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-primary uppercase">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  Ataque secundário
                </p>
                <p className="mt-2 text-sm text-on-surface">{entity.secondaryAttackName ?? 'Investida / pressão'}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {entity.secondaryAttackDesc?.trim() ||
                    'Avanço tático para romper formação e forçar teste de resistência.'}
                </p>
              </div>
            </div>
            {entity.sceneTrigger ? (
              <p className="mt-3 text-[11px] text-on-surface-variant">Gatilho de cena: {entity.sceneTrigger}</p>
            ) : null}
          </div>

          <div className="rounded border border-outline-variant/35 bg-surface-container-lowest/40 p-4">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-secondary uppercase">
              <span className="material-symbols-outlined text-sm">menu_book</span>
              Informações públicas para jogadores
            </p>
            <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              {entity.description || 'Lore ainda não revelado pelo narrador nesta camada do bestiário.'}
            </p>
            {entity.statsText ? (
              <pre className="mt-3 whitespace-pre-wrap rounded border border-outline-variant/25 bg-surface-container-high/40 p-3 text-xs text-on-surface-variant">
                {entity.statsText}
              </pre>
            ) : null}
          </div>

          {audience === 'narrator' ? (
            <div className="rounded border border-primary/50 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold tracking-wider text-primary uppercase">
                  Informações secretas & notas do mestre
                </p>
                <span className="rounded border border-primary/40 bg-primary/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-primary uppercase">
                  Top secret / narrador
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-on-surface-variant">
                {entity.narratorNotes?.trim() ||
                  'Imunidades, regeneração, fase 2 e drops — preencha em Glossário (ADM) no campo notas secretas.'}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function tierLabel(tier: string) {
  if (tier === 'classified') return 'Classificado'
  if (tier === 'rumors') return 'Rumor'
  return 'Conhecida'
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function cardMeta(entity: ChronicleEntity, tier: string) {
  return [
    { label: 'Classificação', value: capitalize(entity.rarity ?? 'comum') },
    { label: 'Tipo', value: entity.creatureType ?? '—' },
    { label: 'Camada', value: tierLabel(tier) },
    {
      label: 'Carga',
      value: entity.weightKg != null ? `${entity.weightKg} kg` : '—',
    },
  ]
}

function threatLevel(entity: ChronicleEntity, tier: string) {
  if (entity.rarity === 'proibido') return 9
  if (entity.rarity === 'ancestral') return 8
  if (entity.rarity === 'raro') return 6
  if (tier === 'classified') return 5
  if (tier === 'rumors') return 4
  return 3
}

function defenseLabel(entity: ChronicleEntity) {
  const def = entity.attributeMods?.find((m) => m.attr === 'defesa')
  if (def) return `${Math.abs(def.value)} pts absorção`
  const hp = entity.hpMax ?? 40
  if (hp >= 120) return '4 pts absorção rígida'
  if (hp >= 60) return '2 pts absorção'
  return '1 pt absorção leve'
}

function sizeLabel(entity: ChronicleEntity) {
  const hp = entity.hpMax ?? 40
  if (hp >= 120) return 'Enorme'
  if (hp >= 70) return 'Grande'
  return 'Médio'
}

function speedLabel(entity: ChronicleEntity) {
  const vel = entity.attributeMods?.find((m) => m.attr === 'velocidade')
  if (vel) return `${10 + Math.abs(vel.value) * 2} m`
  return '9 m'
}

function attributeGrid(entity: ChronicleEntity) {
  if (entity.creatureStats) {
    return [
      { key: 'FOR', value: entity.creatureStats.for },
      { key: 'DES', value: entity.creatureStats.des },
      { key: 'VIG', value: entity.creatureStats.vig },
      { key: 'INT', value: entity.creatureStats.int },
      { key: 'SAB', value: entity.creatureStats.sab },
      { key: 'CAR', value: entity.creatureStats.car },
    ]
  }
  const base = [
    { key: 'FOR', from: 'forca', fallback: 3 },
    { key: 'DES', from: 'velocidade', fallback: 2 },
    { key: 'VIG', from: 'defesa', fallback: 3 },
    { key: 'INT', from: 'mana', fallback: 2 },
    { key: 'SAB', from: 'maldicao', fallback: 2 },
    { key: 'CAR', from: 'veneno', fallback: 1 },
  ]
  return base.map((b) => {
    const mod = entity.attributeMods?.find((m) => m.attr === b.from)
    const value = mod ? Math.min(5, Math.max(1, Math.abs(mod.value) + 1)) : scaleFromHp(entity.hpMax, b.fallback)
    return { key: b.key, value }
  })
}

function scaleFromHp(hpMax: number | undefined, fallback: number) {
  if (!hpMax) return fallback
  if (hpMax >= 140) return Math.min(5, fallback + 2)
  if (hpMax >= 80) return Math.min(5, fallback + 1)
  return fallback
}

function passiveTraits(entity: ChronicleEntity) {
  if (entity.passiveTraits?.length) return entity.passiveTraits.slice(0, 6)
  const list: string[] = []
  if (entity.creatureType) list.push(`Natureza: ${entity.creatureType}`)
  if (entity.rarity === 'proibido') list.push('Presença abominável')
  if (entity.rarity === 'ancestral') list.push('Resistência corrompida')
  const mods = entity.attributeMods ?? []
  for (const m of mods.slice(0, 2)) {
    list.push(`${m.value > 0 ? '+' : ''}${m.value} ${m.attr}`)
  }
  if (list.length === 0) {
    list.push('Resistência a cortes', 'Sentidos aguçados')
  }
  return list.slice(0, 4)
}
