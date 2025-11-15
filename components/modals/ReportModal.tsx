import React, { useState, useMemo } from 'react';
import { Freela, Categoria, TipoServico } from '../../types';
import BaseModal from './BaseModal';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    freelas: Freela[];
    currentDate: Date;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, freelas, currentDate }) => {
    const [filters, setFilters] = useState({ status: '', categoria: '', tipo: '', mei: '' });

    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
    const year = currentDate.getFullYear();
    const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const filteredFreelas = useMemo(() => {
        return freelas.filter(f => {
            const freelaDate = new Date(f.data_evento + 'T00:00:00');
            return freelaDate.getFullYear() === year && freelaDate.getMonth() === currentDate.getMonth()
                && (!filters.status || f.status === filters.status)
                && (!filters.categoria || f.categoria === filters.categoria)
                && (!filters.tipo || f.tipo_servico === filters.tipo)
                && (filters.mei === '' || (filters.mei === 'true' ? f.declara_mei : !f.declara_mei));
        }).sort((a,b) => a.data_evento.localeCompare(b.data_evento));
    }, [freelas, currentDate, year, filters]);

    const stats = useMemo(() => {
        const total = filteredFreelas.reduce((sum, f) => sum + f.valor, 0);
        const paid = filteredFreelas.filter(f => f.status === 'pago').reduce((sum, f) => sum + f.valor, 0);
        const pending = total - paid;
        const mei = filteredFreelas.filter(f => f.declara_mei).reduce((sum, f) => sum + f.valor, 0);
        return { total, paid, pending, mei };
    }, [filteredFreelas]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleExport = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Relatório</title>');
            printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
            printWindow.document.write('<style>body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }</style>');
            printWindow.document.write('</head><body class="p-8 font-sans">');
            printWindow.document.write(`<h1 class="text-3xl font-bold mb-2">Relatório de Freelas - ${formattedMonth} ${year}</h1>`);
            printWindow.document.write(`<p class="mb-6 text-gray-600">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>`);
            
            const freelaListContent = document.getElementById('freela-list-container-for-print')?.innerHTML || '';
            printWindow.document.write(freelaListContent);

            printWindow.document.write('</body></html>');
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }
    };
    
    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);


    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={`Relatório - ${formattedMonth} ${year}`} titleIcon="📊">
            <div className="p-4 sm:p-6 space-y-4">
                <div className="flex justify-end">
                    <button onClick={handleExport} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center gap-2">
                         <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                        Exportar Relatório
                    </button>
                </div>
                
                <div>
                    <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 print:hidden">
                        <h4 className="text-sm font-bold text-gray-900 mb-3">🔍 Filtros</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FilterSelect name="status" value={filters.status} onChange={handleFilterChange} label="Status" options={{'': 'Todos', 'pago': 'Pago', 'pendente': 'Pendente', 'atrasada': 'Atrasado'}} />
                            <FilterSelect name="categoria" value={filters.categoria} onChange={handleFilterChange} label="Categoria" options={{'': 'Todas', ...Object.fromEntries(Object.values(Categoria).map(v => [v,v.replace('_',' ')]))}} />
                            <FilterSelect name="tipo" value={filters.tipo} onChange={handleFilterChange} label="Tipo de Serviço" options={{'': 'Todos', ...Object.fromEntries(Object.values(TipoServico).map(v => [v, v.replace('_', ' ')]))}} />
                            <FilterSelect name="mei" value={filters.mei} onChange={handleFilterChange} label="MEI" options={{'': 'Todos', 'true': 'Declarado', 'false': 'Não Declarado'}} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <StatCard label="Total" value={formatCurrency(stats.total)} count={filteredFreelas.length} color="from-green-400 to-green-600" />
                        <StatCard label="Pago" value={formatCurrency(stats.paid)} count={filteredFreelas.filter(f=>f.status === 'pago').length} color="from-blue-400 to-blue-600" />
                        <StatCard label="Pendente" value={formatCurrency(stats.pending)} count={filteredFreelas.filter(f=>f.status !== 'pago').length} color="from-yellow-400 to-yellow-600" />
                        <StatCard label="MEI" value={formatCurrency(stats.mei)} count={filteredFreelas.filter(f=>f.declara_mei).length} color="from-cyan-400 to-cyan-600" />
                    </div>

                    <div className="mt-6 bg-white border-2 border-gray-200 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-gray-900 mb-4">📋 Lista de Freelas</h4>
                        <div id="freela-list-container-for-print">
                            {filteredFreelas.length > 0 ? (
                            <div className="space-y-3">
                                {filteredFreelas.map(f => <ReportFreelaCard key={f.id} freela={f} />)}
                            </div>
                            ) : (
                            <p className="text-center py-8 text-gray-500">Nenhum freela encontrado com os filtros aplicados.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </BaseModal>
    );
};

const FilterSelect: React.FC<{name: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, label: string, options: Record<string,string>}> = ({name, value, onChange, label, options}) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
        <select name={name} value={value} onChange={onChange} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm capitalize">
            {Object.entries(options).map(([val, text]) => <option key={val} value={val} className="capitalize">{text}</option>)}
        </select>
    </div>
);

const StatCard: React.FC<{label: string, value: string, count: number, color: string}> = ({label, value, count, color}) => (
    <div className={`bg-gradient-to-br ${color} text-white p-4 rounded-xl shadow-lg`}>
        <div className="text-xs font-semibold uppercase mb-1">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs mt-1 opacity-90">{count} freela{count !== 1 ? 's' : ''}</div>
    </div>
);

const ReportFreelaCard: React.FC<{freela: Freela}> = ({freela}) => {
    const statusInfo: Record<string, {border: string, badge: string, text: string}> = { 
        pago: { border: 'border-l-green-500', badge: 'bg-green-100 text-green-800', text: 'Pago' }, 
        pendente: { border: 'border-l-yellow-400', badge: 'bg-yellow-100 text-yellow-800', text: 'Pendente' }, 
        atrasada: { border: 'border-l-red-500', badge: 'bg-red-100 text-red-800', text: 'Atrasado' } 
    };
    const info = statusInfo[freela.status] || statusInfo.pendente;
    const date = new Date(freela.data_evento + 'T00:00:00');

    return (
        <div className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${info.border} flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4`}>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate" title={freela.descricao}>{freela.descricao}</p>
                <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                    <span className={`px-2 py-0.5 font-semibold rounded-full capitalize ${info.badge}`}>
                        {info.text}
                    </span>
                    <span className="text-gray-500 capitalize">• {freela.categoria.replace(/_/g,' ')}</span>
                    <span className="text-gray-500">• {date.toLocaleDateString('pt-BR')}</span>
                    {freela.contratante && <span className="text-gray-500 hidden md:inline">• {freela.contratante}</span>}
                </div>
            </div>
            <div className="flex-shrink-0 text-left sm:text-right mt-2 sm:mt-0">
                <p className="font-bold text-lg text-gray-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(freela.valor)}</p>
                {freela.declara_mei && (
                    <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        MEI
                    </span>
                )}
            </div>
        </div>
    );
};

export default ReportModal;