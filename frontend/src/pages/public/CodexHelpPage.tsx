import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { ViewportPageShell } from '../../components/layout/ViewportPageShell'

const CODEX_SECTIONS = [
  {
    icon: 'vpn_key',
    title: '1. Acesso, cadastro e recuperação',
    items: [
      'Crie sua conta com e-mail válido e confirme o link de verificação enviado para liberar a entrada na crônica.',
      'Esqueceu a senha? Use a recuperação oficial na tela de entrada para receber um novo selo de acesso.',
      'Em Configurações você ajusta foto de perfil, banner, nome exibido, feudo de origem e preferências de aviso.',
    ],
  },
  {
    icon: 'badge',
    title: '2. Fichas, progressão e subclasses',
    items: [
      'Crie personagens na Área do Jogador escolhendo linhagem, clã, fé, arquétipo, atributos e poderes.',
      'A evolução vai do nível 0 ao 10: a Subclasse I desbloqueia no nível 5 e a Subclasse II no nível 7.',
      'Somente o narrador concede XP em mesa. Após finalizar sua ficha, envie-a para revisão do mestre.',
    ],
  },
  {
    icon: 'casino',
    title: '3. Sessões e mesa ao vivo',
    items: [
      'Mesas públicas aparecem na busca de Sessões e permitem entrada direta escolhendo seu personagem.',
      'Mesas privadas exigem o código da sala fornecido pelo narrador. Ao sair da mesa, o código é pedido novamente.',
      'Durante o jogo ao vivo você rola dados, declara ações, acompanha ameaças, usa habilidades e acessa o Ferreiro.',
    ],
  },
  {
    icon: 'group',
    title: '4. Amigos, narradores e código ID',
    items: [
      'Cada conta recebe um Código ID numérico exclusivo (10 dígitos) visível no seu Perfil.',
      'Você pode procurar amigos — tanto jogadores quanto narradores — pelo nome, @handle ou Código ID.',
      'Mesas privadas de amigos ficam visíveis na sua busca de sessões (ainda exigindo o código de sala).',
    ],
  },
  {
    icon: 'menu_book',
    title: '5. Glossário, loja e downloads',
    items: [
      'O Glossário reúne grimórios, amuletos, relíquias e o Bestiário publicados pelo narrador.',
      'Na Loja da sessão e no Ferreiro você adquire equipamentos e participa de leilões usando ouro, prata e bronze.',
      'Em Downloads ficam fichas imprimíveis, mapas/tratados e o histórico de atos encerrados.',
    ],
  },
] as const

export default function CodexHelpPage() {
  return (
    <ViewportPageShell>
      <div className="my-auto w-full space-y-6 py-4 text-on-surface">
        <header className="card-surface flex flex-wrap items-center justify-between gap-4 p-6 sm:p-7">
          <div className="flex min-w-0 items-center gap-3.5">
            <BrandLogo size="sm" withGlow className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" />
            <div className="min-w-0">
              <p className="font-label-sm text-xs font-semibold tracking-[0.2em] text-secondary uppercase">
                Guia da Crônica
              </p>
              <h1 className="font-headline-lg text-2xl text-on-surface sm:text-3xl">
                Códice de Beladona
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link to="/" className="btn-secondary px-4 py-2 text-xs sm:text-sm">
              Página inicial
            </Link>
            <Link to="/auth/login" className="btn-primary px-4 py-2 text-xs sm:text-sm">
              Entrar na crônica
            </Link>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {CODEX_SECTIONS.map((sec, index) => (
            <section
              key={sec.title}
              className={`card-surface space-y-3 p-5 ${
                index === CODEX_SECTIONS.length - 1 ? 'md:col-span-2' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-secondary/40 bg-secondary/10 text-secondary">
                  <span className="material-symbols-outlined text-lg" aria-hidden>
                    {sec.icon}
                  </span>
                </span>
                <h2 className="font-serif text-base font-semibold text-on-surface">{sec.title}</h2>
              </div>
              <ul className="space-y-2 text-xs leading-relaxed text-on-surface-variant sm:text-sm">
                {sec.items.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-secondary" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-outline">
          <span>Dúvidas sobre códigos de sala ou ficha? Fale com o narrador da sua mesa.</span>
          <Link to="/auth/register" className="text-secondary hover:underline">
            Criar nova conta →
          </Link>
        </footer>
      </div>
    </ViewportPageShell>
  )
}
