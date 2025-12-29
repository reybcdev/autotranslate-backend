const LOGO_URL = 'https://uhenjhhnogpxryyrdtfp.supabase.co/storage/v1/object/public/assets/logo.png'

const defaultTheme = {
  background: '#f4f4f7',
  cardBackground: '#ffffff',
  border: '#eaeaea',
  heading: '#2b2d42',
  text: '#51545e',
  primary: '#5B5FC7',
  secondary: '#2b2d42',
  footer: '#9a9ea6',
  accent: '#f8f9fa'
}

const renderButton = (action, fallbackColor) => {
  if (!action?.label || !action?.url) {
    return ''
  }

  const background = action.color || fallbackColor

  return `
    <a href="${action.url}" style="
      display: inline-block;
      padding: 16px 36px;
      background: ${background};
      color: #ffffff;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      letter-spacing: 0.2px;
      box-shadow: 0 4px 12px rgba(91, 95, 199, 0.3);
      margin: 0 8px 12px 0;
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
  <body style="margin:0; padding:0; background:${colors.background};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${colors.background}; padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; background:${colors.cardBackground}; border-radius:12px; box-shadow:0 4px 16px rgba(15,23,42,0.08); overflow:hidden;">
            <tr>
              <td style="padding:32px; text-align:center; border-bottom:1px solid ${colors.border}; background:${colors.cardBackground};">
                <img src="${LOGO_URL}" alt="Adelante" width="140" style="display:block; margin:0 auto 12px;">
              </td>
            </tr>
            <tr>
              <td style="padding:40px; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <h1 style="margin:0 0 16px; font-size:24px; font-weight:600; color:${colors.primary}; text-align:center;">
                  ${title || 'Translation update'}
                </h1>
                ${subtitle ? `
                  <p style="margin:0 0 24px; font-size:16px; color:${colors.text}; line-height:1.6; text-align:center;">
                    ${subtitle}
                  </p>
                ` : ''}
                <div style="color:${colors.text}; font-size:15px; line-height:1.7; margin-bottom:32px;">
                  ${body || ''}
                </div>
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center" style="padding-bottom:8px;">
                      ${renderButton(primaryAction, colors.primary)}
                      ${renderButton(secondaryAction, colors.secondary)}
                    </td>
                  </tr>
                </table>
                ${footerText ? `
                  <div style="margin-top:32px; padding:20px; background:${colors.accent}; border-radius:8px; border:1px solid ${colors.border}; font-size:13px; color:${colors.text}; text-align:center;">
                    ${footerText}
                  </div>
                ` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px; background:${colors.accent}; border-top:1px solid ${colors.border}; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <p style="margin:0; font-size:12px; line-height:1.6; color:${colors.footer}; text-align:center;">
                  © ${new Date().getFullYear()} Adelante. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  `
}

