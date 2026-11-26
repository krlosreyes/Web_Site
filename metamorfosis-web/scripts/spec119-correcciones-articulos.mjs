#!/usr/bin/env node
/**
 * SPEC-119 — Corrección editorial de los artículos publicados en Firestore
 * (colección metamorfosis_posts).
 *
 * Qué corrige:
 *   1. Datos y citas que no corresponden con el estudio citado (lista FIXES).
 *   2. Voseo (tomá, tenés, podés…) → español neutro con tú (lista VOSEO).
 *   3. Autocitas del canal de YouTube presentadas como referencia científica.
 *
 * Seguridad:
 *   - Por defecto es SIMULACIÓN: muestra cada cambio con contexto y no escribe.
 *   - Con --aplicar guarda primero un respaldo JSON completo de cada documento
 *     en scripts/backups/ y después escribe.
 *   - Recorre todos los campos de texto del documento (contenido, título,
 *     metadata, quiz, referencias, pasos, comparaciones).
 *   - Informa qué correcciones no encontraron su texto, para hacerlas a mano.
 *
 * Uso:
 *   node scripts/spec119-correcciones-articulos.mjs
 *   node scripts/spec119-correcciones-articulos.mjs --aplicar
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes('--aplicar');
const COLLECTION = 'metamorfosis_posts';

function findServiceAccount() {
    const rootDir = path.resolve(__dirname, '..');
    for (const file of fs.readdirSync(rootDir)) {
        if (file.endsWith('.json') && file.includes('firebase-adminsdk')) {
            return JSON.parse(fs.readFileSync(path.join(rootDir, file), 'utf8'));
        }
    }
    return null;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Las comillas pueden estar guardadas rectas o tipográficas.
const quotes = (s) => s.replace(/\\?["“”]/g, '["“”]');
// Un tramo: empieza en `from`, termina en `to`, sin cruzar párrafos.
const span = (from, to) => new RegExp(quotes(esc(from)) + '[^\\n]*?' + quotes(esc(to)));
const exact = (s) => new RegExp(quotes(esc(s)));

const SALT_NOTE =
    'Para hidratarte no necesitas agregar sal al agua: la mayoría de adultos ya consume más sodio del que recomienda la OMS (menos de 5 g de sal al día). Si haces ejercicio largo con mucho sudor, guíate por la sed. Si tienes hipertensión, enfermedad renal o cardíaca, o tomas diuréticos, no agregues sal ni electrolitos sin hablar antes con tu médico.';

/** slug → [regex, reemplazo, nota] */
export const FIXES = {
    'por-que-tu-cansancio-de-las-3-pm-es-sed-y-no-hambre': [
        [span('El cuerpo grita "energía" pero lo que realmente necesita es minerales + agua.', 'seguido de otra caída.'),
            'A veces lo que se siente como hambre o cansancio es sed. Un vaso de agua a media tarde es una prueba sencilla; un dulce suele darte un pico breve seguido de otra caída.',
            'agua con sal "resuelve el bajón en 15 minutos"'],
        [exact('Agua + pizca de sal en 15 min'), 'Un vaso de agua', 'sal en tabla'],
        [exact('Agregar una pizca de sal sin refinar a tu botella de 1 litro'), 'Tener una botella de agua a la vista y tomar según la sed', 'sal'],
        [span('Compra sal sin refinar (sal de mar gruesa, sal del Himalaya).', 'le da electrolitos.'), SALT_NOTE, 'sal (contradice a la OMS)'],
        [exact('En 7 de cada 10 casos, era sed disfrazada.'), 'Muchas veces, era sed.', '"7 de cada 10" sin fuente'],
        [span('Beber 500 ml de agua aumenta el gasto energético', 'Journal of Clinical Endocrinology & Metabolism).'),
            'Un estudio pequeño encontró que beber 500 ml de agua aumentaba el gasto energético durante la hora siguiente (Boschmann et al., 2003, Journal of Clinical Endocrinology & Metabolism), pero estudios posteriores midieron un efecto mucho menor. Toma agua para hidratarte, no para quemar calorías.',
            'Boschmann: el "~2400 calorías" no está en el estudio y no se replicó'],
        [span('Aplica la regla 70/30', 'agradecen el ritmo circadiano.'),
            'Reparte el agua a lo largo del día y toma más en la mañana y la tarde que en la noche, para no interrumpir tu sueño por ir al baño.',
            'regla 70/30 sin fuente'],
        [exact('un vaso de agua con sal'), 'un vaso de agua', 'agua con sal sin advertencia para hipertensión'],
        [exact('Maughan, R. J. & Shirreffs, S. M. (2010)'), 'Maughan, R. J. & Shirreffs, S. M. (2008)', 'año de la cita'],
    ],
    'por-que-dormir-8-horas-no-es-lo-mismo-que-dormir-8-horas': [
        [exact('Reduce dosis de antidepresivos SSRI con tu médico si afectan tu sueño (suprimen REM)'),
            'Si tomas antidepresivos y notas que afectan tu sueño, coméntalo con tu médico. No cambies ni suspendas la dosis por tu cuenta',
            'consejo riesgoso sobre antidepresivos'],
        [span('El sistema glinfático elimina hasta 60%', 'PNAS).'),
            'En ratones, el espacio por donde circula el líquido que limpia el cerebro (sistema glinfático) aumentó cerca de un 60 % durante el sueño (Xie et al., 2013, Science). En personas, una noche sin dormir elevó el beta-amiloide cerebral alrededor de un 5 % (Shokri-Kojori et al., 2018, PNAS).',
            'Xie es en ratones; Shokri-Kojori midió ~5 %, no 25-30 %'],
        [exact('perderás el 60-70% del REM'), 'perderás buena parte del REM', 'porcentaje sin fuente'],
        [exact('limpia las toxinas del cerebro'), 'ayuda a limpiar desechos del cerebro', 'lenguaje de "toxinas"'],
    ],
    'tu-cuerpo-tiene-un-horario-de-oficina-el-reloj-secreto-de-tus-celulas': [
        [span('No existen los "búhos nocturnos"', 'resistencia a la insulina.'),
            'Todos tenemos el mismo reloj molecular, que se sincroniza con la luz solar, aunque hay personas más madrugadoras y otras más nocturnas (el cronotipo, que en parte es genético). Vivir mucho tiempo en contra de tu reloj, como en el trabajo nocturno por turnos, se asocia con más hambre y peor control de la glucosa.',
            'los cronotipos sí existen; "20-30 % de productividad" sin fuente'],
        [exact('suprimes hasta 50% de la melatonina y retrasas el sueño profundo 2-3 horas.'),
            'puedes reducir y retrasar la melatonina, y tardar más en dormirte.', 'cifras sin fuente'],
        [exact('Si dormiste profundo entre 11 pm y 3 am, este trabajo se completa. '), '', 'afirmación sin fuente'],
        [exact('Si te dormiste a la 1 am, perdiste el 50% de la ventana de reparación.'),
            'Acostarte muy tarde de forma habitual te quita horas de sueño.', 'porcentaje inventado'],
    ],
    'por-que-comer-menos-y-moverte-mas-fracasa-en-el-95-de-los-casos': [
        [exact('(suele ser falta de sal/agua, no comida)'), '(rompe el ayuno y, si se repite, consulta a tu médico)', 'sal'],
        [span('Cuando bajas insulina, tus riñones excretan más agua y sodio.', 'primeros días del cambio.'),
            'Al cambiar tu alimentación, algunas personas sienten mareo, calambres o dolor de cabeza los primeros días. ' + SALT_NOTE, 'sal en cada comida (contradice a la OMS)'],
        [span('Agrega una pizca de sal sin refinar a un vaso de agua al despertar', 'efectos secundarios de la transición.'),
            'Toma un vaso de agua al despertar y bebe según la sed durante el día.', 'sal'],
        [/fracasa en el 95 ?% de los casos/g, 'suele fracasar a largo plazo', '95 % sin fuente (título y texto)'],
        [span('Ludwig y Ebbeling demostraron en JAMA Internal Medicine (2018)', 'mueve la aguja del peso a largo plazo.'),
            'Un ensayo de Ebbeling, Ludwig y colegas (BMJ, 2018) encontró que, después de bajar de peso, una dieta baja en carbohidratos mantuvo un gasto energético mayor (unas 200-280 kcal al día) que una alta en carbohidratos con las mismas calorías. Otros investigadores discuten estos resultados: tómalo como evidencia en desarrollo. La calidad de lo que comes importa, no solo las calorías.',
            'revista equivocada y cifra máxima presentada como resultado'],
        [span('En el programa IDM (Intensive Dietary Management)', 'considerada crónica.'),
            'En una serie de 3 casos publicada por el equipo de Jason Fung en Toronto, tres pacientes con diabetes tipo 2 dejaron la insulina tras combinar ayuno intermitente y menos carbohidratos refinados, con supervisión médica (Furmli et al., 2018, BMJ Case Reports). Son 3 casos, no un ensayo: es una señal interesante, no una prueba. Nunca suspendas tu medicación sin tu médico.',
            'Furmli son 3 casos, no "el 50 % de los pacientes"'],
    ],
    'por-que-sigues-con-hambre-aunque-acabas-de-cenar': [
        [span('El consumo de carbohidratos refinados produce un pico de insulina 5-10 veces mayor', 'JAMA Internal Medicine).'),
            'Los carbohidratos refinados elevan la glucosa y la insulina más rápido que las grasas o las proteínas, y suelen saciar menos. Por eso un desayuno de pan blanco suele dejarte con hambre antes que uno de huevo y aguacate (Ludwig & Ebbeling, 2018, JAMA Internal Medicine).',
            '"5-10 veces" y "5-6 horas" sin fuente'],
        [span('Una dieta baja en carbohidratos refinados durante 12 semanas', 'Diabetes Therapy).'),
            'En un estudio de un año con adultos con diabetes tipo 2, una intervención baja en carbohidratos con acompañamiento médico redujo la insulina en ayunas y la HbA1c (Hallberg et al., 2018, Diabetes Therapy). No fue un ensayo aleatorizado y los participantes tenían supervisión médica.',
            'Hallberg: 1 año, diabetes tipo 2, no midió leptina'],
        [span('El test más sensible para detectar resistencia a la insulina', 'salga normal".'),
            'Una forma sencilla de estimar la resistencia a la insulina es el HOMA-IR: pide a tu médico glucosa e insulina en ayunas y él calcula el índice. El punto de corte cambia según la población (en estudios latinoamericanos suele estar entre 2,5 y 3), así que interprétalo con tu médico.',
            'HOMA-IR no es "el más sensible" y no se calcula dividiendo'],
    ],
    'por-que-te-matas-en-el-gimnasio-y-no-ves-cambios-reales': [
        [span('El protocolo de hipertrofia con foco en tensión mecánica', 'Journal of Strength & Conditioning Research).'),
            'Un metaanálisis encontró que la duración de cada repetición, entre 0,5 y 8 segundos, produce un crecimiento muscular parecido (Schoenfeld et al., 2015, Sports Medicine). Lo que más pesa es acercarte al fallo con buena técnica y progresar con el tiempo.',
            'el "25 % más eficaz" contradice la evidencia'],
    ],
    'ayuno-intermitente-guia-practica-para-sanar-tu-metabolismo-sin-pasar-hambre': [
        [exact('Sal sin refinar en el agua los primeros 14 días previene mareos'),
            'Si te mareas o te duele la cabeza al ayunar, rompe el ayuno y coméntalo con tu médico', 'sal'],
        [span('Cuando bajas la insulina, los riñones excretan más sodio y agua.', 'primeras semanas.'),
            'Al empezar a ayunar, algunas personas sienten mareo, dolor de cabeza o calambres. Toma agua según la sed y no alargues el ayuno si te sientes mal. ' + SALT_NOTE, 'sal ("causa #1 de fracaso" sin fuente)'],
        [exact('Toma agua con una pizca de sal sin refinar al despertar durante 14 días.'), 'Toma un vaso de agua al despertar.', 'sal'],
        [span('Estudios en mamíferos han demostrado que restringir la ventana', 'Cell Metabolism).'),
            'En ratones, comer una sola vez al día (con largos periodos de ayuno) se asoció con una vida más larga y mejores marcadores de salud, aun con la misma dieta (Mitchell et al., 2019, Cell Metabolism). Son resultados en animales: en personas no se ha demostrado que el ayuno alargue la vida.',
            'Mitchell: ratones, una comida al día, no "30 %"'],
        [span('El protocolo 16:8 aplicado durante 12 semanas', 'Nutrition Reviews).'),
            'Una revisión de estudios en personas concluyó que el ayuno intermitente puede ayudar a bajar de peso y grasa, con resultados parecidos a reducir calorías todos los días (Tinsley & La Bounty, 2015, Nutrition Reviews).',
            'Tinsley es una revisión; las cifras no salen de ahí'],
    ],
    'porque-la-comida-es-informacion-no-solo-calorias': [
        [span('Tu cuerpo solo puede usar 25-35 g de proteína por comida', 'International Society of Sports Nutrition).'),
            'La idea de que el cuerpo solo aprovecha 25-35 g de proteína por comida es un mito. La revisión de Schoenfeld y Aragon sugiere repartirla en 3 o 4 comidas de unos 0,4 g por kilo de peso cada una para favorecer el músculo (Schoenfeld & Aragon, 2018, Journal of the International Society of Sports Nutrition).',
            'la fuente citada concluye lo contrario'],
        [span('Lo que sí eleva LDL oxidado son los aceites vegetales', 'ultraprocesados.'),
            'Lo que más eleva el LDL son las grasas trans de los ultraprocesados y el exceso de grasa saturada. El papel de los aceites de semillas (girasol, maíz, soya) sigue en debate; las guías actuales los consideran mejor opción que las grasas trans.',
            'afirmación contraria a las guías actuales'],
        [exact('índice glucémico 30% más bajo'),
            'una subida de glucosa menor: al enfriarse se forma almidón resistente, que en algunos estudios redujo la respuesta glucémica', 'cifra sin fuente'],
        [span('Un estudio prospectivo de 12 años en 70,000 personas', 'JAMA Internal Medicine).'),
            'En el Adventist Health Study-2, con más de 70.000 personas, quienes seguían patrones de alimentación vegetarianos tuvieron un 12 % menos de mortalidad que los no vegetarianos (Orlich et al., 2013, JAMA Internal Medicine). Es un estudio observacional: muestra asociación, no causa.',
            'Orlich no estudió crucíferas ni duró 12 años'],
    ],
    'como-entrenar-zona-2-y-por-que-tu-mitocondria-depende-de-eso': [
        [exact('demostró ser superior a los intervalos cortos para aumentar el VO2 Max en un 13% en 8 semanas'),
            'mejoró el VO2 máx. cerca de un 7 % en 8 semanas, más que el entrenamiento continuo a intensidad moderada', 'Helgerud midió ~7 %'],
    ],
    'por-que-te-sientes-como-un-zombi-aunque-dormiste-8-horas': [
        [span('El cerebro elimina hasta un 60% más de desechos metabólicos', '(Xie et al., 2013, Science).'),
            'En ratones, el sistema glinfático, que limpia desechos del cerebro, trabaja mucho más durante el sueño que en la vigilia (Xie et al., 2013, Science).',
            'Xie es en ratones'],
        [exact('suprime la melatonina hasta en un 50%, retrasando el inicio del sueño profundo por 2-3 horas aunque cierres los ojos a las 10 pm.'),
            'puede reducir y retrasar la melatonina, y hacer que tardes más en dormirte.', 'cifras sin fuente'],
        [exact('23% más hambre'), '24 % más hambre', 'dato de Spiegel 2004'],
    ],
    '5-mitos-sobre-la-hidratacion-que-la-ciencia-ya-desmintio-pero-que-tu-mama-sigue-repitiendo': [
        [exact('Una pizca de sal sin refinar en una botella de 1L (especialmente si entrenas)'),
            'Comer frutas, verduras y sopas, que también hidratan', 'sal'],
        [span('Si entrenás o transpirás mucho, agregá ½ cucharadita de sal sin refinar', 'es contraproducente.'), SALT_NOTE, 'media cucharadita de sal por litro (contradice a la OMS)'],
    ],
    'el-mito-de-que-el-ayuno-es-todo-o-nada-que-comer-durante-el-ayuno': [
        [span('Consumir menos de 500 kcal de fuentes naturales', 'restricción total.'),
            'Las dietas que imitan el ayuno (unas 700-1.100 kcal al día durante 5 días, diseñadas en estudios clínicos) mostraron mejoras en algunos marcadores metabólicos (Wei et al., 2017, Science Translational Medicine). No existe un porcentaje preciso de cuántos beneficios del ayuno se conservan.',
            '"80 % de los beneficios" inventado'],
    ],
};


