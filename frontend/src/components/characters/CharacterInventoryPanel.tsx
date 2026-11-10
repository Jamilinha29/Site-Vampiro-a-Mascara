import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CharacterInventoryItem, ProfileCharacterSummary } from '../../types/profile'
import { StatBar } from '../domain/StatBar'

const CATEGORIES = [
  { id: 'all', label: 'Todos' },
  { id: 'weapon', label: 'Armas' },
  { id: 'armor', label: 'Armaduras' },
  { id: 'elixir', label: 'Elixires' },
  { id: 'ritual', label: 'Rituais' },
  { id: 'material', label: 'Materiais' },
  { id: 'trinket', label: 'Amuletos' },
] as const

const SLOT_LABELS: Record<NonNullable<CharacterInventoryItem['slot']>, string> = {
  head: 'Cabeça',
  torso: 'Tronco',
  hands: 'Mãos',
  feet: 'Pés',
  rings: 'Anéis',
  accessory: 'Acessório',
}

const rarityClass: Record<CharacterInventoryItem['rarity'], string> = {
  comum: 'border-outline-variant/50 text-on-surface-variant',
  incomum: 'border-secondary/40 text-secondary',
  raro: 'border-primary/50 text-primary',
  ancestral: 'border-primary bg-primary/15 text-primary',
  proibido: 'border-error-container bg-error-container/20 text-on-surface',
}

type Props = {
  character: ProfileCharacterSummary
  onChangeInventory: (items: CharacterInventoryItem[]) => Promise<void>
  busy?: boolean
}

export function CharacterInventoryPanel({ character, onChangeInventory, busy }: Props) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('all')
  const [sort, setSort] = useState<'rarity' | 'name' | 'weight'>('rarity')

  const items = character.inventory ?? []
  const capacity = character.carryCapacityKg ?? 28
  const load = items.reduce((s, i) => s + (i.weightKg || 0), 0)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = items.filter((i) => {
      if (category !== 'all' && i.category !== category) return false
      if (!q) return true
      return i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)
    })
    const rarityRank = { proibido: 0, ancestral: 1, raro: 2, incomum: 3, comum: 4 }
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'weight') return b.weightKg - a.weightKg
      return rarityRank[a.rarity] - rarityRank[b.rarity]
    })
    return list
  }, [items, query, category, sort])

  const equippedBySlot = useMemo(() => {
    const map: Partial<Record<NonNullable<CharacterInventoryItem['slot']>, CharacterInventoryItem>> = {}
    for (const item of items) {
      if (item.equipped && item.slot) map[item.slot] = item
    }
    return map
  }, [items])

  async function toggleEquip(item: CharacterInventoryItem) {
    const next = items.map((i) => {
      if (i.id !== item.id) {
        if (item.equipped === false && item.slot && i.slot === item.slot && i.equipped) {
          return { ...i, equipped: false }
        }
        return i
      }
      return { ...i, equipped: !i.equipped }
    })
    await onChangeInventory(next)
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="mesa-panel p-4 sm:p-5">
          <h3 className="font-label-sm text-xs text-secondary uppercase">Slots de equipamento corporal</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(SLOT_LABELS) as Array<keyof typeof SLOT_LABELS>).map((slot) => {
              const equipped = equippedBySlot[slot]
              return (
                <div
                  key={slot}
                  className="rounded border border-outline-variant/40 bg-surface-container-lowest/40 p-2 text-center"
                >
                  <p className="text-[10px] uppercase text-on-surface-variant">{SLOT_LABELS[slot]}</p>
                  <p className="mt-1 truncate text-xs text-on-surface">{equipped?.name ?? '—'}</p>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-3">
            <div>
              <p className="font-serif text-sm text-on-surface">Mercado noturno / loja da sessão</p>
              <p className="text-xs text-on-surface-variant">Elixires, armas de prata e pergaminhos entram neste inventário.</p>
            </div>
            <Link to="/user/shop" className="btn-primary text-xs">
              Visitar →
            </Link>
          </div>
        </section>

        <section className="mesa-panel space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input-feudal min-w-[10rem] flex-1 pl-4"
              placeholder="Buscar por item…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="input-feudal w-auto min-w-[9rem] pl-3"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="rarity">Ordenar: raridade</option>
              <option value="name">Ordenar: nome</option>
              <option value="weight">Ordenar: peso</option>
            </select>
            {CATEGORIES.map((c) => {
              const count = c.id === 'all' ? items.length : items.filter((i) => i.category === c.id).length
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`rounded px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase ${
                    category === c.id
                      ? 'bg-secondary/20 text-secondary'
                      : 'border border-outline-variant/40 text-on-surface-variant'
                  }`}
                  onClick={() => setCategory(c.id)}
                >
                  {c.label} ({count})
                </button>
              )
            })}
          </div>
          <StatBar
            label={`Carga ${load.toFixed(1)} / ${capacity.toFixed(1)} kg`}
            current={load}
            max={capacity}
            variant="xp"
          />
        </section>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {filtered.map((item) => (
          <article key={item.id} className="mesa-panel flex flex-col p-4">
            <div className="flex flex-wrap gap-1">
              {item.equipped ? (
                <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary uppercase">
                  Equipado
                </span>
              ) : (
                <span className="rounded bg-surface-container-high px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-on-surface-variant uppercase">
                  Na bolsa
                </span>
              )}
              <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase ${rarityClass[item.rarity]}`}>
                {item.rarity}
              </span>
              {item.status === 'broken' ? (
                <span className="rounded bg-error-container/30 px-1.5 py-0.5 text-[9px] font-bold uppercase">Quebrado</span>
              ) : null}
            </div>
            <div className="mt-3 flex h-24 items-center justify-center rounded border border-outline-variant/30 bg-surface-container-high">
              <span className="material-symbols-outlined text-3xl text-outline-variant">
                {item.category === 'weapon' ? 'swords' : item.category === 'elixir' ? 'science' : 'inventory_2'}
              </span>
            </div>
            <h3 className="mt-3 font-serif text-base text-on-surface">{item.name}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">{item.description || 'Sem descrição.'}</p>
            <p className="mt-2 text-[10px] text-secondary">
              {item.weightKg.toFixed(1)} kg
              {item.statsLabel ? ` · ${item.statsLabel}` : ''}
            </p>
            {item.durability ? (
              <div className="mt-2">
                <StatBar
                  label="Durabilidade"
                  current={item.durability.current}
                  max={item.durability.max}
                  variant="health"
                />
              </div>
            ) : null}
            <div className="mt-auto flex flex-wrap gap-2 pt-3">
              <button
                type="button"
                className="btn-secondary flex-1 text-[10px]"
                disabled={busy || item.status === 'broken'}
                onClick={() => void toggleEquip(item)}
              >
                {item.equipped ? 'Desequipar' : 'Equipar'}
              </button>
              <button type="button" className="btn-secondary text-[10px]" disabled>
                Inspecionar
              </button>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? (
          <p className="mesa-panel p-6 text-sm text-on-surface-variant sm:col-span-2">
            Inventário vazio para este personagem. Compras da loja da sessão e loot da mesa entram aqui.
          </p>
        ) : null}
      </div>

    </div>
  )
}
