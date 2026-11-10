import { ErrorPage } from '../shared'

export function Error403Page() {
  return <ErrorPage code="403" title="Passagem negada" message="Você não possui permissão para este domínio." />
}
