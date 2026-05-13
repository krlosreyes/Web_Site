# Estrategia de propiedad intelectual — Metamorfosis Real

> **Documento para llevar a agente de propiedad industrial / abogado de PI.**
>
> Define qué proteger, cómo protegerlo y en qué orden de prioridad. Toda
> figura aquí mencionada está sujeta a validación profesional antes de
> tramitar registros.
>
> Fecha de redacción: 2026-05-12
> Última revisión: 2026-05-12

---

## 1. Contexto del proyecto

- **Marca comercial:** Metamorfosis Real
- **Activo de marca diferenciador:** IMR (Índice de Metamorfosis Real)
- **Productos asociados:** sitio web metamorfosisvital.com.co + ElenaApp (app móvil en desarrollo)
- **Responsable / titular:** Carlos Reyes — persona natural domiciliada en Colombia
- **Naturaleza del negocio:** plataforma digital educativa de salud metabólica
- **Audiencia:** principalmente Latinoamérica (Colombia, México, España, Argentina, Chile, Perú)

## 2. Resumen ejecutivo — qué proteger y cómo

| Activo | Figura de PI | Estado actual | Acción recomendada | Costo aprox |
|---|---|---|---|---|
| Nombre "Metamorfosis Real" | Marca comercial | NO registrada | Registrar SIC clase 41 + 9 | USD 700 |
| Nombre "IMR" / "Índice de Metamorfosis Real" | Marca comercial | NO registrada | Registrar SIC clase 41 + 9 | USD 700 |
| Nombre "ElenaApp" | Marca comercial | NO registrada | Registrar SIC clase 9 antes de lanzamiento | USD 350 |
| Algoritmo del IMR | Patente | NO aplicable (excluida en CAN) | NO patentar — mantener como secreto | $0 |
| Código fuente del motor IMR | Derecho de autor | Protección automática | Registrar en DNDA para fecha cierta | USD 15 |
| Fórmula y pesos del IMR | Secreto industrial | Protegido (repo privado) | Reforzar con NDA + política interna | USD 150 (template NDA) |
| Dominios del proyecto | Nombre de dominio | metamorfosisvital.com.co registrado | Registrar 4-5 variantes defensivas | USD 50/año |

**Inversión total estimada año 1:** USD 1,800 - 2,200.

## 3. Lo que NO se debe hacer

### 3.1 NO patentar el algoritmo del IMR

**Razón legal:** la Decisión 486 de la Comunidad Andina (Art. 15) excluye expresamente de patentabilidad los métodos matemáticos, programas de ordenador per se, y los métodos para el ejercicio de actividades intelectuales. La misma posición sostiene la Oficina Europea de Patentes (EPC Art. 52) y la mayoría de oficinas latinoamericanas.

**En USA** los algoritmos son técnicamente patentables desde el caso *Bilski v. Kappos (2010)*, pero tras *Alice Corp v. CLS Bank International (2014)* la USPTO exige demostrar "ventaja técnica concreta no abstracta". Un score educativo multifactorial difícilmente supera el test de Alice. Riesgo de rechazo alto.

**Costo de intentar patentar:** USD 5,000-15,000 (USPTO + abogado de patentes) + 18-24 meses de trámite + alta probabilidad de denegación.

**Veredicto:** descartar patente. El recurso óptimo para proteger el algoritmo es el **secreto industrial** (sección 4.4).

### 3.2 NO registrar marca en clase 44 (servicios médicos)

Carlos Reyes no es médico ni profesional de la salud habilitado. Registrar la marca en clase 44 podría usarse como evidencia en un eventual proceso por ejercicio ilegal de la medicina (Ley 23 de 1981, Art. 49). Las clases correctas son **41 (educación)** y **9 (software / aplicaciones móviles)**.

### 3.3 NO publicar la fórmula del IMR

Si en algún momento (entrevista, blog, podcast, paper, redes sociales) se publica el cálculo exacto, los pesos del algoritmo o los rangos de normalización, el carácter de secreto industrial se pierde de forma irreversible. La página `/imr` del sitio ya está redactada con esta restricción en mente.

## 4. Lo que SÍ se debe hacer

### 4.1 Registro de marca — Superintendencia de Industria y Comercio (SIC)

**Marco legal:** Decisión 486 de la Comunidad Andina + Código de Comercio colombiano. Trámite ante la SIC vía plataforma SIPI (sipi.sic.gov.co).

**Marcas prioritarias:**

