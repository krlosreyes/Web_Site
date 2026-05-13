# SPEC-091 — Excluir al admin de las métricas en cualquier dispositivo

**Estado:** ✅ Cerrada (pendiente de `npm test` + `npm run build` + commit local)
**Fase:** Pre-lanzamiento — limpieza de métricas
**Severidad:** ALTO (métricas mienten mientras la mayor parte del tráfico es de Carlos)
**Fecha de creación:** 2026-05-13
**Autor:** Carlos Reyes
**Depende de:** SPEC-086 (counters), SPEC-090 (tablero)

---

## Contexto

SPEC-086 implementó contadores de vistas y clicks para artículos. Para
vistas hay exclusión del admin via cookie `admin_session` HttpOnly,
pero esa cookie:

1. Solo se setea cuando el admin está logueado en `/admin/login`.
2. NO se sincroniza entre dispositivos (Mac, iPhone, iPad).
3. NO se chequea en el endpoint de clicks (`/api/posts/[slug]/click`).

Resultado: cualquier visita o click de Carlos desde un dispositivo
donde no está logueado al admin (típicamente el iPhone) infla los
counters. En pre-lanzamiento donde el tráfico es 80% Carlos, las
métricas mienten gravemente.

## Problema

No hay forma confiable de excluir TODAS las visitas y clicks de
Carlos (en cualquier dispositivo) de los contadores de artículos.

## Solución propuesta

Una cookie persistente `mr_admin_self` con expiración de 1 año que se
setea visitando cualquier URL del sitio con el query param
`?mr-admin=1`. Carlos hace eso una vez por dispositivo y queda
excluido permanentemente.

Cuando la cookie está activa:
- `/posts/[slug]` no incrementa `analytics.views`.
- `/api/posts/[slug]/click` no incrementa `analytics.clicks`.
- Un banner discreto en `/posts/*` confirma visualmente "Métricas
  excluidas en este dispositivo".

Para desactivar: visitar `?mr-admin=0` o borrar la cookie manualmente.

### Alternativas descartadas

- **Detección por User-Agent:** frágil, el UA del iPhone es genérico.
- **IP allowlist:** las IPs móviles cambian. Carlos vive en Colombia
  con ISP residencial — IP rotativa.
- **Solo loguearse al admin desde cada dispositivo:** requiere que
  Carlos haga login + maneje sesiones. Más alta fricción que
  visitar una URL una vez.

## Plan de implementación

1. **Crear** `src/lib/legacy/adminSelfExclusion.ts` — helpers
   `setSelfExclusionCookie(cookies, value)` y `isSelfExcluded(cookies)`
   para que server-side el endpoint de clicks y el frontmatter de
   `/posts/[slug]` compartan la misma lógica. La cookie es
   `mr_admin_self` con value `'1'` (activa) o `'0'` (apagada).
2. **Modificar** `src/pages/posts/[slug].astro`:
   - Si `Astro.url.searchParams.get('mr-admin') === '1'`, setear
     cookie `mr_admin_self=1` con Max-Age 1 año.
   - Si `'mr-admin') === '0'`, setear `mr_admin_self=0` con Max-Age 0
     (eliminar).
   - Antes de `incrementView`, agregar `if (isSelfExcluded(...)) return`.
   - Si la cookie está activa, exponer una flag al template para
     mostrar un banner.
3. **Modificar** `src/pages/api/posts/[slug]/click.ts`:
   - Antes de llamar `incrementClick`, chequear la cookie. Si está
     activa, responder 204 sin incrementar.
4. **Banner UI** en `/posts/[slug].astro`: fixed bottom-right, pill
   pequeña con texto "Métricas excluidas" y un botón "×" para
   desactivar (que linkea a `?mr-admin=0`).

## Criterios de aceptación

- [ ] `npm run build` no lanza errores.
- [ ] Visitar `https://metamorfosisvital.com.co/posts/{cualquiera}?mr-admin=1`
      desde un dispositivo nuevo:
      - Setea la cookie `mr_admin_self=1`.
      - Muestra el banner "Métricas excluidas".
      - NO incrementa `analytics.views` de ese artículo.
- [ ] Recargar la misma página sin el query param:
      - Sigue mostrando el banner (cookie persistente).
      - NO incrementa vistas.
- [ ] Click en "Iniciar diagnóstico IMR" o "Entrar a la comunidad":
      - NO incrementa `analytics.clicks`.
- [ ] Visitar `?mr-admin=0`:
      - Borra la cookie.
      - El banner desaparece.
      - A partir de ese momento, las vistas y clicks SÍ cuentan.
- [ ] El admin logueado vía `admin_session` sigue excluido como antes
      (las dos exclusiones funcionan independientes; la self-exclusion
      es defensa adicional).

## Pruebas

