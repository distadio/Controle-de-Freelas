import { Freela } from '../types';
import { nameKey, normalizeName } from './textService';
import { repasseSub } from './subService';
import { daysBetween, eachDate, isMultiDay } from './bloqueioService';

// Cálculos financeiros do Dashboard. Datas sempre em YYYY-MM-DD.

export const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Cada freela cai em exatamente uma situação financeira
export type Situacao = 'recebido' | 'aReceber' | 'atrasado' | 'agendado';

export const situacaoDe = (f: Freela, hoje: string): Situacao =>
    f.status === 'pago' ? 'recebido'
        : f.status === 'atrasada' ? 'atrasado'
            : f.data_evento > hoje ? 'agendado' : 'aReceber';

export const SITUACOES: { id: Situacao; label: string; cor: string; barra: string }[] = [
    { id: 'recebido', label: 'Recebido', cor: '#22c55e', barra: 'bg-green-500' },
    { id: 'aReceber', label: 'A receber', cor: '#f59e0b', barra: 'bg-amber-400' },
    { id: 'atrasado', label: 'Atrasado', cor: '#ef4444', barra: 'bg-red-500' },
    { id: 'agendado', label: 'Agendado', cor: '#a78bfa', barra: 'bg-violet-400' },
];

const mesDe = (d: string) => parseInt(d.slice(5, 7), 10) - 1;
const anoDe = (d: string) => parseInt(d.slice(0, 4), 10);

export interface Resumo {
    total: number;
    count: number;
    situacoes: Record<Situacao, { valor: number; count: number }>;
    subs: number;
    subsCount: number;
    liquido: number;
    ticket: number;
    diarias: number; // dias em que trabalhei pessoalmente (sem sub, sem prazo de entrega)
    mediaDiaria: number;
    mei: number;
}

export const resumir = (lista: Freela[], hoje: string): Resumo => {
    const situacoes = Object.fromEntries(SITUACOES.map(s => [s.id, { valor: 0, count: 0 }])) as Resumo['situacoes'];
    lista.forEach(f => {
        const s = situacoes[situacaoDe(f, hoje)];
        s.valor += f.valor;
        s.count += 1;
    });
    const total = lista.reduce((s, f) => s + f.valor, 0);
    const subs = lista.reduce((s, f) => s + repasseSub(f), 0);

    const presenciais = lista.filter(f => !f.sub && !f.entrega);
    const dias = new Set<string>();
    presenciais.forEach(f => (isMultiDay(f) ? eachDate(f.data_evento, f.data_fim!) : [f.data_evento]).forEach(d => dias.add(d)));
    const valorPresencial = presenciais.reduce((s, f) => s + f.valor, 0);

    return {
        total,
        count: lista.length,
        situacoes,
        subs,
        subsCount: lista.filter(f => f.sub).length,
        liquido: total - subs,
        ticket: lista.length ? total / lista.length : 0,
        diarias: dias.size,
        mediaDiaria: dias.size ? valorPresencial / dias.size : 0,
        mei: lista.filter(f => f.declara_mei).reduce((s, f) => s + f.valor, 0),
    };
};

// Competência: pelo mês do trabalho, empilhado por situação
export const porMesCompetencia = (lista: Freela[], hoje: string) =>
    MESES.map((name, i) => {
        const doMes = lista.filter(f => mesDe(f.data_evento) === i);
        const linha: Record<string, number | string> = { name, total: 0, subs: 0 };
        SITUACOES.forEach(s => { linha[s.label] = 0; });
        doMes.forEach(f => {
            const label = SITUACOES.find(s => s.id === situacaoDe(f, hoje))!.label;
            linha[label] = (linha[label] as number) + f.valor;
            linha.total = (linha.total as number) + f.valor;
            linha.subs = (linha.subs as number) + repasseSub(f);
        });
        return { ...linha, count: doMes.length } as { name: string; total: number; subs: number; count: number } & Record<string, number>;
    });

