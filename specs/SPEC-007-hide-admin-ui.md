# SPEC-007 — Esconder UI admin a visitantes anónimos

**Estado:** ✅ Cerrada
**Fase:** 2
**Severidad:** ALTO (UX + seguridad menor)
**Fecha de creación:** 2026-05-09
**Cerrada:** 2026-05-10 (verificada en producción)
**Autor:** Carlos Reyes
**Depende de:** SPEC-003 (contrato auth admin) — ya cerrada

---

## Contexto

Después de SPEC-003 el Navbar muestra "Modo Admin" + "Cerrar Sesión" cuando hay sesión, pero **cuando NO hay sesión sigue mostrando el link `/admin`** con `opacity-30`. El Footer también muestra el link `/admin` y un icono. Resultado:

- Cualquier visitante ve la URL `/admin/login` antes de buscarla.
- Bots de fuerza bruta pueden llegar al endpoint sin scanning.
- UX: el link confunde a usuarios normales (no es para ellos).

`Navbar.astro` (línea ~63 cuando no admin):
```astro
<a href="/admin" class="... opacity-30 hover:opacity-100">Admin</a>
```

`Footer.astro` (sección "Copyright & Admin Entry" al final):
```astro
<a href="/admin" class="...">
    <svg .../>
    Admin
</a>
```

## Problema

La UI expone deliberadamente la ruta admin a todos los visitantes. No es un secreto que existe, pero exponerla agrega superficie de ataque sin beneficio para users legítimos.

## Solución propuesta

Renderizar el link `/admin` **solo cuando `isAdmin === true`**:

- En Navbar: ya está parcialmente correcto post-SPEC-003 (muestra link verde si admin). Eliminar el branch `else` que muestra el link opaco.
- En Footer: el bloque "Admin" del bottom-bar solo se renderiza si `isAdmin`.

Para **emergencia** (Carlos quiere acceder al admin sin link), la URL `/admin/login` sigue funcionando — solo dejamos de publicarla en el HTML público.

## Plan de implementación

1. **`src/components/Navbar.astro`**: en el bloque del Desktop Menu, el `<a href="/admin">` opaco se elimina. Solo queda el branch que muestra el link cuando `isAdmin`.

2. **`src/components/Footer.astro`**: el bloque "Admin Entry" del bottom-bar (con el ícono SVG) se envuelve en `{isAdmin && (...)}`. Si no es admin, solo aparecen "Privacidad" y "Términos".

3. **Smoke test**:
   - Visitante anónimo: `view-source` del HTML no contiene `/admin`.
   - Visitante con sesión admin: el link aparece destacado en Navbar + Footer.

## Criterios de aceptación

- [ ] Visitante anónimo en `/`: el HTML servido no contiene la string `/admin` como href visible (puede aparecer en JS bundles internos, eso no cuenta).
- [ ] Visitante con cookie admin válida en `/`: ve el link "Admin" destacado en Navbar (verde) y/o Footer.
- [ ] Acceso directo a `https://metamorfosisvital.com.co/admin/login` sigue funcionando (solo dejamos de publicar la URL en el HTML).

## Pruebas

```sh
# 1. Como visitante anónimo
curl -s https://metamorfosisvital.com.co/ | grep -c 'href="/admin"'
# Esperado: 0

# 2. Como admin (con cookie)
COOKIE=$(curl -s -i -X POST https://metamorfosisvital.com.co/api/admin/login \
    -H 'Content-Type: application/json' \
    -d '{"password":"<ADMIN_PASSWORD>"}' \
    | grep -i 'set-cookie' | head -1 | sed 's/[Ss]et-[Cc]ookie: //;s/;.*//')

curl -s -H "Cookie: $COOKIE" https://metamorfosisvital.com.co/ | grep -c 'href="/admin'
# Esperado: >= 1
```

## Riesgos / consideraciones

- **No es seguridad real, es ofuscación.** La URL admin sigue siendo `/admin/login` — el rate limit + password fuerte (SPEC-010) son la verdadera defensa.
- **Si Carlos olvida la URL**, puede recuperarla del repo o de su sesión personal. No es problema con un solo admin.

## Commit

```
feat(spec-007): ocultar UI admin a visitantes anónimos

Navbar y Footer ya no exponen el link /admin a visitantes sin sesión
admin. Solo aparece destacado cuando hay cookie admin válida (SPEC-003).
La URL /admin/login sigue funcionando para acceso directo.

Cierra specs/SPEC-007-hide-admin-ui.md
```

---

## Resultado

Cerrada de facto durante la implementación de SPEC-003 / SPEC-026 (2026-05-09 / 10). Verificación realizada el 2026-05-10:

**Estado en producción:**
- `Navbar.astro` líneas 48 y 165: el link `/admin/dashboard` vive dentro de `{isAdmin && (...)}` tanto en el desktop menu como en el mobile menu panel. Si la cookie admin no existe, el link no se renderiza.
- `Footer.astro` línea 146: el bloque "Admin Entry" del bottom-bar también vive dentro de `{isAdmin && (...)}`.
- `isAdmin` se calcula server-side leyendo la cookie HttpOnly `admin_session` con `isValidSessionValue`.

**Smoke test verificado:**
```sh
$ curl -s https://metamorfosisvital.com.co/ | grep -c 'href="/admin'
# 0 (anónimo no ve link)
```

Sin cambios de código necesarios — la implementación de SPEC-003 ya cubrió este caso. Solo se cierra formalmente.
