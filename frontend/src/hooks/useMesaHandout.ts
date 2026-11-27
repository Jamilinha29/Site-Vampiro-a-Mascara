import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { SessionHandout } from '../types/chronicle'
import { api } from '../services/api'
import { adminQueryKeys, invalidatePlayerPublishedContent } from '../lib/queryKeys'

export function useMesaHandout(sessionId: string) {
  const qc = useQueryClient()
  const [draftState, setDraftState] = useState<{ sessionId: string; text: string } | null>(null)

  const query = useQuery({
    queryKey: adminQueryKeys.mesaHandout(sessionId),
    queryFn: () => api.adminGetMesaHandout(sessionId),
    enabled: Boolean(sessionId),
  })

  const handout = query.data
  const dirty = draftState !== null && draftState.sessionId === sessionId
  const narrativeSummary = dirty ? draftState.text : (handout?.narrativeSummary ?? '')

  const saveNarrative = useMutation({
    mutationFn: () => api.adminPatchMesaHandoutNarrative(sessionId, narrativeSummary),
    onSuccess: (updated) => {
      qc.setQueryData(adminQueryKeys.mesaHandout(sessionId), updated)
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      setDraftState(null)
    },
  })

  const patchHandout = useMutation({
    mutationFn: (body: Partial<SessionHandout>) => {
      if (!handout) throw new Error('Handout indisponível')
      return api.adminPatchHandout(handout.id, body)
    },
    onSuccess: (updated) => {
      qc.setQueryData(adminQueryKeys.mesaHandout(sessionId), updated)
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      if (updated.publishedToPlayers) invalidatePlayerPublishedContent(qc)
    },
  })

  return {
    handout,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    narrativeSummary,
    setNarrativeSummary: (value: string) => {
      setDraftState({ sessionId, text: value })
    },
    dirty,
    saveNarrative,
    patchHandout,
  }
}
