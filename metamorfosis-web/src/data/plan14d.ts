/**
 * Contenido editorial del Plan IMR de 14 días (SPEC-100).
 *
 * Estructura: 14 días, cada uno con título y descripción comunes,
 * más 3 acciones específicas (una por pilar E/M/C). Carlos puede
 * iterar este copy en commits sin tocar lógica.
 *
 * Convenciones:
 *   - Tono neutro hispanoamericano (post-SPEC-054, post-SPEC-095).
 *     Sin voseo. Sin imperativos rioplatenses tildados.
 *   - Lenguaje empoderador, no militar. Eliminado "Hard Reset",
 *     "Corte de Suministro", "Activación de BHB" del DAILY_PROTOCOL
 *     original (`metabolicProtocol.ts`).
 *   - Acciones específicas, accionables, medibles. Idealmente
 *     ejecutables en <30 min/día.
 *   - Referencias revisadas por pares cuando aplique. Subset de las
 *     ya curadas en `src/lib/imr/weakPillar.ts`.
 *
 * Las acciones genéricas E/M/C (las 3 acciones semanales de SPEC-099)
 * son el "ancla" del plan: el día 1 de cada pilar arranca con esa
 * misma acción para que el usuario reconozca continuidad entre el
 * preview del quiz y el plan completo.
 */

export interface DayAction {
    /** Título corto y accionable (5-12 palabras). */
    title: string;
    /** 1-2 oraciones de contexto o ejecución. Opcional. */
    detail?: string;
    /** Referencias revisadas por pares opcionales. */
    references?: string[];
}

/**
 * SPEC-105: imagen conceptual del día. Opcional para back-compat —
 * si el archivo físico aún no fue subido a /public, el componente
 * Plan14d.tsx hace fallback graceful y no rompe el render.
 */
export interface DayImage {
    /** Ruta absoluta desde /public. Ej: '/plan14d/dia-01.webp' */
    src: string;
    /** Alt text descriptivo en español para accesibilidad + SEO. */
    alt: string;
}

export interface DayPlan {
    day: number;
    phase: 'Reset' | 'Consolidación';
    /** Título común para todos los pilares. */
    title: string;
    /** Descripción común (2-3 oraciones) que explica el porqué del día. */
    description: string;
    /** SPEC-105: imagen del día (opcional hasta que esté generada). */
    image?: DayImage;
    /** Acción específica según pilar débil identificado por SPEC-099. */
    actions: {
        E: DayAction;
        M: DayAction;
        C: DayAction;
    };
}

// ─────────────────────────────────────────────────────────────
// REFERENCIAS CIENTÍFICAS REUTILIZABLES
// ─────────────────────────────────────────────────────────────

const REF_SCHOENFELD = 'Schoenfeld et al. (2017). J Sports Sci 35(11):1073-1082.';
const REF_ACSM = 'Garber et al. ACSM Position Stand (2011). Med Sci Sports Exerc 43(7):1334-1359.';
const REF_SUTTON = 'Sutton et al. (2018). Cell Metab 27(6):1212-1221.';
const REF_WILKINSON = 'Wilkinson et al. (2020). Cell Metab 31(1):92-104.';
const REF_JAKUBOWICZ = 'Jakubowicz et al. (2013). Obesity 21(12):2504-2512.';
const REF_CHANG = 'Chang et al. (2015). PNAS 112(4):1232-1237.';
const REF_HALE_GUAN = 'Hale & Guan (2015). Sleep Med Rev 21:50-58.';
const REF_BOSCHMANN = 'Boschmann et al. (2003). J Clin Endocrinol Metab 88(12):6015-6019.';

// ─────────────────────────────────────────────────────────────
// PLAN COMPLETO — 14 días
// ─────────────────────────────────────────────────────────────

