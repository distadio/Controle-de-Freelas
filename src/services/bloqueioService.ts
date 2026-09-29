import { Bloqueio, Freela } from '../types';

// Datas trabalhadas sempre como string YYYY-MM-DD (comparação lexicográfica = cronológica).

export const addDays = (dateStr: string, days: number): string => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const daysBetween = (start: string, end: string): number =>
    Math.round((new Date(end + 'T00:00:00').getTime() - new Date(start + 'T00:00:00').getTime()) / 86400000);

export const eachDate = (start: string, end: string): string[] => {
    const dates: string[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) dates.push(d);
    return dates;
};

export const formatDateBR = (dateStr: string): string =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');

export const formatShortBR = (dateStr: string): string =>
    new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

// Festival / cachê único: freela que ocupa um período de vários dias com valor único.
export const isMultiDay = (f: Freela): boolean => !!f.data_fim && f.data_fim > f.data_evento;

export const freelaCobre = (f: Freela, date: string): boolean =>
    f.data_evento <= date && date <= (isMultiDay(f) ? f.data_fim! : f.data_evento);

export const findFestival = (freelas: Freela[], date: string, ignorarId?: string): Freela | undefined =>
    freelas.find(f => f.id !== ignorarId && isMultiDay(f) && freelaCobre(f, date));

export const findBloqueio = (bloqueios: Bloqueio[], date: string): Bloqueio | undefined =>
    bloqueios.find(b => b.data_inicio <= date && date <= b.data_fim);

export const periodoFreelaTexto = (f: Freela): string =>
    isMultiDay(f) ? `${formatDateBR(f.data_evento)} a ${formatDateBR(f.data_fim!)}` : formatDateBR(f.data_evento);

export const rotuloBloqueio = (b: Bloqueio): string =>
    b.tipo === 'ferias' ? 'Férias' : (b.motivo?.trim() || 'Indisponível');

export const iconeBloqueio = (b: Bloqueio): string => (b.tipo === 'ferias' ? '🏖️' : '📌');
