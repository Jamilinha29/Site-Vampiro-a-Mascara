import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SessionHandout } from '../../types/chronicle'
import { api } from '../../services/api'
import { adminQueryKeys } from '../../lib/queryKeys'

type Props = {
  handout: SessionHandout
}

export function AdminHandoutSummaryEditor({ handout }: Props) {
  const qc = useQueryClient()
  const [text, setText] = useState(handout.narrativeSummary)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setText(handout.narrativeSummary)
    setDirty(false)
  }, [handout.id, handout.narrativeSummary])

  const save = useMutation({
    mutationFn: async () => {
      if (handout.scheduledSessionId) {
        return api.adminPatchMesaHandoutNarrative(handout.scheduledSessionId, text)
      }
      return api.adminPatchHandout(handout.id, { narrativeSummary: text })
    },
    onSuccess: (updated) => {
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      if (handout.scheduledSessionId) {
        qc.setQueryData(adminQueryKeys.mesaHandout(handout.scheduledSessionId), updated)
      }
      setDirty(false)
    },
  })

  const togglePublish = useMutation({
    mutationFn: (publishedToPlayers: boolean) => api.adminPatchHandout(handout.id, { publishedToPlayers }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts }),
  })

  return (
    <div className="mt-3 space-y-3 border-t border-outline-variant/30 pt-3">
      <label className="block text-xs uppercase text-on-surface-variant">
        Resumo narrativo
        <textarea
          className="input-feudal mt-1 min-h-32 w-full pl-4 font-serif text-sm normal-case"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setDirty(true)
          }}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
        >
          Salvar resumo
        </button>
        {handout.status === 'closed' ? (
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={togglePublish.isPending}
            onClick={() => togglePublish.mutate(!handout.publishedToPlayers)}
          >
            {handout.publishedToPlayers ? 'Ocultar dos jogadores' : 'Publicar para jogadores'}
          </button>
        ) : null}
        {handout.scheduledSessionId ? (
          <Link to={`/admin/mesa/${handout.scheduledSessionId}`} className="btn-secondary text-xs">
            Abrir mesa
          </Link>
        ) : null}
      </div>
      {handout.missions.length > 0 ? (
        <div>
          <p className="text-[10px] uppercase text-secondary">Missões do ato</p>
          <ul className="mt-1 text-xs text-on-surface-variant">
            {handout.missions.map((m) => (
              <li key={m.title}>
                {m.title} · {m.priority}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
