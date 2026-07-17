
import React, { useState, useEffect, useMemo } from 'react';
import { Freela, TipoServico, Categoria } from '../../types';
import BaseModal from './BaseModal';
import { normalizeName, nameKey } from '../../services/textService';

interface FreelaFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (freela: Freela) => void;
    onSaveMany: (freelas: Freela[]) => void;
    freelaToEdit: Freela | null;
    selectedDate: string | null;
    allFreelas: Freela[];
    onConflict: (conflictingFreela: Freela, newFreelaData: Partial<Freela>) => void;
}

// Desloca uma data YYYY-MM-DD em N dias
const shiftDate = (dateStr: string, days: number): string => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const FreelaFormModal: React.FC<FreelaFormModalProps> = ({ isOpen, onClose, onSave, onSaveMany, freelaToEdit, selectedDate, allFreelas, onConflict }) => {
    const [formData, setFormData] = useState<Partial<Freela>>({});
    const [repetirSemanas, setRepetirSemanas] = useState(0);

    // Duplicação chega como freelaToEdit com id vazio (novo registro pré-preenchido)
    const isEditing = !!(freelaToEdit && freelaToEdit.id);
    const isDuplicating = !!(freelaToEdit && !freelaToEdit.id);

    // Sugestões de contratantes e locais já usados (dedup por nome normalizado)
    const { contratantes, locais } = useMemo(() => {
        const cMap = new Map<string, string>();
        const lMap = new Map<string, string>();
        allFreelas.forEach(f => {
            const ck = nameKey(f.contratante);
            if (ck && !cMap.has(ck)) cMap.set(ck, normalizeName(f.contratante));
            const lk = nameKey(f.local);
            if (lk && !lMap.has(lk)) lMap.set(lk, normalizeName(f.local));
        });
        return {
            contratantes: [...cMap.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')),
            locais: [...lMap.values()].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        };
    }, [allFreelas]);

    useEffect(() => {
        setRepetirSemanas(0);
        if (freelaToEdit) {
            setFormData(freelaToEdit);
        } else {
            const today = new Date().toISOString().split('T')[0];
            setFormData({
                data_evento: selectedDate || today,
                data_vencimento: selectedDate || today,
                tipo_servico: TipoServico.Show,
                categoria: Categoria.Som,
                declara_mei: false,
                categoria_customizada: '',
            });
        }
    }, [freelaToEdit, selectedDate, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData(prev => ({
            ...prev,
            valor: value === '' ? undefined : parseFloat(value)
        }))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const { data_evento, horario_inicio, horario_fim } = formData;
    
        // Conflict Check Logic
        if (horario_inicio && horario_fim && data_evento) {
            const timeToMinutes = (timeStr: string): number => {
                const [h, m] = timeStr.split(':').map(Number);
                return h * 60 + m;
            };

            const newStartTime = timeToMinutes(horario_inicio);
            let newEndTime = timeToMinutes(horario_fim);
            // If end time is same or earlier than start, it crosses midnight.
            if (newEndTime <= newStartTime) {
                newEndTime += 24 * 60;
            }

            const conflictingFreela = allFreelas.find(existingFreela => {
                // Don't compare with itself when editing
                if (freelaToEdit && existingFreela.id === freelaToEdit.id) return false;
                
                // Check if on the same day and has time range
                if (existingFreela.data_evento !== data_evento) return false;
                if (!existingFreela.horario_inicio || !existingFreela.horario_fim) return false;

                const existingStartTime = timeToMinutes(existingFreela.horario_inicio);
                let existingEndTime = timeToMinutes(existingFreela.horario_fim);
                if (existingEndTime <= existingStartTime) {
                    existingEndTime += 24 * 60;
                }

                // Standard overlap check: (StartA < EndB) and (StartB < EndA)
                return newStartTime < existingEndTime && existingStartTime < newEndTime;
            });
            
            if (conflictingFreela) {
                onConflict(conflictingFreela, formData);
                return; // Stop submission
            }
        }
        
        const now = new Date().toISOString();
        const freelaData: Freela = {
            descricao: formData.descricao || '',
            valor: formData.valor || 0,
            data_evento: formData.data_evento || '',
            ...formData,
            id: isEditing ? freelaToEdit!.id : `freela_${Date.now()}`,
            status: isEditing ? (freelaToEdit!.status as string) : 'pendente',
            created_at: isEditing ? freelaToEdit!.created_at : now,
            updated_at: now,
            contratante: normalizeName(formData.contratante) || null,
            local: normalizeName(formData.local) || null,
            tipo_servico: formData.tipo_servico || TipoServico.Outro,
            categoria: formData.categoria || Categoria.Outro,
            categoria_customizada: formData.categoria === 'outro' ? formData.categoria_customizada : null,
            declara_mei: formData.declara_mei || false,
        };

        // Recorrência semanal: cria cópias nas semanas seguintes (só em cadastro novo)
        if (!isEditing && repetirSemanas > 0) {
            const ocorrencias: Freela[] = [];
            for (let i = 0; i <= repetirSemanas; i++) {
                const dias = i * 7;
                ocorrencias.push({
                    ...freelaData,
                    id: `freela_${Date.now()}_${i}`,
                    data_evento: shiftDate(freelaData.data_evento, dias),
                    data_vencimento: freelaData.data_vencimento ? shiftDate(freelaData.data_vencimento, dias) : null,
                });
            }
            onSaveMany(ocorrencias);
            return;
        }

        onSave(freelaData);
    };

    const cargaHoraria = useMemo(() => {
        const { horario_inicio, horario_fim } = formData;
        if (!horario_inicio || !horario_fim) return null;

        try {
            const [startHour, startMinute] = horario_inicio.split(':').map(Number);
            const [endHour, endMinute] = horario_fim.split(':').map(Number);

            let startTotalMinutes = startHour * 60 + startMinute;
            let endTotalMinutes = endHour * 60 + endMinute;

            if (endTotalMinutes < startTotalMinutes) {
                // Job crosses midnight
                endTotalMinutes += 24 * 60;
            }

            const durationMinutes = endTotalMinutes - startTotalMinutes;
            if (isNaN(durationMinutes) || durationMinutes <= 0) return null;

            const hours = Math.floor(durationMinutes / 60);
            const minutes = durationMinutes % 60;

            let result = 'Carga horária: ';
            if (hours > 0) result += `${hours}h `;
            if (minutes > 0) result += `${minutes}m`;
            
            return result.trim();
        } catch (error) {
            console.error("Error calculating duration:", error);
            return null;
        }
    }, [formData.horario_inicio, formData.horario_fim]);


    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={isEditing ? 'Editar Freela' : isDuplicating ? 'Duplicar Freela' : 'Novo Freela'} titleIcon="📝">
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                 <div>
                    <label htmlFor="descricao" className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
                    <input type="text" id="descricao" name="descricao" value={formData.descricao || ''} onChange={handleChange} maxLength={100} required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Ex: Show no Bar do João" />
                </div>
                 <div>
                    <label htmlFor="valor" className="block text-sm font-medium text-gray-700 mb-1">Valor (R$) *</label>
                    <input type="number" id="valor" name="valor" value={formData.valor || ''} onChange={handleValorChange} step="0.01" min="0.01" required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="0,00" />
                </div>
                 <div>
                    <label htmlFor="dataEvento" className="block text-sm font-medium text-gray-700 mb-1">Data do Evento *</label>
                    <input type="date" id="dataEvento" name="data_evento" value={formData.data_evento || ''} onChange={handleChange} required className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                 <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label htmlFor="horarioInicio" className="block text-sm font-medium text-gray-700 mb-1">Horário Início</label>
                        <input type="time" id="horarioInicio" name="horario_inicio" value={formData.horario_inicio || ''} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                     <div>
                        <label htmlFor="horarioFim" className="block text-sm font-medium text-gray-700 mb-1">Horário Fim</label>
                        <input type="time" id="horarioFim" name="horario_fim" value={formData.horario_fim || ''} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                </div>
                {cargaHoraria && (
                    <div className="text-center text-sm font-medium text-gray-700 bg-gray-100 p-2 rounded-lg -mt-2 border border-gray-200">
                        {cargaHoraria}
                    </div>
                )}
                <div>
                    <label htmlFor="dataVencimento" className="block text-sm font-medium text-gray-700 mb-1">Data de Vencimento</label>
                    <input type="date" id="dataVencimento" name="data_vencimento" value={formData.data_vencimento || ''} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
                <div>
                    <label htmlFor="tipoServico" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Serviço</label>
                    <select id="tipoServico" name="tipo_servico" value={formData.tipo_servico || ''} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        {Object.values(TipoServico).map(v => <option key={v} value={v}>{v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="categoria" className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select id="categoria" name="categoria" value={formData.categoria || ''} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                       {Object.values(Categoria).map(v => <option key={v} value={v}>{v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                    </select>
                </div>
                {formData.categoria === 'outro' && (
                    <div>
                        <label htmlFor="categoria_customizada" className="block text-sm font-medium text-gray-700 mb-1">Especifique a Categoria *</label>
                        <input
                            type="text"
                            id="categoria_customizada"
                            name="categoria_customizada"
                            value={formData.categoria_customizada || ''}
                            onChange={handleChange}
                            required
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Ex: Roadie"
                        />
                    </div>
                )}
                <div>
                    <label htmlFor="local" className="block text-sm font-medium text-gray-700 mb-1">Local</label>
                    <input type="text" id="local" name="local" list="locais-sugeridos" value={formData.local || ''} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Ex: Teatro Municipal"/>
                    <datalist id="locais-sugeridos">
                        {locais.map(l => <option key={l} value={l} />)}
                    </datalist>
                </div>
                <div>
                    <label htmlFor="contratante" className="block text-sm font-medium text-gray-700 mb-1">Contratante</label>
                    <input type="text" id="contratante" name="contratante" list="contratantes-sugeridos" value={formData.contratante || ''} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Ex: João Silva"/>
                    <datalist id="contratantes-sugeridos">
                        {contratantes.map(c => <option key={c} value={c} />)}
                    </datalist>
                </div>
                <div>
                    <label htmlFor="observacoes" className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                    <textarea id="observacoes" name="observacoes" value={formData.observacoes || ''} onChange={handleChange} rows={3} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Informações adicionais..."></textarea>
                </div>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" id="declaraMei" name="declara_mei" checked={formData.declara_mei || false} onChange={handleChange} className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"/>
                        <div>
                            <div className="font-semibold text-gray-900">Declarar como MEI</div>
                            <div className="text-xs text-gray-600">Este freela será contabilizado no limite mensal MEI.</div>
                        </div>
                    </label>
                </div>
                {!isEditing && (
                    <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                        <label htmlFor="repetirSemanas" className="block font-semibold text-gray-900 mb-1">🔁 Repetir semanalmente</label>
                        <select
                            id="repetirSemanas"
                            value={repetirSemanas}
                            onChange={(e) => setRepetirSemanas(parseInt(e.target.value))}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                            <option value={0}>Não repetir</option>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => (
                                <option key={n} value={n}>+{n} semana{n > 1 ? 's' : ''} ({n + 1} freelas no total)</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-600 mt-1">Cria cópias deste freela nas próximas semanas, no mesmo dia e horário.</p>
                    </div>
                )}
                <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">Salvar Freela</button>
            </form>
        </BaseModal>
    );
};

export default FreelaFormModal;