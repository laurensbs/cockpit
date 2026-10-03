import 'server-only'
import { emailStatus } from './status'

export interface Email {
  to: string
  subject: string
  html: string
  text: string
}

/** Sends one email through Resend. Never throws: a failed mail must not break the job that sent it. */
export async function sendEmail(email: Email): Promise<boolean> {
  if (emailStatus() !== 'live') {
    if (process.env.NODE_ENV !== 'production') console.info(`[email, not sent] ${email.subject}`)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) console.error(`[email] Resend answered ${res.status}`)
    return res.ok
  } catch (error) {
    console.error('[email] sending failed', error)
    return false
  }
}
