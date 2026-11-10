export type ChronicleAmbience = {
  environment: string
  climate: string
  moon: string
  atmosphere: string
}

export const DEFAULT_CHRONICLE_AMBIENCE: ChronicleAmbience = {
  environment: 'Interior urbano',
  climate: 'Névoa espessa',
  moon: 'Lua minguante',
  atmosphere: 'Máscara rígida',
}

export const CHRONICLE_AMBIENCE_OPTIONS: Record<keyof ChronicleAmbience, string[]> = {
  environment: [
    'Interior urbano',
    'Exterior urbano',
    'Ruínas',
    'Catedral / templo',
    'Floresta',
    'Catacumbas',
    'Ermida campestre',
    'Docas / cais',
  ],
  climate: ['Céu limpo', 'Névoa espessa', 'Chuva fina', 'Chuva de sangue', 'Tempestade', 'Geada', 'Vento cortante'],
  moon: ['Lua nova', 'Lua minguante', 'Lua cheia', 'Lua gibosa', 'Sem lua visível'],
  atmosphere: ['Máscara rígida', 'Tensão sectária', 'Caçada inquisitorial', 'Trégua frágil', 'Frenesi no ar'],
}

export const AMBIENCE_FIELD_LABELS: Record<keyof ChronicleAmbience, string> = {
  environment: 'Local narrativo',
  climate: 'Clima',
  moon: 'Lua',
  atmosphere: 'Tom da cena',
}

export function formatAmbienceChip(a: ChronicleAmbience) {
  return `${a.climate} · ${a.moon}`
}

/** Mapas/tokens não são hospedados aqui — o narrador usa call ou VTT externo. */
export const EXTERNAL_MAP_NOTICE =
  'Mapa e posicionamento ficam na sessão online do narrador (call, VTT ou link que ele enviar). Aqui você acompanha clima narrativo, teatro da mente, ficha e ameaças.'

export const EXTERNAL_MAP_NOTICE_ADMIN =
  'Local e mapa não são exibidos neste site. Defina o cenário na sessão online; use “Ambiente” só como rótulo narrativo para os jogadores.'
