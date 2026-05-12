# Checklist legal para revisión de abogado

> **Para qué sirve este documento:** llevarle a un abogado especializado en
> derecho digital y protección de datos en Colombia (con experiencia en
> Latinoamérica) un insumo ordenado de lo que ya se implementó técnicamente
> y lo que necesita su revisión profesional antes del lanzamiento comercial
> pleno de Metamorfosis Real y ElenaApp.
>
> Documento generado tras SPEC-080.
> Fecha: 2026-05-12.

---

## 1. Contexto del proyecto

- **Sitio web:** metamorfosisvital.com.co
- **Responsable:** Carlos Reyes (ingeniero, NO médico)
- **País del responsable:** Colombia
- **Audiencia target:** principalmente hispanoamericana (Colombia, México, España, Argentina, Chile, Perú)
- **Naturaleza:** ecosistema digital de información educativa sobre salud
  metabólica (ayuno intermitente, nutrición, sueño, ejercicio, hidratación) +
  herramienta de auto-evaluación (Quiz IMR) + producto futuro (ElenaApp,
  app móvil con suscripción anual).

## 2. Frente regulatorio aplicable

Marcos legales identificados que deben validarse con asesoría:

- **Ley 1581 de 2012** (Colombia, Habeas Data) + **Decreto 1377 de 2013**
- **Ley 1480 de 2011** (Estatuto del Consumidor — Colombia)
- **Ley 23 de 1981** (Código de Ética Médica — ejercicio ilegal de medicina)
- **Ley 23 de 1982** (Derechos de autor)
- **Decisión Andina 351 de 1993** (derechos de autor regional)
- **GDPR** (UE) — aplica si llegan visitantes europeos al sitio
- **CCPA** (California) — aplica si llegan usuarios de California
- **COPPA** (USA) — aplica si menores de 13 años acceden
- **LGPD** (Brasil) — si se hace marketing al mercado brasileño

## 3. Lo que YA está implementado técnicamente

### Disclaimer médico

- ✅ Componente `MedicalDisclaimer` con 3 variantes (full, compact, inline)
- ✅ Banner en `/quiz` (variante full antes de iniciar el quiz)
- ✅ Banner en `/dashboard` (variante compact al inicio)
- ✅ Banner al pie de cada artículo en `/posts/[slug]` (variante compact)
- ✅ Disclaimer global al pie del footer en todas las páginas
- ✅ Página dedicada `/disclaimer-medico` con copy completo
- ✅ Texto explícito "Carlos Reyes NO es médico" en `/sobre-mi`

### Términos y condiciones

- ✅ Documento reescrito en `/terminos` cubriendo:
  - Aceptación de términos
  - Naturaleza educativa del servicio (no médico)
  - Edad mínima 18
  - Cuenta de usuario
  - Cohorte fundador (beneficios futuros sin garantía de fecha)
  - Uso aceptable
  - Propiedad intelectual
  - Contenido del foro
  - Limitación de responsabilidad
  - Suspensión y terminación
  - Cambios a los términos
  - Ley aplicable y jurisdicción (Colombia)

### Privacidad

- ✅ Documento reescrito en `/privacidad` cubriendo Ley 1581:
  - Responsable del tratamiento
  - Datos que se recopilan (categorías detalladas)
  - Finalidad del tratamiento
  - Base legal (consentimiento)
  - Encargados del tratamiento (Firebase, Resend, Hostinger, Umami)
  - Transferencia internacional
  - Derechos del titular (8 derechos según Ley 1581)
  - Cómo ejercer los derechos
  - Plazo de conservación
  - Seguridad
  - Cookies y tecnologías similares
  - Datos de menores
  - Cambios a la política

### Consentimiento de cookies

- ✅ Componente `CookieBanner` que aparece la primera visita
- ✅ Botones "Aceptar todo" y "Solo esenciales"
- ✅ Persistencia en localStorage con timestamp
- ✅ Links visibles a `/privacidad` y `/terminos`

### Protección de menores

