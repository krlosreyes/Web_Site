export interface ValidationResult {
    isValid: boolean;
    message: string | null;
}

export const validatePostSchema = (jsonInput: string): ValidationResult => {
    let parsed: any;

    // 1. Validación estricta de Sintaxis JSON
    try {
        parsed = JSON.parse(jsonInput);
    } catch (error: any) {
        return {
            isValid: false,
            message: `[SyntaxError JSON] Error técnico en la estructura:\n${error.message}`
        };
    }

    // Asegurarse de que el parseo retornó un objeto y no nulo/string/etc.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
            isValid: false,
            message: '[Esquema Inválido] El payload raíz debe ser un Objeto JSON ({}).'
        };
    }

    // 2. Nodos Mínimos Requeridos
    const requiredNodes = [
        'metadata',
        'content',
        'app_integration',
        'quiz',
        'references'
    ];

    const missingNodes = requiredNodes.filter(node => !(node in parsed));
    if (missingNodes.length > 0) {
        return {
            isValid: false,
            message: `[Esquema Incompleto] Faltan los siguientes nodos obligatorios: ${missingNodes.join(', ')}`
        };
    }

    // 3. Reglas Específicas del Esquema

    // A. Quiz debe tener al menos 4 preguntas
    if (!Array.isArray(parsed.quiz)) {
        return {
            isValid: false,
            message: '[Tipo Inválido] El nodo "quiz" debe ser un Arreglo ([]).'
        };
    }

    if (parsed.quiz.length < 4) {
        return {
            isValid: false,
            message: `[Esquema Débil] El "quiz" debe contener un mínimo de 4 preguntas. Detectadas: ${parsed.quiz.length}.`
        };
    }

    // B. References debe ser un arreglo y no estar vacío (Salvavidas anti-regresión)
    if (!Array.isArray(parsed.references)) {
        return {
            isValid: false,
            message: '[Tipo Inválido] El nodo "references" debe ser un Arreglo ([]).'
        };
    }

    if (parsed.references.length === 0) {
        return {
            isValid: false,
            message: '[Regla Anti-Regresión] El nodo "references" NO documenta fuentes científicas externas. Se requiere al menos un (1) elemento de referencia.'
        };
    }

    // C. Data Tables opcionales: Validation for comparisons and steps arrays
    if ('comparisons' in parsed) {
        if (!Array.isArray(parsed.comparisons)) {
            return {
                isValid: false,
                message: '[Esquema Editorial] El nodo opcional "comparisons" existe pero NO es un Arreglo ([]).'
            };
        }
    }

    if ('steps' in parsed) {
        if (!Array.isArray(parsed.steps)) {
            return {
                isValid: false,
                message: '[Esquema Editorial] El nodo opcional "steps" existe pero NO es un Arreglo ([]).'
            };
        }
    }

    // 4. Si pasa todas las validaciones
    return {
        isValid: true,
        message: 'Esquema 5-Niveles Correcto ✅'
    };
};