const ANDRES = 'tomaba-4-litros-de-agua-al-dia-y-se-sentia-peor-la-paradoja-de-andres-y-la-sobrehidratacion-silencio';
const pubmed = (q) => 'https://pubmed.ncbi.nlm.nih.gov/?term=' + encodeURIComponent(q);

/**
 * Artículos que se reescriben completos (SPEC-116, sección 3). El de Andrés
 * estaba construido sobre un caso clínico inventado y un protocolo de sal;
 * corregirlo frase por frase dejaba un texto incoherente.
 */
export const REWRITES = {
    [ANDRES]: {
        title: '¿Más agua siempre es mejor? El caso ilustrativo de Andrés y los 4 litros',
        content: [
            '> **Respuesta rápida:** Para la mayoría de adultos sanos, la sed es una guía suficiente para saber cuánta agua beber. Forzarte a tomar 4 litros porque "más es mejor" no tiene respaldo, y en situaciones poco frecuentes el exceso de agua puede ser peligroso. Si tienes dolor de cabeza, cansancio o niebla mental que no mejoran, consulta a un médico: los síntomas tienen muchas causas posibles y no se corrigen por cuenta propia con sal ni suplementos.',
            '',
            '## Un caso ilustrativo',
            '',
            'Andrés no es un paciente real. Es un personaje que creamos para mostrar un patrón frecuente; no hay análisis ni resultados reales detrás de su historia.',
            '',
            'Imagina a Andrés, 38 años, ejecutivo. Lleva una botella enorme en el escritorio porque leyó que "más agua es mejor" y se propone terminar 4 litros al día. A media tarde aparece el cansancio, algo de dolor de cabeza y la sensación de niebla mental. Piensa que hace todo bien, así que concluye que debería beber todavía más.',
            '',
            '## Qué sabemos y qué no',
            '',
            'Los síntomas de Andrés (cansancio, cefalea, niebla mental) son muy comunes y poco específicos. Pueden venir del sueño, del estrés, de la cafeína, de las pantallas o de condiciones médicas que solo un profesional puede evaluar. Atribuirlos al agua, sin más, sería adivinar.',
            '',
            'Lo que sí está bien documentado:',
            '',
            '- Tus necesidades de agua dependen de tu peso, el clima, tu actividad y tu alimentación. Una parte importante del agua te llega en la comida. No existe una cifra mágica igual para todos.',
            '- Los riñones de una persona sana eliminan el exceso de agua con eficacia. Por eso, en adultos sanos y sedentarios, beber más de lo necesario suele resultar en orinar más, no en un problema de salud.',
            '- Hay situaciones en que el exceso sí es peligroso: en ejercicio de resistencia prolongado, beber más de lo que se pierde puede diluir el sodio de la sangre (hiponatremia). En el maratón de Boston de 2002, el 13 % de los corredores analizados la presentó al terminar, y los factores asociados fueron aumentar de peso durante la carrera y tardar más de 4 horas en completarla (Almond et al., 2005, New England Journal of Medicine). También puede ocurrir con ciertas enfermedades, medicamentos o con el consumo compulsivo de agua.',
            '',
            '## Lo que sí y lo que no funciona',
            '',
            '- ✅ Beber cuando tienes sed y con las comidas.',
            '- ✅ Fijarte en el color de la orina: amarillo pálido suele indicar una hidratación adecuada.',
            '- ✅ Beber más cuando hace calor o haces ejercicio, guiándote por la sed.',
            '- ✅ Llevar un registro de cuándo aparecen tus síntomas (sueño, café, comidas) y consultarlo con tu médico si no mejoran.',
            '- ❌ Obligarte a beber 4 litros diarios "porque más es mejor".',
            '- ❌ Beber grandes cantidades de golpe, sobre todo durante o después de un ejercicio prolongado.',
            '- ❌ Tratar un dolor de cabeza persistente con sal o suplementos sin evaluación médica.',
            '',
            '## Cuándo buscar atención médica',
            '',
            'Si aparece dolor de cabeza intenso con náuseas o vómitos, confusión, somnolencia marcada o convulsiones tras beber mucha agua (especialmente después de ejercicio prolongado), busca atención de urgencia.',
            '',
            '## Tu plan de acción para esta semana',
            '',
            '1. Anota durante tres días cuánto bebes realmente y cuándo aparecen tus molestias.',
            '2. Si bebes más de 3 litros sin que el clima o el ejercicio lo justifiquen, baja de forma gradual y deja que la sed te guíe.',
            '3. Revisa el color de tu orina a media mañana: busca amarillo pálido.',
            '4. Si las molestias persisten dos semanas, lleva tu registro a tu médico.',
        ].join('\n'),
        quiz: [{
            question: '¿Qué muestra el caso ilustrativo de Andrés?',
            options: [
                'Que siempre hay que beber más agua cuando hay cansancio',
                'Que beber mucho más de lo que pide la sed no garantiza sentirse mejor, y que los síntomas persistentes merecen evaluación médica',
                'Que hay que agregar sal a cada vaso de agua',
                'Que el agua mineral es mejor que la del grifo',
            ],
            correctIndex: 1,
            rationale: 'Los síntomas de Andrés son inespecíficos; el exceso de agua no los explica por sí solo ni se arregla agregando sal. Lo prudente es guiarse por la sed y consultar si persisten.',
        }],
        references: [
            { title: 'Almond, C. S. D. et al. (2005). Hyponatremia among runners in the Boston Marathon. New England Journal of Medicine, 352(15), 1550-1556.', url: pubmed('Hyponatremia among runners in the Boston Marathon') },
            { title: 'Hew-Butler, T. et al. (2015). Statement of the Third International Exercise-Associated Hyponatremia Consensus Development Conference. Clinical Journal of Sport Medicine, 25(4), 303-320.', url: pubmed('Third International Exercise-Associated Hyponatremia Consensus Development Conference') },
            { title: 'Verbalis, J. G. et al. (2013). Diagnosis, evaluation, and treatment of hyponatremia: expert panel recommendations. American Journal of Medicine, 126(10 Suppl 1), S1-S42.', url: pubmed('Diagnosis, evaluation, and treatment of hyponatremia: expert panel recommendations') },
            { title: 'Popkin, B. M., D\'Anci, K. E. & Rosenberg, I. H. (2010). Water, hydration, and health. Nutrition Reviews, 68(8), 439-458.', url: pubmed('Popkin Water, hydration, and health Nutrition Reviews 2010') },
            { title: 'EFSA (2010). Scientific Opinion on Dietary Reference Values for water. EFSA Journal, 8(3), 1459.', url: 'https://www.efsa.europa.eu/en/efsajournal/pub/1459' },
        ],
    },
};

