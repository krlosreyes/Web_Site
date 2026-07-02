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
    /** SPEC-112: reply_to opcional. Útil cuando el email va a un tercero
     *  (ej. Carlos) pero la respuesta natural debe ir al remitente original
     *  (ej. el usuario que abrió un ticket de soporte). */
    replyTo?: string;
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
            ...(input.replyTo ? { reply_to: input.replyTo } : {}),
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
 * SPEC-057 + SPEC-096: email de bienvenida para usuarios con ACCESO
 * ANTICIPADO (primeros 1000 registrados; internamente `founder.isFounder`).
 *
 * Diferenciado del estándar:
 *   - Subject: "Tu acceso anticipado a ElenaApp está reservado"
 *   - Bloque destacado con los 2 beneficios garantizados
 *   - Tono cálido sin transaccionalidad ("fundador" generaba ansiedad)
 *
 * Nota: el nombre de la función `sendFounderWelcomeEmail` y el parámetro
 * `founderNumber` se mantienen porque son nombres internos del schema.
 * El usuario solo ve el copy del email, no estos identificadores.
 */
export async function sendFounderWelcomeEmail(input: {
    to: string;
    name?: string | null;
    founderNumber: number;
}): Promise<SendEmailResult> {
    const displayName = input.name?.trim() || 'biohacker';
    const subject = `Tu acceso anticipado a ElenaApp está reservado`;

    const text = `Hola ${displayName},

Bienvenido al ecosistema de Metamorfosis Real. Tu lugar entre los primeros usuarios de ElenaApp está reservado.

🚀 BENEFICIOS GARANTIZADOS AL LANZAMIENTO

1. Precio preferencial en la suscripción anual de ElenaApp.
2. Beneficios exclusivos de lanzamiento: ventajas reservadas para usuarios con acceso anticipado.

No tienes que hacer nada — cuando ElenaApp se lance, ingresas con tu mismo correo y la app te identifica automáticamente.

${RESOURCES_TEXT}

Cualquier duda, puedes responder directamente a este email.

— Carlos
Metamorfosis Real`;

    const bodyHtml = `
      <p style="margin:0 0 16px;">Bienvenido al ecosistema de Metamorfosis Real. Tu lugar entre los <strong style="color:#00C49A;">primeros usuarios</strong> de ElenaApp está reservado.</p>

      <!-- BADGE DE ACCESO ANTICIPADO -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>
          <td style="padding:28px 22px;background:linear-gradient(135deg,rgba(0,196,154,0.15),rgba(0,196,154,0.05));border:1px solid rgba(0,196,154,0.35);border-radius:16px;text-align:center;">
            <div style="font-size:10px;font-weight:900;color:#00C49A;letter-spacing:0.3em;text-transform:uppercase;margin-bottom:10px;">🚀 Acceso anticipado</div>
            <div style="font-size:24px;font-weight:900;color:#ffffff;font-style:italic;line-height:1.2;letter-spacing:-0.5px;">Tu lugar está reservado</div>
            <div style="font-size:11px;font-weight:900;color:#94a3b8;letter-spacing:0.3em;text-transform:uppercase;margin-top:10px;">en ElenaApp</div>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 14px;font-weight:700;color:#ffffff;">Beneficios garantizados al lanzamiento:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="padding:16px 18px;background:rgba(0,196,154,0.06);border:1px solid rgba(0,196,154,0.25);border-radius:12px;">
            <div style="font-size:14px;font-weight:700;color:#00C49A;margin-bottom:4px;">1. Precio preferencial</div>
            <div style="font-size:13px;color:#cbd5e1;line-height:1.5;">Condiciones especiales en la suscripción anual de ElenaApp por registro anticipado.</div>
          </td>
        </tr>
        <tr><td style="height:8px;line-height:8px;">&nbsp;</td></tr>
        <tr>
          <td style="padding:16px 18px;background:rgba(0,196,154,0.06);border:1px solid rgba(0,196,154,0.25);border-radius:12px;">
            <div style="font-size:14px;font-weight:700;color:#00C49A;margin-bottom:4px;">2. Beneficios exclusivos de lanzamiento</div>
            <div style="font-size:13px;color:#cbd5e1;line-height:1.5;">Ventajas reservadas para usuarios que se registraron antes del lanzamiento oficial.</div>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 24px;font-size:13px;color:#94a3b8;line-height:1.5;">No tienes que hacer nada — al iniciar sesión en ElenaApp con tu mismo correo, la app te identifica automáticamente.</p>

      ${RESOURCES_HTML}
    `;

    const html = wrapEmailHtml({
        subject,
        heading: `Tu acceso está reservado`,
        bodyHtml,
    });

    return sendEmail({ to: input.to, subject, html, text });
}