| Marca | Clase Niza | Justificación | Prioridad |
|---|---|---|---|
| Metamorfosis Real | 41 | Servicios educativos, capacitación, publicaciones, podcast, comunidad online | 🔴 ALTA |
| Metamorfosis Real | 9 | Software descargable, aplicaciones móviles | 🔴 ALTA |
| IMR | 41 | Servicios educativos asociados al índice | 🟠 MEDIA |
| IMR | 9 | Software y aplicaciones que implementan el índice | 🟠 MEDIA |
| Índice de Metamorfosis Real | 41 + 9 | Variante completa, blindaje adicional | 🟡 OPCIONAL |
| ElenaApp | 9 | App móvil futura | 🟠 MEDIA (antes del lanzamiento de la app) |

**Búsqueda previa de antecedentes:** antes de tramitar, hacer **búsqueda de antecedentes marcarios** en la SIC para verificar que no haya marcas idénticas o confundibles previamente registradas. La SIC ofrece esta consulta gratuita en sipi.sic.gov.co/sipi.

**Vigencia:** 10 años renovables indefinidamente (Art. 152 Decisión 486).

**Costos SIC (referenciales, verificar tasas vigentes):**
- Tasa solicitud por clase: aprox. $1,200,000 COP (USD 300)
- Si se contrata agente de PI: + $500,000 - $1,500,000 COP (USD 125-380) por marca
- **Total por marca con agente:** ~$1,700,000 - $2,700,000 COP (USD 430-680)

**Plazo:** 6-9 meses si no hay oposición. 12-18 meses si hay oposición de terceros.

### 4.2 Registro del código fuente — DNDA

**Marco legal:** Ley 23 de 1982 + Decisión Andina 351 de 1993. La protección de los programas de computador es automática al momento de crear la obra, pero el registro ante la **Dirección Nacional de Derecho de Autor (DNDA)** otorga prueba de autoría y fecha cierta de creación.

**Qué registrar:**
- Motor IMR: `metamorfosis-web/src/lib/imr/engine.ts`
- Motor IMR helper: `metamorfosis-web/src/utils/imr-engine.ts`
- Recomendable como una sola obra: "Motor de cálculo del Índice de Metamorfosis Real — versión 1.0"

**Trámite:**
- 100% online en derechodeautor.gov.co
- Cargar PDF con el código fuente completo (mejor con timestamps)
- Costo: ~$50,000 COP (USD 12-15) por obra
- Plazo: 15 días hábiles

**Vigencia:** vida del autor + 80 años (Art. 21 Ley 23 de 1982).

### 4.3 Dominios defensivos

**Marco legal:** sistema de registro privado de DNS. No es propiedad intelectual stricto sensu, pero su captura previa por terceros (cybersquatting) puede dañar la marca.

**Dominios recomendados a registrar:**

| Dominio | Razón |
|---|---|
| metamorfosisreal.com | Versión .com directa, más memorable internacionalmente |
| metamorfosisvital.co | Sin el .com.co (más corto) |
| indicemetabolico.com | SEO de keyword genérica + defensivo |
| indicemetabolico.co | Variante regional |
| imr.com.co | Atajo perfecto si está disponible |

**Acción inmediata:** verificar disponibilidad en Namecheap.com o Hostinger antes de que un tercero los capture. Costo USD 10-15/año cada uno.

**Configuración técnica:** redirect HTTP 301 al dominio principal (metamorfosisvital.com.co).

### 4.4 Secreto industrial — la fórmula del IMR

**Marco legal:** Decisión 486 CAN (Arts. 260-266) + Código de Comercio (Art. 35 Ley 256/1996 — competencia desleal). Define secreto empresarial como información que:

1. No es generalmente conocida ni de fácil acceso
2. Tiene valor comercial por ser secreta
3. Su poseedor ha tomado medidas razonables para mantenerla secreta

**Lo protegido en Metamorfosis Real:**
- Fórmula matemática exacta del cálculo IMR
- Pesos asignados a cada variable (peso, cintura, ayuno, sueño, etc.)
- Rangos de normalización
- Lógica de las zonas biológicas (deteriorado/transición/óptimo)

**Medidas de protección recomendadas:**

| Medida | Estado actual | Acción |
|---|---|---|
| Código en repositorio privado | ✅ GitHub privado | Mantener |
| Página `/imr` documenta QUÉ evalúa, no CÓMO calcula | ✅ Implementado | Mantener; revisar antes de cada release de contenido |
| NDA con desarrolladores o colaboradores | ⏳ No aplica (Carlos único) | Preparar template para cuando aplique |
| Política interna de manejo de PI | ⏳ Pendiente | Documentar en `docs/IP-POLICY.md` |
| Marcar archivos del motor IMR como "Confidencial" | ⏳ Pendiente | Agregar header en cada archivo del motor |
| Acceso restringido al motor en repos compartidos (si se llegan a usar) | N/A | Aplicar cuando aplique |

