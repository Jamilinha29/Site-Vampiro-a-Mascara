import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { SessionHandout } from '../types/chronicle'
import { api } from '../services/api'
import { adminQueryKeys, invalidatePlayerPublishedContent } from '../lib/queryKeys'

export function useMesaHandout(sessionId: string) {
  const qc = useQueryClient()
  const [narrativeSummary, setNarrativeSummary] = useState('')
  const [dirty, setDirty] = useState(false)

  const query = useQuery({
    queryKey: adminQueryKeys.mesaHandout(sessionId),
    queryFn: () => api.adminGetMesaHandout(sessionId),
  })

  const handout = query.data

  useEffect(() => {
    if (handout && !dirty) {
      setNarrativeSummary(handout.narrativeSummary)
    }
  }, [handout, dirty])

  const saveNarrative = useMutation({
    mutationFn: () => api.adminPatchMesaHandoutNarrative(sessionId, narrativeSummary),
    onSuccess: (updated) => {
      qc.setQueryData(adminQueryKeys.mesaHandout(sessionId), updated)
      void qc.invalidateQueries({ queryKey: adminQueryKeys.handouts })
      setDirty(false)
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
      setNarrativeSummary(value)
      setDirty(true)
    },
    dirty,
    saveNarrative,
    patchHandout,
  }
}
