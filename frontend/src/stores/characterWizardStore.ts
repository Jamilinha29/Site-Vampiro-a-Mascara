import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CreatedSkill } from '../types/profile'

export type WizardStepId =
  | 'lineage'
  | 'identity'
  | 'archetype'
  | 'attributes'
  | 'powers'
  | 'review'

export type AttributeCategory = 'Físicos' | 'Sociais' | 'Mentais'
export type AbilityCategory = 'Talentos' | 'Perícias' | 'Conhecimentos'
export type FaithOrientation = 'depois' | 'verdadeira' | 'paganismo'
export type FaithPathChoice = 'luz' | 'trevas'

export type SelectedWizardBlock = {
  step: WizardStepId
  id: string
  label: string
}

type WizardState = {
  species: string | null
  clanId: string | null
  clanName: string | null
  otherSpeciesKind: string | null
  otherSpeciesType: string | null
  faithOrientation: FaithOrientation | null
  faithPath: FaithPathChoice | null
  cathedralId: string | null
  cathedralName: string | null
  name: string
  title: string
  socialRank: string | null
  characterClass: string | null
  sire: string
  concept: string
  origin: string
  archetype: string | null
  demeanor: string | null
  ambition: string
  secretWeakness: string
  sireRelation: string
  attributes: Record<string, number>
  abilities: Record<string, number>
  createdSkills: CreatedSkill[]
  virtues: { conscience: number; selfControl: number; courage: number }
  hpDie: string
  hpValue: number | null
  manaDie: string
  manaValue: number | null
  oathAccepted: boolean
  selectedBlock: SelectedWizardBlock | null
  setSelectedBlock: (block: SelectedWizardBlock | null) => void
  setSpecies: (species: string) => void
  setClan: (clanId: string | null, clanName: string | null) => void
  setOtherSpecies: (kind: string | null, type?: string | null) => void
  setFaithOrientation: (v: FaithOrientation | null) => void
  setFaithPath: (v: FaithPathChoice | null) => void
  setCathedral: (id: string | null, name: string | null) => void
  setSocialRank: (v: string | null) => void
  setCharacterClass: (v: string | null) => void
  setIdentity: (
    patch: Partial<
      Pick<WizardState, 'name' | 'title' | 'sire' | 'concept' | 'origin' | 'ambition' | 'secretWeakness' | 'sireRelation'>
    >,
  ) => void
  setArchetype: (archetype: string) => void
  setDemeanor: (demeanor: string) => void
  setAttribute: (key: string, value: number) => void
  setAbility: (key: string, value: number) => void
  setCreatedSkills: (skills: CreatedSkill[]) => void
  setVirtue: (key: keyof WizardState['virtues'], value: number) => void
  setVitals: (
    patch: Partial<Pick<WizardState, 'hpDie' | 'hpValue' | 'manaDie' | 'manaValue'>>,
  ) => void
  setOathAccepted: (v: boolean) => void
  reset: () => void
}

export const defaultAttributes: Record<string, number> = {
  forca: 0,
  destreza: 0,
  vigor: 0,
  carisma: 0,
  manipulacao: 0,
  aparencia: 0,
  percepcao: 0,
  inteligencia: 0,
  raciocinio: 0,
}

export const defaultAbilities: Record<string, number> = {
  prontidao: 0,
  esportes: 0,
  briga: 0,
  esquiva: 0,
  empatia: 0,
  expressao: 0,
  intimidacao: 0,
  lideranca: 0,
  manha: 0,
  labia: 0,
  empatiaAnimais: 0,
  oficios: 0,
  conducao: 0,
  etiqueta: 0,
  armasFogo: 0,
  armasBrancas: 0,
  performance: 0,
  seguranca: 0,
  furtividade: 0,
  sobrevivencia: 0,
  academicos: 0,
  computadores: 0,
  financas: 0,
  investigacao: 0,
  direito: 0,
  linguistica: 0,
  medicina: 0,
  ocultismo: 0,
  politica: 0,
  ciencia: 0,
}

const defaultVirtues = { conscience: 0, selfControl: 0, courage: 0 }

function defaultSocialRank(species: string | null) {
  if (species === 'mortal') return 'Civil'
  if (species === 'vampiro') return 'Servo'
  if (species === 'outros') return 'Fera de baixo escalão'
  return null
}

const initial = {
  species: null as string | null,
  clanId: null as string | null,
  clanName: null as string | null,
  otherSpeciesKind: null as string | null,
  otherSpeciesType: null as string | null,
  faithOrientation: 'depois' as FaithOrientation | null,
  faithPath: null as FaithPathChoice | null,
  cathedralId: null as string | null,
  cathedralName: null as string | null,
  name: '',
  title: '',
  socialRank: null as string | null,
  characterClass: null as string | null,
  sire: '',
  concept: '',
  origin: '',
  archetype: null as string | null,
  demeanor: null as string | null,
  ambition: '',
  secretWeakness: '',
  sireRelation: '',
  attributes: { ...defaultAttributes },
  abilities: { ...defaultAbilities },
  createdSkills: [] as CreatedSkill[],
  virtues: { ...defaultVirtues },
  hpDie: 'D10',
  hpValue: null as number | null,
  manaDie: 'D12',
  manaValue: null as number | null,
  oathAccepted: false,
  selectedBlock: null as SelectedWizardBlock | null,
}