export const PLAN_14_DAYS: DayPlan[] = [
    // ─── SEMANA 1: RESET ───────────────────────────────────────
    {
        day: 1,
        phase: 'Reset',
        title: 'Activa tu cambio metabólico',
        description:
            'Hoy comienza el proceso. Tu cuerpo va a empezar a usar reservas de energía que llevaba tiempo sin tocar. Es normal sentir picos de hambre — son señales hormonales, no falta de combustible.',
        image: {
            src: '/plan14d/dia-01.webp',
            alt: 'Vaso de agua con sal marina sobre una mesa de madera al amanecer',
        },
        actions: {
            E: {
                title: 'Mide y registra tu baseline corporal',
                detail:
                    'Al despertar, en ayunas: mide cintura, peso y toma una foto frontal. Anota los tres. Esto es tu punto cero — sin esto no podrás verificar progreso.',
            },
            M: {
                title: 'Ayuno cómodo de 12 horas: solo agua, café o té sin azúcar',
                detail:
                    'Si nunca ayunaste, empieza en 12 h: termina la cena a las 8 pm y desayuna a las 8 am, sin calorías líquidas en el intervalo. Si tienes diabetes, tomas medicamentos, estás embarazada o tienes antecedentes de trastornos alimentarios, habla antes con tu médico.',
                references: [REF_WILKINSON],
            },
            C: {
                title: 'Hidrátate apenas despiertes: un vaso grande de agua',
                detail:
                    'Durante la noche pierdes agua al respirar y sudar. Empezar el día con agua es una forma sencilla de crear el hábito. Si al inicio del ayuno te duele la cabeza, revisa cuánta agua estás tomando.',
                references: [REF_BOSCHMANN],
            },
        },
    },
    {
        day: 2,
        phase: 'Reset',
        title: 'Acceso a tus reservas',
        description:
            'Tras varias horas sin comer, la insulina baja y el cuerpo usa más grasa como fuente de energía. Es un proceso normal que ocurre cada noche.',
        image: {
            src: '/plan14d/dia-02.webp',
            alt: 'Cocina vacía a las 8 pm con luz cálida tenue sobre mesa despejada',
        },
        actions: {
            E: {
                title: 'Caminata de 20 minutos antes de tu primera comida',
                detail:
                    'Caminar es la forma más fácil de sumar movimiento. 20 minutos a paso suave, sin correr, es suficiente para empezar. Si te mareas en ayunas, hazla después de comer.',
            },
            M: {
                title: 'Rompe el ayuno con 30 g de proteína + 15 g de grasa',
                detail:
                    'Ejemplo: 3 huevos + medio aguacate. La proteína es el nutriente que más sacia y ayuda a conservar músculo. Evitar jugos y harinas en esa comida reduce el pico de glucosa.',
                references: [REF_SUTTON],
            },
            C: {
                title: 'Cierra pantallas a las 9 pm sin excepción',
                detail:
                    'Si tienes que terminar trabajo, hazlo antes. La luz de las pantallas en la noche puede retrasar la melatonina, la hormona que prepara el sueño.',
                references: [REF_CHANG, REF_HALE_GUAN],
            },
        },
    },
    {
        day: 3,
        phase: 'Reset',
        title: 'Limpieza interna',
        description:
            'Se habla mucho de la autofagia (el reciclaje de componentes de la célula). Ojo: casi toda la evidencia viene de estudios en animales y todavía no se sabe cuántas horas de ayuno la activan en personas. Lo que sí está claro es el beneficio de la constancia.',
        image: {
            src: '/plan14d/dia-03.webp',
            alt: 'Té verde traslúcido en taza de vidrio con vapor suave y luz matinal',
        },
        actions: {
            E: {
                title: 'Sesión ligera de fuerza: 3 sets de sentadillas + flexiones',
                detail:
                    'Máximo 15 minutos. El objetivo no es agotarte — es enviar la señal a tus músculos de que son indispensables. Tensión mecánica, no cardio.',
                references: [REF_SCHOENFELD, REF_ACSM],
            },
            M: {
                title: 'Si te sientes estable, extiende el ayuno a 13 horas',
                detail:
                    'Termina cena 8 pm, desayuna 9 am. Si tienes hambre intolerable, no fuerces — quédate en 12 h. El progreso es gradual, no heroico.',
            },
            C: {
                title: 'Anota una decisión que te haya costado hoy',
                detail:
                    'Identificar tu hora más vulnerable (10 am, 3 pm, 9 pm) te permite anticiparte mañana.',
            },
        },
    },
    {
        day: 4,
        phase: 'Reset',
        title: 'Sincroniza tu reloj interno',
        description:
            'Tu metabolismo es un reloj. Comer y dormir a horas consistentes le da a tu cuerpo señales claras de cuándo gastar energía y cuándo reparar.',
        image: {
            src: '/plan14d/dia-04.webp',
            alt: 'Reloj analógico minimalista a las 6:30 am con cama tendida al fondo y luz cruzada',
        },
        actions: {
            E: {
                title: 'Pesa porciones de tus 3 comidas hoy',
                detail:
                    'No por restricción — para aprender a calcular por vista. Una semana de medir te calibra para el resto del año.',
            },
            M: {
                title: 'Cena máximo a las 8 pm. Espera 2 h antes de dormir',
                detail:
                    'Estudios de crononutrición muestran que la glucosa se controla peor con comidas tarde en la noche. Dejar un margen antes de dormir suele ayudar a descansar mejor.',
                references: [REF_JAKUBOWICZ],
            },
            C: {
                title: 'Acuéstate a la misma hora que ayer (±15 min)',
                detail:
                    'Dormir a horas regulares importa, no solo cuántas horas duermes. Tu reloj interno funciona mejor con horarios predecibles.',
            },
        },
    },
    {
        day: 5,
        phase: 'Reset',
        title: 'Activa el músculo',
        description:
            'Sin ejercicio de fuerza, con los años se pierde músculo. La OMS recomienda trabajar fuerza al menos 2 días por semana.',
        image: {
            src: '/plan14d/dia-05.webp',
            alt: 'Kettlebell solitaria sobre piso de madera con luz lateral dramática',
        },
        actions: {
            E: {
                title: 'Sesión completa de fuerza: sentadillas, flexiones, dominadas asistidas',
                detail:
                    '3 series de cada ejercicio, dejando 1 o 2 repeticiones en reserva. Total 20-25 minutos. Si tienes alguna lesión, adapta los ejercicios.',
                references: [REF_SCHOENFELD, REF_ACSM],
            },
            M: {
                title: 'Prioriza proteína en tu primera comida: 30-40 g',
                detail:
                    'Ejemplo: 4 huevos + 100 g de pollo, o 2 huevos + 150 g de pescado. La proteína ayuda a que te sientas lleno por más tiempo.',
            },
            C: {
                title: 'Camina 5 minutos entre cada 60 de trabajo sentado',
                detail:
                    'Estudios de laboratorio muestran que cortar el tiempo sentado con pausas cortas de caminata baja la glucosa después de comer.',
            },
        },
    },
    {
        day: 6,
        phase: 'Reset',
        title: 'Calidad por encima de cantidad',
        description:
            'Cuando comes menos veces, cada comida pesa más. Hoy enfócate en alimentos densos en nutrientes: carnes, pescados, vegetales verdes, grasas saludables.',
        image: {
            src: '/plan14d/dia-06.webp',
            alt: 'Plato denso visto desde arriba con salmón a la parrilla, aguacate y vegetales verdes oscuros',
        },
        actions: {
            E: {
                title: 'Una sola comida densa: proteína (35 g) + grasa (20 g) + vegetales sin límite',
                detail:
                    'Ejemplo: 150 g de carne o pescado + medio aguacate + brócoli o espinaca. La densidad nutricional te sacia más con menos volumen.',
            },
            M: {
                title: 'Mantén el ayuno de 14 h. Sin snacks entre comidas',
                detail:
                    'Picar entre comidas eleva la insulina varias veces al día y hace más difícil notar el hambre real. Hoy, solo dos comidas. Agua, café o té sin azúcar entre tanto.',
                references: [REF_WILKINSON],
            },
            C: {
                title: 'Reduce un hábito conductual que te aleja del objetivo',
                detail:
                    'Solo uno. Puede ser alcohol esta noche, scroll en redes después de cenar, café después de las 3 pm. Pequeño y específico.',
            },
        },
    },
    {
        day: 7,
        phase: 'Reset',
        title: 'Primer corte: dónde estás',
        description:
            'Has completado la primera semana. Mide y compara con el día 1. El siguiente paso no es más intensidad — es más consistencia con lo mismo.',
        image: {
            src: '/plan14d/dia-07.webp',
            alt: 'Cinta métrica enrollada y cuaderno abierto sobre superficie de mármol con luz lateral',
        },
        actions: {
            E: {
                title: 'Re-mide cintura, peso y toma una foto frontal',
                detail:
                    'En una semana el cambio puede ser pequeño o nulo, y eso es normal: el peso varía de un día a otro por agua y digestión. Mira la tendencia, no un solo número.',
            },
            M: {
                title: 'Identifica el ayuno que sentiste cómodo (12, 13 o 14 h)',
                detail:
                    'Esa es tu base sostenible. Forzar más en semana 2 te costará retención. Quédate ahí mientras no te pida más el cuerpo.',
            },
            C: {
                title: 'Lista un hábito que ya se siente automático',
                detail:
                    'Ese es tu primer logro real: un hábito que ya no te cuesta voluntad. Son los que más fácil se mantienen.',
            },
        },
    },

    // ─── SEMANA 2: CONSOLIDACIÓN ───────────────────────────────
    {
        day: 8,
        phase: 'Consolidación',
        title: 'Convierte lo aprendido en rutina',
        description:
            'Una semana de hábito no es hábito. Hoy empieza la parte que no se ve: hacer rutina lo que la semana pasada fue esfuerzo consciente.',
        image: {
            src: '/plan14d/dia-08.webp',
            alt: 'Sendero de piedras equidistantes cruzando agua serena a la hora dorada',
        },
        actions: {
            E: {
                title: 'Repite la sesión de fuerza del día 5 sin cronometrar',
                detail:
                    'El objetivo es que se sienta normal, no épico. Si te tomó 18 min en lugar de 25, perfecto. Si te tomó 35, también — todavía cuenta.',
            },
            M: {
                title: 'Ajusta el ayuno al horario que mejor sentiste (12, 13 o 14 h)',
                detail:
                    'Sin heroísmo. El ayuno sostenible vence al ayuno extremo. Mantenlo igual los próximos 7 días.',
            },
            C: {
                title: 'Identifica un disparador que te saca del plan',
                detail:
                    'Puede ser una persona, lugar, hora o emoción. Anótalo. Mañana diseñas la respuesta. Hoy solo identifica.',
            },
        },
    },
    {
        day: 9,
        phase: 'Consolidación',
        title: 'Pulir lo que ya hace bien',
        description:
            'Cuando un pilar está sólido, es tentador subir intensidad. Hoy hazlo al revés: mantén exactamente lo mismo pero con más atención al detalle.',
        image: {
            src: '/plan14d/dia-09.webp',
            alt: 'Formón de carpintero sobre pieza de madera parcialmente pulida con luz lateral',
        },
        actions: {
            E: {
                title: 'Aumenta peso o repeticiones en UN solo ejercicio, no en todos',
                detail:
                    'La progresión sostenible es lateral, no vertical. Pequeño aumento en una variable preserva la recuperación del resto.',
            },
            M: {
                title: 'Mide tu energía 30 min después de cada comida (escala 1-10)',
                detail:
                    'Patrón a buscar: ¿qué comida te baja la energía? Esa es la que ajustas primero, no la cantidad total del día.',
            },
            C: {
                title: 'Reduce un estímulo digital: notificaciones o scroll antes del mediodía',
                detail:
                    'Apaga notificaciones del trabajo hasta las 10 am, o no abras redes hasta el almuerzo. Una sola regla, durable, mide a las 6 horas cómo te sientes.',
                references: [REF_HALE_GUAN],
            },
        },
    },
    {
        day: 10,
        phase: 'Consolidación',
        title: 'Sin altibajos en la energía',
        description:
            'Cuando tus pilares se alinean, dejan de aparecer los picos y caídas de energía. Si aún los tienes hoy, algo se quedó pendiente — identifica qué.',
        image: {
            src: '/plan14d/dia-10.webp',
            alt: 'Vaso de agua estable sobre mesa con horizonte al fondo, paleta hora azul',
        },
        actions: {
            E: {
                title: 'Sesión ligera de fuerza con foco en técnica',
                detail:
                    '15 minutos. Sin contar reps, sin perseguir peso. Solo movimiento correcto. El cuerpo se ajusta cuando no lo presionas todos los días.',
            },
            M: {
                title: 'Si tu energía baja a las 3 pm, prueba comer 30 min antes mañana',
                detail:
                    'Es más probable que sea ritmo circadiano que cantidad. Ajustar horario suele ser más efectivo que aumentar comida.',
                references: [REF_JAKUBOWICZ],
            },
            C: {
                title: 'Café solo antes del mediodía. Después: té, agua o nada',
                detail:
                    'La cafeína tarda en promedio unas 5 horas en reducirse a la mitad (varía mucho entre personas). Un café a las 3 pm puede seguir activo en la noche y afectar tu sueño aunque no lo sientas.',
            },
        },
    },
    {
        day: 11,
        phase: 'Consolidación',
        title: 'El estrés deshace el progreso',
        description:
            'Entrenar más y dormir menos no suma. La recuperación es parte del proceso. Hoy el plan es descansar bien.',
        image: {
            src: '/plan14d/dia-11.webp',
            alt: 'Cama tendida con manta suave plegada y lámpara cálida encendida, cortinas opacas',
        },
        actions: {
            E: {
                title: 'Día de movilidad o caminata larga: 30 min, sin pesas',
                detail:
                    'El músculo se adapta en los días de descanso. Un día sin fuerza no es retroceso.',
            },
            M: {
                title: 'Mantén el ayuno cómodo. Si hoy hubo estrés alto, no extiendas',
                detail:
                    'Un día muy estresante no es el mejor día para exigirte más. Si tuviste un día difícil, hoy come en tu ventana normal. La constancia gana al heroísmo.',
            },
            C: {
                title: '8 horas de sueño esta noche. Plan B: siesta de 20 min mañana',
                detail:
                    'Si no llegas a 8 h hoy, no compenses con más cafeína mañana. La siesta corta (sin pasar de 30 min) recupera sin alterar el sueño nocturno.',
                references: [REF_CHANG],
            },
        },
    },
    {
        day: 12,
        phase: 'Consolidación',
        title: 'Segundo corte: qué cambió',
        description:
            'Ya tienes 11 días de datos. Mide y compara con el día 7. Pequeños cambios indican que el sistema está respondiendo — lo importante es la dirección, no la magnitud.',
        image: {
            src: '/plan14d/dia-12.webp',
            alt: 'Dos páginas de cuaderno lado a lado con fechas día 7 y día 12, anotaciones suaves',
        },
        actions: {
            E: {
                title: 'Mide cintura y peso. Compara con día 7',
                detail:
                    'Compara con el día 7 y con el día 1. Lo importante es la dirección, no la magnitud. Si nada cambia, revisa primero el sueño y la constancia.',
            },
            M: {
                title: 'Compara tus horarios reales de comida: ¿más consistentes que la semana 1?',
                detail:
                    'Comer a horas parecidas cada día le da a tu cuerpo un ritmo predecible. Para empezar, la regularidad importa más que alargar el ayuno.',
            },
            C: {
                title: 'Compara tu energía promedio del día (1-10) con la semana 1',
                detail:
                    '¿Subió, bajó, igual? Si bajó: revisa sueño y estrés. Si subió: tu sistema está respondiendo. Si igual: dale otra semana, los cambios subjetivos son lentos.',
            },
        },
    },
    {
        day: 13,
        phase: 'Consolidación',
        title: 'Lo que sí puedes mantener',
        description:
            'Mañana terminas los 14 días. El reto no es hacer un día más — es hacer 90 más sin sentirte forzado. Hoy define qué se queda y qué se suelta.',
        image: {
            src: '/plan14d/dia-13.webp',
            alt: 'Tres piedras de río apiladas en equilibrio sobre madera, sentido minimalista de estructura sostenible',
        },
        actions: {
            E: {
                title: 'Define cuántas sesiones de fuerza por semana son realistas para ti',
                detail:
                    'Entre 2 y 4. Dos sesiones constantes vencen a cuatro intermitentes. Elige el número que puedas mantener en una semana mala.',
                references: [REF_SCHOENFELD, REF_ACSM],
            },
            M: {
                title: 'Elige tu ventana de ayuno default para los próximos 30 días',
                detail:
                    'No tiene que ser todos los días. 5 de 7 es perfecto. Una vez encuentras tu ventana cómoda, conviértela en autopiloto.',
            },
            C: {
                title: 'Lista los 3 hábitos que vas a conservar. Los demás los sueltas sin culpa',
                detail:
                    'Soltar sin culpa es parte del plan. Forzar 10 hábitos en simultáneo garantiza recaída total. Tres hábitos sólidos baten a diez intermitentes.',
            },
        },
    },
    {
        day: 14,
        phase: 'Consolidación',
        title: 'Tu nuevo baseline',
        description:
            'Completaste los 14 días. Ya tienes rutinas y datos propios. El siguiente paso es mantenerlas y medir cada mes.',
        image: {
            src: '/plan14d/dia-14.webp',
            alt: 'Cima de montaña al amanecer con niebla en los valles y horizonte despejado',
        },
        actions: {
            E: {
                title: 'Re-mide cintura, peso, foto. Compara con día 1 y día 7',
                detail:
                    'Documenta el delta. Esos números van a ser tu motivación cuando una semana difícil intente convencerte de que nada funciona.',
            },
            M: {
                title: 'Repite el quiz IMR (toma 2 min). Calcula tu nuevo score',
                detail:
                    'El IMR es una estimación, no un examen médico, pero medirlo cada mes con el mismo método te muestra si vas en la dirección correcta.',
            },
            C: {
                title: 'Si quieres seguir registrando tus hábitos, descarga Elena (gratis, iPhone)',
                detail:
                    'Elena es nuestra app para registrar ayuno, comidas, sueño, ejercicio e hidratación cada día. Es opcional: lo que aprendiste en estos 14 días funciona igual con papel y lápiz.',
            },
        },
    },
];
