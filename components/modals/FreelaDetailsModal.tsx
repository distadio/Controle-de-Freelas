import React from 'react';
import { Freela } from '../../types';
import BaseModal from './BaseModal';

interface FreelaDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    freela: Freela;
    onEdit: (freela: Freela) => void;
    onDelete: (id: string) => void;
    onTogglePayment: (freela: Freela) => void;
}

const DetailItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div>
        <span className="font-semibold text-gray-600">{label}:</span>
        <span className="text-gray-800 ml-2 capitalize">{value}</span>
    </div>
);

const FreelaDetailsModal: React.FC<FreelaDetailsModalProps> = ({ isOpen, onClose, freela, onEdit, onDelete, onTogglePayment }) => {
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    const formatDate = (dateString?: string | null) => dateString ? new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

    const statusInfo = {
        pago: { badge: 'status-paid', text: 'Pago', button: 'Marcar como Pendente', btnClass: 'bg-yellow-500 hover:bg-yellow-600' },
        pendente: { badge: 'status-pending', text: 'Pendente', button: 'Marcar como Pago', btnClass: 'bg-green-500 hover:bg-green-600' },
        atrasada: { badge: 'status-overdue', text: 'Atrasado', button: 'Marcar como Pago', btnClass: 'bg-green-500 hover:bg-green-600' }
    }[freela.status] || { badge: 'status-pending', text: 'Pendente', button: 'Marcar como Pago', btnClass: 'bg-green-500 hover:bg-green-600' };

    const handleDeleteClick = () => {
        if (confirmDelete) {
            onDelete(freela.id);
        } else {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3000);
        }
    };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Detalhes do Freela">
            <div className="p-6 space-y-6">
                <div>
                    <p className="text-sm text-gray-500 mb-1">{formatDate(freela.data_evento)}</p>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{freela.descricao}</h2>
                    <p className="text-3xl font-bold text-blue-600">{formatCurrency(freela.valor)}</p>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 mb-1">Status</p>
                        <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${statusInfo.badge === 'status-paid' ? 'bg-green-100 text-green-800' : statusInfo.badge === 'status-pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{statusInfo.text}</span>
                    </div>
                    <button onClick={() => onTogglePayment(freela)} className={`text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold ${statusInfo.btnClass}`}>
                        {statusInfo.button}
                    </button>
                </div>

                <div className="space-y-3 text-sm border-t border-gray-200 pt-4">
                    {(freela.horario_inicio || freela.horario_fim) && <DetailItem label="Horário" value={`${freela.horario_inicio || ''} - ${freela.horario_fim || ''}`} />}
                    {freela.data_vencimento && <DetailItem label="Vencimento" value={formatDate(freela.data_vencimento)} />}
                    {freela.tipo_servico && <DetailItem label="Tipo" value={freela.tipo_servico.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} />}
                    {freela.categoria && <DetailItem 
                        label="Categoria" 
                        value={
                            (freela.categoria === 'outro' && freela.categoria_customizada) 
                            ? freela.categoria_customizada 
                            : freela.categoria.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                        } 
                    />}
                    {freela.local && <DetailItem label="Local" value={freela.local} />}
                    {freela.contratante && <DetailItem label="Contratante" value={freela.contratante} />}
                    {freela.observacoes && <DetailItem label="Observações" value={<p className="italic text-gray-700 normal-case">{freela.observacoes}</p>} />}
                    {freela.declara_mei && <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2"><span className="font-semibold text-blue-700">✓ Declarado como MEI</span></div>}
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button onClick={() => onEdit(freela)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition-colors font-semibold">Editar</button>
                    <button onClick={handleDeleteClick} className={`flex-1 text-white py-2.5 rounded-lg transition-colors font-semibold ${confirmDelete ? 'bg-red-700 hover:bg-red-800' : 'bg-red-500 hover:bg-red-600'}`}>
                        {confirmDelete ? 'Confirmar Exclusão?' : 'Excluir'}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
};

export default FreelaDetailsModal;