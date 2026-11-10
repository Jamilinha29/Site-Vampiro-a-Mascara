import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { readProfileImageFile } from '../../lib/profileMedia'
import { invalidatePlayerPublishedContent } from '../../lib/queryKeys'
import type { ChronicleEntity, CreateEntityPayload } from '../../types/chronicle'
import { api } from '../../services/api'

const CATEGORIES = [
  { id: 'handouts' as const, label: 'Histórico de atos / handouts' },
  { id: 'sheets' as const, label: 'Fichas imprimíveis' },
  { id: 'rules' as const, label: 'Tratados & cartografia' },
]

export default function AdminDownloadsPage() {
  const qc = useQueryClient()
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['id']>('sheets')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileUrl, setFileUrl] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)

  const { data: items = [] } = useQuery({
    queryKey: ['admin-entities', 'download'],
    queryFn: () => api.adminListEntities('download'),
  })

  const filtered = items.filter((i) => (i.downloadCategory ?? 'rules') === category)

  function reset() {
    setEditingId(null)
    setName('')
    setDescription('')
    setFileName('')
    setFileUrl(undefined)
    setError(null)
  }

  function load(item: ChronicleEntity) {
    setEditingId(item.id)
    setName(item.name)
    setDescription(item.description ?? '')
    setFileName(item.fileName ?? '')
    setFileUrl(item.fileUrl)
    setCategory(item.downloadCategory ?? 'rules')
    setError(null)
  }

  const create = useMutation({
    mutationFn: (body: CreateEntityPayload) => api.adminCreateEntity(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities', 'download'] })
      invalidatePlayerPublishedContent(qc)
      reset()
    },
    onError: (e: Error) => setError(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CreateEntityPayload }) => api.adminUpdateEntity(id, body),
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
      void qc.invalidateQueries({ queryKey: ['admin-entities', 'download'] })
      invalidatePlayerPublishedContent(qc)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.adminDeleteEntity(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities', 'download'] })
      invalidatePlayerPublishedContent(qc)
    },
  })

  function submit() {
    if (!name.trim()) return
    const body: CreateEntityPayload = {
      kind: 'download',
      name: name.trim(),
      description,
      downloadCategory: category,
      fileName: fileName || undefined,
      fileUrl,
    }
    if (editingId) update.mutate({ id: editingId, body })
    else create.mutate(body)
  }

  return (
    <div className="space-y-8 pb-8">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Central de downloads</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Cadastre e edite os arquivos que os jogadores veem e baixam. Os dados ficam salvos e sincronizam com a área
          do usuário.
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
              reset()
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="admin-form-panel admin-form-panel--compact h-full">
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
          <label className="block text-xs uppercase text-on-surface-variant">
            Nome
            <input className="input-feudal mt-1 pl-4" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant">
            Descrição
            <textarea
              className="input-feudal textarea-compact mt-1 pl-4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant">
            Arquivo
            <input
              type="file"
              className="mt-2 block text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const dataUrl = await readProfileImageFile(file)
                  setFileUrl(dataUrl)
                  setFileName(file.name)
                  setError(null)
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Falha no upload')
                }
              }}
            />
            {fileName ? <p className="mt-1 text-xs text-on-surface-variant">{fileName}</p> : null}
          </label>
          {error ? <p className="text-sm text-primary">{error}</p> : null}
          <button
            type="button"
            className="btn-primary text-sm"
            disabled={create.isPending || update.isPending}
            onClick={submit}
          >
            Salvar
          </button>
        </section>

        <section className="admin-form-panel flex min-h-0 flex-col lg:max-h-[32rem]">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Arquivos cadastrados</h2>
          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Nenhum arquivo nesta pasta.</p>
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
                        onClick={() => publish.mutate(file.id)}
                      >
                        Publicar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-[10px] text-on-surface-variant underline"
                      onClick={() => remove.mutate(file.id)}
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
