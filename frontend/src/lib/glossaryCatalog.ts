export const GLOSSARY_CLASSES = [
  { id: 'grimoire', label: 'Grimório' },
  { id: 'amulet', label: 'Amuleto' },
  { id: 'relic', label: 'Relíquia' },
  { id: 'monster', label: 'Monstro' },
] as const

export type GlossaryClassId = (typeof GLOSSARY_CLASSES)[number]['id']

export const MONSTER_TYPES = [
  'Vampiro',
  'Lobisomem',
  'Ghost / Espectro',
  'Demônio',
  'Colosso',
  'Bestas da noite',
  'Constructo',
  'Outro',
] as const

export const THREAT_LEVELS = [
  { id: 'inofensivo', label: 'Inofensivo' },
  { id: 'comum', label: 'Comum' },
  { id: 'perigoso', label: 'Perigoso' },
  { id: 'letal', label: 'Letal' },
  { id: 'cataclismico', label: 'Cataclísmico' },
] as const

export type ThreatLevelId = (typeof THREAT_LEVELS)[number]['id']

export const RELIC_AMULET_TYPES = [
  'Amuleto de proteção',
  'Amuleto de poder',
  'Relíquia sagrada',
  'Relíquia profana',
  'Talismã ancestral',
  'Artefato de corte',
  'Outro',
] as const

export const MAGIC_TYPES = [
  'Taumaturgia',
  'Necromancia',
  'Elemental',
  'Ilusão',
  'Bênção',
  'Maldição',
  'Ritual de sangue',
  'Outro',
] as const

export const ATTR_KEYS = [
  { id: 'forca', label: 'Força' },
  { id: 'velocidade', label: 'Velocidade' },
  { id: 'dano', label: 'Dano' },
  { id: 'mana', label: 'Mana' },
  { id: 'veneno', label: 'Veneno' },
  { id: 'maldicao', label: 'Maldição' },
  { id: 'defesa', label: 'Defesa' },
] as const

export const EQUIPMENT_TYPES = [
  'Espada longa',
  'Espada média',
  'Espada curta',
  'Lança',
  'Adaga',
  'Machado',
  'Arco',
  'Besta',
  'Escudo',
  'Armadura',
  'Elmo',
  'Grimório',
  'Relíquia de combate',
  'Outro',
] as const

export const SERVICE_TYPES = [
  'Treinamento — cavaleiro',
  'Treinamento — comerciante',
  'Treinamento — erudito',
  'Treinamento — assassino',
  'Limpeza',
  'Manutenção de armas',
  'Manutenção de armaduras',
  'Favor aleatório',
  'Outro',
] as const

export const CONSUMABLE_KINDS = [
  { id: 'daily', label: 'Equipamento diário' },
  { id: 'food', label: 'Alimento' },
] as const

export const MAX_ATTRIBUTE_MODS = 3
