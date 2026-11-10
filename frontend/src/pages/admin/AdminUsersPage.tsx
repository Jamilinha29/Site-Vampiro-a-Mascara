import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

export default function AdminUsersPage() {
  const { data: players = [], isLoading } = useQuery({
    queryKey: ['admin-registered-players'],
    queryFn: () => api.adminListRegisteredPlayers(),
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Usuários inscritos</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Contas registradas como jogador na corte — total e lista de nomes.
        </p>
      </header>

      <section className="mesa-panel p-5">
        <p className="font-label-sm text-xs text-secondary uppercase">Total de inscritos</p>
        <p className="mt-2 font-serif text-3xl text-on-surface">{players.length}</p>
        <p className="mt-1 text-xs text-on-surface-variant">Usuários com papel de jogador</p>
      </section>

      <section className="mesa-panel p-5">
        <h2 className="font-headline-sm text-lg text-on-surface">Nomes</h2>
        {isLoading ? <p className="mt-3 text-sm text-on-surface-variant">Carregando…</p> : null}
        {!isLoading && players.length === 0 ? (
          <p className="mt-3 text-sm text-on-surface-variant">Nenhum jogador inscrito ainda.</p>
        ) : (
          <ul className="mt-4 divide-y divide-outline-variant/30">
            {players.map((p) => (
              <li key={p.email} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-serif text-on-surface">{p.displayName}</p>
                  <p className="text-xs text-on-surface-variant">
                    {p.handle} · {p.email}
                  </p>
                </div>
                <div className="text-right text-xs text-on-surface-variant">
                  <p>{p.characters} personagem(ns)</p>
                  <p>Desde {new Date(p.memberSince).toLocaleDateString('pt-BR')}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
