const defaultTheme = {
  background: '#f8fafc',
  cardBackground: '#ffffff',
  border: '#e2e8f0',
  heading: '#0f172a',
  text: '#475569',
  primary: '#2563eb',
  secondary: '#0f172a',
  footer: '#94a3b8'
}

const renderButton = (action, fallbackColor) => {
  if (!action?.label || !action?.url) {
    return ''
  }

  const background = action.color || fallbackColor

  return `
    <a href="${action.url}" style="
      display: inline-block;
      padding: 12px 20px;
      background: ${background};
      color: #ffffff;
      border-radius: 999px;
      font-weight: 600;
      text-decoration: none;
      margin: 8px 6px 0 0;
    ">
      ${action.label}
    </a>
  `
}

export const baseEmailTemplate = ({
  title,
  subtitle,
  body,
  primaryAction,
  secondaryAction,
  footerText,
  theme = {}
}) => {
  const colors = { ...defaultTheme, ...theme }

  return `
  <div style="
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: ${colors.background};
    padding: 32px 16px;
  ">
    <div style="
      max-width: 560px;
      margin: 0 auto;
      background: ${colors.cardBackground};
      border: 1px solid ${colors.border};
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.10);
    ">
      <h1 style="
        color: ${colors.heading};
        margin: 0 0 8px;
        font-size: 24px;
        line-height: 1.3;
      ">
        ${title || 'Translation update'}
      </h1>
      ${subtitle ? `
        <p style="color: ${colors.text}; margin: 0 0 18px; font-size: 15px;">
          ${subtitle}
        </p>
      ` : ''}
      <div style="
        color: ${colors.text};
        font-size: 15px;
        line-height: 1.6;
        margin-bottom: 24px;
      ">
        ${body || ''}
      </div>
      <div>
        ${renderButton(primaryAction, colors.primary)}
        ${renderButton(secondaryAction, colors.secondary)}
      </div>
      ${footerText ? `
        <p style="
          color: ${colors.footer};
          font-size: 12px;
          margin-top: 32px;
        ">
          ${footerText}
        </p>
      ` : ''}
    </div>
  </div>
  `
}
