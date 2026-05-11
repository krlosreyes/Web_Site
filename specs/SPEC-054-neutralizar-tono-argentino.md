# SPEC-054 — Neutralizar tono argentino en copy

**Estado:** ✅ Cerrada
**Fase:** Pre-lanzamiento — voz de marca
**Severidad:** ALTO (el sitio es para audiencia hispanoamericana, voseo limita el alcance)
**Fecha de creación:** 2026-05-11
**Cerrada:** 2026-05-11
**Autor:** Carlos Reyes

---

## Contexto

El copy del sitio mezclaba español neutro con marcadores rioplatenses
(voseo verbal, imperativos con tilde final). Eso limita la conexión con
usuarios de México, Colombia, España, Chile, Perú y otros países hispanos
que no usan voseo. La marca quiere apuntar a toda Hispanoamérica, así
que el copy debe ser **español neutro** consistente.

## Patrones detectados y reemplazados

Sweep exhaustivo con regex sobre `src/**/*.{astro,tsx,ts}`:

### Voseo verbal (2da persona singular)

| Antes | Después |
|---|---|
| tenés | tienes |
| podés | puedes |
| necesitás | necesitas |
| acabás | acabas |

### Imperativos rioplatenses (tilde final)

| Antes | Después |
|---|---|
| Descubrí | Descubre |
| Recibí | Recibe |
| Reservá | Reserva |
| Obtené | Obtén |
| Iniciá | Inicia |
| Probá | Inténtalo (recontextualizado) |
| Hacé | Haz |
| Desbloqueá | Desbloquea |
| Identificate | Identifícate |
| Registrate | Regístrate |

## Archivos tocados (10)

| Archivo | Cambio |
|---|---|
| `components/IMRQuiz.tsx` | "Descubrí... recibí... tenés" → neutro (línea 265); 2 "Probá de nuevo" → "Inténtalo de nuevo" |
| `components/NotificationBell.tsx` | "tenés notificaciones" → "tienes notificaciones" |
| `components/ElenaAppCTA.tsx` | "Reservá... obtené" → "Reserva... obtén" (línea 129); "Reservá tu lugar" → "Reserva tu lugar" (línea 187) |
| `components/community/ForumEngine.tsx` | "Identificate" → "Identifícate"; "iniciá sesión" → "inicia sesión" |
| `components/BioDashboard.tsx` | "Hacé... desbloqueá" → "Haz... desbloquea" |
| `components/blog/PostReactions.tsx` | "Registrate" → "Regístrate" |
| `components/ArticleQuiz.tsx` | 2 "Registrate" → "Regístrate" |
| `components/admin/ArticleEditor.tsx` | "necesitás" → "necesitas"; "Tenés que elegir" → "Tienes que elegir" |
| `pages/login.astro` | "podés crear" → "puedes crear" |
| `lib/email.ts` | 8 ocurrencias (versión texto + HTML del email transaccional): "Acabás → Acabas", "tenés asegurado → tienes asegurado", "tenés disponible → tienes disponible", "podés responderle → puedes responder" |

## Falsos positivos identificados (NO cambiados)

- **`sobre-mi.astro:130`**: "Descubrí que la vitalidad real..." — es pretérito
  perfecto en 1era persona ("yo descubrí"), no imperativo voseo. Es Carlos
  narrando su historia. Mantenido.
- **"Atrás"**: adverbio temporal/espacial, neutral. Mantenido en navegación
  y formatos de tiempo (`"5 minutos atrás"`).
- **"estás"**: 2da persona del verbo "estar", neutral (tanto "tú estás"
  como "vos estás"). Mantenido.
- **"más"**: adverbio de cantidad. Mantenido.

## Plan de ejecución

1. Sweep exhaustivo con grep regex sobre el src/.
2. Para cada match real, edit con reemplazo neutro.
3. Re-sweep para confirmar 0 residuales.
4. Build local + commit + push.

## Criterios de aceptación

- [x] 0 ocurrencias de `(tenés|querés|podés|necesitás|sabés|creés|comés|sos|recibís|acabás)` en src/.
- [x] 0 ocurrencias de imperativos rioplatenses (`Descubrí|Recibí|Reservá|Obtené|Iniciá|Probá|Hacé|Desbloqueá|Identificate|Registrate`) en src/ (excepto pretérito 1era persona documentado).
- [x] Spec documenta los falsos positivos preservados.
- [ ] Post-deploy: revisar visualmente las páginas principales (home, login, biblioteca, comunidad, quiz, dashboard) para confirmar que el copy se lee neutro.

## Riesgos y trade-offs

- **Pérdida de identidad regional**: el tono neutro es menos "personal"
  que el voseo argentino. Trade-off aceptable: el target es Hispanoamérica
  completa, no solo Argentina/Uruguay.
- **Texto generado dinámicamente del backend**: hay strings en endpoints
  API (mensajes de error) que no se chequearon manualmente. Si aparecen
  marcadores residuales en feedback de users, abrir SPEC-054b puntual.
- **Articles de la biblioteca**: el contenido editorial de cada artículo
  (que Carlos publica via admin) NO se neutraliza con esta spec. Es
  responsabilidad del autor al escribir.

## Resultado

Implementado en una sola pasada (2026-05-11).

**10 archivos editados, ~20 strings reemplazados.** Sweep final confirma
0 ocurrencias de marcadores rioplatenses en el src/.

**Decisiones:**
- "Probá de nuevo" → "Inténtalo de nuevo" (no "Prueba de nuevo") — más
  formal/neutro y se lee mejor en alertas de error.
- "podés responderle directamente" → "puedes responder directamente"
  (sin el "-le" pronominal extra que tampoco era estrictamente necesario).
- Mantengo "estás" porque coincide entre tuteo y voseo (no es marcador).

Sin desviaciones del plan.