// Caixa: dinheiro que entrou (pagamentos recebidos) e saiu (subs pagos) em cada mês do ano
export const porMesCaixa = (todos: Freela[], ano: number) =>
    MESES.map((name, i) => {
        let entradas = 0;
        let saidas = 0;
        todos.forEach(f => {
            if (f.status === 'pago') {
                const d = f.data_pagamento || f.data_evento;
                if (anoDe(d) === ano && mesDe(d) === i) entradas += f.valor;
            }
            if (f.sub?.pago) {
                const d = f.sub.data_pagamento || f.data_evento;
                if (anoDe(d) === ano && mesDe(d) === i) saidas += repasseSub(f);
            }
        });
        return { name, Entradas: entradas, 'Pago a subs': saidas, saldo: entradas - saidas };
    });

// Quem me deve: trabalhos já realizados (ou vencidos) e não pagos, de qualquer ano
export interface Devedor {
    nome: string;
    semNome: boolean;
    aberto: number;
    atrasado: number;
    count: number;
    diasAtraso: number; // do vencimento mais antigo em atraso
}

export const devedores = (todos: Freela[], hoje: string): Devedor[] => {
    const mapa = new Map<string, Devedor>();
    todos.forEach(f => {
        const s = situacaoDe(f, hoje);
        if (s !== 'aReceber' && s !== 'atrasado') return;
        const k = nameKey(f.contratante);
        const d = mapa.get(k) || { nome: normalizeName(f.contratante) || 'Sem contratante', semNome: !k, aberto: 0, atrasado: 0, count: 0, diasAtraso: 0 };
        d.aberto += f.valor;
        d.count += 1;
        if (s === 'atrasado') {
            d.atrasado += f.valor;
            const venc = f.data_vencimento || f.data_evento;
            d.diasAtraso = Math.max(d.diasAtraso, daysBetween(venc, hoje));
        }
        mapa.set(k, d);
    });
    return [...mapa.values()].sort((a, b) => b.atrasado - a.atrasado || b.aberto - a.aberto);
};

// Repasses devidos a subs por trabalhos já realizados, de qualquer ano
export const subsAPagar = (todos: Freela[], hoje: string) => {
    const mapa = new Map<string, { nome: string; valor: number; count: number }>();
    todos.forEach(f => {
        if (!f.sub || f.sub.pago || f.data_evento > hoje) return;
        const k = nameKey(f.sub.nome);
        const e = mapa.get(k) || { nome: normalizeName(f.sub.nome), valor: 0, count: 0 };
        e.valor += repasseSub(f);
        e.count += 1;
        mapa.set(k, e);
    });
    return [...mapa.values()].sort((a, b) => b.valor - a.valor);
};

// Participação de cada grupo (contratante, função...) no faturamento
export const participacao = (lista: Freela[], chave: (f: Freela) => { k: string; nome: string }) => {
    const total = lista.reduce((s, f) => s + f.valor, 0);
    const mapa = new Map<string, { nome: string; valor: number; count: number }>();
    lista.forEach(f => {
        const { k, nome } = chave(f);
        const e = mapa.get(k) || { nome, valor: 0, count: 0 };
        e.valor += f.valor;
        e.count += 1;
        mapa.set(k, e);
    });
    return [...mapa.values()]
        .sort((a, b) => b.valor - a.valor)
        .map(e => ({ ...e, pct: total ? Math.round((e.valor / total) * 100) : 0 }));
};

// Mesmo período do ano anterior (até o dia de hoje, se for o ano corrente)
export const comparacaoAnoAnterior = (todos: Freela[], ano: number, hoje: string) => {
    const anoAtual = anoDe(hoje);
    const limite = ano === anoAtual ? hoje.slice(5) : '12-31';
    const soma = (a: number) => todos
        .filter(f => anoDe(f.data_evento) === a && f.data_evento.slice(5) <= limite)
        .reduce((s, f) => s + f.valor, 0);
    const atual = soma(ano);
    const anterior = soma(ano - 1);
    return {
        parcial: ano === anoAtual,
        atual,
        anterior,
        variacao: anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : null,
    };
};
