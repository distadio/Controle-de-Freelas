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
            ? mesesComReceita.reduce((max, m) => (m.total > max.total ? m : max), mesesComReceita[0])
            : { name: '-', total: 0, count: 0 };
        const piorMes = mesesComReceita.length > 0
            ? mesesComReceita.reduce((min, m) => (m.total < min.total ? m : min), mesesComReceita[0])
            : { name: '-', total: 0, count: 0 };

        const freelasPagos = yearFreelas.filter(f => f.status === 'pago' && f.data_pagamento);
        const tempoPagamento = freelasPagos.reduce((sum, f) => {
            const evento = new Date(f.data_evento + 'T00:00:00');
            const pagamento = new Date(f.data_pagamento! + 'T00:00:00');
            const diffTime = Math.abs(pagamento.getTime() - evento.getTime());
            return sum + Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }, 0);
        
        // FIX: Explicitly type the initial value for the reduce accumulator to ensure contratantesCount is correctly typed.
        const contratantesCount = yearFreelas.reduce((acc, f) => {
            if (f.contratante) {
                acc[f.contratante] = (acc[f.contratante] || 0) + 1;
            }
            return acc;
        // FIX: Explicitly type the initial value for the reduce accumulator to ensure contratantesCount is correctly typed.
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
            // FIX: Explicitly type the initial value for the reduce accumulator to ensure grouped is correctly typed.
            const grouped = yearFreelas.reduce((acc, f) => {
                const groupKey = f[key] || 'outro';
                if (!acc[groupKey]) {
                    acc[groupKey] = { name: groupKey.replace(/_/g, ' '), count: 0 };
                }
                acc[groupKey].count += 1;
                return acc;
            // FIX: Explicitly type the initial value for the reduce accumulator to ensure grouped is correctly typed.
            }, {} as Record<string, { name: string, count: number }>);
            return Object.values(grouped).sort((a, b) => b.count - a.count);
        }
        
        const processRankedData = (key: 'local' | 'contratante') => {
            // FIX: Explicitly type the initial value for the reduce accumulator to ensure grouped is correctly typed.
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
            // FIX: Explicitly type the initial value for the reduce accumulator to ensure grouped is correctly typed.
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
                             <select name="contratante" value={filters.contratante} onChange={handleFilterChange} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold text-sm">
                                 <option value="">Todos</option>
                                 {availableContratantes.map(c => <option key={c} value={c}>{c}</option>)}
                             </select>
                         </div>
                         <div>
                             <label htmlFor="tipoServico" className="block text-xs font-medium text-gray-700 mb-1">Tipo de Serviço</label>
                             <select name="tipoServico" value={filters.tipoServico} onChange={handleFilterChange} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold text-sm capitalize">
                                 <option value="">Todos</option>
                                 {Object.values(TipoServico).map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                             </select>
                         </div>
                         <div>
                             <label htmlFor="categoria" className="block text-xs font-medium text-gray-700 mb-1">Função Desempenhada</label>
                             <select name="categoria" value={filters.categoria} onChange={handleFilterChange} className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold text-sm capitalize">
                                 <option value="">Todas</option>
                                 {Object.values(Categoria).map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
                             </select>
                         </div>
                     </div>
                 </div>

                <div className="grid grid-cols-2 gap-3">
                     <KpiCard title="Total Anual" value={formatCurrency(kpis.totalAnual)} subtitle={`${kpis.totalFreelas} freelas`} color="from-green-400 to-green-600" />
                     <KpiCard title="Total MEI" value={formatCurrency(kpis.totalMei)} subtitle={`${kpis.totalMeiFreelas} freelas MEI`} color="from-cyan-400 to-cyan-600" />
                     <KpiCard title="Melhor Mês" value={kpis.melhorMes} subtitle={formatCurrency(kpis.melhorMesValor)} isMonth color="from-blue-400 to-blue-600" />
                     <KpiCard title="Pior Mês" value={kpis.piorMes} subtitle={formatCurrency(kpis.piorMesValor)} isMonth color="from-orange-400 to-orange-600" />
                     <div className="col-span-2">
                        <KpiCard title="Ticket Médio Mensal" value={formatCurrency(kpis.ticketMedioMensal)} subtitle={`${kpis.frequenciaMensal.toFixed(1)}/mês`} color="from-purple-400 to-purple-600" />
                     </div>
                </div>
                
                 <div className="grid grid-cols-2 gap-3">
                    <SecondaryKpiCard title="Ticket Médio Unitário" value={formatCurrency(kpis.ticketMedioUnitario)} subtitle="Por Cachê" />
                    <SecondaryKpiCard title="Taxa de Conversão" value={`${kpis.taxaConversao.toFixed(1)}%`} subtitle="Pagos vs Total" />
                    <SecondaryKpiCard title="Tempo Médio Pgto" value={`${kpis.tempoMedioPagamento} dias`} subtitle="Evento → Pagamento" />
                    <SecondaryKpiCard title="Recorrência" value={`${kpis.recorrencia.toFixed(1)}%`} subtitle="Clientes Recorrentes" />
                </div>
                
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ChartSection title="🎭 Funções Desempenhadas">
                         <DataList data={categoryData} total={kpis.totalFreelas}/>
                    </ChartSection>
                     <ChartSection title="🎪 Tipos de Serviço">
                        <DataList data={serviceTypeData} total={kpis.totalFreelas} />
                    </ChartSection>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ChartSection title="📍 Top 5 Locais">
                        <RankedList data={topLocais} />
                    </ChartSection>
                    <ChartSection title="👥 Top 5 Contratantes">
                        <RankedList data={topContratantes} showValue />
                    </ChartSection>
                </div>

                <ChartSection title={`💰 Receita Mensal (${selectedYear})`}>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis fontSize={12} tickFormatter={(value: any) => `R$${Number(value) / 1000}k`} />
                            <Tooltip formatter={(value: number) => [formatCurrency(value), 'Receita']} cursor={{fill: 'rgba(118, 75, 162, 0.1)'}}/>
                            <Bar dataKey="Receita" fill="#764ba2" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartSection>
                
                <ChartSection title="📈 Insights de Comunicação & Eventos">
                    <button onClick={handleGenerateInsights} disabled={isLoadingInsights || yearFreelas.length < 3} className="mb-4 w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold py-2 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition">
                        {isLoadingInsights ? 'Analisando dados...' : (yearFreelas.length < 3 ? 'Adicione mais dados para insights' : 'Gerar Insights Estratégicos')}
                    </button>
                    {isLoadingInsights && <div className="text-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto"></div></div>}
                     {insights && <div className="prose prose-sm max-w-none p-4 bg-gray-100 rounded-lg border" dangerouslySetInnerHTML={{ __html: insights.replace(/\n/g, '<br />') }}></div>}
                </ChartSection>

            </div>
        </BaseModal>
    );
};

const KpiCard: React.FC<{ title: string; value: string; subtitle: string; color: string; isMonth?: boolean }> = ({ title, value, subtitle, color, isMonth }) => (
    <div className={`bg-gradient-to-br ${color} text-white p-3 rounded-xl shadow-lg`}>
        <div className="text-xs font-semibold uppercase mb-1">{title}</div>
        <div className={`font-bold ${isMonth ? 'text-lg' : 'text-xl'}`}>{value}</div>
        <div className="text-xs mt-1 opacity-90">{subtitle}</div>
    </div>
);

const SecondaryKpiCard: React.FC<{ title: string; value: string; subtitle: string; }> = ({ title, value, subtitle }) => (
     <div className="bg-white border-2 border-gray-200 p-3 rounded-xl text-center">
       <div className="text-xs font-semibold text-gray-600 uppercase mb-1">{title}</div>
       <div className="text-lg font-bold text-gray-900">{value}</div>
       <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      </div>
);

const ChartSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm">
        <h4 className="text-base font-bold text-gray-900 mb-4">{title}</h4>
        {children}
    </div>
);

const DataList: React.FC<{data: {name: string, count: number}[], total: number}> = ({data, total}) => (
    <div className="space-y-2">
        {data.length > 0 ? data.map((item, index) => {
            const percentage = total > 0 ? (item.count / total * 100) : 0;
            return (
                <div key={item.name}>
                    <div className="flex justify-between items-center mb-1 text-xs">
                        <span className="font-medium text-gray-700 capitalize">{item.name}</span>
                        <span className="font-semibold text-gray-800">{item.count} ({percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${percentage}%`, backgroundColor: '#667eea' }}></div>
                    </div>
                </div>
            );
        }) : <p className="text-center text-gray-400 py-4">Sem dados</p>}
    </div>
);

const RankedList: React.FC<{data: {name: string, count: number, value?: number}[], showValue?: boolean}> = ({data, showValue}) => (
    <div className="space-y-3">
        {data.length > 0 ? data.map((item, index) => (
             <div key={item.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{index + 1}</div>
                    <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate" title={item.name}>{item.name}</div>
                        {showValue && <div className="text-xs text-gray-500">{formatCurrency(item.value || 0)}</div>}
                    </div>
                </div>
                <span className="text-sm font-bold text-purple-600 ml-2">{item.count}x</span>
            </div>
        )) : <p className="text-center text-gray-400 py-4">Sem dados</p>}
    </div>
);

export default DashboardModal;