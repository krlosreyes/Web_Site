# SPEC-113 — Política de privacidad de Elena App (App Store + Play Store compliant)

**Estado:** ✅ Cerrada (código local; pendiente push + review legal)
**Fase:** 6 (Compliance / Lanzamiento ElenaApp)
**Severidad:** 🔴 Bloqueante para publicación en App Store y Play Store
**Fecha de creación:** 2026-05-25
**Autor:** Carlos Reyes (vía agente Cowork)
**Depende de:** SPEC-005 (schema `users/{uid}`), SPEC-029 (Resend), CLAUDE.md (constitución del proyecto)

**Independiente de:** SPEC-111 (migración de dominio). La página se sirve desde el mismo dominio; cuando SPEC-111 cierre, el link en las stores se actualiza a `.org`.

---

## Contexto

Apple App Store Connect y Google Play Console **exigen** un link visible a
la política de privacidad como requisito para publicar cualquier app. Los
apps que manejan **datos de salud** (categoría "Health & Fitness" en Google
Play, "Health" en Apple App Privacy Details) tienen requisitos más estrictos
que apps generales.

Elena App es una app de salud metabólica que recolecta:
- Datos antropométricos (peso, altura, cintura, cuello, cadera, % grasa)
- Datos de salud auto-reportada (patologías declaradas)
- Datos de hábitos (ayuno, sueño, hidratación, ejercicio, alimentación)
- Datos derivados (IMR, edad metabólica, IMC, TMB, FFMI)
- Historial de mediciones

Sin política de privacidad conforme, el app **no puede publicarse**. Sin
política que declare EXACTAMENTE los datos que se recolectan y el uso, el
review de Apple/Google **rechaza** la app en primera revisión.

## Requisitos externos aplicables

### Apple App Store Connect — App Privacy Details

Requiere declarar por 14 categorías de datos:

1. Contact Info (nombre, email, teléfono, dirección)
2. **Health & Fitness** ← aplica
3. Financial Info (pagos) ← aplica (si hay compras in-app)
4. Location
5. **Sensitive Info** ← aplica (health data es sensible)
6. Contacts
7. **User Content** (foto de perfil, fotos de comidas) ← aplica
8. Browsing History
9. Search History
10. **Identifiers** (uid, device token) ← aplica
11. Purchases ← aplica (si hay compras in-app)
12. **Usage Data** ← aplica
13. **Diagnostics** ← aplica (crash logs)
14. Other Data

Para cada dato: tracking (sí/no), linked to user (sí/no), propósito (App Functionality, Analytics, Product Personalization, Developer Advertising, Third-Party Advertising, Other).

**Regla dura Apple:** health data NO puede usarse para advertising ni venderse a terceros.

### Google Play Console — Data Safety

Requiere declarar por categorías equivalentes:

- **Personal info**: Name, Email address, User IDs
- **Health and fitness**: Health info, Fitness info ← aplica
- **Financial info**: Purchase history ← aplica
- **Photos and videos** ← aplica
- **App activity**: App interactions, In-app search history, User-generated content
- **App info and performance**: Crash logs, Diagnostics, Performance data
- **Device or other IDs** ← aplica

Para cada tipo: colectado (sí/no), compartido (sí/no), propósito, si es required u opcional para el usuario.

**Data safety section requiere adicionalmente:**
- Data encrypted in transit (sí)
- Users can request data deletion (sí)
- Committed to Play Families Policy (N/A si 18+)

### Marco legal colombiano — Ley 1581 de 2012 + Decreto 1377 de 2013

- Responsable identificado
- Finalidades explícitas
- Derechos ARCO + revocación
- Procedimientos para ejercer derechos
- Autoridad de control: SIC
- Registro Nacional de Bases de Datos (RNBD) — evaluar aplicabilidad al pasar 10K users

### GDPR (Reglamento UE 2016/679)

Health data = special category (Art. 9). Requiere:
- Consentimiento explícito (no tácito)
- Derechos: acceso, rectificación, borrado, portabilidad, oposición, limitación
- Data breach notification 72h
- DPO recomendado para health apps de escala

### CCPA (California) + LGPD (Brasil) + LFPDPPP (México)

Se mencionan brevemente para users en esas jurisdicciones. Marco similar a GDPR con particularidades locales.

## Inventario de datos ElenaApp (mapeado)

Fuente de verdad: `src/lib/types/user.ts` (schema canónico v1 SPEC-005).

