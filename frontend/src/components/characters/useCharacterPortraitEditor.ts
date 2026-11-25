import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { readProfileImageFile } from '../../lib/profileMedia'
import { playerQueryKeys } from '../../lib/queryKeys'
import { ApiError, api } from '../../services/api'
import type { UserProfile } from '../../types/profile'

export function useCharacterPortraitEditor(characterId: string) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const patch = useMutation({
    mutationFn: (body: Parameters<typeof api.patchMeCharacter>[1]) => {
      const profile = queryClient.getQueryData<UserProfile>(playerQueryKeys.profile)
      const current = profile?.characters.find((c) => c.id === characterId)
      const expectedRevision = body.expectedRevision ?? current?.sheetRevision
      return api.patchMeCharacter(characterId, {
        ...body,
        ...(expectedRevision !== undefined ? { expectedRevision } : {}),
      })
    },
    onSuccess: () => {
      setError(null)
      setConflict(false)
      void queryClient.invalidateQueries({ queryKey: playerQueryKeys.profile })
      void queryClient.invalidateQueries({ queryKey: playerQueryKeys.dashboard })
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true)
      }
      setError(e instanceof Error ? e.message : 'Falha ao atualizar personagem.')
    },
  })

  async function savePortrait(file: File) {
    try {
      setError(null)
      setConflict(false)
      const dataUrl = await readProfileImageFile(file)
      await patch.mutateAsync({ portraitUrl: dataUrl })
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true)
      }
      setError(e instanceof Error ? e.message : 'Falha ao salvar retrato.')
    }
  }

  return {
    inputRef,
    saving: patch.isPending,
    error,
    conflict,
    clearConflict: () => {
      setConflict(false)
      setError(null)
      void queryClient.invalidateQueries({ queryKey: playerQueryKeys.profile })
    },
    openPicker: () => inputRef.current?.click(),
    onFile: (file: File | undefined) => file && void savePortrait(file),
    patchCharacter: patch.mutateAsync,
  }
}
