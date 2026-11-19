import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useToast } from '../../components/ui/ToastProvider'

type Relation = 'none' | 'friend' | 'outgoing' | 'incoming'
type RosterPlayer = {
  email: string
  displayName: string
  handle: string
  characters: number
  relation: Relation
  linkId: string | null
}
type Tab = 'friends' | 'incoming' | 'outgoing'

const PAGE_SIZES = [5, 10, 20]

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || '?'
}

function hue(name: string) {
  let n = 0
  for (const ch of name) n = (n + ch.charCodeAt(0) * 17) % 360
  return n
}

export default function AdminUsersPage() {
  const [inviteQuery, setInviteQuery] = useState('')
  const [tab, setTab] = useState<Tab>('friends')
  const [pageSize, setPageSize] = useState(5)
  const [page, setPage] = useState(1)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const qc = useQueryClient()
  const { push } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-court-players'],
    queryFn: () => api.adminCourtPlayers(),
  })

  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin-court-players'] })

  const invite = useMutation({
    mutationFn: (email: string) => api.adminAddFriend(email),
    onSuccess: () => {
      setInviteQuery('')
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
    mutationFn: (email: string) => api.adminRemoveFriend(email),
    onSuccess: () => {
      setOpenMenu(null)
      refresh()
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const roster = data?.roster ?? []
  const friends = roster.filter((player) => player.relation === 'friend')
  const incoming = roster.filter((player) => player.relation === 'incoming')
  const outgoing = roster.filter((player) => player.relation === 'outgoing')

  const inviteMatches = useMemo(() => {
    const q = inviteQuery.trim().toLowerCase()
    if (!q) return []
    return roster
      .filter((player) =>
        [player.displayName, player.handle, player.email].join(' ').toLowerCase().includes(q),
      )
  }, [inviteQuery, roster])

  const listed = tab === 'friends' ? friends : tab === 'incoming' ? incoming : outgoing

  const pages = Math.max(1, Math.ceil(listed.length / pageSize))
  const safePage = Math.min(page, pages)
  const slice = listed.slice((safePage - 1) * pageSize, safePage * pageSize)

  function changeTab(next: Tab) {
    setTab(next)
    setPage(1)
    setOpenMenu(null)
  }

  function sendInvite(player?: RosterPlayer) {
    const target = player ?? inviteMatches[0]
    if (!target) {
      push('Nenhum jogador encontrado com esse nome ou ID.', 'error')
      return
    }
    if (target.relation === 'friend') {
      push(`${target.displayName} já é seu amigo.`, 'info')
      return
    }
    if (target.relation === 'outgoing') {
      push('O convite já foi enviado.', 'info')
      return
    }
    if (target.relation === 'incoming' && target.linkId) {
      accept.mutate(target.linkId)
      return
    }
    invite.mutate(target.email)
  }

  return (
    <div className="space-y-5 pb-8">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/50 bg-primary/15 text-primary">
          <span className="material-symbols-outlined">groups</span>
        </span>
        <div>
          <h1 className="font-headline-lg text-3xl text-on-surface">Amigos</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Gerencie seus amigos, envie convites e acompanhe as solicitações da sua mesa.
          </p>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="group" label="Cadastrados" value={data?.registeredCount ?? 0} hint="Contas com perfil de jogador" />
        <StatCard icon="diversity_3" label="Amigos" value={friends.length} hint="Jogadores adicionados por você" />
        <StatCard icon="mail" label="Solicitações recebidas" value={incoming.length} hint="Convites aguardando resposta" />
        <StatCard icon="send" label="Solicitações enviadas" value={outgoing.length} hint="Convites pendentes de aceitação" />
      </section>

      <section className="mesa-panel p-4">
        <p className="text-sm font-semibold text-on-surface">Adicionar jogador / amigo</p>
        <p className="text-xs text-on-surface-variant">Busque pelo nome de usuário ou ID do jogador para enviar um convite.</p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            sendInvite()
          }}
        >
          <label className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-lg text-outline">
              search
            </span>
            <input
              className="input-feudal"
              value={inviteQuery}
              onChange={(e) => setInviteQuery(e.target.value)}
              placeholder="Digite o nome ou ID do jogador..."
            />
          </label>
          <button type="submit" className="btn-primary shrink-0 text-xs" disabled={invite.isPending || accept.isPending}>
            <span className="material-symbols-outlined text-base">person_add</span>
            Enviar convite
          </button>
        </form>
        {inviteMatches.length > 0 ? (
          <ul className="mt-2 divide-y divide-outline-variant/30 rounded border border-outline-variant/40">
            {inviteMatches.map((player) => (
              <li key={player.email}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-container-high"
                  onClick={() => sendInvite(player)}
                >
                  <span>
                    <span className="font-serif text-on-surface">{player.displayName}</span>
                    <span className="ml-2 text-xs text-on-surface-variant">{player.handle}</span>
                  </span>
                  <span className="text-[10px] uppercase text-secondary">
                    {player.relation === 'friend'
                      ? 'Amigos'
                      : player.relation === 'outgoing'
                        ? 'Enviado'
                        : player.relation === 'incoming'
                          ? 'Recebido'
                          : 'Convidar'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mesa-panel overflow-hidden">
        <div className="flex flex-wrap gap-1 border-b border-outline-variant/40 px-3 py-3">
          <TabButton active={tab === 'friends'} onClick={() => changeTab('friends')} icon="group" label={`Meus amigos (${friends.length})`} />
          <TabButton active={tab === 'incoming'} onClick={() => changeTab('incoming')} icon="mail" label={`Solicitações recebidas (${incoming.length})`} />
          <TabButton active={tab === 'outgoing'} onClick={() => changeTab('outgoing')} icon="send" label={`Solicitações enviadas (${outgoing.length})`} />
        </div>

        {isLoading ? <p className="px-4 py-6 text-sm text-on-surface-variant">Carregando a corte…</p> : null}
        {!isLoading && slice.length === 0 ? (
          <p className="px-4 py-6 text-sm text-on-surface-variant">Ninguém nesta lista.</p>
        ) : (
          <ul>
            {slice.map((player) => (
              <li key={player.email} className="flex items-center gap-3 border-b border-outline-variant/25 px-4 py-3 last:border-0">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-secondary/40 font-serif text-sm text-on-surface"
                  style={{ background: `hsl(${hue(player.displayName)} 32% 22%)` }}
                >
                  {initials(player.displayName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-on-surface">{player.displayName}</p>
                  <p className="truncate text-xs text-on-surface-variant">
                    {player.handle} · {player.characters} personagem(ns)
                  </p>
                </div>
                <RowAction
                  player={player}
                  open={openMenu === player.email}
                  busy={remove.isPending || accept.isPending || invite.isPending}
                  onToggle={() => setOpenMenu((current) => (current === player.email ? null : player.email))}
                  onRemove={() => remove.mutate(player.email)}
                  onAccept={() => player.linkId && accept.mutate(player.linkId)}
                  onInvite={() => invite.mutate(player.email)}
                />
              </li>
            ))}
          </ul>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/40 px-4 py-3 text-xs text-on-surface-variant">
          <label className="flex items-center gap-2">
            Exibir
            <select
              className="input-feudal w-auto py-1 pr-6 pl-2 text-xs normal-case"
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
                  className={`h-8 min-w-8 rounded border px-2 ${
                    n === safePage ? 'border-primary bg-primary text-white' : 'border-outline-variant/50 hover:border-secondary'
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
  )
}

function StatCard({ icon, label, value, hint }: { icon: string; label: string; value: number; hint: string }) {
  return (
    <article className="mesa-panel flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </span>
      <div>
        <p className="text-[10px] tracking-wider text-on-surface-variant uppercase">{label}</p>
        <p className="font-serif text-2xl leading-none text-on-surface">{value}</p>
        <p className="mt-1 text-[11px] text-on-surface-variant">{hint}</p>
      </div>
    </article>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded px-3 py-2 text-xs ${
        active ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
      }`}
    >
      <span className="material-symbols-outlined text-base">{icon}</span>
      {label}
    </button>
  )
}

function PagerButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className="h-8 min-w-8 rounded border border-outline-variant/50 px-2 disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function RowAction({
  player,
  open,
  busy,
  onToggle,
  onRemove,
  onAccept,
  onInvite,
}: {
  player: RosterPlayer
  open: boolean
  busy: boolean
  onToggle: () => void
  onRemove: () => void
  onAccept: () => void
  onInvite: () => void
}) {
  if (player.relation === 'outgoing') {
    return (
      <div className="relative">
        <button type="button" className="btn-secondary px-3 py-1.5 text-[10px]" onClick={onToggle}>
          Solicitação enviada
          <span className="material-symbols-outlined text-sm">expand_more</span>
        </button>
        {open ? (
          <button
            type="button"
            className="absolute top-full right-0 z-10 mt-1 whitespace-nowrap rounded border border-outline-variant bg-surface-container-high px-3 py-2 text-xs text-primary shadow-lg"
            disabled={busy}
            onClick={onRemove}
          >
            Cancelar convite
          </button>
        ) : null}
      </div>
    )
  }
  if (player.relation === 'incoming') {
    return (
      <button type="button" className="btn-primary px-3 py-1.5 text-[10px]" disabled={busy || !player.linkId} onClick={onAccept}>
        Aceitar
      </button>
    )
  }
  if (player.relation === 'none') {
    return (
      <button type="button" className="btn-primary px-3 py-1.5 text-[10px]" disabled={busy} onClick={onInvite}>
        <span className="material-symbols-outlined text-sm">person_add</span>
        Solicitar amizade
      </button>
    )
  }
  return (
    <div className="relative">
      <button type="button" className="btn-secondary px-3 py-1.5 text-[10px]" onClick={onToggle}>
        <span className="material-symbols-outlined text-sm">group</span>
        Amigos
        <span className="material-symbols-outlined text-sm">expand_more</span>
      </button>
      {open ? (
        <button
          type="button"
          className="absolute top-full right-0 z-10 mt-1 rounded border border-outline-variant bg-surface-container-high px-3 py-2 text-xs text-primary shadow-lg"
          onClick={onRemove}
        >
          Remover amizade
        </button>
      ) : null}
    </div>
  )
}