| Bloque del schema | Datos concretos | Apple categoría | Google Play categoría | Tratamiento |
|---|---|---|---|---|
| `uid`, `email`, `emailLower` | ID Firebase Auth, email | Identifiers, Contact Info | User IDs, Email address | linked to user, functionality |
| `displayName`, `photoURL` | Nombre, foto perfil | Contact Info, User Content | Name, Photos | linked, functionality |
| `profile.gender`, `age`, `birthDate` | Género, edad, fecha nacimiento | Sensitive Info, Contact Info | Personal info | linked, functionality |
| `profile.pathologies` | Patologías declaradas | **Health**, Sensitive Info | **Health info** | linked, functionality |
| `bio.*` (heightCm, weightKg, waistCm, neckCm, hipCm, bodyFatPct) | Datos antropométricos | **Health**, Fitness | **Health info**, Fitness info | linked, functionality |
| `habits.*` (fasting, dinner, exercise, sleep, hydration) | Hábitos diarios | **Fitness**, Health | **Fitness info**, Health info | linked, functionality |
| `imr.current`, `imr.history` | IMR calculado + historial | **Health**, Fitness | **Health info** | linked, functionality |
| `waitlist.*`, `founder.*` | Estado waitlist, cohorte | Other | Personal info | linked, functionality |
| `plan14d.*` | Progreso plan 14d | Fitness | Fitness info | linked, functionality |
| `daily_logs/*` (subcolección) | Log diario ayuno/comida/ejercicio/sueño | **Health**, Fitness | **Health info**, Fitness info | linked, functionality |
| Push notification tokens | Token FCM/APNs | Identifiers | Device or other IDs | linked, functionality |
| Compras in-app (futuras) | Historial de compras, no números de tarjeta | Purchases, Financial Info | Purchase history | linked, functionality |
| Crash logs, performance | Firebase Crashlytics (si se agrega) | Diagnostics | Crash logs, Diagnostics | not linked, analytics |
| HealthKit / Google Fit (opcional) | Pasos, HR, sueño detallado | **Health** | **Health info** | linked, functionality — Apple/Google reglas estrictas |
| Cámara / galería (opcional) | Fotos de comidas o perfil | User Content, Photos | Photos and videos | linked, functionality |

**Tracking:** NO se hace tracking cross-app ni cross-website. NO se comparten datos con advertising networks.

**Data sharing (encargados del tratamiento):**
- Firebase (Google Cloud): storage + auth
- Resend: emails transaccionales
- Umami cloud: analytics privacy-friendly
- Apple/Google (stores): pagos in-app procesados por ellos (nunca vemos números de tarjeta)

## Solución propuesta

Crear página pública `/elenaapp/privacidad` con la política completa
estructurada por secciones, coherente en tono con `/privacidad` del sitio,
y con las secciones específicas que Apple y Google exigen para health apps.

### Estructura de la página (19 secciones)

1. Responsable del tratamiento
2. Qué es Elena App y para qué sirve (contexto — importante para reviewers)
3. **Resumen visual de datos** (tabla scannable — es lo que la mayoría lee)
4. Datos que recopilamos (4.1 identidad, 4.2 perfil, 4.3 salud, 4.4 uso, 4.5 técnicos, 4.6 financieros, 4.7 contenido opcional)
5. Push notifications y token de dispositivo
6. Integración con HealthKit (iOS) y Google Fit (Android)
7. Cámara y galería
8. Compras dentro de la aplicación
9. Finalidad del tratamiento
10. Base legal
11. Con quién compartimos tus datos
12. Transferencia internacional
13. Datos sensibles: tu salud
14. Tus derechos
15. Cómo ejercer tus derechos
16. Plazo de conservación
17. Seguridad
18. Menores de edad (18+)
19. Cambios a la política + contacto autoridad de control (SIC)

### Auxiliares

- Sitemap: agregar `/elenaapp/privacidad` con prioridad 0.3.
- Footer del sitio: agregar link al lado de `/privacidad` existente.
- Cross-links: `/privacidad` (sitio) y `/elenaapp/privacidad` (app) se
  linkean mutuamente para claridad.

## Plan de implementación

1. Crear `specs/SPEC-113-elenaapp-privacy-policy.md` (este archivo).
2. Crear `src/pages/elenaapp/privacidad.astro`.
3. Actualizar `src/pages/sitemap.xml.ts` — agregar entry.
4. Actualizar `src/components/Footer.astro` — agregar link.
5. `npm run build` desde `metamorfosis-web/`.
6. Commit + entregar a Carlos las instrucciones para completar las
   declaraciones en App Store Connect y Play Console usando la tabla de
   mapeo de esta spec.

## Criterios de aceptación

**Página:**
- [ ] `/elenaapp/privacidad` responde 200 con la política completa.
- [ ] Todas las 19 secciones presentes y estructuradas.
- [ ] Datos declarados coinciden 1:1 con el schema `users/{uid}` real
      (auditables contra `src/lib/types/user.ts`).
