import React, { useState, useEffect, useMemo } from 'react';
import {
    PieChart, Pie, Cell,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
    ScatterChart, Scatter,
    ResponsiveContainer
} from 'recharts';

// Definición de Interfaces según IMR-V01
interface syntheticUser {
    id: string;
    gender: 'male' | 'female';
    age: number;
    initial_weight: number;
    height: number;
    waist: number;
    hip: number;
    neck: number;
    body_fat: number;
    fasting_hours: number;
    diet_type: string;
    ultra_processed_score: number;
    energy_score: number;
    exercise_days: number;
    sleep_hours: number;
    createdAt?: any;
    // Agregados Post-Cálculo
    imr_score?: number;
    b_score?: number;
    m_score?: number;
    h_score?: number;
}

// Fallback de cálculo IMR para registros de pruebas que no traen score pre-calculado.
// Usamos el motor canónico local (SPEC-004); antes esto apuntaba a una Cloud Function
// `calculateIMRv2` que estaba marcada como disabled, así que el fallback era cosmético.
import { computeImr } from '../../lib/imr/engine';

const COLORS = {
    optimal: '#2DD4BF', // Cian
    recovery: '#60A5FA', // Azul claro
    warning: '#FBBF24', // Amarillo
    danger: '#EF4444',  // Rojo
    neutral: '#6B7280'
};

