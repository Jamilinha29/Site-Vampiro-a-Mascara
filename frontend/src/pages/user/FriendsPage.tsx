import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useToast } from '../../components/ui/ToastProvider'

export default function FriendsPage() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const qc = useQueryClient()
  const { push } = useToast()

  const { data: book } = useQuery({
    queryKey: ['court-friends'],
    queryFn: () => api.getFriends(),
  })
  const { data: found = [], isFetching } = useQuery({
    queryKey: ['court-player-search', search],
    queryFn: () => api.searchCourtPlayers(search),
    enabled: search.trim().length > 0,
  })

  const request = useMutation({
    mutationFn: (email: string) => api.requestFriend(email),
    onSuccess: () => {
      push('Pedido de amizade enviado.', 'success')
      void qc.invalidateQueries({ queryKey: ['court-player-search'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })
  const accept = useMutation({
    mutationFn: (id: string) => api.acceptFriend(id),
    onSuccess: () => {
      push('Amizade aceita.', 'success')
      void qc.invalidateQueries({ queryKey: ['court-friends'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })
  const remove = useMutation({
    mutationFn: (email: string) => api.removeFriend(email),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['court-friends'] }),
    onError: (e: Error) => push(e.message, 'error'),
  })

  return (
    <div className="space-y-6 pb-8">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Amigos</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Procure outros jogadores. Amigos aparecem na busca de mesas, inclusive as privadas que ainda pedem código de sala.
        </p>
      </header>

      <section className="mesa-panel p-5">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(query.trim())
          }}
        >
          <input
            className="input-feudal min-w-[16rem] flex-1 pl-4"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome ou @ do jogador"
          />
          <button type="submit" className="btn-primary text-xs">
            Procurar
          </button>
        </form>
        {isFetching ? <p className="mt-3 text-sm text-on-surface-variant">Buscando…</p> : null}
        <ul className="mt-3 space-y-2">
          {found.map((player) => (
            <li key={player.email} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-serif text-on-surface">{player.displayName}</span>
                <span className="ml-2 text-xs text-on-surface-variant">{player.handle}</span>
              </span>
              {player.relation === 'none' ? (
                <button type="button" className="btn-secondary text-[10px]" onClick={() => request.mutate(player.email)}>
                  Pedir amizade
                </button>
              ) : (
                <span className="text-xs text-secondary">
                  {player.relation === 'friend' ? 'Amigos' : player.relation === 'outgoing' ? 'Pedido enviado' : 'Pedido recebido'}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      {(book?.incoming.length ?? 0) > 0 ? (
        <section className="mesa-panel p-5">
          <h2 className="font-headline-sm text-lg">Pedidos</h2>
          <ul className="mt-3 space-y-2">
            {book?.incoming.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-serif">{row.from.displayName}</span>
                <button type="button" className="btn-primary text-[10px]" onClick={() => accept.mutate(row.id)}>
                  Aceitar
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mesa-panel p-5">
        <h2 className="font-headline-sm text-lg">Seus amigos</h2>
        {(book?.friends.length ?? 0) === 0 ? (
          <p className="mt-2 text-sm text-on-surface-variant">Você ainda não tem amigos na corte.</p>
        ) : (
          <ul className="mt-3 divide-y divide-outline-variant/30">
            {book?.friends.map((friend) => (
              <li key={friend.email} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-serif text-on-surface">{friend.displayName}</span>
                  <span className="ml-2 text-xs text-on-surface-variant">{friend.handle}</span>
                </span>
                <button type="button" className="btn-secondary text-[10px]" onClick={() => remove.mutate(friend.email)}>
                  Desfazer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
