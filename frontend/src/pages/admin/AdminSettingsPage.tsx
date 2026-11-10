import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ProfileMediaSettings } from '../../components/profile/ProfileMediaSettings'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="admin-form-panel">
      <h2 className="font-label-sm text-xs text-secondary uppercase">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function AdminSettingsPage() {
  const qc = useQueryClient()
  const session = useAuthStore((s) => s.session)
  const setSession = useAuthStore((s) => s.setSession)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.getMeProfile(),
    enabled: !!session,
  })

  const [displayName, setDisplayName] = useState('')
  const [courtTitle, setCourtTitle] = useState('')
  const [chronicleSlogan, setChronicleSlogan] = useState('')
  const [archiveFocus, setArchiveFocus] = useState('')
  const [bio, setBio] = useState('')
  const [notifySessions, setNotifySessions] = useState(true)
  const [notifyChronicle, setNotifyChronicle] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.displayName)
    const p = profile.preferences
    setCourtTitle(p.courtTitle ?? '')
    setChronicleSlogan(p.chronicleSlogan ?? '')
    setArchiveFocus(p.archiveFocus ?? '')
    setBio(p.bio ?? '')
    setNotifySessions(p.notifySessions ?? true)
    setNotifyChronicle(p.notifyChronicle ?? true)
  }, [profile])

  const save = useMutation({
    mutationFn: async () => {
      if (displayName.trim() !== profile?.displayName) {
        await api.patchMeAccount({ displayName: displayName.trim() })
      }
      await api.patchMePreferences({
        courtTitle: courtTitle.trim() || null,
        chronicleSlogan: chronicleSlogan.trim() || null,
        archiveFocus: archiveFocus.trim() || null,
        bio: bio.trim() || null,
        notifySessions,
        notifyChronicle,
      })
    },
    onSuccess: () => {
      setMessage('Configurações salvas.')
      void qc.invalidateQueries({ queryKey: ['me-profile'] })
      if (session && displayName.trim()) {
        setSession({ ...session, displayName: displayName.trim() })
      }
    },
    onError: (e: Error) => setMessage(e.message),
  })

  if (isLoading || !profile) {
    return <p className="text-sm text-on-surface-variant">Carregando…</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-10">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Configurações</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Identidade pública e avisos do painel ADM.</p>
      </header>

      <Block title="Brasão &amp; cenário">
        <ProfileMediaSettings avatarUrl={profile.avatarUrl} bannerUrl={profile.bannerUrl} compact />
      </Block>

      <Block title="Identidade do narrador">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs uppercase text-on-surface-variant sm:col-span-2">
            Nome civil (login)
            <input className="input-feudal mt-1 pl-4" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant sm:col-span-2">
            Título na corte
            <input
              className="input-feudal mt-1 pl-4"
              value={courtTitle}
              onChange={(e) => setCourtTitle(e.target.value)}
              placeholder="Ex.: Príncipe de Sombras de Beladona"
            />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant sm:col-span-2">
            Lema da crônica
            <input
              className="input-feudal mt-1 pl-4"
              value={chronicleSlogan}
              onChange={(e) => setChronicleSlogan(e.target.value)}
              placeholder="Ex.: O véu entre mundos exige testemunhas."
            />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant sm:col-span-2">
            Foco do acervo (glossário / bestiário)
            <input
              className="input-feudal mt-1 pl-4"
              value={archiveFocus}
              onChange={(e) => setArchiveFocus(e.target.value)}
              placeholder="Ex.: Linhagem Toreador, cultos de sangue…"
            />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant sm:col-span-2">
            Biografia do mestre
            <textarea
              className="input-feudal textarea-compact mt-1 pl-4"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Estilo de condução, temas preferidos, limites da mesa…"
            />
          </label>
        </div>
      </Block>

      <Block title="Operação &amp; avisos">
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifySessions} onChange={(e) => setNotifySessions(e.target.checked)} />
            <span>Alertas quando uma mesa abre ou encerra</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifyChronicle} onChange={(e) => setNotifyChronicle(e.target.checked)} />
            <span>Resumir publicações pendentes (handouts, entidades em rascunho)</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">
          Publicação: entidades continuam em <strong className="text-on-surface">rascunho</strong> até você publicar na vitrine
          correspondente.
        </p>
      </Block>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary text-xs"
          disabled={save.isPending || displayName.trim().length < 2}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Salvando…' : 'Salvar configurações'}
        </button>
        {message ? <span className="text-xs text-secondary">{message}</span> : null}
      </div>
    </div>
  )
}
