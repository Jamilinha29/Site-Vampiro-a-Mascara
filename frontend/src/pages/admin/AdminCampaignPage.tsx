import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'
import { useToast } from '../../components/ui/ToastProvider'

const kinds = [
  { id: 'mystery', label: 'Mistério' },
  { id: 'mission', label: 'Missão' },
  { id: 'npc', label: 'NPC' },
  { id: 'place', label: 'Local' },
  { id: 'pending', label: 'Pendência' },
] as const

export default function AdminCampaignPage() {
  const { push } = useToast()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [kind, setKind] = useState<(typeof kinds)[number]['id']>('mystery')
  const [status, setStatus] = useState<'confirmed' | 'proposed' | 'pending'>('pending')
  const [maxLevel, setMaxLevel] = useState(10)
  const [subclassLevel, setSubclassLevel] = useState(5)
  const [secondarySubclassLevel, setSecondarySubclassLevel] = useState(7)
  const [startingXp, setStartingXp] = useState(0)
  const [shopBudgetCopper, setShopBudgetCopper] = useState(0)
  const [affected, setAffected] = useState<Array<{ name: string; reason: string }>>([])
  const [sessionId, setSessionId] = useState('')
  const [entityId, setEntityId] = useState('')
  const [secret, setSecret] = useState('')
  const [audienceEmail, setAudienceEmail] = useState('')

  const board = useQuery({ queryKey: ['campaign-board'], queryFn: () => api.adminListBoard() })
  const rules = useQuery({
    queryKey: ['campaign-rules'],
    queryFn: () => api.adminGetRules(),
  })
  const sessions = useQuery({ queryKey: ['admin-sessions'], queryFn: () => api.adminListScheduledSessions() })
  const secrets = useQuery({ queryKey: ['campaign-secrets'], queryFn: () => api.adminListSecrets() })

  const addCard = useMutation({
    mutationFn: () => api.adminAddBoardCard({ kind, title, status, detail, owner: '', priority: 'media' }),
    onSuccess: async () => {
      setTitle('')
      setDetail('')
      await queryClient.invalidateQueries({ queryKey: ['campaign-board'] })
      push('Cartão guardado.', 'success')
    },
    onError: (error: Error) => push(error.message, 'error'),
  })
  const saveRules = useMutation({
    mutationFn: (decision: 'keep-existing' | 'mark-review') =>
      api.adminSaveRules({
        maxLevel,
        subclassLevel,
        secondarySubclassLevel,
        startingXp,
        shopBudgetCopper,
        decision,
      }),
    onSuccess: async (result) => {
      setAffected(result.affected)
      await queryClient.invalidateQueries({ queryKey: ['campaign-rules'] })
      push('Regra gravada. As fichas existentes não tiveram nível nem XP alterados.', 'success')
    },
    onError: (error: Error) => push(error.message, 'error'),
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-headline-lg text-2xl text-on-surface">Campanha</h1>
        <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
          Mistérios, missões, locais e pendências da crônica. Confirmado é regra da mesa. Proposto ainda é ideia.
        </p>
      </header>

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-3 lg:items-stretch">
        <section className="card-surface flex h-full flex-col space-y-3 p-5">
          <h2 className="text-xs uppercase tracking-wide text-secondary">Novo cartão</h2>
          <p className="text-sm text-on-surface-variant">
            Registre pistas, missões, locais ou pendências para consulta rápida durante os atos.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="input-feudal pl-3" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              {kinds.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <select className="input-feudal pl-3" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="pending">Pendente</option>
              <option value="proposed">Proposto</option>
              <option value="confirmed">Confirmado</option>
            </select>
            <input
              className="input-feudal pl-3 sm:col-span-2"
              placeholder="Título"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <textarea
            className="input-feudal min-h-24 w-full flex-1 pl-3"
            placeholder="Detalhe"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-xs" disabled={!title.trim() || addCard.isPending} onClick={() => addCard.mutate()}>
              Guardar cartão
            </button>
          </div>
          {(board.data ?? []).length > 0 ? (
            <ul className="max-h-36 space-y-2 overflow-y-auto pr-1">
              {(board.data ?? []).map((card) => (
                <li key={card.id} className="flex flex-wrap items-start justify-between gap-2 rounded border border-white/10 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-on-surface">{card.title}</p>
                    <p className="text-xs uppercase text-secondary">
                      {card.kind} · {card.status}
                    </p>
                    {card.detail ? <p className="mt-1 text-sm text-on-surface-variant">{card.detail}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => void api.adminRemoveBoardCard(card.id).then(() => queryClient.invalidateQueries({ queryKey: ['campaign-board'] }))}
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-auto text-xs text-on-surface-variant">
              Nenhum cartão registrado ainda. Os cartões salvos ficam listados aqui.
            </p>
          )}
        </section>

        <section className="card-surface flex h-full flex-col space-y-3 p-5">
          <h2 className="text-xs uppercase tracking-wide text-secondary">Regras da campanha</h2>
          <p className="text-sm text-on-surface-variant">
            Versão atual: {rules.data?.version ?? 1}. Nível máximo {rules.data?.maxLevel ?? 10}. Subclasse I no nível{' '}
            {rules.data?.subclassLevel ?? 5}. Subclasse II no nível 7.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-on-surface-variant">
              Nível máximo
              <input className="input-feudal mt-1 w-full pl-3" type="number" min={1} max={10} value={maxLevel} onChange={(event) => setMaxLevel(Number(event.target.value))} />
            </label>
            <label className="text-xs text-on-surface-variant">
              Subclasse I (nível)
              <input className="input-feudal mt-1 w-full pl-3" type="number" min={1} max={10} value={subclassLevel} onChange={(event) => setSubclassLevel(Number(event.target.value))} />
            </label>
            <label className="text-xs text-on-surface-variant">
              Subclasse II (nível)
              <input className="input-feudal mt-1 w-full pl-3" type="number" min={1} max={10} value={secondarySubclassLevel} onChange={(event) => setSecondarySubclassLevel(Number(event.target.value))} />
            </label>
            <label className="text-xs text-on-surface-variant">
              XP inicial (novas fichas)
              <input className="input-feudal mt-1 w-full pl-3" type="number" min={0} max={10000} value={startingXp} onChange={(event) => setStartingXp(Number(event.target.value))} />
            </label>
            <label className="text-xs text-on-surface-variant sm:col-span-2">
              Teto de bronze (loja)
              <input className="input-feudal mt-1 w-full pl-3" type="number" min={0} max={1000000} value={shopBudgetCopper} onChange={(event) => setShopBudgetCopper(Number(event.target.value))} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-xs" onClick={() => saveRules.mutate('keep-existing')}>
              Guardar e manter as fichas
            </button>
            <button type="button" className="btn-secondary text-xs" onClick={() => saveRules.mutate('mark-review')}>
              Guardar e pedir revisão das afetadas
            </button>
          </div>
          {affected.length > 0 ? (
            <ul className="max-h-36 overflow-y-auto text-sm text-on-surface-variant">
              {affected.map((row) => (
                <li key={`${row.name}${row.reason}`}>
                  {row.name}: {row.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-auto text-xs text-on-surface-variant">Nenhuma ficha foi reescrita. A lista acima aparece quando alguma ficaria fora da regra nova.</p>
          )}
        </section>

        <section className="card-surface flex h-full flex-col space-y-3 p-5">
          <h2 className="text-xs uppercase tracking-wide text-secondary">Segredo por mesa</h2>
          <p className="text-sm text-on-surface-variant">
            O texto só entra na resposta de quem está sentado nessa mesa. Um e-mail preenche a revelação individual. Vazio vale para a mesa inteira.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="input-feudal pl-3" value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
              <option value="">Mesa</option>
              {(sessions.data ?? []).map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title}
                </option>
              ))}
            </select>
            <input className="input-feudal pl-3" placeholder="Id do NPC" value={entityId} onChange={(event) => setEntityId(event.target.value)} />
            <input className="input-feudal pl-3 sm:col-span-2" placeholder="E-mail do jogador (opcional)" value={audienceEmail} onChange={(event) => setAudienceEmail(event.target.value)} />
            <textarea
              className="input-feudal min-h-20 w-full flex-1 pl-3 sm:col-span-2"
              placeholder="O que essa mesa descobriu"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={!sessionId || !entityId || !secret.trim()}
              onClick={() =>
                void api
                  .adminAddSecret({ sessionId, entityId, text: secret, audienceEmail: audienceEmail || null })
                  .then(async () => {
                    setSecret('')
                    await queryClient.invalidateQueries({ queryKey: ['campaign-secrets'] })
                    push('Segredo guardado para essa mesa.', 'success')
                  })
                  .catch((error: Error) => push(error.message, 'error'))
              }
            >
              Guardar segredo
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={!sessionId}
              onClick={() =>
                void api.adminAdvanceTurn(sessionId).then((result) => push(`Turno avançado. ${result.changed} efeito(s) contado(s).`, 'success'))
              }
            >
              Avançar um turno nesta mesa
            </button>
          </div>
          {(secrets.data ?? []).length > 0 ? (
            <ul className="max-h-28 space-y-2 overflow-y-auto text-sm text-on-surface-variant">
              {(secrets.data ?? []).map((row) => (
                <li key={row.id}>
                  Mesa {row.sessionId.slice(0, 8)} · NPC {row.entityId.slice(0, 8)} · {row.audienceEmail || 'mesa inteira'} — {row.text}
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-auto text-xs text-on-surface-variant">
            No item, escreva “3 turnos” ou “30 minutos” no texto de atributos. O tempo só começa quando o item sai da bolsa.
          </p>
        </section>
      </div>
    </div>
  )
}
