import { ErrorPage } from '../shared'

export function Error500Page() {
  return <ErrorPage code="500" title="Falha no conclave" message="Erro interno. Tente novamente em instantes." />
}
