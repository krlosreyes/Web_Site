# SPEC-062 — Fix generador de slug (transliterar tildes y eñes)

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — SEO + UX
**Severidad:** ALTO (URLs ilegibles + SEO penalizado)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-015 (drafts + admin posts API)

---

## Contexto

Los slugs de los 10 artículos publicados tenían caracteres mutilados:

| Título original | Slug generado | Slug correcto esperado |
|---|---|---|
| ¿Por qué te da sueño...? | `por-qu-te-da-sueo-...` | `por-que-te-da-sueno-...` |
| El Botón de Reinicio... | `el-botn-de-reinicio-...` | `el-boton-de-reinicio-...` |
| ¿Sabías que tu cena...? | `sabas-que-tu-cena-...` | `sabias-que-tu-cena-...` |
| ¿Te enseñó a usar? | `que-nadie-te-ense-a-usar` | `que-nadie-te-enseno-a-usar` |

**Por qué pasaba:** el generador (en `pages/api/admin/posts.ts` línea 118)
usaba `replace(/[^\w\-]+/g, '')` para limpiar el slug. El `\w` de JavaScript
matchea solo `[A-Za-z0-9_]` ASCII por default — todas las tildes y eñes
caían en el "todo lo demás" y se eliminaban.

**Consecuencias:**
- **URLs ilegibles**: "sueo", "qu", "ense", "sabas" no son palabras. El usuario que ve la URL no entiende qué hay del otro lado.
- **SEO penalizado**: Google le da peso a las keywords en el path. "sueño" en el slug es relevante para búsquedas de "sueño después comer"; "sueo" no matchea.
- **Sharing perjudicado**: la URL pegada en WhatsApp/redes se ve rota.

## Decisión: regenerar, no migrar

Carlos decidió eliminar los 10 artículos viejos y regenerarlos con el flujo
corregido. **No se mantienen redirects 301** porque el contenido va a ser
reemplazado completamente (no es solo cambio de URL — son nuevos artículos
producidos con los 5 prompts del informe pre-lanzamiento).

Implicaciones:
- Si Google ya indexó algún slug viejo, va a empezar a recibir 404 y los va a desindexar en su próximo crawl (típicamente 1-2 semanas). Aceptable porque el sitio todavía es nuevo y los slugs viejos no acumularon backlinks externos significativos.
- Si alguien tiene un slug viejo guardado/compartido, va a recibir 404.
  Carlos puede compensar con redirects manuales si aparece tráfico real
  a alguno, pero NO hace falta a priori.

## Solución

### 1. Nuevo helper `lib/utils/slugify.ts`

```ts
export function slugify(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .normalize('NFD')                  // 'é' → 'e' + acento combinante
        .replace(/[̀-ͯ]/g, '')   // elimina los acentos
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]+/g, '')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 100)
        .replace(/-+$/, '');               // por si el truncado dejó guion final
}
```

**Cambios técnicos clave:**
- `String.prototype.normalize('NFD')`: descompone cada carácter
  acentuado en su letra base + combining mark. Ej: `é` (U+00E9) → `e`
  (U+0065) + `́` (U+0301).
- `replace(/[̀-ͯ]/g, '')`: elimina TODOS los combining marks
  Unicode. Después de NFD, las letras españolas quedan como ASCII puro.
- `replace(/[^a-z0-9-]+/g, '')`: ahora seguro, solo elimina puntuación y
  símbolos no-alfanuméricos (signos de puntuación, paréntesis, etc.).
- Truncado + re-trim trailing: si el corte a 100 chars deja un guion al
  final, lo eliminamos.

### 2. Reemplazo del generador inline en `posts.ts`

Antes (8 líneas):
```ts
let slug = title.toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .substring(0, 100);
if (slug.endsWith('-')) slug = slug.slice(0, -1);
```

Después (1 línea):
```ts
const slug = slugify(title);
```

### 3. Tests unitarios

