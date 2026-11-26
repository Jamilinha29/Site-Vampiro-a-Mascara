import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { StatBar } from '../domain/StatBar'
import { CreatedSkillsPanel } from '../characters/CreatedSkillsPanel'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'
import { useAuthStore } from '../../stores/authStore'
import { mesaDisplayName } from '../../lib/mesaSession'
import { FerreiroPanel } from './FerreiroPanel'
import { SessionTableInfoPanel } from './SessionTableInfoPanel'
import { DEFAULT_CHRONICLE_AMBIENCE, EXTERNAL_MAP_NOTICE, formatAmbienceChip } from '../../lib/chronicleAmbience'
import { useToast } from '../ui/ToastProvider'
import { resolveResourceProfile } from '../../lib/characterSheetKind'
import {
  computeArmorClass,
  isSessionDead,
  parseStatsLabel,
  setSessionDead,
  sumEquippedBonuses,
} from '../../lib/equipmentMods'
import type { CreatedSkill, ProfileCharacterSummary } from '../../types/profile'
import type { SceneThreat } from '../../types/chronicle'

const EMPTY_THREATS: SceneThreat[] = []

type Props = {
  sessionId: string
}

export function PlayerSessionWorkbench({ sessionId }: Props) {
  const auth = useAuthStore((s) => s.session)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { push } = useToast()
  const [elapsed, setElapsed] = useState('00h 00m')
  const [replaceId, setReplaceId] = useState('')
  const [declareText, setDeclareText] = useState('')
  const [usedLog, setUsedLog] = useState<string[]>([])
  const [skillBusy, setSkillBusy] = useState(false)
  const [damageInput, setDamageInput] = useState(5)
  const [vitalsBusy, setVitalsBusy] = useState(false)
  const [deadTick, setDeadTick] = useState(0)

  const { data: scheduled = [] } = useQuery({
    queryKey: playerQueryKeys.scheduledSessions,
    queryFn: () => api.getScheduledSessions(),
  })
  const { data: profile } = useQuery({
    queryKey: playerQueryKeys.profile,
    queryFn: () => api.getMeProfile(),
  })
  const session = scheduled.find((s) => s.id === sessionId)
  const isLive = session?.status === 'open'

  const { data: liveState } = useQuery({
    queryKey: ['session-live-state', sessionId],
    queryFn: () => api.getSessionLiveState(sessionId),
    refetchInterval: isLive ? 10_000 : false,
    refetchIntervalInBackground: false,
  })
  const threats = liveState?.threats ?? EMPTY_THREATS
  const liveBrief = liveState?.liveBrief ?? null
  const myBag = liveState?.myBag
  const persistedActions = liveState?.actions ?? []
  const sessionRolls = liveState?.rolls ?? []

  const seat = session?.mySeat ?? session?.seats?.find((s) => s.email === auth?.email && !s.leftAt)
  const character: ProfileCharacterSummary | undefined =
    profile?.characters.find((c) => c.id === seat?.characterId) ??
    profile?.characters.find((c) => c.isPrimary) ??
    profile?.characters[0]

  const leave = useMutation({
    mutationFn: () => api.leaveSession(sessionId),
    onSuccess: () => {
      push('Saiu da sala. Use o código para voltar.', 'success')
      void qc.invalidateQueries({ queryKey: playerQueryKeys.scheduledSessions })
      navigate('/user/sessions')
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const replaceChar = useMutation({
    mutationFn: (characterId: string) => api.replaceSessionCharacter(sessionId, characterId),
    onSuccess: () => {
      push('Personagem da sessão atualizado.', 'success')
      void qc.invalidateQueries({ queryKey: playerQueryKeys.scheduledSessions })
      void qc.invalidateQueries({ queryKey: playerQueryKeys.profile })
      setReplaceId('')
    },
    onError: (e: Error) => push(e.message, 'error'),
  })

  const chronicle = session ? mesaDisplayName(session) : 'Crônica'
  const ambience = liveBrief?.chronicleAmbience ?? DEFAULT_CHRONICLE_AMBIENCE
  const restMode = liveBrief?.restMode ?? false
  const teatroText =
    liveBrief?.narrativeSummary?.trim() ||
    'A cena se desenrola conforme a voz do narrador. Aguarde o texto do Teatro da mente na mesa ao vivo.'
  const resources = resolveResourceProfile(character?.species)
  const skills = character?.createdSkills ?? []

  useEffect(() => {
    const key = `player-mesa-t0-${sessionId}`
    let start = Number(sessionStorage.getItem(key))
    if (!start) {
      start = Date.now()
      sessionStorage.setItem(key, String(start))
    }
    const tick = () => {
      const mins = Math.floor((Date.now() - start) / 60_000)
      setElapsed(`${String(Math.floor(mins / 60)).padStart(2, '0')}h ${String(mins % 60).padStart(2, '0')}m`)
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [sessionId])

  useEffect(() => {
    if (!character) return
    if (character.hp.current <= 0 && !isSessionDead(sessionId, character.id)) {
      setSessionDead(sessionId, character.id, true)
      setDeadTick((n) => n + 1)
    }
  }, [character, sessionId])

  const initiative = useMemo(() => {
    const rows: { label: string; kind: 'pc' | 'npc' }[] = []
    if (character) rows.push({ label: character.name, kind: 'pc' })
    for (const t of threats) rows.push({ label: t.name, kind: 'npc' })
    return rows
  }, [character, threats])

  const dead =
    !!character && (isSessionDead(sessionId, character.id) || character.hp.current <= 0)
  // re-render when death flag flips
  void deadTick

  async function saveSkills(next: CreatedSkill[]) {
    if (!character || dead) return
    setSkillBusy(true)
    try {
      await api.patchMeCharacter(character.id, {
        createdSkills: next,
        expectedRevision: character.sheetRevision,
      })
      void qc.invalidateQueries({ queryKey: playerQueryKeys.profile })
      push('Habilidades salvas na ficha.', 'success')
    } catch (e) {
      push(e instanceof Error ? e.message : 'Falha ao salvar habilidades', 'error')
    } finally {
      setSkillBusy(false)
    }
  }

  async function recordAction(
    kind: 'declaration' | 'skill' | 'damage' | 'potion' | 'turn_end',
    summary: string,
    detail?: string,
  ) {
    setUsedLog((prev) => [summary, ...prev].slice(0, 8))
    try {
      await api.postSessionAction(sessionId, {
        characterId: character?.id,
        characterName: character?.name,
        kind,
        summary,
        detail,
      })
      void qc.invalidateQueries({ queryKey: ['session-live-state', sessionId] })
    } catch {
      /* ação local já registrada caso rede oscile */
    }
  }

  async function activateSkill(skill: CreatedSkill) {
    if (!character || dead) {
      push('Personagem morto nesta sessão — ficha inutilizável.', 'error')
      return
    }
    const cost = Math.max(0, skill.manaCost ?? 0)
    const manaPool = character.mana
    if (cost > 0) {
      if (!manaPool) {
        push('Esta espécie não usa mana para habilidades.', 'error')
        return
      }
      if (manaPool.current < cost) {
        push(`Mana insuficiente (${manaPool.current}/${manaPool.max}). Precisa de ${cost}.`, 'error')
        return
      }
      setVitalsBusy(true)
      try {
        await api.patchMeCharacter(character.id, {
          mana: { current: manaPool.current - cost, max: manaPool.max },
          expectedRevision: character.sheetRevision,
        })
        void qc.invalidateQueries({ queryKey: playerQueryKeys.profile })
      } catch (e) {
        push(e instanceof Error ? e.message : 'Falha ao gastar mana', 'error')
        setVitalsBusy(false)
        return
      } finally {
        setVitalsBusy(false)
      }
    }
    const mod = skill.attributeMod >= 0 ? `+${skill.attributeMod}` : `${skill.attributeMod}`
    const manaBit = cost > 0 ? ` · −${cost} mana` : ''
    const line = `${character.name} usou ${skill.name} (${skill.die} · ${skill.attribute} ${mod}${manaBit})`
    await recordAction('skill', line)
    push(line, 'success')
  }

  async function applyDamage(amount: number) {
    if (!character || dead) return
    const dmg = Math.max(0, Math.floor(amount))
    if (!dmg) return
    const nextHp = Math.max(0, character.hp.current - dmg)
    setVitalsBusy(true)
    try {
      await api.patchMeCharacter(character.id, {
        hp: { current: nextHp, max: character.hp.max },
        expectedRevision: character.sheetRevision,
      })
      void qc.invalidateQueries({ queryKey: playerQueryKeys.profile })
      const line = `${character.name} sofreu ${dmg} de dano → ${nextHp}/${character.hp.max}`
      await recordAction('damage', line)
      if (nextHp <= 0) {
        setSessionDead(sessionId, character.id, true)
        setDeadTick((n) => n + 1)
        push('Vitalidade em 0 — personagem morto nesta sessão. Ficha inutilizável até a próxima.', 'error')
      } else {
        push(line, 'success')
      }
    } catch (e) {
      push(e instanceof Error ? e.message : 'Falha ao aplicar dano', 'error')
    } finally {
      setVitalsBusy(false)
    }
  }

  async function consumePotion(itemId: string) {
    if (!character || dead) {
      push('Personagem morto — não pode usar poções nesta sessão.', 'error')
      return
    }
    const item = (character.inventory ?? []).find((i) => i.id === itemId)
    if (!item) return
    const mods = parseStatsLabel(item.statsLabel)
    const healHp = mods.hp > 0 ? mods.hp : /cura|vitalidade|vida|hp/i.test(`${item.name} ${item.description ?? ''}`) ? 10 : 0
    const restoreMana =
      mods.mana > 0 ? mods.mana : /mana|energia|glamour/i.test(`${item.name} ${item.description ?? ''}`) ? 10 : 0

    if (!healHp && !restoreMana) {
      push('Este item não recupera vida nem mana (defina statsLabel, ex.: +10 mana).', 'error')
      return
    }

    const nextHp = Math.min(character.hp.max, character.hp.current + healHp)
    const nextMana = character.mana
      ? { current: Math.min(character.mana.max, character.mana.current + restoreMana), max: character.mana.max }
      : undefined
    const nextInventory = (character.inventory ?? []).filter((i) => i.id !== itemId)

    setVitalsBusy(true)
    try {
      await api.patchMeCharacter(character.id, {
        hp: { current: nextHp, max: character.hp.max },
        mana: nextMana,
        inventory: nextInventory,
        expectedRevision: character.sheetRevision,
      })
      void qc.invalidateQueries({ queryKey: playerQueryKeys.profile })
      const bits = [
        healHp ? `+${healHp} vida` : null,
        restoreMana ? `+${restoreMana} mana` : null,
      ].filter(Boolean)
      const msg = `Usou ${item.name} (${bits.join(', ')})`
      await recordAction('potion', msg)
      push(msg, 'success')
    } catch (e) {
      push(e instanceof Error ? e.message : 'Falha ao usar poção', 'error')
    } finally {
      setVitalsBusy(false)
    }
  }

  const rewards = myBag?.rewards ?? []
  const will = character?.will ?? { current: 4, max: 5 }
  const blood = character?.blood ?? { current: 8, max: 10 }
  const mana = character?.mana ?? { current: 8, max: 10 }
  const bonuses = sumEquippedBonuses(character?.inventory)
  const ca = character ? computeArmorClass(character, bonuses) : { base: 10, bonus: 0, total: 10 }
  const potions = (character?.inventory ?? []).filter(
    (i) =>
      i.category === 'elixir' ||
      /mana|cura|vitalidade|poção|pocao|elixir/i.test(`${i.name} ${i.statsLabel ?? ''}`),
  )

  return (
    <div className="space-y-4 pb-28">
      <header className="mesa-panel overflow-hidden">
        <div className="px-4 py-4 sm:px-6">
          <p className="font-label-sm text-[0.65rem] text-primary uppercase tracking-[0.2em]">{chronicle}</p>
          <h1 className="font-headline-lg mt-1 text-xl text-on-surface sm:text-2xl">Sessão ao vivo</h1>
          <button type="button" className="btn-secondary mt-2 text-xs no-print" onClick={() => window.print()}>
            Imprimir resumo
          </button>
          <p className="mt-1 text-sm text-on-surface-variant">
            Narrador · <span className="text-secondary">{session?.narratorName ?? session?.narratorEmail ?? 'Narrador'}</span>
            {session ? (
              <>
                <span className="mx-2 text-outline-variant">·</span>
                {new Date(session.scheduledAt).toLocaleString('pt-BR')}
              </>
            ) : null}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SessionChip icon="schedule">Tempo · {elapsed}</SessionChip>
            <SessionChip icon="cloud">{formatAmbienceChip(ambience)}</SessionChip>
            <SessionChip icon="landscape">{ambience.environment}</SessionChip>
          </div>
        </div>
        <div
          className={`border-t px-4 py-2 text-xs sm:px-6 ${
            restMode
              ? 'border-secondary/30 bg-secondary/10 text-secondary'
              : 'border-outline-variant/30 bg-surface-container-low/50 text-on-surface-variant'
          }`}
        >
          {restMode
            ? 'Modo descanso — mesa pausada; combate e feira restritos.'
            : 'Descanso desativado — combate e perigo ativos conforme o mestre.'}
        </div>
      </header>

      {session ? <SessionTableInfoPanel session={session} /> : null}

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-3 lg:items-stretch">
        <SessionPanel title="Ficha na sessão" icon="person" className="h-full">
          {character ? (
            <div className={`space-y-3 ${dead ? 'opacity-60' : ''}`}>
              {dead ? (
                <p className="rounded border border-primary/50 bg-primary/15 px-3 py-2 text-xs text-primary">
                  Morto nesta sessão (vitalidade 0). Ficha inutilizável até a próxima sessão.
                </p>
              ) : null}
              <div className="flex gap-4">
                <div className="flex h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded border border-secondary/40 bg-surface-container-high">
                  {character.portraitUrl ? (
                    <img src={character.portraitUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-3xl text-outline">
                      face
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-serif text-lg text-on-surface">{character.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {character.species}
                    {character.clan ? ` · ${character.clan}` : ''} · Nv {character.level}
                  </p>
                  {resources.showHp ? (
                    <StatBar
                      label="Vitalidade"
                      current={character.hp.current}
                      max={character.hp.max}
                      bonus={bonuses.hp}
                    />
                  ) : null}
                  {resources.showBlood ? (
                    <StatBar label="Pontos de sangue" current={blood.current} max={blood.max} variant="blood" />
                  ) : null}
                  {resources.showMana ? (
                    <StatBar
                      label={resources.manaLabel}
                      current={mana.current}
                      max={mana.max}
                      bonus={bonuses.mana}
                      variant="mana"
                    />
                  ) : null}
                  {resources.showWill ? (
                    <StatBar label="Força de vontade" current={will.current} max={will.max} variant="will" />
                  ) : null}
                  <StatBar
                    label="Classe de armadura (CA)"
                    current={ca.total}
                    max={Math.max(ca.total, ca.base + Math.abs(ca.bonus), 20)}
                    bonus={ca.bonus}
                    variant="defense"
                  />
                </div>
              </div>

              {!dead ? (
                <div className="space-y-2 rounded border border-outline-variant/35 bg-surface-container-lowest/40 p-3">
                  <p className="text-xs font-semibold tracking-wider text-secondary uppercase">Combate & recuperação</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs uppercase text-on-surface-variant">
                      Dano recebido
                      <input
                        type="number"
                        min={1}
                        className="input-feudal mt-1 w-20 pl-3"
                        value={damageInput}
                        onChange={(e) => setDamageInput(Math.max(1, Number(e.target.value) || 1))}
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      disabled={vitalsBusy}
                      onClick={() => void applyDamage(damageInput)}
                    >
                      Aplicar dano
                    </button>
                  </div>
                  {potions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {potions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="btn-secondary text-xs"
                          disabled={vitalsBusy}
                          onClick={() => void consumePotion(p.id)}
                        >
                          Usar {p.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant">
                      Sem poções na bolsa. Mana em 0 só se recupera com poção/equipamento.
                    </p>
                  )}
                </div>
              ) : null}

              <SessionRollBox
                sessionId={sessionId}
                characterName={character.name}
                rolls={sessionRolls}
                onRolled={() => void qc.invalidateQueries({ queryKey: ['session-live-state', sessionId] })}
              />

              <div className="flex flex-wrap gap-2">
                <Link to={`/user/characters/${character.id}?view=ficha`} className="btn-secondary text-xs">
                  Abrir ficha completa
                </Link>
                <select
                  className="input-feudal min-w-[9rem] flex-1 pl-3 text-xs normal-case"
                  value={replaceId}
                  onChange={(e) => setReplaceId(e.target.value)}
                  disabled={dead}
                >
                  <option value="">Substituir personagem…</option>
                  {(profile?.characters ?? [])
                    .filter((c) => c.id !== character.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={dead || !replaceId || replaceChar.isPending}
                  onClick={() => replaceChar.mutate(replaceId)}
                >
                  Trocar
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">
              <Link to="/user/characters/new/lineage" className="text-secondary underline">
                Crie um personagem
              </Link>{' '}
              para usar a ficha na sessão.
            </p>
          )}
        </SessionPanel>

        <SessionPanel title="Habilidades" icon="auto_awesome" className="h-full">
          {character && !dead ? (
            <CreatedSkillsPanel
              skills={skills}
              busy={skillBusy || vitalsBusy}
              compact
              onChange={saveSkills}
              onUse={(s) => void activateSkill(s)}
            />
          ) : character && dead ? (
            <p className="text-sm text-primary">Habilidades bloqueadas — personagem morto nesta sessão.</p>
          ) : (
            <p className="text-sm text-on-surface-variant">Sem personagem ativo.</p>
          )}
        </SessionPanel>

        <SessionPanel title="Iniciativa" icon="format_list_numbered" className="h-full">
          {initiative.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Aguardando ordem do mestre.</p>
          ) : (
            <ol className="space-y-1.5">
              {initiative.map((row, i) => (
                <li
                  key={`${row.label}-${i}`}
                  className={`flex justify-between rounded px-2 py-1.5 text-sm ${
                    i === 0 && row.kind === 'pc'
                      ? 'border border-primary/40 bg-primary/10'
                      : 'border border-outline-variant/30'
                  }`}
                >
                  <span className="font-serif">{row.label}</span>
                  <span className="text-xs text-on-surface-variant">{i + 1}º</span>
                </li>
              ))}
            </ol>
          )}
        </SessionPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <SessionPanel title="Teatro da mente" icon="theater_comedy" className="h-full">
          <p className="font-serif text-sm leading-relaxed whitespace-pre-wrap text-on-surface">{teatroText}</p>
          <p className="mt-3 text-xs text-on-surface-variant">Tom: {ambience.atmosphere}</p>
          <p className="mt-auto rounded border border-outline-variant/30 bg-surface-container-low/40 px-3 py-2 text-xs text-on-surface-variant">
            {EXTERNAL_MAP_NOTICE}
          </p>
        </SessionPanel>

        <div className="grid h-full gap-4 lg:grid-rows-[minmax(0,1fr)_auto]">
          <SessionPanel title="Crônica & decisões" icon="menu_book" className="h-full">
            <p className="text-xs text-on-surface-variant">
              Objetivos e consequências sincronizam quando o narrador publica o ato.
            </p>
            {persistedActions.length > 0 || usedLog.length > 0 ? (
              <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto text-xs text-on-surface-variant">
                {(persistedActions.length > 0
                  ? persistedActions.map((a) => `${a.actorName}: ${a.summary}`)
                  : usedLog
                ).map((line, i) => (
                  <li key={`${line}-${i}`} className="rounded border border-outline-variant/25 px-2 py-1.5">
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-on-surface-variant">Use uma habilidade criada para registrar na sessão.</p>
            )}
            <label className="mt-auto block pt-3 text-xs uppercase text-on-surface-variant">
              Declarar ação ao narrador
              <textarea
                className="input-feudal mt-1 min-h-16 pl-3 normal-case"
                value={declareText}
                onChange={(e) => setDeclareText(e.target.value)}
                placeholder="Descreva o que seu personagem faz…"
              />
            </label>
            <div className="mt-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                disabled={!declareText.trim()}
                onClick={() => {
                  const text = declareText.trim()
                  setDeclareText('')
                  void recordAction('declaration', `Declaração: ${text}`).then(() => {
                    push('Declaração registrada na sessão.', 'success')
                  })
                }}
              >
                Enviar declaração
              </button>
            </div>
          </SessionPanel>

          <SessionPanel title="Bolsa & recompensas" icon="shopping_bag" className="h-full">
            {rewards.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Nenhuma recompensa nesta mesa ainda.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {rewards.map((r, i) => (
                  <li key={`${r.label}-${i}`} className="rounded border border-outline-variant/30 px-3 py-2">
                    <span className="font-serif text-on-surface">{r.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </SessionPanel>
        </div>
      </div>

      <div className="grid auto-rows-fr gap-4 lg:grid-cols-2 lg:items-stretch">
        <div className="flex h-full flex-col">
          <FerreiroPanel
            sessionId={sessionId}
            characterId={character?.id}
            characterLevel={character?.level ?? 1}
            isLive={isLive}
          />
        </div>

        <SessionPanel title="Ameaças em cena" icon="pest_control" className="h-full">
          {threats.length === 0 ? (
            <p className="text-sm text-on-surface-variant">Nenhum monstro em cena — o mestre adiciona pela mesa.</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {threats.map((t) => (
                <li key={t.id}>
                  <p className="font-serif text-lg text-on-surface">{t.name}</p>
                  <StatBar label="Vitalidade" current={t.hpCurrent} max={t.hpMax} />
                  <StatBar label="Mana" current={t.manaCurrent} max={Math.max(t.manaMax, 1)} variant="will" />
                </li>
              ))}
            </ul>
          )}
        </SessionPanel>
      </div>

      <footer className="mesa-panel fixed right-0 bottom-0 left-0 z-40 border-t border-outline-variant/50 bg-surface/95 px-4 py-3 backdrop-blur-md lg:left-52 xl:left-56">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-on-surface-variant">
            Turno · <strong className="text-primary">{character?.name ?? '—'}</strong>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/user/shop" className="btn-secondary text-xs">
              Feira
            </Link>
            <Link to="/user/archive" className="btn-secondary text-xs">
              Glossário
            </Link>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={leave.isPending}
              onClick={() => leave.mutate()}
            >
              Sair da sala
            </button>
            <button
              type="button"
              className="btn-primary text-xs"
              disabled={restMode || !character}
              onClick={() => {
                void recordAction('turn_end', `${character?.name ?? 'Personagem'} concluiu o turno`).then(() => {
                  push('Turno concluído e registrado na mesa.', 'success')
                })
              }}
            >
              Concluir turno
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}

function SessionRollBox({
  sessionId,
  characterName,
  rolls,
  onRolled,
}: {
  sessionId: string
  characterName: string
  rolls: Array<{ id: string; at: string; characterName: string; formula: string; total: number; secret: boolean }>
  onRolled: () => void
}) {
  const [formula, setFormula] = useState('1d10')
  const { push } = useToast()
  return (
    <div className="space-y-2 rounded border border-outline-variant/35 p-3">
      <p className="text-xs font-semibold tracking-wider text-secondary uppercase">Rolagem</p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void api
            .rollAtSession(sessionId, { formula, characterName })
            .then((row) => {
              push(`${row.formula} = ${row.total}`, 'success')
              onRolled()
            })
            .catch((error: Error) => push(error.message, 'error'))
        }}
      >
        <label className="text-xs uppercase text-on-surface-variant">
          Fórmula
          <input className="input-feudal mt-1 w-24 pl-3" value={formula} onChange={(event) => setFormula(event.target.value)} />
        </label>
        <button type="submit" className="btn-secondary self-end text-xs">
          Rolar
        </button>
      </form>
      <ul className="space-y-1 text-xs text-on-surface-variant">
        {rolls.slice(-5).reverse().map((row) => (
          <li key={row.id}>
            {row.characterName}: {row.formula} = {row.secret ? 'secreta' : row.total}
          </li>
        ))}
      </ul>
    </div>
  )
}

function SessionPanel({
  title,
  icon,
  children,
  className = '',
}: {
  title: string
  icon: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`mesa-panel flex flex-col p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-secondary">{icon}</span>
        <h2 className="font-label-sm text-[0.65rem] tracking-wider text-secondary uppercase">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function SessionChip({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-outline-variant/40 px-2.5 py-1 text-xs">
      <span className="material-symbols-outlined text-sm text-secondary">{icon}</span>
      {children}
    </span>
  )
}
