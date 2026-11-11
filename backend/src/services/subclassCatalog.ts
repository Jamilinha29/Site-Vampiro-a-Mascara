import { getSupabaseAdmin } from './supabaseClient.js'
import { listReference } from './referenceCatalog.js'

export const CHARACTER_CLASSES = [
  'Guerreiro',
  'Cavaleiro',
  'Clérigo',
  'Monge',
  'Ladino',
  'Caçador',
  'Erudito',
  'Diplomata',
  'Artesão',
  'Camponês',
  'Mercante',
  'Feiticeiro',
  'Bardo',
  'Combatente',
  'Sombra',
  'Arcanista',
  'Devoto',
  'Guardião',
  'Artífice',
  'Outro',
] as const

export function classFromHouse(house?: string | null) {
  if (!house) return null
  const parts = house.split(' · ').map((part) => part.trim()).filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if ((CHARACTER_CLASSES as readonly string[]).includes(parts[i])) return parts[i]
  }
  return null
}

export async function listSubclassesForClass(className: string) {
  const name = className.trim()
  if (!name) return []
  const imported = listReference('subclass')
    .filter((row) => row.className.toLowerCase() === name.toLowerCase())
    .map((row) => row.name)
  if (imported.length) return imported
  const sb = getSupabaseAdmin()
  if (!sb) return []
  const { data, error } = await sb
    .from('character_subclasses')
    .select('name, sort_order')
    .eq('class_name', name)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error || !data) return []
  return data.map((row) => String(row.name))
}
