import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/brand/BrandLogo'

const PILLARS = [
  {
    icon: 'badge',
    eyebrow: 'Fichas & Evolução',
    title: 'Criação guiada em 6 etapas',
    text: 'Monte Vampiros, Caçadores ou Outras espécies com clã, fé, atributos, habilidades próprias, inventário com bônus automáticos e subclasses nos níveis 5 e 7.',
  },
  {
    icon: 'casino',
    eyebrow: 'Mesa virtual ao vivo',
    title: 'Cada ato em tempo real',
    text: 'Confirme presença, entre em mesas abertas ou exclusivas da sua campanha, role dados abertos ou secretos, declare ações e acompanhe ameaças da cena.',
  },
  {
    icon: 'storefront',
    eyebrow: 'Economia & Ferreiro',
    title: 'Carteira, loja e leilões',
    text: 'Gerencie ouro, prata e bronze com extrato completo, adquira equipamentos no Mercado e dispute itens raros nos leilões do Ferreiro durante a sessão.',
  },
  {
    icon: 'menu_book',
    eyebrow: 'Glossário & Bestiário',
    title: 'Conhecimento em camadas',
    text: 'Consulte grimórios, amuletos e relíquias da campanha e explore criaturas do Bestiário separadas entre Conhecidas, Classificado e Rumores.',
  },
  {
    icon: 'folder_open',
    eyebrow: 'Arquivos da crônica',
    title: 'Compêndio e memória dos atos',
    text: 'Baixe fichas oficiais por espécie, leia os livros dos clãs no Compêndio e revisite resumos e feitos em Acontecimentos Passados.',
  },
  {
    icon: 'diversity_3',
    eyebrow: 'Alianças & Perfil',
    title: 'Conecte-se à corte',
    text: 'Encontre aliados e narradores em Alianças, acompanhe mesas exclusivas do seu grupo e exiba suas conquistas no mural.',
  },
] as const

const CHRONICLE_STEPS = [
  {
    step: '01',
    icon: 'person_edit',
    title: 'Forje sua linhagem',
    text: 'Entre com e-mail ou Google, percorra as 6 etapas da ficha guiada e envie seu personagem para a revisão do narrador.',
  },
  {
    step: '02',
    icon: 'diversity_3',
    title: 'Conecte-se à corte',
    text: 'Adicione aliados e mestres em Alianças, confirme presença nas sessões agendadas e prepare seu grupo antes de a cena abrir.',
  },
  {
    step: '03',
    icon: 'auto_stories',
    title: 'Viva cada ato ao vivo',
    text: 'Role dados na mesa virtual, negocie no Ferreiro e acompanhe o Bestiário, o Compêndio e os Acontecimentos Passados.',
  },
] as const

const FOOTER_LINK_COLUMNS = [
  {
    title: 'Crônica',
    links: [
      { label: 'Início', to: '/#topo' },
      { label: 'Lore', to: '/#universo' },
      { label: 'Mesa virtual', to: '/#plataforma' },
      { label: 'Ritual de jogo', to: '/#jornada' },
      { label: 'Códice completo', to: '/ajuda/codice' },
      { label: 'Suporte de acesso', to: '/#suporte' },
    ],
  },
  {
    title: 'Área do Jogador',
    links: [
      { label: 'Entrar na crônica', to: '/auth/login' },
      { label: 'Criar conta', to: '/auth/register' },
      { label: 'Recuperar senha', to: '/auth/recover' },
      { label: 'Painel do jogador', to: '/user' },
      { label: 'Forjar personagem', to: '/user/characters/new/lineage' },
      { label: 'Sessões e mesas', to: '/user/sessions' },
    ],
  },
  {
    title: 'Acervo & Corte',
    links: [
      { label: 'Glossário e Grimório', to: '/user/archive' },
      { label: 'Bestiário', to: '/user/archive?section=bestiary' },
      { label: 'Mercado', to: '/user/shop' },
      { label: 'Compêndio e Fichas', to: '/user/downloads' },
      { label: 'Alianças', to: '/user/friends' },
      { label: 'Portal do narrador', to: '/admin' },
    ],
  },
] as const

const PAGE_CONTAINER = 'w-full min-w-0 px-[clamp(1.25rem,4vw,4.5rem)]'

const NAV_LINKS = [
  { href: '#universo', label: 'Lore' },
  { href: '#plataforma', label: 'Mesa' },
  { href: '#jornada', label: 'Ritual' },
] as const

const NAV_LINK_CLASS =
  'relative inline-flex items-center justify-center px-2 py-2 font-label-sm text-xs font-semibold tracking-[0.22em] text-on-surface-variant uppercase transition hover:text-secondary after:absolute after:inset-x-1 after:bottom-0.5 after:h-[2px] after:origin-center after:scale-x-0 after:bg-secondary after:transition-transform hover:after:scale-x-100 focus-visible:text-secondary focus-visible:after:scale-x-100 sm:px-3 sm:text-[13px]'

