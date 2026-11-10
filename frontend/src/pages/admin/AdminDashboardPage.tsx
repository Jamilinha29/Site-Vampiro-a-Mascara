import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { AdminCharacterPieChart } from '../../components/admin/AdminCharacterPieChart'
import { AdminLineChart } from '../../components/admin/AdminLineChart'
import { AdminSessionCalendar } from '../../components/admin/AdminSessionCalendar'
import { api } from '../../services/api'
import { adminQueryKeys } from '../../lib/queryKeys'
import { findTodayMesaSession, mesaDisplayName } from '../../lib/mesaSession'

export default function AdminDashboardPage() {
  const { data: scheduled = [] } = useQuery({
    queryKey: adminQueryKeys.scheduledSessions,
    queryFn: () => api.adminListScheduledSessions(),
  })
  const { data: handouts = [] } = useQuery({
    queryKey: adminQueryKeys.handouts,
    queryFn: () => api.adminListHandouts(),
  })
  const { data: lineSeries = [] } = useQuery({
    queryKey: adminQueryKeys.sessionLine,
    queryFn: () => api.adminSessionLineSeries(),
  })
  const { data: playerCharacterSeries = [] } = useQuery({
    queryKey: adminQueryKeys.playerCharacters,
    queryFn: () => api.adminPlayerCharacterSeries(),
  })
  const { data: activity } = useQuery({
    queryKey: adminQueryKeys.mesaActivity,
    queryFn: () => api.adminMesaActivityStats(),
  })

  const todayMesa = findTodayMesaSession(scheduled)
  const openMesas = handouts.filter((h) => h.status === 'pending_close')

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Início</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Mesa do narrador: mesas abertas, agenda e estatísticas. Crie novas mesas em Sessões.
        </p>
      </header>

      {activity ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Mesas abertas agora" value={String(activity.openMesas)} hint="Não encerradas" />
          <StatCard
            label="Horas ativas · hoje"
            value={`${activity.day.hoursActive}h`}
            hint={`${activity.day.sessionsMarked} sessões · ${activity.day.actsClosed} atos fechados`}
          />
          <StatCard
            label="Horas · semana"
            value={`${activity.week.hoursActive}h`}
            hint={`${activity.week.sessionsMarked} marcadas · ${activity.week.actsClosed} encerrados`}
          />
          <StatCard
            label="Horas · mês"
            value={`${activity.month.hoursActive}h`}
            hint={`${activity.month.sessionsMarked} marcadas · ${activity.month.actsClosed} encerrados`}
          />
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {todayMesa ? (
          <section className="card-surface border-secondary/35 p-5">
            <p className="font-label-sm text-xs text-secondary uppercase">Mesa de hoje</p>
            <p className="mt-1 font-serif text-xl text-on-surface">{mesaDisplayName(todayMesa)}</p>
            <p className="mt-1 text-xs text-on-surface-variant">
              {new Date(todayMesa.scheduledAt).toLocaleString('pt-BR')}
            </p>
            <Link to={`/admin/mesa/${todayMesa.id}`} className="btn-primary mt-4 inline-flex text-xs">
              Abrir mesa
            </Link>
          </section>
        ) : (
          <section className="card-surface p-5">
            <p className="font-label-sm text-xs text-secondary uppercase">Nenhuma mesa hoje</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Crie uma mesa em <Link to="/admin/sessions" className="text-secondary underline">Sessões</Link>.
            </p>
          </section>
        )}

        <section className="card-surface p-5">
          <p className="font-label-sm text-xs text-secondary uppercase">Nova mesa</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            O formulário <strong className="text-on-surface">Criar outra mesa</strong> agora fica em Sessões.
          </p>
          <Link to="/admin/sessions" className="btn-secondary mt-4 inline-flex text-xs">
            Ir para sessões
          </Link>
        </section>
      </div>

      <section className="card-surface p-5">
        <h2 className="font-headline-sm text-lg">Próximas sessões marcadas</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Calendário da agenda, atividade recente e personagens criados pelos jogadores.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <AdminSessionCalendar sessions={scheduled} />
          <AdminLineChart series={lineSeries} />
          <AdminCharacterPieChart series={playerCharacterSeries} />
        </div>
      </section>

      <section className="card-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-headline-sm text-lg">Mesas não encerradas</h2>
          <Link to="/admin/sessions" className="btn-secondary text-xs">
            Ver todos os resumos
          </Link>
        </div>
        {openMesas.length === 0 ? (
          <p className="mt-3 text-sm text-on-surface-variant">Nenhuma mesa em andamento.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {openMesas.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-outline-variant/40 px-3 py-2 text-sm"
              >
                <span className="font-serif text-on-surface">{h.chronicleName ?? h.title}</span>
                {h.scheduledSessionId ? (
                  <Link to={`/admin/mesa/${h.scheduledSessionId}`} className="btn-secondary text-xs">
                    Continuar mesa
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  )
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card-surface p-4">
      <p className="text-[0.65rem] uppercase tracking-wider text-on-surface-variant">{label}</p>
      <p className="mt-1 font-serif text-2xl text-on-surface">{value}</p>
      <p className="mt-1 text-xs text-secondary">{hint}</p>
    </div>
  )
}
