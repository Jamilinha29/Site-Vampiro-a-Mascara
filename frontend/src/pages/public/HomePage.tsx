import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { api } from '../../services/api'

const PILLARS = [
  {
    icon: 'badge',
    eyebrow: 'Fichas de personagens',
    title: 'Seu personagem, por inteiro',
    text: 'Identidade, atributos, poderes e inventário reunidos em uma ficha que acompanha a sua jornada.',
  },
  {
    icon: 'casino',
    eyebrow: 'Mesa virtual',
    title: 'A história acontece à mesa',
    text: 'Sessões, rolagens e ameaças em um só lugar. O narrador conduz a cena; suas escolhas movem a crônica.',
  },
  {
    icon: 'menu_book',
    eyebrow: 'Acervo da crônica',
    title: 'Conhecimento tem seu preço',
    text: 'Consulte o glossário, encontre recursos e acompanhe o que o narrador publicou para a campanha.',
  },
] as const

export default function HomePage() {
  const newsQuery = useQuery({ queryKey: ['news'], queryFn: () => api.getNews() })

  return (
    <div className="min-h-svh min-h-dvh w-full min-w-0 bg-surface-container-lowest text-on-surface">
      <header className="safe-pt sticky top-0 z-50 border-b border-outline-variant/25 bg-surface-container-lowest/90 backdrop-blur-md">
        <div className="safe-px mx-auto flex h-16 max-w-6xl min-w-0 items-center justify-between gap-4">
          <Link to="/" className="flex min-w-0 items-center gap-3 transition hover:opacity-90">
            <BrandLogo size="xs" withGlow className="h-9 w-9 shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-label-sm text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
                As Crônicas de
              </p>
              <p className="truncate font-serif text-base font-semibold text-on-surface">Beladona</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-on-surface-variant md:flex" aria-label="Seções iniciais">
            <a href="#universo" className="transition hover:text-on-surface">
              O universo
            </a>
            <a href="#plataforma" className="transition hover:text-on-surface">
              A plataforma
            </a>
            <a href="#editos" className="transition hover:text-on-surface">
              Éditos
            </a>
          </nav>

          <Link
            to="/auth/login"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-outline-variant/50 bg-surface-container-low px-3.5 py-2 text-xs font-medium text-on-surface transition hover:border-secondary/60 hover:text-secondary"
          >
            <span className="material-symbols-outlined text-base text-secondary">vpn_key</span>
            Entrar
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-outline-variant/20">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_65%_at_75%_40%,rgba(158,27,45,0.22),transparent_70%)]"
          aria-hidden
        />
        <div className="safe-px relative mx-auto grid max-w-6xl items-center gap-12 py-14 md:py-20 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="flex items-center gap-3 font-label-sm text-[11px] font-semibold tracking-[0.2em] text-secondary uppercase">
              <span className="h-px w-6 bg-secondary/60" aria-hidden />
              Fantasia sombria · Investigação · RPG
            </p>
            <h1 className="mt-5 font-serif text-4xl leading-[1.08] font-semibold tracking-tight text-on-surface sm:text-5xl md:text-6xl">
              Há segredos que só a noite{' '}
              <span className="font-normal text-secondary italic">revela.</span>
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
              Reúna seus personagens, acompanhe a campanha e dê continuidade à sua história em As Crônicas de Beladona.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Link to="/auth/login" className="btn-primary rounded-md px-5 py-2.5 text-xs tracking-wide normal-case">
                <span className="material-symbols-outlined text-base">meeting_room</span>
                Entrar na crônica
              </Link>
              <Link
                to="/auth/register"
                className="border-b border-outline-variant/70 pb-0.5 text-sm text-on-surface-variant transition hover:border-secondary hover:text-secondary"
              >
                Criar minha conta
              </Link>
            </div>
            <div className="mt-10 flex items-start gap-3 text-xs leading-relaxed text-outline">
              <span className="material-symbols-outlined mt-0.5 text-base text-secondary/80" aria-hidden>
                history_edu
              </span>
              <p>
                Uma mesa. Muitas escolhas.
                <br />
                Uma história que vocês escrevem juntos.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center lg:col-span-5">
            <p className="mb-5 font-label-sm text-[10px] tracking-[0.26em] text-outline uppercase">
              Sangue · Memória · Poder
            </p>
            <div className="relative flex aspect-square w-64 items-center justify-center sm:w-72 md:w-80">
              <div className="pointer-events-none absolute inset-0 rounded-full border border-outline-variant/25" aria-hidden />
              <div
                className="pointer-events-none absolute inset-6 rounded-full border border-secondary/20"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-10 rounded-full bg-primary-container/15 blur-2xl"
                aria-hidden
              />
              <BrandLogo size="hero" withGlow className="relative z-10 h-44 sm:h-52" />
            </div>
            <p className="mt-5 font-label-sm text-[10px] tracking-[0.26em] text-outline uppercase">
              Crônicas de Beladona
            </p>
            <span className="mt-1.5 text-xs text-secondary/70" aria-hidden>
              ✦
            </span>
          </div>
        </div>
      </section>

      <div className="safe-px mx-auto flex max-w-6xl items-center gap-4 pt-10 text-center">
        <span className="h-px flex-1 bg-outline-variant/25" aria-hidden />
        <span className="font-label-sm text-[10px] tracking-[0.24em] text-outline uppercase">
          Uma crônica em constante construção
        </span>
        <span className="h-px flex-1 bg-outline-variant/25" aria-hidden />
      </div>

      <section id="plataforma" className="safe-px mx-auto max-w-6xl py-12 md:py-16">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-label-sm text-[11px] font-semibold tracking-[0.18em] text-secondary uppercase">
              Sua mesa, conectada
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold text-on-surface sm:text-3xl">
              Tudo o que a sua jornada precisa.
            </h2>
          </div>
          <p className="max-w-xs text-xs leading-relaxed text-outline sm:text-right">
            Menos informações dispersas.
            <br />
            Mais espaço para viver a história.
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {PILLARS.map((card) => (
            <article
              key={card.title}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low/70 p-6 transition hover:border-outline-variant/60 hover:bg-surface-container/70"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-outline-variant/40 bg-surface-container text-secondary">
                <span className="material-symbols-outlined text-lg" aria-hidden>
                  {card.icon}
                </span>
              </span>
              <p className="mt-5 font-label-sm text-[10px] tracking-[0.18em] text-outline uppercase">
                {card.eyebrow}
              </p>
              <h3 className="mt-1.5 font-serif text-lg font-semibold text-on-surface">{card.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="universo" className="border-y border-outline-variant/20 bg-surface-container-low/30">
        <div className="safe-px mx-auto grid max-w-6xl items-center gap-8 py-14 md:grid-cols-12 md:py-16">
          <div className="md:col-span-5">
            <p className="font-label-sm text-[11px] font-semibold tracking-[0.18em] text-secondary uppercase">
              Além do que se vê
            </p>
            <h2 className="mt-2 font-serif text-3xl leading-tight font-semibold text-on-surface">
              Entre o conhecido e o <span className="font-normal text-secondary italic">inexplicável.</span>
            </h2>
          </div>
          <div className="space-y-4 md:col-span-7">
            <p className="text-sm leading-relaxed text-on-surface-variant">
              Um universo próprio de fantasia sombria, onde investigação, transformações e disputas de poder atravessam
              a vida dos personagens.
            </p>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              As informações da campanha, suas regras e os materiais de consulta são conduzidos pelo narrador. Cada
              descoberta pode abrir um novo caminho.
            </p>
            <Link
              to="/ajuda/codice"
              className="btn-secondary mt-2 inline-flex rounded-md border-outline-variant/50 px-4 py-2 text-xs"
            >
              <span className="material-symbols-outlined text-base text-secondary">menu_book</span>
              Consultar o códice
            </Link>
          </div>
        </div>
      </section>

      <section id="editos" className="safe-px mx-auto max-w-6xl py-12 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-label-sm text-[11px] font-semibold tracking-[0.18em] text-secondary uppercase">
              Da mesa para a crônica
            </p>
            <h2 className="mt-1.5 font-serif text-2xl font-semibold text-on-surface">Notícias &amp; éditos</h2>
          </div>
          <span className="font-label-sm text-[10px] tracking-[0.16em] text-outline uppercase">
            Publicações do narrador
          </span>
        </div>

        <div className="mt-6">
          {newsQuery.isLoading ? (
            <p className="text-sm text-on-surface-variant">Carregando éditos…</p>
          ) : newsQuery.data?.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {newsQuery.data.map((post) => (
                <article key={post.id} className="rounded-lg border border-outline-variant/35 bg-surface-container-low p-5">
                  <time className="text-xs text-outline">{new Date(post.publishedAt).toLocaleDateString('pt-BR')}</time>
                  <h3 className="mt-2 font-serif text-lg text-on-surface">{post.title}</h3>
                  <p className="mt-2 text-sm text-on-surface-variant">{post.excerpt}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-dashed border-outline-variant/40 bg-surface-container-low/40 p-6">
              <span className="material-symbols-outlined mt-0.5 text-lg text-secondary/80" aria-hidden>
                history_edu
              </span>
              <div>
                <p className="font-serif text-sm text-on-surface">O próximo édito ainda será escrito.</p>
                <p className="mt-1 text-xs text-outline">
                  As publicações aparecerão aqui quando o narrador as disponibilizar.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="safe-px safe-pb border-t border-outline-variant/25 py-6 text-xs text-outline">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <p className="flex flex-wrap items-center gap-3">
            <span className="font-serif text-sm text-on-surface">As Crônicas de Beladona</span>
            <span>Personagens, escolhas e histórias compartilhadas.</span>
          </p>
          <div className="flex items-center gap-5">
            <Link to="/auth/login" className="hover:text-secondary">
              Entrar
            </Link>
            <Link to="/auth/register" className="hover:text-secondary">
              Criar conta
            </Link>
            <Link to="/ajuda/codice" className="hover:text-secondary">
              Ajuda
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