/**
 * SPEC-057 + SPEC-096: email de bienvenida ESTÁNDAR (post-cupo de
 * acceso anticipado).
 *
 * Para usuarios que se registran después del cupo de los primeros 1000.
 * Tono cálido pero NO menciona los beneficios de acceso anticipado
 * (sería FOMO sin razón, ese cupo ya está cerrado).
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

/**
 * SPEC-104: anuncio del Plan IMR de 14 días a fundadores existentes.
 *
 * Diseñado para enviarse UNA sola vez por fundador (idempotencia via
 * `founder.planAnnouncementSentAt` en Firestore). Anuncia el nuevo
 * beneficio + explica brevemente cómo funciona + CTA al dashboard.
 *
 * NO personaliza por pilar débil — el plan que verá al llegar al
 * dashboard sí está personalizado. Mantener el email genérico
 * simplifica el envío bulk y evita complejidad innecesaria.
 */
export async function sendFounderPlanAnnouncementEmail(input: {
    to: string;
    name?: string | null;
}): Promise<SendEmailResult> {
    const displayName = input.name?.trim() || 'biohacker';
    const subject = 'Nuevo beneficio: tu Plan IMR de 14 días está listo';

    const text = `Hola ${displayName},

Como parte de la cohorte fundadora de Metamorfosis Real, ahora tienes acceso a un beneficio nuevo: tu Plan IMR personalizado de 14 días.

¿QUÉ ES?

Una ruta secuencial de 14 días que toma los resultados de tu diagnóstico IMR y los traduce en una acción concreta por día. Cada acción está enfocada en tu pilar de mayor oportunidad (Estructura, Metabolismo o Conducta) y está basada en literatura científica revisada por pares.

¿CÓMO FUNCIONA?

- Solo ves un día a la vez. Te enfocas en ejecutar esa acción.
- Cuando la cumples, marcas el día como completado y se desbloquea el siguiente.
- Tu progreso se guarda automáticamente — puedes entrar desde cualquier dispositivo.
- Al completar los 14 días, tu metabolismo opera con un nuevo baseline.

Sin notificaciones agresivas. Sin penalización si pierdes un día. Avanzas a tu ritmo.

→ Empezar mi plan IMR
https://metamorfosisvital.com.co/dashboard/plan

${RESOURCES_TEXT}

Cualquier duda, puedes responder directamente a este email.

— Carlos
Metamorfosis Real`;

    const bodyHtml = `
      <p style="margin:0 0 16px;">Como parte de la <strong style="color:#00C49A;">cohorte fundadora</strong> de Metamorfosis Real, ahora tienes acceso a un beneficio nuevo: tu <strong style="color:#ffffff;">Plan IMR personalizado de 14 días</strong>.</p>

      <!-- BADGE NUEVO BENEFICIO -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>
          <td style="padding:28px 22px;background:linear-gradient(135deg,rgba(0,196,154,0.15),rgba(0,196,154,0.05));border:1px solid rgba(0,196,154,0.35);border-radius:16px;text-align:center;">
            <div style="font-size:10px;font-weight:900;color:#00C49A;letter-spacing:0.3em;text-transform:uppercase;margin-bottom:10px;">🎯 Nuevo beneficio</div>
            <div style="font-size:24px;font-weight:900;color:#ffffff;font-style:italic;line-height:1.2;letter-spacing:-0.5px;">Tu Plan IMR · 14 días</div>
            <div style="font-size:11px;font-weight:900;color:#94a3b8;letter-spacing:0.3em;text-transform:uppercase;margin-top:10px;">Listo para empezar</div>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 12px;font-weight:700;color:#ffffff;font-size:15px;">¿Qué es?</p>
      <p style="margin:0 0 22px;">Una ruta secuencial de 14 días que toma los resultados de tu diagnóstico IMR y los traduce en una acción concreta por día. Cada acción está enfocada en tu pilar de mayor oportunidad (Estructura, Metabolismo o Conducta) y está basada en literatura científica revisada por pares.</p>

      <p style="margin:0 0 12px;font-weight:700;color:#ffffff;font-size:15px;">¿Cómo funciona?</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
        <tr>
          <td style="padding:14px 18px;background:rgba(0,196,154,0.06);border:1px solid rgba(0,196,154,0.25);border-radius:12px;">
            <div style="font-size:13px;color:#cbd5e1;line-height:1.6;">
              <strong style="color:#00C49A;">·</strong> Solo ves un día a la vez. Te enfocas en ejecutar esa acción.<br/>
              <strong style="color:#00C49A;">·</strong> Cuando la cumples, marcas el día como completado y se desbloquea el siguiente.<br/>
              <strong style="color:#00C49A;">·</strong> Tu progreso se guarda automáticamente — entras desde cualquier dispositivo.<br/>
              <strong style="color:#00C49A;">·</strong> Al completar los 14 días, tu metabolismo opera con un nuevo baseline.
            </div>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 24px;font-size:13px;color:#94a3b8;line-height:1.5;">Sin notificaciones agresivas. Sin penalización si pierdes un día. Avanzas a tu ritmo.</p>

      <!-- CTA PRINCIPAL -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
        <tr>
          <td align="center" style="padding:0;">
            <a href="https://metamorfosisvital.com.co/dashboard/plan" style="display:inline-block;padding:14px 32px;background:#00C49A;color:#050a12;text-decoration:none;font-weight:800;font-size:15px;border-radius:12px;letter-spacing:-0.2px;">
              Empezar mi plan IMR →
            </a>
          </td>
        </tr>
      </table>

      ${RESOURCES_HTML}
    `;

    const html = wrapEmailHtml({
        subject,
        heading: 'Tu plan está listo',
        bodyHtml,
    });

    return sendEmail({ to: input.to, subject, html, text });
}

