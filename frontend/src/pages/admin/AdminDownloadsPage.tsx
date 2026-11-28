import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { readDownloadFile } from '../../lib/profileMedia'
import { invalidatePlayerPublishedContent } from '../../lib/queryKeys'
import type { ChronicleEntity, CreateEntityPayload } from '../../types/chronicle'
import { api } from '../../services/api'

const CATEGORIES = [
  { id: 'handouts' as const, label: 'Acontecimentos Passados' },
  { id: 'sheets' as const, label: 'Fichas oficiais imprimíveis' },
  { id: 'rules' as const, label: 'Compêndio' },
]

const SHEET_SPECIES_OPTIONS = ['Vampiro', 'Mortal', 'Outras espécies'] as const

const FALLBACK_CLANS = [
  'Banu Haqim',
  'Brujah',
  'Gangrel',
  'Hecata',
  'Lasombra',
  'Malkavian',
  'Ministry',
  'Nosferatu',
  'Ravnos',
  'Salubri',
  'Toreador',
  'Tremere',
  'Tzimisce',
  'Ventrue',
]

const GENERAL_BOOK_GROUP = 'Geral / Outros livros'

type PendingBatchFile = {
  name: string
  fileName: string
  fileUrl: string
}

function stripFileExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, '').trim() || filename
}

