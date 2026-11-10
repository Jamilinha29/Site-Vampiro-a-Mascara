import { Link } from 'react-router-dom'

export default function RecoverPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-lowest px-4">
      <form className="card-surface w-full max-w-md p-6" onSubmit={(e) => e.preventDefault()}>
        <h1 className="font-headline-md text-xl text-secondary">Recuperar Selo</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Informe o correio feudal. Enviaremos instruções se a conta existir (sem revelar e-mails alheios).
        </p>
        <label className="mt-4 block text-xs font-semibold uppercase" htmlFor="email">
          Correio feudal
        </label>
        <input id="email" type="email" className="input-feudal mt-1 pl-4" required />
        <button type="submit" className="btn-primary mt-6 w-full">
          Enviar corvo
        </button>
        <Link to="/auth/login" className="mt-4 block text-center text-sm text-secondary hover:underline">
          Voltar
        </Link>
      </form>
    </div>
  )
}
