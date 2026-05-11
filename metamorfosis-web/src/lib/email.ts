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
 * Bloque de "lo que ya tienes disponible" (recursos del ecosistema).
 * Reusado en ambos templates (founder + standard) para mantener consistencia.
 */
const RESOURCES_HTML = `
  <p style="margin:0 0 16px;">Mientras tanto, lo que ya tienes disponible:</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr>
      <td style="padding:14px 18px;background:rgba(0,196,154,0.06);border:1px solid rgba(0,196,154,0.2);border-radius:12px;">
        <a href="https://metamorfosisvital.com.co/dashboard" style="color:#00C49A;text-decoration:none;font-weight:700;font-size:14px;">→ Tu dashboard personal</a>
      </td>
    </tr>
    <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>
    <tr>
      <td style="padding:14px 18px;background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:12px;">
        <a href="https://metamorfosisvital.com.co/biblioteca" style="color:#60a5fa;text-decoration:none;font-weight:700;font-size:14px;">→ Biblioteca de artículos científicos</a>
      </td>
    </tr>
    <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>
    <tr>
      <td style="padding:14px 18px;background:rgba(236,72,153,0.06);border:1px solid rgba(236,72,153,0.2);border-radius:12px;">
        <a href="https://metamorfosisvital.com.co/comunidad" style="color:#f472b6;text-decoration:none;font-weight:700;font-size:14px;">→ La Tribu (foro de la comunidad)</a>
      </td>
    </tr>
    <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>
    <tr>
      <td style="padding:14px 18px;background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.2);border-radius:12px;">
        <a href="https://www.youtube.com/@Metamorfosisreal" style="color:#a78bfa;text-decoration:none;font-weight:700;font-size:14px;">→ Canal de YouTube (formación completa)</a>
      </td>
    </tr>
  </table>
`;

const RESOURCES_TEXT = `Mientras tanto, lo que ya tienes disponible:
- Tu dashboard personal: https://metamorfosisvital.com.co/dashboard
- La biblioteca de artículos científicos: https://metamorfosisvital.com.co/biblioteca
- La Tribu (foro de la comunidad): https://metamorfosisvital.com.co/comunidad
- Canal de YouTube con la formación completa: https://www.youtube.com/@Metamorfosisreal`;

