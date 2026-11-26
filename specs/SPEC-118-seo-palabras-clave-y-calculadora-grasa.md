# SPEC-118 — SEO por palabras clave + calculadora de grasa corporal + corrección de la fórmula US Navy

**Estado:** ✅ Cerrada (pendiente de push)
**Fase:** 4
**Severidad:** ALTO (por la fórmula)
**Fecha de creación:** 2026-11-26
**Autor:** Equipo Metamorfosis Real
**Depende de:** SPEC-117 (comparte archivos; se publican en el mismo commit)

---

## Contexto

Search Console, 25-ago a 24-nov-2026:

- 0 clics y 249 impresiones.
- 6 páginas indexadas y 32 sin indexar: 10 "rastreada: actualmente sin indexar" y 12 "descubierta: actualmente sin indexar".
- Las únicas búsquedas que muestran el sitio son variantes de "qué es IMR". No hay impresiones para ayuno intermitente, grasa corporal, glucosa ni sueño.

El autocompletado de Google (español, Colombia, 26-nov-2026) muestra búsquedas de herramienta que el sitio no responde:

- "calculadora de grasa corporal", "… de la marina", "… us navy"
- "índice cintura altura calculadora"
- "cómo medir grasa corporal con cinta métrica"

Además, `bodyFatNavy` usaba los coeficientes de la versión en pulgadas (86.010 / 70.041 / 36.76) con medidas en centímetros. Con 175 cm, cintura 90 y cuello 40 daba 25,8 % en lugar de 19,2 %. En mujeres llegaba a cifras imposibles (58,7 %).

## Problema

1. El sitio no aparece en las búsquedas del tema.
2. La fórmula de grasa corporal daba resultados incorrectos.

## Solución propuesta

1. **Corregir la fórmula:** pasar `bodyFatNavy` a la versión métrica.
   - Hombres: 495 / (1.0324 − 0.19077·log10(cintura − cuello) + 0.15456·log10(estatura)) − 450.
   - Mujeres: 495 / (1.29579 − 0.35004·log10(cintura + cadera − cuello) + 0.22100·log10(estatura)) − 450.
   - Un test comprueba que da lo mismo que la versión en pulgadas con las medidas convertidas.
2. **Crear `/calculadora-grasa-corporal`:** página pública, sin registro, que calcula en el navegador.
   - Calcula el % de grasa con la fórmula US Navy y el índice cintura-estatura.
   - Rangos de grasa del ACE y cortes del índice según NICE NG246.
   - Incluye cómo medirse, la tabla de rangos, enlaces a artículos, fuentes con enlace y JSON-LD de tipo WebApplication.
   - `/calculadora` redirige aquí (antes iba a `/quiz`).
3. **Títulos y descripciones por búsqueda real:**
   - 15 artículos, en `src/data/seoOverrides.ts`. El título nuevo se usa en el H1, el `<title>` y el JSON-LD. Los slugs no cambian.
   - Portada, `/quiz`, `/biblioteca` y `/comunidad`.
4. **Enlaces internos:** el botón secundario del hero y el pie de página llevan a la calculadora.

## Plan de implementación

1. `src/lib/imr/engine.ts`: fórmula métrica; `ENGINE_VERSION = 'spec-118-v1'`.
2. `src/lib/imr/engine.test.ts`: valores corregidos y test de equivalencia con la versión en pulgadas.
3. `src/pages/api/users/onboard.ts`: usar `ENGINE_VERSION` en lugar del texto fijo.
4. Crear `src/lib/calculators/bodyComposition.ts` y su test.
5. Crear `src/pages/calculadora-grasa-corporal.astro`.
6. `src/pages/calculadora.astro`: redirección a la calculadora.
7. Crear `src/data/seoOverrides.ts` y su test: títulos de 50 caracteres o menos, descripciones de 155 o menos, sin emojis y sin títulos repetidos.
8. `src/pages/posts/[slug].astro`: usar `getPostSeo`.
9. `index.astro`, `quiz.astro`, `biblioteca.astro`, `comunidad.astro`: título y descripción.
10. `Hero.astro` y `Footer.astro`: enlaces a la calculadora.
11. `sitemap.xml.ts`: añadir `/calculadora-grasa-corporal`.

## Criterios de aceptación

- `vitest`: 282/282.
- `astro build`: sin errores.
- En el servidor local de producción:
  - Los títulos nuevos aparecen en `/`, `/quiz`, `/biblioteca`, `/comunidad` y en la calculadora.
  - `/calculadora` responde 301 hacia `/calculadora-grasa-corporal`.
  - El sitemap incluye la calculadora.
- Los 15 slugs de `seoOverrides.ts` coinciden con los del sitemap en vivo.

## Pruebas manuales (después del push)

- **Calculadora, hombre:** 175 / 90 / 40 debe dar 19,2 %, "Rango promedio", ICE 0,51, "Riesgo aumentado".
- **Calculadora, mujer:** 165 / 80 / 33 / cadera 100 debe dar 31,9 % e ICE 0,48, "Saludable".
- **Search Console:** enviar de nuevo el sitemap y pedir la indexación de `/calculadora-grasa-corporal`, `/` y la guía de ayuno.

## Riesgos

- **La app Elena tiene el mismo error de fórmula** (`body_fat_calculator.dart`): pulgadas aplicadas a centímetros en hombres, y una tabla aproximada por índice cintura-estatura en mujeres. Mientras tanto, la app cita Hodgdon 1992 como fuente. Hay que corregirlo en la app, en otra spec del repositorio de la app.
- El H1 de la portada ("Te damos las herramientas…") no contiene palabras clave; se dejó por ser el lema de la marca.
- Las páginas sin indexar por calidad no se arreglan solo con títulos. Hacen falta contenido mejor y enlaces externos (YouTube).
- El artículo de los mitos de hidratación tiene voseo ("tomá", "tenés"). Se corrige en Firestore desde el panel.

## Resultado

Implementado el 26-nov-2026. Comprobado con tests, build y servidor local. No se probó el formulario en un navegador real antes del push.
