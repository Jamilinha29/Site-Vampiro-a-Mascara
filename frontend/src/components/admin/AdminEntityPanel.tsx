import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { readProfileImageFile } from '../../lib/profileMedia'
import { invalidatePlayerPublishedContent } from '../../lib/queryKeys'
import type { ChronicleEntity, CreateEntityPayload, EntityKind } from '../../types/chronicle'
import { api } from '../../services/api'

type Props = {
  kind: EntityKind
  title: string
  description: string
  showArchiveCategory?: boolean
  showShopCategory?: boolean
  showDownloadCategory?: boolean
  showBestiaryTier?: boolean
  showStats?: boolean
  showPrices?: boolean
  showFileUpload?: boolean
  showCreatureType?: boolean
  creatureTypeOptions?: string[]
  defaultArchiveCategory?: ChronicleEntity['archiveCategory']
  defaultShopCategory?: ChronicleEntity['shopCategory']
  defaultDownloadCategory?: ChronicleEntity['downloadCategory']
  defaultBestiaryTier?: ChronicleEntity['bestiaryTier']
  /** Quando definido, a vitrine vem do bloco selecionado — sem seletor duplicado no formulário. */
  fixedShopCategory?: ChronicleEntity['shopCategory']
  fixedArchiveCategory?: ChronicleEntity['archiveCategory']
  fixedDownloadCategory?: ChronicleEntity['downloadCategory']
  fixedBestiaryTier?: ChronicleEntity['bestiaryTier']
  hideRegistry?: boolean
  registryVariant?: 'list' | 'cards' | 'npc' | 'monster'
  /** Monstros/NPCs publicados alimentam o glossário; no glossário só completam o que falta. */
  syncGlossary?: boolean
}

