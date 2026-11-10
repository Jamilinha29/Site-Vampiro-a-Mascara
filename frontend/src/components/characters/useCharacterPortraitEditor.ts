import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { readProfileImageFile } from '../../lib/profileMedia'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'

export function useCharacterPortraitEditor(characterId: string) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const patch = useMutation({
    mutationFn: (body: Parameters<typeof api.patchMeCharacter>[1]) => api.patchMeCharacter(characterId, body),
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: playerQueryKeys.profile })
      void queryClient.invalidateQueries({ queryKey: playerQueryKeys.dashboard })
    },
    onError: (e: Error) => setError(e.message),
  })

  async function savePortrait(file: File) {
    try {
      setError(null)
      const dataUrl = await readProfileImageFile(file)
      await patch.mutateAsync({ portraitUrl: dataUrl })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar retrato.')
    }
  }

  return {
    inputRef,
    saving: patch.isPending,
    error,
    openPicker: () => inputRef.current?.click(),
    onFile: (file: File | undefined) => file && void savePortrait(file),
    patchCharacter: patch.mutateAsync,
  }
}
