import { Link } from 'react-router-dom'
import { BrandLogo } from '../../components/brand/BrandLogo'
import { ViewportPageShell } from '../../components/layout/ViewportPageShell'

const CODEX_SECTIONS = [
  {
    icon: 'vpn_key',
    title: '1. Acesso, conta e segurança',
    items: [
      'Entre com e-mail e senha ou conecte sua conta pelo login com Google na porta da crônica (incluindo o portal ADM para narradores).',
      'Esqueceu sua senha? Use Recuperação de senha na tela de login ou em Configurações para receber o link de redefinição no seu e-mail.',
      'Em Configurações você personaliza foto de perfil, banner, nome exibido, @handle, biografia, feudo de origem, visibilidade e preferências de aviso.',
    ],
  },
  {
    icon: 'badge',
    title: '2. Fichas, espécies e evolução',
    items: [
      'Forje personagens no grimório de 6 etapas escolhendo espécie (Vampiros, Caçadores ou Outras espécies com aprovação do narrador), clã e orientação de fé (Luz ou Trevas).',
      'Distribua atributos, virtudes, perícias e habilidades criadas; itens equipados no inventário aplicam bônus automáticos em Vida, Mana e Defesa (CA).',
      'A progressão vai do nível 0 ao 10, desbloqueando a Subclasse I no nível 5 e a Subclasse II no nível 7. Envie a ficha pronta para revisão do mestre.',
    ],
  },
  {
    icon: 'casino',
    title: '3. Sessões e mesa ao vivo',
    items: [
      'Busque mesas públicas diretamente ou entre em mesas privadas com o código da sala fornecido pelo narrador (pedido novamente se você sair da mesa).',
      'Confirme sua participação na sessão agendada para liberar a entrada na Mesa ao Vivo assim que o horário chegar e a sala for aberta.',
      'Durante a cena você rola dados abertos ou secretos, declara ações, acompanha ameaças ativas, troca de personagem e respeita o modo descanso.',
    ],
  },
  {
    icon: 'storefront',
    title: '4. Moedas, Mercado e Ferreiro',
    items: [
      'Sua carteira acompanha saldos em ouro, prata e bronze com extrato completo de entradas concedidas pelo narrador e compras realizadas.',
      'No Mercado da crônica você adquire equipamentos, consumíveis e serviços com estoque controlado e proteção contra compras duplicadas.',
      'Dentro da mesa ao vivo, o Ferreiro oferece comércio imediato e leilões em tempo real onde você pode registrar ou retirar lances.',
    ],
  },
  {
    icon: 'menu_book',
    title: '5. Glossário, Bestiário e Arquivos',
    items: [
      'O Glossário reúne grimórios, amuletos e relíquias publicados; o Bestiário organiza criaturas e antagonistas por camadas: Conhecidas, Classificado e Rumores.',
      'Em Arquivos ficam os Acontecimentos Passados com resumo narrativo, mortes e feitos de cada ato encerrado na campanha.',
      'Também em Arquivos você baixa fichas oficiais imprimíveis por espécie (Vampiro, Mortal e Outras espécies) e os livros dos clãs organizados no Compêndio.',
    ],
  },
  {
    icon: 'group',
    title: '6. Alianças, conquistas e suporte',
    items: [
      'Cada conta recebe um Código ID numérico exclusivo de 10 dígitos exibido no Perfil para facilitar conexões com outros jogadores e mestres.',
      'Em Alianças você busca jogadores e narradores por nome, @handle ou Código ID; mesas privadas de aliados ficam visíveis na sua busca de sessões.',
      'No Perfil você consulta o mural de conquistas e o gráfico radar da ficha. Para suporte técnico ou dúvidas de acesso, use a seção de Suporte na Home.',
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
                Guia Completo da Crônica
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
            <a href="/#suporte" className="btn-secondary px-4 py-2 text-xs sm:text-sm">
              Suporte e contatos
            </a>
            <Link to="/auth/login" className="btn-primary px-4 py-2 text-xs sm:text-sm">
              Entrar na crônica
            </Link>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          {CODEX_SECTIONS.map((sec) => (
            <section key={sec.title} className="card-surface space-y-3 p-5">
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
          <span>Dúvidas sobre códigos de sala, revisão de ficha ou suporte? Fale com seu narrador ou acesse nossa central.</span>
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
