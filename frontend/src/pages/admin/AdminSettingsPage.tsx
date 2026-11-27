import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ProfileMediaSettings } from '../../components/profile/ProfileMediaSettings'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import type { UserProfile } from '../../types/profile'

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="admin-form-panel">
      <h2 className="font-label-sm text-xs text-secondary uppercase">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function AdminSettingsForm({ profile }: { profile: UserProfile }) {
  const qc = useQueryClient()
  const session = useAuthStore((s) => s.session)
  const setSession = useAuthStore((s) => s.setSession)

  const p = profile.preferences
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [handle, setHandle] = useState(profile.handle)
  const [courtTitle, setCourtTitle] = useState(p.courtTitle ?? '')
  const [chronicleSlogan, setChronicleSlogan] = useState(p.chronicleSlogan ?? '')
  const [archiveFocus, setArchiveFocus] = useState(p.archiveFocus ?? '')
  const [defaultRpgTitle, setDefaultRpgTitle] = useState(p.defaultRpgTitle ?? '')
  const [bio, setBio] = useState(p.bio ?? '')
  const [notifySessions, setNotifySessions] = useState(p.notifySessions ?? true)
  const [notifyChronicle, setNotifyChronicle] = useState(p.notifyChronicle ?? true)
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null)

  const save = useMutation({
    mutationFn: async () => {
      const accountPatch: { displayName?: string; handle?: string } = {}
      if (displayName.trim() !== profile.displayName) {
        accountPatch.displayName = displayName.trim()
      }
      if (handle.trim() !== profile.handle) {
        accountPatch.handle = handle.trim()
      }
      if (accountPatch.displayName !== undefined || accountPatch.handle !== undefined) {
        const updatedAccount = await api.patchMeAccount(accountPatch)
        setDisplayName(updatedAccount.displayName)
        setHandle(updatedAccount.handle)
        if (session && updatedAccount.displayName) {
          setSession({ ...session, displayName: updatedAccount.displayName })
        }
      }
      await api.patchMePreferences({
        courtTitle: courtTitle.trim() || null,
        chronicleSlogan: chronicleSlogan.trim() || null,
        archiveFocus: archiveFocus.trim() || null,
        defaultRpgTitle: defaultRpgTitle.trim() || null,
        bio: bio.trim() || null,
        notifySessions,
        notifyChronicle,
      })
    },
    onSuccess: () => {
      setFeedback({ text: 'Configurações salvas.', isError: false })
      void qc.invalidateQueries({ queryKey: ['me-profile'] })
    },
    onError: (e: Error) => {
      void qc.invalidateQueries({ queryKey: ['me-profile'] })
      setFeedback({ text: e.message, isError: true })
    },
  })

  return (
    <div className="w-full space-y-4 pb-10">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Configurações</h1>
        <p className="mt-1 text-sm text-on-surface-variant">Identidade pública e avisos do painel ADM.</p>
      </header>

      <Block title="Foto de perfil e banner">
        <ProfileMediaSettings avatarUrl={profile.avatarUrl} bannerUrl={profile.bannerUrl} compact />
      </Block>

      <Block title="Identidade da conta e do narrador">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs uppercase text-on-surface-variant sm:col-span-2">
            Nome de exibição no login
            <input className="input-feudal mt-1 pl-4" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant">
            Nome de usuário @
            <input
              className="input-feudal mt-1 pl-4"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@seu_usuario"
            />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant">
            E-mail de acesso
            <input className="input-feudal mt-1 pl-4 opacity-70" value={profile.email} readOnly disabled />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant sm:col-span-2">
            Título público do narrador
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
          <label className="block text-xs uppercase text-on-surface-variant">
            Foco do glossário e bestiário
            <input
              className="input-feudal mt-1 pl-4"
              value={archiveFocus}
              onChange={(e) => setArchiveFocus(e.target.value)}
              placeholder="Ex.: Linhagem Toreador, cultos de sangue…"
            />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant">
            RPG padrão das mesas
            <input
              className="input-feudal mt-1 pl-4"
              value={defaultRpgTitle}
              onChange={(e) => setDefaultRpgTitle(e.target.value)}
              placeholder="Ex.: Vampiro: A Máscara — Idade das Trevas"
            />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant sm:col-span-2">
            Biografia do narrador
            <textarea
              className="input-feudal textarea-compact mt-1 pl-4"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Estilo de condução, temas preferidos, limites da mesa…"
            />
          </label>
        </div>
      </Block>

      <Block title="Operação e avisos">
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifySessions} onChange={(e) => setNotifySessions(e.target.checked)} />
            <span>Alertas quando uma mesa abre ou encerra</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifyChronicle} onChange={(e) => setNotifyChronicle(e.target.checked)} />
            <span>Resumir publicações pendentes de handouts e rascunhos</span>
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
          disabled={save.isPending || displayName.trim().length < 2 || handle.trim().length < 3}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Salvando…' : 'Salvar configurações'}
        </button>
        {feedback ? (
          <span className={`text-xs ${feedback.isError ? 'text-primary' : 'text-secondary'}`}>{feedback.text}</span>
        ) : null}
      </div>
    </div>
  )
}

export default function AdminSettingsPage() {
  const session = useAuthStore((s) => s.session)
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.getMeProfile(),
    enabled: !!session,
  })

  if (isLoading) {
    return <p className="text-sm text-on-surface-variant">Carregando…</p>
  }
  if (isError || !profile) {
    return (
      <div className="card-surface mx-auto max-w-md space-y-3 p-5">
        <p className="text-sm text-primary">Não foi possível carregar as configurações do narrador.</p>
        <button type="button" className="btn-secondary text-xs" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <AdminSettingsForm
      key={`${profile.userId}:${profile.displayName}:${profile.handle}:${profile.preferences.courtTitle ?? ''}`}
      profile={profile}
    />
  )
}