export default function AdminDownloadsPage() {
  const qc = useQueryClient()
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('sheets')
  const [sheetType, setSheetType] = useState<string>(SHEET_SPECIES_OPTIONS[0])
  const [clan, setClan] = useState<string>('Banu Haqim')
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileUrl, setFileUrl] = useState<string | undefined>()
  const [pendingFiles, setPendingFiles] = useState<PendingBatchFile[]>([])
  const [publishOnSave, setPublishOnSave] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { data: items = [] } = useQuery({
    queryKey: ['admin-entities', 'download'],
    queryFn: () => api.adminListEntities('download'),
  })

  const { data: catalogClans = [] } = useQuery({
    queryKey: ['catalog-clans'],
    queryFn: () => api.getCatalogClans(),
  })

  const clanOptions = useMemo(() => {
    const names = catalogClans.length > 0 ? catalogClans.map((c) => c.name) : FALLBACK_CLANS
    return [...names, GENERAL_BOOK_GROUP]
  }, [catalogClans])

  const supportsBatch = (category === 'sheets' || category === 'rules') && !editingId
  const activeGroupLabel = category === 'sheets' ? sheetType : clan

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if ((i.downloadCategory ?? 'rules') !== category) return false
      if (groupFilter === 'all') return true
      if (category === 'sheets') {
        return (i.sheetType?.trim() || i.clan?.trim() || 'Outras espécies') === groupFilter
      }
      if (category === 'rules') {
        return (i.clan?.trim() || GENERAL_BOOK_GROUP) === groupFilter
      }
      return true
    })
  }, [items, category, groupFilter])

  const groupedItems = useMemo(() => {
    if (category !== 'sheets' && category !== 'rules') return []
    const groups = new Map<string, ChronicleEntity[]>()
    for (const item of filtered) {
      const groupName =
        category === 'sheets'
          ? item.sheetType?.trim() || item.clan?.trim() || 'Outras espécies'
          : item.clan?.trim() || GENERAL_BOOK_GROUP
      const current = groups.get(groupName) ?? []
      current.push(item)
      groups.set(groupName, current)
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (category === 'sheets') {
        const order = [...SHEET_SPECIES_OPTIONS] as string[]
        const ia = order.indexOf(a)
        const ib = order.indexOf(b)
        if (ia >= 0 && ib >= 0) return ia - ib
        if (ia >= 0) return -1
        if (ib >= 0) return 1
      }
      if (a === GENERAL_BOOK_GROUP) return 1
      if (b === GENERAL_BOOK_GROUP) return -1
      return a.localeCompare(b, 'pt-BR')
    })
  }, [category, filtered])

  function reset() {
    setEditingId(null)
    setName('')
    setDescription('')
    setFileName('')
    setFileUrl(undefined)
    setPendingFiles([])
    setError(null)
  }

  function load(item: ChronicleEntity) {
    const nextCat = item.downloadCategory ?? 'rules'
    setEditingId(item.id)
    setName(item.name)
    setDescription(item.description ?? '')
    setFileName(item.fileName ?? '')
    setFileUrl(item.fileUrl)
    setPendingFiles([])
    setCategory(nextCat)
    if (nextCat === 'sheets') {
      setSheetType(item.sheetType?.trim() || item.clan?.trim() || SHEET_SPECIES_OPTIONS[0])
    } else if (item.clan) {
      setClan(item.clan)
    }
    setError(null)
  }

  const saveBatch = useMutation({
    mutationFn: async (payloads: CreateEntityPayload[]) => {
      for (const body of payloads) {
        const created = await api.adminCreateEntity(body)
        if (publishOnSave && created.visibility === 'draft') {
          await api.adminPublishEntity(created.id)
        }
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities', 'download'] })
      invalidatePlayerPublishedContent(qc)
      reset()
    },
    onError: (e: Error) => setError(e.message),
  })

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: CreateEntityPayload }) => {
      const saved = await api.adminUpdateEntity(id, body)
      if (publishOnSave && saved.visibility === 'draft') {
        return api.adminPublishEntity(saved.id)
      }
      return saved
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities', 'download'] })
      invalidatePlayerPublishedContent(qc)
      reset()
    },
    onError: (e: Error) => setError(e.message),
  })

  const publish = useMutation({
    mutationFn: (id: string) => api.adminPublishEntity(id),
    onSuccess: () => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['admin-entities', 'download'] })
      invalidatePlayerPublishedContent(qc)
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.adminDeleteEntity(id),
    onSuccess: (_data, deletedId) => {
      setError(null)
      void qc.invalidateQueries({ queryKey: ['admin-entities', 'download'] })
      invalidatePlayerPublishedContent(qc)
      if (editingId === deletedId) reset()
    },
    onError: (e: Error) => setError(e.message),
  })

  function submit() {
    if (editingId) {
      if (!name.trim()) return
      const body: CreateEntityPayload = {
        kind: 'download',
        name: name.trim(),
        description,
        downloadCategory: category,
        sheetType: category === 'sheets' ? sheetType : undefined,
        clan: category === 'rules' ? clan : undefined,
        fileName: fileName || undefined,
        fileUrl,
      }
      update.mutate({ id: editingId, body })
      return
    }

    if (supportsBatch && pendingFiles.length > 0) {
      const payloads: CreateEntityPayload[] = pendingFiles.map((entry) => ({
        kind: 'download',
        name: entry.name.trim() || stripFileExtension(entry.fileName),
        description,
        downloadCategory: category,
        sheetType: category === 'sheets' ? sheetType : undefined,
        clan: category === 'rules' ? clan : undefined,
        fileName: entry.fileName,
        fileUrl: entry.fileUrl,
      }))
      saveBatch.mutate(payloads)
      return
    }

    if (!name.trim()) return
    const body: CreateEntityPayload = {
      kind: 'download',
      name: name.trim(),
      description,
      downloadCategory: category,
      sheetType: category === 'sheets' ? sheetType : undefined,
      clan: category === 'rules' ? clan : undefined,
      fileName: fileName || undefined,
      fileUrl,
    }
    saveBatch.mutate([body])
  }

  const busy = saveBatch.isPending || update.isPending
  const canSubmit = editingId
    ? Boolean(name.trim())
    : supportsBatch && pendingFiles.length > 0
      ? true
      : Boolean(name.trim())

  return (
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Central de downloads</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Cadastre fichas oficiais por espécie — Vampiro, Mortal e Outras espécies — e livros de cada clã no Compêndio. Os
          arquivos ficam salvos no storage e sincronizam com a área do usuário.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-semibold tracking-wider uppercase ${
              category === c.id
                ? 'border border-secondary bg-secondary/15 text-secondary'
                : 'border border-outline-variant/40 text-on-surface-variant'
            }`}
            onClick={() => {
              setCategory(c.id)
              setGroupFilter('all')
              reset()
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="admin-form-panel admin-form-panel--compact flex h-full flex-col">
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-label-sm text-xs text-secondary uppercase">
              {editingId ? 'Editar arquivo' : 'Novo arquivo'}
            </h2>
            {editingId ? (
              <button type="button" className="btn-secondary text-xs" onClick={reset}>
                Novo cadastro
              </button>
            ) : null}
          </header>

          {category === 'sheets' ? (
            <label className="block text-xs uppercase text-on-surface-variant">
              Espécie / Tipo de ficha
              <select
                className="input-feudal mt-1 pl-4 normal-case"
                value={sheetType}
                onChange={(e) => setSheetType(e.target.value)}
              >
                {SHEET_SPECIES_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {category === 'rules' ? (
            <label className="block text-xs uppercase text-on-surface-variant">
              Clã / Livro de destino
              <select
                className="input-feudal mt-1 pl-4 normal-case"
                value={clan}
                onChange={(e) => setClan(e.target.value)}
              >
                {clanOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!(supportsBatch && pendingFiles.length > 0) ? (
            <label className="block text-xs uppercase text-on-surface-variant">
              Nome
              <input className="input-feudal mt-1 pl-4 normal-case" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          ) : null}

          <label className="flex flex-1 flex-col text-xs uppercase text-on-surface-variant">
            Descrição
            <textarea
              className="input-feudal textarea-compact mt-1 flex-1 pl-4 normal-case"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <label className="block text-xs uppercase text-on-surface-variant">
            {supportsBatch
              ? category === 'rules'
                ? 'Livros em PDF do clã — até 2 MB cada, seleção múltipla'
                : 'Fichas em PDF da espécie — até 2 MB cada, seleção múltipla'
              : 'Arquivo em PDF até 2 MB ou imagem'}
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple={supportsBatch}
              className="mt-2 block text-sm"
              onChange={async (e) => {
                const input = e.currentTarget
                const files = Array.from(input.files ?? [])
                if (files.length === 0) return
                try {
                  if (supportsBatch && files.length > 1) {
                    const loaded: PendingBatchFile[] = []
                    for (const file of files) {
                      const dataUrl = await readDownloadFile(file)
                      loaded.push({
                        name: stripFileExtension(file.name),
                        fileName: file.name,
                        fileUrl: dataUrl,
                      })
                    }
                    setPendingFiles((prev) => [...prev, ...loaded])
                    setFileName('')
                    setFileUrl(undefined)
                  } else {
                    const file = files[0]
                    const dataUrl = await readDownloadFile(file)
                    setFileUrl(dataUrl)
                    setFileName(file.name)
                    if (!name.trim()) setName(stripFileExtension(file.name))
                    setPendingFiles([])
                  }
                  setError(null)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Falha no upload')
                } finally {
                  input.value = ''
                }
              }}
            />
            {fileName && pendingFiles.length === 0 ? (
              <p className="mt-1 text-xs text-on-surface-variant">{fileName}</p>
            ) : null}
          </label>

          {pendingFiles.length > 0 ? (
            <div className="space-y-2 rounded border border-outline-variant/40 bg-surface-container-lowest/40 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase text-secondary">
                  {pendingFiles.length} arquivos selecionados para {activeGroupLabel}
                </p>
                <button
                  type="button"
                  className="text-[11px] text-on-surface-variant underline"
                  onClick={() => setPendingFiles([])}
                >
                  Limpar fila
                </button>
              </div>
              <ul className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                {pendingFiles.map((entry, idx) => (
                  <li key={`${entry.fileName}-${idx}`} className="flex items-center gap-2">
                    <input
                      className="input-feudal flex-1 pl-3 text-xs normal-case"
                      value={entry.name}
                      onChange={(e) =>
                        setPendingFiles((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row)),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="text-[11px] text-on-surface-variant underline hover:text-primary"
                      onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-xs text-on-surface-variant">
            <input
              type="checkbox"
              checked={publishOnSave}
              onChange={(e) => setPublishOnSave(e.target.checked)}
            />
            Publicar para jogadores ao salvar
          </label>

          {error ? <p className="text-sm text-primary">{error}</p> : null}
          <div className="mt-auto pt-2">
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={busy || !canSubmit}
              onClick={submit}
            >
              {busy
                ? 'Salvando…'
                : pendingFiles.length > 1
                  ? `Salvar ${pendingFiles.length} arquivos`
                  : 'Salvar'}
            </button>
          </div>
        </section>

        <section className="admin-form-panel flex h-full min-h-[22rem] flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-label-sm text-xs text-secondary uppercase">Arquivos cadastrados</h2>
            {category === 'sheets' ? (
              <select
                aria-label="Filtrar por espécie"
                className="input-feudal w-auto max-w-[13rem] py-1 pl-3 text-xs normal-case"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
              >
                <option value="all">Todas as espécies</option>
                {SHEET_SPECIES_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : category === 'rules' ? (
              <select
                aria-label="Filtrar por clã"
                className="input-feudal w-auto max-w-[13rem] py-1 pl-3 text-xs normal-case"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
              >
                <option value="all">Todos os clãs</option>
                {clanOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Nenhum arquivo nesta pasta.</p>
            ) : category === 'sheets' || category === 'rules' ? (
              groupedItems.map(([groupName, files]) => (
                <div
                  key={groupName}
                  className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest/45 p-3"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-outline-variant/25 pb-2">
                    <h3 className="font-serif text-base text-secondary">{groupName}</h3>
                    <span className="text-[10px] uppercase text-on-surface-variant">
                      {files.length} {files.length === 1 ? 'arquivo' : 'arquivos'}
                    </span>
                  </div>
                  <ul className="mt-2 divide-y divide-outline-variant/20">
                    {files.map((file) => (
                      <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-serif text-sm text-on-surface">{file.name}</p>
                          <p className="truncate text-[10px] uppercase text-on-surface-variant">
                            {file.visibility === 'published' ? 'Publicado' : 'Rascunho'} · {file.fileName ?? 'sem arquivo'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button type="button" className="btn-secondary px-2 py-1 text-[10px]" onClick={() => load(file)}>
                            Editar
                          </button>
                          {file.visibility === 'draft' ? (
                            <button
                              type="button"
                              className="btn-secondary px-2 py-1 text-[10px]"
                              disabled={publish.isPending}
                              onClick={() => publish.mutate(file.id)}
                            >
                              Publicar
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="text-[10px] text-on-surface-variant underline"
                            disabled={remove.isPending}
                            onClick={() => {
                              if (window.confirm(`Excluir o arquivo "${file.name}"?`)) {
                                remove.mutate(file.id)
                              }
                            }}
                          >
                            Excluir
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              filtered.map((file) => (
                <article
                  key={file.id}
                  className="rounded border border-outline-variant/40 bg-surface-container-lowest/50 p-3"
                >
                  <p className="font-serif text-base text-on-surface">{file.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                    {file.description || 'Sem descrição.'}
                  </p>
                  <p className="mt-1 text-[10px] uppercase text-on-surface-variant">
                    {file.visibility === 'published' ? 'Publicado' : 'Rascunho'} · {file.fileName ?? 'sem arquivo'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary px-2 py-1 text-[10px]" onClick={() => load(file)}>
                      Editar
                    </button>
                    {file.visibility === 'draft' ? (
                      <button
                        type="button"
                        className="btn-secondary px-2 py-1 text-[10px]"
                        disabled={publish.isPending}
                        onClick={() => publish.mutate(file.id)}
                      >
                        Publicar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-[10px] text-on-surface-variant underline"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(`Excluir o arquivo "${file.name}"?`)) {
                          remove.mutate(file.id)
                        }
                      }}
                    >
                      Excluir
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
