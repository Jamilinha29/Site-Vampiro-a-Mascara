import { Router } from 'express'
import { z } from 'zod'
import { requireUser } from '../middlewares/optionalUser.js'
import { requireNarrator } from '../middlewares/requireNarrator.js'
import {
  createSentNotice,
  listNotificationsForUser,
  listSentNotices,
  markAllNotificationsRead,
  markNotificationsRead,
  unreadNotificationCount,
} from '../services/notificationStore.js'

export const notificationsRouter = Router()

notificationsRouter.use(requireUser)

notificationsRouter.get('/', (req, res) => {
  res.json(listNotificationsForUser(req.user!.email))
})

notificationsRouter.get('/unread-count', (req, res) => {
  res.json({ count: unreadNotificationCount(req.user!.email) })
})

const markSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
})

notificationsRouter.get('/sent', requireNarrator, (_req, res) => {
  res.json(listSentNotices())
})

const sendSchema = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(500),
})

notificationsRouter.post('/send', requireNarrator, (req, res, next) => {
  try {
    const body = sendSchema.parse(req.body)
    res.status(201).json(createSentNotice(body))
  } catch (e) {
    next(e)
  }
})

notificationsRouter.post('/mark-read', (req, res, next) => {
  try {
    const body = markSchema.parse(req.body)
    const email = req.user!.email
    if (body.all) {
      markAllNotificationsRead(email)
    } else if (body.ids?.length) {
      markNotificationsRead(email, body.ids)
    }
    res.json({ count: unreadNotificationCount(email) })
  } catch (e) {
    next(e)
  }
})
