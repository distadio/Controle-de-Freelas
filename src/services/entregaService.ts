import { Freela } from '../types';
import { daysBetween } from './bloqueioService';

// Trabalhos com prazo de entrega: data_evento é o deadline e entrega.hora o limite opcional.

export const DIAS_ALERTA_ENTREGA = 3;

const hojeStr = (agora: Date) =>
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
const horaStr = (agora: Date) => `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

export const entregaPendente = (f: Freela): boolean => !!f.entrega && !f.entrega.entregue;

export type UrgenciaEntrega = 'atrasada' | 'hoje' | 'proxima' | 'futura';

// texto: frase completa (alertas e detalhes); curto: selo do card
export const prazoEntrega = (f: Freela, agora = new Date()): { dias: number; urgencia: UrgenciaEntrega; texto: string; curto: string } => {
    const dias = daysBetween(hojeStr(agora), f.data_evento);
    const hora = f.entrega?.hora;
    const ate = hora ? ` até ${hora}` : '';
    if (dias < 0) {
        const t = `atrasada há ${-dias} dia${dias < -1 ? 's' : ''}`;
        return { dias, urgencia: 'atrasada', texto: t, curto: t };
    }
    if (dias === 0) {
        return hora && hora < horaStr(agora)
            ? { dias, urgencia: 'atrasada', texto: `prazo encerrou hoje às ${hora}`, curto: `encerrou ${hora}` }
            : { dias, urgencia: 'hoje', texto: `entrega hoje${ate}`, curto: `hoje${ate}` };
    }
    if (dias === 1) return { dias, urgencia: 'proxima', texto: `entrega amanhã${ate}`, curto: `amanhã${ate}` };
    return {
        dias,
        urgencia: dias <= DIAS_ALERTA_ENTREGA ? 'proxima' : 'futura',
        texto: `entrega em ${dias} dias${ate}`,
        curto: dias <= DIAS_ALERTA_ENTREGA ? `em ${dias} dias` : `entrega${ate}`,
    };
};

// Entregas não concluídas que já venceram ou vencem nos próximos dias, da mais urgente para a menos
export const entregasEmAlerta = (freelas: Freela[], agora = new Date()): Freela[] =>
    freelas
        .filter(f => entregaPendente(f) && prazoEntrega(f, agora).urgencia !== 'futura')
        .sort((a, b) => a.data_evento.localeCompare(b.data_evento) || (a.entrega?.hora || '99').localeCompare(b.entrega?.hora || '99'));

export const alternarEntregue = (f: Freela): Freela => ({
    ...f,
    entrega: f.entrega
        ? { ...f.entrega, entregue: !f.entrega.entregue, data_entregue: f.entrega.entregue ? null : hojeStr(new Date()) }
        : f.entrega,
    updated_at: new Date().toISOString(),
});

export const CORES_URGENCIA: Record<UrgenciaEntrega, string> = {
    atrasada: 'bg-red-100 text-red-800',
    hoje: 'bg-orange-100 text-orange-800',
    proxima: 'bg-amber-100 text-amber-800',
    futura: 'bg-sky-100 text-sky-800',
};
