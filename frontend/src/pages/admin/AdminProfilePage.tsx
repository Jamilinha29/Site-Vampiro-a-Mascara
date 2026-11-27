import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AdminAchievementsPanel } from '../../components/admin/AdminAchievementsPanel'
import { AdminCharacterReviews } from '../../components/admin/AdminCharacterReviews'
import { AdminNoticesPanel } from '../../components/admin/AdminNoticesPanel'
import { api } from '../../services/api'
import { useToast } from '../../components/ui/useToast'
import { useAuthStore } from '../../stores/authStore'
import { adminQueryKeys } from '../../lib/queryKeys'

function formatMemberSince(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  } catch {
    return '—'
  }
}

export default function AdminProfilePage() {
  const session = useAuthStore((s) => s.session)
  const qc = useQueryClient()
  const { push } = useToast()
  const [backupFile, setBackupFile] = useState<Record<string, unknown> | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [drill, setDrill] = useState<string | null>(null)
  const { data: profile, isLoading, isError, refetch } = useQuery({
    queryKey: ['me-profile'],
    queryFn: () => api.getMeProfile(),
    enabled: !!session,
  })
  const { data: activity } = useQuery({
    queryKey: adminQueryKeys.mesaActivity,
    queryFn: () => api.adminMesaActivityStats(),
  })
  const { data: scheduled = [] } = useQuery({
    queryKey: adminQueryKeys.scheduledSessions,
    queryFn: () => api.adminListScheduledSessions(),
  })
  if (isLoading) {
    return <p className="text-sm text-on-surface-variant">Abrindo registro do mestre…</p>
  }
  if (isError || !profile) {
    return (
      <div className="card-surface space-y-3 p-5">
        <p className="text-sm text-primary">Não foi possível carregar o perfil do mestre.</p>
        <button type="button" className="btn-secondary text-xs" onClick={() => void refetch()}>
          Tentar novamente
        </button>
      </div>
    )
  }

  const prefs = profile.preferences
  const mesasTotal = scheduled.length
  const mesasOpen = scheduled.filter((s) => s.status === 'open').length

  return (
    <div className="space-y-4 pb-4">
      <section className="overflow-hidden rounded-lg border border-outline-variant/50 bg-surface-container shadow-lg">
        <div className="relative h-28 sm:h-32">
          {profile.bannerUrl ? (
            <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full bg-gradient-to-br from-[#1a0f14] via-surface-container-high to-[#0f1218]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/15 to-transparent" />
        </div>

        <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-start sm:px-6">
          <div className="-mt-12 relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border-4 border-primary/80 bg-surface-container-high shadow-xl sm:-mt-14 sm:h-28 sm:w-28">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-4xl text-outline">
                theater_comedy
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1 pt-1 sm:pt-3">
            <p className="font-label-sm text-[0.65rem] tracking-[0.25em] text-secondary uppercase">Mestre da Crônica</p>
            <h1 className="font-headline-lg mt-0.5 break-words text-2xl text-on-surface sm:text-3xl">
              {prefs.courtTitle?.trim() || profile.displayName}
            </h1>
            {prefs.chronicleSlogan?.trim() ? (
              <p className="mt-1 max-w-2xl font-serif text-sm text-on-surface-variant">{prefs.chronicleSlogan}</p>
            ) : null}
            <p className="mt-2 text-sm text-secondary">{profile.handle}</p>
            <p className="break-all text-xs text-on-surface-variant">{profile.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-secondary/40 bg-secondary/10 px-2 py-0.5 text-[10px] tracking-wide text-secondary uppercase">
                Mestre de mesa
              </span>
              {profile.publicId ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/60 bg-surface-container-lowest/70 px-2.5 py-0.5 font-mono text-[11px] text-on-surface transition hover:border-secondary/60"
                  title="Clique para copiar seu Código ID de amigo"
                  onClick={() => {
                    void navigator.clipboard?.writeText(profile.publicId!).then(
                      () => push('Código ID copiado.', 'success'),
                      () => push(`Código ID: ${profile.publicId}`, 'info'),
                    )
                  }}
                >
                  <span className="text-[10px] font-sans uppercase text-secondary">ID:</span>
                  <span>{profile.publicId}</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {profile.role === 'admin' ? (
      <section className="card-surface space-y-3 p-5">
        <h2 className="font-label-sm text-xs text-secondary uppercase">Cópia da campanha</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              void api
                .adminDownloadBackup()
                .then((data) => {
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'beladona-backup.json'
                  link.click()
                  URL.revokeObjectURL(url)
                })
                .catch((err: Error) => push(err.message || 'Falha ao baixar cópia da campanha.', 'error'))
            }}
          >
            Baixar cópia da campanha
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              void api
                .adminValidateStorage()
                .then((report) => {
                  push(
                    `Storage: ${report.reachable} referências ok, ${report.needsManualCheck} para checar no painel. ${report.note}`,
                    'success',
                  )
                })
                .catch((err: Error) => push(err.message || 'Falha ao validar referências.', 'error'))
            }}
          >
            Validar referências de mídia
          </button>
          <label className="btn-secondary cursor-pointer text-xs">
            Escolher cópia para ensaiar
            <input
              className="sr-only"
              type="file"
              accept="application/json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                void file.text().then((text) => {
                  const parsed = JSON.parse(text) as Record<string, unknown>
                  setBackupFile(parsed)
                  return api.adminDrillBackup(parsed)
                }).then((report) => {
                  if (!report) return
                  setDrill(
                    `${report.profiles} perfis, ${report.characters} fichas, ${report.inventoryItems} itens, ${report.sessions} mesas, ${report.gold} ouro, ${report.silver} prata, ${report.copper} bronze, ${report.imageReferences} imagens citadas. ${report.storageNote}`,
                  )
                }).catch(() => push('A cópia não pôde ser lida.', 'error'))
                event.target.value = ''
              }}
            />
          </label>
          <button
            type="button"
            className="btn-secondary text-xs"
            disabled={!backupFile || restoring}
            onClick={() => {
              if (!backupFile || restoring) return
              if (!window.confirm('Restaurar esta cópia substituirá perfis, mesas e carteiras atuais. Deseja continuar?')) {
                return
              }
              setRestoring(true)
              void api
                .adminRestoreBackup(backupFile)
                .then((report) => {
                  push(`Cópia restaurada: ${report.characters} fichas e ${report.wallets} carteiras.`, 'success')
                  void qc.invalidateQueries()
                })
                .catch((error: Error) => push(error.message, 'error'))
                .finally(() => setRestoring(false))
            }}
          >
            {restoring ? 'Restaurando…' : 'Restaurar esta cópia'}
          </button>
        </div>
        {drill ? <p className="text-sm text-on-surface">{drill}</p> : null}
      </section>
      ) : null}

      <div className="grid auto-rows-fr gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Mesas registradas', value: mesasTotal },
          { label: 'Mesas ao vivo', value: mesasOpen },
          { label: 'Horas (mês)', value: activity?.month.hoursActive ?? '—' },
          { label: 'Atos encerrados (mês)', value: activity?.month.actsClosed ?? '—' },
        ].map((m) => (
          <div key={m.label} className="card-surface flex h-full flex-col justify-center p-4 text-center">
            <p className="text-[0.65rem] uppercase text-on-surface-variant">{m.label}</p>
            <p className="mt-1 font-serif text-2xl text-secondary">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="card-surface flex h-full flex-col p-5">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Domínio narrativo</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-[0.65rem] uppercase text-on-surface-variant">Foco do acervo</dt>
              <dd className="text-on-surface">{prefs.archiveFocus?.trim() || '—'}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] uppercase text-on-surface-variant">RPG padrão das mesas</dt>
              <dd className="text-on-surface">{prefs.defaultRpgTitle?.trim() || '—'}</dd>
            </div>
            <div>
              <dt className="text-[0.65rem] uppercase text-on-surface-variant">Membro desde</dt>
              <dd className="text-on-surface">{formatMemberSince(profile.memberSince)}</dd>
            </div>
          </dl>
        </section>

        <section className="card-surface flex h-full flex-col p-5">
          <h2 className="font-label-sm text-xs text-secondary uppercase">Juramento &amp; voz</h2>
          {prefs.bio?.trim() ? (
            <p className="mt-3 whitespace-pre-wrap font-serif text-sm leading-relaxed text-on-surface-variant">{prefs.bio}</p>
          ) : (
            <p className="mt-3 text-sm text-on-surface-variant">
              Título, lema e biografia podem ser definidos em Configurações no menu superior.
            </p>
          )}
        </section>
      </div>

      <AdminCharacterReviews />

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-2 lg:items-stretch">
        <AdminNoticesPanel />
        <AdminAchievementsPanel />
      </div>
    </div>
  )
}