Nuevo `lib/utils/slugify.test.ts` con 11 test cases cubriendo:
- Transliteración básica (sueño, qué, después, año, niño).
- Los 4 títulos reales de Carlos como anti-regresión.
- Espacios, tabs, espacios múltiples.
- Signos de puntuación y caracteres especiales.
- Dedup de guiones.
- Strip de guiones iniciales/finales.
- Edge cases (string vacío, solo espacios, solo signos).
- Truncado a 100 chars.
- Trailing dash después de truncar.
- Mayúsculas a minúsculas.
- Números preservados.

Valores expected validados con Python en sandbox (27/27 pass) usando la
MISMA lógica que el TypeScript — no estimación mental (regla
`feedback_test_values_calibration.md`).

## Criterios de aceptación

- [x] `lib/utils/slugify.ts` exporta `slugify(input: string): string`.
- [x] Helper usa NFD + remove combining marks (no elimina caracteres acentuados).
- [x] `pages/api/admin/posts.ts` usa el helper en lugar del slug inline.
- [x] PUT no toca el slug al editar (preserva el original).
- [x] Tests unitarios en `lib/utils/slugify.test.ts` (11 describe cases).
- [x] Tests pasan con valores expected validados por Python (27/27 micro-cases).
- [ ] Post-deploy: regenerar 10 artículos viejos → nuevos slugs legibles.
- [ ] Post-deploy: `curl /posts/por-que-te-da-sueno-...` retorna 200; `curl /posts/por-qu-te-da-sueo-...` retorna 404.

## Pruebas manuales

Después del deploy + regeneración de artículos:

1. Admin: borrar los 10 artículos viejos.
2. Admin: re-publicar uno con título "¿Por qué te da sueño después de comer?".
3. Verificar en la URL pública: debe ser `/posts/por-que-te-da-sueno-despues-de-comer` (no `por-qu-te-da-sueo`).
4. Probar con un título con eñe: "Tu año metabólico" → slug `tu-ano-metabolico`.
5. Probar con muchos signos: "¡¿Cómo? ¡Imposible!" → slug `como-imposible`.

Local antes del push:
```bash
cd metamorfosis-web
npm test
# Debe mostrar slugify suite con 11/11 pasando.
```

## Riesgos y trade-offs

- **404 transitorio en slugs viejos**: si alguien tiene la URL guardada,
  recibe 404 al visitarla. Aceptable: el sitio es nuevo, no hay
  backlinks externos significativos a los slugs viejos. Si aparece
  tráfico a alguno (ver Umami o Google Analytics), agregar redirect
  manual ad-hoc.
- **Re-indexación de Google**: 1-2 semanas para que los slugs viejos
  desaparezcan del index y los nuevos entren. Sin impacto urgente porque
  ningún slug viejo está ranking todavía.
- **Helper centralizado**: cualquier otro endpoint futuro que necesite
  slugificar (categorías, tags, autores) usa el mismo helper —
  consistencia garantizada.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos creados:**
- `metamorfosis-web/src/lib/utils/slugify.ts` (~25 líneas + docstring)
- `metamorfosis-web/src/lib/utils/slugify.test.ts` (~80 líneas, 11 describe cases)

**Archivos modificados:**
- `metamorfosis-web/src/pages/api/admin/posts.ts` — import del helper + reemplazo del slug inline en POST (líneas 118-125 → 1 línea).

**Decisiones:**
- NO migrar los slugs viejos con redirects 301. Carlos prefiere regenerar
  los artículos desde cero con los 5 prompts variados (post informe
  pre-lanzamiento). Limpieza total > migración parcial.
- Tests escritos al lado del helper (mismo pattern que `lib/auth.test.ts`).
- Expected calibrados con Python en sandbox para no caer en
  "estimación mental" (regla `feedback_test_values_calibration.md`).
- Helper como función pura (no clase, no singleton) — fácil de testear y de
  reusar desde otros endpoints futuros sin acoplamiento.

**Pendiente del lado de Carlos:**
1. Push del commit.
2. Login admin → eliminar los 10 artículos viejos.
3. Regenerar artículos con los 5 prompts variados (SPEC-062 + informe
   pre-lanzamiento). Cada uno con slug ya correcto.
4. (Opcional) `npm test` en local para validar antes del push.

Sin desviaciones del plan.