export default function HomePage() {
  return (
    <div id="topo" className="min-h-svh min-h-dvh w-full min-w-0 bg-surface-container-lowest text-on-surface">
      <header className="safe-pt sticky top-0 z-50 border-b border-outline-variant/25 bg-surface-container-lowest/90 backdrop-blur-md">
        <div
          className={`${PAGE_CONTAINER} flex min-h-[5rem] items-center justify-between gap-4 py-2.5 md:grid md:grid-cols-[1fr_auto_1fr]`}
        >
          <Link to="/" className="flex min-w-0 items-center gap-3.5 justify-self-start transition hover:opacity-90">
            <BrandLogo size="sm" withGlow className="h-11 w-11 shrink-0 sm:h-13 sm:w-13" />
            <div className="min-w-0 leading-tight">
              <p className="truncate font-label-sm text-xs font-semibold tracking-[0.18em] text-outline uppercase">
                As Crônicas de
              </p>
              <p className="truncate font-serif text-xl font-semibold text-on-surface sm:text-2xl">Beladona</p>
            </div>
          </Link>

          <nav
            className="hidden items-center justify-center gap-6 justify-self-center md:flex lg:gap-10"
            aria-label="Seções iniciais"
          >
            {NAV_LINKS.map((item) => (
              <a key={item.href} href={item.href} className={NAV_LINK_CLASS}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center justify-self-end">
            <Link
              to="/auth/login"
              className="btn-primary rounded-md px-3.5 py-2 text-xs tracking-wide normal-case sm:px-5 sm:py-2.5 sm:text-sm"
            >
              <span className="material-symbols-outlined text-base sm:text-lg" aria-hidden>
                meeting_room
              </span>
              Entrar na crônica
            </Link>
          </div>
        </div>

        <nav
          className={`${PAGE_CONTAINER} flex items-center justify-center gap-6 border-t border-outline-variant/20 py-1.5 md:hidden`}
          aria-label="Seções iniciais no celular"
        >
          {NAV_LINKS.map((item) => (
            <a key={item.href} href={item.href} className={NAV_LINK_CLASS}>
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <section className="relative flex min-h-[calc(100svh-7.5rem)] items-center overflow-hidden border-b border-outline-variant/20 md:min-h-[calc(100svh-5rem)]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_75%_at_78%_45%,rgba(158,27,45,0.24),transparent_72%)]"
          aria-hidden
        />
        <div className={`${PAGE_CONTAINER} relative grid w-full items-center gap-8 py-12 md:py-16 lg:grid-cols-12 lg:gap-12 lg:py-20`}>
          <div className="lg:col-span-7">
            <p className="flex items-center gap-3 font-label-sm text-xs font-semibold tracking-[0.22em] text-secondary uppercase">
              <span className="h-px w-8 bg-secondary/60" aria-hidden />
              Fantasia sombria · Investigação · RPG
            </p>
            <h1 className="mt-4 font-serif text-4xl leading-[1.06] font-semibold tracking-tight text-on-surface sm:text-5xl lg:text-6xl xl:text-[4.25rem]">
              Há segredos que só a noite{' '}
              <span className="font-normal text-secondary italic">revela.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-on-surface-variant sm:text-lg">
              Forje sua ficha guiada, participe de mesas ao vivo, negocie no Ferreiro e consulte o acervo completo em As
              Crônicas de Beladona.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center lg:col-span-5">
            <p className="mb-3 font-label-sm text-xs tracking-[0.28em] text-outline uppercase">
              Sangue · Memória · Poder
            </p>
            <div className="relative flex aspect-square w-56 items-center justify-center sm:w-64 lg:w-72 xl:w-80">
              <div className="pointer-events-none absolute inset-0 rounded-full border border-outline-variant/25" aria-hidden />
              <div
                className="pointer-events-none absolute inset-5 rounded-full border border-secondary/20"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-8 rounded-full bg-primary-container/15 blur-2xl"
                aria-hidden
              />
              <BrandLogo size="hero" withGlow className="relative z-10 h-40 sm:h-48 lg:h-52 xl:h-56" />
            </div>
            <p className="mt-3 font-label-sm text-xs tracking-[0.28em] text-outline uppercase">
              Crônicas de Beladona
            </p>
            <span className="mt-1 text-sm text-secondary/70" aria-hidden>
              ✦
            </span>
          </div>
        </div>
      </section>

      <section
        id="universo"
        className="scroll-mt-32 border-b border-outline-variant/20 bg-surface-container-low/30 md:scroll-mt-24"
      >
        <div className={`${PAGE_CONTAINER} grid items-center gap-10 py-16 md:grid-cols-12 md:py-24 lg:gap-14`}>
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
              Ambientada na Idade das Trevas, a crônica reúne vampiros de diferentes clãs, caçadores mortais e outras
              criaturas ocultas em disputas de poder, pactos de sangue, caminhos de fé e mistérios conduzidos pelo
              narrador.
            </p>
            <p className="text-base leading-relaxed text-on-surface-variant">
              Cada ato encerrado permanece registrado em Acontecimentos Passados, ameaças surgem em camadas no
              Bestiário e cada clã reúne seus próprios livros no Compêndio.
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

      <section id="plataforma" className={`${PAGE_CONTAINER} scroll-mt-32 py-16 md:scroll-mt-24 md:py-24`}>
        <div>
          <p className="font-label-sm text-xs font-semibold tracking-[0.2em] text-secondary uppercase">
            Sua mesa, conectada
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold text-on-surface sm:text-4xl">
            Tudo o que a sua jornada precisa.
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-7">
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

      <section
        id="jornada"
        className="scroll-mt-32 border-t border-outline-variant/20 bg-surface-container-low/30 md:scroll-mt-24"
      >
        <div className={`${PAGE_CONTAINER} py-16 md:py-24`}>
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
        </div>
      </section>

      <footer
        id="suporte"
        className="safe-pb scroll-mt-32 border-t border-outline-variant/30 bg-[#141218] pt-12 pb-8 text-on-surface md:scroll-mt-24 md:pt-14"
      >
        <div className={PAGE_CONTAINER}>
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="flex flex-col items-start gap-4 lg:col-span-3">
              <Link to="/" className="flex items-center gap-3 transition hover:opacity-90">
                <BrandLogo size="sm" withGlow className="h-12 w-12 shrink-0" />
                <div className="leading-tight">
                  <p className="font-label-sm text-[11px] font-semibold tracking-[0.2em] text-outline uppercase">
                    As Crônicas de
                  </p>
                  <p className="font-serif text-xl font-semibold text-on-surface">Beladona</p>
                </div>
              </Link>
              <p className="max-w-xs text-xs leading-relaxed text-on-surface-variant">
                Crônica sombria de investigação, evolução de personagens e mesas conduzidas ao vivo.
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-3 lg:col-span-9">
              {FOOTER_LINK_COLUMNS.map((col) => (
                <div key={col.title}>
                  <p className="font-label-sm text-xs font-bold tracking-[0.18em] text-secondary uppercase">
                    {col.title}
                  </p>
                  <ul className="mt-3.5 space-y-2 text-sm text-on-surface-variant">
                    {col.links.map((item) => (
                      <li key={item.label}>
                        {item.to.startsWith('/#') ? (
                          <a href={item.to.slice(1)} className="transition hover:text-secondary">
                            {item.label}
                          </a>
                        ) : (
                          <Link to={item.to} className="transition hover:text-secondary">
                            {item.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="my-10 border-t border-outline-variant/25" />

          <div className="grid gap-6 md:grid-cols-2 md:items-stretch">
            <div className="flex flex-col justify-between rounded-2xl bg-[#efe6d8] p-6 text-[#18141c] shadow-[0_18px_40px_-14px_rgba(0,0,0,0.85)]">
              <div className="space-y-2.5">
                <h3 className="font-label-sm text-xs font-bold tracking-[0.18em] text-[#18141c] uppercase">
                  Suporte de acesso
                </h3>
                <p className="text-sm leading-relaxed text-[#382f3a]">
                  Canal direto para recuperação de senha, validação de e-mail, dúvidas sobre a entrada com Google ou
                  atendimento ao jogador em As Crônicas de Beladona.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold">
                <a
                  href="mailto:suporte@beladona.rpg"
                  className="text-[#5a222b] underline underline-offset-4 transition hover:text-[#761a29]"
                >
                  suporte@beladona.rpg
                </a>
                <Link
                  to="/auth/recover"
                  className="text-[#382f3a] underline underline-offset-4 transition hover:text-[#761a29]"
                >
                  Recuperar senha
                </Link>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-outline-variant/35 bg-surface-container-low/80 p-6">
              <div className="space-y-2.5">
                <h3 className="font-label-sm text-xs font-bold tracking-[0.18em] text-secondary uppercase">
                  Conclave &amp; Mesas
                </h3>
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  Dúvidas sobre revisão da sua ficha, espécies especiais, sessões em andamento ou leilões do Ferreiro?
                  Converse diretamente com o narrador da sua campanha pela aba Alianças ou consulte o Códice completo.
                </p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold">
                <Link
                  to="/ajuda/codice"
                  className="text-secondary underline underline-offset-4 transition hover:text-on-surface"
                >
                  Códice da crônica
                </Link>
                <Link
                  to="/user/friends"
                  className="text-on-surface-variant underline underline-offset-4 transition hover:text-secondary"
                >
                  Alianças
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/20 pt-5 text-xs text-outline">
            <span>As Crônicas de Beladona · Desenvolvido por Jamili Gabriela</span>
            <span>Crônica sombria · Mesa ao vivo</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
