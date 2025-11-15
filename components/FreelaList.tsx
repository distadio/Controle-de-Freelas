import React, { useMemo } from 'react';
import { Freela } from '../types';
import FreelaCard from './FreelaCard';

interface FreelaListProps {
    currentDate: Date;
    freelas: Freela[];
    onFreelaClick: (freela: Freela) => void;
}

const FreelaList: React.FC<FreelaListProps> = ({ currentDate, freelas, onFreelaClick }) => {
    const monthFreelas = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        return freelas
            .filter(freela => {
                const freelaDate = new Date(freela.data_evento + 'T00:00:00');
                return freelaDate.getFullYear() === year && freelaDate.getMonth() === month;
            })
            .sort((a, b) => a.data_evento.localeCompare(b.data_evento));
    }, [currentDate, freelas]);

    return (
        <div className="relative">
            <div className="sticky top-0 bg-white py-2">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-gray-900">Freelas do Mês</h2>
                    <span className="text-sm text-gray-500 font-medium">{monthFreelas.length} freela{monthFreelas.length !== 1 ? 's' : ''}</span>
                </div>
            </div>

            {monthFreelas.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎭</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum freela este mês</h3>
                    <p className="text-gray-500">Clique no calendário ou no botão + para adicionar um freela.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {monthFreelas.map(freela => (
                        <FreelaCard key={freela.id} freela={freela} onClick={() => onFreelaClick(freela)} allFreelas={freelas} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FreelaList;