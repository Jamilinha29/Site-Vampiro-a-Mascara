import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'
import { CharacterArmorClassBar } from '../../components/characters/CharacterArmorClassBar'
import { resolveSheetKind } from '../../lib/characterSheetKind'
import type { ProfileCharacterSummary } from '../../types/profile'
import { useToast } from '../../components/ui/ToastProvider'

type FilterId = 'all' | 'vampire' | 'mortal' | 'other'

function CharacterCard({
  item,
  needPickHome,
  homeCount,
  onToggleHome,
  onSetPrimary,
  busy,
}: {
  item: ProfileCharacterSummary
  needPickHome: boolean
  homeCount: number
  onToggleHome: () => void
  onSetPrimary: () => void
  busy?: boolean
}) {
  const blurb = [item.identity?.nature, item.identity?.demeanor, item.clan].filter(Boolean).join(' · ')

  return (
    <article
      className={`mesa-panel flex flex-col p-4 transition ${
        item.isPrimary ? 'border-secondary/55 ring-1 ring-secondary/25' : ''
      }`}
    >
      <div className="flex gap-3">
        <div className="h-20 w-16 shrink-0 overflow-hidden rounded border border-outline-variant/50 bg-surface-container-high">
          {item.portraitUrl ? (
            <img src={item.portraitUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="material-symbols-outlined flex h-full w-full items-center justify-center text-2xl text-outline">
              face
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-lg uppercase tracking-wide text-on-surface">{item.name}</p>
          <p className="text-xs text-on-surface-variant">
            {item.species}
            {item.clan ? ` · ${item.clan}` : ''}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] text-on-surface-variant">{blurb || '—'}</p>
          <p className="mt-1 text-[10px] font-semibold tracking-wider text-secondary uppercase">Nv {item.level}</p>
        </div>
      </div>

      <div className="mt-3">
        <CharacterArmorClassBar character={item} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary text-[10px]" disabled={busy || item.isPrimary} onClick={onSetPrimary}>
          {item.isPrimary ? 'Ativo' : 'Usar na mesa'}
        </button>
        {needPickHome ? (
          <button
            type="button"
            className={`text-[10px] ${
              item.showOnHome ? 'btn-primary' : 'btn-secondary'
            }`}
            disabled={busy || (!item.showOnHome && homeCount >= 3)}
            onClick={onToggleHome}
          >
            {item.showOnHome ? 'No início' : 'Mostrar no início'}
          </button>
        ) : null}
        <Link to={`/user/characters/${item.id}?view=ficha`} className="btn-primary ml-auto text-[10px]">
          Ficha
        </Link>
      </div>
    </article>
  )
}

export default function PlayerCharactersPage() {
  const [filter, setFilter] = useState<FilterId>('all')
  const qc = useQueryClient()
  const { push } = useToast()
  const { data: profile, isLoading } = useQuery({
    queryKey: playerQueryKeys.profile,
    queryFn: () => api.getMeProfile(),
  })

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { isPrimary?: boolean; showOnHome?: boolean } }) =>
      api.patchMeCharacter(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: playerQueryKeys.profile })
      void qc.invalidateQueries({ queryKey: playerQueryKeys.dashboard })
    },
    onError: (e: Error) => push(e.message || 'Não foi possível atualizar.', 'error'),
  })

  const characters = profile?.characters ?? []
  const needPickHome = characters.length > 10
  const homeCount = characters.filter((c) => c.showOnHome).length

  const counts = useMemo(() => {
    const vampire = characters.filter((c) => resolveSheetKind(c.species) === 'vampire').length
    const mortal = characters.filter((c) => resolveSheetKind(c.species) === 'mortal').length
    const other = characters.filter((c) => resolveSheetKind(c.species) === 'other').length
    return { all: characters.length, vampire, mortal, other }
  }, [characters])

  const filtered = characters.filter((c) => {
    if (filter === 'all') return true
    return resolveSheetKind(c.species) === filter
  })

  const filters: { id: FilterId; label: string; count: number }[] = [
    { id: 'all', label: 'Todos', count: counts.all },
    { id: 'vampire', label: 'Vampiros', count: counts.vampire },
    { id: 'mortal', label: 'Mortais', count: counts.mortal },
    { id: 'other', label: 'Outros', count: counts.other },
  ]

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-2xl tracking-wide text-on-surface uppercase">
            Meus personagens ({counts.all})
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            Escolha o personagem ativo da mesa.
            {needPickHome
              ? ` Com mais de 10 fichas, selecione até 3 para aparecerem no Início (${homeCount}/3).`
              : ' Com 10 ou menos, todos aparecem automaticamente no Início.'}
          </p>
        </div>
        <Link to="/user/characters/new/lineage" className="btn-primary text-xs">
          Criar personagem
        </Link>
      </header>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`rounded px-3 py-1.5 text-xs font-semibold tracking-wider uppercase ${
              filter === f.id
                ? 'border border-secondary bg-secondary/15 text-secondary'
                : 'border border-outline-variant/40 text-on-surface-variant'
            }`}
            onClick={() => setFilter(f.id)}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-on-surface-variant">Carregando linhagens…</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => (
          <CharacterCard
            key={item.id}
            item={item}
            needPickHome={needPickHome}
            homeCount={homeCount}
            busy={patch.isPending}
            onSetPrimary={() => patch.mutate({ id: item.id, body: { isPrimary: true } })}
            onToggleHome={() =>
              patch.mutate({ id: item.id, body: { showOnHome: !item.showOnHome } })
            }
          />
        ))}
        {filtered.length === 0 && !isLoading ? (
          <p className="text-sm text-on-surface-variant sm:col-span-2">Nenhum personagem neste filtro.</p>
        ) : null}
      </div>
    </div>
  )
}