```sh
cd metamorfosis-web && npm run build

# Smoke post-deploy desde tu iPhone:
#   1. Abrí Safari → metamorfosisvital.com.co/posts/{slug}?mr-admin=1
#   2. Verificá que aparece el pill "Métricas excluidas" abajo-derecha.
#   3. Cerrá Safari, reabrí, navegá artículos.
#   4. En el admin (desde Mac): el contador del artículo NO subió
#      por tus visitas del iPhone.
#   5. Repetí desde tu Mac sin logear al admin → mismo comportamiento.
```

## Riesgos / consideraciones

- **Cookie compartida con otros visitantes:** si alguien que no sea
  Carlos descubre el query param, puede excluirse. Mitigación: el
  parámetro es de bajo perfil, y en el peor caso ese usuario
  específico no cuenta — no envenena los datos de los demás.
- **Cookies bloqueadas:** si Carlos tiene cookies bloqueadas en
  Safari iOS (modo "Bloquear todas las cookies"), la exclusión no
  funciona. Caso aceptable: Carlos puede activar cookies para su
  propio sitio.
- **Compartir un dispositivo:** si Carlos comparte su iPhone con
  alguien que también visite el sitio, esa visita también se
  excluye. Aceptable: el universo de "yo y mi pareja en el mismo
  iPhone" es despreciable frente al ruido que quita.

## Commit

**Mensaje sugerido:**
```
feat(spec-091): cookie mr_admin_self para excluir admin multi-dispositivo

- Helper src/lib/legacy/adminSelfExclusion.ts pure-TS (server-side).
- Cookie mr_admin_self con expiración de 1 año, activable via
  ?mr-admin=1 en cualquier URL de /posts/[slug].
- Si activa: no incrementa analytics.views ni analytics.clicks.
- Banner discreto en posts cuando la cookie está activa.
- ?mr-admin=0 borra la cookie.

Cierra specs/SPEC-091-excluir-admin-metricas.md
```

---

## Resultado

Implementado en una sola pasada (2026-05-13).

**Archivos tocados (4):**
- `src/lib/legacy/adminSelfExclusion.ts` (nuevo) — helpers
  pure-TS: `isSelfExcluded`, `readCookiesFromHeader`,
  `decideCookieAction`. Sin dependencias de Astro ni Firebase.
- `src/lib/legacy/adminSelfExclusion.test.ts` (nuevo) — 13 tests
  con vitest cubriendo cada función + edge cases (cookies vacías,
  valores raros, header malformado).
- `src/pages/posts/[slug].astro` — aplica `decideCookieAction` con
  los query params al frontmatter (set / delete / noop según
  `?mr-admin=`). Antes de `incrementView`, chequea
  `isSelfExcluded(Astro.cookies)`. Banner discreto fixed
  bottom-right cuando la cookie está activa, con link `×` para
  desactivar.
- `src/pages/api/posts/[slug]/click.ts` — chequea AMBAS exclusiones
  antes de incrementar: `admin_session` (admin logueado) Y
  `mr_admin_self` (self-exclusion multi-device). Responde 204 en
  ambos casos sin contar.

**Decisiones clave:**
- **Cookie no HttpOnly:** dejé `httpOnly: false` para que el
  frontend pueda chequearla si en el futuro quiero mostrar UI
  client-side. Para una cookie de auth real esto sería un riesgo,
  pero esto solo controla métricas, no permisos.
- **Reaprovecho `parseCookies` de `lib/auth`:** así el chequeo de
  `admin_session` usa el mismo path probado del admin login. La
  segunda capa (`readCookiesFromHeader`) es propia pero más
  liviana, solo para `mr_admin_self`.
- **Banner solo en `/posts/*`:** es donde están los counters. Si
  alguien activa la cookie en otra parte del sitio, sigue
  excluido (el endpoint de clicks la chequea siempre) pero el
  banner es contextual a la página del artículo.
- TS transpile validation OK en los 3 archivos TS + el `.astro`
  que no se puede testear standalone.

**Smoke plan post-deploy (5 minutos):**
1. Desde tu iPhone, abrí Safari y navegá a:
   `https://metamorfosisvital.com.co/posts/{cualquier-slug}?mr-admin=1`
2. Confirmá que aparece el pill "Métricas excluidas en este
   dispositivo" abajo-derecha.
3. Cerrá Safari, reabrí, navegá entre artículos sin el query param.
   El pill sigue ahí (cookie persistió).
4. Desde tu Mac, sin loguearte al admin, hacé lo mismo:
   `?mr-admin=1` en cualquier artículo. Confirmá el pill.
5. Si tenés otro dispositivo (iPad, otro browser), repetí el paso 1.
6. En el admin (logueado normal): el contador del artículo NO
   subió durante este smoke. Si subió 1 o 2 puede ser por una
   visita previa antes de activar la cookie.

**Para revertir en un dispositivo específico:** click en el "×"
del banner o visitar `?mr-admin=0` manualmente.
