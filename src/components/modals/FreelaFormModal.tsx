
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Freela, TipoServico, Categoria, Bloqueio, TipoBloqueio, SubFreela } from '../../types';
import BaseModal from './BaseModal';
import { normalizeName, nameKey } from '../../services/textService';
import {
    addDays, daysBetween, eachDate, formatDateBR, formatShortBR, isMultiDay,
    freelaCobre, findFestival, findBloqueio, rotuloBloqueio, periodoFreelaTexto,
} from '../../services/bloqueioService';
import { meOcupa, subVazio, normalizarSub, subsConhecidos } from '../../services/subService';

interface FreelaFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (freela: Freela) => void;
    onSaveMany: (freelas: Freela[], datasPuladas: string[]) => void;
    onSaveBloqueio: (bloqueio: Bloqueio) => void;
    freelaToEdit: Freela | null;
    selectedDate: string | null;
    allFreelas: Freela[];
    bloqueios: Bloqueio[];
    onConflict: (conflictingFreela: Freela, newFreelaData: Partial<Freela>) => void;
}

type Justificativa = 'ferias' | 'festival' | 'outros';

const JUSTIFICATIVAS: { id: Justificativa; icon: string; titulo: string; desc: string }[] = [
    { id: 'ferias', icon: '🏖️', titulo: 'Férias', desc: 'Data fica indisponível' },
    { id: 'festival', icon: '🎪', titulo: 'Festival ou cachê único', desc: 'Vários dias, valor único' },
    { id: 'outros', icon: '📌', titulo: 'Outros', desc: 'Doença, pessoal...' },
];

