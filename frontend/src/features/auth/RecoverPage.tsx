import { Link } from 'react-router-dom'
import { ViewportPageShell } from '../../components/layout/ViewportPageShell'

export default function RecoverPage() {
  return (
    <ViewportPageShell>
      <form className="card-surface w-full max-w-md shrink-0 p-4 md:p-5" onSubmit={(e) => e.preventDefault()}>
        <h1 className="font-headline-md text-lg text-secondary">Recuperar Selo</h1>
        <p className="mt-1.5 text-sm leading-snug text-on-surface-variant">
          Informe o correio feudal. Enviaremos instruções se a conta existir (sem revelar e-mails alheios).
        </p>
        <label className="mt-3 block text-xs font-semibold uppercase" htmlFor="email">
          Correio feudal
        </label>
        <input id="email" type="email" className="input-feudal mt-1 pl-4" required />
        <button type="submit" className="btn-primary mt-4 w-full py-2">
          Enviar corvo
        </button>
        <Link to="/auth/login" className="mt-3 block text-center text-sm text-secondary hover:underline">
          Voltar
        </Link>
      </form>
    </ViewportPageShell>
  )
}
