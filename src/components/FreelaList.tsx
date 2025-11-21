
import React, { useMemo, useState } from 'react';
import { Freela } from '../types';
import FreelaCard from './FreelaCard';

interface FreelaListProps {
    currentDate: Date;
    freelas: Freela[];
    onFreelaClick: (freela: Freela) => void;
}

const FreelaList: React.FC<FreelaListProps> = ({ currentDate, freelas, onFreelaClick }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);

    const monthFreelas = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        return freelas
            .filter(freela => {
                const freelaDate = new Date(freela.data_evento + 'T00:00:00');
                return freelaDate.getFullYear() === year && freelaDate.getMonth() === month;
            })
            .filter(freela => {
                if (!searchTerm) return true;
                const lowerCaseSearch = searchTerm.toLowerCase();
                return (
                    freela.descricao.toLowerCase().includes(lowerCaseSearch) ||
                    (freela.contratante && freela.contratante.toLowerCase().includes(lowerCaseSearch)) ||
                    (freela.local && freela.local.toLowerCase().includes(lowerCaseSearch)) ||
                    (freela.categoria_customizada && freela.categoria_customizada.toLowerCase().includes(lowerCaseSearch))
                );
            })
            .sort((a, b) => a.data_evento.localeCompare(b.data_evento));
    }, [currentDate, freelas, searchTerm]);

    return (
        <div className="relative">
            <div className="sticky top-0 bg-white py-2 z-10">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-gray-900">Freelas do Mês</h2>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 font-medium">{monthFreelas.length} freela{monthFreelas.length !== 1 ? 's' : ''}</span>
                        <button
                            onClick={() => {
                                setIsSearchVisible(!isSearchVisible);
                                if (isSearchVisible) setSearchTerm(''); // Clear search on close
                            }}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                            aria-label={isSearchVisible ? "Fechar busca" : "Buscar freela"}
                        >
                            {isSearchVisible ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    </div>
                </div>

                {isSearchVisible && (
                    <div className="relative mb-2 animate-slide-down">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar por descrição, contratante..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                            autoFocus
                        />
                    </div>
                )}
            </div>

            {monthFreelas.length === 0 ? (
                <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎭</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {searchTerm ? 'Nenhum resultado encontrado' : 'Nenhum freela este mês'}
                    </h3>
                    <p className="text-gray-500">
                        {searchTerm ? 'Tente ajustar sua busca.' : 'Clique no calendário ou no botão + para adicionar um freela.'}
                    </p>
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