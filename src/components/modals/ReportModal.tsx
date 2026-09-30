import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Freela, Categoria, TipoServico } from '../../types';
import BaseModal from './BaseModal';
import InvoiceModal from './InvoiceModal';
import { normalizeName, nameKey } from '../../services/textService';
import { periodoFreelaTexto } from '../../services/bloqueioService';
import { repasseSub } from '../../services/subService';

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    freelas: Freela[];
    currentDate: Date;
}

type Scope = 'mes' | 'trimestre' | 'ano' | 'tudo' | 'datas';

interface Filtros {
    contratante: string;
    tipo: string;
    categoria: string;
    status: string;
    local: string;
    mei: string;
    sub: string; // '' | SUB_EU | SUB_QUALQUER | nome do sub
    busca: string;
}

const FILTROS_VAZIOS: Filtros = { contratante: '', tipo: '', categoria: '', status: '', local: '', mei: '', sub: '', busca: '' };

const SUB_EU = '__eu';
const SUB_QUALQUER = '__sub';

const STATUS_LABEL: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', atrasada: 'Atrasado' };
const rotuloEnum = (v: string) => v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

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

const getPeriodRange = (anchor: Date, scope: Scope, datas?: { de: string; ate: string }): { start: string; end: string } | null => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    if (scope === 'tudo') return null;
    if (scope === 'datas') {
        if (!datas || (!datas.de && !datas.ate)) return null;
        return { start: datas.de || '0000-01-01', end: datas.ate || '9999-12-31' };
    }
    if (scope === 'mes') return { start: fmtDate(new Date(y, m, 1)), end: fmtDate(new Date(y, m + 1, 0)) };
    if (scope === 'trimestre') return { start: fmtDate(new Date(y, m - 2, 1)), end: fmtDate(new Date(y, m + 1, 0)) };
    return { start: fmtDate(new Date(y, 0, 1)), end: fmtDate(new Date(y, 11, 31)) };
};

const dataBR = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