const AnaliticaIMR = () => {
    const [data, setData] = useState<syntheticUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchPruebas = async () => {
            try {
                const response = await fetch('/api/admin/analitica');
                if (response.status === 401) {
                    window.location.href = '/admin/login';
                    return;
                }
                if (!response.ok) throw new Error('Error de conexión a la API');

                const resData = await response.json();
                if (!resData.success) {
                    throw new Error(resData.error || 'Error al obtener datos');
                }

                const users: syntheticUser[] = [];
                resData.docs.forEach((d: any) => {
                    const quiz = d.quiz || {};
                    const inputs = quiz.inputs || {};

                    const userRecord: syntheticUser = {
                        id: d._id,
                        gender: inputs.gender || 'unknown',
                        age: inputs.age || 30, // Default if not provided
                        initial_weight: inputs.weight || 70,
                        height: inputs.height || 170,
                        waist: inputs.waist || 90,
                        hip: inputs.hip || 100,
                        neck: inputs.neck || 35,
                        body_fat: 20,
                        diet_type: 'mixto',
                        ultra_processed_score: inputs.nutritionScore || 5,
                        energy_score: inputs.energyLevel || 5,
                        exercise_days: inputs.exerciseScore || 0,
                        sleep_hours: inputs.sleepHours || 6,
                        fasting_hours: inputs.fastingHours || 12,
                        createdAt: d.createdAtStr || d.metadata?.timestamp || d.createdAt,

                        imr_score: Math.round(quiz.imrScore || quiz.imxScore || 0),
                        b_score: quiz.bodyScore_B ? Math.round(quiz.bodyScore_B * 100) : 0,
                        m_score: quiz.metabolicScore_M ? Math.round(quiz.metabolicScore_M * 100) : 0,
                        h_score: quiz.lifestyleScore_H ? Math.round(quiz.lifestyleScore_H * 100) : 0,
                    };

                    // Fallback de cálculo cuando el registro no trae imr_score pre-calculado.
                    // Usa el motor local (SPEC-004) en sincronía — sin red, sin promesas.
                    if (!userRecord.imr_score || userRecord.imr_score === 0) {
                        try {
                            const fallback = computeImr({
                                heightCm: userRecord.height,
                                weightKg: userRecord.initial_weight,
                                waistCm: userRecord.waist,
                                neckCm: userRecord.neck,
                                hipCm: userRecord.hip,
                                age: userRecord.age,
                                gender: userRecord.gender === 'female' ? 'female' : 'male',
                                bodyFatPct: userRecord.body_fat,
                            });
                            userRecord.imr_score = fallback.imrScore;
                            userRecord.b_score = Math.round(fallback.blocks.E * 100);
                            userRecord.m_score = Math.round(fallback.blocks.M * 100);
                            userRecord.h_score = Math.round(fallback.blocks.C * 100);
                        } catch (e) {
                            console.warn(`Fallback IMR no calculable para ${userRecord.id}:`, e);
                        }
                    }

                    users.push(userRecord);
                });

                // Sort newest first client-side safely checking timestamp formats
                users.sort((a, b) => {
                    let timeA = 0; let timeB = 0;
                    if (a.createdAt?.seconds) timeA = a.createdAt.seconds * 1000;
                    else if (typeof a.createdAt === 'string' || typeof a.createdAt === 'number') timeA = new Date(a.createdAt).getTime();

                    if (b.createdAt?.seconds) timeB = b.createdAt.seconds * 1000;
                    else if (typeof b.createdAt === 'string' || typeof b.createdAt === 'number') timeB = new Date(b.createdAt).getTime();

                    return timeB - timeA;
                });

                setData(users);
            } catch (err: any) {
                console.error("Error fetching pruebas:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPruebas();
    }, []);

    // ─── Proceso de Datos (useMemo) ──────────────────────────────────────────

    const processedData = useMemo(() => {
        if (!data.length) return { categoryData: [], pillarData: [], fastingData: [], correlationData: [], averageIMR: 0, maleCount: 0, femaleCount: 0, calibrationAlerts: { tooManyOptimal: false, pillarMWarnings: false } };

        let sumIMR = 0;
        let counts = { highRisk: 0, deterioration: 0, recovery: 0, optimal: 0 };
        // Si no existen componentes de capa pre-calculados, no podremos promediarlos exactamente,
        // pero asumiremos que el Dashboard en versiones futuras guardará tb m_score, etc.
        // Por ahora lo dejaremos mockeado si no existen para la gráfica.
        let sumB = 0, sumM = 0, sumH = 0;
        let validPillars = 0;

        let males = 0;
        let females = 0;

        let fastingCounts: Record<number, number> = {};
        const scatter: any[] = [];

        data.forEach((u: syntheticUser) => {
            const imr = u.imr_score || 0;
            sumIMR += imr;

            if (u.gender === 'male') males++; else females++;

            if (imr <= 30) counts.highRisk++;
            else if (imr <= 50) counts.deterioration++;
            else if (imr <= 65) counts.recovery++;
            else counts.optimal++;

            if (u.b_score !== undefined && u.m_score !== undefined && u.h_score !== undefined) {
                sumB += u.b_score;
                sumM += u.m_score;
                sumH += u.h_score;
                validPillars++;
            }

            const fh = Math.round(u.fasting_hours || 12);
            fastingCounts[fh] = (fastingCounts[fh] || 0) + 1;

            const whtr = u.waist / u.height;
            scatter.push({ whtr: Number(whtr.toFixed(2)), imr });
        });

        return {
            averageIMR: Math.round(sumIMR / data.length),
            maleCount: males,
            femaleCount: females,
            calibrationAlerts: {
                tooManyOptimal: (counts.optimal / data.length) > 0.8,
                pillarMWarnings: validPillars > 0 ? ((sumM / validPillars) < (sumB / validPillars) - 10) : false
            },
            categoryData: [
                { name: 'Crisis (0-30)', value: counts.highRisk, fill: COLORS.danger },
                { name: 'Deterioro (30-50)', value: counts.deterioration, fill: COLORS.warning },
                { name: 'Recuperación (50-65)', value: counts.recovery, fill: COLORS.recovery },
                { name: 'Óptimo (65-100)', value: counts.optimal, fill: COLORS.optimal },
            ],
            pillarData: [
                { name: 'Capa B (Cuerpo)', score: validPillars ? Math.round(sumB / validPillars) : 60 },
                { name: 'Capa M (Metabolismo)', score: validPillars ? Math.round(sumM / validPillars) : 55 },
                { name: 'Capa H (Hábitos)', score: validPillars ? Math.round(sumH / validPillars) : 45 },
            ],
            fastingData: Object.entries(fastingCounts)
                .map(([hours, count]) => ({ hours: Number(hours), count }))
                .sort((a, b) => a.hours - b.hours),
            correlationData: scatter
        };
    }, [data]);

    const { categoryData, pillarData, fastingData, correlationData, averageIMR, maleCount, femaleCount, calibrationAlerts } = processedData;

    return (
        <div className="space-y-8 pb-20">
            {/* Calibration Alerts Header */}
            {calibrationAlerts.tooManyOptimal && (
                <div className="bg-amber-500/10 border border-amber-500/50 p-4 rounded-xl flex items-start gap-4 animate-pulse">
                    <span className="text-amber-500 text-2xl">⚠️</span>
                    <div>
                        <h4 className="text-amber-500 font-bold uppercase tracking-wider text-sm">Alerta de Calibración: Riesgo de Falso Positivo</h4>
                        <p className="text-amber-400/80 text-xs">Más del 80% de la población sintética está catalogada como óptima. Revisa los pesos de los bloques M y C en `lib/imr/engine.ts` (`calculateSPEC705`).</p>
                    </div>
                </div>
            )}
            {calibrationAlerts.pillarMWarnings && (
                <div className="bg-blue-500/10 border border-blue-500/50 p-4 rounded-xl flex items-start gap-4">
                    <span className="text-blue-500 text-2xl">🔍</span>
                    <div>
                        <h4 className="text-blue-500 font-bold uppercase tracking-wider text-sm">Anomalía Detectada: Capa M Castiga Excesivamente</h4>
                        <p className="text-blue-400/80 text-xs">El score promedio de la Capa Metabólica (M) está 10 puntos por debajo de la base morfológica (B). Ajustar normalización logística del ayuno.</p>
                    </div>
                </div>
            )}

            {/* Header / Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#0A0A0A] border border-gray-800 p-6 rounded-2xl shadow-[0_0_20px_rgba(0,196,154,0.05)]">
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-1">Muestra Activa</p>
                    <p className="text-4xl font-mono font-black text-white">{data.length}</p>
                    <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-widest">{maleCount} M / {femaleCount} F</p>
                </div>
                <div className="bg-[#0A0A0A] border border-gray-800 p-6 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                    {/* Fondo difuminado condicional dependiendo del average */}
                    <div className={`absolute inset-0 opacity-20 transition-all duration-500 group-hover:opacity-40
                        ${averageIMR > 65 ? 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-teal-400 to-transparent' :
                            averageIMR > 50 ? 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-400 to-transparent' :
                                averageIMR > 30 ? 'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400 to-transparent' :
                                    'bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-500 to-transparent'}`}
                    ></div>
                    <p className="text-gray-500 text-xs font-bold tracking-widest uppercase mb-1 relative z-10">Promedio IMR Población</p>
                    <div className="flex items-baseline gap-1 relative z-10">
                        <span className="text-5xl font-mono font-black text-white drop-shadow-lg">{averageIMR}</span>
                        <span className="text-gray-500 font-bold">/100</span>
                    </div>
                </div>
            </div>

            {/* Dashboard Grid ── Fila 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Chart 1: Distribución */}
                <div className="bg-[#0A0A0A] border border-gray-800 p-6 rounded-2xl flex flex-col items-center justify-center min-h-[400px]">
                    <h3 className="text-sm font-bold tracking-widest uppercase text-gray-400 mb-6 self-start">Distribución Metabólica (IMR)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={100} stroke="none">
                                {categoryData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <RechartsTooltip contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#333' }} itemStyle={{ color: '#fff' }} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Chart 2: Capas B, M, H */}
                <div className="bg-[#0A0A0A] border border-gray-800 p-6 rounded-2xl flex flex-col items-center justify-center min-h-[400px]">
                    <h3 className="text-sm font-bold tracking-widest uppercase text-gray-400 mb-6 self-start">Rendimiento por Capas</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={pillarData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="name" stroke="#666" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                            <YAxis domain={[0, 100]} stroke="#666" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                            <RechartsTooltip cursor={{ fill: '#1a1a1a' }} contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#333' }} />
                            <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                                {pillarData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.neutral : index === 1 ? COLORS.warning : COLORS.optimal} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Dashboard Grid ── Fila 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Chart 3: Fasting Mastery */}
                <div className="bg-[#0A0A0A] border border-gray-800 p-6 rounded-2xl flex flex-col items-center justify-center min-h-[400px]">
                    <h3 className="text-sm font-bold tracking-widest uppercase text-gray-400 self-start">Mastery de Ayuno (S4)</h3>
                    <p className="text-xs text-gray-600 self-start mb-6">Dispersión logística: Horas de Ayuno vs Cantidad de Usuarios</p>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={fastingData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey="hours" stroke="#666" tick={{ fill: '#9ca3af' }} />
                            <YAxis stroke="#666" tick={{ fill: '#9ca3af' }} />
                            <RechartsTooltip cursor={{ fill: '#1a1a1a' }} contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#333' }} />
                            <Bar dataKey="count" fill={COLORS.recovery} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Chart 4: Correlación Cintura/IMR */}
                <div className="bg-[#0A0A0A] border border-gray-800 p-6 rounded-2xl flex flex-col items-center justify-center min-h-[400px]">
                    <h3 className="text-sm font-bold tracking-widest uppercase text-gray-400 self-start">Correlación Cintura vs IMR</h3>
                    <p className="text-xs text-gray-600 self-start mb-6">Dispersión de WHtR vs el Puntaje Global IMR.</p>
                    <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis type="number" dataKey="whtr" name="WHtR" unit="" domain={['auto', 'auto']} stroke="#666" tick={{ fill: '#9ca3af' }} />
                            <YAxis type="number" dataKey="imr" name="IMR Score" unit="" domain={[0, 100]} stroke="#666" tick={{ fill: '#9ca3af' }} />
                            <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: '#0A0A0A', borderColor: '#333' }} />
                            <Scatter name="Usuarios" data={correlationData} fill={COLORS.danger} opacity={0.6} />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Audit Table */}
            <div className="bg-[#0A0A0A] border border-gray-800 p-6 rounded-2xl overflow-x-auto">
                <h3 className="text-sm font-bold tracking-widest uppercase text-gray-400 mb-6">Auditoría de Registros Crudos</h3>
                <table className="w-full text-left text-sm text-gray-300">
                    <thead className="text-xs text-gray-500 uppercase bg-black/40 border-b border-gray-800">
                        <tr>
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Género</th>
                            <th className="px-4 py-3">Edad</th>
                            <th className="px-4 py-3">IMR</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.slice(0, 10).map((u: syntheticUser) => (
                            <tr key={u.id} className="border-b border-gray-800/50 hover:bg-white/5">
                                <td className="px-4 py-3 font-mono text-xs">{u.id.slice(0, 8)}</td>
                                <td className="px-4 py-3 capitalize">{u.gender === 'male' ? 'M' : 'F'}</td>
                                <td className="px-4 py-3">{u.age}</td>
                                <td className="px-4 py-3 font-mono text-[#00C49A]">{u.imr_score || '--'}</td>
                                <td className="px-4 py-3 text-right">
                                    <button className="text-[#007BFF] hover:text-white transition-colors text-xs uppercase tracking-wider font-bold">Ver</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AnaliticaIMR;