**Vigencia:** indefinida mientras se mantenga el secreto. A diferencia de la patente (20 años) y la marca (10 años renovables), el secreto industrial puede durar 100+ años (caso paradigmático: la fórmula de Coca-Cola, secreta desde 1886).

**Riesgo:** si un competidor descubre la fórmula por **ingeniería inversa legítima** (ej. analizando los outputs del Quiz IMR para muchos inputs y reconstruyendo el algoritmo), NO hay infracción legal. El secreto industrial NO protege contra reverse engineering — solo contra revelación indebida por personas con obligación de confidencialidad.

## 5. Cronograma de implementación

### Fase 1 — Bloqueo defensivo (semanas 1-2) — USD 800

1. **Semana 1**: Búsqueda de antecedentes marcarios en SIPI (gratis, online).
2. **Semana 1**: Registrar dominios defensivos en Namecheap/Hostinger (USD 50).
3. **Semana 2**: Solicitud de marca "Metamorfosis Real" en clase 41 + 9 (USD 700 con agente).

### Fase 2 — Refuerzo (mes 1-2) — USD 1,000

4. **Mes 1**: Solicitud de marca "IMR" en clase 41 + 9.
5. **Mes 1**: Registro del código fuente del motor IMR ante DNDA (USD 15).
6. **Mes 2**: Solicitud de marca "ElenaApp" en clase 9, antes del lanzamiento de la app.

### Fase 3 — Internacionalización (mes 6+) — opcional, escalable

7. **Sistema de Madrid (OMPI)**: si Metamorfosis Real expande a más países, considerar registro internacional vía el Protocolo de Madrid. Una sola solicitud puede cubrir hasta 130 países. Costo base: 653 CHF (~USD 730) + tasas por país.
8. **México (IMPI)**: si el mercado mexicano supera 15% del tráfico, registrar marca directa allá.
9. **Estados Unidos (USPTO)**: solo si Metamorfosis Real lanza ElenaApp con marketing en USA. Costo USPTO: USD 250-350 por clase + abogado de marcas.

## 6. Cómo elegir agente de propiedad industrial

**Perfil deseado:**
- Agente de PI con licencia vigente ante la SIC (verificar en sic.gov.co)
- Experiencia en marcas de servicios digitales / startups / SaaS
- Ofrece búsqueda de antecedentes gratuita o de bajo costo
- Tarifa transparente por marca + clase
- Disponibilidad para acompañar oposiciones (improbables pero posibles)

**Tipos:**

| Tipo | Pros | Contras | Costo orientativo |
|---|---|---|---|
| Bufete grande (Brigard Urrutia, Lloreda Camacho, Cárdenas y Cárdenas) | Reputación, experiencia internacional | Caro, ritmos lentos | USD 800-1,500/marca |
| Bufete boutique de PI (Posse Herrera Ruiz, Olarte Moure) | Especialistas, calidad alta | Caro pero menos que bufete grande | USD 500-900/marca |
| Agente independiente con experiencia comprobable | Económico, atención personalizada | Riesgo de calidad variable | USD 200-450/marca |
| Plataformas online (Trademarkia, etc.) | Más barato y rápido | Servicio templado, sin asesoría estratégica | USD 150-300/marca |

**Recomendación:** para una startup en fase pre-lanzamiento, **agente independiente con experiencia comprobable** suele ser el mejor punto de equilibrio. Pedir 2-3 referencias de marcas registradas previamente por el agente.

## 7. Preguntas concretas para el agente

Llegar a la consulta inicial con estas preguntas escritas:

1. ¿Hay marcas idénticas o confundibles previamente registradas en clase 41 o 9 con la palabra "Metamorfosis"? ¿En clase 41/9 con "IMR"?
2. ¿Cuál es el costo total (tasas SIC + honorarios) por registrar "Metamorfosis Real" en clases 41 + 9?
3. ¿Cuál es el plazo realista de registro sin oposición? ¿Con oposición?
4. ¿Recomiendas registrar también las variantes "Metamorfosis Real" + logo (marca mixta) o solo la denominativa (palabra) en esta etapa?
5. Para "IMR" como marca de tres letras, ¿hay riesgo de oposición por marcas de otros sectores que usen IMR (instituciones médicas, etc.)?
6. ¿Conviene registrar también la transliteración fonética "Eme Erre" o solo "IMR"?
7. ¿Cuáles son los plazos de oposición de terceros y cómo se monitorea?
8. ¿Tu tarifa incluye respuesta a una primera oposición o se cobra adicional?
9. Para "ElenaApp" — ¿se puede registrar antes de lanzar la app, o conviene esperar a tener el producto?
10. ¿Recomiendas registro en sistema de Madrid (internacional) desde el inicio o esperar?

