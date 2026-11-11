import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export function useReferenceNames(kind: string, fallback: readonly string[]) {
  const query = useQuery({
    queryKey: ['reference-catalog', kind],
    queryFn: () => api.listReferenceCatalog(kind),
    staleTime: 30_000,
  })
  const names = (query.data ?? []).map((row) => row.name).filter(Boolean)
  return names.length ? names : [...fallback]
}