const MAX_DIAS = 366;

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const inputClass = 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const FreelaFormModal: React.FC<FreelaFormModalProps> = ({
    isOpen, onClose, onSave, onSaveMany, onSaveBloqueio, freelaToEdit, selectedDate, allFreelas, bloqueios, onConflict,
}) => {
    const [formData, setFormData] = useState<Partial<Freela>>({});
    const [repetirSemanas, setRepetirSemanas] = useState(0);
    const [modo, setModo] = useState<'freela' | 'bloqueio'>('freela');
    const [justificativa, setJustificativa] = useState<Justificativa>('ferias');
    const [periodo, setPeriodo] = useState<'dia' | 'intervalo'>('dia');
    const [dataFim, setDataFim] = useState('');
    const [motivo, setMotivo] = useState('');
    const [erro, setErro] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const confirmadoRef = useRef(false);
    const formRef = useRef<HTMLFormElement>(null);

    // Duplicação chega como freelaToEdit com id vazio (novo registro pré-preenchido)
    const isEditing = !!(freelaToEdit && freelaToEdit.id);
    const isDuplicating = !!(freelaToEdit && !freelaToEdit.id);
    const isNovo = !isEditing && !isDuplicating;
    const editingId = isEditing ? freelaToEdit!.id : undefined;

    // Festival/cachê único: escolhido no modo bloqueio, ou editando/duplicando um festival existente
    const festivalMode = modo === 'bloqueio'
        ? justificativa === 'festival'
        : !!(freelaToEdit && isMultiDay(freelaToEdit));
    const mostraCamposFreela = modo === 'freela' || festivalMode;

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

    const subsSugeridos = useMemo(() => subsConhecidos(allFreelas), [allFreelas]);

    // Só os freelas em que vou pessoalmente ocupam a data (com sub, a data fica livre)
    const ocupam = useMemo(() => allFreelas.filter(meOcupa), [allFreelas]);

    useEffect(() => {
        setRepetirSemanas(0);
        setModo('freela');
        setJustificativa('ferias');
        setPeriodo('dia');
        setMotivo('');
        setDataFim(freelaToEdit?.data_fim || '');
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

    // Qualquer alteração invalida mensagens e confirmações anteriores
    useEffect(() => {
        setErro(null);
        setAviso(null);
        confirmadoRef.current = false;
    }, [formData, modo, justificativa, periodo, dataFim, repetirSemanas]);

    const inicio = formData.data_evento || '';

    const escolherJustificativa = (j: Justificativa) => {
        setJustificativa(j);
        if (j === 'festival') {
            // Festival só existe para mais de um dia
            setPeriodo('intervalo');
            if (!dataFim || dataFim <= inicio) setDataFim(addDays(inicio, 1));
        }
    };

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
        }));
    };

    const sub = formData.sub || null;
    const alterarSub = (patch: Partial<SubFreela>) =>
        setFormData(prev => ({ ...prev, sub: { ...(prev.sub || subVazio()), ...patch } }));

    // Mesmo sub digitado com outra grafia ("joão " x "João"): salva com a grafia já usada
    const nomeSubCanonico = (nome: string) =>
        allFreelas.find(f => f.id !== editingId && f.sub && nameKey(f.sub.nome) === nameKey(nome))?.sub!.nome ?? nome;

    // Ao escolher um sub já conhecido, completa o contato
    const alterarNomeSub = (nome: string) => {
        const conhecido = subsSugeridos.find(s => nameKey(s.nome) === nameKey(nome));
        alterarSub(conhecido && !sub?.contato ? { nome, contato: conhecido.contato || '' } : { nome });
    };

    // Mostra um alerta que exige confirmação; retorna true se a submissão deve parar
    const precisaConfirmar = (mensagem: string): boolean => {
        if (confirmadoRef.current) return false;
        setAviso(mensagem);
        return true;
    };

    const listaFreelas = (lista: Freela[]) => {
        const nomes = lista.slice(0, 3).map(f => `"${f.descricao}" (${formatShortBR(f.data_evento)})`).join(', ');
        return lista.length > 3 ? `${nomes} e mais ${lista.length - 3}` : nomes;
    };

    // "Já existe 1 freela ... Ele será mantido" / "Já existem 2 freelas ... Eles serão mantidos"
    const resumoExistentes = (lista: Freela[]) => {
        const plural = lista.length > 1;
        return {
            texto: `Já existe${plural ? 'm' : ''} ${lista.length} freela${plural ? 's' : ''} neste período: ${listaFreelas(lista)}.`,
            mantido: plural ? 'Eles serão mantidos' : 'Ele será mantido',
        };
    };

    // No celular o alerta aparece no fim do formulário: garante que fique visível
    const mensagemRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (erro || aviso) mensagemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [erro, aviso]);

    const montarFreela = (extra: Partial<Freela>): Freela => {
        const now = new Date().toISOString();
        return {
            descricao: formData.descricao || '',
            valor: formData.valor || 0,
            data_evento: inicio,
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
            data_fim: null,
            sub: formData.sub ? normalizarSub({ ...formData.sub, nome: nomeSubCanonico(formData.sub.nome) }, formData.valor || 0) : null,
            ...extra,
        };
    };

    // ---- Bloqueio simples (Férias / Outros) ----
    const submitBloqueio = () => {
        const fim = periodo === 'intervalo' ? dataFim : inicio;
        if (!fim || fim < inicio) {
            setErro('A data de término deve ser igual ou posterior à data de início.');
            return;
        }
        if (daysBetween(inicio, fim) > MAX_DIAS) {
            setErro('O bloqueio pode ter no máximo 1 ano.');
            return;
        }
        const dias = eachDate(inicio, fim);
        const jaBloqueado = dias.map(d => findBloqueio(bloqueios, d)).find(Boolean);
        if (jaBloqueado) {
            setErro(`Parte deste período já está bloqueada (${rotuloBloqueio(jaBloqueado)}: ${formatDateBR(jaBloqueado.data_inicio)} a ${formatDateBR(jaBloqueado.data_fim)}).`);
            return;
        }
        const ocupados = ocupam.filter(f => dias.some(d => freelaCobre(f, d)));
        if (ocupados.length > 0) {
            const { texto, mantido } = resumoExistentes(ocupados);
            if (precisaConfirmar(`${texto} ${mantido}, mas a data ficará bloqueada para novos freelas. Deseja bloquear mesmo assim?`)) return;
        }

        onSaveBloqueio({
            id: `bloqueio_${Date.now()}`,
            tipo: justificativa as TipoBloqueio,
            data_inicio: inicio,
            data_fim: fim,
            motivo: justificativa === 'outros' ? (motivo.trim() || null) : null,
            created_at: new Date().toISOString(),
        });
    };

    // ---- Festival / cachê único ----
    const submitFestival = () => {
        if (!dataFim || dataFim <= inicio) {
            setErro('Festival ou cachê único precisa de mais de um dia: a data de término deve ser posterior à de início.');
            return;
        }
        if (daysBetween(inicio, dataFim) > MAX_DIAS) {
            setErro('O período pode ter no máximo 1 ano.');
            return;
        }
        const dias = eachDate(inicio, dataFim);
        const diaBloqueado = dias.find(d => findBloqueio(bloqueios, d));
        if (diaBloqueado) {
            const b = findBloqueio(bloqueios, diaBloqueado)!;
            setErro(`O período inclui uma data bloqueada (${rotuloBloqueio(b)} em ${formatDateBR(diaBloqueado)}). Desbloqueie antes de cadastrar o festival.`);
            return;
        }
        // Com sub no festival, eu fico livre: não há o que alertar
        const outros = formData.sub ? [] : ocupam.filter(f => f.id !== editingId && dias.some(d => freelaCobre(f, d)));
        if (outros.length > 0) {
            const { texto, mantido } = resumoExistentes(outros);
            if (precisaConfirmar(`${texto} ${mantido} e ${outros.length > 1 ? 'essas datas aparecerão' : 'a data aparecerá'} como alterada${outros.length > 1 ? 's' : ''} no calendário. Deseja continuar?`)) return;
        }

        onSave(montarFreela({ data_fim: dataFim }));
    };

    // ---- Freela de um dia (com recorrência opcional) ----
    const submitFreela = () => {
        const mesmaData = isEditing && freelaToEdit!.data_evento === inicio;

        // Datas bloqueadas (férias/outros) não aceitam freela
        const bloqueioBase = findBloqueio(bloqueios, inicio);
        if (bloqueioBase && !mesmaData) {
            setErro(`${formatDateBR(inicio)} está bloqueado (${rotuloBloqueio(bloqueioBase)}). Toque na data no calendário para desbloquear antes de cadastrar um freela.`);
            return;
        }

        const ocorrencias = (!isEditing && repetirSemanas > 0)
            ? Array.from({ length: repetirSemanas }, (_, i) => addDays(inicio, (i + 1) * 7))
            : [];
        const puladas = ocorrencias.filter(d => findBloqueio(bloqueios, d));
        const datas = [inicio, ...ocorrencias.filter(d => !findBloqueio(bloqueios, d))];

        // Com sub, eu não estou no evento: sem alerta de festival nem conflito de horário
        const comSub = !!formData.sub;

        // Freela adicional dentro de um festival: alerta antes de cadastrar
        if (!mesmaData && !comSub) {
            const emFestival = datas
                .map(d => ({ d, f: findFestival(ocupam, d, editingId) }))
                .filter((x): x is { d: string; f: Freela } => !!x.f);
            if (emFestival.length > 0) {
                const f = emFestival[0].f;
                const datasTexto = emFestival.map(x => formatShortBR(x.d)).join(', ');
                if (precisaConfirmar(
                    `${datasTexto} ${emFestival.length > 1 ? 'estão' : 'está'} dentro do período do festival "${f.descricao}" (${periodoFreelaTexto(f)}). ` +
                    'Deseja cadastrar este freela adicional mesmo assim? A data ficará marcada como alterada no calendário.'
                )) return;
            }
        }

        // Conflito de horário no mesmo dia (freelas de um dia só)
        const { horario_inicio, horario_fim } = formData;
        if (!comSub && horario_inicio && horario_fim && inicio) {
            const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
            const ini = toMin(horario_inicio);
            let fim = toMin(horario_fim);
            if (fim <= ini) fim += 24 * 60;

            const conflitante = ocupam.find(ex => {
                if (ex.id === editingId || isMultiDay(ex)) return false;
                if (ex.data_evento !== inicio || !ex.horario_inicio || !ex.horario_fim) return false;
                const exIni = toMin(ex.horario_inicio);
                let exFim = toMin(ex.horario_fim);
                if (exFim <= exIni) exFim += 24 * 60;
                return ini < exFim && exIni < fim;
            });
            if (conflitante) {
                onConflict(conflitante, formData);
                return;
            }
        }

        const base = montarFreela({});

        if (ocorrencias.length > 0) {
            const lote = datas.map((d, i) => {
                const deslocamento = daysBetween(inicio, d);
                return {
                    ...base,
                    id: `freela_${Date.now()}_${i}`,
                    data_evento: d,
                    data_vencimento: base.data_vencimento ? addDays(base.data_vencimento, deslocamento) : null,
                    sub: base.sub && i > 0 ? { ...base.sub, pago: false, data_pagamento: null } : base.sub,
                };
            });
            onSaveMany(lote, puladas);
            return;
        }

        onSave(base);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErro(null);
        if (!inicio) {
            setErro('Informe a data.');
            return;
        }
        if (modo === 'bloqueio' && justificativa !== 'festival') return submitBloqueio();
        if (festivalMode) return submitFestival();
        return submitFreela();
    };

    const confirmarAviso = () => {
        confirmadoRef.current = true;
        formRef.current?.requestSubmit();
    };

    const cargaHoraria = useMemo(() => {
        const { horario_inicio, horario_fim } = formData;
        if (!horario_inicio || !horario_fim) return null;
        const [sh, sm] = horario_inicio.split(':').map(Number);
        const [eh, em] = horario_fim.split(':').map(Number);
        let start = sh * 60 + sm;
        let end = eh * 60 + em;
        if (end < start) end += 24 * 60; // atravessa a meia-noite
        const duracao = end - start;
        if (isNaN(duracao) || duracao <= 0) return null;
        const h = Math.floor(duracao / 60);
        const m = duracao % 60;
        return `Carga horária${festivalMode ? ' diária' : ''}: ${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m` : ''}`.trim();
    }, [formData.horario_inicio, formData.horario_fim, festivalMode]);

    const diasPeriodo = (modo === 'bloqueio' || festivalMode) && dataFim && dataFim >= inicio
        ? daysBetween(inicio, dataFim) + 1
        : 1;

    const titulo = modo === 'bloqueio'
        ? 'Bloquear Data'
        : isEditing ? (festivalMode ? 'Editar Festival' : 'Editar Freela')
        : isDuplicating ? 'Duplicar Freela' : 'Novo Freela';

    const textoBotao = festivalMode
        ? 'Salvar Festival'
        : modo === 'bloqueio'
            ? (periodo === 'intervalo' && diasPeriodo > 1 ? `Bloquear ${diasPeriodo} dias` : 'Bloquear data')
            : 'Salvar Freela';

    const req = festivalMode; // no festival, todos os campos são obrigatórios (exceto observações)
    const ast = req ? ' *' : '';

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={titulo} titleIcon={modo === 'bloqueio' ? '🚫' : '📝'}>
            <form ref={formRef} onSubmit={handleSubmit} className="p-6 space-y-4">

                {isNovo && (
                    <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setModo('freela')}
                            className={`py-2 rounded-lg text-sm font-bold transition-colors ${modo === 'freela' ? 'bg-blue-600 text-white shadow' : 'text-gray-600'}`}
                        >
                            📝 Freela
                        </button>
                        <button
                            type="button"
                            onClick={() => setModo('bloqueio')}
                            className={`py-2 rounded-lg text-sm font-bold transition-colors ${modo === 'bloqueio' ? 'bg-gray-700 text-white shadow' : 'text-gray-600'}`}
                        >
                            🚫 Bloquear data
                        </button>
                    </div>
                )}

                {modo === 'bloqueio' && (
                    <div>
                        <span className={labelClass}>Justificativa *</span>
                        <div className="grid grid-cols-3 gap-2">
                            {JUSTIFICATIVAS.map(j => (
                                <button
                                    key={j.id}
                                    type="button"
                                    onClick={() => escolherJustificativa(j.id)}
                                    className={`p-2 rounded-xl border-2 text-center transition-colors ${justificativa === j.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}`}
                                >
                                    <div className="text-2xl">{j.icon}</div>
                                    <div className="text-xs font-bold text-gray-900 leading-tight mt-1">{j.titulo}</div>
                                    <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{j.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {modo === 'bloqueio' && !festivalMode && (
                    <>
                        <div>
                            <label htmlFor="dataInicioBloqueio" className={labelClass}>Data de início *</label>
                            <input type="date" id="dataInicioBloqueio" name="data_evento" value={inicio} onChange={handleChange} required className={inputClass} />
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="radio" name="periodo" checked={periodo === 'dia'} onChange={() => setPeriodo('dia')} className="w-5 h-5" />
                                <span className="text-sm font-medium text-gray-800">Bloquear apenas este dia</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="periodo"
                                    checked={periodo === 'intervalo'}
                                    onChange={() => { setPeriodo('intervalo'); if (!dataFim || dataFim < inicio) setDataFim(addDays(inicio, 1)); }}
                                    className="w-5 h-5"
                                />
                                <span className="text-sm font-medium text-gray-800">Bloquear até uma data</span>
                            </label>
                            {periodo === 'intervalo' && (
                                <div>
                                    <label htmlFor="dataFimBloqueio" className={labelClass}>Data de término *</label>
                                    <input type="date" id="dataFimBloqueio" value={dataFim} min={inicio} onChange={(e) => setDataFim(e.target.value)} required className={inputClass} />
                                    {diasPeriodo > 1 && <p className="text-xs text-gray-600 mt-1">{diasPeriodo} dias bloqueados</p>}
                                </div>
                            )}
                        </div>
                        {justificativa === 'outros' && (
                            <div>
                                <label htmlFor="motivoBloqueio" className={labelClass}>Motivo (opcional)</label>
                                <input
                                    type="text"
                                    id="motivoBloqueio"
                                    list="motivos-sugeridos"
                                    value={motivo}
                                    onChange={(e) => setMotivo(e.target.value)}
                                    maxLength={60}
                                    className={inputClass}
                                    placeholder="Ex: doença, compromisso pessoal"
                                />
                                <datalist id="motivos-sugeridos">
                                    <option value="Doença" />
                                    <option value="Indisponível" />
                                    <option value="Compromisso pessoal" />
                                    <option value="Viagem" />
                                </datalist>
                            </div>
                        )}
                    </>
                )}

                {mostraCamposFreela && (
                    <>
                        {festivalMode && (
                            <div className="bg-violet-50 border-2 border-violet-200 rounded-lg p-3 text-xs text-gray-700">
                                🎪 Todos os campos são obrigatórios. O <strong>cachê é único</strong> para todo o período e as datas ficam bloqueadas no calendário.
                            </div>
                        )}
                        <div>
                            <label htmlFor="descricao" className={labelClass}>{festivalMode ? 'Nome do festival *' : 'Descrição *'}</label>
                            <input type="text" id="descricao" name="descricao" value={formData.descricao || ''} onChange={handleChange} maxLength={100} required className={inputClass} placeholder={festivalMode ? 'Ex: Rock in Rio' : 'Ex: Show no Bar do João'} />
                        </div>
                        <div>
                            <label htmlFor="valor" className={labelClass}>{festivalMode ? 'Cachê único do período (R$) *' : 'Valor (R$) *'}</label>
                            <input type="number" id="valor" name="valor" value={formData.valor || ''} onChange={handleValorChange} step="0.01" min="0.01" required className={inputClass} placeholder="0,00" />
                        </div>
                        {festivalMode ? (
                            <div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="dataEvento" className={labelClass}>Data de início *</label>
                                        <input type="date" id="dataEvento" name="data_evento" value={inicio} onChange={handleChange} required className={inputClass} />
                                    </div>
                                    <div>
                                        <label htmlFor="dataFimFestival" className={labelClass}>Data de término *</label>
                                        <input type="date" id="dataFimFestival" value={dataFim} min={inicio ? addDays(inicio, 1) : undefined} onChange={(e) => setDataFim(e.target.value)} required className={inputClass} />
                                    </div>
                                </div>
                                {diasPeriodo > 1 && <p className="text-xs text-gray-600 mt-1">{diasPeriodo} dias de festival</p>}
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="dataEvento" className={labelClass}>Data do Evento *</label>
                                <input type="date" id="dataEvento" name="data_evento" value={inicio} onChange={handleChange} required className={inputClass} />
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="horarioInicio" className={labelClass}>Horário Início{ast}</label>
                                <input type="time" id="horarioInicio" name="horario_inicio" value={formData.horario_inicio || ''} onChange={handleChange} required={req} className={inputClass} />
                            </div>
                            <div>
                                <label htmlFor="horarioFim" className={labelClass}>Horário Fim{ast}</label>
                                <input type="time" id="horarioFim" name="horario_fim" value={formData.horario_fim || ''} onChange={handleChange} required={req} className={inputClass} />
                            </div>
                        </div>
                        {cargaHoraria && (
                            <div className="text-center text-sm font-medium text-gray-700 bg-gray-100 p-2 rounded-lg -mt-2 border border-gray-200">
                                {cargaHoraria}
                            </div>
                        )}
                        <div>
                            <label htmlFor="dataVencimento" className={labelClass}>Data de Vencimento{ast}</label>
                            <input type="date" id="dataVencimento" name="data_vencimento" value={formData.data_vencimento || ''} onChange={handleChange} required={req} className={inputClass} />
                        </div>
                        <div>
                            <label htmlFor="tipoServico" className={labelClass}>Tipo de Serviço{ast}</label>
                            <select id="tipoServico" name="tipo_servico" value={formData.tipo_servico || ''} onChange={handleChange} required={req} className={inputClass}>
                                {Object.values(TipoServico).map(v => <option key={v} value={v}>{v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="categoria" className={labelClass}>Categoria{ast}</label>
                            <select id="categoria" name="categoria" value={formData.categoria || ''} onChange={handleChange} required={req} className={inputClass}>
                                {Object.values(Categoria).map(v => <option key={v} value={v}>{v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                            </select>
                        </div>
                        {formData.categoria === 'outro' && (
                            <div>
                                <label htmlFor="categoria_customizada" className={labelClass}>Especifique a Categoria *</label>
                                <input type="text" id="categoria_customizada" name="categoria_customizada" value={formData.categoria_customizada || ''} onChange={handleChange} required className={inputClass} placeholder="Ex: Roadie" />
                            </div>
                        )}
                        <div>
                            <label htmlFor="local" className={labelClass}>Local{ast}</label>
                            <input type="text" id="local" name="local" list="locais-sugeridos" value={formData.local || ''} onChange={handleChange} required={req} className={inputClass} placeholder="Ex: Teatro Municipal" />
                            <datalist id="locais-sugeridos">
                                {locais.map(l => <option key={l} value={l} />)}
                            </datalist>
                        </div>
                        <div>
                            <label htmlFor="contratante" className={labelClass}>Contratante{ast}</label>
                            <input type="text" id="contratante" name="contratante" list="contratantes-sugeridos" value={formData.contratante || ''} onChange={handleChange} required={req} className={inputClass} placeholder="Ex: João Silva" />
                            <datalist id="contratantes-sugeridos">
                                {contratantes.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>
                        <div>
                            <label htmlFor="observacoes" className={labelClass}>Observações</label>
                            <textarea id="observacoes" name="observacoes" value={formData.observacoes || ''} onChange={handleChange} rows={3} className={inputClass} placeholder="Informações adicionais..."></textarea>
                        </div>
                        <div className="bg-teal-50 border-2 border-teal-200 rounded-lg p-4 space-y-3">
                            {!sub ? (
                                <button type="button" onClick={() => alterarSub({})} className="w-full flex items-center gap-3 text-left">
                                    <span className="text-2xl">🔁</span>
                                    <div>
                                        <div className="font-semibold text-gray-900">➕ Adicionar sub</div>
                                        <div className="text-xs text-gray-600">Não vai poder ir? Mande alguém no seu lugar. A data fica livre para outro freela e o repasse entra no relatório.</div>
                                    </div>
                                </button>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-gray-900">🔁 Sub no meu lugar</span>
                                        <button type="button" onClick={() => setFormData(prev => ({ ...prev, sub: null }))} className="text-xs font-semibold text-red-600 underline">
                                            Remover sub
                                        </button>
                                    </div>
                                    <div>
                                        <label htmlFor="subNome" className={labelClass}>Nome do sub *</label>
                                        <input type="text" id="subNome" list="subs-sugeridos" value={sub.nome} onChange={(e) => alterarNomeSub(e.target.value)} required maxLength={60} className={inputClass} placeholder="Quem vai no seu lugar" />
                                        <datalist id="subs-sugeridos">
                                            {subsSugeridos.map(s => <option key={s.nome} value={s.nome} />)}
                                        </datalist>
                                    </div>
                                    <div>
                                        <label htmlFor="subContato" className={labelClass}>WhatsApp do sub</label>
                                        <input type="tel" id="subContato" value={sub.contato || ''} onChange={(e) => alterarSub({ contato: e.target.value })} className={inputClass} placeholder="(11) 99999-9999" />
                                    </div>
                                    <div>
                                        <span className={labelClass}>Quanto vai para o sub? *</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => alterarSub({ integral: true })}
                                                className={`p-2 rounded-lg border-2 text-sm font-semibold bg-white text-gray-900 ${sub.integral ? 'border-teal-600' : 'border-gray-200'}`}
                                            >
                                                Cachê integral
                                                <span className="block text-xs font-normal text-gray-600">{brl(formData.valor || 0)}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => alterarSub({ integral: false })}
                                                className={`p-2 rounded-lg border-2 text-sm font-semibold bg-white text-gray-900 ${!sub.integral ? 'border-teal-600' : 'border-gray-200'}`}
                                            >
                                                Outro valor
                                                <span className="block text-xs font-normal text-gray-600">parte do cachê</span>
                                            </button>
                                        </div>
                                        {!sub.integral && (
                                            <div className="mt-2">
                                                <label htmlFor="subValor" className={labelClass}>Valor do repasse (R$) *</label>
                                                <input
                                                    type="number"
                                                    id="subValor"
                                                    value={sub.valor || ''}
                                                    onChange={(e) => alterarSub({ valor: e.target.value === '' ? 0 : parseFloat(e.target.value) })}
                                                    step="0.01"
                                                    min="0.01"
                                                    required
                                                    className={inputClass}
                                                    placeholder="0,00"
                                                />
                                            </div>
                                        )}
                                        {(() => {
                                            const valor = formData.valor || 0;
                                            const repasse = sub.integral ? valor : (sub.valor || 0);
                                            const sobra = valor - repasse;
                                            return (
                                                <p className="text-xs text-gray-700 mt-2">
                                                    Você recebe {brl(valor)} do contratante, repassa {brl(repasse)} e{' '}
                                                    {sobra >= 0
                                                        ? <>fica com <strong className="text-teal-700">{brl(sobra)}</strong>.</>
                                                        : <>tem <strong className="text-red-600">prejuízo de {brl(-sobra)}</strong>.</>}
                                                </p>
                                            );
                                        })()}
                                    </div>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={sub.pago} onChange={(e) => alterarSub({ pago: e.target.checked, data_pagamento: null })} className="w-5 h-5" />
                                        <span className="text-sm font-medium text-gray-800">Já paguei o sub</span>
                                    </label>
                                </>
                            )}
                        </div>
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" id="declaraMei" name="declara_mei" checked={formData.declara_mei || false} onChange={handleChange} className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500" />
                                <div>
                                    <div className="font-semibold text-gray-900">Declarar como MEI</div>
                                    <div className="text-xs text-gray-600">Este freela será contabilizado no limite mensal MEI.</div>
                                </div>
                            </label>
                        </div>
                        {!isEditing && !festivalMode && (
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
                                <p className="text-xs text-gray-600 mt-1">Cria cópias nas próximas semanas, no mesmo dia e horário. Semanas em datas bloqueadas são puladas.</p>
                            </div>
                        )}
                    </>
                )}

                <div ref={mensagemRef} className="space-y-4 empty:hidden">
                {erro && (
                    <div className="bg-red-50 border-2 border-red-300 text-red-800 rounded-lg p-3 text-sm font-medium" role="alert">
                        🚫 {erro}
                    </div>
                )}

                {aviso && (
                    <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-3 space-y-3" role="alert">
                        <p className="text-sm text-amber-900 font-medium">⚠️ {aviso}</p>
                        <button type="button" onClick={confirmarAviso} className="w-full bg-amber-500 text-white py-2.5 rounded-lg hover:bg-amber-600 transition-colors font-semibold">
                            Continuar mesmo assim
                        </button>
                    </div>
                )}
                </div>

                <button
                    type="submit"
                    className={`w-full text-white py-3 rounded-lg transition-colors font-medium ${modo === 'bloqueio' && !festivalMode ? 'bg-gray-700 hover:bg-gray-800' : festivalMode ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    {textoBotao}
                </button>
            </form>
        </BaseModal>
    );
};

export default FreelaFormModal;
