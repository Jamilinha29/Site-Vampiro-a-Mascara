import { useProfileMediaEditor } from './useProfileMediaEditor'

type Props = {
  avatarUrl: string | null
  bannerUrl: string | null
  compact?: boolean
}

export function ProfileMediaSettings({ avatarUrl, bannerUrl, compact = false }: Props) {
  const media = useProfileMediaEditor()
  const bannerH = compact ? 'h-24 sm:h-28' : 'h-32 sm:h-36'

  return (
    <div className="space-y-3">
      <input
        ref={media.bannerInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          media.onBannerFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={media.avatarInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          media.onAvatarFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div className={`relative overflow-hidden rounded-lg border border-outline-variant/50 ${bannerH}`}>
        {bannerUrl ? (
          <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface-container-high text-xs text-on-surface-variant">
            Sem banner
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="h-16 w-16 overflow-hidden rounded-lg border-2 border-primary/50 bg-surface-container-high">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-2xl text-outline">
              person
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={media.saving} onClick={media.openAvatarPicker}>
            {media.saving ? 'Salvando…' : 'Alterar retrato'}
          </button>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" disabled={media.saving} onClick={media.openBannerPicker}>
            Alterar banner
          </button>
        </div>
      </div>
      {media.error ? <p className="text-xs text-primary">{media.error}</p> : null}
    </div>
  )
}
