import { resendClient, getResendFrom, getResendReplyTo } from '../config/resend.js'
import { translationCompletedTemplate } from '../templates/emails/translationCompleted.js'
import { translationFailedTemplate } from '../templates/emails/translationFailed.js'
import { creditsLowTemplate } from '../templates/emails/creditsLow.js'
import { logger } from '../utils/logger.js'
import { supabase } from '../config/supabase.js'
import { config } from '../config/index.js'

const FRONTEND_TRANSLATIONS_PATH = '/translations'
const FRONTEND_BILLING_PATH = '/billing'

const hasEmailConfig = () => Boolean(resendClient && getResendFrom())

const getSignedTranslationUrl = async (translatedFilePath) => {
  if (!translatedFilePath) {
    return null
  }

  const { data, error } = await supabase.storage
    .from('translations')
    .createSignedUrl(translatedFilePath, 3600)

  if (error) {
    logger.error('Failed to create signed translation URL:', error)
    return null
  }

  return data?.signedUrl || null
}

const sendEmail = async ({ to, subject, html }) => {
  if (!hasEmailConfig()) {
    logger.warn('Resend not configured; skipping email send')
    return null
  }

  if (!to) {
    logger.warn('No recipient email provided; skipping email send')
    return null
  }

  try {
    const response = await resendClient.emails.send({
      from: getResendFrom(),
      to,
      subject,
      html,
      reply_to: getResendReplyTo()
    })

    return response?.data || null
  } catch (error) {
    logger.error('Failed to send email:', error)
    return null
  }
}

export const sendTranslationCompletedEmail = async (userEmail, { translationId, filename, targetLang, translatedFilePath }) => {
  const downloadUrl = await getSignedTranslationUrl(translatedFilePath)
  const translationUrl = `${config.frontend.url}${FRONTEND_TRANSLATIONS_PATH}/${translationId}`

  return sendEmail({
    to: userEmail,
    subject: `Tu traducción de "${filename}" está lista`,
    html: translationCompletedTemplate({
      filename,
      targetLang,
      downloadUrl,
      translationUrl
    })
  })
}

export const sendTranslationFailedEmail = async (userEmail, { translationId, filename, errorMessage }) => {
  const translationUrl = `${config.frontend.url}${FRONTEND_TRANSLATIONS_PATH}/${translationId}`

  return sendEmail({
    to: userEmail,
    subject: `Problema con la traducción de "${filename}"`,
    html: translationFailedTemplate({
      filename,
      errorMessage,
      translationUrl
    })
  })
}

export const sendCreditsLowEmail = async (userEmail, { remainingCredits }) => {
  const topUpUrl = `${config.frontend.url}${FRONTEND_BILLING_PATH}`

  return sendEmail({
    to: userEmail,
    subject: 'Tus créditos de traducción están por agotarse',
    html: creditsLowTemplate({
      remainingCredits,
      topUpUrl
    })
  })
}
