import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';

interface Lead {
    id: string;
    email: string;
    weight: string;
    waist: string;
    hip: string;
    icc: string;
    dateCompleted: string;
}

const LeadList = () => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const fetchLeads = async () => {
                    try {
                        const pruebasRef = collection(db, 'pruebas');
                        // No usamos orderBy para evitar fallos si no existe el índice compuesto
                        const q = query(pruebasRef);
                        const snap = await getDocs(q);

                        const data: Lead[] = [];
                        snap.forEach(doc => {
                            const d = doc.data();
                            const quizInputs = d.quiz?.inputs || {};
                            let icc = "N/A";

                            if (quizInputs.waist && quizInputs.hip) {
                                icc = (Number(quizInputs.waist) / Number(quizInputs.hip)).toFixed(2);
                            }

                            const createdAtRaw = d.metadata?.timestamp || d.createdAt;
                            let dateStr = 'Desconocido';
                            if (createdAtRaw) {
                                if (createdAtRaw.toDate) {
                                    dateStr = createdAtRaw.toDate().toLocaleDateString();
                                } else if (createdAtRaw.seconds) {
                                    dateStr = new Date(createdAtRaw.seconds * 1000).toLocaleDateString();
                                } else {
                                    const dParsed = new Date(createdAtRaw);
                                    if (!isNaN(dParsed.getTime())) dateStr = dParsed.toLocaleDateString();
                                }
                            }

                            data.push({
                                id: doc.id,
                                email: d.email_sintetico || d.email || `anon-${doc.id.slice(0, 5)}@metamorfosis.com`,
                                weight: quizInputs.weight ? String(quizInputs.weight) : 'N/A',
                                waist: quizInputs.waist ? String(quizInputs.waist).slice(0, 5) : 'N/A',
                                hip: quizInputs.hip ? String(quizInputs.hip).slice(0, 5) : 'N/A',
                                icc: icc,
                                dateCompleted: dateStr
                            });
                        });

                        // Client-side sort by newest first
                        data.sort((a, b) => {
                            if (a.dateCompleted === 'Desconocido') return 1;
                            if (b.dateCompleted === 'Desconocido') return -1;
                            return new Date(b.dateCompleted).getTime() - new Date(a.dateCompleted).getTime();
                        });

                        setLeads(data);
                    } catch (error) {
                        console.error("Error fetching leads:", error);
                    } finally {
                        setLoading(false);
                    }
                };

                fetchLeads();
            } else {
                setLoading(false);
                console.warn("User not authenticated, skipping fetch.");
            }
        });

        return () => unsubscribe();
    }, []);

    const exportCsv = () => {
        if (leads.length === 0) return;
        const headers = ['Email', 'Peso_Inicial', 'Cintura', 'Cadera', 'ICC', 'Fecha_Registro'];
        const csvRows = [headers.join(',')];

        for (const lead of leads) {
            csvRows.push([
                lead.email,
                lead.weight,
                lead.waist,
                lead.hip,
                lead.icc,
                lead.dateCompleted
            ].join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads_metamorfosis_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl h-full flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-[#00C49A]/30 border-t-[#00C49A] rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-500 uppercase tracking-widest font-mono">Fetching CRM Data...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-2xl h-full w-full min-w-0 max-w-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-lg font-bold text-white uppercase tracking-widest mb-1">CRM: Protocol Leads</h2>
                    <p className="text-xs text-gray-500 font-mono">Usuarios Registrados en Metamorfosis</p>
                </div>
                <button
                    onClick={exportCsv}
                    className="text-xs font-bold uppercase tracking-wider text-[#00C49A] hover:text-[#00C49A]/80 transition-colors px-4 py-2 rounded-lg border border-[#00C49A]/30 hover:bg-[#00C49A]/10 flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Exportar a CSV
                </button>
            </div>

            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="text-[10px] uppercase tracking-widest bg-black/50 text-gray-500">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg">Email</th>
                            <th className="px-4 py-3">Peso (kg)</th>
                            <th className="px-4 py-3">Cint/Cad (cm)</th>
                            <th className="px-4 py-3">ICC</th>
                            <th className="px-4 py-3 text-right rounded-tr-lg">Fecha</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {leads.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-gray-600 font-mono text-xs">
                                    No captured leads yet.
                                </td>
                            </tr>
                        ) : (
                            leads.map((lead: Lead) => (
                                <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-4 py-4 font-medium text-gray-200">{lead.email}</td>
                                    <td className="px-4 py-4">{lead.weight}</td>
                                    <td className="px-4 py-4">{lead.waist} / {lead.hip}</td>
                                    <td className="px-4 py-4 font-mono text-blue-400">{lead.icc}</td>
                                    <td className="px-4 py-4 text-right text-xs">
                                        {lead.dateCompleted}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-600 font-mono">
                Total Leads: {leads.length}
            </div>
        </div>
    );
};

export default LeadList;