- ✅ Edad mínima 18 declarada en `/terminos`
- ✅ Validación en quiz IMR: si edad < 18, bloqueo + mensaje
- ✅ Declaración bajo presión de uso ("al continuar declaras que tienes 18+")
- ✅ Política de privacidad declara: no recopilamos datos de menores

## 4. Lo que NECESITA validación profesional

### Prioridad ALTA — antes del lanzamiento comercial

1. **Revisar copy completo de `/terminos`**
   - Validar cláusulas de limitación de responsabilidad bajo Ley 1480
     (Estatuto del Consumidor): no se permiten cláusulas abusivas que
     limiten responsabilidad del proveedor frente al consumidor.
   - Calibrar jurisdicción y arbitraje (la cláusula actual remite a Colombia;
     verificar si aplica fuero del consumidor para usuarios extranjeros).
   - Revisar la cláusula de "Cohorte fundador" — actualmente promete
     beneficios futuros pero sin fecha. ¿Hay riesgo legal si la app nunca
     se lanza? ¿Cómo se comunica al usuario el cambio o eliminación de
     beneficios?
   - Confirmar si la cláusula de propiedad intelectual del foro
     (licencia que otorga el usuario al postear) es válida en Colombia.

2. **Revisar copy completo de `/privacidad`**
   - Confirmar que el listado de encargados del tratamiento es completo
     y que sus políticas son compatibles con Ley 1581.
   - Verificar que la transferencia internacional a Estados Unidos
     (Firebase/Google) está adecuadamente justificada — Colombia tiene
     régimen de "lista de países con nivel adecuado de protección" que
     ha cambiado en los últimos años.
   - Validar plazo de respuesta de 15 días hábiles para consultas y 10
     para reclamos — verificar contra la última normativa SIC.
   - Confirmar si hay obligación de inscripción del responsable en el
     Registro Nacional de Bases de Datos (RNBD) de la SIC. Si Carlos
     recopila datos personales de >100 personas con ánimo de lucro, sí
     requiere inscripción.

3. **Disclaimer médico — ejercicio ilegal de medicina**
   - Revisar si el copy actual del Quiz IMR y del dashboard es
     suficiente para descartar imputación por ejercicio ilegal de
     medicina (Ley 23 de 1981, Art. 49).
   - Validar el uso de términos médicos en artículos (autofagia,
     insulina, mTOR, mitocondrias, etc.): información científica
     ≠ diagnóstico, pero un fiscal podría argumentar lo contrario.
   - Recomendación factible: tener un "Asesor Médico" público
     (un médico licenciado que avale el método) para blindar.

4. **Cohorte fundador y promesas comerciales**
   - El sitio promete "precio fundador permanente" y "beneficios
     sorpresa" a los primeros 1000 usuarios. ¿Qué pasa si Carlos no
     puede cumplir? ¿Es una "oferta vinculante" bajo Estatuto del
     Consumidor o "expectativa razonable"?
   - Si en algún momento se monetiza ElenaApp, ¿el "precio fundador"
     debe materializarse en valor económico cuantificable?

### Prioridad MEDIA — antes de empezar marketing pago

5. **Disclaimer comercial / afiliaciones**
   - Si en algún momento Carlos recomienda productos con links de
     afiliación (Amazon, suplementos, libros), Ley 1480 exige
     disclaimer claro de relación comercial. Actualmente no hay
     afiliaciones — pero anticipar la política.

6. **Email marketing**
   - El sitio envía emails transaccionales (Resend) y eventualmente
     newsletter. Validar:
     - Opción de "darse de baja" (unsubscribe) en cada email.
     - Captura de consentimiento explícito para newsletter (separado
       de la creación de cuenta).
     - Cumplimiento de Ley 1581 Art. 4 (consentimiento previo,
       expreso e informado).

7. **Términos de la app móvil ElenaApp (futuro)**
   - Cuando la app móvil se lance con suscripción, requiere su propio
     juego de T&C específicos para:
     - In-app purchases (políticas Apple/Google)
     - Renovación automática
     - Derecho de retracto (5 días hábiles en Colombia, Art. 47 Ley 1480)
     - Política de reembolso
     - Cancelación de suscripción

