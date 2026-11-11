import { describe, expect, it } from 'vitest'
import {
  getResendClient,
  resetResendClientForTests,
  sendTransactionalEmail,
} from '../../backend/src/services/resendClient.js'

describe('resendClient', () => {
  it('returns null client when RESEND_API_KEY is missing', async () => {
    const prev = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    resetResendClientForTests()
    try {
      expect(getResendClient()).toBeNull()
      const result = await sendTransactionalEmail({
        to: 'jogador@teste.com',
        subject: 'Teste',
        html: '<p>ok</p>',
      })
      expect(result.ok).toBe(false)
      expect(result.reason).toBe('missing_api_key')
    } finally {
      if (prev) process.env.RESEND_API_KEY = prev
    }
  })
})
