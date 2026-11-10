import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { readProfileImageFile } from '../../lib/profileMedia'
import { api } from '../../services/api'

export function useProfileMediaEditor() {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const patch = useMutation({
    mutationFn: api.patchMeProfile,
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['me-profile'] })
    },
    onError: (e: Error) => setError(e.message),
  })

  async function saveField(field: 'bannerUrl' | 'avatarUrl', file: File) {
    try {
      setError(null)
      const dataUrl = await readProfileImageFile(file)
      await patch.mutateAsync({ [field]: dataUrl })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar imagem.')
    }
  }

  return {
    bannerInputRef,
    avatarInputRef,
    saving: patch.isPending,
    error,
    openBannerPicker: () => bannerInputRef.current?.click(),
    openAvatarPicker: () => avatarInputRef.current?.click(),
    onBannerFile: (file: File | undefined) => file && void saveField('bannerUrl', file),
    onAvatarFile: (file: File | undefined) => file && void saveField('avatarUrl', file),
  }
}
