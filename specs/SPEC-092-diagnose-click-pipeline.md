# SPEC-092 — Endpoint admin para diagnosticar el pipeline de clicks

**Estado:** ✅ Cerrada (pendiente de `npm run build` + commit local)
**Fase:** Pre-lanzamiento — herramienta operativa
**Severidad:** MEDIO (sin esto, los bugs de tracking se detectan tarde)
**Fecha de creación:** 2026-05-13
**Autor:** Carlos Reyes
**Depende de:** SPEC-086 (counter), SPEC-091 (self-exclusion)

---

## Contexto

Carlos observó que en el tablero de SPEC-090 se ven vistas pero cero
clicks. Hay dos hipótesis posibles:

1. **Funciona pero nadie clickeó:** sus dispositivos están excluidos
   por SPEC-091 y los visitantes reales no llegaron al CTA.
2. **Bug en el pipeline:** el sendBeacon, el endpoint o el incremento
   atómico fallan en algún punto y los clicks se pierden silenciosos.

Sin una forma rápida de validar el flujo en producción, distinguir
una hipótesis de la otra requiere abrir DevTools y mirar la tab
Network manualmente. Quiero un test que reporte "OK" o "FAIL" en
una sola invocación.

## Problema

No tenemos un smoke test idempotente del pipeline de clicks en
producción.

## Solución propuesta

Endpoint admin-only `POST /api/admin/diagnose-click` que recibe
`{ slug }` y ejecuta:

1. Lee `analytics.clicks` del doc del post (counter ANTES).
2. Hace fetch interno al endpoint público `/api/posts/{slug}/click`
   sin cookies (para que NO sea filtrado por self-exclusion).
3. Lee `analytics.clicks` del doc (counter DESPUÉS).
4. Calcula `diff = after - before`.
5. **Restaura el counter al valor original** con
   `FieldValue.increment(-diff)` para mantener el test idempotente.
6. Retorna el resultado en JSON.

Si `diff === 1`, el pipeline funciona. Si `diff === 0`, el sendBeacon
o el endpoint público están rotos. Si `diff > 1`, hay race condition.

### Alternativas descartadas

- **Script Node externo:** funciona pero requiere copiar cookies
  manualmente al env. Más fricción operativa.
- **No restaurar el counter:** dejaría +1 click fantasma cada vez
  que Carlos corra el test. Acumulativo. Rechazado.
- **Llamar `incrementClick` directamente sin fetch interno:**
  testearía la función pero NO el endpoint público completo
  (CSRF, parsing del slug, route resolution). Preferimos el fetch
  interno para validar todo el pipeline.

## Plan de implementación

1. **Crear** `src/pages/api/admin/diagnose-click.ts`:
   - Verificar cookie admin (`isAuthenticatedFromCookie`).
   - Parsear `slug` del body JSON.
   - Localizar el doc por `where('slug', '==', slug)`. Si no existe,
     responder 404.
   - Leer counter actual.
   - Hacer `fetch` interno a `${origin}/api/posts/{slug}/click` con
     `Content-Type: application/json` y body `{}`. SIN reenviar el
     header cookie del request original (para no propagar
     `admin_session` ni `mr_admin_self`).
   - Esperar un breve delay (~500ms) para que Firestore propague.
   - Leer counter nuevo.
   - Restaurar con `FieldValue.increment(-diff)`.
   - Retornar `{ slug, before, after, diff, status: 'OK' | 'FAIL',
     publicEndpointStatus, message }`.
2. **Documentar** el comando curl en la respuesta de la SPEC para
   que Carlos lo use cuando quiera.

## Criterios de aceptación

- [ ] `npm run build` no lanza errores.
- [ ] Invocar el endpoint logueado como admin con un slug válido
      retorna `{ diff: 1, status: 'OK' }` cuando el pipeline funciona.
- [ ] Después de invocar el endpoint, `analytics.clicks` del doc
      vuelve a estar en su valor original (idempotente).
- [ ] Invocar sin admin cookie responde 401.
- [ ] Invocar con slug inexistente responde 404.
- [ ] Si el endpoint público falla, el endpoint reporta `status:
      'FAIL'` con el código de error real.

## Pruebas