8. **Foro / comunidad**
   - Responsabilidad por contenido de terceros (Art. 31 Ley 1480
     limita responsabilidad por publicidad engañosa pero ¿aplica a
     UGC?).
   - Política de moderación documentada.
   - Procedimiento de denuncia de contenido inapropiado.

### Prioridad BAJA — escalamiento internacional

9. **GDPR (Unión Europea)**
   - Si en analytics aparece tráfico europeo significativo (>5% del
     total), considerar implementar GDPR compliance completo:
     - DPO (Data Protection Officer) o representante en UE
     - Registros de actividades de tratamiento (Art. 30 GDPR)
     - Derecho a la portabilidad de datos
     - Notificación de brechas en 72h al supervisor europeo

10. **Registro Nacional de Bases de Datos (RNBD)**
    - Si Carlos califica como "responsable de tratamiento" sujeto a
      inscripción (criterios SIC), debe registrar las bases de datos
      que opera. El cumplimiento exige cargar información sobre
      cada base, sus finalidades, encargados, etc.

## 5. Preguntas concretas para el abogado

Recomiendo llegar a la reunión con estas preguntas escritas:

1. ¿El copy actual de `/terminos` y `/privacidad` cumple Ley 1581 y
   Decreto 1377? ¿Qué cláusulas son innegociables agregar?
2. ¿El disclaimer médico actual descarta riesgo de ejercicio ilegal
   de medicina? ¿Necesitamos un asesor médico licenciado que firme?
3. ¿La promesa de "precio fundador permanente" a los primeros 1000
   usuarios es vinculante? ¿Cómo redactarla para tener flexibilidad
   sin romper el Estatuto del Consumidor?
4. ¿El responsable debe inscribirse en el RNBD de la SIC?
5. ¿Cuál es el riesgo real si lanzamos sin estos documentos revisados
   formalmente y monitoreamos en cumplimiento "razonable"?
6. ¿Cuál es la jurisdicción óptima en cláusula de resolución de
   disputas (Colombia vs arbitraje en cámara de comercio)?
7. Para la app móvil futura: ¿qué T&C específicos requiere
   suscripción con renovación automática en Colombia?
8. ¿Cómo se documenta el consentimiento del usuario para usar el
   IMR como "auto-evaluación" y no como "diagnóstico"?

## 6. Costo estimado y dónde buscar

- **Revisión completa T&C + Privacidad**: USD 200-400 con abogado
  especializado en derecho digital. Recomendado: bufetes pequeños
  o abogados independientes con experiencia comprobable en startups
  digitales colombianas (ej. Lloreda Camacho, Brigard Urrutia tienen
  divisiones digital pero son más caros).
- **Asesor médico para co-firma**: si Carlos consigue un médico amigo
  o profesional que avale públicamente el método metabólico, el
  costo puede ser $0 (relación profesional) o USD 100-300/año
  (consultor formal).
- **Inscripción en RNBD**: gratis, pero requiere preparación de
  documentación (~2-4 horas).

## 7. Tracking de fechas legales clave

| Documento | Última actualización | Próxima revisión sugerida |
|---|---|---|
| `/disclaimer-medico` | 2026-05-12 | Cuando se lance ElenaApp |
| `/terminos` | 2026-05-12 | Tras revisión de abogado |
| `/privacidad` | 2026-05-12 | Tras revisión de abogado |
| `LEGAL-CHECKLIST.md` (este doc) | 2026-05-12 | Revisar trimestral |

## 8. Comunicación de cambios a usuarios

Si tras la revisión legal hay cambios materiales en T&C o Privacidad,
es obligatorio notificar a los usuarios registrados:

- Email con anticipación mínima de 30 días
- Indicar qué cláusulas cambian y por qué
- Permitir al usuario cerrar su cuenta y solicitar supresión de datos
  si no acepta los nuevos términos

Esto debe quedar documentado en el cambio mismo (changelog de cada
política).
