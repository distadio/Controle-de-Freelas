import React from 'react';
import { Freela } from '../../types';
import BaseModal from './BaseModal';
import FreelaCard from '../FreelaCard';

interface DayFreelasModalProps {
    isOpen: boolean;
    onClose: () => void;
    date: string; // YYYY-MM-DD
    freelas: Freela[];
    allFreelas: Freela[];
    onNewFreela: () => void;
    onFreelaClick: (freela: Freela) => void;
}

const DayFreelasModal: React.FC<DayFreelasModalProps> = ({ isOpen, onClose, date, freelas, allFreelas, onNewFreela, onFreelaClick }) => {
    const dateObj = new Date(date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const title = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    const sortedFreelas = [...freelas].sort((a, b) =>
        (a.horario_inicio || '').localeCompare(b.horario_inicio || '')
    );

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={title} titleIcon="📅" applyPhoneAspectRatio={false}>
            <div className="p-4 space-y-4">
                <button
                    onClick={onNewFreela}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg shadow-md hover:shadow-lg transform hover:scale-[1.02] transition-all duration-200 flex items-center justify-center gap-2"
                >
                    <span className="text-xl">📝</span>
                    Cadastrar Novo Freela
                </button>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Freelas do dia</h4>
                        <span className="text-sm text-gray-500 font-medium">{sortedFreelas.length} freela{sortedFreelas.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-3">
                        {sortedFreelas.map(freela => (
                            <FreelaCard key={freela.id} freela={freela} onClick={() => onFreelaClick(freela)} allFreelas={allFreelas} />
                        ))}
                    </div>
                </div>
            </div>
        </BaseModal>
    );
};

export default DayFreelasModal;
