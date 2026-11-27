import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ProfileMediaSettings } from '../../components/profile/ProfileMediaSettings'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import type { UserProfile } from '../../types/profile'

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card-surface p-4 sm:p-5">
      <h2 className="font-label-sm text-xs text-secondary uppercase">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function PlayerSettingsForm({ profile }: { profile: UserProfile }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const setSession = useAuthStore((s) => s.setSession)
  const logout = useAuthStore((s) => s.logout)

  const [displayName, setDisplayName] = useState(profile.displayName)
  const [handle, setHandle] = useState(profile.handle)
  const [fiefOrigin, setFiefOrigin] = useState(profile.preferences.fiefOrigin ?? '')
  const [narrativePreference, setNarrativePreference] = useState(profile.preferences.narrativePreference ?? '')
  const [bio, setBio] = useState(profile.preferences.bio ?? '')
  const [visibility, setVisibility] = useState<UserProfile['preferences']['visibility']>(
    profile.preferences.visibility ?? 'court',
  )
  const [notifySessions, setNotifySessions] = useState(profile.preferences.notifySessions ?? true)
  const [notifyChronicle, setNotifyChronicle] = useState(profile.preferences.notifyChronicle ?? true)
  const [feedback, setFeedback] = useState<{ text: string; isError: boolean } | null>(null)

  const saveAccount = useMutation({
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
        fiefOrigin: fiefOrigin.trim() || null,
        narrativePreference: narrativePreference.trim() || null,
        bio: bio.trim() || null,
        visibility,
        notifySessions,
        notifyChronicle,
      })
    },
    onSuccess: async () => {
      setFeedback({ text: 'Preferências salvas.', isError: false })
      void qc.invalidateQueries({ queryKey: ['me-profile'] })
    },
    onError: (e: Error) => {
      void qc.invalidateQueries({ queryKey: ['me-profile'] })
      setFeedback({ text: e.message, isError: true })
    },
  })

  return (
    <div className="w-full space-y-4 pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-2xl text-on-surface">Configurações</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Tudo o que você pode editar na conta: aparência, identidade, preferências e avisos.
          </p>
        </div>
        <Link to="/user/profile" className="btn-secondary text-xs">
          Ver perfil público
        </Link>
      </header>

      <SettingsSection title="Foto de perfil e banner">
        <ProfileMediaSettings avatarUrl={profile.avatarUrl} bannerUrl={profile.bannerUrl} />
        <p className="mt-2 text-xs text-on-surface-variant">PNG, JPEG ou WebP. Exibido no seu perfil e no menu lateral.</p>
      </SettingsSection>

      <SettingsSection title="Identidade da conta">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase text-on-surface-variant sm:col-span-2">
            Nome de exibição
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
            Biografia do jogador
            <textarea
              className="input-feudal mt-1 min-h-20 pl-4"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Linhas sobre seu estilo de jogo, juramentos ou linhagem…"
            />
          </label>
        </div>
      </SettingsSection>

      <SettingsSection title="Preferências de jogo">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase text-on-surface-variant">
            Feudo de origem
            <input
              className="input-feudal mt-1 pl-4"
              value={fiefOrigin}
              onChange={(e) => setFiefOrigin(e.target.value)}
              placeholder="Ex.: Corte de Lisboa"
            />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant">
            Estilo narrativo preferido
            <input
              className="input-feudal mt-1 pl-4"
              value={narrativePreference}
              onChange={(e) => setNarrativePreference(e.target.value)}
              placeholder="Ex.: Intriga política, horror gótico…"
            />
          </label>
        </div>
      </SettingsSection>

      <SettingsSection title="Privacidade e avisos">
        <label className="block text-xs uppercase text-on-surface-variant">
          Visibilidade do perfil
          <select
            className="input-feudal mt-1 pl-4 normal-case"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as UserProfile['preferences']['visibility'])}
          >
            <option value="private">Privado — só você</option>
            <option value="court">Corte — jogadores da mesa</option>
            <option value="open">Aberto — quando perfis públicos existirem</option>
          </select>
        </label>
        <div className="mt-3 space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifySessions} onChange={(e) => setNotifySessions(e.target.checked)} />
            <span className="text-on-surface">Lembrar sessões agendadas e códigos da mesa</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifyChronicle} onChange={(e) => setNotifyChronicle(e.target.checked)} />
            <span className="text-on-surface">Novidades da crônica e handouts publicados</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-on-surface-variant">Envios de e-mail dependem da configuração do servidor em produção.</p>
      </SettingsSection>

      <SettingsSection title="Conta">
        <p className="text-sm text-on-surface-variant">
          Papel na mesa: <strong className="text-on-surface">Jogador</strong>
          {profile.role !== 'player' ? ' · esta conta também acessa o painel do mestre' : ''}
        </p>
        <p className="mt-2 text-xs text-on-surface-variant">
          Para alterar seu selo com segurança, utilize a recuperação oficial enviada ao seu e-mail cadastrado.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary text-xs"
            disabled={saveAccount.isPending || displayName.trim().length < 2 || handle.trim().length < 3}
            onClick={() => saveAccount.mutate()}
          >
            {saveAccount.isPending ? 'Salvando…' : 'Salvar alterações'}
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => navigate('/auth/recover')}
          >
            Redefinir senha
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              logout()
              navigate('/auth/login')
            }}
          >
            Sair da conta
          </button>
        </div>
        {feedback ? (
          <p className={`mt-2 text-xs ${feedback.isError ? 'text-primary' : 'text-secondary'}`}>{feedback.text}</p>
        ) : null}
      </SettingsSection>
    </div>
  )
}

export default function SettingsPage() {
  const session = useAuthStore((s) => s.session)
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.getMeProfile(),
    enabled: !!session,
  })

  if (isLoading) {
    return <p className="text-sm text-on-surface-variant">Carregando configurações…</p>
  }
  if (isError || !profile) {
    return (
      <div className="card-surface mx-auto max-w-md space-y-3 p-5">
        <p className="text-sm text-primary">Não foi possível carregar suas configurações.</p>
        <button type="button" className="btn-secondary text-xs" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <PlayerSettingsForm
      key={`${profile.userId}:${profile.displayName}:${profile.handle}:${profile.preferences.visibility}`}
      profile={profile}
    />
  )
}
