# SPEC-024 — ArticleQuiz: gating de score + CTA registro para anónimos

**Estado:** ✅ Cerrada
**Fase:** 4 (Admin/UX — extensión post-cierre)
**Severidad:** ALTO (funnel: convertir lectores anónimos en users)
**Fecha de creación:** 2026-05-10
**Cerrada:** 2026-05-10
**Autor:** Carlos Reyes
**Depende de:** SPEC-006 (onboarding canónico), SPEC-008 (rules)

---

## Contexto

`ArticleQuiz.tsx` es el quiz al final de cada artículo. Cuando un visitante completa todas las preguntas, ve la pantalla "Resultados" con su puntaje y dos botones: **Reintentar** e **Ir al Dashboard**.

El problema: el botón "Ir al Dashboard" se muestra a TODOS, incluyendo visitantes anónimos (no autenticados con Firebase). Al hacer click, los anónimos terminan en `/dashboard` que asume sesión Firebase y muestra contenido vacío o redirige raro. Mal UX y oportunidad perdida de conversión.

Además, el score del anónimo se descarta al cerrar el browser. Hoy:
- Si está logueado → guarda en `users/{uid}.completedQuizzes` (setDoc + arrayUnion).
- Si NO está logueado → solo marca `localStorage.imr_article_read = true`. El score se pierde.

## Problema

1. **CTA "Ir al Dashboard" sin auth**: lleva a un dashboard vacío o ruta protegida; rompe UX.
2. **Score perdido**: el anónimo completa el quiz, ve el resultado, cierra el browser → todo borrado. Si después se registra, su quiz se pierde y no aparece en su perfil.
3. **No se aprovecha el momento de "tengo el resultado"**: es el pico de motivación para registrarse y ver más. La pantalla actual no hace gating del score ni vende ElenaApp.

## Solución propuesta

### 1. Anónimos: gating del score

Cuando `!currentUser` al completar el quiz, la pantalla "Resultados" muestra:

- **Score oculto** (no se reveló todavía).
- Mensaje claro: "Completaste el quiz. Registrate para ver tu puntaje, acceder al dashboard y entrar a la lista de espera de ElenaApp."
- Dos CTAs:
  - **Registrate** (primario, azul) → `/login` (que ya activa el tab "Crear Perfil" cuando `imr_article_read=true`).
  - **Reintentar** (secundario, neutro).

### 2. Persistencia diferida del score (sessionStorage)

Al completar el quiz como anónimo, guardar en `sessionStorage` con key `imr_pending_quiz`:

```json
{
  "articleId": "...",
  "score": 4,
  "total": 5,
  "percentage": 80,
  "date": "2026-05-10T..."
}
```

`sessionStorage` (no `localStorage`) — si el visitante cierra el browser sin registrarse, el quiz pendiente se descarta. Comportamiento esperado: el quiz solo se persiste si la conversión (registro) ocurre en la misma sesión.

### 3. Flush post-registro en login.astro

Después del registro/login exitoso, ANTES del redirect a `/dashboard`, leer `imr_pending_quiz`:

```ts
const pending = sessionStorage.getItem('imr_pending_quiz');
if (pending) {
    const quiz = JSON.parse(pending);
    const userRef = doc(db, COLLECTIONS.USERS, user.uid);
    await setDoc(userRef, {
        completedQuizzes: arrayUnion({
            articleId: quiz.articleId,
            score: quiz.percentage,
            date: quiz.date,
        }),
    }, { merge: true });
    sessionStorage.removeItem('imr_pending_quiz');
}
```

Esto vale tanto para el flow `register` como para `login` — un visitante puede haber tenido cuenta de antes, completar un quiz de un artículo nuevo como anónimo (porque cerró sesión o cambió de dispositivo), y volver a loguear: el quiz se persiste igual.

Es **best-effort**: si el setDoc falla (rules, red, etc.), el redirect al dashboard sigue. El user no pierde flow por un error de auditoría — el log `console.error` queda para diagnóstico.

### 4. Lista de espera ElenaApp

`/api/users/onboard` (SPEC-006) ya setea `users/{uid}.waitlist = { status: 'pending', joinedAt }` por default. No hay cambio necesario — solo lo mencionamos en el copy del CTA para que el visitante entienda el beneficio del registro.

## Plan de ejecución

1. Escribir esta spec (hecho).
2. Editar `metamorfosis-web/src/components/ArticleQuiz.tsx`:
   - `handleFinish` para anónimos: guardar `imr_pending_quiz` en sessionStorage.
   - Vista `showResults` con branching `currentUser`: render gateado para anónimos.
3. Editar `metamorfosis-web/src/pages/login.astro`:
   - Importar `db`, `doc`, `setDoc`, `arrayUnion`, `COLLECTIONS` (firestore client SDK).
   - Helper `flushPendingQuiz(user)` que lee sessionStorage, escribe en `users/{uid}`, limpia.
   - Llamarlo en register Y login antes del redirect.
4. Build + commit + push.
5. Verificación E2E con anónimo: completar quiz → ver gating → registrarse → confirmar que el quiz aparece en `users/{uid}.completedQuizzes` (Firebase Console o dashboard).

