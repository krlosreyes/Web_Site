# Paleta canónica Metamorfosis Real — para implementar en ElenaApp (Flutter)

**Fuente única de verdad:** `metamorfosis-web/src/styles/global.css` →
bloque `@theme`. Este documento congela los valores actuales para
que el agente del repo Flutter los replique al pie de la letra.

**Tema:** dark-only. NO hay variante light. La app debe arrancar
en dark y mantenerse en dark sin opción de toggle (esa es decisión
de diseño del sitio).

---

## 1. Tabla completa de tokens

### Backgrounds (3 niveles de elevación)

| Token web | Hex | Color(0xAARRGGBB) | Uso en UI | Equivalente Material 3 |
|---|---|---|---|---|
| `bg-base` | `#020617` | `Color(0xFF020617)` | Fondo principal de la app (scaffold). Midnight navy. | `colorScheme.background` |
| `bg-surface` | `#0c1422` | `Color(0xFF0C1422)` | Cards, tablas, contenedores con borde sutil. | `colorScheme.surface` |
| `bg-elevated` | `#1a2332` | `Color(0xFF1A2332)` | Modales, sheets, inputs, hover states, segmentos activos. | `colorScheme.surfaceVariant` |

### Text (3 niveles de jerarquía)

| Token web | Hex | Color(0xAARRGGBB) | Uso en UI | Equivalente Material 3 |
|---|---|---|---|---|
| `text-primary` | `#f1f5f9` | `Color(0xFFF1F5F9)` | Headlines, body principal, datos importantes. | `colorScheme.onBackground`, `onSurface` |
| `text-secondary` | `#94a3b8` | `Color(0xFF94A3B8)` | Descripciones, párrafos secundarios, copy de apoyo. | `bodyMedium.color`, `bodySmall.color` |
| `text-muted` | `#64748b` | `Color(0xFF64748B)` | Labels uppercase tracking-wide, captions, metadata, placeholders. | `labelSmall.color`, hint text |

### Accent (UNO SOLO — teal de salud / metabolismo)

| Token web | Hex | Color(0xAARRGGBB) | Uso en UI | Equivalente Material 3 |
|---|---|---|---|---|
| `accent` | `#00C49A` | `Color(0xFF00C49A)` | CTAs primarios, links activos, foco, badges importantes, IMR puntaje cuando es óptimo. | `colorScheme.primary` |
| `accent-strong` | `#00b389` | `Color(0xFF00B389)` | Estado `hover` / `pressed` del CTA primario. NO usar como base color de nada. | `colorScheme.primaryContainer` |

**Texto sobre accent:** usar `bg-base` (`#020617`) para máximo contraste. Equivalente Material: `colorScheme.onPrimary = Color(0xFF020617)`.

### Status (zona biológica del IMR y feedback de UI)

| Token web | Hex | Color(0xAARRGGBB) | Uso en UI |
|---|---|---|---|
| `status-good` | `#10b981` | `Color(0xFF10B981)` | Success, IMR zona "OPTIMIZADO" o "EFICIENTE", confirmaciones positivas. |
| `status-warn` | `#f59e0b` | `Color(0xFFF59E0B)` | Warning, IMR zona "FUNCIONAL" o "INESTABLE", avisos. |
| `status-bad` | `#ef4444` | `Color(0xFFEF4444)` | Error, IMR zona "DETERIORADO", borrar/eliminar, validaciones que fallan. Equivalente: `colorScheme.error`. |

### Bordes y divisores (no son tokens explícitos, son fórmulas)

El sitio NO tiene un token de borde. Se usan opacidades de blanco con la sintaxis Tailwind `border-white/[0.06]`, `border-white/[0.08]`, etc. Conversión:

| Sintaxis web | Color Flutter equivalente | Uso |
|---|---|---|
| `border-white/[0.04]` | `Colors.white.withOpacity(0.04)` | Divisor entre filas de tabla. |
| `border-white/[0.06]` | `Colors.white.withOpacity(0.06)` | Borde por defecto de cards. |
| `border-white/[0.08]` | `Colors.white.withOpacity(0.08)` | Borde de inputs, tabs inactivos. |
| `border-white/[0.12]` | `Colors.white.withOpacity(0.12)` | Borde resaltado (hover de card). |
| `border-accent/30` | `Color(0xFF00C49A).withOpacity(0.3)` | Borde de cards destacadas o activas. |

---

## 2. Tipografía

