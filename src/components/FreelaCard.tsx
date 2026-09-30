import React, { useMemo } from 'react';
import { Freela } from '../types';
import { isMultiDay, daysBetween } from '../services/bloqueioService';
import { prazoEntrega, CORES_URGENCIA } from '../services/entregaService';

interface FreelaCardProps {
    freela: Freela;
    onClick: () => void;
    allFreelas: Freela[];
}

const statusStyles: { [key: string]: { border: string; badgeBg: string; badgeText: string; text: string } } = {
    pago: { border: 'border-l-green-500', badgeBg: 'bg-green-100', badgeText: 'text-green-800', text: 'Pago' },
    pendente: { border: 'border-l-yellow-400', badgeBg: 'bg-yellow-100', badgeText: 'text-yellow-800', text: 'Pendente' },
    atrasada: { border: 'border-l-red-500', badgeBg: 'bg-red-100', badgeText: 'text-red-800', text: 'Atrasado' },
};

const CategoriaInfo: Record<string, { icon: string; label: string }> = {
    'som': { icon: '🔊', label: 'Som' }, 'iluminacao': { icon: '💡', label: 'Iluminação' }, 'video': { icon: '📹', label: 'Vídeo' }, 
    'producao': { icon: '🎬', label: 'Produção' }, 'performance': { icon: '🎭', label: 'Performance' }, 'bombeiro_civil': { icon: '⛑️', label: 'Bombeiro Civil' },
    'seguranca_patrimonial': { icon: '🛡️', label: 'Segurança' }, 'fotografia': { icon: '📸', label: 'Fotografia' }, 'videomaker': { icon: '🎥', label: 'VideoMaker' },
    'edicao_audiovisual': { icon: '✂️', label: 'Ed. Audiovisual' }, 'mixagem_masterizacao': { icon: '🎚️', label: 'Mix/Master' }, 'garcom': { icon: '🤵', label: 'Garçom' }, 'outro': { icon: '⚙️', label: 'Outro' }
};


const FreelaCard: React.FC<FreelaCardProps> = ({ freela, onClick, allFreelas }) => {
    const date = new Date(freela.data_evento + 'T00:00:00');
    const festival = isMultiDay(freela);
    const dateFim = festival ? new Date(freela.data_fim + 'T00:00:00') : date;
    const day = festival ? `${date.getDate()}–${dateFim.getDate()}` : date.getDate();
    const mesInicio = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const mesFim = dateFim.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const month = mesInicio === mesFim ? mesInicio : `${mesInicio}/${mesFim}`;
    const styles = statusStyles[freela.status] || statusStyles.pendente;

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const conflictingFreela = useMemo(() => {
        if (!freela.conflictWith || !allFreelas) return null;
        return allFreelas.find(f => f.id === freela.conflictWith);
    }, [freela.conflictWith, allFreelas]);

    const getCategoriaDisplay = () => {
        if (freela.categoria === 'outro' && freela.categoria_customizada) {
            return { icon: CategoriaInfo['outro'].icon, label: freela.categoria_customizada };
        }
        return CategoriaInfo[freela.categoria] || CategoriaInfo['outro'];
    };
    const categoria = getCategoriaDisplay();

    return (
        <div 
            className={`bg-white rounded-lg shadow-sm hover:shadow-md hover:translate-y-[-2px] transition-all duration-200 border-l-4 ${styles.border} cursor-pointer overflow-hidden`}
            onClick={onClick}
        >
            <div 
              className="flex items-center gap-4 p-4"
            >
                <div className="text-center w-12">
                    <div className={`${festival ? 'text-base' : 'text-2xl'} font-bold text-gray-900 whitespace-nowrap`}>{day}</div>
                    <div className="text-xs text-gray-500 uppercase font-semibold">{month}</div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate mb-1">{freela.descricao}</p>
                    {festival && (
                        <span className="inline-block mb-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-violet-100 text-violet-800">
                            🎪 Festival • {daysBetween(freela.data_evento, freela.data_fim!) + 1} dias • cachê único
                        </span>
                    )}
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                        <span className={`inline-block px-2 py-1 font-semibold rounded-full ${styles.badgeBg} ${styles.badgeText}`}>{styles.text}</span>
                        {freela.sub && (
                            <span className="inline-block px-2 py-1 font-semibold rounded-full bg-teal-100 text-teal-800 truncate max-w-[140px]" title={`Sub: ${freela.sub.nome}`}>
                                🔁 Sub: {freela.sub.nome}
                            </span>
                        )}
                        {freela.entrega && (
                            freela.entrega.entregue ? (
                                <span className="inline-block px-2 py-1 font-semibold rounded-full bg-green-100 text-green-800 whitespace-nowrap">📦 Entregue</span>
                            ) : (() => {
                                const prazo = prazoEntrega(freela);
                                return (
                                    <span className={`inline-block px-2 py-1 font-semibold rounded-full whitespace-nowrap ${CORES_URGENCIA[prazo.urgencia]}`}>
                                        📦 {prazo.curto}
                                    </span>
                                );
                            })()
                        )}
                        {freela.horario_inicio && (
                            <span className="text-gray-500 flex items-center gap-1">
                                <span>🕒</span>
                                <span>{freela.horario_inicio}{freela.horario_fim ? ` - ${freela.horario_fim}` : ''}</span>
                            </span>
                        )}
                        {freela.local && <span className="text-gray-500 hidden sm:inline-flex items-center gap-1"> • {freela.local}</span>}
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <div className="flex items-center justify-end gap-1.5 mb-1" title={categoria.label}>
                         <span className="text-sm">{categoria.icon}</span>
                         <span className="text-xs text-gray-600 font-medium capitalize truncate max-w-[90px]">{categoria.label}</span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{formatCurrency(freela.valor)}</div>
                     {freela.contratante && <div className="text-xs text-gray-500 truncate max-w-[80px]">{freela.contratante}</div>}
                </div>
            </div>
            {conflictingFreela && (
                <div className="bg-red-50 border-t border-red-200 text-red-700 px-4 py-2 text-xs font-semibold flex items-center gap-2">
                    <span>⚠️</span>
                    <span className="truncate">Conflito com: "{conflictingFreela.descricao}"</span>
                </div>
            )}
        </div>
    );
};

export default FreelaCard;