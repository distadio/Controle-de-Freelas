import { Freela, SubFreela } from '../types';
import { nameKey, normalizeName } from './textService';

const hoje = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Quanto do cachê vai para o sub (integral acompanha o valor atual do freela)
export const repasseSub = (f: Freela): number => (f.sub ? (f.sub.integral ? f.valor : f.sub.valor || 0) : 0);

// O que sobra para mim depois de pagar o sub
export const liquidoFreela = (f: Freela): number => f.valor - repasseSub(f);

// Freelas em que eu vou pessoalmente: só esses ocupam a agenda (conflito, festival, bloqueio)
export const meOcupa = (f: Freela): boolean => !f.sub;

export const subVazio = (): SubFreela => ({ nome: '', contato: '', integral: true, valor: 0, pago: false, data_pagamento: null });

export const normalizarSub = (s: SubFreela, valorFreela: number): SubFreela => ({
    nome: normalizeName(s.nome),
    contato: s.contato?.trim() || null,
    integral: s.integral,
    valor: s.integral ? valorFreela : (s.valor || 0),
    pago: !!s.pago,
    data_pagamento: s.pago ? (s.data_pagamento || hoje()) : null,
});

export const alternarPagamentoSub = (f: Freela): Freela => ({
    ...f,
    sub: f.sub ? { ...f.sub, pago: !f.sub.pago, data_pagamento: f.sub.pago ? null : hoje() } : f.sub,
    updated_at: new Date().toISOString(),
});

// Subs já usados (nome normalizado → último contato conhecido), para sugestão no cadastro
export const subsConhecidos = (freelas: Freela[]): { nome: string; contato: string | null }[] => {
    const mapa = new Map<string, { nome: string; contato: string | null }>();
    [...freelas]
        .filter(f => f.sub?.nome)
        .sort((a, b) => (a.updated_at || '').localeCompare(b.updated_at || ''))
        .forEach(f => {
            const k = nameKey(f.sub!.nome);
            const atual = mapa.get(k);
            mapa.set(k, { nome: normalizeName(f.sub!.nome), contato: f.sub!.contato || atual?.contato || null });
        });
    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
};

// Número no formato do wa.me (aceita com ou sem +55); null se não parecer um celular
export const whatsappNumero = (contato?: string | null): string | null => {
    const d = (contato || '').replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) return `55${d}`;
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
    return null;
};