/**
 * SPEC-112: notificación a Carlos de un nuevo ticket de soporte de ElenaApp.
 *
 * Se dispara desde POST /api/support/elena después de persistir el ticket.
 * Best-effort: si Resend falla, el ticket ya está en Firestore y Carlos
 * puede verlo desde el admin (a futuro, cuando SPEC-113 agregue el tab).
 *
 * `to` viene de la env var `SUPPORT_EMAIL_TO` con fallback a la cuenta admin
 * de Carlos para que funcione out-of-the-box sin configuración extra.
 */
export interface SupportTicketEmailInput {
    ticketId: string;
    source: 'authenticated' | 'anonymous';
    uid?: string | null;
    name: string;
    email: string;
    category: string;
    message: string;
    userAgent?: string | null;
}

const SUPPORT_EMAIL_FALLBACK = 'krlosreyes2@gmail.com';

const CATEGORY_LABELS: Record<string, string> = {
    tecnico: 'Problema técnico',
    cuenta: 'Cuenta y acceso',
    contenido: 'Contenido / información',
    feedback: 'Sugerencia o feedback',
    otro: 'Otro',
};

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export async function sendSupportTicketEmail(
    input: SupportTicketEmailInput
): Promise<SendEmailResult> {
    const to =
        (import.meta.env.SUPPORT_EMAIL_TO as string | undefined) ||
        SUPPORT_EMAIL_FALLBACK;

    const categoryLabel = CATEGORY_LABELS[input.category] ?? input.category;
    const subject = `[Soporte ElenaApp] ${categoryLabel} — ${input.name}`;
    const sourceLabel =
        input.source === 'authenticated'
            ? `Autenticado (uid: ${input.uid ?? '?'})`
            : 'Anónimo';

    const bodyHtml = `
      <p style="margin:0 0 24px;font-size:16px;color:#f0f6ff;font-weight:700;">Nuevo ticket de soporte de ElenaApp</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:14px 18px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Ticket</div>
            <div style="font-family:ui-monospace,monospace;font-size:13px;color:#cbd5e1;">${escapeHtml(input.ticketId)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Categoría</div>
            <div style="color:#f0f6ff;">${escapeHtml(categoryLabel)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Nombre</div>
            <div style="color:#f0f6ff;">${escapeHtml(input.name)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Email</div>
            <div style="color:#f0f6ff;"><a href="mailto:${escapeHtml(input.email)}" style="color:#00C49A;text-decoration:none;">${escapeHtml(input.email)}</a></div>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 18px;">
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:4px;">Origen</div>
            <div style="color:#94a3b8;font-size:13px;">${escapeHtml(sourceLabel)}</div>
          </td>
        </tr>
      </table>
      <div style="padding:16px 18px;background:rgba(0,196,154,0.06);border:1px solid rgba(0,196,154,0.2);border-radius:12px;margin:0 0 24px;">
        <div style="font-size:11px;color:#00C49A;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:8px;font-weight:700;">Mensaje del usuario</div>
        <div style="color:#e2e8f0;white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(input.message)}</div>
      </div>
      <p style="margin:0 0 12px;font-size:13px;color:#94a3b8;">Puedes responder directamente a este email — la conversación llega al usuario.</p>
    `;

    const text = `Nuevo ticket de soporte de ElenaApp

Ticket: ${input.ticketId}
Categoría: ${categoryLabel}
Nombre: ${input.name}
Email: ${input.email}
Origen: ${sourceLabel}

Mensaje:
${input.message}

Responde a este email para contestar al usuario.`;

    const html = wrapEmailHtml({
        subject,
        heading: 'Nuevo ticket de soporte',
        bodyHtml,
    });

    // Sobrescribimos el destinatario del sendEmail estándar porque va a Carlos,
    // no al usuario. `replyTo` = email del user para que "Reply" en Gmail
    // dispare la conversación directa con quien reportó el ticket.
    return sendEmail({
        to,
        subject,
        html,
        text,
        replyTo: input.email,
    });
}
