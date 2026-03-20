// === INTERFACES & TYPES ===
export interface IMXVariables {
    peso: number;
    altura: number;
    grasa: number;
}

export interface IMXResult {
    score: number;
    ffmi?: number;
    bodyFat?: number;
    interpretation: string;
    status: 'crisis' | 'warning' | 'optimal' | 'transition';
    recommendations?: string[];
}

/**
 * Función de Autoridad Técnica: calculateIMX
 * Conecta con la Cloud Function central para el cálculo de FFMI e IMX.
 * Boris Style.
 */
export async function calculateIMX(variables: IMXVariables): Promise<any> {
    const URL = import.meta.env.PUBLIC_CLOUD_FUNCTION_URL;
    
    try {
        const response = await fetch(URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(variables)
        });

        if (!response.ok) {
            console.error('Cloud Function Authority Error:', response.statusText);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Error connecting to Calculation Authority:', error);
        return null;
    }
}

// Helper para limpiar inputs
export const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
