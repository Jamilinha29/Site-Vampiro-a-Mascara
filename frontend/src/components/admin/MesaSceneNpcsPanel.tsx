import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { SceneNpc, SessionHandout } from '../../types/chronicle'
import { api } from '../../services/api'
import { adminQueryKeys } from '../../lib/queryKeys'

type Props = {
  sessionId: string
  live: boolean
  npcs: SceneNpc[]
  layout?: 'embedded' | 'standalone'
}

export function MesaSceneNpcsPanel({ sessionId, live, npcs, layout = 'embedded' }: Props) {
  const qc = useQueryClient()
  const [pickId, setPickId] = useState('')

  const { data: entities = [] } = useQuery({
    queryKey: adminQueryKeys.entities('npc'),
    queryFn: () => api.adminListEntities('npc'),
  })

  const publishedNpcs = entities.filter((e) => e.visibility === 'published')

  const invalidate = (handout: SessionHandout) => {
    qc.setQueryData(adminQueryKeys.mesaHandout(sessionId), handout)
  }

  const addNpc = useMutation({
    mutationFn: () => api.adminAddSceneNpc(sessionId, pickId),
    onSuccess: invalidate,
  })

  const removeNpc = useMutation({
    mutationFn: (npcId: string) => api.adminRemoveSceneNpc(sessionId, npcId),
    onSuccess: invalidate,
  })

  return (
    <div className={`space-y-4 ${layout === 'embedded' ? 'border-t border-outline-variant/30 pt-4' : ''}`}>
      <h3 className="font-label-sm text-xs text-secondary uppercase">NPCs em cena (missões)</h3>
      <p className="text-xs text-on-surface-variant">
        Escolha personagens do acervo publicados — visíveis aos jogadores para interações e objetivos do ato.
      </p>

      {live ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-xs uppercase text-on-surface-variant">
            Acervo de NPCs
            <select
              className="input-feudal mt-1 w-full py-2 pl-3 text-sm normal-case"
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
            >
              <option value="">Selecionar NPC…</option>
              {publishedNpcs.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-secondary shrink-0 text-xs"
            disabled={!pickId || addNpc.isPending}
            onClick={() => addNpc.mutate()}
          >
            Colocar em cena
          </button>
        </div>
      ) : null}

      {addNpc.isError ? <p className="text-xs text-primary">{(addNpc.error as Error).message}</p> : null}

      {npcs.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhum NPC ativo na cena.</p>
      ) : (
        <ul className="space-y-3">
          {npcs.map((n) => (
            <li key={n.id} className="rounded border border-outline-variant/40 bg-surface-container-lowest/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-serif text-base text-on-surface">{n.name}</p>
                {live ? (
                  <button
                    type="button"
                    className="text-xs text-on-surface-variant hover:text-primary"
                    onClick={() => removeNpc.mutate(n.id)}
                  >
                    Remover
                  </button>
                ) : null}
              </div>
              {n.description ? (
                <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{n.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
