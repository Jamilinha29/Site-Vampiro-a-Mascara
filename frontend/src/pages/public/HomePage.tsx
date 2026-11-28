import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/brand/BrandLogo'

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

const CHRONICLE_STEPS = [
  {
    step: '01',
    icon: 'person_edit',
    title: 'Forje sua linhagem',
    text: 'Crie sua conta, monte a ficha guiada por etapas e registre atributos, fé, habilidades e equipamentos.',
  },
  {
    step: '02',
    icon: 'diversity_3',
    title: 'Conecte-se à corte',
    text: 'Adicione amigos e narradores pelo nome ou código ID, confirme presença e entre em mesas públicas ou privadas.',
  },
  {
    step: '03',
    icon: 'auto_stories',
    title: 'Viva cada ato ao vivo',
    text: 'Role dados na sala, acompanhe ameaças em tempo real, negocie no ferreiro e guarde a história da campanha.',
  },
] as const

const PAGE_CONTAINER = 'w-full min-w-0 px-[clamp(1.25rem,4vw,4.5rem)]'

export default function HomePage() {
  return (
    <div className="min-h-svh min-h-dvh w-full min-w-0 bg-surface-container-lowest text-on-surface">
      <header className="safe-pt sticky top-0 z-50 border-b border-outline-variant/25 bg-surface-container-lowest/90 backdrop-blur-md">
        <div className={`${PAGE_CONTAINER} flex min-h-[5.5rem] items-center justify-between gap-6 py-3`}>
          <Link to="/" className="flex min-w-0 items-center gap-3.5 transition hover:opacity-90">
            <BrandLogo size="sm" withGlow className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-label-sm text-xs font-semibold tracking-[0.18em] text-outline uppercase">
                As Crônicas de
              </p>
              <p className="truncate font-serif text-xl font-semibold text-on-surface sm:text-2xl">Beladona</p>
            </div>
          </Link>

          <nav
            className="hidden items-center gap-7 text-[15px] font-medium text-on-surface-variant md:flex lg:gap-10 lg:text-base"
            aria-label="Seções iniciais"
          >
            <a href="#universo" className="py-1.5 transition hover:text-on-surface">
              O universo
            </a>
            <a href="#plataforma" className="py-1.5 transition hover:text-on-surface">
              A plataforma
            </a>
            <a href="#jornada" className="py-1.5 transition hover:text-on-surface">
              Como jogar
            </a>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-outline-variant/20">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_75%_at_78%_45%,rgba(158,27,45,0.24),transparent_72%)]"
          aria-hidden
        />
        <div className={`${PAGE_CONTAINER} relative grid items-center gap-12 py-16 md:py-24 lg:grid-cols-12 lg:gap-16 lg:py-28`}>
          <div className="lg:col-span-7">
            <p className="flex items-center gap-3 font-label-sm text-xs font-semibold tracking-[0.22em] text-secondary uppercase">
              <span className="h-px w-8 bg-secondary/60" aria-hidden />
              Fantasia sombria · Investigação · RPG
            </p>
            <h1 className="mt-6 font-serif text-4xl leading-[1.06] font-semibold tracking-tight text-on-surface sm:text-5xl lg:text-6xl xl:text-[4.5rem]">
              Há segredos que só a noite{' '}
              <span className="font-normal text-secondary italic">revela.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
              Reúna seus personagens, acompanhe a campanha e dê continuidade à sua história em As Crônicas de Beladona.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-6">
              <Link to="/auth/login" className="btn-primary rounded-md px-6 py-3 text-sm tracking-wide normal-case">
                <span className="material-symbols-outlined text-lg">meeting_room</span>
                Entrar na crônica
              </Link>
              <Link
                to="/auth/register"
                className="border-b border-outline-variant/70 pb-0.5 text-base text-on-surface-variant transition hover:border-secondary hover:text-secondary"
              >
                Criar minha conta
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center lg:col-span-5">
            <p className="mb-5 font-label-sm text-xs tracking-[0.28em] text-outline uppercase">
              Sangue · Memória · Poder
            </p>
            <div className="relative flex aspect-square w-72 items-center justify-center sm:w-80 lg:w-96 xl:w-[25rem]">
              <div className="pointer-events-none absolute inset-0 rounded-full border border-outline-variant/25" aria-hidden />
              <div
                className="pointer-events-none absolute inset-6 rounded-full border border-secondary/20"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-10 rounded-full bg-primary-container/15 blur-2xl"
                aria-hidden
              />
              <BrandLogo size="hero" withGlow className="relative z-10 h-48 sm:h-56 lg:h-64 xl:h-72" />
            </div>
            <p className="mt-5 font-label-sm text-xs tracking-[0.28em] text-outline uppercase">
              Crônicas de Beladona
            </p>
            <span className="mt-1.5 text-sm text-secondary/70" aria-hidden>
              ✦
            </span>
          </div>
        </div>
      </section>

      <section id="plataforma" className={`${PAGE_CONTAINER} py-14 md:py-20`}>
        <div>
          <p className="font-label-sm text-xs font-semibold tracking-[0.2em] text-secondary uppercase">
            Sua mesa, conectada
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-on-surface sm:text-4xl">
            Tudo o que a sua jornada precisa.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3 lg:gap-8">
          {PILLARS.map((card) => (
            <article
              key={card.title}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low/70 p-6 transition hover:border-outline-variant/60 hover:bg-surface-container/70 lg:p-8"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-outline-variant/40 bg-surface-container text-secondary">
                <span className="material-symbols-outlined text-xl" aria-hidden>
                  {card.icon}
                </span>
              </span>
              <p className="mt-5 font-label-sm text-[11px] tracking-[0.18em] text-outline uppercase">
                {card.eyebrow}
              </p>
              <h3 className="mt-2 font-serif text-xl font-semibold text-on-surface">{card.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-on-surface-variant">{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="universo" className="border-y border-outline-variant/20 bg-surface-container-low/30">
        <div className={`${PAGE_CONTAINER} grid items-center gap-10 py-16 md:grid-cols-12 md:py-20 lg:gap-14`}>
          <div className="md:col-span-5">
            <p className="font-label-sm text-xs font-semibold tracking-[0.2em] text-secondary uppercase">
              Além do que se vê
            </p>
            <h2 className="mt-2 font-serif text-3xl leading-tight font-semibold text-on-surface sm:text-4xl">
              Entre o conhecido e o <span className="font-normal text-secondary italic">inexplicável.</span>
            </h2>
          </div>
          <div className="space-y-4 md:col-span-7">
            <p className="text-base leading-relaxed text-on-surface-variant">
              Um universo próprio de fantasia sombria, onde investigação, transformações e disputas de poder atravessam
              a vida dos personagens.
            </p>
            <p className="text-base leading-relaxed text-on-surface-variant">
              As informações da campanha, suas regras e os materiais de consulta são conduzidos pelo narrador. Cada
              descoberta pode abrir um novo caminho.
            </p>
            <Link
              to="/ajuda/codice"
              className="btn-secondary mt-3 inline-flex rounded-md border-outline-variant/50 px-5 py-2.5 text-sm"
            >
              <span className="material-symbols-outlined text-lg text-secondary">menu_book</span>
              Consultar o códice
            </Link>
          </div>
        </div>
      </section>

      <section id="jornada" className={`${PAGE_CONTAINER} py-14 md:py-20`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-label-sm text-xs font-semibold tracking-[0.2em] text-secondary uppercase">
              Ritual da mesa
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-on-surface sm:text-4xl">
              Do primeiro registro à mesa ao vivo
            </h2>
          </div>
          <Link
            to="/ajuda/codice"
            className="font-label-sm text-xs tracking-[0.14em] text-secondary uppercase transition hover:underline"
          >
            Ler o códice completo →
          </Link>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3 lg:gap-8">
          {CHRONICLE_STEPS.map((item) => (
            <article
              key={item.step}
              className="rounded-lg border border-outline-variant/30 bg-surface-container-low/70 p-6 transition hover:border-secondary/45 lg:p-8"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-outline-variant/40 bg-surface-container text-secondary">
                  <span className="material-symbols-outlined text-xl" aria-hidden>
                    {item.icon}
                  </span>
                </span>
                <span className="font-label-sm text-xs font-semibold tracking-[0.2em] text-outline">
                  ATO {item.step}
                </span>
              </div>
              <h3 className="mt-5 font-serif text-xl font-semibold text-on-surface">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-on-surface-variant">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="safe-pb border-t border-outline-variant/25 py-8 text-sm text-outline">
        <div className={`${PAGE_CONTAINER} flex flex-wrap items-center justify-between gap-4`}>
          <p className="flex flex-wrap items-center gap-3">
            <span className="font-serif text-base text-on-surface">As Crônicas de Beladona</span>
            <span>Personagens, escolhas e histórias compartilhadas.</span>
          </p>
          <div className="flex items-center gap-6">
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
