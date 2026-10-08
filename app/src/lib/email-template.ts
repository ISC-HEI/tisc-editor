// lib/email-template.ts
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type EmailOptions = {
  title: string;
  message: string;
  label?: string;
  code?: string;
  cta?: { label: string; url: string };
};

export function renderEmail({ title, message, label = 'TISC', code, cta }: EmailOptions) {
  const mono = `ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace`;
  const sans = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#fafafa;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafafa;">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:512px;">
            <tr>
              <td align="center" style="font-family:${sans};">

                <p style="margin:0;font-family:${mono};font-size:14px;letter-spacing:0.1em;color:#a3a3a3;">
                  ${escapeHtml(label)}
                </p>

                <h1 style="margin:12px 0 0;font-size:30px;line-height:36px;font-weight:600;letter-spacing:-0.025em;color:#171717;">
                  ${escapeHtml(title)}
                </h1>

                <p style="margin:12px auto 0;max-width:384px;font-size:14px;line-height:24px;color:#737373;">
                  ${escapeHtml(message).replace(/\n/g, '<br />')}
                </p>

                ${
                  code
                    ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:32px auto 0;max-width:320px;width:100%;background-color:#ffffff;border:1px solid #e5e5e5;border-radius:8px;">
                  <tr>
                    <td style="padding:12px 16px;text-align:left;font-family:${mono};font-size:12px;line-height:16px;">
                      <span style="color:#d4d4d4;padding-right:8px;">1</span><span style="color:#8b5cf6;">#info</span><span style="color:#a3a3a3;">:</span> <span style="color:#525252;">${escapeHtml(code)}</span>
                    </td>
                  </tr>
                </table>`
                    : ''
                }

                ${
                  cta
                    ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:32px auto 0;">
                  <tr>
                    <td align="center" style="background-color:#171717;border-radius:6px;">
                      <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:8px 16px;font-family:${sans};font-size:14px;font-weight:500;line-height:24px;color:#ffffff;text-decoration:none;">
                        ${escapeHtml(cta.label)}
                      </a>
                    </td>
                  </tr>
                </table>`
                    : ''
                }

              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
