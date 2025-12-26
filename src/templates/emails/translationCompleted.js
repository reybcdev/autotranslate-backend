import { baseEmailTemplate } from './baseTemplate.js'

export const translationCompletedTemplate = ({ filename, targetLang, downloadUrl, translationUrl }) => baseEmailTemplate({
  title: 'Translation completed ✅',
  subtitle: `Your file "${filename}" is ready in ${targetLang}.`,
  body: `
    <p>Hi there,</p>
    <p>Your file <strong>${filename}</strong> has been successfully translated to <strong>${targetLang}</strong>.</p>
    ${downloadUrl ? `<p>You can grab the translated version directly from here:</p>
      <p><a href="${downloadUrl}">Download translation</a></p>` : ''}
    <p>You can always review and manage every translation from your dashboard.</p>
  `,
  primaryAction: {
    label: 'View in dashboard',
    url: translationUrl
  },
  secondaryAction: downloadUrl ? {
    label: 'Download translation',
    url: downloadUrl
  } : null,
  footerText: "Didn't request this translation? Contact support so we can help."
})
