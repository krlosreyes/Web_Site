# SPEC-119 — Credibilidad del sitio, rediseño y boletín quincenal

Estado: IMPLEMENTADO (26-nov-2026). Incluye lo pendiente de SPEC-116 en los artículos.

## Objetivo

Que ninguna afirmación pública del sitio pueda señalarse como falsa, inventada
o sin respaldo, y que el sitio genere confianza y razones para volver.

## 1. Correcciones de contenido estático

| Dónde | Antes | Ahora |
|---|---|---|
| Portada, "Ciencia aplicada" | IMR que se ajusta "en tiempo real"; "70 % de los carbohidratos tras entrenar… sin elevar la insulina basal" | "Información que puedes verificar": fuentes, métodos públicos, no somos médicos |
| Portada, imagen de la app | Imagen generada, en inglés, con curva de glucosa de sensor CGM (la app no la tiene) | Lista de lo que registra Elena |
| Pilares | "autofagia… reparación celular profunda", "conductividad celular", "recuperación… absoluta" | Descripciones simples y verificables |
| Footer | "ingeniería humana para una vida sin límites" | "Salud metabólica con fuentes verificables. Información educativa, no consejo médico." |
| Menú | "La Tribu" en el menú principal | Sale del menú (queda en el footer como "Comunidad"); entra "Calculadora" |
| /comunidad | Caras de pravatar.cc + "+1k" (prueba social inventada); "la comunidad de biohacking más avanzada"; "Elena está lista para ayudarte" | Retirado; aviso de que el foro no reemplaza consulta médica |
| /imr | Voseo; "Sí (vía perímetros)"; "las más predictivas de longevidad"; "el indicador más predictivo"; "200 años"; "nunca se comparten"; cita de de Cabo & Mattson con autor equivocado | Corregido |
| /imr/metodologia | Fórmula Navy en pulgadas, motor spec-70.5-v1; "fórmula de la ADA"; "±3 % vs DEXA"; "clínicamente coherentes"; Ashwell & Hsieh atribuido a The Lancet; un solo informe Navy | Fórmula métrica, motor spec-118-v1 con nota pública de la corrección; Frankenfield 2005; error de unos 3,5 puntos; Ashwell & Hsieh 2005, Int J Food Sci Nutr 56(5):303-307; informes 84-11 y 84-29 |
| Nombre del índice | "Índice de Metamorfosis Real" (6 lugares, incluidas páginas legales) | "Índice Metabólico Real" |
| Test IMR | "Es el mejor predictor de tu metabolismo" | "Una de las medidas más útiles para estimar la grasa abdominal" |
| /elenasupport | App "en fase final de desarrollo", cohorte de acceso anticipado, sincronización del plan de 14 días | App disponible en App Store; preguntas actualizadas |
| Plan de 14 días | Agua con sal, "termogénesis", autofagia como hecho, "dosis mínima demostrada en metaanálisis", "reinicias el contador de insulina", cambios esperados en cm/kg, "la métrica más fiable", "Reserva tu lugar en ElenaApp" | Redacción según la evidencia, aviso médico el día 1, sin cifras inventadas |
| Correos | "lista de espera de ElenaApp", "Beneficios garantizados al lanzamiento", "basada en literatura revisada por pares", saludo "biohacker" | App disponible; beneficios remiten a la sección 5 de los términos |
| Dashboard, quiz de artículos, API leads | "Lista de espera" | Texto actual |
| SEO (seoOverrides) | Descripciones de Andrés y "3 pm" apoyadas en la sal | Reescritas |

## 2. Artículos en Firestore

`metamorfosis-web/scripts/spec119-correcciones-articulos.mjs`. Simulación por
defecto; `--aplicar` guarda respaldo JSON en `scripts/backups/` y escribe.
Probado contra el texto publicado: 43 de 43 correcciones encuentran su frase.

- Citas cuya cifra o conclusión no coincide con el estudio: Boschmann,
  Furmli (3 casos, no "50 % de los pacientes"), Ebbeling (BMJ, no JAMA IM),
  Hallberg, Schoenfeld (la duración de la repetición no cambia la hipertrofia),
  Mitchell (ratones), Tinsley (revisión), Orlich (vegetarianos, no
  crucíferas), Helgerud (~7 %), Xie (ratones), Shokri-Kojori (~5 %),
  Schoenfeld & Aragon (concluye lo contrario de lo citado), Spiegel, aceites
  de semillas, cronotipos, "80 % de los beneficios del ayuno".
