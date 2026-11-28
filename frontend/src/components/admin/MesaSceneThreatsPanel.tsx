import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { ChronicleEntity, SceneThreat, SessionHandout } from '../../types/chronicle'
import { StatBar } from '../domain/StatBar'
import { api } from '../../services/api'
import { adminQueryKeys } from '../../lib/queryKeys'
import { CreatureCombatSheetModal } from './CreatureCombatSheetModal'

type Props = {
  sessionId: string
  live: boolean
  threats: SceneThreat[]
}

export function MesaSceneThreatsPanel({ sessionId, live, threats }: Props) {
  const qc = useQueryClient()
  const [pickId, setPickId] = useState('')
  const [hpDeltaByThreat, setHpDeltaByThreat] = useState<Record<string, string>>({})
  const [manaDeltaByThreat, setManaDeltaByThreat] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [inspectEntity, setInspectEntity] = useState<ChronicleEntity | null>(null)

  const { data: monsters = [] } = useQuery({
    queryKey: adminQueryKeys.entities('monster'),
    queryFn: () => api.adminListEntities('monster'),
  })

  const publishedMonsters = monsters.filter((m) => m.visibility === 'published')

  const invalidate = (handout: SessionHandout) => {
    setActionError(null)
    qc.setQueryData(adminQueryKeys.mesaHandout(sessionId), handout)
    void qc.invalidateQueries({ queryKey: adminQueryKeys.sceneThreats(sessionId) })
    void qc.invalidateQueries({ queryKey: ['session-scene-threats', sessionId] })
    void qc.invalidateQueries({ queryKey: ['session-live-state', sessionId] })
  }

  const addThreat = useMutation({
    mutationFn: () => api.adminAddSceneThreat(sessionId, pickId),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  })

  const applyDelta = useMutation({
    mutationFn: (threatId: string) => {
      const hpRaw = (hpDeltaByThreat[threatId] ?? '-5').trim()
      const manaRaw = (manaDeltaByThreat[threatId] ?? '0').trim()
      const hpParsed = hpRaw === '' ? undefined : Number(hpRaw)
      const manaParsed = manaRaw === '' ? undefined : Number(manaRaw)
      if ((hpParsed !== undefined && !Number.isFinite(hpParsed)) || (manaParsed !== undefined && !Number.isFinite(manaParsed))) {
        throw new Error('Informe valores numéricos válidos para Δ HP e Δ Mana.')
      }
      return api.adminApplySceneThreatDelta(sessionId, threatId, {
        hpDelta: hpParsed,
        manaDelta: manaParsed,
      })
    },
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  })

  const removeThreat = useMutation({
    mutationFn: (threatId: string) => api.adminRemoveSceneThreat(sessionId, threatId),
    onSuccess: invalidate,
    onError: (e: Error) => setActionError(e.message),
  })

  return (
    <div className="space-y-4">
      <p className="text-xs text-on-surface-variant">
        Somente o mestre que criou esta mesa pode colocar ameaças. Jogadores veem HP e mana atualizados na sala virtual.
      </p>

      {live ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-xs uppercase text-on-surface-variant">
            Monstros publicados do acervo
            <select
              className="input-feudal mt-1 w-full py-2 pl-3 text-sm normal-case"
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
            >
              <option value="">Selecionar monstro…</option>
              {publishedMonsters.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.lifeStatus === 'dead' ? ' · Morto' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary shrink-0 text-xs"
            disabled={!pickId || addThreat.isPending}
            onClick={() => addThreat.mutate()}
          >
            Colocar em cena
          </button>
        </div>
      ) : null}

      {actionError ? <p className="text-xs text-primary">{actionError}</p> : null}

      {threats.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhuma ameaça ativa na cena.</p>
      ) : (
        <ul className="space-y-4">
          {threats.map((t) => {
            const fullEntity = monsters.find((m) => m.id === t.entityId) ?? null
            return (
              <li key={t.id} className="rounded border border-outline-variant/40 bg-surface-container-lowest/40 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-serif text-lg text-on-surface">{t.name}</p>
                  <div className="flex items-center gap-2">
                    {fullEntity ? (
                      <button
                        type="button"
                        className="btn-secondary text-[10px]"
                        onClick={() => setInspectEntity(fullEntity)}
                      >
                        Ficha de dados
                      </button>
                    ) : null}
                    {live ? (
                      <button
                        type="button"
                        className="text-xs text-on-surface-variant hover:text-primary"
                        disabled={removeThreat.isPending}
                        onClick={() => removeThreat.mutate(t.id)}
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                </div>
              <StatBar label="Vitalidade" current={t.hpCurrent} max={t.hpMax} />
              <StatBar label="Mana / reserva" current={t.manaCurrent} max={Math.max(t.manaMax, 1)} variant="will" />
              {live ? (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-outline-variant/30 pt-3">
                  <label className="text-[10px] uppercase text-on-surface-variant">
                    Δ HP · ex.: -5, -140
                    <input
                      className="input-feudal mt-1 w-24 py-1 pl-2 text-sm"
                      value={hpDeltaByThreat[t.id] ?? '-5'}
                      onChange={(e) => setHpDeltaByThreat((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    />
                  </label>
                  <label className="text-[10px] uppercase text-on-surface-variant">
                    Δ Mana
                    <input
                      className="input-feudal mt-1 w-20 py-1 pl-2 text-sm"
                      value={manaDeltaByThreat[t.id] ?? '0'}
                      onChange={(e) => setManaDeltaByThreat((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={applyDelta.isPending}
                    onClick={() => applyDelta.mutate(t.id)}
                  >
                    Aplicar dano
                  </button>
                </div>
              ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <CreatureCombatSheetModal entity={inspectEntity} onClose={() => setInspectEntity(null)} />
    </div>
  )
}