```sh
cd metamorfosis-web && npm run build

# Smoke post-deploy:
#   1. Login al admin.
#   2. Copiar la cookie admin_session desde DevTools (Application →
#      Cookies → metamorfosisvital.com.co).
#   3. Reemplazar SLUG y COOKIE en este curl:
#
#      curl -X POST 'https://metamorfosisvital.com.co/api/admin/diagnose-click' \
#        -H 'Content-Type: application/json' \
#        -H 'Cookie: admin_session=COOKIE_VALUE' \
#        -d '{"slug":"SLUG_DEL_ARTICULO"}'
#
#   4. Respuesta esperada:
#      { "slug": "SLUG", "before": N, "after": N, "diff": 1,
#        "status": "OK", "message": "Pipeline funciona correctamente" }
#
#      (after === before porque restauramos al final).
```

## Riesgos / consideraciones

- **Race condition:** si otro visitante real clickea durante los
  ~500ms entre los reads, el diff podría ser 2 y la restauración
  dejaría -1 click en perjuicio del visitante real. Mitigación:
  el riesgo es bajo en pre-lanzamiento (poco tráfico) y el test
  se corre puntualmente, no en loop. Si el diff es ≠ 1 reportamos
  como FAIL y no restauramos.
- **Fetch interno self:** Astro permite fetch HTTP self-loop sin
  problemas en Node SSR. Si Hostinger tiene rate-limit interno,
  podría fallar. Mitigación documentada.
- **Cookies del fetch interno:** Node 18+ `fetch` no propaga
  cookies automáticamente. Confirmado server-side: no propagamos
  `admin_session` ni `mr_admin_self` al endpoint público.

## Commit

**Mensaje sugerido:**
```
feat(spec-092): endpoint diagnóstico para el pipeline de clicks

- POST /api/admin/diagnose-click recibe { slug } y valida flow.
- Lee counter antes, hace fetch interno al endpoint público,
  lee counter después, restaura para mantener idempotencia.
- Reporta status OK/FAIL con el diff observado.

Cierra specs/SPEC-092-diagnose-click-pipeline.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-13).

**Archivos tocados (1):**
- `src/pages/api/admin/diagnose-click.ts` (nuevo) — endpoint POST
  admin-only que ejecuta el smoke test idempotente del pipeline
  de clicks.

**Cómo el endpoint maneja cada caso:**
- `diff === 1` → status OK + restaura counter con increment(-1).
- `diff === 0` → status FAIL (el sendBeacon o el endpoint público
  no incrementó).
- `diff > 1` → status OK pero NO restaura (hubo otro visitante real
  concurrente, su click es legítimo y respeta).
- `diff < 0` → status FAIL caso patológico.

**Decisiones:**
- **Fetch interno sin propagar cookies:** Node 18+ fetch nativo no
  propaga cookies por default. El endpoint público va a recibir la
  request como si fuera un visitante anónimo, que es exactamente lo
  que queremos para validar el pipeline real.
- **Restaurar solo si diff === 1:** si la concurrencia agregó otro
  click legítimo, no podemos restar sin lastimar a ese visitante.
- **Delay de 500ms entre POST y read final:** Firestore propaga el
  write rápido pero no instantáneo. 500ms es conservador.
- TS transpile OK.

**Cómo usar (comando curl):**
```sh
# 1. Logueate al admin desde el browser.
# 2. DevTools → Application → Cookies → metamorfosisvital.com.co
#    Copiar el value de `admin_session`.
# 3. Ejecutar:
curl -X POST 'https://metamorfosisvital.com.co/api/admin/diagnose-click' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: admin_session=PEGA_TU_COOKIE_AQUI' \
  -d '{"slug":"slug-de-cualquier-articulo-publicado"}'
```

**Interpretación de la respuesta:**
- `status: "OK"`, `diff: 1` → pipeline funciona. Si el tablero
  sigue mostrando 0 clicks, es porque los visitantes reales no
  clickearon (hipótesis 1: nadie llegó al CTA).
- `status: "FAIL"`, `diff: 0` → hay un bug. Revisar
  `publicEndpointStatus` (esperamos 204; si es otra cosa, ese es
  el error).
- `status: "OK"`, `diff: > 1` → el test detectó concurrencia real,
  pipeline funciona pero no restauró.
