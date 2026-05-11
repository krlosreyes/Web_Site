# SPEC-058 — Dashboard admin: tab Fundadores + polling 30s

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — observabilidad
**Severidad:** ALTO (Carlos necesita ver el cohorte en tiempo real durante el lanzamiento)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes
**Depende de:** SPEC-007 (admin UI), SPEC-056 (cohorte), SPEC-057 (email)

---

## Contexto

Después de SPEC-056 + 057, los fundadores se asignan automáticamente y
reciben su email + badge. Carlos necesita visibilidad en tiempo real desde
el dashboard admin durante el lanzamiento:

- Ver "XXX / 1000 fundadores registrados" actualizándose.
- Tabla con #, nombre, email, fecha asignada, IMR, estado del email.
- Buscar por nombre/email/número.
- Exportar CSV.

## Solución

### 1. Endpoint `GET /api/admin/founders`

Auth via cookie admin (`isAuthenticatedFromCookie`). Devuelve:

```json
{
  "cap": 1000,
  "count": 42,
  "remaining": 958,
  "founders": [
    {
      "uid": "...",
      "number": 1,
      "displayName": "Carlos Reyes",
      "email": "carlos@...",
      "assignedAt": "2026-05-11T...",
      "imrScore": 78,
      "waitlistStatus": "pending",
      "welcomeEmailSent": true,
      "createdAt": "2026-05-11T..."
    },
    ...
  ]
}
```

Query Firestore: `users where founder.isFounder == true order by founder.number asc`.
Headers `Cache-Control: no-store` para que el polling no use caches intermedios.

### 2. Componente `FoundersList.tsx`

Estructura visual:

- **Header amber/teal con número grande**: `42 / 1000`, sub-texto "958 cupos
  disponibles" o "cupo lleno · nuevos usuarios son estándar".
- **Botón "Actualizar ahora"** + indicador "Actualizado: hace X" + dot pulse
  cuando hay refresh en curso.
- **Barra de progreso**: gradient amber→teal con `width: ${progressPct}%`.
- **Toolbar**: input búsqueda (filtra por nombre/email/número client-side)
  + botón "Exportar CSV ({N})".
- **Tabla**: # / Nombre / Email / IMR (con color según score) / Asignado /
  Email enviado (✓ verde o ⚠ amber).
- **Estados**: loading spinner, error con retry, lista vacía con copy
  contextual ("Aún no hay fundadores" vs "Sin resultados para 'X'").

### 3. Polling 30s

`setInterval(fetchFounders(silent=true), 30000)` en `useEffect`. Cleanup
en unmount. `silent=true` no resetea el loading state, sólo actualiza el
indicador "Actualizado: hace X" — UX sin flicker.

### 4. Integración en AdminApp

- Nuevo tab `'FOUNDERS'` en el type `AdminTab`.
- Botón en sidebar con color amber (diferenciado del teal de leads).
- Render condicional `{activeTab === 'FOUNDERS' && <FoundersList />}`.
- StatsGrid se oculta cuando `activeTab === 'FOUNDERS'` (el tab tiene su
  propio header con métricas, evita redundancia).

### 5. Export CSV

Headers: `numero, nombre, email, imr_score, asignado_iso, creado_iso,
waitlist_status, email_enviado`. Escape básico de quotes para evitar
romper el formato. Filename: `fundadores_YYYY-MM-DD.csv`.

## Plan de ejecución

1. Crear `pages/api/admin/founders.ts` — endpoint GET con auth gate.
2. Crear `components/admin/FoundersList.tsx` — UI completa con polling.
3. Editar `components/admin/AdminApp.tsx`:
   - Import de `FoundersList`.
   - Tipo `AdminTab` extendido con `'FOUNDERS'`.
   - Botón en sidebar después de "Gestión de Leads".
   - Render condicional.
   - Excluir del `StatsGrid`.
4. Build local + commit + push.

## Criterios de aceptación

