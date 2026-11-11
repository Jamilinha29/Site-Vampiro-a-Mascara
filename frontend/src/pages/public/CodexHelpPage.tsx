import { Link } from 'react-router-dom'
import { ViewportPageShell } from '../../components/layout/ViewportPageShell'

export default function CodexHelpPage() {
  return (
    <ViewportPageShell>
      <div className="card-surface w-full max-w-2xl shrink-0 p-4 text-on-surface md:p-6">
        <h1 className="font-headline-lg text-xl text-secondary">Códice de Acesso</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          Use seu correio feudal (e-mail) e selo secreto fornecidos na inscrição. Após cadastro, confirme o corvo
          mensageiro de verificação antes de entrar na mesa. Narradores distribuem códigos de sala válidos apenas para
          convidados autorizados.
        </p>
        <Link to="/auth/login" className="btn-primary mt-5 inline-flex py-2">
          Voltar ao portal
        </Link>
      </div>
    </ViewportPageShell>
  )
}
