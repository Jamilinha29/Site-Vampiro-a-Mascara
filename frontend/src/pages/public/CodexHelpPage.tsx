import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { ViewportPageShell } from '../../components/layout/ViewportPageShell'

const CODEX_SECTIONS = [
  {
    icon: 'vpn_key',
    title: '1. Acesso, conta e segurança',
    items: [
      'Entre rapidamente com seu e-mail e senha ou conecte sua conta Google logo na porta da crônica.',
      'Esqueceu sua senha? Recupere o acesso em instantes pelo seu e-mail na tela de recuperação ou nas Configurações.',
      'Personalize seu retrato, banner, biografia, feudo de origem e preferências da jornada no painel da conta.',
    ],
  },
  {
    icon: 'badge',
    title: '2. Fichas, espécies e evolução',
    items: [
      'Forje personagens no grimório em 6 etapas escolhendo entre Vampiros, Caçadores ou outras linhagens autorizadas pelo mestre, além de clã e caminho de fé entre Luz ou Trevas.',
      'Distribua atributos, virtudes, perícias e habilidades exclusivas; itens equipados no inventário aplicam bônus automáticos em Vida, Mana e Defesa.',
      'A evolução vai do nível 0 ao 10, desbloqueando a Subclasse I no nível 5 e a Subclasse II no nível 7. Envie sua ficha para revisão do narrador.',
    ],
  },
  {
    icon: 'casino',
    title: '3. Sessões e mesa ao vivo',
    items: [
      'Explore mesas abertas ao público ou participe de campanhas reservadas conduzidas pelo narrador da sua mesa.',
      'Confirme sua participação na sessão agendada para liberar a entrada na Mesa ao Vivo assim que o horário chegar e a sala for aberta.',
      'Durante a cena você rola dados abertos ou secretos, declara ações, acompanha ameaças ativas e vive cada ato em tempo real.',
    ],
  },
  {
    icon: 'storefront',
    title: '4. Moedas, Mercado e Ferreiro',
    items: [
      'Sua carteira acompanha saldos em ouro, prata e bronze com histórico completo das recompensas recebidas e compras efetuadas.',
      'No Mercado da crônica você adquire equipamentos, consumíveis e serviços que seguem direto para a mochila do seu personagem.',
      'Dentro da mesa ao vivo, o Ferreiro oferece itens exclusivos da sessão e leilões em tempo real onde você disputa relíquias.',
    ],
  },
  {
    icon: 'menu_book',
    title: '5. Glossário, Bestiário e Arquivos',
    items: [
      'O Glossário reúne grimórios, amuletos e relíquias publicados; o Bestiário revela criaturas por camadas: Conhecidas, Classificado e Rumores.',
      'Em Arquivos ficam os Acontecimentos Passados com resumo narrativo, ameaças derrotadas e feitos de cada ato encerrado.',
      'Também em Arquivos você encontra fichas prontas para impressão por espécie e os livros de cada clã no Compêndio.',
    ],
  },
  {
    icon: 'group',
    title: '6. Alianças, conquistas e suporte',
    items: [
      'Conecte-se com aliados e narradores pela aba Alianças para acompanhar encontros do grupo e combinar novas sessões.',
      'Desbloqueie conquistas marcantes durante a crônica e visualize suas estatísticas e gráfico radar no Perfil.',
      'Precisa de ajuda com sua conta ou recuperação de acesso? Conte com o Suporte de acesso na página inicial.',
    ],
  },
] as const

export default function CodexHelpPage() {
  return (
    <ViewportPageShell>
      <div className="flex w-full flex-1 flex-col justify-between gap-6 py-2 text-on-surface">
        <header className="card-surface flex items-center justify-between gap-4 p-6 sm:p-7">
          <Link
            to="/"
            className="group flex min-w-0 items-center gap-3.5 rounded-md transition hover:opacity-90"
            aria-label="Voltar para a página inicial"
            title="Voltar para a página inicial"
          >
            <BrandLogo size="sm" withGlow className="h-12 w-12 shrink-0 transition group-hover:scale-105 sm:h-14 sm:w-14" />
            <div className="min-w-0">
              <p className="font-label-sm text-xs font-semibold tracking-[0.2em] text-secondary uppercase">
                Guia Completo da Crônica
              </p>
              <h1 className="font-headline-lg text-2xl text-on-surface transition group-hover:text-secondary sm:text-3xl">
                Códice de Beladona
              </h1>
            </div>
          </Link>
        </header>

        <div className="grid flex-1 gap-4 md:grid-cols-2">
          {CODEX_SECTIONS.map((sec) => (
            <section key={sec.title} className="card-surface flex h-full flex-col justify-start space-y-3 p-5 sm:p-6">
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
          <span>Pronto para iniciar sua jornada? Clique no brasão para voltar ao início ou acesse sua conta.</span>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/auth/recover" className="text-secondary hover:underline">
              Recuperar senha
            </Link>
            <Link to="/auth/register" className="text-secondary hover:underline">
              Criar nova conta →
            </Link>
          </div>
        </footer>
      </div>
    </ViewportPageShell>
  )
}
