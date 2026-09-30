import React, { useState } from 'react';
import BaseModal from './BaseModal';
import MarcaEditor from '../MarcaEditor';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Marca, MARCA_PADRAO } from '../../services/marcaService';

interface MeiConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    limiteAnual: number;
    onSave: (novoLimite: number) => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const MeiConfigModal: React.FC<MeiConfigModalProps> = ({ isOpen, onClose, limiteAnual, onSave }) => {
    const [valor, setValor] = useState<string>(String(limiteAnual));
    const [marca, setMarca] = useLocalStorage<Marca>('controle_freelas_marca', MARCA_PADRAO);

    const parsed = parseFloat(valor);
    const valido = !isNaN(parsed) && parsed > 0;

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Minha empresa (MEI)" titleIcon="⚙️" applyPhoneAspectRatio={false}>
            <div className="p-6 space-y-4">
                <p className="text-sm text-gray-700">
                    O teto de faturamento do MEI é <strong>anual</strong> e é reajustado pelo governo
                    de tempos em tempos. Ajuste aqui o valor vigente — a referência mensal é calculada
                    automaticamente (anual ÷ 12).
                </p>
                <div>
                    <label htmlFor="limiteAnual" className="block text-sm font-medium text-gray-700 mb-1">Limite anual (R$)</label>
                    <input
                        type="number"
                        id="limiteAnual"
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        min="1"
                        step="1000"
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
                {valido && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-gray-700">
                        Referência mensal: <strong>{formatCurrency(parsed / 12)}</strong>
                    </div>
                )}
                <button
                    onClick={() => valido && onSave(parsed)}
                    disabled={!valido}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                    Salvar limite
                </button>

                <div className="border-t-2 border-gray-200 pt-4">
                    <h4 className="text-sm font-bold text-gray-900">🎨 Logo e cor das invoices</h4>
                    <p className="text-xs text-gray-600 mb-3">O logo aparece centralizado no cabeçalho das invoices. Alterações são salvas na hora.</p>
                    <MarcaEditor marca={marca} onChange={setMarca} />
                </div>
            </div>
        </BaseModal>
    );
};

export default MeiConfigModal;
