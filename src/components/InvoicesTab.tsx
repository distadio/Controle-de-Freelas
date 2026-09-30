import React, { useMemo, useState } from 'react';
import { Freela } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { nameKey } from '../services/textService';
import { periodoFreelaTexto } from '../services/bloqueioService';
import { Marca, MARCA_PADRAO } from '../services/marcaService';
import {
    InvoiceOps, InvoiceRegistro, InvoiceData, SituacaoInvoice, SITUACAO_INVOICE,
    situacaoInvoice, gerarInvoicePdf, nomeArquivoInvoice,
} from '../services/invoiceService';

interface InvoicesTabProps {
    freelas: Freela[];
    ops: InvoiceOps;
    onIrParaRelatorio: () => void;
}

type Filtro = 'todas' | 'abertas' | 'pagas' | 'canceladas';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const dataBR = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');
const hojeStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const emAberto = (s: SituacaoInvoice) => s === 'aberta' || s === 'vencida' || s === 'parcial';

const STATUS_FREELA: Record<string, { texto: string; cor: string }> = {
    pago: { texto: 'Pago', cor: 'text-green-700' },
    pendente: { texto: 'Pendente', cor: 'text-amber-700' },
    atrasada: { texto: 'Atrasado', cor: 'text-red-600' },
};

