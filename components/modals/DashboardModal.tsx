import React, { useState, useMemo, useEffect } from 'react';
import { Freela } from '../../types';
import BaseModal from './BaseModal';
import { generateDashboardInsights } from '../../services/geminiService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    allFreelas: Freela[];
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const KpiCard: React.FC<{ title: string; value: string | number }> = ({ title, value }) => (
    <div className="bg-white rounded-lg p-4 shadow-sm text-center">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{title}</p>
        <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
);


const DashboardModal: React.FC<DashboardModalProps> = ({ isOpen, onClose, allFreelas }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [filters, setFilters] = useState({ contratante: '', tipoServico: '', categoria: '' });
    const [insights, setInsights] = useState<string>('');
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const { years, yearFreelas, kpis, monthlyData, availableContratantes } = useMemo(() => {
        const years = [...new Set(allFreelas.map(f => new Date(f.data_evento + 'T00:00:00').getFullYear()).filter(year => !isNaN(year)))].sort((a: number, b: number) => b - a);
        if (years.length === 0) years.push(new Date().getFullYear());

        const yearFreelasForFilters = allFreelas.filter(f => new Date(f.data_evento + 'T00:00:00').getFullYear() === selectedYear);
        const availableContratantes = [...new Set(yearFreelasForFilters.map(f => f.contratante).filter(Boolean))] as string[];

        const yearFreelas = yearFreelasForFilters.filter(f => 
            (!filters.contratante || f.contratante === filters.contratante) &&
            (!filters.tipoServico || f.tipo_servico === filters.tipoServico) &&
            (!filters.categoria || f.categoria === filters.categoria)
        );
        
        const totalAnual = yearFreelas.reduce((sum, f) => sum + f.valor, 0);
        const freelasMei = yearFreelas.filter(f => f.declara_mei);
        const totalMei = freelasMei.reduce((sum, f) => sum + f.valor, 0);

        const monthlyData = monthNames.map((name, index) => {
            const monthFreelas = yearFreelas.filter(f => new Date(f.data_evento + 'T00:00:00').getMonth() === index);
            return {
                name,
                Receita: monthFreelas.reduce((sum, f) => sum + f.valor, 0),
            };
        });

        const kpis = {
            totalAnual: formatCurrency(totalAnual),
            totalMei: formatCurrency(totalMei),
            ticketMedio: yearFreelas.length > 0 ? formatCurrency(totalAnual / yearFreelas.length) : formatCurrency(0),
            totalFreelas: yearFreelas.length,
        };

        return { years, yearFreelas, kpis, monthlyData, availableContratantes };
    }, [allFreelas, selectedYear, filters]);

    const handleGenerateInsights = async () => {
        setIsLoadingInsights(true);
        setInsights('');
        try {
            const result = await generateDashboardInsights(yearFreelas);
            setInsights(result);
        } catch (error) {
            console.error(error);
            setInsights('Ocorreu um erro ao gerar os insights. Tente novamente.');
        } finally {
            setIsLoadingInsights(false);
        }
    };

    useEffect(() => {
        setInsights('');
    }, [selectedYear, filters]);


    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Dashboard Anual" titleIcon="📊" maxWidth="sm:max-w-3xl">
            <div className="p-4 sm:p-6 bg-gray-50">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="flex-1">
                        <label htmlFor="year-select" className="text-sm font-medium text-gray-700">Ano</label>
                        <select id="year-select" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="w-full mt-1 p-2 border border-gray-300 rounded-lg">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label htmlFor="contratante-filter" className="text-sm font-medium text-gray-700">Contratante</label>
                         <select id="contratante-filter" name="contratante" value={filters.contratante} onChange={handleFilterChange} className="w-full mt-1 p-2 border border-gray-300 rounded-lg">
                            <option value="">Todos</option>
                            {availableContratantes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <KpiCard title="Receita Total" value={kpis.totalAnual} />
                    <KpiCard title="Total de Freelas" value={kpis.totalFreelas} />
                    <KpiCard title="Ticket Médio" value={kpis.ticketMedio} />
                    <KpiCard title="Total MEI" value={kpis.totalMei} />
                </div>
                
                <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
                    <h3 className="font-bold text-gray-800 mb-2">Receita Mensal</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(value) => `R$${(value as number)/1000}k`} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            <Bar dataKey="Receita" fill="#8884d8" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4 my-6">
                    <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        Análise com IA (Gemini)
                    </h4>
                    <p className="text-sm text-gray-700 mb-4">
                        Receba insights e dicas personalizadas para otimizar sua carreira de freelancer com base nos dados deste ano.
                    </p>
                    <button 
                        onClick={handleGenerateInsights} 
                        disabled={isLoadingInsights || yearFreelas.length < 3}
                        className="bg-indigo-600 text-white py-2 px-5 rounded-lg hover:bg-indigo-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                    >
                        {isLoadingInsights ? 'Analisando...' : 'Gerar Insights'}
                    </button>
                    {yearFreelas.length < 3 && <p className="text-xs text-indigo-700 mt-2">É necessário ter pelo menos 3 freelas registrados no ano para gerar insights.</p>}

                    {isLoadingInsights && (
                        <div className="mt-4 flex items-center justify-center p-8 bg-white rounded-lg border">
                           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                           <p className="ml-3 text-gray-600">Aguarde, a IA está pensando...</p>
                        </div>
                     )}
                     {insights && (
                        <div className="mt-4 p-4 bg-white rounded-lg border prose prose-sm max-w-none" style={{ whiteSpace: 'pre-wrap' }}>
                            {insights}
                        </div>
                    )}
                </div>
            </div>
        </BaseModal>
    );
};

export default DashboardModal;