- Sal contra la recomendación de la OMS en 5 artículos (SPEC-116 §4).
- "Reduce dosis de antidepresivos SSRI": reemplazado por no cambiar la dosis
  sin el médico (SPEC-116 §6).
- Artículo de Andrés: reescritura completa con el texto de SPEC-116 §3
  (caso declarado ilustrativo, sin protocolo de sal, quiz y referencias nuevos).
- 67 formas de voseo → tú.
- Se retira la autocita del canal de YouTube como referencia científica.
- "Fracasa en el 95 % de los casos" → "suele fracasar a largo plazo" (el slug
  no cambia).

## 3. Diseño (estilo oscuro)

- Acento cálido `--color-warm: #F4B860`, solo para detalles (etiquetas,
  puntos, subrayados).
- `--color-text-muted` de #64748b a #8a99ad (contraste AA en texto pequeño).
- Hero: subtítulo que dice qué hace el sitio; foto con personas desde
  `public/hero-personas.webp` (si no existe, se ve la foto anterior);
  animación apagada con `prefers-reduced-motion`; el titular ya no queda
  tapado por el menú en el celular.

## 4. Boletín quincenal

- `components/NewsletterSignup.astro` en portada, final de cada artículo y
  calculadora.
- `POST /api/newsletter`: casilla de autorización obligatoria (Ley 1581),
  honeypot, 5 intentos por hora por IP, id = hash del correo (sin duplicados
  ni enumeración), colección `newsletter_subscribers` (solo Admin SDK).
- Política de privacidad: finalidad y cómo darse de baja.
- Envío manual por ahora: exportar la colección cada 15 días.

Contenido de cada boletín:
1. El artículo nuevo de la quincena.
2. Recordatorio: "Mide tu cintura hoy y pásala por la calculadora".
3. Si corregimos algo, lo decimos.

## 5. Calendario de artículos (quincenal)

Palabras clave de partida (autocompletado de Google Colombia). Validar con
Search Console a los 60 días.

| Fecha | Tema | Palabra clave principal |
|---|---|---|
| 1-dic-2026 | Cómo medir tu cintura bien en casa | cómo medir la cintura |
| 15-dic-2026 | Índice cintura-estatura: qué es y qué rango es sano | índice cintura estatura |
| 1-ene-2027 | Ayuno intermitente para principiantes | ayuno intermitente para principiantes |
| 15-ene-2027 | ¿Qué rompe el ayuno? Café, té, edulcorantes y suplementos | qué rompe el ayuno |
| 1-feb-2027 | Grasa visceral: qué es, cómo se mide y qué la reduce | grasa visceral |
| 15-feb-2027 | Resistencia a la insulina: señales y qué exámenes pedir | resistencia a la insulina síntomas |
| 1-mar-2027 | Cuánta agua tomar al día según tu peso y actividad | cuánta agua tomar al día |
| 15-mar-2027 | Fuerza después de los 40 | ejercicio de fuerza después de los 40 |

Reglas para cada artículo nuevo:
- Cada cifra con su estudio, y el estudio dice exactamente eso.
- Decir si el estudio es en animales, observacional o un ensayo.
- Sin casos clínicos inventados; si es ilustrativo, se dice.
- Nada de sal "sin refinar" ni ajustes de medicación.
- Español neutro con tú.
- Título ≤ 50 caracteres y descripción ≤ 155 en `src/data/seoOverrides.ts`.

## Pendiente (decisiones de Carlos)

- Foto del hero: revisar y descargar la propuesta (Pexels 15475403, pareja en
  un parque de Puebla, licencia Pexels) u otra.
- Capturas reales de la versión publicada de Elena para la portada.
- "4.5K suscriptores" en el hero: confirmar la cifra actual.
- Términos, sección 5: sigue hablando de acceso anticipado y beneficios en la
  suscripción anual. Es un compromiso con usuarios registrados: revisar con
  criterio legal antes de cambiarlo.
- Los correos dicen "puedes responder directamente" pero salen de
  hola@metamorfosisvital.com.co sin reply_to: confirmar que ese buzón recibe.
