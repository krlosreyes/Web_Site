/**
 * SPEC-118: título y descripción para buscadores por artículo.
 *
 * Los títulos originales (Firestore) están escritos para redes: emojis,
 * puntos suspensivos, más de 70 caracteres. Aquí se reescriben a partir de
 * búsquedas reales en Google (autocompletado en español, Colombia,
 * 26-nov-2026). El slug NO cambia: las URLs ya indexadas se conservan.
 *
 * Reglas: título de ≤ 50 caracteres (con " | Metamorfosis Real" queda en
 * ~70, lo que Google muestra), descripción de ≤ 155 caracteres, sin emojis,
 * y solo promesas que el artículo cumple.
 */
export interface SeoOverride {
    title: string;
    description: string;
}

export const POST_SEO: Record<string, SeoOverride> = {
    'ayuno-intermitente-guia-practica-para-sanar-tu-metabolismo-sin-pasar-hambre': {
        title: 'Ayuno intermitente: cómo hacerlo y para qué sirve',
        description:
            'Guía práctica de ayuno intermitente: qué pasa en tu cuerpo a las 12 horas, qué es la autofagia y cómo empezar sin pasar hambre.',
    },
    'el-mito-de-que-el-ayuno-es-todo-o-nada-que-comer-durante-el-ayuno': {
        title: 'Qué puedo tomar o comer en ayuno intermitente',
        description:
            'El ayuno no es todo o nada. Qué alimentos y bebidas suben poco la insulina, en qué se diferencia la autofagia de bajar de peso y qué hacer en la práctica.',
    },
    'por-que-comer-menos-y-moverte-mas-fracasa-en-el-95-de-los-casos': {
        title: 'Comer menos y moverse más: por qué no funciona',
        description:
            'Si bajaste de peso y lo recuperaste, no es falta de voluntad. El papel de la insulina, la resistencia a la insulina y qué puedes cambiar desde hoy.',
    },
    'el-espejo-miente-por-que-estar-delgado-no-siempre-es-estar-sano': {
        title: 'Delgado pero con grasa abdominal: el riesgo oculto',
        description:
            'Estar en tu peso no garantiza estar sano. Qué es la grasa visceral, cómo detectarla con tu cintura y qué hacer para reducirla.',
    },
    'adios-a-la-bascula-la-guia-tecnica-para-medir-lo-que-realmente-importa': {
        title: 'Cómo medir tu grasa corporal con cinta métrica',
        description:
            'La báscula no distingue grasa, agua y músculo. Cómo medir cintura y cadera, qué indica el índice cintura-cadera y cómo seguir tu músculo.',
    },
    'por-que-te-matas-en-el-gimnasio-y-no-ves-cambios-reales': {
        title: 'Voy al gimnasio y no veo resultados: por qué pasa',
        description:
            'Entrenas duro y el espejo no cambia. Qué tienen que ver la vía mTOR, las mitocondrias y la flexibilidad metabólica, y cómo salir del estancamiento.',
    },
    'como-entrenar-zona-2-y-por-que-tu-mitocondria-depende-de-eso': {
        title: 'Entrenar en zona 2: qué es y cómo hacerlo',
        description:
            'Qué son las zonas de entrenamiento, por qué la zona 2 mejora tus mitocondrias y cómo incluirla en tu semana con un plan concreto.',
    },
    'por-que-dormir-8-horas-no-es-lo-mismo-que-dormir-8-horas': {
        title: 'Duermo 8 horas y me levanto cansado: por qué',
        description:
            'Dormir 8 horas no garantiza descansar. Cómo funcionan los ciclos de 90 minutos y las fases del sueño, y por qué la hora en que te acuestas importa.',
    },
    'por-que-te-sientes-como-un-zombi-aunque-dormiste-8-horas': {
        title: 'Duermo 8 horas y sigo con sueño: qué falla',
        description:
            'La limpieza nocturna del cerebro, el ritmo circadiano y la melatonina explican por qué amaneces cansado, y por qué después tienes más hambre.',
    },
    'tu-cuerpo-tiene-un-horario-de-oficina-el-reloj-secreto-de-tus-celulas': {
        title: 'Ritmo circadiano: el horario de tu cuerpo',
        description:
            'Qué hace tu cuerpo a cada hora del día según tu ritmo circadiano: cuándo rindes más, por qué llega el bajón de la tarde y cuándo entrenar.',
    },
    'por-que-tu-cansancio-de-las-3-pm-es-sed-y-no-hambre': {
        title: 'Cansancio en la tarde: por qué puede ser sed',
        description:
            'El bajón de las 3 pm a veces es sed disfrazada de hambre. Por qué el agua sola no siempre hidrata y qué hacer para hidratarte de verdad.',
    },
    '5-mitos-sobre-la-hidratacion-que-la-ciencia-ya-desmintio-pero-que-tu-mama-sigue-repitiendo': {
        title: '5 mitos sobre tomar agua que la ciencia desmintió',
        description:
            'Los 8 vasos al día, el café que deshidrata, la sed como guía y el agua que desintoxica: qué dice la ciencia de cada mito sobre hidratación.',
    },
    'tomaba-4-litros-de-agua-al-dia-y-se-sentia-peor-la-paradoja-de-andres-y-la-sobrehidratacion-silencio': {
        title: '¿Tomar mucha agua es malo? La sobrehidratación',
        description:
            'Más agua no siempre es mejor. Qué pasa con los electrolitos cuando tomas de más, señales de sobrehidratación y cuatro ajustes para hidratarte bien.',
    },
    'por-que-sigues-con-hambre-aunque-acabas-de-cenar': {
        title: 'Hambre después de comer: por qué pasa',
        description:
            '¿Tienes hambre al poco tiempo de comer? El papel de la insulina y la leptina, por qué las grasas saludables ayudan y qué cambiar esta semana.',
    },
    'porque-la-comida-es-informacion-no-solo-calorias': {
        title: 'Qué comer para tener energía todo el día',
        description:
            'La comida es información, no solo calorías. Qué aportan la proteína, el almidón resistente, las grasas y los vegetales verdes, plato por plato.',
    },
};

export const getPostSeo = (slug: string | undefined): SeoOverride | undefined =>
    slug ? POST_SEO[slug] : undefined;