## Criterios de aceptación

- [x] Anónimo completa quiz → ve score oculto + CTA registro (NO botón a dashboard).
- [x] CTA registro lleva a `/login` con el tab "Crear Perfil" habilitado (porque `imr_article_read` se mantiene).
- [x] Score se guarda en `sessionStorage.imr_pending_quiz` antes del redirect.
- [x] Tras registro exitoso, el score aparece en `users/{uid}.completedQuizzes`.
- [x] Tras login (no register) con quiz pendiente en sessionStorage, el score también se persiste.
- [x] User logueado completa quiz → vista actual sin cambios (score visible + botón al dashboard).
- [x] Si el flush falla (network, rules), el redirect al dashboard ocurre igual con `console.error` para diagnóstico.
- [x] Cerrar browser sin registrarse descarta el quiz pendiente (porque sessionStorage).

## Pruebas manuales

1. Modo incógnito → abrir un artículo → bajar al quiz → responder todas las preguntas.
2. Pantalla final: ver "🔒 Registrate para ver tu puntaje" en lugar del score numérico.
3. CTA principal "Registrate" → click → `/login` con tab "Crear Perfil" desbloqueado.
4. Crear cuenta nueva con email/password.
5. Tras redirect a `/dashboard`, abrir Firebase Console → `users/{uid}` → ver array `completedQuizzes` con el quiz recién completado.
6. **Variante:** mismo flow pero antes del registro hago "login" con cuenta existente → confirmar que el quiz también se persiste.
7. Cerrar browser sin registrarse → reabrir → confirmar que el quiz NO se persistió (sessionStorage limpio).
8. **Caso logueado**: con sesión Firebase activa, completar otro quiz → ver score visible + botón dashboard funcional (sin cambio respecto al comportamiento anterior).

## Riesgos y trade-offs

- **Doble persistencia si user logueado completa quiz dos veces**: el `arrayUnion` deduplica solo si los objetos son idénticos. Como incluimos `date` con timestamp distinto, dos completes generan dos entries. Aceptable: histórico de intentos.
- **Si Carlos cambia el copy del gating después**, los textos viven solo en `ArticleQuiz.tsx` — fácil de iterar.
- **Anónimo que completa quiz y refresca la página antes de registrarse**: pierde el quiz (sessionStorage es por-pestaña en algunos browsers). Aceptable; la conversión inmediata es el target.
- **Rules de Firestore (SPEC-008) bloquean update sobre `users/{uid}` desde el cliente excepto si toca campos no protegidos**: `completedQuizzes` no está en `app.*` ni `crm.*`, así que la rule actual permite el setDoc con merge. Verificado en SPEC-005.4.

## Compatibilidad con ElenaApp

`completedQuizzes` queda en el doc canónico. ElenaApp puede leerlo (es del propio user). Sin cambios al schema; el campo ya existía antes de SPEC-024.

## Commit

```
feat(spec-024): article quiz con gating + cta registro para anónimos

- ArticleQuiz: anónimos ven score oculto + CTA "Registrate para ver tu
  puntaje y acceder al dashboard / lista de espera ElenaApp"
- Score pendiente persiste en sessionStorage (imr_pending_quiz) hasta
  el registro/login en la misma sesión
- login.astro: flushPendingQuiz() ejecuta en register Y login antes
  del redirect a /dashboard, escribiendo en users/{uid}.completedQuizzes
- Best-effort: si el flush falla, el redirect sigue (console.error)
- Mantiene UX para users logueados (score visible + dashboard)

Cierra SPEC-024.
```

## Resultado

Implementado en una sola pasada (2026-05-10).

**Archivos tocados:**
- `metamorfosis-web/src/components/ArticleQuiz.tsx` — branch en `handleFinish` que guarda `imr_pending_quiz` en sessionStorage para anónimos; vista `showResults` ramificada en dos UIs (logueado vs anónimo).
- `metamorfosis-web/src/pages/login.astro` — import de firestore client SDK, helper `flushPendingQuiz(user)`, llamada en ambos branches (register/login) antes del redirect.

**Decisiones tomadas en la marcha:**
- **Score totalmente oculto** (no parcial tipo "muy bien" / "regular"): aumenta la motivación de registro. Mostrar fragmentos diluiría el incentivo.
- **`imr_article_read` se sigue marcando** en localStorage al completar el quiz (anónimo o no), para mantener compatibilidad con la lógica existente del login que activa el tab "Crear Perfil".
- **No se valida que el `articleId` exista en Firestore** antes de persistir el quiz post-registro: si Carlos borra el artículo entre que el visitante respondió y se registró, el `completedQuizzes` queda con un articleId huérfano. Aceptable; el dashboard tolera articles que no existen.
- **`flushPendingQuiz` se invoca también en login (no solo register)**: cubre el caso de user existente que completa quiz como anónimo en otro dispositivo y vuelve a entrar.

**Sin desviaciones del plan funcional.** Todos los criterios de aceptación quedan cumplidos.