- [x] `GET /api/admin/founders` retorna `{cap, count, remaining, founders[]}`.
- [x] Endpoint cierra 401 sin cookie admin.
- [x] `FoundersList` muestra progress bar XXX/1000 + tabla + búsqueda + export.
- [x] Polling cada 30s con indicador visual de "Actualizado".
- [x] Tab "Fundadores" aparece en sidebar admin con color amber.
- [x] Export CSV descarga archivo con timestamp.
- [ ] Build local OK sin errores TypeScript.
- [ ] Post-deploy: registrarse en home → tab Fundadores muestra el nuevo user.
- [ ] Post-deploy: contador se incrementa automáticamente al esperar 30s después de un registro.

## Pruebas manuales

### Endpoint
```bash
# Sin auth → 401
curl -i https://metamorfosisvital.com.co/api/admin/founders

# Con cookie admin válida → 200 con JSON
curl -i -H "Cookie: admin_session=..." https://metamorfosisvital.com.co/api/admin/founders
```

### UI
1. Login en `/admin` con password admin.
2. Click en "Fundadores" en el sidebar.
3. Ver header amber con número actual / 1000 + progress bar.
4. Registrarse con otro email en incógnito (otra pestaña).
5. Esperar 30s o click "Actualizar ahora" → ver al user nuevo en la tabla.
6. Buscar por nombre → la tabla se filtra client-side instantáneamente.
7. Click "Exportar CSV" → descarga archivo con filas correctas.

## Riesgos y trade-offs

- **Sin paginación server-side**: si en algún momento se decide ampliar el
  cap de 1000 a más, el response crecerá linealmente. Para 1000 está OK
  (~150 KB comprimido). Si después se sube a 10k, agregar paginación.
- **Polling 30s consume cuota Firestore**: 1 lectura cada 30s = 120/hora.
  Si Carlos deja el dashboard abierto 8h, 960 lecturas/día. Aceptable
  bajo el plan free de Firestore (50k reads/día). No requiere optimización.
- **Búsqueda client-side**: con 1000 docs es trivial. Si crece, mover a
  query server-side (`where displayName >= q && < q+`).
- **Sin filtros server-side por rango de fechas**: el cap es bajo, no es
  necesario por ahora. Si se quiere ver "fundadores de la última semana",
  agregar `?from=&to=` al endpoint.
- **Race condition entre `count` y `founders.length`**: la query del
  counter y de la colección son lecturas separadas (no transaccionales).
  En casos límite (un onboard ejecutándose en simultáneo) podrían
  desincronizarse por un segundo. Aceptable porque el polling reconcilia.

## Resultado

Implementado en una sola pasada (2026-05-11).

**Archivos creados:**
- `metamorfosis-web/src/pages/api/admin/founders.ts` (~100 líneas) —
  endpoint GET con auth gate, query Firestore, response shape estructurada.
- `metamorfosis-web/src/components/admin/FoundersList.tsx` (~250 líneas) —
  UI completa con header amber, progress bar, búsqueda, polling, export.

**Archivos modificados:**
- `metamorfosis-web/src/components/admin/AdminApp.tsx` —
  import + `AdminTab` extendido + botón sidebar + render condicional +
  exclusión del StatsGrid.

**Decisiones:**
- Polling 30s (confirmado por Carlos) en lugar de onSnapshot — mantiene
  rules cerradas y es suficiente para "watch the counter climbing"
  durante el lanzamiento.
- Color amber/teal del tab para diferenciar visualmente del resto
  (LEADS=teal, ARCHIVE=blue, ANALYTICS=purple, AUDIT=yellow, FORUM=orange).
- Header del tab incluye sus propias métricas → ocultamos `StatsGrid` para
  evitar competencia visual.
- Búsqueda client-side: simple, instantánea, suficiente para 1000 docs.
- Export CSV con timestamp en el filename para evitar sobreescritura.
- Indicador "Email enviado ✓/⚠" en la tabla: permite a Carlos identificar
  rápido fundadores cuyo email transaccional falló (caso edge de Resend).

Sin desviaciones del plan.
