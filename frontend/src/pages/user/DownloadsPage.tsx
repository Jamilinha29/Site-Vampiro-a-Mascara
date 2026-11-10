import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

export default function DownloadsPage() {
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
                <button type="button" className="btn-secondary text-[10px]" disabled>
                  Ver resumo narrativo
                </button>
                <button type="button" className="btn-secondary text-[10px]" disabled>
                  Registrar mortes e feitos
                </button>
              </div>
            </article>
          ))}
          {actCards.length === 0 ? (
            <p className="text-sm text-on-surface-variant md:col-span-3">Nenhum ato publicado ainda.</p>
          ) : null}
        </div>
      </section>

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
