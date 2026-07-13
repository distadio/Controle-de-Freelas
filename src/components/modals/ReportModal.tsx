import React, { useState, useMemo, useEffect } from 'react';
import { Freela, Categoria, TipoServico } from '../../types';
import BaseModal from './BaseModal';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    freelas: Freela[];
    currentDate: Date;
}

type Scope = 'mes' | 'trimestre' | 'ano' | 'tudo';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const monthShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const monthLong = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const CategoriaInfo: Record<string, { icon: string; label: string }> = {
    'som': { icon: '🔊', label: 'Som' }, 'iluminacao': { icon: '💡', label: 'Iluminação' }, 'video': { icon: '📹', label: 'Vídeo' },
    'producao': { icon: '🎬', label: 'Produção' }, 'performance': { icon: '🎭', label: 'Performance' }, 'bombeiro_civil': { icon: '⛑️', label: 'Bombeiro Civil' },
    'seguranca_patrimonial': { icon: '🛡️', label: 'Segurança' }, 'fotografia': { icon: '📸', label: 'Fotografia' }, 'videomaker': { icon: '🎥', label: 'VideoMaker' },
    'edicao_audiovisual': { icon: '✂️', label: 'Ed. Audiovisual' }, 'mixagem_masterizacao': { icon: '🎚️', label: 'Mix/Master' }, 'garcom': { icon: '🤵', label: 'Garçom' }, 'outro': { icon: '⚙️', label: 'Outro' }
};

const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const getPeriodRange = (anchor: Date, scope: Scope): { start: string; end: string } | null => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    if (scope === 'tudo') return null;
    if (scope === 'mes') return { start: fmtDate(new Date(y, m, 1)), end: fmtDate(new Date(y, m + 1, 0)) };
    if (scope === 'trimestre') return { start: fmtDate(new Date(y, m - 2, 1)), end: fmtDate(new Date(y, m + 1, 0)) };
    return { start: fmtDate(new Date(y, 0, 1)), end: fmtDate(new Date(y, 11, 31)) };
};

const getPeriodLabel = (anchor: Date, scope: Scope): string => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    if (scope === 'tudo') return 'Todo o período';
    if (scope === 'mes') return `${monthLong[m]} ${y}`;
    if (scope === 'ano') return `${y}`;
    const startDate = new Date(y, m - 2, 1);
    const sameYear = startDate.getFullYear() === y;
    return sameYear
        ? `${monthShort[startDate.getMonth()]} – ${monthShort[m]} ${y}`
        : `${monthShort[startDate.getMonth()]} ${startDate.getFullYear()} – ${monthShort[m]} ${y}`;
};

const shiftAnchor = (anchor: Date, scope: Scope, direction: 1 | -1): Date => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    if (scope === 'mes') return new Date(y, m + direction, 1);
    if (scope === 'trimestre') return new Date(y, m + direction * 3, 1);
    return new Date(y + direction, m, 1);
};