export function AdminEntityPanel({
  kind,
  title,
  description,
  showArchiveCategory,
  showShopCategory,
  showDownloadCategory,
  showBestiaryTier,
  showStats,
  showPrices,
  showFileUpload,
  showCreatureType,
  creatureTypeOptions = [],
  defaultArchiveCategory,
  defaultShopCategory,
  defaultDownloadCategory,
  defaultBestiaryTier,
  fixedShopCategory,
  fixedArchiveCategory,
  fixedDownloadCategory,
  fixedBestiaryTier,
  hideRegistry = false,
  registryVariant = 'list',
  syncGlossary = false,
}: Props) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [statsText, setStatsText] = useState('')
  const [creatureType, setCreatureType] = useState(creatureTypeOptions[0] ?? '')
  const [archiveCategory, setArchiveCategory] = useState(fixedArchiveCategory ?? defaultArchiveCategory ?? 'chronicles')
  const [shopCategory, setShopCategory] = useState(fixedShopCategory ?? defaultShopCategory ?? 'gear')
  const [downloadCategory, setDownloadCategory] = useState(fixedDownloadCategory ?? defaultDownloadCategory ?? 'rules')
  const [bestiaryTier, setBestiaryTier] = useState(fixedBestiaryTier ?? defaultBestiaryTier ?? 'classified')
  const [priceGold, setPriceGold] = useState(0)
  const [priceSilver, setPriceSilver] = useState(0)
  const [fileName, setFileName] = useState('')
  const [fileUrl, setFileUrl] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-entities', kind],
    queryFn: () => api.adminListEntities(kind),
  })

  const create = useMutation({
    mutationFn: (body: CreateEntityPayload) => api.adminCreateEntity(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities', kind] })
      if (syncGlossary || kind === 'monster') {
        void qc.invalidateQueries({ queryKey: ['admin-entities', 'archive'] })
        void qc.invalidateQueries({ queryKey: ['admin-entities'] })
        invalidatePlayerPublishedContent(qc)
      }
      setName('')
      setDesc('')
      setStatsText('')
      setFileName('')
      setFileUrl(undefined)
      setError(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  const publish = useMutation({
    mutationFn: (id: string) => api.adminPublishEntity(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities', kind] })
      invalidatePlayerPublishedContent(qc)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.adminDeleteEntity(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-entities', kind] }),
  })

  function submit() {
    if (!name.trim()) return
    const body: CreateEntityPayload = {
      kind,
      name: name.trim(),
      description: desc,
    }
    if (showCreatureType && creatureType) body.creatureType = creatureType
    if (showArchiveCategory || fixedArchiveCategory) {
      body.archiveCategory = fixedArchiveCategory ?? archiveCategory
    }
    if (showShopCategory || fixedShopCategory) {
      body.shopCategory = fixedShopCategory ?? shopCategory
    }
    if (showDownloadCategory || fixedDownloadCategory) {
      body.downloadCategory = fixedDownloadCategory ?? downloadCategory
    }
    if (showBestiaryTier || fixedBestiaryTier) {
      body.bestiaryTier = fixedBestiaryTier ?? bestiaryTier
    }
    if (showStats && statsText) body.statsText = statsText
    if (kind === 'monster') {
      body.bestiaryTier = fixedBestiaryTier ?? bestiaryTier
    }
    if (kind === 'npc' && showCreatureType) {
      body.statsText = body.statsText || `Tipo ${creatureType}`
    }
    if (showPrices) {
      body.priceGold = priceGold
      body.priceSilver = priceSilver
    }
    if (showFileUpload && fileName && fileUrl) {
      body.fileName = fileName
      body.fileUrl = fileUrl
    }
    create.mutate(body)
  }

  return (
    <section className="admin-form-panel admin-form-panel--compact">
      <header>
        <h2 className="font-label-sm text-xs text-secondary uppercase">{title}</h2>
        <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs uppercase text-on-surface-variant">
          Nome
          <input className="input-feudal mt-1 pl-4" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {showCreatureType ? (
          <label className="block text-xs uppercase text-on-surface-variant">
            Tipo de criatura
            <select
              className="input-feudal mt-1 pl-4 normal-case"
              value={creatureType}
              onChange={(e) => setCreatureType(e.target.value)}
            >
              {creatureTypeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {showArchiveCategory && !fixedArchiveCategory ? (
          <label className="block text-xs uppercase text-on-surface-variant">
            Acervo
            <select
              className="input-feudal mt-1 pl-4"
              value={archiveCategory}
              onChange={(e) => setArchiveCategory(e.target.value as 'chronicles' | 'relics' | 'rituals')}
            >
              <option value="chronicles">Crônicas</option>
              <option value="relics">Relíquias</option>
              <option value="rituals">Rituais</option>
            </select>
          </label>
        ) : null}
        {showShopCategory && !fixedShopCategory ? (
          <label className="block text-xs uppercase text-on-surface-variant">
            Vitrine
            <select
              className="input-feudal mt-1 pl-4"
              value={shopCategory}
              onChange={(e) => setShopCategory(e.target.value as 'gear' | 'consumables' | 'services')}
            >
              <option value="gear">Equipamentos</option>
              <option value="consumables">Consumíveis</option>
              <option value="services">Serviços</option>
            </select>
          </label>
        ) : null}
        {showDownloadCategory && !fixedDownloadCategory ? (
          <label className="block text-xs uppercase text-on-surface-variant">
            Pasta
            <select
              className="input-feudal mt-1 pl-4"
              value={downloadCategory}
              onChange={(e) => setDownloadCategory(e.target.value as 'rules' | 'sheets' | 'handouts')}
            >
              <option value="rules">Regras & codex</option>
              <option value="sheets">Fichas</option>
              <option value="handouts">Handouts</option>
            </select>
          </label>
        ) : null}
        {showBestiaryTier && !fixedBestiaryTier ? (
          <label className="block text-xs uppercase text-on-surface-variant">
            Camada do bestiário
            <select
              className="input-feudal mt-1 pl-4"
              value={bestiaryTier}
              onChange={(e) => setBestiaryTier(e.target.value as 'known' | 'classified' | 'rumors')}
            >
              <option value="known">Conhecido (jogadores)</option>
              <option value="classified">Classificado</option>
              <option value="rumors">Rumores</option>
            </select>
          </label>
        ) : null}
        {showPrices ? (
          <>
            <label className="block text-xs uppercase text-on-surface-variant">
              Preço (ouro)
              <input
                type="number"
                min={0}
                className="input-feudal mt-1 pl-4"
                value={priceGold}
                onChange={(e) => setPriceGold(Number(e.target.value))}
              />
            </label>
            <label className="block text-xs uppercase text-on-surface-variant">
              Preço (prata)
              <input
                type="number"
                min={0}
                className="input-feudal mt-1 pl-4"
                value={priceSilver}
                onChange={(e) => setPriceSilver(Number(e.target.value))}
              />
            </label>
          </>
        ) : null}
      </div>

      <label className="block text-xs uppercase text-on-surface-variant">
        Descrição
        <textarea className="input-feudal textarea-compact mt-1 pl-4" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </label>

      {showStats ? (
        <label className="block text-xs uppercase text-on-surface-variant">
          Dados / estatísticas (ficha)
          <textarea
            className="input-feudal textarea-compact mt-1 pl-4 font-mono text-xs"
            value={statsText}
            onChange={(e) => setStatsText(e.target.value)}
          />
        </label>
      ) : null}

      {showFileUpload ? (
        <label className="block text-xs uppercase text-on-surface-variant">
          Arquivo (PDF/imagem)
          <input
            type="file"
            className="mt-2 block text-sm"
            accept="application/pdf,image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const dataUrl = await readProfileImageFile(file)
                setFileName(file.name)
                setFileUrl(dataUrl)
                setError(null)
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Falha no upload')
              }
            }}
          />
          {fileName ? <span className="mt-1 block text-xs text-secondary">{fileName}</span> : null}
        </label>
      ) : null}

      {error ? <p className="text-sm text-primary">{error}</p> : null}

      <p className="text-[11px] text-on-surface-variant">
        Salvar cria um <strong className="font-normal text-secondary">rascunho</strong>. Use{' '}
        <strong className="font-normal text-secondary">Publicar</strong> na lista abaixo para o jogador ver na mesa, glossário ou bestiário.
      </p>
      <button type="button" className="btn-primary text-sm" disabled={create.isPending} onClick={submit}>
        Salvar rascunho
      </button>

      {hideRegistry ? null : (
        <div className="border-t border-outline-variant/40 pt-4">
          <h3 className="font-label-sm text-xs text-secondary uppercase">
            {registryVariant === 'npc'
              ? 'Elenco cadastrado'
              : registryVariant === 'monster'
                ? 'Ameaças do bestiário'
                : 'Acervo · glossário'}
          </h3>
          {registryVariant === 'list' || registryVariant === 'cards' ? (
            <p className="mt-1 text-[11px] text-on-surface-variant">
              Publicados aparecem no glossário; use o glossário para completar foto e campos extras.
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-on-surface-variant">
              {registryVariant === 'npc'
                ? 'NPCs publicados entram no glossário — complete lá foto e notas narrativas.'
                : 'Monstros publicados alimentam o glossário — complete lá imagem e camadas do bestiário.'}
            </p>
          )}
          {isLoading ? <p className="mt-2 text-sm text-on-surface-variant">Carregando…</p> : null}
          {registryVariant === 'npc' ? (
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded border border-outline-variant/35 bg-surface-container-lowest/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-serif text-sm text-on-surface">{item.name}</p>
                    <p className="truncate text-[10px] text-on-surface-variant">
                      {item.creatureType ? `${item.creatureType} · ` : ''}
                      {item.visibility === 'published' ? 'No glossário' : 'Rascunho'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {item.visibility === 'draft' ? (
                      <button type="button" className="btn-secondary px-2 py-1 text-[10px]" onClick={() => publish.mutate(item.id)}>
                        Publicar
                      </button>
                    ) : null}
                    <button type="button" className="px-1 text-[10px] text-on-surface-variant underline" onClick={() => remove.mutate(item.id)}>
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
              {items.length === 0 && !isLoading ? (
                <li className="text-sm text-on-surface-variant">Nenhum NPC ainda.</li>
              ) : null}
            </ul>
          ) : registryVariant === 'monster' ? (
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded border border-primary/25 bg-surface-container-lowest/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-serif text-sm text-on-surface">{item.name}</p>
                    <p className="truncate text-[10px] text-on-surface-variant">
                      {(item.threatLevel ?? 'comum').toString()} · HP {item.hpMax ?? '—'} ·{' '}
                      {item.bestiaryTier === 'known'
                        ? 'Conhecido'
                        : item.bestiaryTier === 'rumors'
                          ? 'Rumores'
                          : 'Classificado'}{' '}
                      · {item.visibility === 'published' ? 'No glossário' : 'Rascunho'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {item.visibility === 'draft' ? (
                      <button type="button" className="btn-secondary px-2 py-1 text-[10px]" onClick={() => publish.mutate(item.id)}>
                        Publicar
                      </button>
                    ) : null}
                    <button type="button" className="px-1 text-[10px] text-on-surface-variant underline" onClick={() => remove.mutate(item.id)}>
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
              {items.length === 0 && !isLoading ? (
                <li className="text-sm text-on-surface-variant">Nenhuma ameaça ainda.</li>
              ) : null}
            </ul>
          ) : registryVariant === 'cards' ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-2 rounded border border-outline-variant/40 bg-surface-container-lowest/50 p-3"
                >
                  <div>
                    <p className="font-serif text-sm text-on-surface">{item.name}</p>
                    <p className="mt-0.5 text-[10px] text-on-surface-variant">
                      {item.creatureType ?? '—'} · {item.visibility === 'published' ? 'Publicado' : 'Rascunho'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.visibility === 'draft' ? (
                      <button type="button" className="btn-secondary text-[10px]" onClick={() => publish.mutate(item.id)}>
                        Publicar
                      </button>
                    ) : null}
                    <button type="button" className="text-[10px] text-on-surface-variant underline" onClick={() => remove.mutate(item.id)}>
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
              {items.length === 0 && !isLoading ? (
                <li className="text-sm text-on-surface-variant sm:col-span-2">Nenhum registro ainda.</li>
              ) : null}
            </ul>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-outline-variant/40 bg-surface-container-lowest/40 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-serif text-on-surface">{item.name}</span>
                    <span className="ml-2 text-xs text-on-surface-variant">
                      {item.creatureType ? `${item.creatureType} · ` : ''}
                      {item.visibility === 'published' ? 'Publicado' : 'Rascunho'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {item.visibility === 'draft' ? (
                      <button type="button" className="btn-secondary text-xs" onClick={() => publish.mutate(item.id)}>
                        Publicar
                      </button>
                    ) : null}
                    <button type="button" className="text-xs text-on-surface-variant underline" onClick={() => remove.mutate(item.id)}>
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
              {items.length === 0 && !isLoading ? (
                <li className="text-sm text-on-surface-variant">Nenhum registro ainda.</li>
              ) : null}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