export const useCharacterWizardStore = create<WizardState>()(
  persist(
    (set, get) => ({
      ...initial,
      setSelectedBlock: (selectedBlock) => set({ selectedBlock }),
      setSpecies: (species) =>
        set({
          species,
          clanId: null,
          clanName: null,
          otherSpeciesKind: null,
          otherSpeciesType: null,
          socialRank: defaultSocialRank(species),
        }),
      setClan: (clanId, clanName) => set({ clanId, clanName }),
      setOtherSpecies: (kind, type = null) =>
        set({
          otherSpeciesKind: kind,
          otherSpeciesType: type ?? null,
        }),
      setFaithOrientation: (faithOrientation) => {
        if (faithOrientation === 'verdadeira') {
          set({
            faithOrientation,
            faithPath: 'luz',
            cathedralId: null,
            cathedralName: null,
          })
          return
        }
        if (faithOrientation === 'paganismo') {
          set({
            faithOrientation,
            faithPath: 'trevas',
            cathedralId: null,
            cathedralName: null,
          })
          return
        }
        set({
          faithOrientation,
          faithPath: null,
          cathedralId: null,
          cathedralName: null,
          concept: '',
        })
      },
      setFaithPath: (faithPath) =>
        set({
          faithPath,
          cathedralId: null,
          cathedralName: null,
        }),
      setCathedral: (cathedralId, cathedralName) => set({ cathedralId, cathedralName }),
      setSocialRank: (socialRank) =>
        set({
          socialRank,
          sire: socialRank === 'Nobre' ? get().sire : '',
        }),
      setCharacterClass: (characterClass) => set({ characterClass }),
      setIdentity: (patch) => set(patch),
      setArchetype: (archetype) => set({ archetype }),
      setDemeanor: (demeanor) => set({ demeanor }),
      setAttribute: (key, value) =>
        set({ attributes: { ...get().attributes, [key]: Math.max(0, Math.min(5, value)) } }),
      setAbility: (key, value) =>
        set({ abilities: { ...get().abilities, [key]: Math.max(0, Math.min(5, value)) } }),
      setCreatedSkills: (createdSkills) => set({ createdSkills }),
      setVirtue: (key, value) =>
        set({ virtues: { ...get().virtues, [key]: Math.max(0, Math.min(5, value)) } }),
      setVitals: (patch) => set(patch),
      setOathAccepted: (oathAccepted) => set({ oathAccepted }),
      reset: () =>
        set({
          ...initial,
          attributes: { ...defaultAttributes },
          abilities: { ...defaultAbilities },
          virtues: { ...defaultVirtues },
          createdSkills: [],
          hpValue: null,
          manaValue: null,
        }),
    }),
    { name: 'beladona-character-wizard' },
  ),
)

export function wizardHasFaith(state: {
  faithOrientation: FaithOrientation | null
  faithPath: FaithPathChoice | null
}) {
  if (state.faithPath === 'luz' || state.faithPath === 'trevas') return true
  return state.faithOrientation === 'verdadeira' || state.faithOrientation === 'paganismo'
}

export const ATTRIBUTE_GROUPS = [
  {
    category: 'Físicos' as AttributeCategory,
    items: [
      { key: 'forca', label: 'Força' },
      { key: 'destreza', label: 'Destreza' },
      { key: 'vigor', label: 'Vigor' },
    ],
  },
  {
    category: 'Sociais' as AttributeCategory,
    items: [
      { key: 'carisma', label: 'Carisma' },
      { key: 'manipulacao', label: 'Manipulação' },
      { key: 'aparencia', label: 'Aparência' },
    ],
  },
  {
    category: 'Mentais' as AttributeCategory,
    items: [
      { key: 'percepcao', label: 'Percepção' },
      { key: 'inteligencia', label: 'Inteligência' },
      { key: 'raciocinio', label: 'Raciocínio' },
    ],
  },
] as const

export const ABILITY_GROUPS = [
  {
    category: 'Talentos' as AbilityCategory,
    items: [
      { key: 'prontidao', label: 'Prontidão' },
      { key: 'esportes', label: 'Esportes' },
      { key: 'briga', label: 'Briga' },
      { key: 'esquiva', label: 'Esquiva' },
      { key: 'empatia', label: 'Empatia' },
      { key: 'expressao', label: 'Expressão' },
      { key: 'intimidacao', label: 'Intimidação' },
      { key: 'lideranca', label: 'Liderança' },
      { key: 'manha', label: 'Manha' },
      { key: 'labia', label: 'Lábia' },
    ],
  },
  {
    category: 'Perícias' as AbilityCategory,
    items: [
      { key: 'empatiaAnimais', label: 'Empatia c/ Animais' },
      { key: 'oficios', label: 'Ofícios' },
      { key: 'conducao', label: 'Condução' },
      { key: 'etiqueta', label: 'Etiqueta' },
      { key: 'armasFogo', label: 'Armas de Fogo' },
      { key: 'armasBrancas', label: 'Armas Brancas' },
      { key: 'performance', label: 'Performance' },
      { key: 'seguranca', label: 'Segurança' },
      { key: 'furtividade', label: 'Furtividade' },
      { key: 'sobrevivencia', label: 'Sobrevivência' },
    ],
  },
  {
    category: 'Conhecimentos' as AbilityCategory,
    items: [
      { key: 'academicos', label: 'Acadêmicos' },
      { key: 'computadores', label: 'Computadores' },
      { key: 'financas', label: 'Finanças' },
      { key: 'investigacao', label: 'Investigação' },
      { key: 'direito', label: 'Direito' },
      { key: 'linguistica', label: 'Linguística' },
      { key: 'medicina', label: 'Medicina' },
      { key: 'ocultismo', label: 'Ocultismo' },
      { key: 'politica', label: 'Política' },
      { key: 'ciencia', label: 'Ciência' },
    ],
  },
] as const
