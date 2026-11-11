import { Resend } from 'resend'

let client: Resend | null | undefined

export function getResendClient(): Resend | null {
  if (client !== undefined) return client
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    client = null
    return client
  }
  client = new Resend(key)
  return client
}

export function resetResendClientForTests() {
  client = undefined
}

export async function sendTransactionalEmail(input: {
  to: string
  subject: string
  html: string
}) {
  const resend = getResendClient()
  if (!resend) {
    return { ok: false as const, reason: 'missing_api_key' as const }
  }
  const from = process.env.RESEND_FROM?.trim() || 'Beladona <onboarding@resend.dev>'
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  })
  if (error) return { ok: false as const, reason: error.message }
  return { ok: true as const, id: data?.id }
}
