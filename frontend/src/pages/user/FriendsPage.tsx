import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'
import { useToast } from '../../components/ui/useToast'

type TabKey = 'friends' | 'incoming' | 'outgoing' | 'search'

type DisplayRow = {
  key: string
  targetKey: string
  displayName: string
  handle: string
  id?: string
  role?: string
  characters?: number
  relation: 'friend' | 'incoming' | 'outgoing' | 'none'
  linkId?: string | null
}

export default function FriendsPage() {
  const [tab, setTab] = useState<TabKey>('friends')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
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
      void qc.invalidateQueries({ queryKey: ['court-friends'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })
  const accept = useMutation({
    mutationFn: (id: string) => api.acceptFriend(id),
    onSuccess: () => {
      push('Amizade aceita.', 'success')
      void qc.invalidateQueries({ queryKey: ['court-friends'] })
      void qc.invalidateQueries({ queryKey: ['court-player-search'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })
  const remove = useMutation({
    mutationFn: (idOrHandle: string) => api.removeFriend(idOrHandle),
    onSuccess: () => {
      setConfirmRemove(null)
      push('Vínculo removido.', 'info')
      void qc.invalidateQueries({ queryKey: ['court-friends'] })
      void qc.invalidateQueries({ queryKey: ['court-player-search'] })
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const friendsList = useMemo(() => book?.friends ?? [], [book?.friends])
  const incomingList = useMemo(() => book?.incoming ?? [], [book?.incoming])
  const outgoingList = useMemo(() => book?.outgoing ?? [], [book?.outgoing])

  const activeRows = useMemo<DisplayRow[]>(() => {
    let base: DisplayRow[] = []
    if (tab === 'friends') {
      base = friendsList.map((f) => {
        const targetKey = f.id || f.handle || f.email || f.displayName
        return {
          key: `f-${targetKey}`,
          targetKey,
          displayName: f.displayName,
          handle: f.handle,
          id: f.id,
          role: f.role,
          characters: f.characters,
          relation: 'friend',
        }
      })
    } else if (tab === 'incoming') {
      base = incomingList.map((row) => ({
        key: `in-${row.id}`,
        targetKey: row.id,
        displayName: row.from.displayName,
        handle: row.from.handle,
        id: row.from.id,
        role: row.from.role,
        characters: row.from.characters,
        relation: 'incoming',
        linkId: row.id,
      }))
    } else if (tab === 'outgoing') {
      base = outgoingList.map((row) => ({
        key: `out-${row.id}`,
        targetKey: row.id,
        displayName: row.to.displayName,
        handle: row.to.handle,
        id: row.to.id,
        role: row.to.role,
        characters: row.to.characters,
        relation: 'outgoing',
        linkId: row.id,
      }))
    } else {
      base = found.map((p) => {
        const targetKey = p.id || p.handle || p.email || ''
        return {
          key: `s-${targetKey}`,
          targetKey,
          displayName: p.displayName,
          handle: p.handle,
          id: p.id,
          role: p.role,
          characters: p.characters,
          relation: p.relation,
          linkId: p.linkId,
        }
      })
    }

    const q = query.trim().toLowerCase()
    const filtered = base.filter((row) => {
      const isNarrator = row.role === 'narrator' || row.role === 'admin'
      if (roleFilter === 'narrator' && !isNarrator) return false
      if (roleFilter === 'player' && isNarrator) return false
      if (tab !== 'search' && q) {
        return (
          row.displayName.toLowerCase().includes(q) ||
          row.handle.toLowerCase().includes(q) ||
          (row.id ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })

    return [...filtered].sort((a, b) => {
      if (sortBy === 'characters') return (b.characters ?? 0) - (a.characters ?? 0)
      return a.displayName.localeCompare(b.displayName, 'pt-BR')
    })
  }, [tab, friendsList, incomingList, outgoingList, found, query, roleFilter, sortBy])

  const pageCount = Math.max(1, Math.ceil(activeRows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = activeRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  function switchTab(next: TabKey) {
    setTab(next)
    setPage(1)
    setConfirmRemove(null)
  }

  function focusSearch() {
    switchTab('search')
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
          : 'Jogadores encontrados'

  return (
    <div className="space-y-4 pb-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary-container/25 text-primary">
          <span className="material-symbols-outlined text-2xl">group</span>
        </div>
        <div>
          <h1 className="font-headline-lg text-2xl text-on-surface">Amigos e jogadores</h1>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            Gerencie suas amizades, encontre novos jogadores e acompanhe seus convites.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-8">
          <nav className="mesa-panel grid grid-cols-2 gap-1.5 p-1.5 sm:grid-cols-4" aria-label="Abas de amigos">
            <button
              type="button"
              onClick={() => switchTab('friends')}
              className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition ${tab === 'friends'
                ? 'bg-primary-container text-white'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
            >
              <span className="material-symbols-outlined text-base">group</span>
              <span>Meus amigos</span>
              {friendsList.length > 0 ? (
                <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[10px]">{friendsList.length}</span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => switchTab('incoming')}
              className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition ${tab === 'incoming'
                ? 'bg-primary-container text-white'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
            >
              <span className="material-symbols-outlined text-base">mail</span>
              <span>Recebidas</span>
              {incomingList.length > 0 ? (
                <span className="rounded-full bg-primary/25 px-1.5 py-0.5 text-[10px] text-primary">
                  {incomingList.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => switchTab('outgoing')}
              className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition ${tab === 'outgoing'
                ? 'bg-primary-container text-white'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
            >
              <span className="material-symbols-outlined text-base">send</span>
              <span>Enviadas</span>
              {outgoingList.length > 0 ? (
                <span className="rounded-full bg-secondary/20 px-1.5 py-0.5 text-[10px] text-secondary">
                  {outgoingList.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={focusSearch}
              className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-semibold transition ${tab === 'search'
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
                  Encontre jogadores pelo nome, @usuário ou Código ID numérico.
                </p>
              </div>
            </div>

            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault()
                const trimmed = query.trim()
                if (trimmed.length < 2) {
                  push('Digite ao menos 2 caracteres para buscar.', 'info')
                  return
                }
                setSearch(trimmed)
                setTab('search')
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
                <span className="text-xs text-on-surface-variant">({activeRows.length})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Visualização em lista"
                  onClick={() => setViewMode('list')}
                  className={`flex h-8 w-8 items-center justify-center rounded border transition ${viewMode === 'list'
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
                  className={`flex h-8 w-8 items-center justify-center rounded border transition ${viewMode === 'grid'
                    ? 'border-primary bg-primary-container text-white'
                    : 'border-outline-variant/40 text-on-surface-variant hover:text-on-surface'
                    }`}
                >
                  <span className="material-symbols-outlined text-base">grid_view</span>
                </button>
              </div>
            </div>

            {tab === 'search' && isFetching ? (
              <p className="py-4 text-sm text-on-surface-variant">Buscando na corte…</p>
            ) : pageRows.length === 0 ? (
              <p className="py-4 text-sm text-on-surface-variant">
                {tab === 'friends'
                  ? 'Você ainda não tem amigos vinculados na corte.'
                  : tab === 'incoming'
                    ? 'Nenhuma solicitação recebida no momento.'
                    : tab === 'outgoing'
                      ? 'Nenhuma solicitação enviada pendente.'
                      : search.trim().length >= 2
                        ? 'Nenhuma conta encontrada para esta busca.'
                        : 'Digite ao menos 2 caracteres na busca acima e clique em Buscar.'}
              </p>
            ) : viewMode === 'list' ? (
              <ul className="divide-y divide-outline-variant/25">
                {pageRows.map((row) => (
                  <li key={row.key} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high text-secondary">
                        <span className="material-symbols-outlined text-lg">person</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-serif text-on-surface">{row.displayName}</span>
                          {row.role === 'narrator' || row.role === 'admin' ? (
                            <span className="rounded border border-secondary/40 bg-secondary/10 px-1.5 py-0.5 text-[10px] text-secondary uppercase">
                              Narrador
                            </span>
                          ) : (
                            <span className="rounded border border-outline-variant/40 px-1.5 py-0.5 text-[10px] text-on-surface-variant uppercase">
                              Jogador
                            </span>
                          )}
                          {row.characters !== undefined ? (
                            <span className="text-xs text-on-surface-variant">· {row.characters} ficha(s)</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-outline">
                          {row.handle}
                          {row.id ? ` · ID: ${row.id}` : ''}
                        </p>
                      </div>
                    </div>
                    <RowAction
                      row={row}
                      confirmRemove={confirmRemove}
                      setConfirmRemove={setConfirmRemove}
                      onRequest={(k) => request.mutate(k)}
                      onAccept={(k) => accept.mutate(k)}
                      onRemove={(k) => remove.mutate(k)}
                      busy={request.isPending || accept.isPending || remove.isPending}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2">
                {pageRows.map((row) => (
                  <li
                    key={row.key}
                    className="flex h-full flex-col justify-between gap-3 rounded-lg border border-outline-variant/35 bg-surface-container-lowest/40 p-3.5 text-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high text-secondary">
                        <span className="material-symbols-outlined text-lg">person</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-serif text-on-surface">{row.displayName}</span>
                          {row.role === 'narrator' || row.role === 'admin' ? (
                            <span className="rounded border border-secondary/40 bg-secondary/10 px-1.5 py-0.5 text-[10px] text-secondary uppercase">
                              Narrador
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-outline">
                          {row.handle}
                          {row.id ? ` · ID: ${row.id}` : ''}
                        </p>
                        {row.characters !== undefined ? (
                          <p className="mt-1 text-xs text-on-surface-variant">{row.characters} ficha(s)</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex justify-end border-t border-outline-variant/20 pt-2.5">
                      <RowAction
                        row={row}
                        confirmRemove={confirmRemove}
                        setConfirmRemove={setConfirmRemove}
                        onRequest={(k) => request.mutate(k)}
                        onAccept={(k) => accept.mutate(k)}
                        onRemove={(k) => remove.mutate(k)}
                        busy={request.isPending || accept.isPending || remove.isPending}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {activeRows.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/25 pt-3 text-xs">
                <label className="flex items-center gap-2 text-on-surface-variant">
                  <span>Exibir</span>
                  <select
                    className="input-feudal w-auto py-1 pl-2.5 text-xs"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value))
                      setPage(1)
                    }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                  <span>por página</span>
                </label>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn-secondary px-2 py-1 text-xs"
                    disabled={safePage <= 1}
                    onClick={() => setPage(1)}
                  >
                    «
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-2 py-1 text-xs"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ‹
                  </button>
                  <span className="px-2 text-on-surface-variant">
                    {safePage} / {pageCount}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary px-2 py-1 text-xs"
                    disabled={safePage >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="btn-secondary px-2 py-1 text-xs"
                    disabled={safePage >= pageCount}
                    onClick={() => setPage(pageCount)}
                  >
                    »
                  </button>
                </div>
              </div>
            ) : null}
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
                  <span className="font-serif text-xl text-on-surface">{friendsList.length}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-on-surface">Amigos</p>
                <p className="text-[11px] text-on-surface-variant">Jogadores adicionados</p>
              </div>

              <div className="flex h-full flex-col justify-between rounded-lg border border-outline-variant/30 bg-surface-container-lowest/45 p-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-primary">mail</span>
                  <span className="font-serif text-xl text-on-surface">{incomingList.length}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-on-surface">Recebidas</p>
                <p className="text-[11px] text-on-surface-variant">Aguardando resposta</p>
              </div>

              <div className="flex h-full flex-col justify-between rounded-lg border border-outline-variant/30 bg-surface-container-lowest/45 p-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-secondary">send</span>
                  <span className="font-serif text-xl text-on-surface">{outgoingList.length}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-on-surface">Enviadas</p>
                <p className="text-[11px] text-on-surface-variant">Pedidos pendentes</p>
              </div>

              <div className="flex h-full flex-col justify-between rounded-lg border border-outline-variant/30 bg-surface-container-lowest/45 p-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-secondary">person_search</span>
                  <span className="font-serif text-xl text-on-surface">{found.length}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-on-surface">Encontrados</p>
                <p className="text-[11px] text-on-surface-variant">Na última busca</p>
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

          <section className="mesa-panel space-y-1.5 p-4">
            <h2 className="flex items-center gap-2 font-headline-sm text-sm text-on-surface">
              <span className="material-symbols-outlined text-base text-primary">info</span>
              Dica
            </h2>
            <p className="text-xs leading-relaxed text-on-surface-variant">
              Você pode convidar jogadores pelo nome, @usuário ou Código ID numérico. Amigos aparecem na busca de mesas,
              inclusive nas privadas que pedem código de sala.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}

function RowAction({
  row,
  confirmRemove,
  setConfirmRemove,
  onRequest,
  onAccept,
  onRemove,
  busy,
}: {
  row: DisplayRow
  confirmRemove: string | null
  setConfirmRemove: (k: string | null) => void
  onRequest: (key: string) => void
  onAccept: (key: string) => void
  onRemove: (key: string) => void
  busy: boolean
}) {
  if (row.relation === 'friend') {
    if (confirmRemove === row.targetKey) {
      return (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            className="btn-primary text-[10px]"
            disabled={busy}
            onClick={() => onRemove(row.targetKey)}
          >
            Confirmar
          </button>
          <button type="button" className="btn-secondary text-[10px]" onClick={() => setConfirmRemove(null)}>
            Cancelar
          </button>
        </span>
      )
    }
    return (
      <button
        type="button"
        className="btn-secondary text-[10px]"
        onClick={() => setConfirmRemove(row.targetKey)}
      >
        <span className="material-symbols-outlined text-sm">delete</span>
        Remover
      </button>
    )
  }

  if (row.relation === 'incoming') {
    const linkKey = row.linkId ?? row.targetKey
    return (
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          className="btn-primary text-[10px]"
          disabled={busy}
          onClick={() => onAccept(linkKey)}
        >
          Aceitar
        </button>
        <button
          type="button"
          className="btn-secondary text-[10px]"
          disabled={busy}
          onClick={() => onRemove(linkKey)}
        >
          Recusar
        </button>
      </span>
    )
  }

  if (row.relation === 'outgoing') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-secondary">Pedido enviado</span>
        {row.linkId ? (
          <button
            type="button"
            className="btn-secondary text-[10px]"
            disabled={busy}
            onClick={() => onRemove(row.linkId!)}
          >
            Cancelar
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <button
      type="button"
      className="btn-primary text-[10px]"
      disabled={busy}
      onClick={() => onRequest(row.targetKey)}
    >
      <span className="material-symbols-outlined text-sm">person_add</span>
      Convidar
    </button>
  )
}
