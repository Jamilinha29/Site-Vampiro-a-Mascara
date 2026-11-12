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

export function PlayerBestiaryExplorer({ query = '' }: { query?: string }) {
  const [tier, setTier] = useState<(typeof TIERS)[number]['id']>('known')
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
  const hp = entity.hpMax ?? 0
  const pe = entity.manaMax ?? 0
  const rarity = capitalize(entity.rarity ?? 'comum')
  const size = entity.creatureSize ?? sizeLabel(entity)
  const place = entity.sceneTrigger?.trim() || 'Sem local registrado'

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-2xl border bg-[#141414] ${
        active ? 'border-primary/70' : 'border-white/10'
      }`}
    >
      <div className="relative h-40 overflow-hidden bg-black">
        {entity.imageUrl ? (
          <img src={entity.imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_center,#1a2420,#090909)]">
            <span className="material-symbols-outlined text-4xl text-white/25">pest_control</span>
          </div>
        )}
        <span className="absolute top-2 right-2 rounded-full border border-white/20 bg-black/60 px-2 py-0.5 text-[10px] text-white/85">
          {rarity}
        </span>
      </div>

      <div className="flex flex-1 flex-col space-y-3 p-4">
        <div>
          <h4 className="font-serif text-lg leading-tight text-white">{entity.name}</h4>
          <p className="mt-1 text-[10px] tracking-wide text-white/50 uppercase">
            {entity.creatureType ?? 'Criatura'} · {tierLabel(tier)}
          </p>
        </div>

        <div className="space-y-2">
          <StatBar label="HP" current={hp} max={Math.max(hp, 1)} />
          <StatBar label="Mana" current={pe} max={Math.max(pe, 1)} variant="mana" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <p className="tracking-wider text-white/40 uppercase">Nível de ameaça</p>
            <p className="font-serif text-base text-white">
              {threatLevel(entity, tier)}
              <span className="text-xs text-white/40">/10</span>
            </p>
          </div>
          <div>
            <p className="tracking-wider text-white/40 uppercase">Defesa</p>
            <p className="text-sm text-white">{entity.defenseNote?.trim() || defenseLabel(entity)}</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] tracking-wide text-white/45 uppercase">
          <span className="truncate">{place}</span>
          <span className="shrink-0 rounded border border-white/15 px-2 py-0.5 text-white/80">{size}</span>
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
  const hp = entity.hpMax ?? 0
  const pe = entity.manaMax ?? 0
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
        </div>

        <div className="space-y-4 lg:col-span-8">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold tracking-wider text-secondary uppercase">Status de combate</p>
            <div className="grid grid-cols-2 gap-3">
              <StatBar label="HP" current={hp} max={Math.max(hp, 1)} />
              <StatBar label="Mana" current={pe} max={Math.max(pe, 1)} variant="mana" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 p-2.5">
              <p className="text-[9px] tracking-wider text-on-surface-variant uppercase">Ameaça</p>
              <p className="mt-1 font-serif text-lg text-secondary">
                {threat}
                <span className="text-sm text-on-surface-variant">/10</span>
              </p>
            </div>
            <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 p-2.5">
              <p className="text-[9px] tracking-wider text-on-surface-variant uppercase">Defesa</p>
              <p className="mt-1 text-xs text-on-surface">{entity.defenseNote?.trim() || defenseLabel(entity)}</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-secondary uppercase">Atributos</p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {attrs.map((a) => (
                <div
                  key={a.key}
                  className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 px-1 py-1.5 text-center"
                >
                  <p className="text-[9px] tracking-wider text-on-surface-variant uppercase">{a.key}</p>
                  <p className="font-numeric-stat text-sm text-on-surface">{a.value}</p>
                </div>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-5">
            <SheetFact label="Classificação" value={capitalize(entity.rarity ?? 'comum')} />
            <SheetFact label="Tamanho" value={entity.creatureSize ?? sizeLabel(entity)} />
            <SheetFact label="Velocidade" value={entity.creatureSpeed ?? speedLabel(entity)} />
            <SheetFact label="Peso" value={entity.weightKg != null ? `${entity.weightKg} kg` : '—'} />
            <SheetFact label="Sentidos" value={entity.creatureSenses ?? '—'} />
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
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
            <div className="rounded border border-outline-variant/35 bg-surface-container-lowest/40 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-secondary uppercase">
                <span className="material-symbols-outlined text-sm">menu_book</span>
                Informações públicas
              </p>
              <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                {entity.description || 'Lore ainda não revelado pelo narrador nesta camada do bestiário.'}
              </p>
              {entity.statsText ? (
                <pre className="mt-3 whitespace-pre-wrap text-xs text-on-surface-variant">{entity.statsText}</pre>
              ) : null}
            </div>
          </div>

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
                <p className="mt-2 text-sm text-on-surface">{entity.primaryAttackName?.trim() || '—'}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {entity.primaryAttackDesc?.trim() || '—'}
                </p>
              </div>
              <div className="rounded border border-secondary/30 bg-surface-container-lowest/40 p-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold text-primary uppercase">
                  <span className="material-symbols-outlined text-sm">bolt</span>
                  Ataque secundário
                </p>
                <p className="mt-2 text-sm text-on-surface">{entity.secondaryAttackName?.trim() || '—'}</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {entity.secondaryAttackDesc?.trim() || '—'}
                </p>
              </div>
            </div>
            {entity.sceneTrigger ? (
              <p className="mt-3 text-[11px] text-on-surface-variant">Gatilho de cena: {entity.sceneTrigger}</p>
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

function SheetFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-outline-variant/30 bg-surface-container-lowest/40 px-2 py-2">
      <dt className="text-[9px] tracking-wider text-on-surface-variant uppercase">{label}</dt>
      <dd className="mt-1 text-xs text-on-surface">{value}</dd>
    </div>
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
