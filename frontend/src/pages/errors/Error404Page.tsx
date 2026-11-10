import { ErrorPage } from '../shared'

export function Error404Page() {
  return <ErrorPage code="404" title="Página perdida nas brumas" message="Este caminho não existe na crônica." />
}
