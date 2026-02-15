import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { env } from '../config/env.js'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

interface PasswordResetEmailData {
  username: string
  resetUrl: string
  expiresInMinutes: number
}

interface EmailVerificationData {
  username: string
  verificationUrl: string
  expiresInMinutes: number
}

export class EmailService {
  private transporter: Transporter | null = null

  constructor() {
    this.initialize()
  }

  private initialize(): void {
    // Only initialize if SMTP is configured
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
      console.warn('Email service not configured - SMTP settings missing')
      return
    }

    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    })

    console.log(`[Email] SMTP configured: ${env.SMTP_HOST}:${env.SMTP_PORT} (secure=${env.SMTP_SECURE})`)
  }

  isConfigured(): boolean {
    return this.transporter !== null
  }

  async send(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.warn('Email not sent - SMTP not configured:', options.subject)
      return false
    }

    try {
      await this.transporter.sendMail({
        from: env.SMTP_FROM,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })
      console.log(`[Email] Sent "${options.subject}" to ${options.to}`)
      return true
    } catch (error) {
      console.error(`[Email] Failed to send "${options.subject}" to ${options.to}:`, error)
      return false
    }
  }

  async sendPasswordReset(email: string, data: PasswordResetEmailData): Promise<boolean> {
    const subject = 'Reset your Onyka password'

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fafafa; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #171717; border-radius: 16px; padding: 32px; border: 1px solid #262626;">
    <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 24px 0; color: #fafafa;">Password Reset</h1>

    <p style="color: #a1a1aa; margin: 0 0 16px 0; line-height: 1.6;">
      Hi ${data.username},
    </p>

    <p style="color: #a1a1aa; margin: 0 0 24px 0; line-height: 1.6;">
      We received a request to reset your Onyka password. Click the button below to create a new password.
    </p>

    <a href="${data.resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; margin: 0 0 24px 0;">
      Reset Password
    </a>

    <p style="color: #71717a; font-size: 14px; margin: 0 0 8px 0;">
      This link will expire in ${data.expiresInMinutes} minutes.
    </p>

    <p style="color: #71717a; font-size: 14px; margin: 0;">
      If you didn't request this, you can safely ignore this email.
    </p>

    <hr style="border: none; border-top: 1px solid #262626; margin: 32px 0;">

    <p style="color: #52525b; font-size: 12px; margin: 0;">
      Onyka - Your private notes
    </p>
  </div>
</body>
</html>
`

    const text = `
Password Reset

Hi ${data.username},

We received a request to reset your Onyka password. Click the link below to create a new password:

${data.resetUrl}

This link will expire in ${data.expiresInMinutes} minutes.

If you didn't request this, you can safely ignore this email.

- Onyka
`

    return this.send({ to: email, subject, html, text })
  }

  async sendEmailVerification(email: string, data: EmailVerificationData): Promise<boolean> {
    const subject = 'Verify your Onyka email'

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fafafa; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #171717; border-radius: 16px; padding: 32px; border: 1px solid #262626;">
    <h1 style="font-size: 24px; font-weight: 600; margin: 0 0 24px 0; color: #fafafa;">Verify Your Email</h1>

    <p style="color: #a1a1aa; margin: 0 0 16px 0; line-height: 1.6;">
      Hi ${data.username},
    </p>

    <p style="color: #a1a1aa; margin: 0 0 24px 0; line-height: 1.6;">
      Please verify your email address by clicking the button below.
    </p>

    <a href="${data.verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 500; margin: 0 0 24px 0;">
      Verify Email
    </a>

    <p style="color: #71717a; font-size: 14px; margin: 0 0 8px 0;">
      This link will expire in ${data.expiresInMinutes} minutes.
    </p>

    <hr style="border: none; border-top: 1px solid #262626; margin: 32px 0;">

    <p style="color: #52525b; font-size: 12px; margin: 0;">
      Onyka - Your private notes
    </p>
  </div>
</body>
</html>
`

    const text = `
Verify Your Email

Hi ${data.username},

Please verify your email address by clicking the link below:

${data.verificationUrl}

This link will expire in ${data.expiresInMinutes} minutes.

- Onyka
`

    return this.send({ to: email, subject, html, text })
  }
}

export const emailService = new EmailService()
