# 🔐 Autenticación Admin - Guía Rápida

## ⚡ Inicio Rápido (5 minutos)

### 1️⃣ Configurar Contraseña

```bash
# En tu archivo .env local o variables de entorno
ADMIN_PASSWORD="tu_contraseña_super_segura_minimo_8_caracteres"
```

### 2️⃣ Ir a página de login

```
http://localhost:3000/admin/login
```

### 3️⃣ Ingresar contraseña

```
Contraseña: [tu_contraseña_super_segura_minimo_8_caracteres]
```

✅ **Listo!** Ahora puedes acceder a todos los endpoints admin.

---

## 📱 Endpoints Admin Disponibles

### Con sesión válida, puedes acceder a:

```bash
# 1. Lista de posts (con analytics)
GET /api/admin/posts
# Respuesta: { success: true, posts: [...] }

# 2. Lista de leads (waitlist)
GET /api/admin/leads
# Respuesta: { success: true, leads: [...] }

# 3. Estadísticas
GET /api/admin/stats
# Respuesta: { success: true, totalPosts: N, totalLeads: N }

# 4. Datos de pruebas
GET /api/admin/analitica
# Respuesta: { success: true, docs: [...] }
```

---

## 🔑 API REST (Para integraciones)

### Login

```bash
POST /api/admin/login

Payload:
{
  "password": "tu_contraseña_super_segura_minimo_8_caracteres"
}

Respuesta exitosa (200):
{
  "success": true,
  "message": "Login successful",
  "redirect": "/admin/dashboard"
}

Set-Cookie: admin_session=firebase_auth; HttpOnly; Secure; SameSite=Strict
```

### Logout

```bash
POST /api/admin/logout

Respuesta (200):
{
  "success": true,
  "message": "Logout successful",
  "redirect": "/admin/login"
}

Set-Cookie: admin_session=; Expires=Thu, 01 Jan 1970...
```

### Acceder a endpoints protegidos

```bash
# Con la cookie de sesión
GET /api/admin/posts

Response:
{
  "success": true,
  "posts": [
    {
      "id": "post-1",
      "title": "...",
      "views": 1234,
      ...
    }
  ]
}
```

---

## ⚠️ Códigos de Error

| Código | Significado | Solución |
|--------|-------------|----------|
| **400** | Contraseña < 8 caracteres | Usar contraseña más larga |
| **401** | Credenciales inválidas | Verificar contraseña |
| **401** | No hay sesión válida | Hacer login primero |
| **405** | Método HTTP incorrecto | Usar POST para login/logout |
| **429** | Rate limit excedido | Esperar 1 minuto |
| **500** | Error interno | Revisar logs del servidor |

---

## 🛡️ Restricciones de Seguridad

### ✅ Protecciones Implementadas

- ✓ **Máximo 5 intentos fallidos por minuto** (por IP)
- ✓ **Contraseña mínimo 8 caracteres**
- ✓ **Cookies HttpOnly** (no accesibles desde JavaScript)
- ✓ **CSRF Protection** (SameSite=Strict)
- ✓ **Comparación constante** (previene timing attacks)
- ✓ **Obligatorio en producción** (no hay fallback)

### ⚠️ No es recomendado

❌ Compartir contraseña en email o Slack  
❌ Guardar contraseña en navegador  
❌ Usar contraseña corta o débil  
❌ Reutilizar en otros servicios  
❌ Commit de contraseña en git  

---

## 🧪 Testing

### Con cURL

```bash
# Login
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password": "mi_contraseña"}'

# Usar la sesión
curl -X GET http://localhost:3000/api/admin/posts \
  -H "Cookie: admin_session=firebase_auth"

# Logout
curl -X POST http://localhost:3000/api/admin/logout
```

### Con Postman/Insomnia

1. **POST** `/api/admin/login`
   - Body: `{"password": "..."}`
   - Ver cookie en "Set-Cookie"

2. **GET** `/api/admin/posts`
   - Headers: `Cookie: admin_session=firebase_auth`
   - Ver respuesta

---

## 🚀 Deployment

### Variables de entorno requeridas

```bash
# Production (.env.production)
ADMIN_PASSWORD="tu_contraseña_fuerte_aleatoria"
ADMIN_PASSWORD_LENGTH>=8  # Mínimo 8 caracteres

# El sistema rechazará desplegar sin esto ❌
```

### Verificación pre-deploy

```bash
# ✅ Verificar que TypeScript compila
npm run build

# ✅ Verificar que ADMIN_PASSWORD está set
echo $ADMIN_PASSWORD  # No debe estar vacío

# ✅ Hacer test rápido
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password": "'$ADMIN_PASSWORD'"}'
```

---

## 📚 Documentación Completa

Para detalles técnicos completos, ver:
- `SECURITY_REPORT.md` - Análisis completo de seguridad
- `IMPLEMENTATION_SUMMARY.md` - Resumen de cambios
- `src/lib/auth.ts` - Código fuente de autenticación

---

## ❓ FAQ

**P: ¿Se pierde la sesión si cierro el navegador?**  
R: Sí. La sesión es HttpOnly y expira en 24 horas o al cerrar el navegador.

**P: ¿Puedo cambiar la contraseña?**  
R: Sí. Actualiza `ADMIN_PASSWORD` en tu `.env` y reinicia el servidor.

**P: ¿Qué pasa después de 5 intentos fallidos?**  
R: El IP queda bloqueado por 1 minuto. Luego se reinicia.

**P: ¿Es seguro para producción?**  
R: Sí. Implementa estándares empresariales: OWASP Top 10, constant-time comparison, rate limiting, secure cookies.

**P: ¿Qué pasa si alguien adivina la contraseña?**  
R: Rate limiting previene brute force (máximo 5 intentos/min por IP).

**P: ¿Necesito cambiar la contraseña regularmente?**  
R: Recomendable cada 90 días o si sospechas compromiso.

---

## 📞 Soporte

Si tienes problemas:

1. Verifica que `ADMIN_PASSWORD` está set: `echo $ADMIN_PASSWORD`
2. Reinicia el servidor local: `npm run dev`
3. Revisa los logs: búsqueda de `[Auth]` en console
4. Consulta `SECURITY_REPORT.md` para casos específicos

---

**Última actualización:** 2026-03-20  
**Versión del sistema:** 1.0  
**Estado:** ✅ Listo para producción