| Familia | Pesos usados | Uso |
|---|---|---|
| **Space Grotesk** | Bold (700), Black (900), Italic | Headlines (H1, H2). Estilo "italic uppercase tracking-tight" en hero principal del sitio. |
| **Inter** | Regular (400), Medium (500), SemiBold (600), Bold (700) | Body, UI, labels, todo lo que no sea hero. |
| **Playfair Display** | Regular (400), Bold (700), Italic (italic 400 y 700) | Texto largo de artículos en la página de blog. NO usar en UI de la app (la app no muestra artículos completos). |

**Para Flutter:** descargar las fonts de [Google Fonts](https://fonts.google.com) y registrarlas en `pubspec.yaml`. O usar el package [`google_fonts`](https://pub.dev/packages/google_fonts).

Recomendación: instalar `google_fonts: ^6.1.0` y usar:

```dart
import 'package:google_fonts/google_fonts.dart';

final headingStyle = GoogleFonts.spaceGrotesk(
  fontWeight: FontWeight.w700,
  color: AppColors.textPrimary,
);
final bodyStyle = GoogleFonts.inter(
  color: AppColors.textPrimary,
);
```

**Notación tipográfica del sitio (para que la app la respete):**
- Eyebrow / metadata: `text-[11px] font-bold uppercase tracking-[0.18em]` color `text-muted`. Equivalente Flutter: `fontSize: 11, letterSpacing: 1.98, fontWeight: w700, color: textMuted`.
- H1 expresivo (solo en hero principal): Space Grotesk Black italic uppercase, `text-4xl/5xl/6xl` según viewport.
- H2/H3: Space Grotesk Bold, `text-2xl/3xl`.
- Body: Inter Regular, `text-base` (16px) con `leading-relaxed` (line-height 1.625).

---

## 3. Implementación en Flutter

### Clase `AppColors` (archivo nuevo `lib/src/core/theme/app_colors.dart`)

```dart
import 'package:flutter/material.dart';

/// Paleta canónica Metamorfosis Real (sincronizada con el sitio web).
/// Fuente: metamorfosis-web/src/styles/global.css → bloque @theme.
/// Documento de referencia: docs/PALETTE-FOR-ELENAAPP.md.
///
/// NO modificar valores sin coordinar con el sitio. Si el sitio
/// agrega/cambia un token, actualizar acá en la misma SPEC.
class AppColors {
  AppColors._();

  // ---------- Backgrounds ----------
  static const Color bgBase = Color(0xFF020617);
  static const Color bgSurface = Color(0xFF0C1422);
  static const Color bgElevated = Color(0xFF1A2332);

  // ---------- Text ----------
  static const Color textPrimary = Color(0xFFF1F5F9);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);

  // ---------- Accent (uno solo) ----------
  static const Color accent = Color(0xFF00C49A);
  static const Color accentStrong = Color(0xFF00B389);

  // ---------- Status ----------
  static const Color statusGood = Color(0xFF10B981);
  static const Color statusWarn = Color(0xFFF59E0B);
  static const Color statusBad = Color(0xFFEF4444);

  // ---------- Helpers de borde (opacidades de blanco) ----------
  static Color get borderSubtle => Colors.white.withOpacity(0.06);
  static Color get borderDefault => Colors.white.withOpacity(0.08);
  static Color get borderStrong => Colors.white.withOpacity(0.12);
}
```

### `ThemeData` global (archivo nuevo `lib/src/core/theme/app_theme.dart`)

```dart
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  static ThemeData get dark {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: AppColors.bgBase,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.accent,
        onPrimary: AppColors.bgBase,
        secondary: AppColors.accent,
        onSecondary: AppColors.bgBase,
        surface: AppColors.bgSurface,
        onSurface: AppColors.textPrimary,
        background: AppColors.bgBase,
        onBackground: AppColors.textPrimary,
        surfaceVariant: AppColors.bgElevated,
        onSurfaceVariant: AppColors.textSecondary,
        error: AppColors.statusBad,
        onError: AppColors.bgBase,
        outline: Color(0x14FFFFFF), // ~ white/0.08
      ),
      textTheme: GoogleFonts.interTextTheme(base.textTheme).apply(
        bodyColor: AppColors.textPrimary,
        displayColor: AppColors.textPrimary,
      ),
      primaryTextTheme: GoogleFonts.spaceGroteskTextTheme(
        base.primaryTextTheme,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: AppColors.bgBase,
          textStyle: GoogleFonts.inter(fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        ),
      ),
      cardTheme: CardTheme(
        color: AppColors.bgSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: AppColors.borderSubtle),
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      dividerColor: AppColors.borderSubtle,
      // Resto de overrides según los componentes que ya tiene la app.
    );
  }
}
```

### Wiring en `main.dart`

```dart
runApp(MaterialApp(
  theme: AppTheme.dark,
  darkTheme: AppTheme.dark, // mismo en ambos para evitar flash light
  themeMode: ThemeMode.dark,
  // ...
));
```

---

## 4. Reglas inquebrantables (anti-deriva)

1. **NO usar `Color(0x...)` hex literal en código de componente.** Siempre referenciar `AppColors.<token>`. Si necesitás un color nuevo, agregalo a `AppColors` con consensus con el sitio primero.
2. **El accent es UNO SOLO.** No hay accent-secondary, accent-cyan, accent-blue. Si una pantalla "necesita" otro accent es señal de que el diseño está mal — discutir antes de agregar.
3. **NO crear variante light.** El sitio es dark-only. La app debe serlo también para coherencia.
4. **Status colors solo para estado.** No usar `statusGood` como "color verde decorativo". Si un elemento es decorativo, usar `accent` o variantes de white-opacity.
5. **Bordes con `Colors.white.withOpacity(...)`,** no con `Colors.grey[...]`. La paleta de grises del sitio se construye con opacidades de blanco sobre el bg navy, no con grises absolutos.
6. **Fuentes:** Space Grotesk para headlines, Inter para todo lo demás. Playfair Display NO se usa en la app (es solo para texto largo de artículos en el sitio).

---

## 5. Mapeo: rol del componente → token a usar

Si el agente de Flutter no sabe qué token usar para un componente, esta tabla es la respuesta:

| Componente | Background | Borde | Texto principal | Texto secundario | Accent |
|---|---|---|---|---|---|
| Scaffold (raíz de la app) | `bgBase` | — | `textPrimary` | `textSecondary` | `accent` |
| Card / Tile estándar | `bgSurface` | `borderSubtle` | `textPrimary` | `textSecondary` | — |
| Modal / BottomSheet | `bgElevated` | `borderDefault` | `textPrimary` | `textSecondary` | — |
| Input / TextField | `bgBase/60%` | `borderDefault` | `textPrimary` | `textMuted` (placeholder) | `accent` (focus border) |
| Botón primario | `accent` | — | `bgBase` (sobre accent) | — | — |
| Botón secundario / outline | `bgSurface` | `borderDefault` | `textPrimary` | — | `accent` (hover border) |
| Tab / Chip activo | `bgElevated` | `accent` | `accent` | — | — |
| Tab / Chip inactivo | transparent o `bgBase` | `borderDefault` | `textSecondary` | — | — |
| Label / Eyebrow / Caption | — | — | `textMuted` (uppercase tracking-wide) | — | — |
| Badge "óptimo" (IMR good) | `statusGood/[0.1]` | `statusGood/30%` | `statusGood` | — | — |
| Badge "warning" (IMR funcional) | `statusWarn/[0.1]` | `statusWarn/30%` | `statusWarn` | — | — |
| Badge "deteriorado" (IMR bad) | `statusBad/[0.1]` | `statusBad/30%` | `statusBad` | — | — |

---

## 6. Validación de paridad (sugerido en SPEC del repo Flutter)

Cuando el agente implemente esto, debe agregar 1 test que valide la paleta no se desvía accidentalmente:

```dart
// test/core/theme/app_colors_parity_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:elena_app/src/core/theme/app_colors.dart';

void main() {
  group('AppColors parity con sitio web Metamorfosis Real', () {
    test('backgrounds matchean los hex canónicos', () {
      expect(AppColors.bgBase.value, 0xFF020617);
      expect(AppColors.bgSurface.value, 0xFF0C1422);
      expect(AppColors.bgElevated.value, 0xFF1A2332);
    });

    test('text matchea los hex canónicos', () {
      expect(AppColors.textPrimary.value, 0xFFF1F5F9);
      expect(AppColors.textSecondary.value, 0xFF94A3B8);
      expect(AppColors.textMuted.value, 0xFF64748B);
    });

    test('accent matchea los hex canónicos', () {
      expect(AppColors.accent.value, 0xFF00C49A);
      expect(AppColors.accentStrong.value, 0xFF00B389);
    });

    test('status colors matchean los hex canónicos', () {
      expect(AppColors.statusGood.value, 0xFF10B981);
      expect(AppColors.statusWarn.value, 0xFFF59E0B);
      expect(AppColors.statusBad.value, 0xFFEF4444);
    });
  });
}
```

Si en el futuro Carlos cambia un color en el sitio, este test fallará en la app y el agente sabe que debe sincronizar.