const getCategoriaDisplay = (freela: Freela): { icon: string; label: string } => {
    if (freela.categoria === 'outro' && freela.categoria_customizada) {
        return { icon: CategoriaInfo['outro'].icon, label: freela.categoria_customizada };
    }
    return CategoriaInfo[freela.categoria] || CategoriaInfo['outro'];
};

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, freelas, currentDate }) => {
    const [scope, setScope] = useState<Scope>('mes');
    const [anchor, setAnchor] = useState<Date>(currentDate);
    const [filters, setFilters] = useState({ status: '', categoria: '', tipo: '', mei: '' });
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setAnchor(currentDate);
            setScope('mes');
            setFilters({ status: '', categoria: '', tipo: '', mei: '' });
            setShowFilters(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const periodLabel = getPeriodLabel(anchor, scope);
    const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

    const applyFilters = (list: Freela[]) => list.filter(f =>
        (!filters.status || f.status === filters.status)
        && (!filters.categoria || f.categoria === filters.categoria)
        && (!filters.tipo || f.tipo_servico === filters.tipo)
        && (filters.mei === '' || (filters.mei === 'true' ? f.declara_mei : !f.declara_mei))
    );

    const inRange = (list: Freela[], range: { start: string; end: string } | null) =>
        range ? list.filter(f => f.data_evento >= range.start && f.data_evento <= range.end) : list;

    const { filteredFreelas, stats, prevStats, categorias, contratantes } = useMemo(() => {
        const range = getPeriodRange(anchor, scope);
        const filteredFreelas = applyFilters(inRange(freelas, range))
            .sort((a, b) => a.data_evento.localeCompare(b.data_evento));

        const calcStats = (list: Freela[]) => {
            const total = list.reduce((s, f) => s + f.valor, 0);
            const paid = list.filter(f => f.status === 'pago').reduce((s, f) => s + f.valor, 0);
            const late = list.filter(f => f.status === 'atrasada').reduce((s, f) => s + f.valor, 0);
            const mei = list.filter(f => f.declara_mei).reduce((s, f) => s + f.valor, 0);
            return {
                total, paid, late, mei,
                receivable: total - paid,
                count: list.length,
                paidCount: list.filter(f => f.status === 'pago').length,
                lateCount: list.filter(f => f.status === 'atrasada').length,
                pendingCount: list.filter(f => f.status !== 'pago').length,
                meiCount: list.filter(f => f.declara_mei).length,
                avg: list.length > 0 ? total / list.length : 0,
                paidPercent: total > 0 ? Math.round((paid / total) * 100) : 0,
            };
        };

        const stats = calcStats(filteredFreelas);

        let prevStats: ReturnType<typeof calcStats> | null = null;
        if (scope !== 'tudo') {
            const prevRange = getPeriodRange(shiftAnchor(anchor, scope, -1), scope);
            prevStats = calcStats(applyFilters(inRange(freelas, prevRange)));
        }

        const catMap: Record<string, { icon: string; label: string; total: number; count: number }> = {};
        filteredFreelas.forEach(f => {
            const { icon, label } = getCategoriaDisplay(f);
            const key = label;
            if (!catMap[key]) catMap[key] = { icon, label, total: 0, count: 0 };
            catMap[key].total += f.valor;
            catMap[key].count += 1;
        });
        const categorias = Object.values(catMap).sort((a, b) => b.total - a.total);

        const cliMap: Record<string, { total: number; count: number }> = {};
        filteredFreelas.forEach(f => {
            const key = f.contratante?.trim() || 'Sem contratante';
            if (!cliMap[key]) cliMap[key] = { total: 0, count: 0 };
            cliMap[key].total += f.valor;
            cliMap[key].count += 1;
        });
        const contratantes = Object.entries(cliMap)
            .map(([name, v]) => ({ name, ...v }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        return { filteredFreelas, stats, prevStats, categorias, contratantes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [freelas, anchor, scope, filters]);

    const deltaPercent = prevStats && prevStats.total > 0
        ? Math.round(((stats.total - prevStats.total) / prevStats.total) * 100)
        : null;

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // ---------- Export: CSV (Excel pt-BR: separador ; e decimal ,) ----------
    const csvNumber = (v: number) => v.toFixed(2).replace('.', ',');

    const handleExportCsv = () => {
        const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
        const rows: string[][] = [
            ['Data', 'Descrição', 'Categoria', 'Tipo de Serviço', 'Contratante', 'Local', 'Status', 'MEI', 'Valor (R$)'],
            ...filteredFreelas.map(f => [
                new Date(f.data_evento + 'T00:00:00').toLocaleDateString('pt-BR'),
                esc(f.descricao),
                esc(getCategoriaDisplay(f).label),
                esc(f.tipo_servico.replace(/_/g, ' ')),
                esc(f.contratante || ''),
                esc(f.local || ''),
                f.status === 'pago' ? 'Pago' : f.status === 'atrasada' ? 'Atrasado' : 'Pendente',
                f.declara_mei ? 'Sim' : 'Não',
                csvNumber(f.valor),
            ]),
            [],
            [`TOTAL ACUMULADO (${stats.count} freelas)`, '', '', '', '', '', '', '', csvNumber(stats.total)],
            ['Recebido', '', '', '', '', '', '', '', csvNumber(stats.paid)],
            ['A Receber', '', '', '', '', '', '', '', csvNumber(stats.receivable)],
            ['Atrasado', '', '', '', '', '', '', '', csvNumber(stats.late)],
            ['MEI Declarado', '', '', '', '', '', '', '', csvNumber(stats.mei)],
            ['Ticket Médio', '', '', '', '', '', '', '', csvNumber(stats.avg)],
        ];
        const csv = '\uFEFF' + rows.map(r => r.join(';')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio-freelas-${periodLabel.replace(/[\s–]+/g, '-').toLowerCase()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    // ---------- Export: PDF / Impressão (via iframe, sem popup) ----------
    const handleExportPdf = () => {
        const statusLabel: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', atrasada: 'Atrasado' };
        const rowsHtml = filteredFreelas.map(f => `
            <tr>
                <td>${new Date(f.data_evento + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${f.descricao}</td>
                <td>${getCategoriaDisplay(f).label}</td>
                <td>${f.contratante || '-'}</td>
                <td class="st-${f.status}">${statusLabel[f.status] || f.status}</td>
                <td>${f.declara_mei ? 'Sim' : '-'}</td>
                <td class="num">${formatCurrency(f.valor)}</td>
            </tr>`).join('');

        const catsHtml = categorias.map(c => `
            <tr><td>${c.icon} ${c.label}</td><td>${c.count}</td><td class="num">${formatCurrency(c.total)}</td></tr>`).join('');

        const clisHtml = contratantes.map(c => `
            <tr><td>${c.name}</td><td>${c.count}</td><td class="num">${formatCurrency(c.total)}</td></tr>`).join('');

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Freelas - ${periodLabel}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1f2937; font-size: 12px; }
    h1 { font-size: 20px; margin-bottom: 2px; }
    .sub { color: #6b7280; margin-bottom: 16px; }
    h2 { font-size: 14px; margin: 18px 0 6px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
    .kpis { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; min-width: 130px; }
    .kpi .l { font-size: 10px; text-transform: uppercase; color: #6b7280; }
    .kpi .v { font-size: 15px; font-weight: 700; }
    .kpi.hl { background: #ecfdf5; border-color: #6ee7b7; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { text-align: left; font-size: 10px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; padding: 4px 6px; }
    td { padding: 5px 6px; border-bottom: 1px solid #f3f4f6; }
    .num { text-align: right; white-space: nowrap; font-weight: 600; }
    th.num-h { text-align: right; }
    .st-pago { color: #059669; font-weight: 600; }
    .st-pendente { color: #d97706; font-weight: 600; }
    .st-atrasada { color: #dc2626; font-weight: 600; }
    tfoot td { border-top: 2px solid #1f2937; font-weight: 700; font-size: 13px; }
    @media print { body { padding: 8px; } }
</style></head><body>
    <h1>Relatório de Freelas — ${periodLabel}</h1>
    <div class="sub">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${activeFilterCount > 0 ? ' • Filtros aplicados' : ''}</div>

    <h2>Resumo do Período</h2>
    <div class="kpis">
        <div class="kpi hl"><div class="l">Total Acumulado</div><div class="v">${formatCurrency(stats.total)}</div><div class="l">${stats.count} freela${stats.count !== 1 ? 's' : ''}</div></div>
        <div class="kpi"><div class="l">Recebido</div><div class="v">${formatCurrency(stats.paid)}</div><div class="l">${stats.paidCount} pago${stats.paidCount !== 1 ? 's' : ''} (${stats.paidPercent}%)</div></div>
        <div class="kpi"><div class="l">A Receber</div><div class="v">${formatCurrency(stats.receivable)}</div><div class="l">${stats.pendingCount} pendente${stats.pendingCount !== 1 ? 's' : ''}</div></div>
        <div class="kpi"><div class="l">Atrasado</div><div class="v">${formatCurrency(stats.late)}</div><div class="l">${stats.lateCount} freela${stats.lateCount !== 1 ? 's' : ''}</div></div>
        <div class="kpi"><div class="l">MEI Declarado</div><div class="v">${formatCurrency(stats.mei)}</div><div class="l">${stats.meiCount} freela${stats.meiCount !== 1 ? 's' : ''}</div></div>
        <div class="kpi"><div class="l">Ticket Médio</div><div class="v">${formatCurrency(stats.avg)}</div></div>
    </div>

    ${categorias.length > 0 ? `<h2>Por Categoria</h2>
    <table><thead><tr><th>Categoria</th><th>Freelas</th><th class="num-h">Valor</th></tr></thead><tbody>${catsHtml}</tbody></table>` : ''}

    ${contratantes.length > 0 ? `<h2>Por Contratante (Top 5)</h2>
    <table><thead><tr><th>Contratante</th><th>Freelas</th><th class="num-h">Valor</th></tr></thead><tbody>${clisHtml}</tbody></table>` : ''}

    <h2>Lista de Freelas</h2>
    <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Contratante</th><th>Status</th><th>MEI</th><th class="num-h">Valor</th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="7">Nenhum freela no período.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="6">TOTAL ACUMULADO — ${stats.count} freela${stats.count !== 1 ? 's' : ''}</td><td class="num">${formatCurrency(stats.total)}</td></tr></tfoot>
    </table>
</body></html>`;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
        document.body.appendChild(iframe);
        iframe.onload = () => {
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                setTimeout(() => document.body.removeChild(iframe), 60000);
            }, 200);
        };
        iframe.srcdoc = html;
    };

    const scopes: { id: Scope; label: string }[] = [
        { id: 'mes', label: 'Mês' },
        { id: 'trimestre', label: '3 Meses' },
        { id: 'ano', label: 'Ano' },
        { id: 'tudo', label: 'Tudo' },
    ];

    const maxCat = categorias.length > 0 ? categorias[0].total : 0;
    const maxCli = contratantes.length > 0 ? contratantes[0].total : 0;

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Relatório & Gestão" titleIcon="📊" maxWidth="sm:max-w-xl" applyPhoneAspectRatio={false}>
            <div className="p-4 space-y-4 bg-gray-50">

                {/* Seletor de período */}
                <div className="bg-white rounded-xl shadow-sm p-2 space-y-2">
                    <div className="grid grid-cols-4 gap-1">
                        {scopes.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setScope(s.id)}
                                className={`py-2 rounded-lg text-xs font-bold transition-colors ${scope === s.id ? 'bg-purple-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                    {scope !== 'tudo' && (
                        <div className="flex items-center justify-between">
                            <button onClick={() => setAnchor(a => shiftAnchor(a, scope, -1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Período anterior">
                                <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                            </button>
                            <span className="font-bold text-gray-800 text-sm">{periodLabel}</span>
                            <button onClick={() => setAnchor(a => shiftAnchor(a, scope, 1))} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600" aria-label="Próximo período">
                                <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    )}
                </div>

                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 bg-gradient-to-br from-emerald-500 to-green-600 text-white p-4 rounded-xl shadow-lg">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-xs font-semibold uppercase opacity-90">Total Acumulado</div>
                                <div className="text-3xl font-black mt-1">{formatCurrency(stats.total)}</div>
                                <div className="text-xs mt-1 opacity-90">{stats.count} freela{stats.count !== 1 ? 's' : ''} no período</div>
                            </div>
                            {deltaPercent !== null && (
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${deltaPercent >= 0 ? 'bg-white/25' : 'bg-black/20'}`}>
                                    {deltaPercent >= 0 ? '▲' : '▼'} {Math.abs(deltaPercent)}% vs anterior
                                </span>
                            )}
                        </div>
                        <div className="mt-3">
                            <div className="flex justify-between text-[11px] font-semibold mb-1 opacity-90">
                                <span>Recebido: {formatCurrency(stats.paid)}</span>
                                <span>{stats.paidPercent}%</span>
                            </div>
                            <div className="h-2 bg-black/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${stats.paidPercent}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <MiniKpi label="A Receber" value={formatCurrency(stats.receivable)} sub={`${stats.pendingCount} pendente${stats.pendingCount !== 1 ? 's' : ''}`} color="from-yellow-400 to-amber-500" />
                    <MiniKpi label="Atrasado" value={formatCurrency(stats.late)} sub={`${stats.lateCount} freela${stats.lateCount !== 1 ? 's' : ''}`} color="from-red-400 to-rose-500" />
                    <MiniKpi label="MEI Declarado" value={formatCurrency(stats.mei)} sub={`${stats.meiCount} freela${stats.meiCount !== 1 ? 's' : ''}`} color="from-cyan-400 to-sky-500" />
                    <MiniKpi label="Ticket Médio" value={formatCurrency(stats.avg)} sub="por freela" color="from-violet-400 to-purple-500" />
                </div>

                {/* Exportação */}
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleExportCsv} className="bg-green-700 text-white py-3 rounded-xl hover:bg-green-800 transition font-semibold text-sm flex items-center justify-center gap-2 shadow">
                        <span>📊</span> Exportar Excel
                    </button>
                    <button onClick={handleExportPdf} className="bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-semibold text-sm flex items-center justify-center gap-2 shadow">
                        <span>📄</span> Exportar PDF
                    </button>
                </div>

                {/* Filtros */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <button onClick={() => setShowFilters(v => !v)} className="w-full flex items-center justify-between p-3 text-sm font-bold text-gray-800">
                        <span className="flex items-center gap-2">
                            🔍 Filtros
                            {activeFilterCount > 0 && <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full">{activeFilterCount}</span>}
                        </span>
                        <span className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {showFilters && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 pt-0">
                            <FilterSelect name="status" value={filters.status} onChange={handleFilterChange} label="Status" options={{ '': 'Todos', 'pago': 'Pago', 'pendente': 'Pendente', 'atrasada': 'Atrasado' }} />
                            <FilterSelect name="categoria" value={filters.categoria} onChange={handleFilterChange} label="Categoria" options={{ '': 'Todas', ...Object.fromEntries(Object.values(Categoria).map(v => [v, v.replace(/_/g, ' ')])) }} />
                            <FilterSelect name="tipo" value={filters.tipo} onChange={handleFilterChange} label="Tipo de Serviço" options={{ '': 'Todos', ...Object.fromEntries(Object.values(TipoServico).map(v => [v, v.replace(/_/g, ' ')])) }} />
                            <FilterSelect name="mei" value={filters.mei} onChange={handleFilterChange} label="MEI" options={{ '': 'Todos', 'true': 'Declarado', 'false': 'Não Declarado' }} />
                        </div>
                    )}
                </div>

                {/* Por Categoria */}
                {categorias.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-4">
                        <h4 className="text-sm font-bold text-gray-900 mb-3">🏷️ Por Categoria</h4>
                        <div className="space-y-3">
                            {categorias.map(c => (
                                <BreakdownRow key={c.label} icon={c.icon} label={c.label} count={c.count} total={c.total} max={maxCat} barColor="bg-purple-500" />
                            ))}
                        </div>
                    </div>
                )}

                {/* Por Contratante */}
                {contratantes.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-4">
                        <h4 className="text-sm font-bold text-gray-900 mb-3">👥 Por Contratante (Top 5)</h4>
                        <div className="space-y-3">
                            {contratantes.map(c => (
                                <BreakdownRow key={c.name} label={c.name} count={c.count} total={c.total} max={maxCli} barColor="bg-sky-500" />
                            ))}
                        </div>
                    </div>
                )}

                {/* Lista */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-gray-900">📋 Lista de Freelas</h4>
                        <span className="text-xs text-gray-500 font-medium">{filteredFreelas.length} freela{filteredFreelas.length !== 1 ? 's' : ''}</span>
                    </div>
                    {filteredFreelas.length > 0 ? (
                        <div className="space-y-3">
                            {filteredFreelas.map(f => <ReportFreelaCard key={f.id} freela={f} />)}
                        </div>
                    ) : (
                        <p className="text-center py-8 text-gray-500 text-sm">Nenhum freela encontrado no período com os filtros aplicados.</p>
                    )}
                    {filteredFreelas.length > 0 && (
                        <div className="mt-4 pt-3 border-t-2 border-gray-200 flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-700">Total acumulado ({stats.count})</span>
                            <span className="text-lg font-black text-gray-900">{formatCurrency(stats.total)}</span>
                        </div>
                    )}
                </div>
            </div>
        </BaseModal>
    );
};

const MiniKpi: React.FC<{ label: string; value: string; sub: string; color: string }> = ({ label, value, sub, color }) => (
    <div className={`bg-gradient-to-br ${color} text-white p-3 rounded-xl shadow`}>
        <div className="text-[10px] font-semibold uppercase opacity-90">{label}</div>
        <div className="text-lg font-bold mt-0.5 truncate">{value}</div>
        <div className="text-[10px] mt-0.5 opacity-90">{sub}</div>
    </div>
);

const BreakdownRow: React.FC<{ icon?: string; label: string; count: number; total: number; max: number; barColor: string }> = ({ icon, label, count, total, max, barColor }) => (
    <div>
        <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-semibold text-gray-800 truncate pr-2">{icon ? `${icon} ` : ''}{label} <span className="text-gray-400 font-normal">({count})</span></span>
            <span className="font-bold text-gray-900 whitespace-nowrap">{formatCurrency(total)}</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${max > 0 ? Math.max(4, Math.round((total / max) * 100)) : 0}%` }}></div>
        </div>
    </div>
);

const FilterSelect: React.FC<{ name: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, label: string, options: Record<string, string> }> = ({ name, value, onChange, label, options }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
        <select name={name} value={value} onChange={onChange} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm capitalize">
            {Object.entries(options).map(([val, text]) => <option key={val} value={val} className="capitalize">{text}</option>)}
        </select>
    </div>
);

const ReportFreelaCard: React.FC<{ freela: Freela }> = ({ freela }) => {
    const statusInfo: Record<string, { border: string, badge: string, text: string }> = {
        pago: { border: 'border-l-green-500', badge: 'bg-green-100 text-green-800', text: 'Pago' },
        pendente: { border: 'border-l-yellow-400', badge: 'bg-yellow-100 text-yellow-800', text: 'Pendente' },
        atrasada: { border: 'border-l-red-500', badge: 'bg-red-100 text-red-800', text: 'Atrasado' }
    };
    const info = statusInfo[freela.status] || statusInfo.pendente;
    const date = new Date(freela.data_evento + 'T00:00:00');

    return (
        <div className={`bg-white rounded-lg p-3 shadow-sm border border-gray-100 border-l-4 ${info.border} flex items-start justify-between gap-3`}>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate text-sm" title={freela.descricao}>{freela.descricao}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                    <span className={`px-2 py-0.5 font-semibold rounded-full capitalize ${info.badge}`}>{info.text}</span>
                    <span className="text-gray-500">{date.toLocaleDateString('pt-BR')}</span>
                    {freela.contratante && <span className="text-gray-500 truncate max-w-[110px]">• {freela.contratante}</span>}
                </div>
            </div>
            <div className="flex-shrink-0 text-right">
                <p className="font-bold text-gray-900">{formatCurrency(freela.valor)}</p>
                {freela.declara_mei && (
                    <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">MEI</span>
                )}
            </div>
        </div>
    );
};

export default ReportModal;
