import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { readProfileImageFile } from '../../lib/profileMedia'
import {
  ATTR_KEYS,
  GLOSSARY_CLASSES,
  MAGIC_TYPES,
  MAX_ATTRIBUTE_MODS,
  MONSTER_TYPES,
  RELIC_AMULET_TYPES,
  THREAT_LEVELS,
  type GlossaryClassId,
  type ThreatLevelId,
} from '../../lib/glossaryCatalog'
import { invalidatePlayerPublishedContent } from '../../lib/queryKeys'
import type { AttributeMod, ChronicleEntity, CreateEntityPayload } from '../../types/chronicle'
import { api } from '../../services/api'
import { useReferenceNames } from '../../hooks/useReferenceNames'
import { defaultCreatureStats, GlossaryMonsterSheetFields } from './GlossaryMonsterSheetFields'

const emptyMods = (): AttributeMod[] => [{ attr: 'forca', value: 1 }]

export function AdminGlossaryEditor() {
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [classification, setClassification] = useState<GlossaryClassId>('grimoire')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState<string | undefined>()
  const [creatureType, setCreatureType] = useState<string>(MONSTER_TYPES[0])
  const [customCreatureType, setCustomCreatureType] = useState('')
  const [threatLevel, setThreatLevel] = useState<ThreatLevelId>('comum')
  const [hpMax, setHpMax] = useState(40)
  const [manaMax, setManaMax] = useState(20)
  const monsterNames = useReferenceNames('monster_type', MONSTER_TYPES)
  const magicNames = useReferenceNames('magic', MAGIC_TYPES)
  const relicNames = useReferenceNames('relic', RELIC_AMULET_TYPES)
  const [relicAmuletType, setRelicAmuletType] = useState<string>(RELIC_AMULET_TYPES[0])
  const [magicType, setMagicType] = useState<string>(MAGIC_TYPES[0])
  const [cooldownText, setCooldownText] = useState('1 turno')
  const [mods, setMods] = useState<AttributeMod[]>(emptyMods())
  const [bestiaryTier, setBestiaryTier] = useState<'known' | 'classified' | 'rumors'>('classified')
  const [rarity, setRarity] = useState<'comum' | 'incomum' | 'raro' | 'ancestral' | 'proibido'>('comum')
  const [weightKg, setWeightKg] = useState(0.5)
  const [shopPickId, setShopPickId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creatureSize, setCreatureSize] = useState('Médio')
  const [creatureSpeed, setCreatureSpeed] = useState('9 m')
  const [creatureSenses, setCreatureSenses] = useState('Visão noturna')
  const [defenseNote, setDefenseNote] = useState('')
  const [primaryAttackName, setPrimaryAttackName] = useState('Golpe devastador')
  const [primaryAttackDesc, setPrimaryAttackDesc] = useState('')
  const [secondaryAttackName, setSecondaryAttackName] = useState('Investida / pressão')
  const [secondaryAttackDesc, setSecondaryAttackDesc] = useState('')
  const [sceneTrigger, setSceneTrigger] = useState(
    'Quando a vitalidade cai abaixo de 50%, a criatura muda de postura e prioriza alvos isolados.',
  )
  const [narratorNotes, setNarratorNotes] = useState('')
  const [creatureStats, setCreatureStats] = useState(defaultCreatureStats())
  const [passiveText, setPassiveText] = useState('')

  const { data: archives = [] } = useQuery({
    queryKey: ['admin-entities', 'archive'],
    queryFn: () => api.adminListEntities('archive'),
  })
  const { data: monsters = [] } = useQuery({
    queryKey: ['admin-entities', 'monster'],
    queryFn: () => api.adminListEntities('monster'),
  })
  const { data: shopGear = [] } = useQuery({
    queryKey: ['admin-entities', 'equipment'],
    queryFn: () => api.adminListEntities('equipment'),
  })
  const { data: shopConsumables = [] } = useQuery({
    queryKey: ['admin-entities', 'consumable'],
    queryFn: () => api.adminListEntities('consumable'),
  })

  const shopCatalog = useMemo(
    () =>
      [...shopGear, ...shopConsumables].sort((a, b) =>
        a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
      ),
    [shopGear, shopConsumables],
  )

  const savedCustomTypes = useMemo(() => {
    const preset = new Set(monsterNames.map((t) => t.toLowerCase()))
    const extras = new Set<string>()
    for (const m of monsters) {
      const t = m.creatureType?.trim()
      if (t && !preset.has(t.toLowerCase()) && t.toLowerCase() !== 'outro') extras.add(t)
    }
    return [...extras].sort((a, b) => a.localeCompare(b))
  }, [monsters, monsterNames])

  const typeOptions = useMemo(() => [...monsterNames, ...savedCustomTypes.filter((name) => !monsterNames.includes(name))], [monsterNames, savedCustomTypes])

  function resetForm() {
    setEditingId(null)
    setClassification('grimoire')
    setName('')
    setDescription('')
    setImageUrl(undefined)
    setCustomCreatureType('')
    setCreatureType(monsterNames[0] ?? MONSTER_TYPES[0])
    setThreatLevel('comum')
    setHpMax(40)
    setManaMax(20)
    setRelicAmuletType(relicNames[0] ?? RELIC_AMULET_TYPES[0])
    setMagicType(magicNames[0] ?? MAGIC_TYPES[0])
    setCooldownText('1 turno')
    setMods(emptyMods())
    setBestiaryTier('classified')
    setRarity('comum')
    setWeightKg(0.5)
    setShopPickId('')
    setCreatureSize('Médio')
    setCreatureSpeed('9 m')
    setCreatureSenses('Visão noturna')
    setDefenseNote('')
    setPrimaryAttackName('Golpe devastador')
    setPrimaryAttackDesc('')
    setSecondaryAttackName('Investida / pressão')
    setSecondaryAttackDesc('')
    setSceneTrigger(
      'Quando a vitalidade cai abaixo de 50%, a criatura muda de postura e prioriza alvos isolados.',
    )
    setNarratorNotes('')
    setCreatureStats(defaultCreatureStats())
    setPassiveText('')
    setError(null)
  }

  function applyShopItem(item: ChronicleEntity) {
    setName(item.name)
    setDescription(item.description ?? '')
    setImageUrl(item.imageUrl)
    if (item.relicAmuletType) {
      setRelicAmuletType(item.relicAmuletType ?? relicNames[0] ?? RELIC_AMULET_TYPES[0])
    }
    if (item.attributeMods?.length) {
      setMods(item.attributeMods)
    }
    if (item.rarity) setRarity(item.rarity)
    if (item.weightKg != null) setWeightKg(item.weightKg)
  }

  function loadItem(item: ChronicleEntity) {
    const cls = (item.classification ?? (item.kind === 'monster' ? 'monster' : 'grimoire')) as GlossaryClassId
    setEditingId(item.id)
    setClassification(cls)
    setName(item.name)
    setDescription(item.description ?? '')
    setImageUrl(item.imageUrl)
    setRarity(item.rarity ?? 'comum')
    setWeightKg(item.weightKg ?? 0.5)
    setThreatLevel((item.threatLevel as ThreatLevelId) ?? 'comum')
    setHpMax(item.hpMax ?? 40)
    setManaMax(item.manaMax ?? 20)
    setBestiaryTier(item.bestiaryTier ?? 'classified')
    setMagicType(item.magicType ?? magicNames[0] ?? MAGIC_TYPES[0])
    setCooldownText(item.cooldownText ?? '1 turno')
    setRelicAmuletType(item.relicAmuletType ?? relicNames[0] ?? RELIC_AMULET_TYPES[0])
    setMods(item.attributeMods?.length ? item.attributeMods : emptyMods())
    const ct = item.creatureType?.trim() ?? monsterNames[0] ?? MONSTER_TYPES[0]
    if (monsterNames.includes(ct) || savedCustomTypes.includes(ct)) {
      setCreatureType(ct)
      setCustomCreatureType('')
    } else {
      setCreatureType('Outro')
      setCustomCreatureType(ct)
    }
    const fromShop = shopCatalog.find((s) => s.name === item.name)
    setShopPickId(fromShop?.id ?? '')
    setCreatureSize(item.creatureSize ?? 'Médio')
    setCreatureSpeed(item.creatureSpeed ?? '9 m')
    setCreatureSenses(item.creatureSenses ?? 'Visão noturna')
    setDefenseNote(item.defenseNote ?? '')
    setPrimaryAttackName(item.primaryAttackName ?? 'Golpe devastador')
    setPrimaryAttackDesc(item.primaryAttackDesc ?? '')
    setSecondaryAttackName(item.secondaryAttackName ?? 'Investida / pressão')
    setSecondaryAttackDesc(item.secondaryAttackDesc ?? '')
    setSceneTrigger(
      item.sceneTrigger ??
        'Quando a vitalidade cai abaixo de 50%, a criatura muda de postura e prioriza alvos isolados.',
    )
    setNarratorNotes(item.narratorNotes ?? '')
    setCreatureStats(item.creatureStats ?? defaultCreatureStats())
    setPassiveText((item.passiveTraits ?? []).join('\n'))
    setError(null)
  }

  function buildBody(): CreateEntityPayload | null {
    if (!name.trim()) return null
    const isMonster = classification === 'monster'
    const resolvedType =
      creatureType === 'Outro' ? customCreatureType.trim() : creatureType.trim()
    if (isMonster && creatureType === 'Outro' && !resolvedType) {
      setError('Informe o tipo personalizado do monstro.')
      return null
    }
    const body: CreateEntityPayload = {
      kind: isMonster ? 'monster' : 'archive',
      name: name.trim(),
      description,
      classification,
      imageUrl,
      rarity,
      weightKg,
      archiveCategory: isMonster
        ? 'relics'
        : classification === 'grimoire'
          ? 'rituals'
          : classification === 'relic'
            ? 'relics'
            : 'chronicles',
      bestiaryTier: isMonster ? bestiaryTier : undefined,
    }

    if (isMonster) {
      body.creatureType = resolvedType
      body.threatLevel = threatLevel
      body.hpMax = hpMax
      body.manaMax = manaMax
      body.statsText = `HP ${hpMax} · Mana ${manaMax} · Tipo ${resolvedType} · Nível ${threatLevel}`
      body.creatureSize = creatureSize
      body.creatureSpeed = creatureSpeed
      body.creatureSenses = creatureSenses
      body.defenseNote = defenseNote
      body.primaryAttackName = primaryAttackName
      body.primaryAttackDesc = primaryAttackDesc
      body.secondaryAttackName = secondaryAttackName
      body.secondaryAttackDesc = secondaryAttackDesc
      body.sceneTrigger = sceneTrigger
      body.narratorNotes = narratorNotes
      body.creatureStats = creatureStats
      body.passiveTraits = passiveText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    } else if (classification === 'grimoire') {
      body.magicType = magicType
      body.cooldownText = cooldownText
      body.statsText = `Magia: ${magicType} · Recarga: ${cooldownText}`
    } else {
      body.relicAmuletType = relicAmuletType
      body.attributeMods = mods.slice(0, MAX_ATTRIBUTE_MODS)
      body.statsText = mods.map((m) => `${m.value > 0 ? '+' : ''}${m.value} ${m.attr}`).join(', ')
    }
    return body
  }

  const create = useMutation({
    mutationFn: async (body: CreateEntityPayload) => {
      const row = await api.adminCreateEntity(body)
      if (publishOnSave && row.visibility === 'draft') {
        return api.adminPublishEntity(row.id)
      }
      return row
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities'] })
      invalidatePlayerPublishedContent(qc)
      resetForm()
    },
    onError: (e: Error) => setError(e.message),
  })

  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: CreateEntityPayload }) => {
      const row = await api.adminUpdateEntity(id, body)
      if (publishOnSave && row.visibility === 'draft') {
        return api.adminPublishEntity(row.id)
      }
      return row
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities'] })
      invalidatePlayerPublishedContent(qc)
      resetForm()
    },
    onError: (e: Error) => setError(e.message),
  })

  const publish = useMutation({
    mutationFn: (id: string) => api.adminPublishEntity(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities'] })
      invalidatePlayerPublishedContent(qc)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.adminDeleteEntity(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entities'] })
      invalidatePlayerPublishedContent(qc)
      if (editingId) resetForm()
    },
  })

  function submit() {
    const body = buildBody()
    if (!body) return
    if (editingId) update.mutate({ id: editingId, body })
    else create.mutate(body)
  }

  const [registryQuery, setRegistryQuery] = useState('')
  const [registryRarity, setRegistryRarity] = useState('all')
  const [registrySort, setRegistrySort] = useState<'recent' | 'name'>('recent')
  const [publishOnSave, setPublishOnSave] = useState(true)

  const entries = useMemo(
    () =>
      [
        ...archives.map((a) => ({ ...a, _class: a.classification ?? 'grimoire' })),
        ...monsters.map((m) => ({ ...m, _class: 'monster' as const })),
      ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [archives, monsters],
  )

  const filteredEntries = useMemo(() => {
    const q = registryQuery.trim().toLowerCase()
    let list = entries.filter((item) => {
      if (registryRarity !== 'all' && (item.rarity ?? 'comum') !== registryRarity) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (item.creatureType ?? '').toLowerCase().includes(q)
      )
    })
    if (registrySort === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    }
    return list
  }, [entries, registryQuery, registryRarity, registrySort])

  const saving = create.isPending || update.isPending

  return (
    <div className="space-y-6">
      <section className="admin-form-panel admin-form-panel--compact">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-label-sm text-xs text-secondary uppercase">
              {editingId ? 'Editar entrada do glossário' : 'Cadastrar no glossário'}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Grimórios, amuletos, relíquias e monstros — com foto, classificação e regras específicas.
            </p>
          </div>
          {editingId ? (
            <button type="button" className="btn-secondary text-xs" onClick={resetForm}>
              Novo cadastro
            </button>
          ) : null}
        </header>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-xs uppercase text-on-surface-variant">
            Classificação
            <select
              className="input-feudal mt-1 pl-4 normal-case"
              value={classification}
              onChange={(e) => setClassification(e.target.value as GlossaryClassId)}
            >
              {GLOSSARY_CLASSES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs uppercase text-on-surface-variant">
            Nome
            {classification === 'monster' ? (
              <input className="input-feudal mt-1 pl-4" value={name} onChange={(e) => setName(e.target.value)} />
            ) : (
              <select
                className="input-feudal mt-1 pl-4 normal-case"
                value={shopPickId}
                onChange={(e) => {
                  const id = e.target.value
                  setShopPickId(id)
                  const picked = shopCatalog.find((s) => s.id === id)
                  if (picked) applyShopItem(picked)
                  else {
                    setName('')
                    setDescription('')
                    setImageUrl(undefined)
                  }
                }}
              >
                <option value="">Selecione um item da loja…</option>
                {shopCatalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.shopCategory ? ` (${item.shopCategory})` : ''}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>

        <label className="block text-xs uppercase text-on-surface-variant">
          Descrição
          <textarea
            className="input-feudal textarea-compact mt-1 pl-4"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-xs uppercase text-on-surface-variant">
            Raridade
            <select
              className="input-feudal mt-1 pl-4 normal-case"
              value={rarity}
              onChange={(e) => setRarity(e.target.value as typeof rarity)}
            >
              <option value="comum">Comum</option>
              <option value="incomum">Incomum</option>
              <option value="raro">Raro</option>
              <option value="ancestral">Ancestral</option>
              <option value="proibido">Proibido</option>
            </select>
          </label>
          {classification === 'monster' ? (
            <label className="block text-xs uppercase text-on-surface-variant">
              Tipo de nível
              <select
                className="input-feudal mt-1 pl-4 normal-case"
                value={threatLevel}
                onChange={(e) => setThreatLevel(e.target.value as ThreatLevelId)}
              >
                {THREAT_LEVELS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="block text-xs uppercase text-on-surface-variant">
              Peso (kg)
              <input
                type="number"
                min={0}
                step={0.1}
                className="input-feudal mt-1 pl-4"
                value={weightKg}
                onChange={(e) => setWeightKg(Number(e.target.value) || 0)}
              />
            </label>
          )}
        </div>

        {classification === 'monster' ? (
          <label className="block text-xs uppercase text-on-surface-variant md:max-w-xs">
            Peso (kg)
            <input
              type="number"
              min={0}
              step={0.1}
              className="input-feudal mt-1 pl-4"
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value) || 0)}
            />
          </label>
        ) : null}

        <label className="block text-xs uppercase text-on-surface-variant">
          Foto / ilustração
          <input
            type="file"
            accept="image/*"
            className="mt-2 block text-sm"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                setImageUrl(await readProfileImageFile(file))
                setError(null)
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Falha no upload')
              }
            }}
          />
          {imageUrl ? (
            <img src={imageUrl} alt="" className="mt-2 h-24 w-24 rounded border border-outline-variant/40 object-cover" />
          ) : null}
        </label>

        {classification === 'monster' ? (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block text-xs uppercase text-on-surface-variant">
                Tipo de monstro
                <select
                  className="input-feudal mt-1 pl-4 normal-case"
                  value={typeOptions.includes(creatureType) ? creatureType : 'Outro'}
                  onChange={(e) => {
                    const next = e.target.value
                    setCreatureType(next)
                    if (next !== 'Outro') setCustomCreatureType('')
                  }}
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              {creatureType === 'Outro' ? (
                <label className="block text-xs uppercase text-on-surface-variant md:col-span-2">
                  Escrever tipo
                  <input
                    className="input-feudal mt-1 pl-4 normal-case"
                    value={customCreatureType}
                    onChange={(e) => setCustomCreatureType(e.target.value)}
                    placeholder="Ex: Homúnculo de ossos"
                  />
                </label>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block text-xs uppercase text-on-surface-variant">
                HP máx.
                <input
                  type="number"
                  min={1}
                  className="input-feudal mt-1 pl-4"
                  value={hpMax}
                  onChange={(e) => setHpMax(Number(e.target.value) || 1)}
                />
              </label>
              <label className="block text-xs uppercase text-on-surface-variant">
                Mana máx.
                <input
                  type="number"
                  min={0}
                  className="input-feudal mt-1 pl-4"
                  value={manaMax}
                  onChange={(e) => setManaMax(Number(e.target.value) || 0)}
                />
              </label>
              <label className="block text-xs uppercase text-on-surface-variant">
                Camada do bestiário
                <select
                  className="input-feudal mt-1 pl-4 normal-case"
                  value={bestiaryTier}
                  onChange={(e) => setBestiaryTier(e.target.value as typeof bestiaryTier)}
                >
                  <option value="known">Conhecido</option>
                  <option value="classified">Classificado</option>
                  <option value="rumors">Rumores</option>
                </select>
              </label>
            </div>
            <GlossaryMonsterSheetFields
              creatureSize={creatureSize}
              creatureSpeed={creatureSpeed}
              creatureSenses={creatureSenses}
              defenseNote={defenseNote}
              primaryAttackName={primaryAttackName}
              primaryAttackDesc={primaryAttackDesc}
              secondaryAttackName={secondaryAttackName}
              secondaryAttackDesc={secondaryAttackDesc}
              sceneTrigger={sceneTrigger}
              narratorNotes={narratorNotes}
              creatureStats={creatureStats}
              passiveText={passiveText}
              onChange={(patch) => {
                if (patch.creatureSize !== undefined) setCreatureSize(patch.creatureSize)
                if (patch.creatureSpeed !== undefined) setCreatureSpeed(patch.creatureSpeed)
                if (patch.creatureSenses !== undefined) setCreatureSenses(patch.creatureSenses)
                if (patch.defenseNote !== undefined) setDefenseNote(patch.defenseNote)
                if (patch.primaryAttackName !== undefined) setPrimaryAttackName(patch.primaryAttackName)
                if (patch.primaryAttackDesc !== undefined) setPrimaryAttackDesc(patch.primaryAttackDesc)
                if (patch.secondaryAttackName !== undefined) setSecondaryAttackName(patch.secondaryAttackName)
                if (patch.secondaryAttackDesc !== undefined) setSecondaryAttackDesc(patch.secondaryAttackDesc)
                if (patch.sceneTrigger !== undefined) setSceneTrigger(patch.sceneTrigger)
                if (patch.narratorNotes !== undefined) setNarratorNotes(patch.narratorNotes)
                if (patch.creatureStats !== undefined) setCreatureStats(patch.creatureStats)
                if (patch.passiveText !== undefined) setPassiveText(patch.passiveText)
              }}
            />
          </div>
        ) : null}

        {classification === 'grimoire' ? (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs uppercase text-on-surface-variant">
              Tipo de magia
              <select
                className="input-feudal mt-1 pl-4 normal-case"
                value={magicType}
                onChange={(e) => setMagicType(e.target.value)}
              >
                {magicNames.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs uppercase text-on-surface-variant">
              Tempo de recarga
              <input
                className="input-feudal mt-1 pl-4 normal-case"
                value={cooldownText}
                onChange={(e) => setCooldownText(e.target.value)}
                placeholder="Ex: 2 rodadas"
              />
            </label>
          </div>
        ) : null}

        {classification === 'amulet' || classification === 'relic' ? (
          <div className="space-y-3">
            <label className="block text-xs uppercase text-on-surface-variant">
              Tipo de {classification === 'amulet' ? 'amuleto' : 'relíquia'}
              <select
                className="input-feudal mt-1 pl-4 normal-case"
                value={relicAmuletType}
                onChange={(e) => setRelicAmuletType(e.target.value)}
              >
                {relicNames.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="text-xs uppercase text-on-surface-variant">Atributos (máx. {MAX_ATTRIBUTE_MODS})</p>
              <ul className="mt-2 space-y-2">
                {mods.map((mod, idx) => (
                  <li key={idx} className="flex flex-wrap gap-2">
                    <select
                      className="input-feudal w-auto pl-3 normal-case"
                      value={mod.attr}
                      onChange={(e) =>
                        setMods((prev) => prev.map((m, i) => (i === idx ? { ...m, attr: e.target.value } : m)))
                      }
                    >
                      {ATTR_KEYS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="input-feudal w-24 pl-3"
                      value={mod.value}
                      onChange={(e) =>
                        setMods((prev) =>
                          prev.map((m, i) => (i === idx ? { ...m, value: Number(e.target.value) || 0 } : m)),
                        )
                      }
                    />
                    <button
                      type="button"
                      className="btn-secondary text-[10px]"
                      onClick={() => setMods((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
              {mods.length < MAX_ATTRIBUTE_MODS ? (
                <button
                  type="button"
                  className="btn-secondary mt-2 text-[10px]"
                  onClick={() => setMods((prev) => [...prev, { attr: 'mana', value: 1 }])}
                >
                  + atributo
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-xs text-on-surface-variant">
          <input
            type="checkbox"
            checked={publishOnSave}
            onChange={(e) => setPublishOnSave(e.target.checked)}
          />
          Publicar para jogadores ao salvar (sem isso fica só como rascunho na lista abaixo)
        </label>

        {error ? <p className="text-sm text-primary">{error}</p> : null}
        <button type="button" className="btn-primary text-sm" disabled={saving} onClick={submit}>
          {saving ? 'Salvando…' : publishOnSave ? 'Salvar e publicar' : 'Salvar rascunho'}
        </button>
      </section>

      <section className="mesa-panel p-5">
        <h3 className="font-label-sm text-xs text-secondary uppercase">Registros do glossário</h3>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,auto)_minmax(9rem,auto)] sm:items-center">
          <div className="relative min-w-0">
            <span className="material-symbols-outlined pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base text-on-surface-variant">
              search
            </span>
            <input
              className="input-feudal w-full pl-10"
              placeholder="Buscar registro do glossário…"
              value={registryQuery}
              onChange={(e) => setRegistryQuery(e.target.value)}
            />
          </div>
          <select className="input-feudal w-full pl-4 sm:w-auto" value={registryRarity} onChange={(e) => setRegistryRarity(e.target.value)}>
            <option value="all">Raridade: todas</option>
            <option value="ancestral">Raridade: Ancestral</option>
            <option value="raro">Raridade: Raro</option>
            <option value="incomum">Raridade: Incomum</option>
            <option value="comum">Raridade: Comum</option>
            <option value="proibido">Raridade: Proibido</option>
          </select>
          <select
            className="input-feudal w-full pl-4 sm:w-auto"
            value={registrySort}
            onChange={(e) => setRegistrySort(e.target.value as 'recent' | 'name')}
          >
            <option value="recent">Mais recentes</option>
            <option value="name">Nome A–Z</option>
          </select>
        </div>
        <ul className="mt-3 space-y-2">
          {filteredEntries.map((item) => (
            <li
              key={item.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm ${
                editingId === item.id ? 'border-secondary/50 bg-secondary/10' : 'border-outline-variant/40'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-outline">menu_book</span>
                )}
                <div>
                  <p className="font-serif text-on-surface">{item.name}</p>
                  <p className="text-xs text-on-surface-variant">
                    {item.classification ?? item._class}
                    {item.creatureType ? ` · ${item.creatureType}` : ''}
                    {item.threatLevel ? ` · ${item.threatLevel}` : ''} ·{' '}
                    {item.visibility === 'published' ? 'Publicado' : 'Rascunho'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-xs" onClick={() => loadItem(item)}>
                  Editar
                </button>
                {item.visibility === 'draft' ? (
                  <button type="button" className="btn-secondary text-xs" onClick={() => publish.mutate(item.id)}>
                    Publicar
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-xs text-on-surface-variant underline"
                  onClick={() => remove.mutate(item.id)}
                >
                  Excluir
                </button>
              </div>
            </li>
          ))}
          {filteredEntries.length === 0 ? (
            <li className="text-sm text-on-surface-variant">Nenhum registro neste filtro.</li>
          ) : null}
        </ul>
      </section>
    </div>
  )
}
