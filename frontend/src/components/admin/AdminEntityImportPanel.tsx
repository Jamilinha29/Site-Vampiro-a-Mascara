import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../ui/useToast'
import { api } from '../../services/api'

const DEFAULT_MAP: Record<string, string> = {
  nome: 'name',
  name: 'name',
  tipo: 'kind',
  kind: 'kind',
  descricao: 'description',
  description: 'description',
  categoria_loja: 'shopCategory',
  shopCategory: 'shopCategory',
  categoria_arquivo: 'archiveCategory',
  archiveCategory: 'archiveCategory',
  raridade: 'rarity',
  rarity: 'rarity',
  preco_ouro: 'priceGold',
  priceGold: 'priceGold',
  escopo_cronica: 'chronicleScope',
  chronicleScope: 'chronicleScope',
  narrador: 'narratorScope',
  narratorScope: 'narratorScope',
}

type Preview = {
  preview: true
  create: number
  duplicate: number
  rejected: number
  rejections: Array<{ line: number; name?: string; message: string }>
  total: number
}

export function AdminEntityImportPanel() {
  const { push } = useToast()
  const qc = useQueryClient()
  const [raw, setRaw] = useState('')
  const [mapText, setMapText] = useState(JSON.stringify(DEFAULT_MAP, null, 2))
  const [preview, setPreview] = useState<Preview | null>(null)

  const fieldMap = useMemo(() => {
    try {
      const parsed = JSON.parse(mapText) as Record<string, string>
      return parsed && typeof parsed === 'object' ? parsed : DEFAULT_MAP
    } catch {
      return DEFAULT_MAP
    }
  }, [mapText])

  const importMutation = useMutation({
    mutationFn: async (previewOnly: boolean) => {
      const rows = JSON.parse(raw || '[]') as unknown[]
      if (!Array.isArray(rows)) throw new Error('O arquivo deve ser um array JSON.')
      return api.adminImportEntities(rows, { fieldMap, preview: previewOnly })
    },
    onSuccess: (result, previewOnly) => {
      if (previewOnly && 'preview' in result && result.preview) {
        setPreview(result as Preview)
        push(`Prévia: ${result.create} novos, ${result.duplicate} duplicados, ${result.rejected} rejeitados.`, 'success')
        return
      }
      const imported = 'imported' in result ? result.imported : 0
      const skipped = 'skipped' in result ? result.skipped : 0
      push(`Importados ${imported} itens (${skipped} ignorados por duplicata).`, 'success')
      void qc.invalidateQueries({ queryKey: ['admin-entities'] })
      setPreview(null)
      setRaw('')
    },
    onError: (error: Error) => push(error.message, 'error'),
  })

  return (
    <section className="admin-form-panel admin-form-panel--compact flex h-full flex-col" aria-labelledby="import-heading">
      <h2 id="import-heading" className="text-xs uppercase tracking-wide text-secondary">
        Importar catálogo (JSON)
      </h2>
      <p className="text-sm text-on-surface-variant">
        Cole um array de objetos ou faça upload. O mapeamento renomeia chaves da planilha para o schema da API. Tudo entra
        como rascunho até publicar.
      </p>
      <label className="block text-xs text-on-surface-variant">
        Mapeamento de colunas (JSON)
        <textarea
          className="input-feudal mt-1 min-h-28 w-full pl-3 font-mono text-xs"
          value={mapText}
          onChange={(event) => setMapText(event.target.value)}
          spellCheck={false}
        />
      </label>
      <label className="flex flex-1 flex-col text-xs text-on-surface-variant">
        Dados
        <textarea
          className="input-feudal mt-1 min-h-40 w-full flex-1 pl-3 font-mono text-xs"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          placeholder='[{"nome":"Poção","kind":"consumable","shopCategory":"consumables"}]'
          spellCheck={false}
        />
      </label>
      <input
        type="file"
        accept="application/json,.json"
        className="text-xs text-on-surface-variant"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          void file.text().then((text) => setRaw(text))
        }}
      />
      {preview ? (
        <div className="rounded border border-white/10 p-3 text-sm" role="status">
          <p>
            Prévia: {preview.create} criar · {preview.duplicate} duplicados · {preview.rejected} rejeitados
          </p>
          {preview.rejections.length ? (
            <ul className="mt-2 max-h-32 overflow-auto text-xs text-primary">
              {preview.rejections.slice(0, 8).map((row) => (
                <li key={`${row.line}-${row.message}`}>
                  Linha {row.line}
                  {row.name ? ` (${row.name})` : ''}: {row.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={!raw.trim() || importMutation.isPending}
          onClick={() => importMutation.mutate(true)}
        >
          Pré-visualizar
        </button>
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={!raw.trim() || importMutation.isPending}
          onClick={() => importMutation.mutate(false)}
        >
          Confirmar importação
        </button>
      </div>
    </section>
  )
}