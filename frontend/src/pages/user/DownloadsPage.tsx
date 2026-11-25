import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import type { SessionHandout } from '../../types/chronicle'

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
  const sheetFiles = sheets?.files ?? []
  const tomeFiles = [...(rules?.files ?? []), ...(handouts?.files ?? [])]

  return (
    <div className="space-y-10 pb-8">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Central de downloads</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Histórico de atos, fichas imprimíveis e tratados da crônica publicados pelo narrador.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="font-headline-sm text-lg text-on-surface">Histórico de atos da crônica</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {actCards.map((h) => (
            <article key={h.id} className="mesa-panel flex flex-col p-5">
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
          {actCards.length === 0 ? (
            <p className="text-sm text-on-surface-variant md:col-span-3">Nenhum ato publicado ainda.</p>
          ) : null}
        </div>
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
        <div className="grid gap-4 md:grid-cols-3">
          {sheetFiles.map((file) => (
            <article key={file.id} className="mesa-panel flex flex-col p-5">
              <span className="material-symbols-outlined text-3xl text-primary">description</span>
              <p className="mt-3 font-serif text-lg text-on-surface">{file.name}</p>
              <p className="mt-2 flex-1 text-sm text-on-surface-variant">
                {file.description || 'Modelo oficial da mesa Beladona.'}
              </p>
              {file.fileUrl ? (
                <a href={file.fileUrl} download={file.fileName} className="btn-primary mt-4 text-xs">
                  Baixar PDF ↑
                </a>
              ) : (
                <button type="button" className="btn-primary mt-4 text-xs" disabled>
                  Baixar PDF ↑
                </button>
              )}
            </article>
          ))}
          {sheetFiles.length === 0 ? (
            <>
              {['Ficha canônica de vampiro', 'Ficha de inquisidor', 'Ficha de mortal'].map((title) => (
                <article key={title} className="mesa-panel flex flex-col p-5 opacity-80">
                  <span className="material-symbols-outlined text-3xl text-primary">description</span>
                  <p className="mt-3 font-serif text-lg text-on-surface">{title}</p>
                  <p className="mt-2 flex-1 text-sm text-on-surface-variant">
                    Aguardando publicação do narrador nesta central.
                  </p>
                  <button type="button" className="btn-primary mt-4 text-xs" disabled>
                    Baixar PDF ↑
                  </button>
                </article>
              ))}
            </>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-headline-sm text-lg text-on-surface">Tratados e cartografia da crônica</h2>
        <ul className="space-y-2">
          {tomeFiles.map((file) => (
            <li
              key={file.id}
              className="mesa-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="material-symbols-outlined text-secondary">menu_book</span>
                <div>
                  <p className="font-serif text-on-surface">{file.name}</p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {file.fileName ?? 'arquivo'} · {file.downloadCategory ?? 'tomo'}
                  </p>
                </div>
              </div>
              {file.fileUrl ? (
                <a href={file.fileUrl} download={file.fileName} className="btn-primary text-[10px]">
                  Baixar arquivo
                </a>
              ) : (
                <button type="button" className="btn-primary text-[10px]" disabled>
                  Baixar arquivo
                </button>
              )}
            </li>
          ))}
          {tomeFiles.length === 0 ? (
            <li className="text-sm text-on-surface-variant">Nenhum tratado ou mapa publicado.</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
