import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useToast } from '../../components/ui/ToastProvider'

export default function FriendsPage() {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const qc = useQueryClient()
  const { push } = useToast()
  const lastSearchRef = useRef('')

  const { data: book } = useQuery({
    queryKey: ['court-friends'],
    queryFn: () => api.getFriends(),
  })
  const { data: found = [], isFetching } = useQuery({
    queryKey: ['court-player-search', search],
    queryFn: () => api.searchCourtPlayers(search),
    enabled: search.trim().length >= 2,
  })

  const request = useMutation({
    mutationFn: (targetId: string) => api.requestFriend(targetId),
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
    mutationFn: (idOrHandle: string) => api.removeFriend(idOrHandle),
    onSuccess: () => {
      setConfirmRemove(null)
      push('Amizade removida.', 'info')
      void qc.invalidateQueries({ queryKey: ['court-friends'] })
    },
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
            const trimmed = query.trim()
            if (trimmed.length < 2) {
              push('Digite ao menos 2 caracteres para buscar.', 'info')
              return
            }
            lastSearchRef.current = trimmed
            setSearch(trimmed)
          }}
        >
          <input
            className="input-feudal min-w-[16rem] flex-1 pl-4"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome ou @ do jogador (mín. 2 caracteres)"
          />
          <button type="submit" className="btn-primary text-xs">
            Procurar
          </button>
        </form>
        {isFetching ? <p className="mt-3 text-sm text-on-surface-variant">Buscando…</p> : null}
        <ul className="mt-3 space-y-2">
          {found.map((player) => {
            const targetKey = player.id || player.handle || player.email || ''
            return (
              <li key={targetKey} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-serif text-on-surface">{player.displayName}</span>
                  <span className="ml-2 text-xs text-on-surface-variant">{player.handle}</span>
                </span>
                {player.relation === 'none' ? (
                  <button
                    type="button"
                    className="btn-secondary text-[10px]"
                    disabled={request.isPending}
                    onClick={() => request.mutate(targetKey)}
                  >
                    Pedir amizade
                  </button>
                ) : (
                  <span className="text-xs text-secondary">
                    {player.relation === 'friend'
                      ? 'Amigos'
                      : player.relation === 'outgoing'
                        ? 'Pedido enviado'
                        : 'Pedido recebido'}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {(book?.incoming.length ?? 0) > 0 ? (
        <section className="mesa-panel p-5">
          <h2 className="font-headline-sm text-lg">Pedidos</h2>
          <ul className="mt-3 space-y-2">
            {book?.incoming.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-serif">{row.from.displayName}</span>
                <button
                  type="button"
                  className="btn-primary text-[10px]"
                  disabled={accept.isPending}
                  onClick={() => accept.mutate(row.id)}
                >
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
            {book?.friends.map((friend) => {
              const targetKey = friend.id || friend.handle || friend.email || friend.displayName
              const confirming = confirmRemove === targetKey
              return (
                <li key={targetKey} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-serif text-on-surface">{friend.displayName}</span>
                    <span className="ml-2 text-xs text-on-surface-variant">{friend.handle}</span>
                  </span>
                  {confirming ? (
                    <span className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="btn-primary text-[10px]"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(targetKey)}
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-[10px]"
                        onClick={() => setConfirmRemove(null)}
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary text-[10px]"
                      onClick={() => setConfirmRemove(targetKey)}
                    >
                      Desfazer
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
