# SPEC-NNN — Título

**Estado:** 📝 Spec | 🔨 En progreso | ✅ Cerrada | ⏸️ Pausada | ❌ Descartada
**Fase:** 1 / 2 / 3 / 4
**Severidad:** CRÍTICO / ALTO / MEDIO / BAJO
**Fecha de creación:** YYYY-MM-DD
**Autor:** Carlos Reyes
**Depende de:** SPEC-NNN, SPEC-NNN — o "ninguna"

---

## Contexto

Qué encontró la revisión y por qué importa. Citar el archivo y línea cuando aplique. Una imagen clara del problema, no un repaso del código.

## Problema

Una o dos frases muy concretas. Si no se puede expresar en dos frases, la spec probablemente está mezclando cosas.

## Solución propuesta

Cómo lo vamos a resolver, en concepto. Decisiones de diseño con sus trade-offs si los hay. Si hay alternativas que se descartaron, anotar cuál y por qué.

## Plan de implementación

Pasos concretos en orden. Cada paso menciona archivo(s) y operación (crear / modificar / borrar / mover):

1. Modificar `path/al/archivo.ts` — descripción del cambio.
2. Crear `path/al/nuevo.ts` — propósito.
3. Borrar `path/legacy.ts`.
4. ...

## Criterios de aceptación

Lista verificable. Cada criterio se puede chequear con un sí/no:

- [ ] El endpoint responde 401 cuando no hay cookie de sesión válida.
- [ ] El build de producción no lanza error.
- [ ] No hay regresiones visibles en `/quiz`.
- [ ] ...

## Pruebas

Cómo verificamos. Comandos exactos cuando aplique:

```sh
# Local
cd metamorfosis-web && npm run build

# Endpoint
curl -i http://localhost:4321/api/admin/cleanup
# Esperado: HTTP/1.1 401 Unauthorized
```

## Riesgos / consideraciones

- Qué puede salir mal.
- Qué hacer si sale mal (rollback, feature flag, etc.).

## Commit

**Mensaje sugerido:**
```
feat(spec-NNN): título corto

- bullet 1
- bullet 2

Cierra specs/SPEC-NNN-*.md
```

---

## Resultado

*(Se llena al cerrar la spec. Si hubo desviaciones del plan, anotarlas aquí.)*
