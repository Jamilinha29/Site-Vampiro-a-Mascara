import { useEffect } from 'react'
import type { ChronicleEntity } from '../../types/chronicle'

function resolveDefenseValue(entity: ChronicleEntity): number {
  if (typeof entity.defense === 'number') return entity.defense
  const defMod = entity.attributeMods?.find((m) => m.attr === 'defesa')
  if (defMod) return Math.max(0, defMod.value)
  const noteNum = entity.defenseNote?.match(/\d+/)
  if (noteNum) return Number(noteNum[0])
  return 0
}

type AttackSlot = {
  slot: string
  name: string
  description?: string
}

export function CreatureCombatSheetModal({
  entity,
  onClose,
}: {
  entity: ChronicleEntity | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!entity) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [entity, onClose])

  if (!entity) return null

  const isDead = entity.lifeStatus === 'dead'
  const hp = entity.hpMax ?? 0
  const mana = entity.manaMax ?? 0
  const defense = resolveDefenseValue(entity)
  const abilities = entity.abilities ?? []
  const passives = entity.passiveTraits ?? []
  const weapons = entity.weapons ?? []
  const attacks: AttackSlot[] = []
  if (entity.primaryAttackName?.trim() || entity.primaryAttackDesc?.trim()) {
    attacks.push({
      slot: 'Ataque principal',
      name: entity.primaryAttackName?.trim() || 'Golpe principal',
      description: entity.primaryAttackDesc?.trim() || undefined,
    })
  }
  if (entity.secondaryAttackName?.trim() || entity.secondaryAttackDesc?.trim()) {
    attacks.push({
      slot: 'Ataque secundário',
      name: entity.secondaryAttackName?.trim() || 'Golpe secundário',
      description: entity.secondaryAttackDesc?.trim() || undefined,
    })
  }

  const statGrid = entity.creatureStats
    ? [
        { key: 'FOR', value: entity.creatureStats.for },
        { key: 'DES', value: entity.creatureStats.des },
        { key: 'VIG', value: entity.creatureStats.vig },
        { key: 'INT', value: entity.creatureStats.int },
        { key: 'SAB', value: entity.creatureStats.sab },
        { key: 'CAR', value: entity.creatureStats.car },
      ]
    : []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={`Ficha de dados — ${entity.name}`}
      onClick={onClose}
    >
      <div
        className="mesa-panel max-h-[85vh] w-full max-w-2xl space-y-5 overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/40 pb-3">
          <div>
            <p className="font-label-sm text-[10px] tracking-wider text-secondary uppercase">
              Ficha flutuante de dados · {entity.kind === 'npc' ? 'NPC' : 'Monstro'}
              {entity.creatureType ? ` · ${entity.creatureType}` : ''}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-xl uppercase tracking-wide text-on-surface">{entity.name}</h3>
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${
                  isDead
                    ? 'border-primary/50 bg-primary/15 text-primary'
                    : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                {isDead ? 'Morto' : 'Vivo'}
              </span>
            </div>
          </div>
          <button type="button" className="btn-secondary text-xs" autoFocus onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="rounded border border-outline-variant/40 bg-surface-container-lowest/50 px-3 py-2">
            <p className="font-label-sm text-[10px] text-on-surface-variant uppercase">HP</p>
            <p className="font-numeric-stat mt-0.5 text-base text-on-surface">
              {isDead ? 0 : hp}/{hp}
            </p>
          </div>
          <div className="rounded border border-outline-variant/40 bg-surface-container-lowest/50 px-3 py-2">
            <p className="font-label-sm text-[10px] text-on-surface-variant uppercase">Mana</p>
            <p className="font-numeric-stat mt-0.5 text-base text-on-surface">{mana}</p>
          </div>
          <div className="rounded border border-outline-variant/40 bg-surface-container-lowest/50 px-3 py-2">
            <p className="font-label-sm text-[10px] text-on-surface-variant uppercase">Defesa</p>
            <p className="font-numeric-stat mt-0.5 text-base text-on-surface">{defense}</p>
            {entity.defenseNote?.trim() ? (
              <p className="mt-0.5 text-[10px] text-on-surface-variant">{entity.defenseNote}</p>
            ) : null}
          </div>
        </div>

        {statGrid.length > 0 ? (
          <div>
            <p className="font-label-sm mb-2 text-[10px] tracking-wider text-secondary uppercase">
              Dados base de atributo
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {statGrid.map((s) => (
                <div
                  key={s.key}
                  className="rounded border border-outline-variant/35 bg-surface-container-lowest/40 px-2 py-1.5 text-center"
                >
                  <p className="text-[9px] tracking-wider text-on-surface-variant uppercase">{s.key}</p>
                  <p className="font-numeric-stat text-sm text-on-surface">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <section className="rounded border border-secondary/35 bg-secondary/5 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-secondary uppercase">
            <span className="material-symbols-outlined text-sm">swords</span>
            Armas usadas &amp; ataques
          </p>

          {weapons.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {weapons.map((weapon) => (
                <span
                  key={weapon}
                  className="rounded border border-secondary/40 bg-surface-container-lowest/70 px-2.5 py-1 text-xs text-on-surface"
                >
                  {weapon}
                </span>
              ))}
            </div>
          ) : null}

          {attacks.length > 0 ? (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {attacks.map((atk) => (
                <div
                  key={atk.slot}
                  className="rounded border border-outline-variant/40 bg-surface-container-lowest/50 p-3"
                >
                  <p className="text-[10px] font-semibold tracking-wider text-primary uppercase">{atk.slot}</p>
                  <p className="mt-1 font-serif text-sm text-on-surface">{atk.name}</p>
                  {atk.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{atk.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {weapons.length === 0 && attacks.length === 0 ? (
            <p className="mt-2 text-xs text-on-surface-variant">Nenhuma arma ou ataque registrado.</p>
          ) : null}
        </section>

        <section className="rounded border border-outline-variant/40 bg-surface-container-lowest/40 p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-secondary uppercase">
            <span className="material-symbols-outlined text-sm">casino</span>
            Habilidades &amp; traços em combate
          </p>

          {abilities.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {abilities.map((ability) => (
                <span
                  key={ability}
                  className="rounded border border-outline-variant/50 bg-surface-container-high/80 px-2.5 py-1 text-xs text-on-surface"
                >
                  {ability}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-on-surface-variant">Nenhuma habilidade registrada.</p>
          )}

          {passives.length > 0 ? (
            <div className="mt-3 border-t border-outline-variant/30 pt-3">
              <p className="text-[10px] tracking-wider text-on-surface-variant uppercase">Traços passivos</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {passives.map((trait) => (
                  <span
                    key={trait}
                    className="rounded border border-outline-variant/35 bg-surface-container-lowest/70 px-2 py-0.5 text-[11px] text-on-surface-variant"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {entity.attributeMods?.length ? (
            <div className="mt-3 border-t border-outline-variant/30 pt-3">
              <p className="text-[10px] tracking-wider text-on-surface-variant uppercase">Modificadores</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {entity.attributeMods.map((mod, idx) => (
                  <span
                    key={`${mod.attr}-${idx}`}
                    className="rounded border border-secondary/35 bg-secondary/10 px-2 py-0.5 text-[11px] text-secondary"
                  >
                    {mod.value >= 0 ? `+${mod.value}` : mod.value} {mod.attr}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