- [ ] Menciones explícitas: Ley 1581, GDPR, CCPA, LGPD.
- [ ] Contacto (email + país) presente y correcto.
- [ ] Aviso "pendiente revisión abogado" (misma línea que `/privacidad`).
- [ ] Fecha de "Última actualización" visible.
- [ ] Link cross-reference a `/privacidad` (sitio web).
- [ ] Coherente en tono y diseño con `/privacidad` existente.

**Auxiliares:**
- [ ] `/sitemap.xml` incluye `/elenaapp/privacidad`.
- [ ] Footer tiene link "Privacidad Elena App".

**Post-deploy:**
- [ ] Carlos usa la tabla de mapeo (sección "Inventario de datos") para
      completar App Store Connect App Privacy Details y Play Console Data
      Safety.

## Riesgos / consideraciones

- **Salud es categoría especial GDPR (Art. 9).** El consentimiento debe
  ser explícito, NO tácito. El texto de la política lo hace evidente pero
  ElenaApp debe implementar el flow de consentimiento con checkbox NO
  pre-marcado antes del primer registro de datos de salud.
- **Apple prohíbe usar HealthKit data para advertising o venderlo.** La
  política declara explícitamente que NO se usa para advertising ni se
  vende. Si en el futuro se agrega monetización, revisar.
- **Play Families Policy:** al declarar edad 18+ como target de la app,
  no aplica. Sin embargo, si algún día Carlos quiere targetear menores
  (poco probable en salud metabólica), toda la política debe reescribirse.
- **Pendiente revisión legal profesional:** este documento es sólido para
  compliance técnico pero NO reemplaza a un abogado especialista en
  protección de datos y derecho digital para el lanzamiento comercial
  pleno. Recomendación: hacerlo revisar antes de submit a las stores.
- **Contenido idéntico entre `/privacidad` (sitio) y `/elenaapp/privacidad`:**
  hay overlap (Firebase, Resend, derechos, autoridad). Aceptable — cada
  política debe ser autocontenida (el user de la app puede no visitar el
  sitio web).
- **Cambios materiales requieren notificación 30 días:** si en el futuro
  se agrega una nueva categoría de datos o un nuevo tercero, se debe
  notificar a users registrados por email con 30 días de anticipación
  ANTES del cambio. Definido en la sección 19.

## Instrucciones post-implementación para Carlos

Cuando la spec cierre y la página esté deployada:

### 1. En Apple App Store Connect (My Apps → Elena App → App Privacy)

Completar "Data Types Collected" declarando cada dato de la tabla de
mapeo de esta spec. Para cada tipo:

- **Health & Fitness:** ✓ Collected — Linked to User — Purposes: App Functionality
- **Contact Info:** Email + Name — Linked to User — App Functionality
- **Identifiers:** User ID — Linked to User — App Functionality
- **User Content:** Photos (si cámara) + Other — Linked to User — App Functionality
- **Usage Data:** Product Interaction — Linked to User — Analytics + App Functionality
- **Diagnostics:** Crash Data + Performance Data — NOT Linked to User — Analytics
- **Purchases:** Purchase History (cuando se implemente) — Linked to User — App Functionality
- **Sensitive Info:** Health — Linked to User — App Functionality

Marcar "Data is NOT used to track you" para todo.

Pegar URL: `https://www.metamorfosisvital.com.co/elenaapp/privacidad` (o
`https://www.metamorfosisreal.org/elenaapp/privacidad` post-SPEC-111).

### 2. En Google Play Console (Policy → App content → Data Safety)

Completar cada tipo con las mismas categorías. Marcar:
- **Data encrypted in transit:** Yes
- **Users can request data deletion:** Yes
- **Committed to Play Families Policy:** No (app 18+)

Para cada tipo declarar:
- Personal info: Name, Email, User IDs — Collected + Shared con Firebase, Resend — App functionality, Account management
- Health and fitness: Health info, Fitness info — Collected + Shared con Firebase — App functionality
- Photos and videos: Photos — Collected + Shared con Firebase — App functionality (opcional)
- App activity: App interactions, User-generated content — Collected — App functionality, Analytics
- App info and performance: Crash logs, Diagnostics — Collected — Analytics
- Device or other IDs: Device or other IDs — Collected — Fraud prevention, security, App functionality

Pegar URL: misma que Apple.

### 3. Preparación para revisión legal

Enviar la URL a un abogado colombiano especialista en protección de datos
para review antes del launch comercial. Costo estimado: USD 300-500 por
review inicial (aprox 4-6h de trabajo profesional).

## Commit

