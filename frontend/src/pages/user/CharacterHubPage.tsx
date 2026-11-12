import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, NavLink, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { StatBar } from '../../components/domain/StatBar'
import { CharacterSheetPanel } from '../../components/characters/CharacterSheetPanel'
import { CharacterInventoryPanel } from '../../components/characters/CharacterInventoryPanel'
import { CreatedSkillsPanel } from '../../components/characters/CreatedSkillsPanel'
import { useCharacterPortraitEditor } from '../../components/characters/useCharacterPortraitEditor'
import { api } from '../../services/api'
import { playerQueryKeys } from '../../lib/queryKeys'
import { normalizeProgression, SUBCLASS_CHOICE_LEVEL } from '../../lib/characterProgression'
import { resolveResourceProfile } from '../../lib/characterSheetKind'
import { resolveCharacterClass } from '../../lib/characterOptions'
import { resolveSheetKind } from '../../lib/characterSheetKind'
import { computeArmorClass, sumEquippedBonuses } from '../../lib/equipmentMods'
import type { CharacterInventoryItem, CreatedSkill, ProfileCharacterSummary } from '../../types/profile'
import { useAuthStore } from '../../stores/authStore'

const TABS = [
  { id: 'inventario', label: 'Inventário' },
  { id: 'ficha', label: 'Ficha' },
  { id: 'habilidades', label: 'Habilidades' },
  { id: 'historico', label: 'Histórico' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function CharacterHubPage() {
  const { characterId = '' } = useParams()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const view = (searchParams.get('view') as TabId) || 'inventario'
  const displayName = useAuthStore((s) => s.session?.displayName)

  useEffect(() => {
    if (location.pathname.endsWith('/inventory') && searchParams.get('view') !== 'inventario') {
      setSearchParams({ view: 'inventario' }, { replace: true })
    }
  }, [location.pathname, searchParams, setSearchParams])
  const [editOpen, setEditOpen] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: playerQueryKeys.profile,
    queryFn: () => api.getMeProfile(),
  })
  const character = profile?.characters.find((c) => c.id === characterId)
  const portrait = useCharacterPortraitEditor(characterId)

  const isMortal = resolveSheetKind(character?.species) === 'mortal'

  const [draft, setDraft] = useState({
    name: '',
    clan: '',
    subclass: '',
  })

  const characterClass = character ? resolveCharacterClass(character) : null
  const { data: subclassOptions = [] } = useQuery({
    queryKey: ['catalog-subclasses', characterClass],
    queryFn: () => api.getCatalogSubclasses(characterClass!),
    enabled: editOpen && (character?.level ?? 1) >= SUBCLASS_CHOICE_LEVEL && Boolean(characterClass),
  })

  function openEdit() {
    if (!character) return
    setDraft({
      name: character.name,
      clan: character.clan ?? '',
      subclass: character.subclass ?? '',
    })
    setEditOpen(true)
  }

  async function saveEdit() {
    const canSetSubclass = (character?.level ?? 1) >= SUBCLASS_CHOICE_LEVEL
    await portrait.patchCharacter({
      name: draft.name.trim() || character!.name,
      subclass: canSetSubclass ? draft.subclass.trim() || null : undefined,
    })
    setEditOpen(false)
  }

  async function saveInventory(items: CharacterInventoryItem[]) {
    await portrait.patchCharacter({ inventory: items })
  }

  async function saveCreatedSkills(skills: CreatedSkill[]) {
    await portrait.patchCharacter({ createdSkills: skills })
  }

  if (isLoading) {
    return <p className="text-sm text-on-surface-variant">Abrindo linhagem…</p>
  }

  if (!character) {
    return (
      <div className="card-surface space-y-4 p-8 text-center">
        <p className="text-on-surface-variant">Personagem não encontrado nesta conta.</p>
        <Link to="/user/characters" className="btn-primary inline-flex text-sm">
          Meus personagens
        </Link>
      </div>
    )
  }

  const progression = normalizeProgression({
    level: character.level,
    xp: character.xp,
    subclass: character.subclass,
  })

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    [
      'inline-flex items-center border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition',
      isActive
        ? 'border-primary text-primary'
        : 'border-transparent text-on-surface-variant hover:border-outline-variant hover:text-on-surface',
    ].join(' ')

  return (
    <div className="space-y-5 pb-8">
      <input
        ref={portrait.inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(e) => {
          portrait.onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <header className="mesa-panel overflow-hidden">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:p-6">
          <button
            type="button"
            disabled={portrait.saving}
            onClick={portrait.openPicker}
            className="group relative h-36 w-28 shrink-0 overflow-hidden rounded border-2 border-primary/60 bg-surface-container-high shadow-lg transition hover:border-secondary sm:h-44 sm:w-32"
            title="Clique para alterar o retrato"
          >
            {character.portraitUrl ? (
              <img src={character.portraitUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
                <span className="material-symbols-outlined text-3xl text-outline-variant">add_a_photo</span>
                <span className="text-[10px] text-on-surface-variant">Adicionar retrato</span>
              </div>
            )}
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[9px] tracking-wide text-white uppercase opacity-0 transition group-hover:opacity-100">
              {portrait.saving ? 'Salvando…' : 'Trocar retrato'}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-label-sm text-[0.65rem] text-secondary uppercase">Nível {progression.level}</p>
              {progression.needsSubclassChoice ? (
                <span className="rounded border border-secondary/50 bg-secondary/15 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-secondary uppercase">
                  Escolha a subclasse
                </span>
              ) : null}
            </div>
            <h1 className="font-headline-lg text-2xl text-on-surface">{character.name}</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {character.species}
              {character.clan ? ` · ${character.clan}` : ''}
              {character.identity?.faith ? ` · ${character.identity.faith}` : ''}
              {character.subclass ? ` · ${character.subclass}` : ''}
            </p>
            <CharacterResourceBars character={character} />
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
            <button type="button" className="btn-secondary text-xs" onClick={openEdit}>
              Editar dados
            </button>
            <Link to={`/user/characters/${characterId}?view=ficha`} className="btn-primary text-xs">
              Ficha
            </Link>
          </div>
        </div>

      </header>

      {portrait.error ? <p className="text-sm text-primary">{portrait.error}</p> : null}

      <div className="space-y-4">
        <nav className="flex flex-wrap items-center justify-end gap-1" aria-label="Seções do personagem">
          {TABS.map((tab) => (
            <NavLink
              key={tab.id}
              to={`/user/characters/${characterId}?view=${tab.id}`}
              className={tabClass}
              onClick={() => setSearchParams({ view: tab.id })}
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0">
          {view === 'inventario' ? (
            <CharacterInventoryPanel character={character} onChangeInventory={saveInventory} busy={portrait.saving} />
          ) : null}
          {view === 'ficha' ? (
            <CharacterSheetPanel
              character={character}
              playerName={displayName}
              onPatchIdentity={async (identityPatch) => {
                await portrait.patchCharacter({ identityPatch })
              }}
              onChangeSheetStats={async (balanceStats) => {
                await portrait.patchCharacter({ balanceStats })
              }}
              saving={portrait.saving}
            />
          ) : null}
          {view === 'habilidades' ? (
            <section className="mesa-panel p-5">
              <h2 className="font-label-sm mb-3 text-xs text-secondary uppercase">Habilidades</h2>
              <p className="mb-4 text-xs text-on-surface-variant">
                Crie e edite habilidades aqui. Na ficha aparece só o nome e os atributos (somente leitura).
              </p>
              <div className="rounded border border-outline-variant/35 bg-surface-container-lowest/30 p-4">
                <h3 className="mb-3 font-label-sm text-[10px] tracking-wider text-secondary uppercase">
                  Habilidades criadas
                </h3>
                <CreatedSkillsPanel
                  skills={character.createdSkills ?? []}
                  onChange={saveCreatedSkills}
                  busy={portrait.saving}
                />
              </div>
            </section>
          ) : null}
          {view === 'historico' ? <PlaceholderTab text="Histórico de atos e decisões do personagem." /> : null}
        </div>
      </div>

      {editOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="card-surface w-full max-w-md space-y-4 p-6">
            <h2 className="font-headline-sm text-lg text-on-surface">Editar personagem</h2>
            <label className="block text-xs uppercase text-on-surface-variant">
              Nome
              <input
                className="input-feudal mt-1 pl-4 normal-case"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              />
            </label>
            <div className="rounded border border-outline-variant/40 bg-surface-container-lowest/40 px-3 py-2">
              <p className="text-[10px] uppercase text-on-surface-variant">Fé</p>
              <p className="mt-1 text-sm text-on-surface">{character.identity?.faith || '—'}</p>
              <p className="mt-1 text-[10px] text-on-surface-variant">
                A fé só muda quando o narrador altera na sessão.
              </p>
            </div>
            <div className="rounded border border-outline-variant/40 bg-surface-container-lowest/40 px-3 py-2">
              <p className="text-[10px] uppercase text-on-surface-variant">
                {isMortal ? 'Clã / ordem mortal' : 'Clã'}
              </p>
              <p className="mt-1 text-sm text-on-surface">{draft.clan || '—'}</p>
            </div>
            {progression.level >= SUBCLASS_CHOICE_LEVEL ? (
              <label className="block text-xs uppercase text-on-surface-variant">
                Subclasse{characterClass ? ` · ${characterClass}` : ''}
                {characterClass && subclassOptions.length > 0 ? (
                  <select
                    className="input-feudal mt-1 pl-4 normal-case"
                    value={draft.subclass}
                    onChange={(e) => setDraft((d) => ({ ...d, subclass: e.target.value }))}
                  >
                    <option value="">Selecionar…</option>
                    {subclassOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="mt-1 text-sm normal-case text-on-surface">
                    {characterClass
                      ? `Nenhuma subclasse importada para ${characterClass}.`
                      : 'Este personagem não tem classe definida.'}
                  </p>
                )}
              </label>
            ) : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary text-xs" onClick={() => setEditOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary text-xs" disabled={portrait.saving} onClick={() => void saveEdit()}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CharacterResourceBars({ character }: { character: ProfileCharacterSummary }) {
  const resources = resolveResourceProfile(character.species)
  const progression = normalizeProgression({
    level: character.level,
    xp: character.xp,
    subclass: character.subclass,
  })
  const mana = character.mana ?? { current: 8, max: 10 }
  const will = character.will ?? { current: 4, max: 5 }
  const blood = character.blood ?? { current: 8, max: 10 }
  const bonuses = sumEquippedBonuses(character.inventory)
  const ca = computeArmorClass(character, bonuses)

  const hpDie = character.vitals?.hpDie
  const manaDie = character.vitals?.manaDie

  return (
    <div className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
      {resources.showHp ? (
        <StatBar
          label={`HP${hpDie ? ` · ${hpDie}` : ''}`}
          current={character.hp.current}
          max={character.hp.max}
          bonus={bonuses.hp}
        />
      ) : null}
      {resources.showMana ? (
        <StatBar
          label={`${resources.manaLabel}${manaDie ? ` · ${manaDie}` : ''}`}
          current={mana.current}
          max={mana.max}
          bonus={bonuses.mana}
          variant="mana"
        />
      ) : null}
      {resources.showBlood ? (
        <StatBar label="Sangue" current={blood.current} max={blood.max} variant="blood" />
      ) : null}
      {resources.showWill ? <StatBar label="Vontade" current={will.current} max={will.max} variant="will" /> : null}
      {resources.secondaryEssenceLabel ? (
        <StatBar label={resources.secondaryEssenceLabel} current={8} max={10} variant="faith" />
      ) : null}
      <StatBar
        label={`CA${character.vitals?.caDie ? ` · ${character.vitals.caDie}` : ''}`}
        current={ca.total}
        max={Math.max(ca.total, ca.base + Math.abs(ca.bonus), 20)}
        bonus={ca.bonus}
        variant="defense"
      />
      <StatBar
        label="XP"
        current={progression.xp.current}
        max={progression.xp.toNext || Math.max(progression.xp.current, 1)}
        variant="xp"
      />
    </div>
  )
}

function PlaceholderTab({ text }: { text: string }) {
  return (
    <section className="mesa-panel p-6">
      <p className="text-sm text-on-surface-variant">{text}</p>
    </section>
  )
}
