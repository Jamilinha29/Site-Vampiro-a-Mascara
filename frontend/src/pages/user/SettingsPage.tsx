import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
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

export default function SettingsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const setSession = useAuthStore((s) => s.setSession)
  const logout = useAuthStore((s) => s.logout)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.getMeProfile(),
    enabled: !!session,
  })

  const [displayName, setDisplayName] = useState('')
  const [fiefOrigin, setFiefOrigin] = useState('')
  const [narrativePreference, setNarrativePreference] = useState('')
  const [bio, setBio] = useState('')
  const [visibility, setVisibility] = useState<UserProfile['preferences']['visibility']>('court')
  const [notifySessions, setNotifySessions] = useState(true)
  const [notifyChronicle, setNotifyChronicle] = useState(true)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.displayName)
    setFiefOrigin(profile.preferences.fiefOrigin ?? '')
    setNarrativePreference(profile.preferences.narrativePreference ?? '')
    setBio(profile.preferences.bio ?? '')
    setVisibility(profile.preferences.visibility ?? 'court')
    setNotifySessions(profile.preferences.notifySessions ?? true)
    setNotifyChronicle(profile.preferences.notifyChronicle ?? true)
  }, [profile])

  const saveAccount = useMutation({
    mutationFn: async () => {
      if (displayName.trim() !== profile?.displayName) {
        await api.patchMeAccount({ displayName: displayName.trim() })
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
      setSaved('Preferências salvas.')
      void qc.invalidateQueries({ queryKey: ['me-profile'] })
      if (session && displayName.trim()) {
        setSession({ ...session, displayName: displayName.trim() })
      }
    },
    onError: (e: Error) => setSaved(e.message),
  })

  if (isLoading || !profile) {
    return <p className="text-sm text-on-surface-variant">Carregando configurações…</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-10">
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

      <SettingsSection title="Aparência da conta">
        <ProfileMediaSettings avatarUrl={profile.avatarUrl} bannerUrl={profile.bannerUrl} />
        <p className="mt-2 text-xs text-on-surface-variant">PNG, JPEG ou WebP. Exibido no seu perfil e no menu superior.</p>
      </SettingsSection>

      <SettingsSection title="Identidade na corte">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs uppercase text-on-surface-variant sm:col-span-2">
            Nome exibido
            <input className="input-feudal mt-1 pl-4" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant">
            Alcunha
            <input className="input-feudal mt-1 pl-4 opacity-70" value={profile.handle} readOnly disabled />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant">
            E-mail (canônico)
            <input className="input-feudal mt-1 pl-4 opacity-70" value={profile.email} readOnly disabled />
          </label>
          <label className="block text-xs uppercase text-on-surface-variant sm:col-span-2">
            Biografia breve
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
        <p className="mt-2 text-xs text-on-surface-variant">E-mails reais dependem de Resend/Supabase em produção.</p>
      </SettingsSection>

      <SettingsSection title="Conta">
        <p className="text-sm text-on-surface-variant">
          Papel na mesa: <strong className="text-on-surface">Jogador</strong>
          {profile.role !== 'player' ? ' (esta conta também acessa o painel do mestre)' : ''}
        </p>
        <p className="mt-2 text-xs text-on-surface-variant">
          Alteração de senha será habilitada com autenticação Supabase. Enquanto isso, use o fluxo de desenvolvimento.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary text-xs"
            disabled={saveAccount.isPending || displayName.trim().length < 2}
            onClick={() => saveAccount.mutate()}
          >
            {saveAccount.isPending ? 'Salvando…' : 'Salvar alterações'}
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
        {saved ? <p className="mt-2 text-xs text-secondary">{saved}</p> : null}
      </SettingsSection>
    </div>
  )
}
