import { baseEmailTemplate } from './baseTemplate.js'

export const creditsLowTemplate = ({ remainingCredits, topUpUrl }) => baseEmailTemplate({
  title: 'You’re running low on credits ⚡',
  subtitle: `Only ${remainingCredits} translation credits remain.`,
  body: `
    <p>Hi there,</p>
    <p>You’re close to running out of translation credits. Top up now to avoid any interruption in your workflows.</p>
  `,
  primaryAction: {
    label: 'Buy credits',
    url: topUpUrl,
    color: '#f97316'
  },
  footerText: 'Questions about billing? Reach out to our team anytime.',
  theme: {
    border: '#fde68a',
    primary: '#f97316'
  }
})
