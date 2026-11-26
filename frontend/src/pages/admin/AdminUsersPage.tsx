import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'
import { useToast } from '../../components/ui/ToastProvider'

type Relation = 'none' | 'friend' | 'outgoing' | 'incoming'
type RosterPlayer = {
  id: string
  email?: string
  displayName: string
  handle: string
  role?: string
  characters: number
  relation: Relation
  linkId: string | null
}
type Tab = 'friends' | 'incoming' | 'outgoing' | 'all'

const PAGE_SIZES = [5, 10, 20]

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

export default function AdminUsersPage() {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('friends')
  const [roleFilter, setRoleFilter] = useState<'all' | 'player' | 'narrator'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'characters'>('name')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(1)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [showMyCode, setShowMyCode] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const { push } = useToast()

  const { data: profile } = useQuery({
    queryKey: playerQueryKeys.profile,
    queryFn: () => api.getMeProfile(),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['admin-court-players'],
    queryFn: () => api.adminCourtPlayers(),
  })

  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin-court-players'] })

  const invite = useMutation({
    mutationFn: (target: string) => api.adminAddFriend(target),
    onSuccess: () => {
      push('Convite enviado.', 'success')
      refresh()
    },
    onError: (e: Error) => push(e.message, 'error'),
  })
  const accept = useMutation({
    mutationFn: (id: string) => api.acceptFriend(id),
    onSuccess: () => {
      push('Amizade aceita.', 'success')
      refresh()
    },
    onError: (e: Error) => push(e.message, 'error'),
  })
  const remove = useMutation({
    mutationFn: (idOrEmail: string) => api.adminRemoveFriend(idOrEmail),
    onSuccess: () => {
      setConfirmRemove(null)
      push('Vínculo removido.', 'info')
      refresh()
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const roster = data?.roster ?? []
  const friends = roster.filter((player) => player.relation === 'friend')
  const incoming = roster.filter((player) => player.relation === 'incoming')
  const outgoing = roster.filter((player) => player.relation === 'outgoing')

  const filteredRows = useMemo(() => {
    const base =
      tab === 'friends'
        ? friends
        : tab === 'incoming'
          ? incoming
          : tab === 'outgoing'
            ? outgoing
            : roster
    const q = query.trim().toLowerCase()
    const filtered = base.filter((player) => {
      const isNarrator = player.role === 'narrator' || player.role === 'admin'
      if (roleFilter === 'narrator' && !isNarrator) return false
      if (roleFilter === 'player' && isNarrator) return false
      if (q) {
        return [player.displayName, player.handle, player.id, player.email ?? ''].join(' ').toLowerCase().includes(q)
      }
      return true
    })
    return [...filtered].sort((a, b) => {
      if (sortBy === 'characters') return b.characters - a.characters
      return a.displayName.localeCompare(b.displayName, 'pt-BR')
    })
  }, [tab, friends, incoming, outgoing, roster, query, roleFilter, sortBy])

  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, pages)
  const slice = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  function changeTab(next: Tab) {
    setTab(next)
    setPage(1)
    setConfirmRemove(null)
  }

  function focusSearch() {
    changeTab('all')
    window.setTimeout(() => searchInputRef.current?.focus(), 20)
  }

  async function copyText(text: string, okMessage: string) {
    try {
      await navigator.clipboard.writeText(text)
      push(okMessage, 'success')
    } catch {
      push('Não foi possível copiar automaticamente.', 'error')
    }
  }

  const listTitle =
    tab === 'friends'
      ? 'Resultados e amigos'
      : tab === 'incoming'
        ? 'Solicitações recebidas'
        : tab === 'outgoing'
          ? 'Solicitações enviadas'
          : 'Todos os jogadores'

  return (
    <div className="space-y-4 pb-4">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary-container/25 text-primary">
          <span className="material-symbols-outlined text-2xl">groups</span>
        </span>
        <div>
          <h1 className="font-headline-lg text-2xl text-on-surface">Amigos e jogadores</h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Gerencie suas amizades com jogadores e narradores, envie convites por nome ou Código ID numérico e acompanhe solicitações.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-8">
          <nav className="mesa-panel grid grid-cols-2 gap-1.5 p-1.5 sm:grid-cols-4" aria-label="Abas de amigos e jogadores">
            <button
              type="button"
              onClick={() => changeTab('friends')}
              className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition ${
                tab === 'friends'
                  ? 'bg-primary-container text-white'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">group</span>
              <span>Meus amigos</span>
              {friends.length > 0 ? (
                <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[10px]">{friends.length}</span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => changeTab('incoming')}
              className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition ${
                tab === 'incoming'
                  ? 'bg-primary-container text-white'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">mail</span>
              <span>Recebidas</span>
              {incoming.length > 0 ? (
                <span className="rounded-full bg-primary/25 px-1.5 py-0.5 text-[10px] text-primary">
                  {incoming.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => changeTab('outgoing')}
              className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition ${
                tab === 'outgoing'
                  ? 'bg-primary-container text-white'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">send</span>
              <span>Enviadas</span>
              {outgoing.length > 0 ? (
                <span className="rounded-full bg-secondary/20 px-1.5 py-0.5 text-[10px] text-secondary">
                  {outgoing.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={focusSearch}
              className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition ${
                tab === 'all'
                  ? 'bg-primary-container text-white'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              <span>Adicionar</span>
            </button>
          </nav>

          <section className="mesa-panel space-y-3 p-4">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined mt-0.5 text-xl text-primary">search</span>
              <div>
                <h2 className="font-headline-sm text-base text-on-surface">Buscar jogadores</h2>
                <p className="text-xs text-on-surface-variant">
                  Encontre jogadores pelo nome, @usuário ou Código ID numérico para gerenciar ou convidar.
                </p>
              </div>
            </div>

            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault()
                setTab('all')
                setPage(1)
              }}
            >
              <div className="relative min-w-0 flex-1">
                <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-primary">
                  search
                </span>
                <input
                  ref={searchInputRef}
                  className="input-feudal w-full pl-10"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Digite um nome, @usuário ou Código ID…"
                />
              </div>
              <button type="submit" className="btn-primary shrink-0 text-xs">
                <span className="material-symbols-outlined text-sm">search</span>
                Buscar
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/25 pt-3 text-xs">
              <span className="flex items-center gap-1 text-on-surface-variant">
                <span className="material-symbols-outlined text-sm text-secondary">filter_alt</span>
                Filtros:
              </span>
              <label className="flex items-center gap-1.5 text-on-surface-variant">
                <span>Papel</span>
                <select
                  className="input-feudal w-auto py-1 pl-2.5 text-xs"
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value as typeof roleFilter)
                    setPage(1)
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="player">Jogadores</option>
                  <option value="narrator">Narradores</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-on-surface-variant">
                <span>Ordenar</span>
                <select
                  className="input-feudal w-auto py-1 pl-2.5 text-xs"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                >
                  <option value="name">Nome A–Z</option>
                  <option value="characters">Mais fichas</option>
                </select>
              </label>
            </div>
          </section>

          <section className="mesa-panel space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="font-headline-sm text-base text-on-surface">{listTitle}</h2>
                <span className="text-xs text-on-surface-variant">({filteredRows.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Visualização em lista"
                  onClick={() => setViewMode('list')}
                  className={`flex h-8 w-8 items-center justify-center rounded border transition ${
                    viewMode === 'list'
                      ? 'border-primary bg-primary-container text-white'
                      : 'border-outline-variant/40 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">view_list</span>
                </button>
                <button
                  type="button"
                  aria-label="Visualização em grade"
                  onClick={() => setViewMode('grid')}
                  className={`flex h-8 w-8 items-center justify-center rounded border transition ${
                    viewMode === 'grid'
                      ? 'border-primary bg-primary-container text-white'
                      : 'border-outline-variant/40 text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">grid_view</span>
                </button>
              </div>
            </div>

            {isLoading ? (
              <p className="py-4 text-sm text-on-surface-variant">Carregando a corte…</p>
            ) : slice.length === 0 ? (
              <p className="py-4 text-sm text-on-surface-variant">Ninguém encontrado nesta lista.</p>
            ) : viewMode === 'list' ? (
              <ul className="divide-y divide-outline-variant/25">
                {slice.map((player) => {
                  const playerKey = player.id || player.email || player.handle
                  return (
                    <li key={playerKey} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-secondary/45 bg-surface-container-high font-serif text-xs text-secondary">
                          {initials(player.displayName)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-serif text-on-surface">{player.displayName}</span>
                            {player.role === 'narrator' || player.role === 'admin' ? (
                              <span className="rounded border border-secondary/40 bg-secondary/10 px-1.5 py-0.5 text-[10px] text-secondary uppercase">
                                Narrador
                              </span>
                            ) : (
                              <span className="rounded border border-outline-variant/40 px-1.5 py-0.5 text-[10px] text-on-surface-variant uppercase">
                                Jogador
                              </span>
                            )}
                            <span className="text-xs text-on-surface-variant">· {player.characters} ficha(s)</span>
                          </div>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-outline">
                            {player.handle} · ID: {player.id}
                          </p>
                        </div>
                      </div>
                      <RowAction
                        player={player}
                        playerKey={playerKey}
                        confirmRemove={confirmRemove}
                        setConfirmRemove={setConfirmRemove}
                        busy={remove.isPending || accept.isPending || invite.isPending}
                        onRemove={() => remove.mutate(playerKey)}
                        onAccept={() => player.linkId && accept.mutate(player.linkId)}
                        onInvite={() => invite.mutate(player.id || player.email || playerKey)}
                      />
                    </li>
                  )
                })}
              </ul>
            ) : (
              <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2">
                {slice.map((player) => {
                  const playerKey = player.id || player.email || player.handle
                  return (
                    <li
                      key={playerKey}
                      className="flex h-full flex-col justify-between gap-3 rounded-lg border border-outline-variant/35 bg-surface-container-lowest/40 p-3.5 text-sm"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-secondary/45 bg-surface-container-high font-serif text-xs text-secondary">
                          {initials(player.displayName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-serif text-on-surface">{player.displayName}</span>
                            {player.role === 'narrator' || player.role === 'admin' ? (
                              <span className="rounded border border-secondary/40 bg-secondary/10 px-1.5 py-0.5 text-[10px] text-secondary uppercase">
                                Narrador
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-outline">
                            {player.handle} · ID: {player.id}
                          </p>
                          <p className="mt-1 text-xs text-on-surface-variant">{player.characters} ficha(s)</p>
                        </div>
                      </div>
                      <div className="flex justify-end border-t border-outline-variant/20 pt-2.5">
                        <RowAction
                          player={player}
                          playerKey={playerKey}
                          confirmRemove={confirmRemove}
                          setConfirmRemove={setConfirmRemove}
                          busy={remove.isPending || accept.isPending || invite.isPending}
                          onRemove={() => remove.mutate(playerKey)}
                          onAccept={() => player.linkId && accept.mutate(player.linkId)}
                          onInvite={() => invite.mutate(player.id || player.email || playerKey)}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/25 pt-3 text-xs text-on-surface-variant">
              <label className="flex items-center gap-2">
                Exibir
                <select
                  className="input-feudal w-auto py-1 pl-2.5 text-xs normal-case"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                por página
              </label>
              <div className="flex items-center gap-1">
                <PagerButton label="«" disabled={safePage <= 1} onClick={() => setPage(1)} />
                <PagerButton label="‹" disabled={safePage <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))} />
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === pages || Math.abs(n - safePage) <= 1)
                  .map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`h-8 min-w-8 rounded border px-2 transition ${
                        n === safePage
                          ? 'border-primary bg-primary-container font-semibold text-white'
                          : 'border-outline-variant/50 text-on-surface-variant hover:border-secondary hover:text-on-surface'
                      }`}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  ))}
                <PagerButton label="›" disabled={safePage >= pages} onClick={() => setPage((n) => Math.min(pages, n + 1))} />
                <PagerButton label="»" disabled={safePage >= pages} onClick={() => setPage(pages)} />
              </div>
            </footer>
          </section>
        </div>

        <aside className="space-y-4 lg:col-span-4">
          <section className="mesa-panel space-y-3 p-4">
            <h2 className="flex items-center gap-2 font-headline-sm text-base text-on-surface">
              <span className="material-symbols-outlined text-lg text-primary">bar_chart</span>
              Resumo da rede
            </h2>
            <div className="grid auto-rows-fr grid-cols-2 gap-2.5">
              <div className="flex h-full flex-col justify-between rounded-lg border border-outline-variant/30 bg-surface-container-lowest/45 p-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-primary">group</span>
                  <span className="font-serif text-xl text-on-surface">{data?.registeredCount ?? 0}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-on-surface">Cadastrados</p>
                <p className="text-[11px] text-on-surface-variant">Contas na corte</p>
              </div>

              <div className="flex h-full flex-col justify-between rounded-lg border border-outline-variant/30 bg-surface-container-lowest/45 p-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-primary">diversity_3</span>
                  <span className="font-serif text-xl text-on-surface">{friends.length}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-on-surface">Amigos</p>
                <p className="text-[11px] text-on-surface-variant">Jogadores adicionados</p>
              </div>

              <div className="flex h-full flex-col justify-between rounded-lg border border-outline-variant/30 bg-surface-container-lowest/45 p-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-primary">mail</span>
                  <span className="font-serif text-xl text-on-surface">{incoming.length}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-on-surface">Recebidas</p>
                <p className="text-[11px] text-on-surface-variant">Aguardando resposta</p>
              </div>

              <div className="flex h-full flex-col justify-between rounded-lg border border-outline-variant/30 bg-surface-container-lowest/45 p-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-secondary">send</span>
                  <span className="font-serif text-xl text-on-surface">{outgoing.length}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-on-surface">Enviadas</p>
                <p className="text-[11px] text-on-surface-variant">Pedidos pendentes</p>
              </div>
            </div>
          </section>

          <section className="mesa-panel space-y-2.5 p-4">
            <h2 className="flex items-center gap-2 font-headline-sm text-base text-on-surface">
              <span className="material-symbols-outlined text-lg text-primary">bolt</span>
              Ações rápidas
            </h2>
            <button type="button" className="btn-primary w-full justify-center text-xs" onClick={focusSearch}>
              <span className="material-symbols-outlined text-sm">person_add</span>
              Adicionar amigo / jogador
            </button>
            <button
              type="button"
              className="btn-secondary w-full justify-center text-xs"
              onClick={() => {
                const idText = profile?.publicId ? `Meu Código ID na corte: ${profile.publicId}` : window.location.origin
                void copyText(idText, 'Convite copiado para a área de transferência.')
              }}
            >
              <span className="material-symbols-outlined text-sm">share</span>
              Copiar convite com meu ID
            </button>
            <button
              type="button"
              className="btn-secondary w-full justify-center text-xs"
              onClick={() => setShowMyCode((v) => !v)}
            >
              <span className="material-symbols-outlined text-sm">qr_code_2</span>
              {showMyCode ? 'Ocultar meu código (ID)' : 'Mostrar meu código (ID)'}
            </button>
            {showMyCode ? (
              <div className="flex items-center justify-between gap-2 rounded border border-secondary/35 bg-surface-container-lowest/60 px-3 py-2 text-xs">
                <span className="font-mono text-secondary">{profile?.publicId || '—'}</span>
                {profile?.publicId ? (
                  <button
                    type="button"
                    className="text-[11px] text-on-surface underline hover:text-secondary"
                    onClick={() => void copyText(profile.publicId!, 'Código ID copiado.')}
                  >
                    Copiar
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  )
}

function RowAction({
  player,
  playerKey,
  confirmRemove,
  setConfirmRemove,
  busy,
  onRemove,
  onAccept,
  onInvite,
}: {
  player: RosterPlayer
  playerKey: string
  confirmRemove: string | null
  setConfirmRemove: (k: string | null) => void
  busy: boolean
  onRemove: () => void
  onAccept: () => void
  onInvite: () => void
}) {
  if (player.relation === 'friend') {
    if (confirmRemove === playerKey) {
      return (
        <span className="flex items-center gap-1.5">
          <button type="button" className="btn-primary text-[10px]" disabled={busy} onClick={onRemove}>
            Confirmar
          </button>
          <button type="button" className="btn-secondary text-[10px]" onClick={() => setConfirmRemove(null)}>
            Cancelar
          </button>
        </span>
      )
    }
    return (
      <button type="button" className="btn-secondary text-[10px]" onClick={() => setConfirmRemove(playerKey)}>
        <span className="material-symbols-outlined text-sm">delete</span>
        Remover
      </button>
    )
  }

  if (player.relation === 'incoming') {
    return (
      <button type="button" className="btn-primary text-[10px]" disabled={busy} onClick={onAccept}>
        Aceitar
      </button>
    )
  }

  if (player.relation === 'outgoing') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-secondary">Pedido enviado</span>
        <button
          type="button"
          className="btn-secondary text-[10px]"
          disabled={busy}
          onClick={onRemove}
        >
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <button type="button" className="btn-primary text-[10px]" disabled={busy} onClick={onInvite}>
      <span className="material-symbols-outlined text-sm">person_add</span>
      Convidar
    </button>
  )
}

function PagerButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="btn-secondary px-2 py-1 text-xs"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
