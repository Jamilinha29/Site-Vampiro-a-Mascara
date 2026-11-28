import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import type { ChronicleEntity, SessionHandout } from '../../types/chronicle'

const SHEET_SPECIES_OPTIONS = ['Vampiro', 'Mortal', 'Outras espécies'] as const
const GENERAL_BOOK_GROUP = 'Geral / Outros livros'

export default function DownloadsPage() {
  const [inspectAct, setInspectAct] = useState<{
    handout: SessionHandout
    tab: 'summary' | 'deeds'
  } | null>(null)

  useEffect(() => {
    if (!inspectAct) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspectAct(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inspectAct])

  const { data: rules } = useQuery({
    queryKey: ['content-downloads', 'rules'],
    queryFn: () => api.getDownloadsContent('rules'),
  })
  const { data: sheets } = useQuery({
    queryKey: ['content-downloads', 'sheets'],
    queryFn: () => api.getDownloadsContent('sheets'),
  })
  const { data: handouts } = useQuery({
    queryKey: ['content-downloads', 'handouts'],
    queryFn: () => api.getDownloadsContent('handouts'),
  })

  const actCards = handouts?.handouts ?? []
  const handoutFiles = handouts?.files ?? []
  const sheetFiles = useMemo(() => sheets?.files ?? [], [sheets?.files])
  const compendiumFiles = useMemo(() => rules?.files ?? [], [rules?.files])

  const sheetSpeciesGroups = useMemo(() => {
    const groups = new Map<string, ChronicleEntity[]>(
      SHEET_SPECIES_OPTIONS.map((species) => [species, []]),
    )
    for (const file of sheetFiles) {
      const target = file.sheetType?.trim() || file.clan?.trim() || 'Outras espécies'
      const list = groups.get(target) ?? []
      list.push(file)
      groups.set(target, list)
    }
    return [...groups.entries()]
  }, [sheetFiles])

  const compendiumClanGroups = useMemo(() => {
    const groups = new Map<string, ChronicleEntity[]>()
    for (const file of compendiumFiles) {
      const groupName = file.clan?.trim() || GENERAL_BOOK_GROUP
      const list = groups.get(groupName) ?? []
      list.push(file)
      groups.set(groupName, list)
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === GENERAL_BOOK_GROUP) return 1
      if (b === GENERAL_BOOK_GROUP) return -1
      return a.localeCompare(b, 'pt-BR')
    })
  }, [compendiumFiles])

  return (
    <div className="space-y-6 pb-4">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Central de downloads</h1>
        <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
          Acontecimentos passados, fichas oficiais imprimíveis por espécie e livros dos clãs no Compêndio publicados
          pelo narrador.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-headline-sm text-lg text-on-surface">Acontecimentos Passados</h2>
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {actCards.map((h) => (
            <article key={h.id} className="mesa-panel flex h-full flex-col p-4">
              <p className="font-serif text-lg text-on-surface">{h.chronicleName ?? h.title}</p>
              <p className="mt-2 line-clamp-3 text-sm text-on-surface-variant">
                {h.narrativeSummary || 'Resumo narrativo ainda não publicado.'}
              </p>
              <p className="mt-3 text-[10px] uppercase text-on-surface-variant">
                {h.closedAt ? new Date(h.closedAt).toLocaleDateString('pt-BR') : 'Em andamento'}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <button
                  type="button"
                  className="btn-secondary text-[10px]"
                  onClick={() => setInspectAct({ handout: h, tab: 'summary' })}
                >
                  Ver resumo narrativo
                </button>
                <button
                  type="button"
                  className="btn-secondary text-[10px]"
                  onClick={() => setInspectAct({ handout: h, tab: 'deeds' })}
                >
                  Mortes e feitos do ato
                </button>
              </div>
            </article>
          ))}
          {actCards.length === 0 && handoutFiles.length === 0 ? (
            <p className="text-sm text-on-surface-variant md:col-span-3">Nenhum acontecimento passado publicado ainda.</p>
          ) : null}
        </div>
        {handoutFiles.length > 0 ? (
          <ul className="space-y-2">
            {handoutFiles.map((file) => (
              <DownloadListRow key={file.id} file={file} icon="history_edu" buttonLabel="Baixar arquivo" />
            ))}
          </ul>
        ) : null}
      </section>

      {inspectAct ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={inspectAct.handout.chronicleName ?? inspectAct.handout.title}
          onClick={() => setInspectAct(null)}
        >
          <div
            className="mesa-panel max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/40 pb-3">
              <div>
                <p className="text-xs uppercase text-secondary">
                  {inspectAct.tab === 'summary' ? 'Resumo narrativo do ato' : 'Mortes, feitos e recompensas'}
                </p>
                <h3 className="font-serif text-xl text-on-surface">
                  {inspectAct.handout.chronicleName ?? inspectAct.handout.title}
                </h3>
              </div>
              <button
                type="button"
                className="btn-secondary text-xs"
                autoFocus
                onClick={() => setInspectAct(null)}
              >
                Fechar
              </button>
            </div>
            {inspectAct.tab === 'summary' ? (
              <div className="mt-4 space-y-3 text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap">
                {inspectAct.handout.narrativeSummary || 'Nenhum resumo narrativo publicado para este ato.'}
              </div>
            ) : (
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <p className="text-xs uppercase text-secondary">Criaturas abatidas</p>
                  {inspectAct.handout.monstersSlain?.length ? (
                    <ul className="mt-1 space-y-1 text-on-surface-variant">
                      {inspectAct.handout.monstersSlain.map((m, idx) => (
                        <li key={`${m.entityId}-${idx}`}>• {m.name}{m.statsText ? ` (${m.statsText})` : ''}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-on-surface-variant">Sem criaturas abatidas registradas.</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase text-secondary">Participantes e espólios</p>
                  {inspectAct.handout.participants?.length ? (
                    <ul className="mt-1 space-y-1.5 text-on-surface-variant">
                      {inspectAct.handout.participants.map((p, idx) => (
                        <li key={`${p.displayName}-${idx}`}>
                          <strong className="text-on-surface">{p.characterName || p.displayName}</strong>
                          {p.rewards?.length ? ` — ${p.rewards.map((r) => r.label).join(', ')}` : ' — Sem recompensas listadas'}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-on-surface-variant">Sem participantes registrados.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="font-headline-sm text-lg text-on-surface">Fichas oficiais imprimíveis</h2>
        <div className="grid auto-rows-fr gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {sheetSpeciesGroups.map(([speciesName, files]) => (
            <article key={speciesName} className="mesa-panel flex h-full flex-col p-4">
              <header className="flex items-center justify-between gap-2 border-b border-outline-variant/30 pb-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="material-symbols-outlined text-2xl text-primary" aria-hidden>
                    description
                  </span>
                  <h3 className="truncate font-serif text-lg text-on-surface">{speciesName}</h3>
                </div>
                <span className="shrink-0 rounded-full border border-secondary/35 bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary">
                  {files.length} {files.length === 1 ? 'ficha' : 'fichas'}
                </span>
              </header>

              {files.length === 0 ? (
                <p className="mt-3 text-sm text-on-surface-variant">
                  Aguardando publicação do narrador para esta espécie.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-outline-variant/25">
                  {files.map((file) => (
                    <li
                      key={file.id}
                      className="flex flex-wrap items-center justify-between gap-2.5 py-2.5 first:pt-1 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-serif text-sm text-on-surface">{file.name}</p>
                        <p className="truncate text-xs text-on-surface-variant">
                          {file.description?.trim() || file.fileName || 'Ficha em PDF'}
                        </p>
                      </div>
                      {file.fileUrl ? (
                        <a
                          href={file.fileUrl}
                          download={file.fileName ?? `${file.name}.pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary shrink-0 text-[10px]"
                        >
                          Baixar PDF ↑
                        </a>
                      ) : (
                        <button type="button" className="btn-primary shrink-0 text-[10px]" disabled>
                          Baixar PDF ↑
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-headline-sm text-lg text-on-surface">Compêndio</h2>
        {compendiumClanGroups.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nenhum livro ou arquivo do compêndio publicado.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {compendiumClanGroups.map(([clanName, files]) => (
              <article key={clanName} className="mesa-panel flex flex-col p-4">
                <header className="flex items-center justify-between gap-2 border-b border-outline-variant/30 pb-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="material-symbols-outlined text-xl text-primary" aria-hidden>
                      menu_book
                    </span>
                    <h3 className="truncate font-serif text-lg text-on-surface">{clanName}</h3>
                  </div>
                  <span className="shrink-0 rounded-full border border-secondary/35 bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary">
                    {files.length} {files.length === 1 ? 'livro' : 'livros'}
                  </span>
                </header>

                <ul className="mt-2 divide-y divide-outline-variant/25">
                  {files.map((file) => (
                    <li
                      key={file.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-0"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <span className="material-symbols-outlined mt-0.5 text-lg text-secondary" aria-hidden>
                          description
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-serif text-sm text-on-surface">{file.name}</p>
                          <p className="truncate text-xs text-on-surface-variant">
                            {file.description?.trim() || file.fileName || 'Livro em PDF'}
                          </p>
                        </div>
                      </div>
                      {file.fileUrl ? (
                        <a
                          href={file.fileUrl}
                          download={file.fileName ?? `${file.name}.pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-primary shrink-0 text-[10px]"
                        >
                          Baixar PDF ↑
                        </a>
                      ) : (
                        <button type="button" className="btn-primary shrink-0 text-[10px]" disabled>
                          Baixar PDF ↑
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function DownloadListRow({
  file,
  icon,
  buttonLabel,
}: {
  file: ChronicleEntity
  icon: string
  buttonLabel: string
}) {
  return (
    <li className="mesa-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="material-symbols-outlined text-secondary" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="font-serif text-on-surface">{file.name}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {file.description?.trim() || file.fileName || 'arquivo'}
          </p>
        </div>
      </div>
      {file.fileUrl ? (
        <a
          href={file.fileUrl}
          download={file.fileName ?? file.name}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-[10px]"
        >
          {buttonLabel}
        </a>
      ) : (
        <button type="button" className="btn-primary text-[10px]" disabled>
          {buttonLabel}
        </button>
      )}
    </li>
  )
}