/** Referencias nuevas que acompañan a una corrección. */
const ADD_REFERENCES = {
    'por-que-te-matas-en-el-gimnasio-y-no-ves-cambios-reales': [{
        title: 'Schoenfeld, B. J., Ogborn, D. I. & Krieger, J. W. (2015). Effect of repetition duration during resistance training on muscle hypertrophy: a systematic review and meta-analysis. Sports Medicine, 45(4), 577-585.',
        url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Effect+of+repetition+duration+during+resistance+training+on+muscle+hypertrophy',
    }],
    'el-mito-de-que-el-ayuno-es-todo-o-nada-que-comer-durante-el-ayuno': [{
        title: 'Wei, M. et al. (2017). Fasting-mimicking diet and markers/risk factors for aging, diabetes, cancer, and cardiovascular disease. Science Translational Medicine, 9(377).',
        url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Fasting-mimicking+diet+and+markers%2Frisk+factors+for+aging',
    }],
    'tu-cuerpo-tiene-un-horario-de-oficina-el-reloj-secreto-de-tus-celulas': [],
};

/** Voseo → tú. Sensible a mayúsculas: cada forma va explícita. */
export const VOSEO = {
    tomá: 'toma', Tomá: 'Toma', tomás: 'tomas', tenés: 'tienes', agregá: 'agrega', Agregá: 'Agrega',
    pedí: 'pide', llevás: 'llevas', priorizá: 'prioriza', podés: 'puedes', necesitás: 'necesitas',
    entrenás: 'entrenas', usá: 'usa', transpirás: 'transpiras', sumá: 'suma', revisá: 'revisa',
    Revisá: 'Revisa', rendís: 'rindes', reducí: 'reduce', recalentás: 'recalientas', quemá: 'quema',
    metés: 'metes', limpiás: 'limpias', esperá: 'espera', eliminás: 'eliminas', dormís: 'duermes',
    dormí: 'duerme', dividí: 'divide', cuidás: 'cuidas', comés: 'comes', aumentás: 'aumentas',
    apagá: 'apaga', Subí: 'Sube', Reemplazá: 'Reemplaza', Llevá: 'Lleva', Hacé: 'Haz', Empezá: 'Empieza',
    Bajá: 'Baja', Apuntá: 'Apunta', Adelantá: 'Adelanta', contalos: 'cuéntalos', achicate: 'achícate',
    levantate: 'levántate', acuestate: 'acuéstate', Acuestate: 'Acuéstate',
};
export const VOSEO_RE = new RegExp(
    '(?<![A-Za-zÁÉÍÓÚáéíóúñÑ])(' + Object.keys(VOSEO).map(esc).join('|') + ')(?![A-Za-zÁÉÍÓÚáéíóúñÑ])', 'g');

