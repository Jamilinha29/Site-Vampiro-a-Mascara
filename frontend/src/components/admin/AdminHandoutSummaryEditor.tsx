import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { SessionHandout } from '../../types/chronicle'
import { api } from '../../services/api'
import { adminQueryKeys, invalidatePlayerPublishedContent } from '../../lib/queryKeys'

type Props = {
  handout: SessionHandout
}

export function AdminHandoutSummaryEditor({ handout }: Props) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dirty = draft !== null && draft.id === handout.id
  const text = dirty ? draft.text : handout.narrativeSummary

  const save = useMutation({
    mutationFn: async () => {
      if (handout.scheduledSessionId) {
        return api.adminPatchMesaHandoutNarrative(handout.scheduledSessionId, text)
      }
      return api.adminPatchHandout(handout.id, { narrativeSummary: text })
    },
    onSuccess: (updated) => {
      setError(null)
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      if (handout.scheduledSessionId) {
        qc.setQueryData(adminQueryKeys.mesaHandout(handout.scheduledSessionId), updated)
      }
      invalidatePlayerPublishedContent(qc)
      setDraft(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  const togglePublish = useMutation({
    mutationFn: (publishedToPlayers: boolean) => api.adminPatchHandout(handout.id, { publishedToPlayers }),
    onSuccess: (updated) => {
      setError(null)
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      if (handout.scheduledSessionId) {
        qc.setQueryData(adminQueryKeys.mesaHandout(handout.scheduledSessionId), updated)
      }
      invalidatePlayerPublishedContent(qc)
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="mt-3 space-y-3 border-t border-outline-variant/30 pt-3">
      <label className="block text-xs uppercase text-on-surface-variant">
        Resumo narrativo
        <textarea
          className="input-feudal mt-1 min-h-32 w-full pl-4 font-serif text-sm normal-case"
          value={text}
          onChange={(e) => {
            setDraft({ id: handout.id, text: e.target.value })
          }}
        />
      </label>
      {error ? <p className="text-xs text-primary">{error}</p> : null}
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
