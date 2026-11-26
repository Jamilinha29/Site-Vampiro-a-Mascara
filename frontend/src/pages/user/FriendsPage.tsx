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
    <div className="space-y-4 pb-4">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Amigos</h1>
        <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
          Procure jogadores ou narradores pelo nome, @handle ou Código ID numérico. Amigos aparecem na busca de mesas, inclusive as privadas que pedem código de sala.
        </p>
      </header>

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-2 lg:items-stretch">
        <section className="mesa-panel flex h-full flex-col p-4">
          <h2 className="font-headline-sm text-base text-on-surface">Buscar na corte</h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Localize contas pelo nome, @handle ou Código ID numérico.
          </p>
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
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
              className="input-feudal min-w-0 w-full pl-4 sm:flex-1"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome, @handle ou Código ID"
            />
            <button type="submit" className="btn-primary shrink-0 text-xs">
              Procurar
            </button>
          </form>
          {isFetching ? <p className="mt-3 text-sm text-on-surface-variant">Buscando…</p> : null}
          {!isFetching && found.length === 0 ? (
            <p className="mt-4 text-xs text-on-surface-variant">
              {search.trim().length >= 2
                ? 'Nenhuma conta encontrada para esta busca.'
                : 'Digite ao menos 2 caracteres acima para consultar jogadores e narradores.'}
            </p>
          ) : null}
          <ul className="mt-3 space-y-2">
            {found.map((player) => {
              const targetKey = player.id || player.handle || player.email || ''
              return (
                <li
                  key={targetKey}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-outline-variant/25 bg-surface-container-lowest/40 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-serif text-on-surface">{player.displayName}</span>
                    <span className="ml-2 text-xs text-on-surface-variant">{player.handle}</span>
                    {player.role === 'narrator' || player.role === 'admin' ? (
                      <span className="ml-2 rounded border border-secondary/40 bg-secondary/10 px-1.5 py-0.5 text-[10px] text-secondary uppercase">
                        Narrador
                      </span>
                    ) : null}
                    {player.id ? (
                      <p className="mt-0.5 font-mono text-[11px] text-outline">ID: {player.id}</p>
                    ) : null}
                  </div>
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

        <div className="flex h-full flex-col gap-4">
          {(book?.incoming.length ?? 0) > 0 ? (
            <section className="mesa-panel p-4">
              <h2 className="font-headline-sm text-base text-on-surface">Pedidos recebidos</h2>
              <ul className="mt-3 space-y-2">
                {book?.incoming.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 rounded border border-outline-variant/25 bg-surface-container-lowest/35 px-3 py-2 text-sm">
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

          <section className="mesa-panel flex-1 p-4">
            <h2 className="font-headline-sm text-base text-on-surface">Seus amigos</h2>
            {(book?.friends.length ?? 0) === 0 ? (
              <p className="mt-3 text-sm text-on-surface-variant">Você ainda não tem amigos vinculados na corte.</p>
            ) : (
              <ul className="mt-3 divide-y divide-outline-variant/30">
                {book?.friends.map((friend) => {
                  const targetKey = friend.id || friend.handle || friend.email || friend.displayName
                  const confirming = confirmRemove === targetKey
                  return (
                    <li key={targetKey} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                      <div className="min-w-0">
                        <span className="font-serif text-on-surface">{friend.displayName}</span>
                        <span className="ml-2 text-xs text-on-surface-variant">{friend.handle}</span>
                        {friend.role === 'narrator' || friend.role === 'admin' ? (
                          <span className="ml-2 rounded border border-secondary/40 bg-secondary/10 px-1.5 py-0.5 text-[10px] text-secondary uppercase">
                            Narrador
                          </span>
                        ) : null}
                        {friend.id ? (
                          <p className="mt-0.5 font-mono text-[11px] text-outline">ID: {friend.id}</p>
                        ) : null}
                      </div>
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
      </div>
    </div>
  )
}
