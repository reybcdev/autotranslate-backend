import { baseEmailTemplate } from './baseTemplate.js'

export const translationFailedTemplate = ({ filename, errorMessage, translationUrl }) => baseEmailTemplate({
  title: 'Something went wrong ⚠️',
  subtitle: `We couldn't finish translating "${filename}".`,
  body: `
    <p>Hi there,</p>
    <p>We ran into an issue while translating <strong>${filename}</strong>.</p>
    <p style="background: #fee2e2; padding: 12px 16px; border-radius: 8px;">
      Reason: ${errorMessage}
    </p>
    <p>You can review the details in your dashboard and retry whenever you're ready.</p>
  `,
  primaryAction: {
    label: 'Review translation',
    url: translationUrl
  },
  footerText: 'Need help? Our support team is ready to assist you.',
  theme: {
    border: '#fecaca',
    text: '#7f1d1d',
    primary: '#b91c1c'
  }
})