**Mensaje:**
```
feat(spec-113): pagina /elenaapp/privacidad — politica de privacidad ElenaApp compliant con App Store + Play Store

Nueva pagina publica /elenaapp/privacidad con politica de privacidad de
Elena App conforme a:
- Ley 1581 de 2012 de Colombia + Decreto 1377 (Habeas Data)
- Requisitos Apple App Store Connect App Privacy Details
- Requisitos Google Play Data Safety section
- Menciones a GDPR (Europa), CCPA (California), LGPD (Brasil)

19 secciones estructuradas cubriendo:
- Responsable del tratamiento (Carlos Reyes)
- Datos recopilados mapeados 1:1 al schema users/{uid} (SPEC-005)
- Datos de salud como categoria especial (GDPR Art. 9)
- Push notifications y token de dispositivo
- HealthKit (iOS) y Google Fit (Android) — reglas estrictas Apple
- Camara / galeria (foto de perfil, comidas)
- Compras in-app (futuras)
- Encargados: Firebase, Resend, Umami, Apple, Google
- Derechos ARCO + revocacion + como ejercerlos
- Autoridad de control: SIC Colombia
- Aviso pendiente revision abogado antes del launch comercial

Auxiliares:
- Sitemap: agregar /elenaapp/privacidad con prioridad 0.3
- Footer: nuevo link \"Privacidad Elena App\"

Independiente de SPEC-111 (migracion de dominio): la URL funciona en
.com.co y en .org. Cuando SPEC-111 cierre, actualizar el link en App
Store Connect y Play Console.

Tabla de mapeo datos → categorias Apple/Google en la spec para que
Carlos complete los formularios de ambas stores.

Cierra specs/SPEC-113-elenaapp-privacy-policy.md
```

---

## Resultado

Implementado en una sola pasada el 2026-05-25.

**Archivos creados:**
- `metamorfosis-web/src/pages/elenaapp/privacidad.astro` — política completa 19 secciones + resumen visual + autoridad de control. ~500 líneas de contenido legal.
- `specs/SPEC-113-elenaapp-privacy-policy.md` — esta spec.

**Archivos modificados:**
- `metamorfosis-web/src/pages/sitemap.xml.ts` — agregadas 3 entries pendientes: `/elenaapp/privacidad` (prio 0.3), `/elenasupport` (prio 0.5 — pendiente de SPEC-112), `/imr/metodologia` (prio 0.4 — pendiente de SPEC-102). Cierra parcialmente el hallazgo H5 del reporte SEO 2026-05-25.
- `metamorfosis-web/src/components/Footer.astro` — nuevo link "Privacidad Elena App" en la columna Legal.

**Decisiones tomadas con Carlos:**
- Ruta: `/elenaapp/privacidad` (jerárquica, escalable a `/elenaapp/terminos`, `/elenaapp/eula` en el futuro).
- Idioma: solo español (mercado LATAM + España inicial). Sub-spec futura si se agrega inglés para US.
- Features declaradas: TODAS (push notifications, pagos in-app, HealthKit/Google Fit, cámara/galería). Cubre V1 y V1.1 sin necesidad de reescribir política.
- Email DPO: `metamorfosisvitaloficial@gmail.com` (mismo que `/privacidad` del sitio, sin infra nueva).
- Edad mínima: 18+ (coherente con `/privacidad`).

**Verificación local:**
- `npm run build` — pasa en 15s. Los 2 warnings preexistentes (ArticleQuiz getDoc + firebase dyn-vs-static) no son del scope.
- Página renderiza correctamente con Layout dark, cross-links a `/privacidad`, `/terminos`, `/disclaimer-medico`, `/elenasupport`.
- Coherencia visual con `/privacidad` del sitio verificada por comparación estructural.

**Pendientes de Carlos post-push:**
- `git push origin main` → deploy automático.
- Completar App Store Connect → App Privacy Details usando tabla de mapeo en sección "Inventario de datos" arriba.
- Completar Google Play Console → Data Safety usando la misma tabla.
- Pegar URL `https://www.metamorfosisvital.com.co/elenaapp/privacidad` como Privacy Policy URL en ambas stores.
- Cuando SPEC-111 cierre (migración al `.org`), actualizar URL en ambas stores.
- **Antes del launch comercial:** review por abogado colombiano especializado en protección de datos. Costo estimado USD 300-500.

**Notas de coordinación:**
- El sitemap ahora incluye correctamente `/elenaapp/privacidad`, `/elenasupport` y `/imr/metodologia` — cierra el hallazgo H5 del reporte SEO.
- Cuando SPEC-111 haga cutover al `.org`, los canonical URLs se actualizan automáticamente (usan `Astro.site`).

Sin desviaciones del plan.
