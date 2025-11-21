
import React from 'react';
import BaseModal from './BaseModal';
import { Freela } from '../../types';

interface ConflictModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    conflictingFreela: Freela;
}

const ConflictModal: React.FC<ConflictModalProps> = ({ isOpen, onClose, onConfirm, conflictingFreela }) => {
    return (
        <BaseModal 
            isOpen={isOpen} 
            onClose={onClose} 
            title="Conflito de Horário" 
            titleIcon="⚠️"
            headerGradient="from-yellow-500 to-red-500"
        >
            <div className="p-6 text-center">
                <div className="text-6xl mb-4">🗓️</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Horário Indisponível</h3>
                <p className="text-gray-600 mb-6">
                    O horário que você tentou agendar conflita com o freela: <br />
                    <strong className="text-gray-800">"{conflictingFreela.descricao}"</strong>.
                </p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={onConfirm}
                        className="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                        Salvar mesmo assim
                    </button>
                    <button 
                        onClick={onClose} 
                        className="w-full bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                        Fechar e Corrigir
                    </button>
                </div>
            </div>
        </BaseModal>
    );
};

export default ConflictModal;