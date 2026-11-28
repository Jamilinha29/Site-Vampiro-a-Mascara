import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useToast } from '../ui/useToast'

const approvalLabel: Record<string, string> = {
  draft: 'Rascunho',
  submitted: 'Aguardando',
  changes: 'Ajustes pedidos',
  approved: 'Aprovada',
}

export function AdminCharacterReviews() {
  const { push } = useToast()
  const queryClient = useQueryClient()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-character-reviews'],
    queryFn: () => api.adminListCharacterReviews(),
  })
  const review = useMutation({
    mutationFn: (input: { email: string; characterId: string; status: 'approved' | 'changes'; note?: string }) =>
      api.adminReviewCharacter(input.email, input.characterId, { status: input.status, note: input.note }),
    onSuccess: async (_row, input) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-character-reviews'] })
      push(input.status === 'approved' ? 'Ficha aprovada.' : 'Pedido de ajuste enviado.', 'success')
    },
    onError: (err: Error) => push(err.message || 'Não foi possível revisar a ficha.', 'error'),
  })

  const pending = data.filter((row) => row.approval === 'submitted' || row.approval === 'changes')

  return (
    <section className="admin-form-panel flex h-full flex-col">
      <h2 className="font-label-sm text-xs text-secondary uppercase">Fichas enviadas</h2>
      <p className="text-sm text-on-surface-variant">
        {pending.length === 0
          ? 'Nenhuma ficha esperando decisão.'
          : `${pending.length} ${pending.length === 1 ? 'ficha ainda pede' : 'fichas ainda pedem'} uma decisão.`}
      </p>
      {isLoading ? <p className="mt-2 text-sm text-on-surface-variant">Carregando fichas…</p> : null}
      <ul className="mt-2 max-h-96 flex-1 space-y-3 overflow-y-auto">
        {data.map((row) => {
          const key = `${row.email}:${row.characterId}`
          return (
            <li key={key} className="rounded-lg border border-white/10 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-serif text-on-surface">
                  {row.name}{' '}
                  <span className="text-xs text-on-surface-variant">
                    nv. {row.level}
                    {row.clan ? ` · ${row.clan}` : ''}
                    {row.subclass ? ` · ${row.subclass}` : ''}
                    {row.secondarySubclass ? ` / ${row.secondarySubclass}` : ''}
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  {row.needsRuleReview ? (
                    <span className="rounded border border-primary/50 bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase text-primary">
                      Revisão de regra
                    </span>
                  ) : null}
                  <span className="text-xs uppercase tracking-wide text-secondary">
                    {approvalLabel[row.approval ?? 'draft']}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">
                Jogador: {row.displayName}{row.playerId ? ` · ${row.playerId}` : ''}
              </p>
              {row.ruleReviewNote ? <p className="mt-1 text-xs text-primary">{row.ruleReviewNote}</p> : null}
              {row.reviewNote ? <p className="mt-2 text-sm text-on-surface-variant">{row.reviewNote}</p> : null}
              <label className="mt-3 block text-xs text-on-surface-variant">
                Nota para o jogador
                <input
                  className="input-feudal mt-1 w-full"
                  value={notes[key] ?? ''}
                  maxLength={500}
                  onChange={(event) => setNotes((current) => ({ ...current, [key]: event.target.value }))}
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary text-xs"
                  disabled={review.isPending || row.approval === 'approved'}
                  onClick={() =>
                    review.mutate({
                      email: row.email,
                      characterId: row.characterId,
                      status: 'approved',
                      note: notes[key],
                    })
                  }
                >
                  Aprovar
                </button>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate({
                      email: row.email,
                      characterId: row.characterId,
                      status: 'changes',
                      note: notes[key],
                    })
                  }
                >
                  Pedir ajuste
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
