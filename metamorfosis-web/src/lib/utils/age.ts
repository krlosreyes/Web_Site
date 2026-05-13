/**
 * Cálculo de edad cronológica desde fecha de nacimiento (SPEC-089).
 *
 * Función pura, sin dependencias. Diseñada para ser replicada
 * bit-a-bit en ElenaApp (Dart) y en el sitio (TS) para que un mismo
 * `birthDate` produzca exactamente la misma edad en ambos clientes.
 *
 * Reglas:
 *   - Si el usuario ya cumplió años este año (mes/día actuales >=
 *     mes/día de nacimiento), edad = añoActual - añoNacimiento.
 *   - Si aún NO cumplió este año, edad = añoActual - añoNacimiento - 1.
 *   - Si la fecha es inválida o futura, retorna 0.
 *   - Clamp a [0, 150] como defensa contra inputs malos.
 *
 * El input es una fecha "civil" (sin timezone). Lo parseamos
 * manualmente con `split('-')` para evitar la coerción de
 * `new Date('1985-03-15')` a UTC midnight, que puede dar problemas
 * de off-by-one en algunas zonas horarias.
 */

/** Formato ISO 8601 date sin tiempo: 'YYYY-MM-DD'. */
export type IsoDate = string;

export function calculateAge(birthDate: IsoDate | null | undefined): number {
    if (!birthDate || typeof birthDate !== 'string') return 0;

    const parts = birthDate.split('-');
    if (parts.length !== 3) return 0;

    const birthYear = parseInt(parts[0], 10);
    const birthMonth = parseInt(parts[1], 10); // 1-12
    const birthDay = parseInt(parts[2], 10);
    if (
        isNaN(birthYear) ||
        isNaN(birthMonth) ||
        isNaN(birthDay) ||
        birthMonth < 1 ||
        birthMonth > 12 ||
        birthDay < 1 ||
        birthDay > 31
    ) {
        return 0;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();

    let age = currentYear - birthYear;
    // Si aún no cumplió años este año, restar 1.
    if (
        currentMonth < birthMonth ||
        (currentMonth === birthMonth && currentDay < birthDay)
    ) {
        age -= 1;
    }

    // Defensa: no retornar edades imposibles.
    if (age < 0) return 0;
    if (age > 150) return 150;
    return age;
}

/**
 * Date máxima permitida para birthDate input que cumpla la regla de
 * mayoría de edad (18+) según SPEC-080.
 *
 * Retorna un string 'YYYY-MM-DD' que es exactamente "hoy hace 18
 * años". Útil para el atributo `max` del `<input type="date">`.
 */
export function maxBirthDateFor18Plus(): IsoDate {
    const today = new Date();
    const year = today.getFullYear() - 18;
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
