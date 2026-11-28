import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api, type ReferenceEntry } from '../../services/api'

const KINDS = [
  { id: 'faith', label: 'Fé', extra: 'faith' as const },
  { id: 'mortal_order', label: 'Ordens mortais', extra: 'none' as const },
  { id: 'monster_type', label: 'Tipos de monstro', extra: 'none' as const },
  { id: 'equipment_type', label: 'Tipos de equipamento', extra: 'none' as const },
  { id: 'magic', label: 'Magia', extra: 'none' as const },
  { id: 'relic', label: 'Relíquias', extra: 'none' as const },
  { id: 'subclass', label: 'Subclasses', extra: 'class' as const },
]

type Draft = {
  name: string
  description: string
  className: string
  faithPath: '' | 'luz' | 'trevas'
}

const emptyDraft = (): Draft => ({ name: '', description: '', className: '', faithPath: '' })

function parseCsv(text: string): string[][] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) return []
  const sample = lines[0]
  const delimiter = (sample.match(/;/g)?.length ?? 0) > (sample.match(/,/g)?.length ?? 0) ? ';' : ','
  return lines.map((line) => {
    const cells: string[] = []
    let current = ''
    let quoted = false
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"'
          i += 1
          continue
        }
        quoted = !quoted
        continue
      }
      if (char === delimiter && !quoted) {
        cells.push(current.trim())
        current = ''
        continue
      }
      current += char
    }
    cells.push(current.trim())
    return cells
  })
}

function rowsFromCsv(kindExtra: 'faith' | 'class' | 'none', text: string): Draft[] {
  const table = parseCsv(text)
  if (!table.length) return []
  const header = table[0].map((cell) => cell.toLowerCase())
  const start = header.some((cell) => ['name', 'tipo', 'nome', 'class_name', 'classe'].includes(cell)) ? 1 : 0
  const index = (labels: string[]) => header.findIndex((cell) => labels.includes(cell))
  const nameAt =
    start === 0 ? (kindExtra === 'class' ? 1 : 0) : index(['name', 'nome', 'tipo'])
  const descriptionAt =
    start === 0 ? (kindExtra === 'class' ? 2 : 1) : index(['description', 'descricao', 'descrição'])
  const classAt = start === 0 ? (kindExtra === 'class' ? 0 : -1) : index(['class_name', 'classe'])
  const pathAt = index(['faith_path', 'caminho', 'path'])
  return table
    .slice(start)
    .flatMap((cells) => {
      const name = (nameAt >= 0 ? cells[nameAt] : '') ?? ''
      if (!name) return []
      const path = (pathAt >= 0 ? cells[pathAt] : '').toLowerCase()
      return [
        {
          name,
          description: (descriptionAt >= 0 ? cells[descriptionAt] : '') ?? '',
          className: (classAt >= 0 ? cells[classAt] : '') ?? '',
          faithPath: path === 'luz' || path === 'trevas' ? path : '',
        } satisfies Draft,
      ]
    })
    .filter((row) => (kindExtra === 'class' ? row.className : true))
}