function wrapEmailHtml(opts: { subject: string; heading: string; bodyHtml: string }): string {
    return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${opts.subject}</title>
</head>
<body style="margin:0;padding:0;background:#050a12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f0f6ff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050a12;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#0c1422;border:1px solid rgba(255,255,255,0.08);border-radius:24px;overflow:hidden;">
          <tr>
            <td style="padding:40px 40px 24px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.06);">
              <div style="font-size:11px;font-weight:900;color:#3b82f6;letter-spacing:0.3em;text-transform:uppercase;margin-bottom:16px;">METAMORFOSIS REAL</div>
              <h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:900;color:#ffffff;">${opts.heading}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;color:#cbd5e1;font-size:15px;line-height:1.6;">
              ${opts.bodyHtml}
              <p style="margin:0 0 4px;color:#94a3b8;font-size:13px;">Cualquier duda, puedes responder directamente a este email.</p>
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
          Recibes este email porque te registraste en metamorfosisvital.com.co
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * SPEC-057: email de bienvenida para FUNDADORES (primeros 1000).
 *
 * Diferenciado del estándar:
 *   - Subject: "Eres fundador #N de Metamorfosis Real"
 *   - Bloque destacado con el número grande + los 2 beneficios garantizados
 *   - Tono celebratorio pero limpio (sin gritos comerciales)
 */
export async function sendFounderWelcomeEmail(input: {
    to: string;
    name?: string | null;
    founderNumber: number;
}): Promise<SendEmailResult> {
    const displayName = input.name?.trim() || 'biohacker';
    const n = input.founderNumber;
    const subject = `Eres fundador #${n} de Metamorfosis Real`;

    const text = `Hola ${displayName},

Bienvenido al ecosistema de Metamorfosis Real. Eres uno de los primeros 1000 que confiaron en este proyecto: eres el FUNDADOR #${n}.

🎁 BENEFICIOS GARANTIZADOS AL LANZAMIENTO DE ELENAAPP

1. Precio fundador permanente: descuento de por vida en la suscripción anual de ElenaApp.
2. Un beneficio sorpresa: se revela el día del lanzamiento de ElenaApp.

No tienes que hacer nada — cuando ElenaApp se lance, ingresas con tu mismo correo y la app te identifica automáticamente como fundador.

${RESOURCES_TEXT}

Cualquier duda, puedes responder directamente a este email.

— Carlos
Metamorfosis Real`;

    const bodyHtml = `
      <p style="margin:0 0 16px;">Bienvenido al ecosistema de Metamorfosis Real. Eres uno de los <strong style="color:#fde68a;">primeros 1000</strong> que confiaron en este proyecto.</p>

      <!-- NÚMERO DE FUNDADOR -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>
          <td style="padding:28px 22px;background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(0,196,154,0.10));border:1px solid rgba(245,158,11,0.35);border-radius:16px;text-align:center;">
            <div style="font-size:10px;font-weight:900;color:#f59e0b;letter-spacing:0.3em;text-transform:uppercase;margin-bottom:10px;">🎁 Acceso fundador</div>
            <div style="font-size:48px;font-weight:900;color:#ffffff;font-style:italic;line-height:1;letter-spacing:-2px;">#<span style="color:#fde68a;">${n}</span></div>
            <div style="font-size:11px;font-weight:900;color:#94a3b8;letter-spacing:0.3em;text-transform:uppercase;margin-top:10px;">de los primeros 1000</div>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 14px;font-weight:700;color:#ffffff;">Beneficios garantizados al lanzamiento de ElenaApp:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="padding:16px 18px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.25);border-radius:12px;">
            <div style="font-size:14px;font-weight:700;color:#fde68a;margin-bottom:4px;">1. Precio fundador permanente</div>
            <div style="font-size:13px;color:#cbd5e1;line-height:1.5;">Descuento de por vida en la suscripción anual de ElenaApp.</div>
          </td>
        </tr>
        <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>
        <tr>
          <td style="padding:16px 18px;background:rgba(0,196,154,0.06);border:1px solid rgba(0,196,154,0.25);border-radius:12px;">
            <div style="font-size:14px;font-weight:700;color:#00C49A;margin-bottom:4px;">2. Un beneficio sorpresa</div>
            <div style="font-size:13px;color:#cbd5e1;line-height:1.5;">Se revela el día del lanzamiento de ElenaApp.</div>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 24px;font-size:13px;color:#94a3b8;line-height:1.5;">No tienes que hacer nada — al iniciar sesión en ElenaApp con tu mismo correo, la app te identifica automáticamente como fundador.</p>

      ${RESOURCES_HTML}
    `;

    const html = wrapEmailHtml({
        subject,
        heading: `Eres fundador #${n}`,
        bodyHtml,
    });

    return sendEmail({ to: input.to, subject, html, text });
}

/**
 * SPEC-057: email de bienvenida ESTÁNDAR (post-cupo de fundadores).
 *
 * Para usuarios que se registran después del fundador #1000. Tono cálido
 * pero NO menciona los beneficios fundador (sería FOMO sin razón).
 */
export async function sendStandardWelcomeEmail(input: {
    to: string;
    name?: string | null;
}): Promise<SendEmailResult> {
    const displayName = input.name?.trim() || 'biohacker';
    const subject = `Bienvenido a Metamorfosis Real, ${displayName}`;

    const text = `Hola ${displayName},

Acabas de unirte al ecosistema de Metamorfosis Real. Tu perfil quedó creado y estás en la lista de espera de ElenaApp — la app móvil que va a optimizar tus hábitos diarios (ayuno, nutrición, ejercicio, hidratación, sueño).

${RESOURCES_TEXT}

Cualquier duda, puedes responder directamente a este email.

— Carlos
Metamorfosis Real`;

    const bodyHtml = `
      <p style="margin:0 0 24px;">Acabas de unirte al ecosistema de Metamorfosis Real. Tu perfil quedó creado y <strong style="color:#00C49A;">estás en la lista de espera de ElenaApp</strong> — la app móvil que va a optimizar tus hábitos diarios (ayuno, nutrición, ejercicio, hidratación, sueño).</p>

      ${RESOURCES_HTML}
    `;

    const html = wrapEmailHtml({
        subject,
        heading: `Bienvenido, ${displayName}`,
        bodyHtml,
    });

    return sendEmail({ to: input.to, subject, html, text });
}

/**
 * Wrapper de retrocompatibilidad. Si en el futuro algún caller olvida
 * pasar founderNumber, igual recibe el welcome estándar.
 *
 * @deprecated Usar `sendFounderWelcomeEmail` o `sendStandardWelcomeEmail`
 * directamente para que la decisión sea explícita en el callsite.
 */
export async function sendWelcomeEmail(input: {
    to: string;
    name?: string | null;
}): Promise<SendEmailResult> {
    return sendStandardWelcomeEmail(input);
}
