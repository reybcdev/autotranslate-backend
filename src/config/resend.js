import { Resend } from 'resend'
import { config } from './index.js'
import { logger } from '../utils/logger.js'

if (!config.resend.apiKey) {
  logger.warn('Warning: Resend API key not configured')
}

export const resendClient = config.resend.apiKey
  ? new Resend(config.resend.apiKey)
  : null

export const getResendFrom = () => config.resend.fromEmail
export const getResendReplyTo = () => config.resend.replyTo