export default function AdminReferencePage() {
  const qc = useQueryClient()
  const [kind, setKind] = useState(KINDS[0].id)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [preview, setPreview] = useState<Draft[] | null>(null)
  const [savedQuery, setSavedQuery] = useState('')
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null)
  const [savedDraft, setSavedDraft] = useState<Draft>(emptyDraft())
  const [message, setMessage] = useState<string | null>(null)
  const meta = KINDS.find((item) => item.id === kind) ?? KINDS[0]

  const list = useQuery({
    queryKey: ['admin-reference', kind],
    queryFn: () => api.adminListReference(kind),
  })

  async function invalidateReferenceQueries() {
    await qc.invalidateQueries({ queryKey: ['admin-reference', kind] })
    await qc.invalidateQueries({ queryKey: ['reference-catalog', kind] })
    if (kind === 'faith') await qc.invalidateQueries({ queryKey: ['catalog-cathedrals'] })
    if (kind === 'subclass') await qc.invalidateQueries({ queryKey: ['catalog-subclasses'] })
  }

  function startEditRow(row: ReferenceEntry) {
    setEditingSavedId(row.id)
    setSavedDraft({
      name: row.name,
      description: row.description,
      className: row.className,
      faithPath: row.faithPath,
    })
  }

  const saveOne = useMutation({
    mutationFn: () => api.adminAddReference(kind, draft),
    onSuccess: async () => {
      setDraft(emptyDraft())
      setMessage('Item salvo no sistema.')
      await invalidateReferenceQueries()
    },
    onError: (error: Error) => setMessage(error.message),
  })

  const moveFaith = useMutation({
    mutationFn: (row: ReferenceEntry & { faithPath: 'luz' | 'trevas' }) =>
      api.adminAddReference(kind, {
        id: row.id,
        name: row.name,
        description: row.description,
        faithPath: row.faithPath,
      }),
    onSuccess: async () => {
      setMessage('Catedral movida para o caminho escolhido.')
      await invalidateReferenceQueries()
    },
    onError: (error: Error) => setMessage(error.message),
  })

  const savePreview = useMutation({
    mutationFn: (rows: Draft[]) => api.adminSaveReference(kind, rows),
    onSuccess: async (result) => {
      setPreview(null)
      setMessage(
        `${result.added} ${result.added === 1 ? 'novo' : 'novos'}, ${result.updated} ${result.updated === 1 ? 'descrição atualizada' : 'descrições atualizadas'}, ${result.skipped} ${result.skipped === 1 ? 'duplicata ignorada' : 'duplicatas ignoradas'}. O que já estava salvo continua.`,
      )
      await invalidateReferenceQueries()
    },
    onError: (error: Error) => setMessage(error.message),
  })

  const saved = list.data ?? []
  const saveSaved = useMutation({
    mutationFn: (row: ReferenceEntry) =>
      api.adminAddReference(kind, {
        id: row.id,
        name: savedDraft.name.trim() || row.name,
        description: savedDraft.description,
        className: savedDraft.className,
        faithPath: savedDraft.faithPath || row.faithPath,
      }),
    onSuccess: async () => {
      setEditingSavedId(null)
      setMessage('Item atualizado.')
      await invalidateReferenceQueries()
    },
    onError: (error: Error) => setMessage(error.message),
  })

  const deleteSaved = useMutation({
    mutationFn: (row: ReferenceEntry) => api.adminDeleteReference(kind, row.id),
    onSuccess: async (_data, deletedRow) => {
      if (editingSavedId === deletedRow.id) {
        setEditingSavedId(null)
      }
      setMessage('Item excluído.')
      await invalidateReferenceQueries()
    },
    onError: (error: Error) => setMessage(error.message),
  })

  const faithGroups = {
    luz: saved.filter((row) => row.faithPath === 'luz'),
    trevas: saved.filter((row) => row.faithPath === 'trevas'),
    none: saved.filter((row) => row.faithPath !== 'luz' && row.faithPath !== 'trevas'),
  }
  const savedQueryText = savedQuery.trim().toLowerCase()
  const visibleSaved = saved.filter((row) => {
    if (!savedQueryText) return true
    return (
      row.name.toLowerCase().includes(savedQueryText) ||
      row.description.toLowerCase().includes(savedQueryText) ||
      row.className.toLowerCase().includes(savedQueryText)
    )
  })
  const faithNeedsPath = meta.extra === 'faith' && !draft.faithPath
  const previewNeedsPath = meta.extra === 'faith' && (preview?.some((row) => !row.faithPath) ?? false)
  const columns = useMemo(() => {
    const base = ['Tipo', 'Descrição']
    if (meta.extra === 'faith') base.push('Caminho')
    if (meta.extra === 'class') base.unshift('Classe')
    return base
  }, [meta.extra])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Catálogos</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Crie um item ou importe a planilha, revise e só então salve. O que for salvo fica na API mesmo se o
          Supabase pausar. CSV: nome, descrição
          {meta.extra === 'faith' ? ', caminho luz ou trevas obrigatório' : ''}
          {meta.extra === 'class' ? ', class_name' : ''}.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === kind ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
            onClick={() => {
              setKind(item.id)
              setPreview(null)
              setMessage(null)
              setSavedQuery('')
              setEditingSavedId(null)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="mesa-panel flex h-full flex-col space-y-3 p-4">
          <h2 className="font-serif text-lg text-on-surface">Novo item</h2>
          <div className="grid flex-1 gap-3 md:grid-cols-2">
            {meta.extra === 'class' ? (
              <label className="text-xs uppercase text-on-surface-variant">
                Classe
                <input
                  className="input-feudal mt-1 pl-4 normal-case"
                  value={draft.className}
                  onChange={(event) => setDraft((row) => ({ ...row, className: event.target.value }))}
                />
              </label>
            ) : null}
            <label className={`text-xs uppercase text-on-surface-variant ${meta.extra === 'class' ? '' : 'md:col-span-2'}`}>
              Tipo / Nome
              <input
                className="input-feudal mt-1 pl-4 normal-case"
                value={draft.name}
                onChange={(event) => setDraft((row) => ({ ...row, name: event.target.value }))}
              />
            </label>
            <label className="text-xs uppercase text-on-surface-variant md:col-span-2">
              Descrição
              <textarea
                className="input-feudal mt-1 min-h-20 pl-4 normal-case"
                value={draft.description}
                onChange={(event) => setDraft((row) => ({ ...row, description: event.target.value }))}
              />
            </label>
            {meta.extra === 'faith' ? (
              <label className="text-xs uppercase text-on-surface-variant md:col-span-2">
                Caminho
                <select
                  className="input-feudal mt-1 pl-4 normal-case"
                  value={draft.faithPath}
                  onChange={(event) =>
                    setDraft((row) => ({ ...row, faithPath: event.target.value as Draft['faithPath'] }))
                  }
                >
                  <option value="">Escolher caminho</option>
                  <option value="luz">Luz</option>
                  <option value="trevas">Trevas</option>
                </select>
              </label>
            ) : null}
          </div>
          <div className="mt-auto pt-1">
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={
                !draft.name.trim() ||
                (meta.extra === 'class' && !draft.className.trim()) ||
                faithNeedsPath ||
                saveOne.isPending
              }
              onClick={() => saveOne.mutate()}
            >
              Salvar item
            </button>
          </div>
        </section>

        <section className="mesa-panel flex h-full flex-col space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-lg text-on-surface">Importar planilha</h2>
            <label className="btn-secondary cursor-pointer text-xs">
              Escolher CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (!file) return
                  const parsed = rowsFromCsv(meta.extra, await file.text())
                  setPreview(parsed)
                  setMessage(parsed.length ? 'Revise a prévia antes de salvar.' : 'Nenhuma linha válida no CSV.')
                }}
              />
            </label>
          </div>
          <p className="text-sm text-on-surface-variant">
            Importe um arquivo CSV com nome e descrição para adicionar ou atualizar vários registros de uma só vez.
          </p>
          {preview ? (
            <>
              <PreviewTable
                extra={meta.extra}
                rows={preview}
                onChange={setPreview}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary text-xs"
                  disabled={savePreview.isPending || preview.length === 0 || previewNeedsPath}
                  onClick={() => savePreview.mutate(preview)}
                >
                  Salvar importação
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={() => setPreview(null)}>
                  Descartar
                </button>
              </div>
              <p className="mt-auto text-xs text-on-surface-variant">
                Salvar só acrescenta. Se o tipo já existe com a mesma descrição, a linha é ignorada. Se a descrição for outra, ela é atualizada sem criar outra cópia.
                {previewNeedsPath ? ' Escolha Luz ou Trevas em cada catedral antes de salvar.' : ''}
              </p>
            </>
          ) : (
            <p className="mt-auto text-xs text-on-surface-variant">
              Nenhum CSV selecionado no momento. Escolha um arquivo acima para pré-visualizar e editar antes de gravar.
            </p>
          )}
        </section>
      </div>

      {message ? <p className="text-sm text-secondary">{message}</p> : null}

      <section className="mesa-panel p-4">
        <h2 className="font-serif text-lg text-on-surface">Salvos</h2>
        <p className="mt-1 text-xs text-on-surface-variant">{columns.join(' · ')}</p>
        {list.isLoading ? <p className="mt-3 text-sm text-on-surface-variant">Carregando…</p> : null}
        {meta.extra === 'faith' ? (
          <div className="mt-4 space-y-4">
            <div className="grid auto-rows-fr gap-4 lg:grid-cols-2 lg:items-stretch">
              <FaithColumn
                title="Luz"
                hint="Estas catedrais só aparecem no Caminho Iluminado."
                rows={faithGroups.luz}
                busy={moveFaith.isPending || saveSaved.isPending || deleteSaved.isPending}
                editingId={editingSavedId}
                draft={savedDraft}
                onStartEdit={startEditRow}
                onChangeDraft={setSavedDraft}
                onCancelEdit={() => setEditingSavedId(null)}
                onSaveEdit={(row) => saveSaved.mutate(row)}
                onDelete={(row) => deleteSaved.mutate(row)}
                onMove={(row, faithPath) => moveFaith.mutate({ ...row, faithPath })}
              />
              <FaithColumn
                title="Trevas"
                hint="Estas catedrais só aparecem no Caminho Negro."
                rows={faithGroups.trevas}
                busy={moveFaith.isPending || saveSaved.isPending || deleteSaved.isPending}
                editingId={editingSavedId}
                draft={savedDraft}
                onStartEdit={startEditRow}
                onChangeDraft={setSavedDraft}
                onCancelEdit={() => setEditingSavedId(null)}
                onSaveEdit={(row) => saveSaved.mutate(row)}
                onDelete={(row) => deleteSaved.mutate(row)}
                onMove={(row, faithPath) => moveFaith.mutate({ ...row, faithPath })}
              />
            </div>
            {faithGroups.none.length ? (
              <FaithColumn
                title="Sem caminho"
                hint="Escolha Luz ou Trevas. Enquanto estiverem aqui, não entram na ficha."
                rows={faithGroups.none}
                busy={moveFaith.isPending || saveSaved.isPending || deleteSaved.isPending}
                editingId={editingSavedId}
                draft={savedDraft}
                onStartEdit={startEditRow}
                onChangeDraft={setSavedDraft}
                onCancelEdit={() => setEditingSavedId(null)}
                onSaveEdit={(row) => saveSaved.mutate(row)}
                onDelete={(row) => deleteSaved.mutate(row)}
                onMove={(row, faithPath) => moveFaith.mutate({ ...row, faithPath })}
              />
            ) : null}
            {!list.isLoading && saved.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Nenhuma catedral salva.</p>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="relative max-w-md">
              <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-on-surface-variant">
                search
              </span>
              <input
                className="input-feudal w-full pl-10"
                placeholder="Buscar item salvo…"
                value={savedQuery}
                onChange={(event) => setSavedQuery(event.target.value)}
              />
            </div>
            <ul className="space-y-2">
              {visibleSaved.map((row) => (
                <li key={row.id} className="rounded border border-outline-variant/40 px-3 py-2">
                  {editingSavedId === row.id ? (
                    <div className="space-y-2">
                      {meta.extra === 'class' ? (
                        <label className="block text-[10px] uppercase text-on-surface-variant">
                          Classe
                          <input
                            className="input-feudal mt-1 pl-3 normal-case"
                            value={savedDraft.className}
                            onChange={(event) => setSavedDraft((current) => ({ ...current, className: event.target.value }))}
                          />
                        </label>
                      ) : null}
                      <label className="block text-[10px] uppercase text-on-surface-variant">
                        Nome
                        <input
                          className="input-feudal mt-1 pl-3 normal-case"
                          value={savedDraft.name}
                          onChange={(event) => setSavedDraft((current) => ({ ...current, name: event.target.value }))}
                        />
                      </label>
                      <label className="block text-[10px] uppercase text-on-surface-variant">
                        Descrição
                        <textarea
                          className="input-feudal mt-1 min-h-20 pl-3 normal-case"
                          value={savedDraft.description}
                          onChange={(event) => setSavedDraft((current) => ({ ...current, description: event.target.value }))}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-primary text-xs"
                          disabled={
                            saveSaved.isPending ||
                            !savedDraft.name.trim() ||
                            (meta.extra === 'class' && !savedDraft.className.trim())
                          }
                          onClick={() => saveSaved.mutate(row)}
                        >
                          Salvar
                        </button>
                        <button type="button" className="btn-secondary text-xs" onClick={() => setEditingSavedId(null)}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-on-surface">
                          {row.className ? `${row.className} · ` : ''}
                          {row.name}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {row.description || 'Sem descrição.'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => startEditRow(row)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-xs text-on-surface-variant underline transition hover:text-primary disabled:opacity-50"
                          disabled={deleteSaved.isPending}
                          onClick={() => deleteSaved.mutate(row)}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
              {!list.isLoading && visibleSaved.length === 0 ? (
                <li className="text-sm text-on-surface-variant">
                  {saved.length === 0
                    ? 'Nenhum item salvo. As telas usam a lista do código até a primeira importação.'
                    : 'Nenhum item encontrado.'}
                </li>
              ) : null}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

function FaithColumn({
  title,
  hint,
  rows,
  busy,
  editingId,
  draft,
  onStartEdit,
  onChangeDraft,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onMove,
}: {
  title: string
  hint: string
  rows: ReferenceEntry[]
  busy: boolean
  editingId: string | null
  draft: Draft
  onStartEdit: (row: ReferenceEntry) => void
  onChangeDraft: (updater: (current: Draft) => Draft) => void
  onCancelEdit: () => void
  onSaveEdit: (row: ReferenceEntry) => void
  onDelete: (row: ReferenceEntry) => void
  onMove: (row: ReferenceEntry, faithPath: 'luz' | 'trevas') => void
}) {
  return (
    <section className="flex h-full flex-col rounded border border-outline-variant/40 p-3">
      <h3 className="font-serif text-base text-on-surface">{title}</h3>
      <p className="mt-1 text-xs text-on-surface-variant">{hint}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">Nenhuma catedral neste caminho.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded border border-outline-variant/30 px-3 py-2">
              {editingId === row.id ? (
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase text-on-surface-variant">
                    Nome
                    <input
                      className="input-feudal mt-1 pl-3 normal-case"
                      value={draft.name}
                      onChange={(event) => onChangeDraft((current) => ({ ...current, name: event.target.value }))}
                    />
                  </label>
                  <label className="block text-[10px] uppercase text-on-surface-variant">
                    Descrição
                    <textarea
                      className="input-feudal mt-1 min-h-16 pl-3 normal-case"
                      value={draft.description}
                      onChange={(event) => onChangeDraft((current) => ({ ...current, description: event.target.value }))}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={busy || !draft.name.trim()}
                      onClick={() => onSaveEdit(row)}
                    >
                      Salvar
                    </button>
                    <button type="button" className="btn-secondary text-xs" onClick={onCancelEdit}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-on-surface">{row.name}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="btn-secondary text-xs" onClick={() => onStartEdit(row)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-xs text-on-surface-variant underline transition hover:text-primary disabled:opacity-50"
                        disabled={busy}
                        onClick={() => onDelete(row)}
                      >
                        Excluir
                      </button>
                      <select
                        className="input-feudal w-auto pl-3 text-xs"
                        value={row.faithPath}
                        disabled={busy}
                        aria-label={`Caminho de ${row.name}`}
                        onChange={(event) => {
                          const next = event.target.value
                          if (next !== 'luz' && next !== 'trevas') return
                          onMove(row, next)
                        }}
                      >
                        {row.faithPath !== 'luz' && row.faithPath !== 'trevas' ? (
                          <option value="">Escolher caminho</option>
                        ) : null}
                        <option value="luz">Luz</option>
                        <option value="trevas">Trevas</option>
                      </select>
                    </div>
                  </div>
                  {row.description ? <p className="mt-1 text-xs text-on-surface-variant">{row.description}</p> : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function PreviewTable({
  extra,
  rows,
  onChange,
}: {
  extra: 'faith' | 'class' | 'none'
  rows: Draft[]
  onChange: (rows: Draft[]) => void
}) {
  function patch(index: number, partial: Partial<Draft>) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...partial } : row)))
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-on-surface-variant">
          <tr>
            {extra === 'class' ? <th className="py-2 pr-2">Classe</th> : null}
            <th className="py-2 pr-2">Tipo</th>
            <th className="py-2 pr-2">Descrição</th>
            {extra === 'faith' ? <th className="py-2">Caminho</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.name}-${index}`} className="border-t border-outline-variant/30">
              {extra === 'class' ? (
                <td className="py-2 pr-2">
                  <input
                    className="input-feudal pl-3"
                    value={row.className}
                    onChange={(event) => patch(index, { className: event.target.value })}
                  />
                </td>
              ) : null}
              <td className="py-2 pr-2">
                <input
                  className="input-feudal pl-3"
                  value={row.name}
                  onChange={(event) => patch(index, { name: event.target.value })}
                />
              </td>
              <td className="py-2 pr-2">
                <input
                  className="input-feudal pl-3"
                  value={row.description}
                  onChange={(event) => patch(index, { description: event.target.value })}
                />
              </td>
              {extra === 'faith' ? (
                <td className="py-2">
                  <select
                    className="input-feudal pl-3"
                    value={row.faithPath}
                    onChange={(event) => patch(index, { faithPath: event.target.value as Draft['faithPath'] })}
                  >
                    <option value="">Escolher caminho</option>
                    <option value="luz">Luz</option>
                    <option value="trevas">Trevas</option>
                  </select>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
