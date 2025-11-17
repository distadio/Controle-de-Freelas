import React, { useState, useMemo, useEffect } from 'react';
import { Freela, Categoria, TipoServico } from '../../types';
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

    const { years, yearFreelas, kpis, monthlyData, categoryData, serviceTypeData, topLocais, topContratantes, availableContratantes } = useMemo(() => {
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

        const receitaPorMes = monthNames.map((name, index) => {
            const monthFreelas = yearFreelas.filter(f => new Date(f.data_evento + 'T00:00:00').getMonth() === index);
            return {
                name,
                total: monthFreelas.reduce((sum, f) => sum + f.valor, 0),
                count: monthFreelas.length
            };
        });

        const mesesComReceita = receitaPorMes.filter(m => m.count > 0);
        const melhorMes = mesesComReceita.length > 0
            ? mesesComReceita.reduce((max, m) => (m.total > max.total ? m : max))
            : { name: '-', total: 0, count: 0 };
        const piorMes = mesesComReceita.length > 0
            ? mesesComReceita.reduce((min, m) => (m.total < min.total ? m : min))
            : { name: '-', total: 0, count: 0 };

        const freelasPagos = yearFreelas.filter(f => f.status === 'pago' && f.data_pagamento);
        const tempoPagamento = freelasPagos.reduce((sum, f) => {
            const evento = new Date(f.data_evento + 'T00:00:00');
            const pagamento = new Date(f.data_pagamento! + 'T00:00:00');
            const diffTime = Math.abs(pagamento.getTime() - evento.getTime());
            return sum + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }, 0);
        
        // @FIX: Provide a typed initial value to the reduce function to ensure correct type inference for the accumulator. This resolves an issue where the accumulator was inferred as `unknown`.
        const contratantesCount = yearFreelas.reduce((acc, f) => {
            if (f.contratante) {
                acc[f.contratante] = (acc[f.contratante] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
        const totalContratantes = Object.keys(contratantesCount).length;
        const contratantesRecorrentes = Object.values(contratantesCount).filter(c => c > 1).length;

        const kpis = {
            totalAnual,
            totalFreelas: yearFreelas.length,
            totalMei,
            totalMeiFreelas: freelasMei.length,
            melhorMes: melhorMes.name,
            melhorMesValor: melhorMes.total,
            piorMes: piorMes.name,
            piorMesValor: piorMes.total,
            ticketMedioMensal: mesesComReceita.length > 0 ? totalAnual / mesesComReceita.length : 0,
            frequenciaMensal: yearFreelas.length / 12,
            ticketMedioUnitario: yearFreelas.length > 0 ? totalAnual / yearFreelas.length : 0,
            taxaConversao: yearFreelas.length > 0 ? (freelasPagos.length / yearFreelas.length) * 100 : 0,
            tempoMedioPagamento: freelasPagos.length > 0 ? Math.round(tempoPagamento / freelasPagos.length) : 0,
            recorrencia: totalContratantes > 0 ? (contratantesRecorrentes / totalContratantes) * 100 : 0
        };

        const processGroupData = (key: 'categoria' | 'tipo_servico') => {
            // @FIX: Provide a typed initial value to the reduce function to ensure correct type inference for the accumulator. This resolves an issue where properties were being accessed on an `unknown` type.
            const grouped = yearFreelas.reduce((acc, f) => {
                const groupKey = f[key] || 'outro';
                if (!acc[groupKey]) {
                    acc[groupKey] = { name: groupKey.replace(/_/g, ' '), count: 0 };
                }
                acc[groupKey].count += 1;
                return acc;
            }, {} as Record<string, { name: string, count: number }>);
            return Object.values(grouped).sort((a, b) => b.count - a.count);
        }
        
        const processRankedData = (key: 'local' | 'contratante') => {
            // @FIX: Provide a typed initial value to the reduce function to ensure correct type inference for the accumulator. This resolves an issue where properties were being accessed on an `unknown` type.
             const grouped = yearFreelas.reduce((acc, f) => {
                const groupKey = f[key];
                if (groupKey) {
                    if (!acc[groupKey]) {
                        acc[groupKey] = { name: groupKey, count: 0, value: 0 };
                    }
                    acc[groupKey].count += 1;
                    acc[groupKey].value += f.valor;
                }
                return acc;
            }, {} as Record<string, { name: string, count: number, value: number }>);
            return Object.values(grouped).sort((a, b) => b.count - a.count).slice(0, 5);
        }

        return { 
            years, 
            yearFreelas, 
            kpis, 
            monthlyData: receitaPorMes.map(m => ({name: m.name, Receita: m.total})), 
            categoryData: processGroupData('categoria'), 
            serviceTypeData: processGroupData('tipo_servico'),
            topLocais: processRankedData('local'),
            topContratantes: processRankedData('contratante'),
            availableContratantes 
        };

    }, [allFreelas, selectedYear, filters]);
    
    useEffect(() => {
        setInsights('');
    }, [selectedYear, filters]);

    const handleGenerateInsights = async () => {
        setIsLoadingInsights(true);
        const result = await generateDashboardInsights(yearFreelas);
        setInsights(result);
        setIsLoadingInsights(false);
    };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Dashboard de Métricas" titleIcon="📊" headerGradient="from-purple-600 via-pink-600 to-blue-600">
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 bg-gray-50">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                     <h3 className="text-lg font-bold text-gray-900 mb-3">Análise Anual</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         <div>
                             <label htmlFor="yearSelector" className="block text-xs font-medium text-gray-700 mb-1">Ano</label>
                             <select id="yearSelector" value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold text-sm">
                                 {years.map(y => <option key={y} value={y}>{y}</option>)}
                             </select>
                         </div>
                         <div>
                             <label htmlFor="contratante" className="block text-xs font-medium text-gray-700 mb-1">Contratante</label>
                             <select id="contratante" name="contratante" value={filters.contratante} onChange={handleFilterChange} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold text-sm">
                                 <option value="">Todos</option>
                                 {availableContratantes.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                         </div>
                         <div>
                            <label htmlFor="tipoServico" className="block text-xs font-medium text-gray-700 mb-1">Tipo de Serviço</label>
                            <select name="tipoServico" id="tipoServico" value={filters.tipoServico} onChange={handleFilterChange} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold text-sm capitalize">
                                <option value="">Todos</option>
                                {Object.values(TipoServico).map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                            </select>
                         </div>
                         <div>
                            <label htmlFor="categoria" className="block text-xs font-medium text-gray-700 mb-1">Categoria</label>
                            <select name="categoria" id="categoria" value={filters.categoria} onChange={handleFilterChange} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold text-sm capitalize">
                                <option value="">Todos</option>
                                {Object.values(Categoria).map(v => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                            </select>
                         </div>
                     </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard title="Receita Total" value={formatCurrency(kpis.totalAnual)} />
                    <KpiCard title="Nº Freelas" value={kpis.totalFreelas} />
                    <KpiCard title="Ticket Médio" value={formatCurrency(kpis.ticketMedioUnitario)} />
                    <KpiCard title="Recorrência" value={`${kpis.recorrencia.toFixed(0)}%`} />
                </div>
                
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-3">Receita por Mês</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={monthlyData}>
                            <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `R$${value/1000}k`} />
                            <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ background: 'white', border: '1px solid #ccc', borderRadius: '8px' }}/>
                            <Bar dataKey="Receita" fill="url(#colorUv)" radius={[4, 4, 0, 0]} />
                             <defs>
                                <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0.2}/>
                                </linearGradient>
                            </defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3 gap-3">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span className="text-2xl">✨</span> Insights com IA Gemini
                        </h3>
                        <button
                            onClick={handleGenerateInsights}
                            disabled={isLoadingInsights || yearFreelas.length < 3}
                            className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold py-2 px-4 rounded-lg hover:from-purple-600 hover:to-indigo-600 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm w-full sm:w-auto"
                        >
                            {isLoadingInsights ? 'Analisando...' : 'Gerar Análise'}
                        </button>
                    </div>
                    {isLoadingInsights ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div>
                            <p className="mt-3 text-gray-600">Aguarde, a IA está processando seus dados...</p>
                        </div>
                    ) : insights ? (
                        <div className="prose prose-sm max-w-none bg-gray-50 p-4 rounded-lg border border-gray-200" dangerouslySetInnerHTML={{ __html: insights.replace(/\n/g, '<br />').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                    ) : (
                        <div className="text-center text-gray-500 py-6 bg-gray-50 rounded-lg">
                            <p className="font-semibold">{yearFreelas.length < 3 ? "Adicione pelo menos 3 freelas este ano para obter insights." : "Clique em 'Gerar Análise' para receber dicas da IA."}</p>
                        </div>
                    )}
                </div>

            </div>
        </BaseModal>
    );
};

export default DashboardModal;
