export type NotificationKind = 'session' | 'chronicle' | 'system' | 'news'

export type AppNotification = {
  id: string
  kind: NotificationKind
  title: string
  message: string
  createdAt: string
  href: string | null
  unread: boolean
}
