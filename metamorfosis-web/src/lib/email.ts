/**
 * Email transaccional via Resend (SPEC-029).
 *
 * Sin SDK — fetch directo a la API REST de Resend. Mantiene cero dependencias
 * nuevas y minimiza el bundle de Hostinger.
 *
 * Uso:
 *   await sendWelcomeEmail({ to: 'user@x.com', name: 'Carlos' });
 *
 * Comportamiento:
 *   - Si `RESEND_API_KEY` no está set: skip silencioso con warn (útil dev local).
 *   - Si la API responde !ok: throw con detalle. El caller decide si silenciar.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FROM = 'Metamorfosis Real <hola@metamorfosisvital.com.co>';

interface SendEmailInput {
    to: string;
    subject: string;
    html: string;
    text: string;
}

interface SendEmailResult {
    skipped?: boolean;
    id?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = import.meta.env.RESEND_API_KEY;
    if (!apiKey) {
        console.warn('[email] RESEND_API_KEY ausente — saltando envío a', input.to);
        return { skipped: true };
    }

    const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: FROM,
            to: [input.to],
            subject: input.subject,
            html: input.html,
            text: input.text,
        }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { id?: string };
    return { id: data.id };
}

/**
 * Email de bienvenida tras registro web (SPEC-029).
 * Template inline — paleta del sitio, mobile-friendly, sin tracking pixels.
 */
export async function sendWelcomeEmail(input: {
    to: string;
    name?: string | null;
}): Promise<SendEmailResult> {
    const displayName = input.name?.trim() || 'biohacker';
    const subject = `Bienvenido a Metamorfosis Real, ${displayName}`;

    // Plain text fallback — clientes que no renderizan HTML lo ven legible.
    const text = `Hola ${displayName},

Acabás de unirte al ecosistema de Metamorfosis Real. Tu perfil quedó creado y estás en la lista de espera de ElenaApp — la app móvil que va a optimizar tus hábitos diarios (ayuno, nutrición, ejercicio, hidratación, sueño).

Mientras tanto, lo que ya tenés disponible:
- Tu dashboard personal: https://metamorfosisvital.com.co/dashboard
- La biblioteca de artículos: https://metamorfosisvital.com.co/biblioteca
- El canal de YouTube con la formación completa: https://www.youtube.com/@Metamorfosisreal

Cuando ElenaApp esté lista, te avisamos por este mismo correo.

Cualquier duda, podés responderle directamente a este email.

— Carlos
Metamorfosis Real`;

    const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#050a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f0f6ff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050a12;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#0c1422;border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
          <tr>
            <td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px;font-weight:900;color:#3b82f6;letter-spacing:0.3em;text-transform:uppercase;margin-bottom:16px;">METAMORFOSIS REAL</div>
              <h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:900;color:#ffffff;">Bienvenido, ${displayName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;color:#cbd5e1;font-size:15px;line-height:1.6;">
              <p style="margin:0 0 16px;">Acabás de unirte al ecosistema de Metamorfosis Real. Tu perfil quedó creado y <strong style="color:#00C49A;">estás en la lista de espera de ElenaApp</strong> — la app móvil que va a optimizar tus hábitos diarios (ayuno, nutrición, ejercicio, hidratación, sueño).</p>
              <p style="margin:0 0 24px;">Mientras tanto, lo que ya tenés disponible:</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="padding:14px 18px;background:rgba(0,196,154,0.06);border:1px solid rgba(0,196,154,0.2);border-radius:12px;">
                    <a href="https://metamorfosisvital.com.co/dashboard" style="color:#00C49A;text-decoration:none;font-weight:700;font-size:14px;">→ Tu dashboard personal</a>
                  </td>
                </tr>
                <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:14px 18px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:12px;">
                    <a href="https://metamorfosisvital.com.co/biblioteca" style="color:#60a5fa;text-decoration:none;font-weight:700;font-size:14px;">→ Biblioteca de artículos</a>
                  </td>
                </tr>
                <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:14px 18px;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.2);border-radius:12px;">
                    <a href="https://www.youtube.com/@Metamorfosisreal" style="color:#a78bfa;text-decoration:none;font-weight:700;font-size:14px;">→ Canal de YouTube (formación completa)</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;">Cuando ElenaApp esté lista, te avisamos por este mismo correo.</p>
              <p style="margin:0 0 4px;color:#94a3b8;font-size:13px;">Cualquier duda, podés responderle directamente a este email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;color:#64748b;font-size:12px;">
              <p style="margin:0 0 6px;font-weight:700;color:#cbd5e1;">— Carlos</p>
              <p style="margin:0;font-family:ui-monospace,monospace;letter-spacing:0.1em;">METAMORFOSIS REAL</p>
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-size:11px;color:#475569;font-family:ui-monospace,monospace;">
          Recibís este email porque te registraste en metamorfosisvital.com.co
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return sendEmail({ to: input.to, subject, html, text });
}
