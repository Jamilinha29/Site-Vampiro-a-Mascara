import { useState } from 'react'
import type { CreatedSkill } from '../../types/profile'

const DICE = ['D4', 'D6', 'D8', 'D10', 'D12', '2D10', 'D20'] as const
const ATTRIBUTES = [
  'Força',
  'Destreza',
  'Vigor',
  'Carisma',
  'Manipulação',
  'Aparência',
  'Percepção',
  'Inteligência',
  'Raciocínio',
] as const

type Props = {
  skills: CreatedSkill[]
  onChange: (skills: CreatedSkill[]) => Promise<void> | void
  busy?: boolean
  /** Na sessão: botão Usar. */
  onUse?: (skill: CreatedSkill) => void
  compact?: boolean
}

function emptyDraft(): Omit<CreatedSkill, 'id'> {
  return {
    name: '',
    die: 'D10',
    attribute: 'Força',
    attributeMod: 0,
    howItWorks: '',
    manaCost: 0,
  }
}

export function CreatedSkillsPanel({ skills, onChange, busy, onUse, compact }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(emptyDraft())

  function startCreate() {
    setCreating(true)
    setEditingId(null)
    setDraft(emptyDraft())
  }

  function startEdit(skill: CreatedSkill) {
    setCreating(false)
    setEditingId(skill.id)
    setDraft({
      name: skill.name,
      die: skill.die,
      attribute: skill.attribute,
      attributeMod: skill.attributeMod,
      howItWorks: skill.howItWorks,
      manaCost: skill.manaCost ?? 0,
    })
  }

  async function save() {
    if (!draft.name.trim()) return
    const manaCost = Math.max(0, Math.floor(Number(draft.manaCost) || 0))
    if (creating) {
      const next: CreatedSkill = {
        id: crypto.randomUUID(),
        name: draft.name.trim(),
        die: draft.die,
        attribute: draft.attribute,
        attributeMod: draft.attributeMod,
        howItWorks: draft.howItWorks.trim(),
        manaCost,
      }
      await onChange([...skills, next])
    } else if (editingId) {
      await onChange(
        skills.map((s) =>
          s.id === editingId
            ? {
                ...s,
                name: draft.name.trim(),
                die: draft.die,
                attribute: draft.attribute,
                attributeMod: draft.attributeMod,
                howItWorks: draft.howItWorks.trim(),
                manaCost,
              }
            : s,
        ),
      )
    }
    setCreating(false)
    setEditingId(null)
    setDraft(emptyDraft())
  }

  async function remove(id: string) {
    await onChange(skills.filter((s) => s.id !== id))
    if (editingId === id) {
      setEditingId(null)
      setDraft(emptyDraft())
    }
  }

  const formOpen = creating || !!editingId

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-on-surface-variant">
          Nome, dado, atributo (+/−) e como funciona — salvas na ficha e usáveis na sessão.
        </p>
        <button type="button" className="btn-secondary text-[10px]" disabled={busy || formOpen} onClick={startCreate}>
          + Habilidade
        </button>
      </div>

      {formOpen ? (
        <div className="space-y-2 rounded border border-secondary/40 bg-secondary/5 p-3">
          <label className="block text-[10px] uppercase text-on-surface-variant">
            Nome
            <input
              className="input-feudal mt-1 pl-3 text-sm normal-case"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-[10px] uppercase text-on-surface-variant">
              Dado
              <select
                className="input-feudal mt-1 pl-3 normal-case"
                value={draft.die}
                onChange={(e) => setDraft((d) => ({ ...d, die: e.target.value }))}
              >
                {DICE.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] uppercase text-on-surface-variant">
              Atributo
              <select
                className="input-feudal mt-1 pl-3 normal-case"
                value={draft.attribute}
                onChange={(e) => setDraft((d) => ({ ...d, attribute: e.target.value }))}
              >
                {ATTRIBUTES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-[10px] uppercase text-on-surface-variant">
              Mod. atributo
              <input
                type="number"
                className="input-feudal mt-1 pl-3"
                value={draft.attributeMod}
                onChange={(e) => setDraft((d) => ({ ...d, attributeMod: Number(e.target.value) || 0 }))}
              />
            </label>
          </div>
          <label className="block text-[10px] uppercase text-on-surface-variant">
            Custo de mana
            <input
              type="number"
              min={0}
              className="input-feudal mt-1 pl-3"
              value={draft.manaCost ?? 0}
              onChange={(e) => setDraft((d) => ({ ...d, manaCost: Math.max(0, Number(e.target.value) || 0) }))}
            />
          </label>
          <label className="block text-[10px] uppercase text-on-surface-variant">
            Como funciona
            <textarea
              className="input-feudal mt-1 min-h-16 pl-3 normal-case"
              value={draft.howItWorks}
              onChange={(e) => setDraft((d) => ({ ...d, howItWorks: e.target.value }))}
              placeholder="Descreva o efeito e o uso na mesa…"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn-secondary text-[10px]"
              onClick={() => {
                setCreating(false)
                setEditingId(null)
              }}
            >
              Cancelar
            </button>
            <button type="button" className="btn-primary text-[10px]" disabled={busy || !draft.name.trim()} onClick={() => void save()}>
              Salvar habilidade
            </button>
          </div>
        </div>
      ) : null}

      {skills.length === 0 && !formOpen ? (
        <p className="text-sm text-on-surface-variant">Nenhuma habilidade criada ainda.</p>
      ) : (
        <ul className={`space-y-2 ${compact ? '' : ''}`}>
          {skills.map((skill) => (
            <li key={skill.id} className="rounded border border-outline-variant/35 bg-surface-container-lowest/40 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-serif text-sm text-on-surface">{skill.name}</p>
                  <p className="mt-0.5 text-[10px] tracking-wide text-secondary uppercase">
                    {skill.die} · {skill.attribute}{' '}
                    {skill.attributeMod >= 0 ? `+${skill.attributeMod}` : skill.attributeMod}
                    {(skill.manaCost ?? 0) > 0 ? ` · mana ${skill.manaCost}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {onUse ? (
                    <button type="button" className="btn-primary text-[9px]" onClick={() => onUse(skill)}>
                      Usar{(skill.manaCost ?? 0) > 0 ? ` (−${skill.manaCost} mana)` : ''}
                    </button>
                  ) : null}
                  <button type="button" className="btn-secondary text-[9px]" disabled={busy} onClick={() => startEdit(skill)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-[9px] text-on-surface-variant underline"
                    disabled={busy}
                    onClick={() => void remove(skill.id)}
                  >
                    Excluir
                  </button>
                </div>
              </div>
              {skill.howItWorks ? (
                <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{skill.howItWorks}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
