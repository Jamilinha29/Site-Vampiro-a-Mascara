import type { ChronicleEntity } from '../../types/chronicle'

const STAT_KEYS = [
  { key: 'for' as const, label: 'FOR' },
  { key: 'des' as const, label: 'DES' },
  { key: 'vig' as const, label: 'VIG' },
  { key: 'int' as const, label: 'INT' },
  { key: 'sab' as const, label: 'SAB' },
  { key: 'car' as const, label: 'CAR' },
]

export type MonsterSheetForm = Pick<
  ChronicleEntity,
  | 'creatureSize'
  | 'creatureSpeed'
  | 'creatureSenses'
  | 'defenseNote'
  | 'primaryAttackName'
  | 'primaryAttackDesc'
  | 'secondaryAttackName'
  | 'secondaryAttackDesc'
  | 'sceneTrigger'
  | 'narratorNotes'
  | 'creatureStats'
  | 'passiveTraits'
>

export const defaultCreatureStats = (): NonNullable<ChronicleEntity['creatureStats']> => ({
  for: 3,
  des: 2,
  vig: 3,
  int: 2,
  sab: 2,
  car: 1,
})

type Props = MonsterSheetForm & {
  passiveText: string
  onChange: (patch: Partial<MonsterSheetForm> & { passiveText?: string }) => void
}

export function GlossaryMonsterSheetFields({
  creatureSize,
  creatureSpeed,
  creatureSenses,
  defenseNote,
  primaryAttackName,
  primaryAttackDesc,
  secondaryAttackName,
  secondaryAttackDesc,
  sceneTrigger,
  narratorNotes,
  creatureStats,
  passiveText,
  onChange,
}: Props) {
  const stats = creatureStats ?? defaultCreatureStats()

  return (
    <div className="space-y-4 rounded border border-secondary/30 bg-surface-container-lowest/30 p-4">
      <p className="font-label-sm text-xs text-secondary uppercase">Ficha tática (bestiário)</p>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="block text-xs uppercase text-on-surface-variant">
          Tamanho
          <input
            className="input-feudal mt-1 pl-4 normal-case"
            value={creatureSize ?? 'Médio'}
            onChange={(e) => onChange({ creatureSize: e.target.value })}
          />
        </label>
        <label className="block text-xs uppercase text-on-surface-variant">
          Velocidade
          <input
            className="input-feudal mt-1 pl-4 normal-case"
            value={creatureSpeed ?? '9 m'}
            onChange={(e) => onChange({ creatureSpeed: e.target.value })}
          />
        </label>
        <label className="block text-xs uppercase text-on-surface-variant">
          Sentidos
          <input
            className="input-feudal mt-1 pl-4 normal-case"
            value={creatureSenses ?? 'Visão noturna'}
            onChange={(e) => onChange({ creatureSenses: e.target.value })}
          />
        </label>
      </div>

      <div>
        <p className="text-xs uppercase text-on-surface-variant">Atributos (1–10)</p>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {STAT_KEYS.map(({ key, label }) => (
            <label key={key} className="text-center text-[10px] uppercase text-on-surface-variant">
              {label}
              <input
                type="number"
                min={1}
                max={10}
                className="input-feudal mt-1 w-full pl-2 text-center text-sm"
                value={stats[key]}
                onChange={(e) =>
                  onChange({
                    creatureStats: { ...stats, [key]: Math.min(10, Math.max(1, Number(e.target.value) || 1)) },
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <label className="block text-xs uppercase text-on-surface-variant">
        Defesa / armadura (texto na ficha)
        <input
          className="input-feudal mt-1 pl-4 normal-case"
          value={defenseNote ?? ''}
          onChange={(e) => onChange({ defenseNote: e.target.value })}
          placeholder="Ex: 1 pt absorção leve"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs uppercase text-on-surface-variant">
          Ataque principal (nome)
          <input
            className="input-feudal mt-1 pl-4 normal-case"
            value={primaryAttackName ?? ''}
            onChange={(e) => onChange({ primaryAttackName: e.target.value })}
          />
        </label>
        <label className="block text-xs uppercase text-on-surface-variant">
          Ataque secundário (nome)
          <input
            className="input-feudal mt-1 pl-4 normal-case"
            value={secondaryAttackName ?? ''}
            onChange={(e) => onChange({ secondaryAttackName: e.target.value })}
          />
        </label>
      </div>
      <label className="block text-xs uppercase text-on-surface-variant">
        Descrição do ataque principal
        <textarea
          className="input-feudal textarea-compact mt-1 pl-4 normal-case"
          value={primaryAttackDesc ?? ''}
          onChange={(e) => onChange({ primaryAttackDesc: e.target.value })}
        />
      </label>
      <label className="block text-xs uppercase text-on-surface-variant">
        Descrição do ataque secundário
        <textarea
          className="input-feudal textarea-compact mt-1 pl-4 normal-case"
          value={secondaryAttackDesc ?? ''}
          onChange={(e) => onChange({ secondaryAttackDesc: e.target.value })}
        />
      </label>
      <label className="block text-xs uppercase text-on-surface-variant">
        Gatilho de cena
        <textarea
          className="input-feudal textarea-compact mt-1 pl-4 normal-case"
          value={sceneTrigger ?? ''}
          onChange={(e) => onChange({ sceneTrigger: e.target.value })}
        />
      </label>
      <label className="block text-xs uppercase text-on-surface-variant">
        Traços passivos (um por linha)
        <textarea
          className="input-feudal textarea-compact mt-1 pl-4 normal-case"
          value={passiveText}
          onChange={(e) => onChange({ passiveText: e.target.value })}
          placeholder="Natureza: Colosso"
        />
      </label>
      <label className="block text-xs uppercase text-on-surface-variant">
        Notas secretas do narrador
        <textarea
          className="input-feudal textarea-compact mt-1 pl-4 normal-case"
          value={narratorNotes ?? ''}
          onChange={(e) => onChange({ narratorNotes: e.target.value })}
        />
      </label>
    </div>
  )
}