const getPeriodLabel = (anchor: Date, scope: Scope, datas?: { de: string; ate: string }): string => {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    if (scope === 'tudo') return 'Todo o período';
    if (scope === 'datas') {
        if (datas?.de && datas?.ate) return `${dataBR(datas.de)} a ${dataBR(datas.ate)}`;
        if (datas?.de) return `A partir de ${dataBR(datas.de)}`;
        if (datas?.ate) return `Até ${dataBR(datas.ate)}`;
        return 'Todo o período';
    }
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
    const [filters, setFilters] = useState<Filtros>(FILTROS_VAZIOS);
    const [showFilters, setShowFilters] = useState(false);
    const [datas, setDatas] = useState({ de: '', ate: '' });
    const [showInvoice, setShowInvoice] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setAnchor(currentDate);
            setScope('mes');
            setFilters(FILTROS_VAZIOS);
            setDatas({ de: '', ate: '' });
            setShowFilters(false);
            setShowInvoice(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const periodLabel = getPeriodLabel(anchor, scope, datas);
    const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

    // Opções de contratante e local vindas dos próprios freelas (nomes normalizados, sem duplicatas)
    const { opcoesContratante, opcoesLocal, opcoesSub } = useMemo(() => {
        const unicos = (valores: (string | null | undefined)[]) => {
            const mapa = new Map<string, string>();
            valores.forEach(v => { const k = nameKey(v); if (k && !mapa.has(k)) mapa.set(k, normalizeName(v)); });
            return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        };
        return {
            opcoesContratante: unicos(freelas.map(f => f.contratante)),
            opcoesLocal: unicos(freelas.map(f => f.local)),
            opcoesSub: unicos(freelas.map(f => f.sub?.nome)),
        };
    }, [freelas]);

    const applyFilters = (list: Freela[]) => {
        const busca = filters.busca.trim().toLocaleLowerCase('pt-BR');
        return list.filter(f =>
            (!filters.contratante || nameKey(f.contratante) === nameKey(filters.contratante))
            && (!filters.tipo || f.tipo_servico === filters.tipo)
            && (!filters.categoria || f.categoria === filters.categoria)
            && (!filters.status || f.status === filters.status)
            && (!filters.local || nameKey(f.local) === nameKey(filters.local))
            && (filters.mei === '' || (filters.mei === 'true' ? f.declara_mei : !f.declara_mei))
            && (!filters.sub || (filters.sub === SUB_EU ? !f.sub
                : filters.sub === SUB_QUALQUER ? !!f.sub
                : nameKey(f.sub?.nome) === nameKey(filters.sub)))
            && (!busca || `${f.descricao} ${f.observacoes || ''}`.toLocaleLowerCase('pt-BR').includes(busca))
        );
    };

    // Descrição legível dos filtros ativos (tela, PDF e Excel)
    const filtrosAtivos: { chave: keyof Filtros; texto: string }[] = [
        filters.contratante && { chave: 'contratante' as const, texto: `Contratante: ${filters.contratante}` },
        filters.tipo && { chave: 'tipo' as const, texto: `Tipo: ${rotuloEnum(filters.tipo)}` },
        filters.categoria && { chave: 'categoria' as const, texto: `Categoria: ${rotuloEnum(filters.categoria)}` },
        filters.status && { chave: 'status' as const, texto: `Status: ${STATUS_LABEL[filters.status]}` },
        filters.local && { chave: 'local' as const, texto: `Local: ${filters.local}` },
        filters.mei && { chave: 'mei' as const, texto: filters.mei === 'true' ? 'MEI declarado' : 'MEI não declarado' },
        filters.sub && { chave: 'sub' as const, texto: filters.sub === SUB_EU ? 'Feitos por mim' : filters.sub === SUB_QUALQUER ? 'Com sub' : `Sub: ${filters.sub}` },
        filters.busca.trim() && { chave: 'busca' as const, texto: `Busca: "${filters.busca.trim()}"` },
    ].filter(Boolean) as { chave: keyof Filtros; texto: string }[];
    const descricaoFiltros = filtrosAtivos.map(f => f.texto).join(' | ');

    const inRange = (list: Freela[], range: { start: string; end: string } | null) =>
        range ? list.filter(f => f.data_evento >= range.start && f.data_evento <= range.end) : list;

    const { filteredFreelas, stats, prevStats, categorias, contratantes, subsPorNome } = useMemo(() => {
        const range = getPeriodRange(anchor, scope, datas);
        const filteredFreelas = applyFilters(inRange(freelas, range))
            .sort((a, b) => a.data_evento.localeCompare(b.data_evento));

        const calcStats = (list: Freela[]) => {
            const total = list.reduce((s, f) => s + f.valor, 0);
            const paid = list.filter(f => f.status === 'pago').reduce((s, f) => s + f.valor, 0);
            const late = list.filter(f => f.status === 'atrasada').reduce((s, f) => s + f.valor, 0);
            const mei = list.filter(f => f.declara_mei).reduce((s, f) => s + f.valor, 0);
            const comSub = list.filter(f => f.sub);
            const subs = comSub.reduce((s, f) => s + repasseSub(f), 0);
            const subsPagar = comSub.filter(f => !f.sub!.pago).reduce((s, f) => s + repasseSub(f), 0);
            return {
                total, paid, late, mei,
                subs, subsPagar,
                subsCount: comSub.length,
                liquido: total - subs,
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
        if (scope !== 'tudo' && scope !== 'datas') {
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

        const cliMap = new Map<string, { name: string; total: number; count: number }>();
        filteredFreelas.forEach(f => {
            const key = nameKey(f.contratante) || 'sem contratante';
            const entry = cliMap.get(key) || { name: normalizeName(f.contratante) || 'Sem contratante', total: 0, count: 0 };
            entry.total += f.valor;
            entry.count += 1;
            cliMap.set(key, entry);
        });
        const contratantes = [...cliMap.values()]
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        const subMap = new Map<string, { name: string; total: number; count: number; aPagar: number }>();
        filteredFreelas.filter(f => f.sub).forEach(f => {
            const key = nameKey(f.sub!.nome);
            const entry = subMap.get(key) || { name: normalizeName(f.sub!.nome), total: 0, count: 0, aPagar: 0 };
            entry.total += repasseSub(f);
            entry.count += 1;
            if (!f.sub!.pago) entry.aPagar += repasseSub(f);
            subMap.set(key, entry);
        });
        const subsPorNome = [...subMap.values()].sort((a, b) => b.total - a.total);

        return { filteredFreelas, stats, prevStats, categorias, contratantes, subsPorNome };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [freelas, anchor, scope, filters, datas]);

    const deltaPercent = prevStats && prevStats.total > 0
        ? Math.round(((stats.total - prevStats.total) / prevStats.total) * 100)
        : null;

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const sufixoArquivo = [periodLabel, filters.contratante].filter(Boolean).join(' ')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // ---------- Export: CSV (Excel pt-BR: separador ; e decimal ,) ----------
    const csvNumber = (v: number) => v.toFixed(2).replace('.', ',');

    const handleExportCsv = () => {
        const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
        const rows: string[][] = [
            ['Data', 'Descrição', 'Categoria', 'Tipo de Serviço', 'Contratante', 'Local', 'Status', 'MEI', 'Valor (R$)', 'Sub', 'Repasse ao sub (R$)', 'Sub pago', 'Líquido (R$)'],
            ...filteredFreelas.map(f => [
                periodoFreelaTexto(f),
                esc(f.descricao),
                esc(getCategoriaDisplay(f).label),
                esc(f.tipo_servico.replace(/_/g, ' ')),
                esc(f.contratante || ''),
                esc(f.local || ''),
                f.status === 'pago' ? 'Pago' : f.status === 'atrasada' ? 'Atrasado' : 'Pendente',
                f.declara_mei ? 'Sim' : 'Não',
                csvNumber(f.valor),
                esc(f.sub?.nome || ''),
                f.sub ? csvNumber(repasseSub(f)) : '',
                f.sub ? (f.sub.pago ? 'Sim' : 'Não') : '',
                csvNumber(f.valor - repasseSub(f)),
            ]),
            [],
            [`TOTAL ACUMULADO (${stats.count} freelas)`, '', '', '', '', '', '', '', csvNumber(stats.total)],
            ['Recebido', '', '', '', '', '', '', '', csvNumber(stats.paid)],
            ['A Receber', '', '', '', '', '', '', '', csvNumber(stats.receivable)],
            ['Atrasado', '', '', '', '', '', '', '', csvNumber(stats.late)],
            ['MEI Declarado', '', '', '', '', '', '', '', csvNumber(stats.mei)],
            ['Ticket Médio', '', '', '', '', '', '', '', csvNumber(stats.avg)],
            ...(stats.subsCount > 0 ? [
                [`Gasto com subs (${stats.subsCount} freelas)`, '', '', '', '', '', '', '', csvNumber(stats.subs)],
                ['A pagar aos subs', '', '', '', '', '', '', '', csvNumber(stats.subsPagar)],
                ['Lucro líquido (total - subs)', '', '', '', '', '', '', '', csvNumber(stats.liquido)],
            ] : []),
            [],
            ['Período', esc(periodLabel)],
            ...(descricaoFiltros ? [['Filtros aplicados', esc(descricaoFiltros)]] : []),
        ];
        const csv = '\uFEFF' + rows.map(r => r.join(';')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio-freelas-${sufixoArquivo}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    // ---------- Export: PDF / Impressão (via iframe, sem popup) ----------
    const handleExportPdf = () => {
        const statusLabel: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', atrasada: 'Atrasado' };
        const temSubs = filteredFreelas.some(f => f.sub);
        const rowsHtml = filteredFreelas.map(f => `
            <tr>
                <td>${periodoFreelaTexto(f)}</td>
                <td>${f.descricao}${temSubs && f.sub ? `<div class="subl">Sub: ${f.sub.nome} &minus; ${formatCurrency(repasseSub(f))}${f.sub.pago ? ' (pago)' : ' (a pagar)'}</div>` : ''}</td>
                <td>${getCategoriaDisplay(f).label}</td>
                <td>${f.contratante || '-'}</td>
                <td class="st-${f.status}">${statusLabel[f.status] || f.status}</td>
                <td>${f.declara_mei ? 'Sim' : '-'}</td>
                <td class="num">${formatCurrency(f.valor)}</td>
            </tr>`).join('');

        const catsHtml = categorias.map(c => `
            <tr><td>${c.icon} ${c.label}</td><td>${c.count}</td><td class="num">${formatCurrency(c.total)}</td></tr>`).join('');

        const subsHtml = subsPorNome.map(c => `
            <tr><td>${c.name}</td><td>${c.count}</td><td class="num">${formatCurrency(c.aPagar)}</td><td class="num">${formatCurrency(c.total)}</td></tr>`).join('');

        const clisHtml = contratantes.map(c => `
            <tr><td>${c.name}</td><td>${c.count}</td><td class="num">${formatCurrency(c.total)}</td></tr>`).join('');

        const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>relatorio-freelas-${sufixoArquivo}</title>
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1f2937; font-size: 12px; }
    h1 { font-size: 20px; margin-bottom: 2px; }
    .sub { color: #6b7280; margin-bottom: 8px; }
    .filtros { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 6px; padding: 6px 10px; margin-bottom: 12px; color: #4c1d95; font-weight: 600; }
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
    .subl { font-size: 10px; color: #0f766e; font-weight: 600; margin-top: 2px; }
    .kpi.sub { background: #f0fdfa; border-color: #5eead4; }
    tfoot td { border-top: 2px solid #1f2937; font-weight: 700; font-size: 13px; }
    @media print { body { padding: 8px; } }
</style></head><body>
    <h1>Relatório de Freelas${filters.contratante ? ` — ${filters.contratante}` : ''} — ${periodLabel}</h1>
    <div class="sub">Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
    ${descricaoFiltros ? `<div class="filtros">Filtros: ${descricaoFiltros}</div>` : ''}

    <h2>Resumo do Período</h2>
    <div class="kpis">
        <div class="kpi hl"><div class="l">Total Acumulado</div><div class="v">${formatCurrency(stats.total)}</div><div class="l">${stats.count} freela${stats.count !== 1 ? 's' : ''}</div></div>
        <div class="kpi"><div class="l">Recebido</div><div class="v">${formatCurrency(stats.paid)}</div><div class="l">${stats.paidCount} pago${stats.paidCount !== 1 ? 's' : ''} (${stats.paidPercent}%)</div></div>
        <div class="kpi"><div class="l">A Receber</div><div class="v">${formatCurrency(stats.receivable)}</div><div class="l">${stats.pendingCount} pendente${stats.pendingCount !== 1 ? 's' : ''}</div></div>
        <div class="kpi"><div class="l">Atrasado</div><div class="v">${formatCurrency(stats.late)}</div><div class="l">${stats.lateCount} freela${stats.lateCount !== 1 ? 's' : ''}</div></div>
        <div class="kpi"><div class="l">MEI Declarado</div><div class="v">${formatCurrency(stats.mei)}</div><div class="l">${stats.meiCount} freela${stats.meiCount !== 1 ? 's' : ''}</div></div>
        <div class="kpi"><div class="l">Ticket Médio</div><div class="v">${formatCurrency(stats.avg)}</div></div>
        ${stats.subsCount > 0 ? `
        <div class="kpi sub"><div class="l">Gasto com Subs</div><div class="v">${formatCurrency(stats.subs)}</div><div class="l">${stats.subsCount} freela${stats.subsCount !== 1 ? 's' : ''} &bull; ${formatCurrency(stats.subsPagar)} a pagar</div></div>
        <div class="kpi hl"><div class="l">Lucro Líquido</div><div class="v">${formatCurrency(stats.liquido)}</div><div class="l">total &minus; subs</div></div>` : ''}
    </div>

    ${categorias.length > 0 ? `<h2>Por Categoria</h2>
    <table><thead><tr><th>Categoria</th><th>Freelas</th><th class="num-h">Valor</th></tr></thead><tbody>${catsHtml}</tbody></table>` : ''}

    ${subsPorNome.length > 0 ? `<h2>Repasses a Subs</h2>
    <table><thead><tr><th>Sub</th><th>Freelas</th><th class="num-h">A pagar</th><th class="num-h">Total repassado</th></tr></thead><tbody>${subsHtml}</tbody></table>` : ''}

    ${contratantes.length > 0 ? `<h2>Por Contratante (Top 5)</h2>
    <table><thead><tr><th>Contratante</th><th>Freelas</th><th class="num-h">Valor</th></tr></thead><tbody>${clisHtml}</tbody></table>` : ''}

    <h2>Lista de Freelas</h2>
    <table>
        <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Contratante</th><th>Status</th><th>MEI</th><th class="num-h">Valor</th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="7">Nenhum freela no período.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="6">TOTAL ACUMULADO — ${stats.count} freela${stats.count !== 1 ? 's' : ''}</td><td class="num">${formatCurrency(stats.total)}</td></tr>
        ${stats.subsCount > 0 ? `<tr><td colspan="6">Gasto com subs</td><td class="num">&minus; ${formatCurrency(stats.subs)}</td></tr>
        <tr><td colspan="6">LUCRO LÍQUIDO</td><td class="num">${formatCurrency(stats.liquido)}</td></tr>` : ''}</tfoot>
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
        { id: 'datas', label: 'Datas' },
    ];

    const maxCat = categorias.length > 0 ? categorias[0].total : 0;
    const maxCli = contratantes.length > 0 ? contratantes[0].total : 0;

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Relatório & Gestão" titleIcon="📊" maxWidth="sm:max-w-xl" applyPhoneAspectRatio={false}>
            <div className="p-4 space-y-4 bg-gray-50">

                {/* Seletor de período */}
                <div className="bg-white rounded-xl shadow-sm p-2 space-y-2">
                    <div className="grid grid-cols-5 gap-1">
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
                    {scope === 'datas' && (
                        <div className="grid grid-cols-2 gap-2 px-1 pb-1">
                            <div>
                                <label htmlFor="relDe" className="block text-[11px] font-medium text-gray-600 mb-0.5">De</label>
                                <input id="relDe" type="date" value={datas.de} onChange={(e) => setDatas(d => ({ ...d, de: e.target.value }))} className="w-full px-2 py-2 border-2 border-gray-300 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label htmlFor="relAte" className="block text-[11px] font-medium text-gray-600 mb-0.5">Até</label>
                                <input id="relAte" type="date" value={datas.ate} min={datas.de || undefined} onChange={(e) => setDatas(d => ({ ...d, ate: e.target.value }))} className="w-full px-2 py-2 border-2 border-gray-300 rounded-lg text-sm" />
                            </div>
                        </div>
                    )}
                    {scope !== 'tudo' && scope !== 'datas' && (
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

                {/* Filtros */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <button onClick={() => setShowFilters(v => !v)} className="w-full flex items-center justify-between p-3 text-sm font-bold text-gray-800">
                        <span className="flex items-center gap-2 text-left">
                            🔍 Filtrar por contratante, serviço, status...
                            {activeFilterCount > 0 && <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full">{activeFilterCount}</span>}
                        </span>
                        <span className={`transition-transform ${showFilters ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {filtrosAtivos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                            {filtrosAtivos.map(f => (
                                <button
                                    key={f.chave}
                                    onClick={() => setFilters(prev => ({ ...prev, [f.chave]: '' }))}
                                    className="flex items-center gap-1 bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded-full"
                                    aria-label={`Remover filtro ${f.texto}`}
                                >
                                    {f.texto} <span className="text-purple-500">✕</span>
                                </button>
                            ))}
                            <button onClick={() => setFilters(FILTROS_VAZIOS)} className="text-xs font-semibold text-gray-500 underline px-1">Limpar tudo</button>
                        </div>
                    )}
                    {showFilters && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 pt-0">
                            <FilterSelect name="contratante" value={filters.contratante} onChange={handleFilterChange} label="Contratante" options={{ '': 'Todos', ...Object.fromEntries(opcoesContratante.map(c => [c, c])) }} />
                            <FilterSelect name="tipo" value={filters.tipo} onChange={handleFilterChange} label="Tipo de Serviço" options={{ '': 'Todos', ...Object.fromEntries(Object.values(TipoServico).map(v => [v, rotuloEnum(v)])) }} />
                            <FilterSelect name="categoria" value={filters.categoria} onChange={handleFilterChange} label="Categoria / Função" options={{ '': 'Todas', ...Object.fromEntries(Object.values(Categoria).map(v => [v, rotuloEnum(v)])) }} />
                            <FilterSelect name="status" value={filters.status} onChange={handleFilterChange} label="Status do pagamento" options={{ '': 'Todos', ...STATUS_LABEL }} />
                            <FilterSelect name="local" value={filters.local} onChange={handleFilterChange} label="Local" options={{ '': 'Todos', ...Object.fromEntries(opcoesLocal.map(l => [l, l])) }} />
                            <FilterSelect name="mei" value={filters.mei} onChange={handleFilterChange} label="MEI" options={{ '': 'Todos', 'true': 'Declarado', 'false': 'Não Declarado' }} />
                            <FilterSelect
                                name="sub"
                                value={filters.sub}
                                onChange={handleFilterChange}
                                label="Quem executou"
                                options={{ '': 'Todos', [SUB_EU]: 'Eu mesmo', [SUB_QUALQUER]: 'Com sub (qualquer)', ...Object.fromEntries(opcoesSub.map(n => [n, `Sub: ${n}`])) }}
                            />
                            <div className="sm:col-span-2">
                                <label htmlFor="relBusca" className="block text-xs font-medium text-gray-700 mb-1">Buscar na descrição / observações</label>
                                <input id="relBusca" name="busca" value={filters.busca} onChange={handleFilterChange} placeholder="Ex: pagode, casamento..." className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm" />
                            </div>
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
                        {stats.subsCount > 0 && (
                            <div className="mt-3 pt-2 border-t border-white/30 flex justify-between text-xs font-semibold">
                                <span>🔁 Subs: − {formatCurrency(stats.subs)}</span>
                                <span>Líquido: {formatCurrency(stats.liquido)}</span>
                            </div>
                        )}
                    </div>

                    <MiniKpi label="A Receber" value={formatCurrency(stats.receivable)} sub={`${stats.pendingCount} pendente${stats.pendingCount !== 1 ? 's' : ''}`} color="from-yellow-400 to-amber-500" />
                    <MiniKpi label="Atrasado" value={formatCurrency(stats.late)} sub={`${stats.lateCount} freela${stats.lateCount !== 1 ? 's' : ''}`} color="from-red-400 to-rose-500" />
                    <MiniKpi label="MEI Declarado" value={formatCurrency(stats.mei)} sub={`${stats.meiCount} freela${stats.meiCount !== 1 ? 's' : ''}`} color="from-cyan-400 to-sky-500" />
                    <MiniKpi label="Ticket Médio" value={formatCurrency(stats.avg)} sub="por freela" color="from-violet-400 to-purple-500" />
                    {stats.subsCount > 0 && (
                        <>
                            <MiniKpi label="Gasto com Subs" value={formatCurrency(stats.subs)} sub={`${formatCurrency(stats.subsPagar)} a pagar`} color="from-teal-500 to-cyan-600" />
                            <MiniKpi label="Lucro Líquido" value={formatCurrency(stats.liquido)} sub="total − subs" color="from-emerald-600 to-teal-700" />
                        </>
                    )}
                </div>

                {/* Exportação */}
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={handleExportCsv} className="bg-green-700 text-white py-3 rounded-xl hover:bg-green-800 transition font-semibold text-sm flex items-center justify-center gap-2 shadow">
                        <span>📊</span> Exportar Excel
                    </button>
                    <button onClick={handleExportPdf} className="bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-semibold text-sm flex items-center justify-center gap-2 shadow">
                        <span>📄</span> Exportar PDF
                    </button>
                    <button onClick={() => setShowInvoice(true)} className="col-span-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-xl hover:opacity-90 transition font-semibold text-sm flex items-center justify-center gap-2 shadow">
                        <span>🧾</span> Gerar Invoice para {filters.contratante || 'contratante'} (com PIX)
                    </button>
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

                {/* Repasses a subs */}
                {subsPorNome.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-4">
                        <h4 className="text-sm font-bold text-gray-900 mb-3">🔁 Repasses a Subs</h4>
                        <div className="space-y-3">
                            {subsPorNome.map(c => (
                                <BreakdownRow
                                    key={c.name}
                                    label={c.name}
                                    count={c.count}
                                    total={c.total}
                                    max={subsPorNome[0].total}
                                    barColor="bg-teal-500"
                                    nota={c.aPagar > 0 ? `${formatCurrency(c.aPagar)} a pagar` : 'tudo pago'}
                                />
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
            {showInvoice && ReactDOM.createPortal(
                <InvoiceModal
                    isOpen={true}
                    onClose={() => setShowInvoice(false)}
                    freelas={freelas}
                    contratanteInicial={filters.contratante || contratantes[0]?.name}
                    periodoInicial={getPeriodRange(anchor, scope, datas)}
                />,
                document.getElementById('modal-root') || document.body
            )}
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

const BreakdownRow: React.FC<{ icon?: string; label: string; count: number; total: number; max: number; barColor: string; nota?: string }> = ({ icon, label, count, total, max, barColor, nota }) => (
    <div>
        <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-semibold text-gray-800 truncate pr-2">{icon ? `${icon} ` : ''}{label} <span className="text-gray-400 font-normal">({count})</span></span>
            <span className="font-bold text-gray-900 whitespace-nowrap">{formatCurrency(total)}</span>
        </div>
        {nota && <div className="text-[11px] text-gray-500 -mt-0.5 mb-1">{nota}</div>}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${max > 0 ? Math.max(4, Math.round((total / max) * 100)) : 0}%` }}></div>
        </div>
    </div>
);

const FilterSelect: React.FC<{ name: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, label: string, options: Record<string, string> }> = ({ name, value, onChange, label, options }) => (
    <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
        <select name={name} value={value} onChange={onChange} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm">
            {Object.entries(options).map(([val, text]) => <option key={val} value={val}>{text}</option>)}
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

    return (
        <div className={`bg-white rounded-lg p-3 shadow-sm border border-gray-100 border-l-4 ${info.border} flex items-start justify-between gap-3`}>
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate text-sm" title={freela.descricao}>{freela.descricao}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                    <span className={`px-2 py-0.5 font-semibold rounded-full capitalize ${info.badge}`}>{info.text}</span>
                    <span className="text-gray-500">{periodoFreelaTexto(freela)}</span>
                    {freela.contratante && <span className="text-gray-500 truncate max-w-[110px]">• {freela.contratante}</span>}
                </div>
                {freela.sub && (
                    <p className="text-xs font-semibold text-teal-700 mt-1 truncate">
                        🔁 Sub: {freela.sub.nome} • − {formatCurrency(repasseSub(freela))}{freela.sub.pago ? ' (pago)' : ' (a pagar)'}
                    </p>
                )}
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