## 8. Checklist de medidas internas (independiente del agente)

### A implementar esta semana

- [ ] Verificar disponibilidad de dominios defensivos en Namecheap
- [ ] Registrar metamorfosisreal.com, metamorfosisvital.co, indicemetabolico.com (mínimo)
- [ ] Hacer búsqueda gratuita de antecedentes marcarios en sipi.sic.gov.co
- [ ] Exportar timestamps del repositorio GitHub mostrando primeros commits del motor IMR (evidencia de fecha cierta de creación)
- [ ] Guardar screenshots fechados de páginas del sitio actual como referencia histórica

### A implementar este mes

- [ ] Contactar 2-3 agentes de PI colombianos para cotización
- [ ] Iniciar trámite de marca "Metamorfosis Real" en SIC clase 41 + 9
- [ ] Registrar motor IMR ante DNDA
- [ ] Agregar header de confidencialidad en archivos del motor IMR:
  ```
  /**
   * CONFIDENCIAL — Propiedad intelectual de Metamorfosis Real.
   * El algoritmo de cálculo del IMR es secreto industrial.
   * Prohibida la reproducción, distribución o ingeniería inversa.
   */
  ```
- [ ] Crear `docs/IP-POLICY.md` con políticas internas de manejo de PI

### A implementar próximos 3-6 meses

- [ ] Marca "IMR" en SIC
- [ ] Marca "ElenaApp" en SIC (antes de lanzamiento de la app)
- [ ] Preparar template de NDA con abogado para futuros colaboradores
- [ ] Evaluar Sistema de Madrid si tráfico extranjero supera 30%

## 9. Riesgos identificados y mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Tercero registra "Metamorfosis Real" antes que Carlos | Media (sube con publicidad) | Alto (pérdida del nombre comercial) | Registrar marca YA, antes de invertir en ads |
| Competidor reconstruye el IMR por ingeniería inversa | Baja | Alto | Mantener algoritmo en repo privado; el daño se mitiga si la marca está registrada |
| Oposición a la marca por marca idéntica/similar previa | Baja-media | Medio (tiempo + costos legales) | Búsqueda de antecedentes previa al registro |
| Pérdida del dominio principal por renovación olvidada | Baja | Crítico | Configurar auto-renewal + email recordatorio en Hostinger |
| Cybersquatting de variantes del dominio | Media | Bajo-medio | Registrar variantes defensivas YA |
| Empleado o colaborador filtra la fórmula del IMR | N/A actualmente | Crítico (pérdida secreto industrial) | NDA antes de dar acceso a cualquier colaborador futuro |

## 10. Acción concreta para esta semana

Si Carlos solo puede hacer 3 cosas esta semana:

1. **Verificar dominios defensivos en Namecheap** (10 minutos, USD 50 todo incluido).
2. **Búsqueda gratuita en sipi.sic.gov.co** para "Metamorfosis Real" e "IMR" en clases 41 y 9.
3. **Solicitar cotización a 2 agentes de PI** colombianos por email (15 minutos cada uno).

Con esas 3 acciones, en menos de 1 hora total, el bloqueo defensivo está listo y la consulta profesional iniciada.

---

## Apéndice: glosario rápido

- **CAN**: Comunidad Andina (Bolivia, Colombia, Ecuador, Perú).
- **SIC**: Superintendencia de Industria y Comercio (Colombia).
- **SIPI**: Sistema de Información de la Propiedad Industrial — plataforma online de la SIC para trámites de marcas, patentes y diseños industriales.
- **DNDA**: Dirección Nacional de Derecho de Autor (Colombia).
- **Clases Niza**: clasificación internacional de productos y servicios para registro de marcas (45 clases).
- **Marca denominativa**: solo la palabra/texto (ej. "Metamorfosis Real").
- **Marca mixta**: palabra + logo combinados.
- **OMPI**: Organización Mundial de la Propiedad Intelectual.
- **Sistema de Madrid**: protocolo para registro internacional de marcas administrado por la OMPI.
- **USPTO**: United States Patent and Trademark Office.

---

**Próxima revisión sugerida del documento:** trimestral, o ante cualquier cambio en el estado de registros pendientes.
