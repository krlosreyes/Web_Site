# SPEC-117 — Sitio sin datos personales del fundador + enlaces a Elena en App Store

**Estado:** ✅ Cerrada (pendiente de push)
**Fase:** 4
**Severidad:** ALTO
**Fecha de creación:** 2026-11-26
**Autor:** Equipo Metamorfosis Real
**Depende de:** ninguna

---

## Contexto

Elena se aprobó en App Store el 24-nov-2026 (solo iPhone, gratis): https://apps.apple.com/co/app/elena/id6778996786.
El sitio todavía la presentaba como "próximo nivel", con una lista de espera de "primeras 1000 personas" y una ventana emergente automática en la home.
Además, el sitio mostraba el nombre, la foto, la edad y la historia de salud personal del fundador. La decisión es que el sitio no muestre esos datos.

## Problema

1. El sitio expone datos personales del fundador fuera de lo que exige la ley.
2. Ninguna página llevaba a la app publicada, y varias piezas prometían cosas falsas: funciones que la app no tiene, cifras inventadas en la imagen para compartir y un botón falso.

## Solución propuesta

- **Datos personales:** se quitan de toda página no legal. El nombre se conserva solo en las páginas legales, que por la Ley 1581 de 2012 deben identificar al responsable del tratamiento: privacidad, privacidad de Elena, términos y aviso médico.
- **Enlaces:** un solo enlace canónico a App Store (`ELENA_APP_STORE_URL`), usado en todos los puntos de entrada.

## Plan de implementación

1. Crear `src/lib/constants/app.ts` con `ELENA_APP_STORE_URL`.
2. Crear `src/components/AppStoreButton.astro`. Es un botón de texto, no el distintivo oficial de Apple, y lleva el evento de Umami `cta_app_store` con su origen.
3. `src/components/ElenaAppCTA.tsx`: la pill del menú pasa a ser un enlace a App Store. Se retiran el modal de lista de espera y su apertura automática.
4. `src/components/Hero.astro`: el bloque "BETA · Cohorte 2026 activa" pasa a "Elena · Gratis en App Store".
5. `src/pages/index.astro`:
   - Sección de la app reescrita: "Ya disponible", el día metabólico, fuentes citadas y Apple Salud opcional.
   - Se quitan "Dynamic Protocol Logging", "Biometric Sync" y los recuadros flotantes "+14 % sensibilidad insulínica" y "Estado cetogénico".
   - Se actualiza la meta descripción.
6. `src/pages/imr.astro`: botón a App Store en el bloque final.
7. `src/components/PostCard.astro`: el botón falso "Activar Protocolo" pasa a ser un enlace real a App Store.
8. Crear `src/pages/sobre-nosotros.astro`: página del proyecto sin nombre, foto, edad ni historia de salud personal.
9. `src/pages/sobre-mi.astro` pasa a ser una redirección 301 a `/sobre-nosotros`. Se borra `sobre-mi.astro.bak`.
10. `src/components/Footer.astro` y `src/pages/sitemap.xml.ts`: "Sobre nosotros" en lugar de "Sobre mí".
11. `src/lib/email.ts`: la firma de los correos pasa de "— Carlos" a "— Equipo Metamorfosis Real".
12. Borrar `public/carlos-reyes.png` y `public/carlos-reyes.webp`.
13. `public/og-image.jpg`: se quitan las cifras inventadas ("10K+ usuarios activos", "94 % mejora metabólica") de la imagen que se ve al compartir el sitio.

Fuera de esta spec, dentro del trabajo en curso sin commitear de la SPEC-116: `author.ts`, `articleAuthor.ts` y su test pasan a firmar "Equipo Metamorfosis Real" como Organization y a enlazar `/sobre-nosotros`.

## Criterios de aceptación

- `/`, `/sobre-nosotros` e `/imr` no contienen "Reyes" en el HTML servido.
- `/sobre-mi` responde 301 hacia `/sobre-nosotros`.
- La home tiene 4 enlaces a `id6778996786`: menú de escritorio, menú móvil, bloque del hero y sección de la app.
- `/terminos` conserva el nombre del responsable.
- `vitest`: 255/255. `astro build`: sin errores.

## Pruebas manuales

- Abrir la home en el teléfono: la pill del menú abre App Store y ya no aparece la ventana emergente.
- Compartir la URL del sitio por WhatsApp: la vista previa ya no muestra las cifras.

## Riesgos

- `elena-mockup.webp` es una ilustración (curva de glucosa continua, interfaz en inglés) que no corresponde a la app real. Se cambió solo el texto alternativo; hay que reemplazarla por una captura real.
- Los artículos del blog viven en Firestore: si alguno menciona al fundador en el texto, hay que editarlo desde el panel de administración.
- Los comentarios del código y la página de App Store (vendedor: persona natural) siguen mostrando el nombre. La página de App Store solo cambia si la cuenta de desarrollador pasa a ser de una empresa.

## Resultado

Implementado el 26-nov-2026. Verificado con `vitest` (255/255), `astro build` y el servidor de producción local: rutas, redirección y conteo de enlaces según los criterios de aceptación.