const isSelfCitation = (ref) =>
    ref && typeof ref.title === 'string' && /^\s*Metamorfosis Real \(/.test(ref.title);

function context(s, i, len) {
    return s.slice(Math.max(0, i - 50), i) + '⟦' + s.slice(i, i + len) + '⟧' + s.slice(i + len, i + len + 30);
}

/** Aplica fn a cada string del objeto; devuelve copia. */
function mapStrings(value, fn, where = '') {
    if (typeof value === 'string') return fn(value, where);
    if (Array.isArray(value)) return value.map((v, i) => mapStrings(v, fn, `${where}[${i}]`));
    if (value && typeof value === 'object' && value.constructor === Object) {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = mapStrings(v, fn, where ? `${where}.${k}` : k);
        return out;
    }
    return value;
}

const EDITABLE = ['title', 'excerpt', 'description', 'content', 'metadata', 'quiz', 'references', 'steps', 'comparisons', 'app_integration'];

async function main() {
    const sa = findServiceAccount();
    if (!sa) { console.error('No encontré la llave de servicio en la raíz del repo.'); process.exit(1); }
    initializeApp({ credential: cert(sa) });
    const db = getFirestore();

    console.log(APPLY ? '== MODO APLICAR ==' : '== SIMULACIÓN (no se escribe nada). Usa --aplicar para guardar ==');
    const snap = await db.collection(COLLECTION).get();
    const backup = {};
    const pending = [];
    const notFound = [];
    let totalVoseo = 0;

    for (const doc of snap.docs) {
        const data = doc.data();
        const slug = data.slug || doc.id;
        const fixes = FIXES[slug] || [];
        const used = new Set();
        const log = [];

        const fn = (s, where) => {
            let out = s;
            fixes.forEach(([re, rep, note], idx) => {
                const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
                out = out.replace(g, (m, ...rest) => {
                    const off = rest[rest.length - 2];
                    log.push(`  [dato] ${where}: ${note}\n      antes:  …${context(out, off, m.length)}…\n      ahora:  ${rep || '(se elimina)'}`);
                    used.add(idx);
                    return rep;
                });
            });
            out = out.replace(VOSEO_RE, (m, w, off) => {
                totalVoseo++;
                log.push(`  [voseo] ${where}: …${context(out, off, m.length)}… → ${VOSEO[w]}`);
                return VOSEO[w];
            });
            return out;
        };

        const update = {};
        const rw = REWRITES[slug];
        if (rw) {
            const content = typeof data.content === 'string' || data.content == null
                ? rw.content
                : { ...data.content, body: rw.content };
            Object.assign(update, { title: rw.title, content, quiz: rw.quiz, references: rw.references });
            log.push(`  [reescritura] contenido, título, quiz y referencias completos (SPEC-116 §3)`);
            for (const k of ['steps', 'comparisons']) if (k in data) { update[k] = []; log.push(`  [reescritura] se vacía ${k} (era parte del protocolo de sal)`); }
        }
        for (const key of EDITABLE) {
            if (rw && key in update) continue;
            if (!(key in data)) continue;
            let next = mapStrings(data[key], fn, key);
            if (key === 'references' && Array.isArray(next)) {
                next = next.filter((r) => {
                    if (isSelfCitation(r)) { log.push(`  [referencia] se retira autocita: ${r.title}`); return false; }
                    return true;
                });
                for (const ref of ADD_REFERENCES[slug] || []) {
                    if (!next.some((r) => r.title === ref.title)) {
                        next.push(ref);
                        log.push(`  [referencia] se agrega: ${ref.title}`);
                    }
                }
            }
            if (JSON.stringify(next) !== JSON.stringify(data[key])) update[key] = next;
        }
        fixes.forEach(([, , note], idx) => { if (!used.has(idx)) notFound.push(`${slug}: ${note}`); });

        if (Object.keys(update).length) {
            console.log(`\n### ${slug} (doc ${doc.id})\n${log.join('\n')}`);
            backup[doc.id] = data;
            pending.push([doc.ref, update]);
        }
    }

    for (const slug of Object.keys(FIXES)) {
        if (!snap.docs.some((d) => (d.data().slug || d.id) === slug)) notFound.push(`${slug}: el artículo no existe en Firestore`);
    }

    console.log(`\nResumen: ${pending.length} artículos con cambios, ${totalVoseo} formas de voseo.`);
    if (notFound.length) {
        console.log('\nCorrecciones que NO encontraron su texto (revisar a mano en el admin):');
        notFound.forEach((n) => console.log('  - ' + n));
    }

    if (!APPLY) { console.log('\nSimulación terminada. Nada se escribió.'); return; }

    const dir = path.join(__dirname, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `spec119-posts-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`\nRespaldo guardado: ${file}`);

    for (const [ref, update] of pending) {
        await ref.update({ ...update, editorialRevision: 'spec-119' });
    }
    console.log(`Listo: ${pending.length} artículos actualizados.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((e) => { console.error(e); process.exit(1); });
}
