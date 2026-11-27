# SPEC-121 — Test IMR con medidas (coherencia con la app Elena)

Estado: IMPLEMENTED (27-nov-2026)

## Problema
- El test IMR pedía elegir el % de grasa a ojo (10/18/25/35 %) y pasaba un cuello fijo (38/32 cm). La app luego calculaba otra cifra con la fórmula US Navy.
- `bodyFatNavy` estimaba la cadera de las mujeres como cintura × 1,05: 170 cm / cintura 60 daba 2 %.

## Cambios
- El test pide cuello y, en mujeres, cadera; el % de grasa sale de `bodyFatNavy`. Se guardan `bio.neckCm` y `bio.hipCm`.
- `bodyFatNavy` lanza error en mujeres sin cadera (no se inventa). La app aplica la misma regla.
- Casos compartidos con la app: `src/lib/imr/fixtures/metabolic_cases.json` + `sharedFixtures.test.ts`.