const InvoicesTab: React.FC<InvoicesTabProps> = ({ freelas, ops, onIrParaRelatorio }) => {
    const hoje = hojeStr();
    const [filtro, setFiltro] = useState<Filtro>('todas');
    const [busca, setBusca] = useState('');
    const [expandida, setExpandida] = useState<string | null>(null);

    const lista = useMemo(() => ops.lista
        .map(inv => ({ inv, ...situacaoInvoice(inv, freelas, hoje) }))
        .sort((a, b) => b.inv.emissao.localeCompare(a.inv.emissao) || b.inv.numero.localeCompare(a.inv.numero)),
    [ops.lista, freelas, hoje]);

    const abertas = lista.filter(x => emAberto(x.situacao));
    const pagas = lista.filter(x => x.situacao === 'paga');
    const termo = nameKey(busca);
    const visiveis = lista
        .filter(x => filtro === 'todas'
            || (filtro === 'abertas' && emAberto(x.situacao))
            || (filtro === 'pagas' && x.situacao === 'paga')
            || (filtro === 'canceladas' && x.situacao === 'cancelada'))
        .filter(x => !termo || nameKey(x.inv.contratante).includes(termo) || x.inv.numero.includes(termo));

    if (ops.lista.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm p-6 text-center space-y-3">
                <p className="text-4xl">🧾</p>
                <p className="text-sm font-bold text-gray-900">Nenhuma invoice emitida ainda</p>
                <p className="text-xs text-gray-600">
                    Gere uma invoice na aba Relatório. Ela aparece aqui assim que for enviada ou baixada, para você dar baixa quando for paga e tirar a 2ª via.
                </p>
                <button onClick={onIrParaRelatorio} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                    📊 Ir para o relatório
                </button>
            </div>
        );
    }

    const chips: { id: Filtro; texto: string }[] = [
        { id: 'todas', texto: `Todas (${lista.length})` },
        { id: 'abertas', texto: `Em aberto (${abertas.length})` },
        { id: 'pagas', texto: `Pagas (${pagas.length})` },
        { id: 'canceladas', texto: 'Canceladas' },
    ];

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-xl p-3 shadow">
                    <p className="text-[10px] font-semibold uppercase opacity-90">A receber</p>
                    <p className="text-lg font-bold">{brl(abertas.reduce((s, x) => s + x.inv.total, 0))}</p>
                    <p className="text-[10px] opacity-90">{abertas.length} invoice{abertas.length !== 1 ? 's' : ''} em aberto</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-xl p-3 shadow">
                    <p className="text-[10px] font-semibold uppercase opacity-90">Recebido</p>
                    <p className="text-lg font-bold">{brl(pagas.reduce((s, x) => s + x.inv.total, 0))}</p>
                    <p className="text-[10px] opacity-90">{pagas.length} invoice{pagas.length !== 1 ? 's' : ''} paga{pagas.length !== 1 ? 's' : ''}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                    {chips.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setFiltro(c.id)}
                            className={`text-xs font-semibold px-2.5 py-1.5 rounded-full ${filtro === c.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                            {c.texto}
                        </button>
                    ))}
                </div>
                <input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por contratante ou nº"
                    aria-label="Buscar invoice"
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                />
            </div>

            {visiveis.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-6">Nenhuma invoice neste filtro.</p>
            ) : (
                <div className="space-y-2.5">
                    {visiveis.map(x => (
                        <CartaoInvoice
                            key={x.inv.id}
                            inv={x.inv}
                            situacao={x.situacao}
                            pagaEm={x.pagaEm}
                            freelas={freelas}
                            ops={ops}
                            hoje={hoje}
                            aberto={expandida === x.inv.id}
                            onAlternar={() => setExpandida(expandida === x.inv.id ? null : x.inv.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const CartaoInvoice: React.FC<{
    inv: InvoiceRegistro;
    situacao: SituacaoInvoice;
    pagaEm: string | null;
    freelas: Freela[];
    ops: InvoiceOps;
    hoje: string;
    aberto: boolean;
    onAlternar: () => void;
}> = ({ inv, situacao, pagaEm, freelas, ops, hoje, aberto, onAlternar }) => {
    const [marca] = useLocalStorage<Marca>('controle_freelas_marca', MARCA_PADRAO);
    const [confirmar, setConfirmar] = useState<'pagar' | 'cancelar' | 'excluir' | null>(null);
    const [dataPagamento, setDataPagamento] = useState(hoje);
    const [gerando, setGerando] = useState(false);
    const [segundaVia, setSegundaVia] = useState<{ blob: Blob; arquivo: string } | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);

    const estilo = SITUACAO_INVOICE[situacao];
    const n = inv.itens.length;

    // A 2ª via sai com os dados da emissão; paga, vira recibo (sem PIX)
    const gerarSegundaVia = async () => {
        setGerando(true);
        setAviso(null);
        try {
            const dados: InvoiceData = {
                numero: inv.numero,
                emissao: inv.emissao,
                vencimento: inv.vencimento,
                prestador: inv.prestador,
                contratante: inv.contratante,
                itens: inv.itens,
                observacoes: inv.observacoes || undefined,
                pix: inv.pix,
                marca: { ...marca, cor: inv.cor || marca.cor },
                segundaVia: true,
                pagaEm: situacao === 'paga' ? pagaEm : null,
            };
            const blob = await gerarInvoicePdf(dados);
            setSegundaVia({ blob, arquivo: nomeArquivoInvoice(dados).replace('.pdf', '-2a-via.pdf') });
        } catch (e) {
            console.error('Falha ao gerar 2ª via:', e);
            setAviso('Não foi possível gerar a 2ª via. Tente novamente.');
        } finally {
            setGerando(false);
        }
    };

    const baixar = () => {
        if (!segundaVia) return;
        const url = URL.createObjectURL(segundaVia.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = segundaVia.arquivo;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    };

    const abrir = () => {
        if (!segundaVia) return;
        const url = URL.createObjectURL(segundaVia.blob);
        const janela = window.open(url, '_blank');
        if (!janela) {
            baixar();
            setAviso('O navegador bloqueou a nova aba: o PDF foi baixado. Abra o arquivo para imprimir.');
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    };

    const enviar = async () => {
        if (!segundaVia) return;
        const arquivo = new File([segundaVia.blob], segundaVia.arquivo, { type: 'application/pdf' });
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (nav.canShare && nav.canShare({ files: [arquivo] })) {
            try {
                await nav.share({ files: [arquivo], title: `Invoice ${inv.numero} (2ª via)`, text: `Segue a 2ª via da invoice nº ${inv.numero} (${brl(inv.total)}).` });
            } catch (e) {
                if ((e as Error).name !== 'AbortError') setAviso('Não foi possível compartilhar. Use "Baixar".');
            }
        } else {
            baixar();
            setAviso('Este navegador não envia arquivos direto para outros apps. O PDF foi baixado.');
        }
    };

    return (
        <div className={`bg-white rounded-xl shadow-sm overflow-hidden ${situacao === 'cancelada' ? 'opacity-70' : ''}`}>
            <button onClick={onAlternar} className="w-full text-left p-3" aria-expanded={aberto}>
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900">Nº {inv.numero}</p>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${estilo.selo}`}>{estilo.texto}</span>
                        </div>
                        <p className="text-xs text-gray-700 truncate mt-0.5">{inv.contratante} • {n} serviço{n !== 1 ? 's' : ''}</p>
                        <p className="text-[11px] text-gray-500">
                            Emitida {dataBR(inv.emissao)} • {situacao === 'paga' && pagaEm ? `paga ${dataBR(pagaEm)}` : `vence ${dataBR(inv.vencimento)}`}
                        </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <p className="text-base font-black text-gray-900 whitespace-nowrap">{brl(inv.total)}</p>
                        <span className="text-[11px] text-gray-400">{aberto ? '▲' : '▼'}</span>
                    </div>
                </div>
            </button>

            {aberto && (
                <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
                    <ul className="space-y-1.5">
                        {inv.itens.map(item => {
                            const atual = freelas.find(f => f.id === item.id);
                            const st = atual ? STATUS_FREELA[atual.status] || STATUS_FREELA.pendente : null;
                            return (
                                <li key={item.id} className="flex items-start justify-between gap-2 text-xs">
                                    <div className="min-w-0">
                                        <p className="text-gray-800 font-semibold truncate">{item.descricao}</p>
                                        <p className="text-gray-500">
                                            {periodoFreelaTexto(item)}
                                            {st ? <span className={`font-semibold ${st.cor}`}> • {st.texto}</span> : <span className="text-gray-400"> • freela excluído</span>}
                                        </p>
                                    </div>
                                    <span className="font-bold text-gray-900 whitespace-nowrap">{brl(item.valor)}</span>
                                </li>
                            );
                        })}
                    </ul>

                    {/* Pagamento */}
                    {situacao !== 'cancelada' && situacao !== 'paga' && (
                        confirmar === 'pagar' ? (
                            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 space-y-2">
                                <p className="text-xs text-green-900 font-semibold">
                                    Os {n} freela{n !== 1 ? 's' : ''} desta invoice {n !== 1 ? 'serão marcados' : 'será marcado'} como pago{n !== 1 ? 's' : ''}.
                                </p>
                                <label className="block text-xs text-green-900">
                                    Data do pagamento
                                    <input type="date" value={dataPagamento} max={hoje} onChange={(e) => setDataPagamento(e.target.value)} className="w-full mt-1 p-2 border border-green-300 rounded-lg text-sm" />
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => { ops.pagar(inv.id, dataPagamento || hoje); setConfirmar(null); setSegundaVia(null); }} className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-semibold">
                                        Confirmar pagamento
                                    </button>
                                    <button onClick={() => setConfirmar(null)} className="bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-semibold">Voltar</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmar('pagar')} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold">
                                ✅ Marcar invoice como paga
                            </button>
                        )
                    )}
                    {situacao === 'paga' && (
                        <div className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-lg p-2.5">
                            <p className="text-xs text-green-900 font-semibold">
                                {inv.paga_em ? `✅ Paga em ${dataBR(inv.paga_em)}` : '✅ Todos os freelas já foram pagos'}
                            </p>
                            {inv.paga_em && (
                                <button onClick={() => { ops.desfazerPagamento(inv.id); setSegundaVia(null); }} className="text-xs font-semibold text-green-800 underline">
                                    Desfazer
                                </button>
                            )}
                        </div>
                    )}

                    {/* 2ª via */}
                    {segundaVia ? (
                        <div className="bg-gray-50 rounded-lg p-2.5 space-y-2">
                            <p className="text-xs font-bold text-gray-800 text-center">🖨️ 2ª via pronta{situacao === 'paga' ? ' (recibo, com "PAGO")' : ''}</p>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={enviar} className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-xs font-semibold">📤 Enviar</button>
                                <button onClick={abrir} className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-xs font-semibold">🖨️ Imprimir</button>
                                <button onClick={baixar} className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg text-xs font-semibold">⬇️ Baixar</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={gerarSegundaVia} disabled={gerando} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60">
                            {gerando ? 'Gerando 2ª via...' : '🖨️ Gerar 2ª via'}
                        </button>
                    )}
                    {aviso && <p className="text-xs text-amber-700 font-semibold" role="status">{aviso}</p>}

                    {/* Cancelar / excluir */}
                    {situacao !== 'cancelada' && situacao !== 'paga' && (
                        confirmar === 'cancelar' ? (
                            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 space-y-2">
                                <p className="text-xs text-red-900 font-semibold">Cancelar a invoice {inv.numero}? Ela continua na lista como cancelada e os freelas não mudam.</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => { ops.cancelar(inv.id); setConfirmar(null); }} className="bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-semibold">Cancelar invoice</button>
                                    <button onClick={() => setConfirmar(null)} className="bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-semibold">Voltar</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmar('cancelar')} className="w-full text-xs font-semibold text-red-600 py-1">Cancelar esta invoice</button>
                        )
                    )}
                    {situacao === 'cancelada' && (
                        confirmar === 'excluir' ? (
                            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 space-y-2">
                                <p className="text-xs text-red-900 font-semibold">Excluir de vez a invoice {inv.numero}? Isso não pode ser desfeito.</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => ops.excluir(inv.id)} className="bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-semibold">Excluir</button>
                                    <button onClick={() => setConfirmar(null)} className="bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-semibold">Voltar</button>
                                </div>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmar('excluir')} className="w-full text-xs font-semibold text-red-600 py-1">Excluir invoice cancelada</button>
                        )
                    )}
                </div>
            )}
        </div>
    );
};

export default InvoicesTab;
