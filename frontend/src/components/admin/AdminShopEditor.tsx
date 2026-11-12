import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { readProfileImageFile } from '../../lib/profileMedia'
import {
  ATTR_KEYS,
  CONSUMABLE_KINDS,
  EQUIPMENT_TYPES,
  MAX_ATTRIBUTE_MODS,
  RELIC_AMULET_TYPES,
  SERVICE_TYPES,
} from '../../lib/glossaryCatalog'
import { invalidatePlayerPublishedContent } from '../../lib/queryKeys'
import type { AttributeMod, CreateEntityPayload, EntityKind } from '../../types/chronicle'
import { api } from '../../services/api'
import { useReferenceNames } from '../../hooks/useReferenceNames'

type ShopTab = 'gear' | 'relic' | 'services' | 'consumables'

export function AdminShopEditor() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<ShopTab>('gear')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState<string | undefined>()
  const equipmentNames = useReferenceNames('equipment_type', EQUIPMENT_TYPES)
  const relicNames = useReferenceNames('relic', RELIC_AMULET_TYPES)
  const [equipmentType, setEquipmentType] = useState<string>(EQUIPMENT_TYPES[0])
  const [relicType, setRelicType] = useState<string>(RELIC_AMULET_TYPES[0])
  const [serviceType, setServiceType] = useState<(typeof SERVICE_TYPES)[number]>(SERVICE_TYPES[0])
  const [consumableKind, setConsumableKind] = useState<'daily' | 'food'>('food')
  const [mods, setMods] = useState<AttributeMod[]>([])
  const [priceAmount, setPriceAmount] = useState(2)
  const [priceCoin, setPriceCoin] = useState<'ouro' | 'prata' | 'bronze'>('prata')
  const [stockTotal, setStockTotal] = useState(10)
  const [error, setError] = useState<string | null>(null)
  const [publishOnSave, setPublishOnSave] = useState(true)
  const [vitrineQuery, setVitrineQuery] = useState('')

  const kind: EntityKind = tab === 'services' || tab === 'consumables' ? 'consumable' : 'equipment'
  const shopCategory = tab === 'relic' ? 'gear' : tab === 'gear' ? 'gear' : tab

  const { data: items = [] } = useQuery({
    queryKey: ['admin-entities', kind],
    queryFn: () => api.adminListEntities(kind),
  })

  function resetForm() {
    setEditingId(null)
    setName('')
    setDescription('')
    setImageUrl(undefined)
    setMods([])
    setError(null)
  }

  const create = useMutation({
    mutationFn: async (body: CreateEntityPayload) => {
      const row = await api.adminCreateEntity(body)
      if (publishOnSave && row.visibility === 'draft') {
        return api.adminPublishEntity(row.id)
      }
      return row
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities', kind] })
      invalidatePlayerPublishedContent(qc)
      resetForm()
    },
    onError: (e: Error) => setError(e.message),
  })

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: CreateEntityPayload }) => {
      const row = await api.adminUpdateEntity(id, body)
      if (publishOnSave && row.visibility === 'draft') {
        return api.adminPublishEntity(row.id)
      }
      return row
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities'] })
      invalidatePlayerPublishedContent(qc)
      resetForm()
    },
    onError: (e: Error) => setError(e.message),
  })

  const publish = useMutation({
    mutationFn: (id: string) => api.adminPublishEntity(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities'] })
      invalidatePlayerPublishedContent(qc)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.adminDeleteEntity(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-entities'] }),
  })

  function priceFieldsFromUi() {
    const amount = Math.max(0, Math.round(priceAmount))
    return {
      priceGold: priceCoin === 'ouro' ? amount : 0,
      priceSilver: priceCoin === 'prata' ? amount : 0,
      priceCopper: priceCoin === 'bronze' ? amount : 0,
    }
  }

  function applyPriceFromEntity(item: (typeof items)[number]) {
    if ((item.priceGold ?? 0) > 0) {
      setPriceCoin('ouro')
      setPriceAmount(item.priceGold ?? 0)
    } else if ((item.priceSilver ?? 0) > 0) {
      setPriceCoin('prata')
      setPriceAmount(item.priceSilver ?? 0)
    } else if ((item.priceCopper ?? 0) > 0) {
      setPriceCoin('bronze')
      setPriceAmount(item.priceCopper ?? 0)
    } else {
      setPriceCoin('prata')
      setPriceAmount(0)
    }
  }

  function buildBody(): CreateEntityPayload | null {
    if (!name.trim()) return null
    const body: CreateEntityPayload = {
      kind,
      name: name.trim(),
      description,
      imageUrl,
      shopCategory: shopCategory as 'gear' | 'consumables' | 'services',
      ...priceFieldsFromUi(),
      stockTotal,
      attributeMods: mods.slice(0, MAX_ATTRIBUTE_MODS),
      statsText: mods.map((m) => `${m.value > 0 ? '+' : ''}${m.value} ${m.attr}`).join(', '),
    }

    if (tab === 'gear') {
      body.equipmentType = equipmentType
    }
    if (tab === 'relic') {
      body.classification = 'relic'
      body.relicAmuletType = relicType
    }
    if (tab === 'services') body.serviceType = serviceType
    if (tab === 'consumables') body.consumableKind = consumableKind
    return body
  }

  function submit() {
    const body = buildBody()
    if (!body) return
    if (editingId) update.mutate({ id: editingId, body })
    else create.mutate(body)
  }

  function loadItem(item: (typeof items)[number]) {
    setEditingId(item.id)
    setName(item.name)
    setDescription(item.description ?? '')
    setImageUrl(item.imageUrl)
    setEquipmentType(item.equipmentType ?? equipmentNames[0] ?? EQUIPMENT_TYPES[0])
    setRelicType(item.relicAmuletType ?? relicNames[0] ?? RELIC_AMULET_TYPES[0])
    setServiceType((item.serviceType as (typeof SERVICE_TYPES)[number]) ?? SERVICE_TYPES[0])
    setConsumableKind(item.consumableKind ?? 'food')
    setMods(item.attributeMods ?? [])
    applyPriceFromEntity(item)
    setStockTotal(item.stockTotal ?? 10)
    setError(null)
  }

  const q = vitrineQuery.trim().toLowerCase()
  const filtered = items.filter((i) => {
    const inTab =
      tab === 'gear'
        ? i.shopCategory === 'gear' && i.classification !== 'relic'
        : tab === 'relic'
          ? i.shopCategory === 'gear' && i.classification === 'relic'
          : i.shopCategory === tab
    if (!inTab) return false
    if (!q) return true
    return (
      i.name.toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q) ||
      (i.equipmentType ?? '').toLowerCase().includes(q)
    )
  })

  const tabs: { id: ShopTab; label: string }[] = [
    { id: 'gear', label: 'Equipamentos' },
    { id: 'relic', label: 'Relíquias' },
    { id: 'services', label: 'Serviços' },
    { id: 'consumables', label: 'Consumíveis' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-semibold tracking-wider uppercase ${
              tab === t.id ? 'bg-primary-container text-white' : 'border border-outline-variant/40 text-on-surface-variant'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="admin-form-panel admin-form-panel--compact">
        <header>
          <h2 className="font-label-sm text-xs text-secondary uppercase">Cadastrar — {tabs.find((t) => t.id === tab)?.label}</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Mesmo estilo da loja do jogador. Estoque limita compras por usuário.
          </p>
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-xs uppercase text-on-surface-variant">
            Nome
            <input className="input-feudal mt-1 pl-4" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {tab === 'gear' ? (
            <label className="block text-xs uppercase text-on-surface-variant">
              Tipo de equipamento
              <select
                className="input-feudal mt-1 pl-4 normal-case"
                value={equipmentType}
                onChange={(e) => setEquipmentType(e.target.value)}
              >
                {equipmentNames.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {tab === 'relic' ? (
            <label className="block text-xs uppercase text-on-surface-variant">
              Tipo de relíquia
              <select
                className="input-feudal mt-1 pl-4 normal-case"
                value={relicType}
                onChange={(e) => setRelicType(e.target.value)}
              >
                {relicNames.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {tab === 'services' ? (
            <label className="block text-xs uppercase text-on-surface-variant">
              Tipo de serviço
              <select
                className="input-feudal mt-1 pl-4 normal-case"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as (typeof SERVICE_TYPES)[number])}
              >
                {SERVICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {tab === 'consumables' ? (
            <label className="block text-xs uppercase text-on-surface-variant">
              Classificação
              <select
                className="input-feudal mt-1 pl-4 normal-case"
                value={consumableKind}
                onChange={(e) => setConsumableKind(e.target.value as 'daily' | 'food')}
              >
                {CONSUMABLE_KINDS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <label className="block text-xs uppercase text-on-surface-variant">
          Descrição
          <textarea
            className="input-feudal textarea-compact mt-1 pl-4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <label className="block text-xs uppercase text-on-surface-variant">
          Foto
          <input
            type="file"
            accept="image/*"
            className="mt-2 block text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                setImageUrl(await readProfileImageFile(file))
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Falha no upload')
              }
            }}
          />
          {imageUrl ? (
            <img src={imageUrl} alt="" className="mt-2 h-24 w-24 rounded border object-cover" />
          ) : null}
        </label>

        {(tab === 'gear' || tab === 'relic') && (
          <div>
            <p className="text-xs uppercase text-on-surface-variant">
              Atributos {tab === 'relic' ? '(força, velocidade, dano, maldições, mana)' : '(opcional)'} — máx.{' '}
              {MAX_ATTRIBUTE_MODS}
            </p>
            <ul className="mt-2 space-y-2">
              {mods.map((mod, idx) => (
                <li key={idx} className="flex flex-wrap gap-2">
                  <select
                    className="input-feudal w-auto pl-3 normal-case"
                    value={mod.attr}
                    onChange={(e) =>
                      setMods((prev) => prev.map((m, i) => (i === idx ? { ...m, attr: e.target.value } : m)))
                    }
                  >
                    {ATTR_KEYS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="input-feudal w-24 pl-3"
                    value={mod.value}
                    onChange={(e) =>
                      setMods((prev) =>
                        prev.map((m, i) => (i === idx ? { ...m, value: Number(e.target.value) || 0 } : m)),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn-secondary text-[10px]"
                    onClick={() => setMods((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
            {mods.length < MAX_ATTRIBUTE_MODS ? (
              <button
                type="button"
                className="btn-secondary mt-2 text-[10px]"
                onClick={() => setMods((prev) => [...prev, { attr: tab === 'relic' ? 'forca' : 'velocidade', value: 1 }])}
              >
                + atributo
              </button>
            ) : null}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase text-on-surface-variant">
            Preço
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                type="number"
                min={0}
                className="input-feudal min-w-[5rem] flex-1 pl-4"
                value={priceAmount}
                onChange={(e) => setPriceAmount(Number(e.target.value) || 0)}
              />
              <select
                className="input-feudal w-auto min-w-[6.5rem] pl-3 normal-case"
                value={priceCoin}
                onChange={(e) => setPriceCoin(e.target.value as 'ouro' | 'prata' | 'bronze')}
                aria-label="Tipo de moeda"
              >
                <option value="ouro">Ouro</option>
                <option value="prata">Prata</option>
                <option value="bronze">Bronze</option>
              </select>
            </div>
          </label>
          <label className="block text-xs uppercase text-on-surface-variant">
            Estoque total
            <input
              type="number"
              min={0}
              className="input-feudal mt-1 pl-4"
              value={stockTotal}
              onChange={(e) => setStockTotal(Number(e.target.value) || 0)}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-xs text-on-surface-variant">
          <input
            type="checkbox"
            checked={publishOnSave}
            onChange={(e) => setPublishOnSave(e.target.checked)}
          />
          Publicar na loja do jogador ao salvar
        </label>

        {error ? <p className="text-sm text-primary">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={create.isPending || update.isPending}
            onClick={submit}
          >
            {publishOnSave ? 'Salvar e publicar' : 'Salvar rascunho'}
          </button>
          {editingId ? (
            <button type="button" className="btn-secondary text-sm" onClick={resetForm}>
              Novo item
            </button>
          ) : null}
        </div>
      </section>

      <section className="mesa-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-label-sm text-xs text-secondary uppercase">Itens desta vitrine</h3>
          <div className="relative min-w-0 w-full flex-1 sm:max-w-xs">
            <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-on-surface-variant">
              search
            </span>
            <input
              className="input-feudal w-full pl-10"
              placeholder="Buscar item…"
              value={vitrineQuery}
              onChange={(e) => setVitrineQuery(e.target.value)}
            />
          </div>
        </div>
        <ul className="mt-3 space-y-2">
          {filtered.map((item) => (
            <li
              key={item.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm ${
                editingId === item.id ? 'border-secondary/50 bg-secondary/10' : 'border-outline-variant/40'
              }`}
            >
              <div>
                <p className="font-serif text-on-surface">{item.name}</p>
                <p className="text-xs text-on-surface-variant">
                  {item.equipmentType || item.serviceType || item.consumableKind || '—'} · estoque{' '}
                  {item.stockTotal ?? '∞'} · {item.visibility === 'published' ? 'Publicado' : 'Rascunho'}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={() => loadItem(item)}>
                  Editar
                </button>
                {item.visibility === 'draft' ? (
                  <button type="button" className="btn-secondary text-xs" onClick={() => publish.mutate(item.id)}>
                    Publicar
                  </button>
                ) : null}
                <button type="button" className="text-xs underline text-on-surface-variant" onClick={() => remove.mutate(item.id)}>
                  Excluir
                </button>
              </div>
            </li>
          ))}
          {filtered.length === 0 ? <li className="text-sm text-on-surface-variant">Nenhum item nesta vitrine.</li> : null}
        </ul>
      </section>
    </div>
  )
}
