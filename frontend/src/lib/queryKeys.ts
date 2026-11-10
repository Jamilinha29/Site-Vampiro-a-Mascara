import type { QueryClient } from '@tanstack/react-query'

/** Cache do jogador — prefixo content-* / me / dashboard (não misturar com admin-*). */
export const playerQueryKeys = {
  dashboard: ['dashboard'] as const,
  profile: ['me-profile'] as const,
  scheduledSessions: ['scheduled-sessions'] as const,
  archive: (category: string) => ['content-archive', category] as const,
  shop: (category: string) => ['content-shop', category] as const,
  bestiary: (tier: string) => ['content-bestiary', tier] as const,
  downloads: (category: string) => ['content-downloads', category] as const,
  sceneThreats: (sessionId: string) => ['session-scene-threats', sessionId] as const,
  notifications: ['notifications'] as const,
  notificationsUnread: ['notifications', 'unread-count'] as const,
}

/** Cache do mestre — prefixo admin-* (rascunhos, handouts completos, analytics). */
export const adminQueryKeys = {
  entities: (kind: string) => ['admin-entities', kind] as const,
  handouts: ['admin-handouts'] as const,
  scheduledSessions: ['admin-scheduled-sessions'] as const,
  sessionLine: ['admin-session-line'] as const,
  mesaActivity: ['admin-mesa-activity'] as const,
  playerCharacters: ['admin-player-characters'] as const,
  mesaHandout: (sessionId: string) => ['admin-mesa-handout', sessionId] as const,
  sceneThreats: (sessionId: string) => ['session-scene-threats', sessionId] as const,
}

/** Após publicar conteúdo no admin, atualiza vitrines do jogador sem tocar cache admin. */
export function invalidatePlayerPublishedContent(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ['content-archive'] })
  void client.invalidateQueries({ queryKey: ['content-shop'] })
  void client.invalidateQueries({ queryKey: ['content-bestiary'] })
  void client.invalidateQueries({ queryKey: ['content-downloads'] })
  void client.invalidateQueries({ queryKey: playerQueryKeys.scheduledSessions })
  void client.invalidateQueries({ queryKey: playerQueryKeys.notifications })
  void client.invalidateQueries({ queryKey: playerQueryKeys.notificationsUnread })
}
