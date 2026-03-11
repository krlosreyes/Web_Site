export interface SanitizedResult {
    sanitizedJson: string;
    wasModified: boolean;
    modifications: string[];
}

export const sanitizeJsonString = (rawInput: string): SanitizedResult => {
    let sanitized = rawInput.trim();
    let wasModified = false;
    const modifications: string[] = [];

    // 1. Limpiar bloques de Markdown (```json ... ``` o ``` ... ```)
    const markdownRegex = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;
    if (markdownRegex.test(sanitized)) {
        sanitized = sanitized.replace(markdownRegex, '$1').trim();
        wasModified = true;
        modifications.push('Eliminados bloques de Markdown (```)');
    }

    // 2. Limpiar comas finales (Trailing commas) en objetos y arrays
    const trailingCommaRegex = /,\s*([\]}])/g;
    if (trailingCommaRegex.test(sanitized)) {
        sanitized = sanitized.replace(trailingCommaRegex, '$1');
        wasModified = true;
        modifications.push('Eliminadas comas finales (trailing commas)');
    }

    return {
        sanitizedJson: sanitized,
        wasModified,
        modifications
    };
};
