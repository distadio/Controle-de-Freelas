import React, { useState, useMemo, useEffect } from 'react';
import { Freela } from '../../types';
import BaseModal from './BaseModal';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { normalizeName, nameKey } from '../../services/textService';
import { periodoFreelaTexto, addDays } from '../../services/bloqueioService';
import { PixConfig, TIPOS_CHAVE_PIX, validarChavePix } from '../../services/pixService';
import { Prestador, gerarInvoicePdf, nomeArquivoInvoice, periodoInvoice, totalInvoice } from '../../services/invoiceService';

interface InvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    freelas: Freela[];
    contratanteInicial?: string;
    periodoInicial?: { start: string; end: string } | null;
}

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const hoje = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const dataBR = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

const inputClass = 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm';
const labelClass = 'block text-xs font-medium text-gray-700 mb-1';

const statusInfo: Record<string, { badge: string; text: string }> = {
    pago: { badge: 'bg-green-100 text-green-800', text: 'Pago' },
    pendente: { badge: 'bg-yellow-100 text-yellow-800', text: 'Pendente' },
    atrasada: { badge: 'bg-red-100 text-red-800', text: 'Atrasado' },
};

const InvoiceModal: React.FC<InvoiceModalProps> = ({ isOpen, onClose, freelas, contratanteInicial, periodoInicial }) => {
    const [prestadorSalvo, setPrestadorSalvo] = useLocalStorage<Prestador>('controle_freelas_prestador', { nome: '', documento: '', contato: '' });
    const [pixPadrao, setPixPadrao] = useLocalStorage<PixConfig | null>('controle_freelas_pix_padrao', null);
    const [sequencia, setSequencia] = useLocalStorage<{ ano: number; n: number }>('controle_freelas_invoice_seq', { ano: 0, n: 0 });

    // Contratantes com totais em aberto (nomes normalizados, sem duplicatas)
    const contratantes = useMemo(() => {
        const mapa = new Map<string, { nome: string; aberto: number }>();
        freelas.forEach(f => {
            const k = nameKey(f.contratante);
            if (!k) return;
            const e = mapa.get(k) || { nome: normalizeName(f.contratante), aberto: 0 };
            if (f.status !== 'pago') e.aberto += f.valor;
            mapa.set(k, e);
        });
        return [...mapa.values()].sort((a, b) => b.aberto - a.aberto || a.nome.localeCompare(b.nome, 'pt-BR'));
    }, [freelas]);

    const [contratante, setContratante] = useState('');
    const [de, setDe] = useState('');
    const [ate, setAte] = useState('');
    const [somenteAbertos, setSomenteAbertos] = useState(true);
    const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
    const [vencimento, setVencimento] = useState(addDays(hoje(), 7));
    const [observacoes, setObservacoes] = useState('');
    const [prestador, setPrestador] = useState<Prestador>(prestadorSalvo);
    const [incluirPix, setIncluirPix] = useState(true);
    const [pix, setPix] = useState<PixConfig>(pixPadrao || { tipo: 'telefone', chave: '', nome: prestadorSalvo.nome, cidade: 'São Paulo' });
    const [salvarPadrao, setSalvarPadrao] = useState(!pixPadrao);
    const [gerando, setGerando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [pronto, setPronto] = useState<{ blob: Blob; arquivo: string } | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const inicial = contratanteInicial && contratantes.find(c => nameKey(c.nome) === nameKey(contratanteInicial));
        setContratante(inicial ? inicial.nome : (contratantes[0]?.nome || ''));
        setDe(periodoInicial?.start || '');
        setAte(periodoInicial?.end || '');
        setSomenteAbertos(true);
        setVencimento(addDays(hoje(), 7));
        setObservacoes('');
        setPrestador(prestadorSalvo);
        setPix(pixPadrao || { tipo: 'telefone', chave: '', nome: prestadorSalvo.nome, cidade: 'São Paulo' });
        setSalvarPadrao(!pixPadrao);
        setPronto(null);
        setErro(null);
        setAviso(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const candidatos = useMemo(() => freelas
        .filter(f => nameKey(f.contratante) === nameKey(contratante))
        .filter(f => (!de || f.data_evento >= de) && (!ate || f.data_evento <= ate))
        .filter(f => !somenteAbertos || f.status !== 'pago')
        .sort((a, b) => a.data_evento.localeCompare(b.data_evento)),
    [freelas, contratante, de, ate, somenteAbertos]);

    // Nova lista de candidatos: todos marcados por padrão
    useEffect(() => {
        setSelecionados(new Set(candidatos.map(f => f.id)));
    }, [candidatos]);

    // Qualquer alteração invalida o PDF já gerado
    useEffect(() => {
        setPronto(null);
        setErro(null);
    }, [contratante, de, ate, somenteAbertos, selecionados, vencimento, observacoes, prestador, incluirPix, pix]);

    const itens = candidatos.filter(f => selecionados.has(f.id));
    const total = totalInvoice(itens);
    const periodo = periodoInvoice(itens);

    // O número só é "consumido" quando a invoice é enviada ou baixada
    const ano = new Date().getFullYear();
    const numero = `${ano}-${String((sequencia.ano === ano ? sequencia.n : 0) + 1).padStart(4, '0')}`;

    const alternar = (id: string) => {
        setSelecionados(prev => {
            const novo = new Set(prev);
            if (novo.has(id)) novo.delete(id); else novo.add(id);
            return novo;
        });
    };

    const gerar = async () => {
        setErro(null);
        setAviso(null);
        if (itens.length === 0) return setErro('Selecione pelo menos um serviço.');
        if (!prestador.nome.trim()) return setErro('Informe seu nome em "Seus dados".');
        if (incluirPix) {
            const erroChave = validarChavePix(pix.tipo, pix.chave);
            if (erroChave) return setErro(erroChave);
            if (!pix.nome.trim()) return setErro('Informe o nome do favorecido do PIX.');
            if (!pix.cidade.trim()) return setErro('Informe a cidade do favorecido do PIX.');
        }
        setGerando(true);
        try {
            const dados = {
                numero,
                emissao: hoje(),
                vencimento,
                prestador,
                contratante,
                itens,
                observacoes,
                pix: incluirPix ? pix : null,
            };
            const blob = await gerarInvoicePdf(dados);
            setPronto({ blob, arquivo: nomeArquivoInvoice(dados) });
        } catch (e) {
            console.error('Falha ao gerar invoice:', e);
            setErro('Não foi possível gerar o PDF. Verifique sua conexão e tente novamente.');
        } finally {
            setGerando(false);
        }
    };

    const confirmarEmissao = () => {
        setSequencia({ ano, n: (sequencia.ano === ano ? sequencia.n : 0) + 1 });
        setPrestadorSalvo(prestador);
        if (incluirPix && salvarPadrao) setPixPadrao(pix);
    };

    const baixar = () => {
        if (!pronto) return;
        const url = URL.createObjectURL(pronto.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = pronto.arquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        confirmarEmissao();
    };

    const enviar = async () => {
        if (!pronto) return;
        const arquivo = new File([pronto.blob], pronto.arquivo, { type: 'application/pdf' });
        const texto = `Olá, ${contratante}! Segue a invoice nº ${numero} referente a ${itens.length} serviço${itens.length !== 1 ? 's' : ''}` +
            `${periodo ? ` de ${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}` : ''}. Total: ${brl(total)}.` +
            `${incluirPix ? ' O pagamento pode ser feito via PIX pelo QR Code ou copia e cola que estão no PDF.' : ''} Obrigado!`;
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (nav.canShare && nav.canShare({ files: [arquivo] })) {
            try {
                await nav.share({ files: [arquivo], title: `Invoice ${numero}`, text: texto });
                confirmarEmissao();
            } catch (e) {
                if ((e as Error).name !== 'AbortError') setErro('Não foi possível abrir o compartilhamento. Use "Baixar PDF".');
            }
        } else {
            baixar();
            setAviso('Este navegador não envia arquivos direto para outros apps. O PDF foi baixado: anexe-o na conversa do WhatsApp ou no e-mail.');
        }
    };

    const todosMarcados = candidatos.length > 0 && candidatos.every(f => selecionados.has(f.id));

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Gerar Invoice" titleIcon="🧾" maxWidth="sm:max-w-xl" applyPhoneAspectRatio={false}>
            <div className="p-4 space-y-4 bg-gray-50">
                {contratantes.length === 0 ? (
                    <p className="text-center py-8 text-gray-500 text-sm">Cadastre o contratante nos seus freelas para poder gerar uma invoice.</p>
                ) : (
                    <>
                        {/* Contratante e período */}
                        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                            <div>
                                <label htmlFor="invContratante" className={labelClass}>Contratante *</label>
                                <select id="invContratante" value={contratante} onChange={(e) => setContratante(e.target.value)} className={inputClass}>
                                    {contratantes.map(c => (
                                        <option key={c.nome} value={c.nome}>
                                            {c.nome}{c.aberto > 0 ? ` — ${brl(c.aberto)} em aberto` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="invDe" className={labelClass}>De</label>
                                    <input id="invDe" type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputClass} />
                                </div>
                                <div>
                                    <label htmlFor="invAte" className={labelClass}>Até</label>
                                    <input id="invAte" type="date" value={ate} min={de || undefined} onChange={(e) => setAte(e.target.value)} className={inputClass} />
                                </div>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={somenteAbertos} onChange={(e) => setSomenteAbertos(e.target.checked)} className="w-5 h-5" />
                                <span className="text-sm text-gray-800">Somente em aberto (pendentes e atrasados)</span>
                            </label>
                        </div>

                        {/* Serviços */}
                        <div className="bg-white rounded-xl shadow-sm p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-bold text-gray-900">📋 Serviços na invoice</h4>
                                {candidatos.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setSelecionados(todosMarcados ? new Set() : new Set(candidatos.map(f => f.id)))}
                                        className="text-xs font-semibold text-purple-600"
                                    >
                                        {todosMarcados ? 'Desmarcar todos' : 'Marcar todos'}
                                    </button>
                                )}
                            </div>
                            {candidatos.length === 0 ? (
                                <p className="text-center py-4 text-gray-500 text-sm">Nenhum freela {somenteAbertos ? 'em aberto ' : ''}deste contratante no período.</p>
                            ) : (
                                <div className="space-y-2">
                                    {candidatos.map(f => {
                                        const st = statusInfo[f.status] || statusInfo.pendente;
                                        return (
                                            <label key={f.id} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer ${selecionados.has(f.id) ? 'border-purple-300 bg-purple-50' : 'border-gray-200'}`}>
                                                <input type="checkbox" checked={selecionados.has(f.id)} onChange={() => alternar(f.id)} className="w-5 h-5 flex-shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 truncate">{f.descricao}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {periodoFreelaTexto(f)}{f.horario_inicio ? ` • ${f.horario_inicio}${f.horario_fim ? `–${f.horario_fim}` : ''}` : ''}
                                                    </p>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <p className="text-sm font-bold text-gray-900">{brl(f.valor)}</p>
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.badge}`}>{st.text}</span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="mt-3 pt-3 border-t-2 border-gray-200 flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-700">{itens.length} serviço{itens.length !== 1 ? 's' : ''} • Total</span>
                                <span className="text-lg font-black text-gray-900">{brl(total)}</span>
                            </div>
                        </div>

                        {/* Vencimento e observações */}
                        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                            <div>
                                <label htmlFor="invVenc" className={labelClass}>Vencimento da invoice</label>
                                <input id="invVenc" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={inputClass} />
                            </div>
                            <div>
                                <label htmlFor="invObs" className={labelClass}>Observações (opcional)</label>
                                <textarea id="invObs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} maxLength={400} className={inputClass} placeholder="Ex: favor enviar o comprovante após o pagamento." />
                            </div>
                        </div>

                        {/* Dados do prestador */}
                        <details className="bg-white rounded-xl shadow-sm p-4" open={!prestadorSalvo.nome}>
                            <summary className="text-sm font-bold text-gray-900 cursor-pointer">
                                👤 Seus dados {prestador.nome && <span className="font-normal text-gray-500">— {prestador.nome}</span>}
                            </summary>
                            <div className="space-y-3 mt-3">
                                <div>
                                    <label htmlFor="invNome" className={labelClass}>Nome *</label>
                                    <input id="invNome" value={prestador.nome} onChange={(e) => setPrestador({ ...prestador, nome: e.target.value })} className={inputClass} placeholder="Seu nome ou nome artístico" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="invDoc" className={labelClass}>CPF / CNPJ</label>
                                        <input id="invDoc" value={prestador.documento || ''} onChange={(e) => setPrestador({ ...prestador, documento: e.target.value })} className={inputClass} placeholder="Opcional" />
                                    </div>
                                    <div>
                                        <label htmlFor="invContato" className={labelClass}>Contato</label>
                                        <input id="invContato" value={prestador.contato || ''} onChange={(e) => setPrestador({ ...prestador, contato: e.target.value })} className={inputClass} placeholder="Telefone ou e-mail" />
                                    </div>
                                </div>
                            </div>
                        </details>

                        {/* PIX */}
                        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={incluirPix} onChange={(e) => setIncluirPix(e.target.checked)} className="w-5 h-5" />
                                <span className="text-sm font-bold text-gray-900">💠 Incluir pagamento via PIX (QR Code)</span>
                            </label>
                            {incluirPix && (
                                <>
                                    {pixPadrao && (
                                        <p className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-2">
                                            Sua chave padrão foi carregada. Para usar outra chave só nesta invoice, altere abaixo e deixe "salvar como padrão" desmarcado.
                                        </p>
                                    )}
                                    <div>
                                        <label htmlFor="invTipoChave" className={labelClass}>Tipo de chave</label>
                                        <select id="invTipoChave" value={pix.tipo} onChange={(e) => setPix({ ...pix, tipo: e.target.value as PixConfig['tipo'] })} className={inputClass}>
                                            {TIPOS_CHAVE_PIX.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="invChave" className={labelClass}>Chave PIX *</label>
                                        <input
                                            id="invChave"
                                            value={pix.chave}
                                            onChange={(e) => setPix({ ...pix, chave: e.target.value })}
                                            inputMode={pix.tipo === 'cpf_cnpj' || pix.tipo === 'telefone' ? 'numeric' : pix.tipo === 'email' ? 'email' : 'text'}
                                            className={inputClass}
                                            placeholder={TIPOS_CHAVE_PIX.find(t => t.id === pix.tipo)?.placeholder}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label htmlFor="invFavorecido" className={labelClass}>Favorecido *</label>
                                            <input id="invFavorecido" value={pix.nome} onChange={(e) => setPix({ ...pix, nome: e.target.value })} className={inputClass} placeholder="Titular da conta" />
                                        </div>
                                        <div>
                                            <label htmlFor="invCidade" className={labelClass}>Cidade *</label>
                                            <input id="invCidade" value={pix.cidade} onChange={(e) => setPix({ ...pix, cidade: e.target.value })} className={inputClass} />
                                        </div>
                                    </div>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input type="checkbox" checked={salvarPadrao} onChange={(e) => setSalvarPadrao(e.target.checked)} className="w-5 h-5" />
                                        <span className="text-sm text-gray-800">Salvar como minha chave PIX padrão</span>
                                    </label>
                                </>
                            )}
                        </div>

                        {erro && (
                            <div className="bg-red-50 border-2 border-red-300 text-red-800 rounded-lg p-3 text-sm font-medium" role="alert">🚫 {erro}</div>
                        )}
                        {aviso && (
                            <div className="bg-yellow-50 border-2 border-yellow-300 text-yellow-800 rounded-lg p-3 text-sm font-medium" role="status">{aviso}</div>
                        )}

                        {pronto ? (
                            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3 border-2 border-green-400">
                                <p className="text-sm font-bold text-gray-900 text-center">✅ Invoice nº {numero} pronta — {brl(total)}</p>
                                <button type="button" onClick={enviar} className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 transition font-semibold flex items-center justify-center gap-2 shadow">
                                    📤 Enviar para {contratante} (WhatsApp, e-mail...)
                                </button>
                                <button type="button" onClick={baixar} className="w-full bg-gray-100 text-gray-800 py-3 rounded-xl hover:bg-gray-200 transition font-semibold">
                                    ⬇️ Baixar PDF
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={gerar}
                                disabled={gerando || itens.length === 0}
                                className="w-full bg-purple-600 text-white py-3 rounded-xl hover:bg-purple-700 transition font-semibold shadow disabled:opacity-50"
                            >
                                {gerando ? 'Gerando PDF...' : `🧾 Gerar invoice nº ${numero} — ${brl(total)}`}
                            </button>
                        )}
                    </>
                )}
            </div>
        </BaseModal>
    );
};

export default InvoiceModal;
