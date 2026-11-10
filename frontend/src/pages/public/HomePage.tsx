import { BrandLogo } from '../../components/brand/BrandLogo'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'

export default function HomePage() {
  const newsQuery = useQuery({ queryKey: ['news'], queryFn: () => api.getNews() })

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface">
      <header className="sticky top-0 z-50 border-b border-outline-variant/40 bg-surface-container-lowest/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-3">
            <BrandLogo size="sm" withGlow />
            <div>
              <p className="font-serif text-sm font-bold tracking-wider text-secondary uppercase">
                Vampiro: A Idade das Trevas
              </p>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-on-surface-variant uppercase">
                As Crônicas de Beladona
              </p>
            </div>
          </Link>
          <nav className="hidden items-center gap-7 font-serif text-sm lg:flex">
            <a href="#sobre" className="text-on-surface-variant hover:text-secondary">
              Sobre
            </a>
            <a href="#noticias" className="text-on-surface-variant hover:text-secondary">
              Notícias
            </a>
          </nav>
          <Link to="/auth/login" className="btn-primary text-xs">
            <span className="material-symbols-outlined text-sm">login</span>
            Entrar nas Trevas
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-outline-variant/30 px-4 py-20 text-center md:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(158,27,45,0.28),rgba(14,14,19,0.95)_75%,#0e0e13_100%)]" />
        <div className="relative mx-auto max-w-3xl">
          <h1 className="font-serif text-4xl font-bold tracking-tight md:text-6xl">
            <span className="block text-on-surface">Entre nas Trevas.</span>
            <span className="mt-1 block font-normal text-primary italic">Escreva sua Lenda.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-on-surface-variant md:text-base">
            Companion para crônicas medievais — fichas digitais, mesa ao vivo (sem mapa aqui), economia feudal e
            grimório administrado pelo narrador. Mapas ficam na sessão online que o mestre conduz.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/auth/register" className="btn-primary w-full sm:w-auto">
              <span className="material-symbols-outlined">swords</span>
              Iniciar Jornada / Criar Conta
            </Link>
            <a href="#sobre" className="btn-secondary w-full sm:w-auto">
              <span className="material-symbols-outlined text-secondary">auto_stories</span>
              Conhecer o Projeto
            </a>
          </div>
        </div>
      </section>

      <section id="sobre" className="mx-auto max-w-5xl px-4 py-16">
        <h2 className="font-headline-md mb-6 text-2xl text-secondary">Sobre a Plataforma</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Fichas & Regras',
              text: 'Criação em seis etapas, templates por espécie e exportação PDF auditada.',
            },
            {
              title: 'Mesa ao vivo',
              text: 'Iniciativa, ameaças, teatro da mente e bolsa privada. Mapa e tokens na call/VTT do narrador.',
            },
            {
              title: 'Economia & Acervo',
              text: 'Carteira ouro/prata/cobre, loja de sessão e grimório com permissões reais.',
            },
          ].map((card) => (
            <article key={card.title} className="card-surface p-5">
              <h3 className="mb-2 font-serif text-lg text-on-surface">{card.title}</h3>
              <p className="text-sm text-on-surface-variant">{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="noticias" className="border-t border-outline-variant/30 bg-surface-container-low px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="font-headline-md mb-8 text-2xl text-secondary">Notícias &amp; Éditos</h2>
          {newsQuery.isLoading ? (
            <p className="text-sm text-on-surface-variant">Carregando éditos…</p>
          ) : newsQuery.data?.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {newsQuery.data.map((post) => (
                <article key={post.id} className="card-surface p-5 text-left">
                  <time className="text-xs text-outline">{new Date(post.publishedAt).toLocaleDateString('pt-BR')}</time>
                  <h3 className="mt-2 font-serif text-lg text-on-surface">{post.title}</h3>
                  <p className="mt-2 text-sm text-on-surface-variant">{post.excerpt}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">Nenhum édito publicado ainda.</p>
          )}
        </div>
      </section>

      <footer className="border-t border-outline-variant/40 px-4 py-10 text-center text-xs text-on-surface-variant">
        <p>As Crônicas de Beladona — Sanguis &amp; Shadow Engine</p>
        <div className="mt-3 flex flex-wrap justify-center gap-4">
          <Link to="/auth/login" className="hover:text-secondary">
            Entrar
          </Link>
          <Link to="/auth/register" className="hover:text-secondary">
            Criar conta
          </Link>
          <Link to="/ajuda/codice" className="hover:text-secondary">
            Suporte
          </Link>
        </div>
      </footer>
    </div>
  )
}
