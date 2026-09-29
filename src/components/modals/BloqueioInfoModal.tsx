import React from 'react';
import { Bloqueio } from '../../types';
import BaseModal from './BaseModal';
import { daysBetween, formatDateBR, formatShortBR, iconeBloqueio, rotuloBloqueio } from '../../services/bloqueioService';

interface BloqueioInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    bloqueio: Bloqueio;
    date: string; // data tocada no calendário
    onDesbloquearDia: (bloqueio: Bloqueio, date: string) => void;
    onDesbloquearTudo: (bloqueio: Bloqueio) => void;
}

const BloqueioInfoModal: React.FC<BloqueioInfoModalProps> = ({ isOpen, onClose, bloqueio, date, onDesbloquearDia, onDesbloquearTudo }) => {
    const dias = daysBetween(bloqueio.data_inicio, bloqueio.data_fim) + 1;
    const umDia = dias === 1;

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Data bloqueada" titleIcon="🚫" applyPhoneAspectRatio={false}>
            <div className="p-6 space-y-5">
                <div className="text-center">
                    <div className="text-5xl mb-2">{iconeBloqueio(bloqueio)}</div>
                    <h2 className="text-xl font-bold text-gray-900">{bloqueio.tipo === 'ferias' ? 'Férias' : 'Indisponível'}</h2>
                    {bloqueio.tipo === 'outros' && bloqueio.motivo && (
                        <p className="text-sm text-gray-600 mt-1">Motivo: {bloqueio.motivo}</p>
                    )}
                </div>

                <div className="bg-gray-100 rounded-lg p-4 text-sm text-gray-700 text-center">
                    {umDia
                        ? <>Bloqueado somente em <strong>{formatDateBR(bloqueio.data_inicio)}</strong></>
                        : <>Bloqueado de <strong>{formatDateBR(bloqueio.data_inicio)}</strong> a <strong>{formatDateBR(bloqueio.data_fim)}</strong> ({dias} dias)</>}
                    <p className="text-xs text-gray-500 mt-2">Não é possível cadastrar freelas em datas bloqueadas.</p>
                </div>

                <div className="space-y-3">
                    {!umDia && (
                        <button
                            onClick={() => onDesbloquearDia(bloqueio, date)}
                            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                        >
                            🔓 Desbloquear só {formatShortBR(date)}
                        </button>
                    )}
                    <button
                        onClick={() => onDesbloquearTudo(bloqueio)}
                        className={`w-full py-3 rounded-lg transition-colors font-semibold ${umDia ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                    >
                        🔓 {umDia ? 'Desbloquear data' : `Desbloquear período inteiro (${rotuloBloqueio(bloqueio)})`}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
};

export default BloqueioInfoModal;
