import { Link } from 'react-router-dom'

export default function CodexHelpPage() {
  return (
    <div className="min-h-screen bg-surface-container-lowest px-4 py-12 text-on-surface">
      <div className="mx-auto max-w-2xl card-surface p-8">
        <h1 className="font-headline-lg text-2xl text-secondary">Códice de Acesso</h1>
        <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
          Use seu correio feudal (e-mail) e selo secreto fornecidos na inscrição. Após cadastro, confirme o
          corvo mensageiro de verificação antes de entrar na mesa. Narradores distribuem códigos de sala
          válidos apenas para convidados autorizados.
        </p>
        <Link to="/auth/login" className="btn-primary mt-8 inline-flex">
          Voltar ao portal
        </Link>
      </div>
    </div>
  )
}
