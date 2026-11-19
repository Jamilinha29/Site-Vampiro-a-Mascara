import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ViewportPageShell } from '../../components/layout/ViewportPageShell'
import { api } from '../../services/api'
import { useToast } from '../../components/ui/ToastProvider'

export default function RecoverPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const { push } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sent, setSent] = useState(false)
  const [done, setDone] = useState(false)

  const request = useMutation({
    mutationFn: () => api.requestPasswordRecovery(email.trim()),
    onSuccess: (res) => {
      setSent(true)
      push(res.message, 'info')
    },
    onError: (err: Error) => push(err.message || 'O corvo não saiu.', 'error'),
  })

  const confirm = useMutation({
    mutationFn: () => api.confirmPasswordRecovery(token, password),
    onSuccess: (res) => {
      setDone(true)
      push(res.message, 'success')
    },
    onError: (err: Error) => push(err.message || 'Não foi possível gravar o selo novo.', 'error'),
  })

  return (
    <ViewportPageShell>
      {token ? (
        <form
          className="card-surface w-full max-w-md shrink-0 p-4 md:p-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!done) confirm.mutate()
          }}
        >
          <h1 className="font-headline-md text-lg text-secondary">Selo novo</h1>
          <p className="mt-1.5 text-sm leading-snug text-on-surface-variant">
            Escolha um selo de pelo menos 8 caracteres. Depois entre com ele na porta.
          </p>
          <label className="mt-3 block text-xs font-semibold uppercase" htmlFor="password">
            Selo novo
          </label>
          <input
            id="password"
            type="password"
            minLength={8}
            className="input-feudal mt-1 pl-4"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button type="submit" className="btn-primary mt-4 w-full py-2" disabled={confirm.isPending || done}>
            {done ? 'Selo gravado' : 'Gravar selo'}
          </button>
          <Link to="/auth/login" className="mt-3 block text-center text-sm text-secondary hover:underline">
            Ir para a porta
          </Link>
        </form>
      ) : (
        <form
          className="card-surface w-full max-w-md shrink-0 p-4 md:p-5"
          onSubmit={(event) => {
            event.preventDefault()
            if (!sent) request.mutate()
          }}
        >
          <h1 className="font-headline-md text-lg text-secondary">Recuperar Selo</h1>
          <p className="mt-1.5 text-sm leading-snug text-on-surface-variant">
            Informe o correio feudal. Enviaremos instruções se a conta existir, sem revelar se o correio está cadastrado.
          </p>
          <label className="mt-3 block text-xs font-semibold uppercase" htmlFor="email">
            Correio feudal
          </label>
          <input
            id="email"
            type="email"
            className="input-feudal mt-1 pl-4"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" className="btn-primary mt-4 w-full py-2" disabled={request.isPending || sent}>
            {sent ? 'Corvo enviado' : 'Enviar corvo'}
          </button>
          <Link to="/auth/login" className="mt-3 block text-center text-sm text-secondary hover:underline">
            Voltar
          </Link>
        </form>
      )}
    </ViewportPageShell>
  )
}
