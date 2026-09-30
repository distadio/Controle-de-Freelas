import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Freela, Bloqueio } from '../../types';
import BaseModal from './BaseModal';
import InvoiceModal from './InvoiceModal';
import { gerarInsights, Insight, TipoInsight } from '../../services/insightsService';
import { normalizeName, nameKey } from '../../services/textService';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import {
    MESES, SITUACOES, resumir, porMesCompetencia, porMesCaixa, devedores, subsAPagar, participacao, comparacaoAnoAnterior,
} from '../../services/dashboardService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';

interface DashboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    allFreelas: Freela[];
    bloqueios?: Bloqueio[];
}

// Análise com a IA do Google (Gemini): desligada até a Generative Language API ser ativada no projeto
const IA_EXTERNA_ATIVA = false;

const ESTILO_INSIGHT: Record<TipoInsight, { rotulo: string; borda: string; selo: string }> = {
    alerta: { rotulo: 'Atenção', borda: 'border-l-red-500', selo: 'bg-red-100 text-red-800' },
    oportunidade: { rotulo: 'Oportunidade', borda: 'border-l-amber-500', selo: 'bg-amber-100 text-amber-800' },
    dica: { rotulo: 'Dica', borda: 'border-l-sky-500', selo: 'bg-sky-100 text-sky-800' },
    conquista: { rotulo: 'Conquista', borda: 'border-l-green-500', selo: 'bg-green-100 text-green-800' },
};

const CartaoInsight: React.FC<{ insight: Insight; onCobrar: (nome: string) => void }> = ({ insight, onCobrar }) => {
    const estilo = ESTILO_INSIGHT[insight.tipo];
    return (
        <div className={`bg-gray-50 rounded-lg border-l-4 ${estilo.borda} p-3`}>
            <div className="flex items-start gap-2.5">
                <span className="text-xl leading-none mt-0.5">{insight.icone}</span>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900">{insight.titulo}</p>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${estilo.selo}`}>{estilo.rotulo}</span>
                    </div>
                    <p className="text-xs text-gray-700 mt-1 leading-relaxed">{insight.texto}</p>
                    {insight.sugestao && (
                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed"><strong className="text-gray-800">Sugestão:</strong> {insight.sugestao}</p>
                    )}
                    {insight.cobrar && (
                        <button onClick={() => onCobrar(insight.cobrar!)} className="mt-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                            🧾 Cobrar {insight.cobrar}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const brl = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const eixoK = (v: number) => (v === 0 ? '0' : v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : String(v));

const hojeStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const CATEGORIAS: Record<string, { icon: string; label: string }> = {
    som: { icon: '🔊', label: 'Som' }, iluminacao: { icon: '💡', label: 'Iluminação' }, video: { icon: '📹', label: 'Vídeo' },
    producao: { icon: '🎬', label: 'Produção' }, performance: { icon: '🎭', label: 'Performance' }, bombeiro_civil: { icon: '⛑️', label: 'Bombeiro Civil' },
    seguranca_patrimonial: { icon: '🛡️', label: 'Segurança' }, fotografia: { icon: '📸', label: 'Fotografia' }, videomaker: { icon: '🎥', label: 'VideoMaker' },
    edicao_audiovisual: { icon: '✂️', label: 'Ed. Audiovisual' }, mixagem_masterizacao: { icon: '🎚️', label: 'Mix/Master' }, garcom: { icon: '🤵', label: 'Garçom' }, outro: { icon: '⚙️', label: 'Outro' },
};
const categoriaDe = (f: Freela) => {
    if (f.categoria === 'outro' && f.categoria_customizada) return { icon: '⚙️', label: f.categoria_customizada };
    return CATEGORIAS[f.categoria] || CATEGORIAS.outro;
};

const Secao: React.FC<{ titulo: string; subtitulo?: string; children: React.ReactNode }> = ({ titulo, subtitulo, children }) => (
    <section className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="text-sm font-bold text-gray-900">{titulo}</h3>
        {subtitulo && <p className="text-[11px] text-gray-500 mb-3">{subtitulo}</p>}
        <div className={subtitulo ? '' : 'mt-3'}>{children}</div>
    </section>
);

const Kpi: React.FC<{ label: string; valor: string; detalhe: string; cor?: string }> = ({ label, valor, detalhe, cor = 'text-gray-900' }) => (
    <div className="bg-white rounded-xl shadow-sm p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`text-lg font-bold mt-0.5 truncate ${cor}`}>{valor}</p>
        <p className="text-[11px] text-gray-500 leading-tight">{detalhe}</p>
    </div>
);

const BarraParticipacao: React.FC<{ rotulo: string; valor: number; pct: number; count: number; cor: string }> = ({ rotulo, valor, pct, count, cor }) => (
    <div>
        <div className="flex items-center justify-between text-sm mb-1 gap-2">
            <span className="font-semibold text-gray-800 truncate">{rotulo} <span className="text-gray-400 font-normal">({count})</span></span>
            <span className="whitespace-nowrap text-gray-900 font-bold">{brl(valor)} <span className="text-xs text-gray-500 font-medium">{pct}%</span></span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${cor} rounded-full`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
    </div>
);

const DashboardModal: React.FC<DashboardModalProps> = ({ isOpen, onClose, allFreelas, bloqueios = [] }) => {
    const hoje = hojeStr();
    const anoAtual = new Date().getFullYear();
    const mesAtual = new Date().getMonth();
    const [ano, setAno] = useState(anoAtual);
    const [contratante, setContratante] = useState('');
    const [modoGrafico, setModoGrafico] = useState<'competencia' | 'caixa'>('competencia');
    const [mesSel, setMesSel] = useState<number>(mesAtual);
    const [cobrarDe, setCobrarDe] = useState<string | null>(null);
    const [insights, setInsights] = useState<string>('');
    const [isLoadingInsights, setIsLoadingInsights] = useState(false);
    const [meiLimiteAnual] = useLocalStorage<number>('controle_freelas_mei_limite_anual', 81000);
    const [verTodosInsights, setVerTodosInsights] = useState(false);

    // Insights locais: consideram todos os contratantes do ano escolhido
    const insightsLocais = useMemo(
        () => gerarInsights({ todos: allFreelas, bloqueios, ano, hoje, meiLimite: meiLimiteAnual }),
        [allFreelas, bloqueios, ano, hoje, meiLimiteAnual],
    );
    useEffect(() => setVerTodosInsights(false), [ano]);

    const anos = useMemo(() => {
        const set = new Set(allFreelas.map(f => parseInt(f.data_evento.slice(0, 4), 10)).filter(a => !isNaN(a)));
        set.add(anoAtual);
        return [...set].sort((a, b) => b - a);
    }, [allFreelas, anoAtual]);

    const contratantesDoAno = useMemo(() => {
        const mapa = new Map<string, string>();
        allFreelas
            .filter(f => f.data_evento.startsWith(`${ano}-`))
            .forEach(f => { const k = nameKey(f.contratante); if (k && !mapa.has(k)) mapa.set(k, normalizeName(f.contratante)); });
        return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [allFreelas, ano]);

    const d = useMemo(() => {
        // Filtro de contratante vale para tudo; o ano só para o que é "do ano"
        const todos = contratante ? allFreelas.filter(f => nameKey(f.contratante) === nameKey(contratante)) : allFreelas;
        const doAno = todos.filter(f => f.data_evento.startsWith(`${ano}-`));
        const resumo = resumir(doAno, hoje);
        const competencia = porMesCompetencia(doAno, hoje);
        const caixa = porMesCaixa(todos, ano);

        // Meses já vividos com faturamento (evita que meses futuros contem como "fracos")
        const ultimoMes = ano === anoAtual ? mesAtual : 11;
        const mesesComDados = competencia.map((m, i) => ({ ...m, i })).filter(m => m.i <= ultimoMes && m.total > 0);
        const melhor = mesesComDados.reduce<typeof mesesComDados[0] | null>((a, m) => (!a || m.total > a.total ? m : a), null);
        const pior = mesesComDados.length > 1 ? mesesComDados.reduce((a, m) => (m.total < a.total ? m : a)) : null;
        const mediaMensal = mesesComDados.length ? mesesComDados.reduce((s, m) => s + m.total, 0) / mesesComDados.length : 0;

        return {
            doAno, resumo, competencia, caixa, melhor, pior, mediaMensal, mesesComDados: mesesComDados.length,
            devedores: devedores(todos, hoje),
            subsDevidos: subsAPagar(todos, hoje),
            porContratante: participacao(doAno, f => ({ k: nameKey(f.contratante) || '-', nome: normalizeName(f.contratante) || 'Sem contratante' })),
            porFuncao: participacao(doAno, f => { const c = categoriaDe(f); return { k: c.label, nome: `${c.icon} ${c.label}` }; }),
            comparacao: comparacaoAnoAnterior(todos, ano, hoje),
            anoAnteriorCompleto: todos.filter(f => f.data_evento.startsWith(`${ano - 1}-`)).reduce((s, f) => s + f.valor, 0),
        };
    }, [allFreelas, ano, contratante, hoje, anoAtual, mesAtual]);

    // Ao trocar de ano, mostra o mês atual (ano corrente) ou o melhor mês
    useEffect(() => {
        setMesSel(ano === anoAtual ? mesAtual : (d.melhor?.i ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ano]);

    useEffect(() => {
        setInsights('');
    }, [ano, contratante]);

    const handleGenerateInsights = async () => {
        setIsLoadingInsights(true);
        setInsights('');
        try {
            const { generateDashboardInsights } = await import('../../services/geminiService');
            setInsights(await generateDashboardInsights(d.doAno));
        } catch (error) {
            console.error(error);
            setInsights('Ocorreu um erro ao gerar os insights. Tente novamente.');
        } finally {
            setIsLoadingInsights(false);
        }
    };

    const { resumo } = d;
    const s = resumo.situacoes;
    const emAberto = s.aReceber.valor + s.atrasado.valor;
    const realizado = resumo.total - s.agendado.valor;
    const totalDevido = d.devedores.reduce((acc, x) => acc + x.aberto, 0);
    const totalAtrasado = d.devedores.reduce((acc, x) => acc + x.atrasado, 0);
    const temDevedorOutroAno = d.devedores.length > 0 && (contratante
        ? allFreelas.filter(f => nameKey(f.contratante) === nameKey(contratante))
        : allFreelas
    ).some(f => f.status !== 'pago' && f.data_evento <= hoje && !f.data_evento.startsWith(`${ano}-`));
    const topCliente = d.porContratante[0];
    const mes = d.competencia[mesSel];
    const mesCaixa = d.caixa[mesSel];
    const meiPct = meiLimiteAnual > 0 ? Math.min(100, Math.round((resumo.mei / meiLimiteAnual) * 100)) : 0;

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Dashboard Financeiro" titleIcon="📊" maxWidth="sm:max-w-3xl" applyPhoneAspectRatio={false}>
            <div className="p-4 sm:p-6 bg-gray-50 space-y-4">
                {/* Filtros */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="dash-ano" className="text-xs font-medium text-gray-700">Ano</label>
                        <select id="dash-ano" value={ano} onChange={(e) => setAno(parseInt(e.target.value, 10))} className="w-full mt-1 p-2 border border-gray-300 rounded-lg text-sm">
                            {anos.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="dash-contratante" className="text-xs font-medium text-gray-700">Contratante</label>
                        <select id="dash-contratante" value={contratante} onChange={(e) => setContratante(e.target.value)} className="w-full mt-1 p-2 border border-gray-300 rounded-lg text-sm">
                            <option value="">Todos</option>
                            {contratantesDoAno.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* Faturamento do ano, dividido por situação */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl p-4 shadow-lg">
                    <p className="text-[11px] font-semibold uppercase opacity-80">Faturamento {ano}</p>
                    <p className="text-3xl font-black leading-tight">{brl(resumo.total)}</p>
                    <p className="text-xs opacity-90">{resumo.count} freela{resumo.count !== 1 ? 's' : ''} • ticket médio {brl(resumo.ticket)}</p>
                    {d.comparacao.variacao !== null && (
                        <span className={`inline-block mt-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${d.comparacao.variacao >= 0 ? 'bg-white/25' : 'bg-black/25'}`}>
                            {d.comparacao.variacao >= 0 ? '▲' : '▼'} {Math.abs(d.comparacao.variacao)}% vs {ano - 1}{d.comparacao.parcial ? ' no mesmo período' : ''}
                        </span>
                    )}
                    <div className="flex h-3 rounded-full overflow-hidden bg-white/20 mt-3">
                        {SITUACOES.map(sit => s[sit.id].valor > 0 && (
                            <div key={sit.id} className={sit.barra} style={{ width: `${(s[sit.id].valor / resumo.total) * 100}%` }} title={sit.label} />
                        ))}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-3">
                        {SITUACOES.map(sit => (
                            <div key={sit.id}>
                                <span className="flex items-center gap-1.5 text-[11px] opacity-90">
                                    <span className={`w-2 h-2 rounded-full ${sit.barra}`} />{sit.label} ({s[sit.id].count})
                                </span>
                                <span className="text-sm font-bold">{brl(s[sit.id].valor)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Indicadores */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Kpi
                        label="Lucro líquido"
                        valor={brl(resumo.liquido)}
                        detalhe={resumo.subs > 0 ? `após ${brl(resumo.subs)} em subs` : 'sem repasses a subs'}
                        cor="text-emerald-600"
                    />
                    <Kpi
                        label="Em aberto"
                        valor={brl(emAberto)}
                        detalhe={s.atrasado.valor > 0 ? `${brl(s.atrasado.valor)} atrasado` : 'nada atrasado'}
                        cor={s.atrasado.valor > 0 ? 'text-red-600' : 'text-amber-600'}
                    />
                    <Kpi
                        label="Média por diária"
                        valor={brl(resumo.mediaDiaria)}
                        detalhe={`${resumo.diarias} dia${resumo.diarias !== 1 ? 's' : ''} de trabalho`}
                    />
                    <Kpi
                        label="Média mensal"
                        valor={brl(d.mediaMensal)}
                        detalhe={`em ${d.mesesComDados} ${d.mesesComDados === 1 ? 'mês' : 'meses'} com freela`}
                    />
                </div>

                {/* Insights locais */}
                <Secao
                    titulo="💡 Insights para o seu negócio"
                    subtitulo={`Gerados no próprio app a partir dos seus freelas de ${ano}${contratante ? ' (todos os contratantes)' : ''}, sem enviar seus dados para fora.`}
                >
                    <div className="space-y-2.5">
                        {(verTodosInsights ? insightsLocais : insightsLocais.slice(0, 4)).map(i => (
                            <CartaoInsight key={i.id} insight={i} onCobrar={setCobrarDe} />
                        ))}
                    </div>
                    {insightsLocais.length > 4 && (
                        <button
                            onClick={() => setVerTodosInsights(v => !v)}
                            className="w-full mt-3 py-2 text-sm font-semibold text-indigo-600 bg-gray-50 hover:bg-gray-100 rounded-lg"
                        >
                            {verTodosInsights ? 'Mostrar menos' : `Ver todos os ${insightsLocais.length} insights`}
                        </button>
                    )}
                    <p className="text-[10px] text-gray-400 mt-2 text-center">Sugestões automáticas. Não substituem a orientação de um contador.</p>
                </Secao>

                {/* Quem te deve */}
                <Secao titulo="💰 Quem te deve" subtitulo={`Trabalhos já feitos e ainda não pagos${temDevedorOutroAno ? ' (inclui anos anteriores)' : ''}`}>
                    {d.devedores.length === 0 ? (
                        <p className="text-sm text-gray-600 text-center py-3">🎉 Nenhum pagamento pendente.</p>
                    ) : (
                        <>
                            <ul className="divide-y divide-gray-100">
                                {d.devedores.slice(0, 6).map(dev => (
                                    <li key={dev.nome} className="flex items-start gap-3 py-2.5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{dev.nome}</p>
                                            <p className="text-[11px] text-gray-500 leading-snug">
                                                {dev.count} freela{dev.count !== 1 ? 's' : ''} em aberto
                                                {dev.atrasado > 0
                                                    ? <span className="block text-red-600 font-semibold">{brl(dev.atrasado)} atrasado{dev.diasAtraso > 0 ? ` há ${dev.diasAtraso} dia${dev.diasAtraso !== 1 ? 's' : ''}` : ''}</span>
                                                    : <span className="block">dentro do prazo</span>}
                                            </p>
                                        </div>
                                        <div className="flex-shrink-0 text-right">
                                            <p className="text-sm font-bold text-gray-900 whitespace-nowrap">{brl(dev.aberto)}</p>
                                            {!dev.semNome && (
                                                <button
                                                    onClick={() => setCobrarDe(dev.nome)}
                                                    className="mt-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg"
                                                >
                                                    🧾 Cobrar
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex justify-between items-center pt-2 mt-1 border-t-2 border-gray-200 text-sm">
                                <span className="font-bold text-gray-700">Total a receber</span>
                                <span className="font-black text-gray-900">
                                    {brl(totalDevido)}
                                    {totalAtrasado > 0 && <span className="block text-right text-[11px] font-semibold text-red-600">{brl(totalAtrasado)} atrasado</span>}
                                </span>
                            </div>
                        </>
                    )}
                </Secao>

                {/* Você deve aos subs */}
                {d.subsDevidos.length > 0 && (
                    <Secao titulo="🔁 Você deve aos subs" subtitulo="Repasses de trabalhos já realizados ainda não pagos">
                        <ul className="divide-y divide-gray-100">
                            {d.subsDevidos.map(sub => (
                                <li key={sub.nome} className="flex items-center justify-between py-2 text-sm">
                                    <span className="font-semibold text-gray-900 truncate">{sub.nome} <span className="text-gray-400 font-normal">({sub.count})</span></span>
                                    <span className="font-bold text-teal-700 whitespace-nowrap">{brl(sub.valor)}</span>
                                </li>
                            ))}
                        </ul>
                    </Secao>
                )}

                {/* Mês a mês */}
                <Secao titulo="📈 Mês a mês">
                    <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl mb-3">
                        <button
                            onClick={() => setModoGrafico('competencia')}
                            className={`py-1.5 rounded-lg text-xs font-bold ${modoGrafico === 'competencia' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600'}`}
                        >
                            Faturamento
                        </button>
                        <button
                            onClick={() => setModoGrafico('caixa')}
                            className={`py-1.5 rounded-lg text-xs font-bold ${modoGrafico === 'caixa' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600'}`}
                        >
                            Fluxo de caixa
                        </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mb-2">
                        {modoGrafico === 'competencia'
                            ? 'Pelo mês em que o trabalho aconteceu. Toque em um mês para ver o detalhe.'
                            : 'Pelo mês em que o dinheiro entrou (pagamento recebido) e saiu (subs pagos).'}
                    </p>
                    <ResponsiveContainer width="100%" height={220}>
                        {modoGrafico === 'competencia' ? (
                            <BarChart
                                data={d.competencia}
                                margin={{ top: 5, right: 4, left: -6, bottom: 0 }}
                                onClick={(st) => { const i = Number(st?.activeTooltipIndex); if (!isNaN(i)) setMesSel(i); }}
                            >
                                <CartesianGrid vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} interval={0} tickLine={false} />
                                <YAxis stroke="#6b7280" fontSize={10} tickFormatter={eixoK} width={40} />
                                <Tooltip formatter={(v: number) => brl(v)} cursor={{ fill: 'rgba(124,58,237,0.08)' }} />
                                {SITUACOES.map((sit, idx) => (
                                    <Bar key={sit.id} dataKey={sit.label} stackId="s" fill={sit.cor} radius={idx === SITUACOES.length - 1 ? [4, 4, 0, 0] : 0}>
                                        {d.competencia.map((_, i) => <Cell key={i} fillOpacity={i === mesSel ? 1 : 0.55} />)}
                                    </Bar>
                                ))}
                            </BarChart>
                        ) : (
                            <BarChart
                                data={d.caixa}
                                margin={{ top: 5, right: 4, left: -6, bottom: 0 }}
                                onClick={(st) => { const i = Number(st?.activeTooltipIndex); if (!isNaN(i)) setMesSel(i); }}
                            >
                                <CartesianGrid vertical={false} stroke="#e5e7eb" strokeOpacity={0.5} />
                                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} interval={0} tickLine={false} />
                                <YAxis stroke="#6b7280" fontSize={10} tickFormatter={eixoK} width={40} />
                                <Tooltip formatter={(v: number) => brl(v)} cursor={{ fill: 'rgba(124,58,237,0.08)' }} />
                                <Bar dataKey="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]}>
                                    {d.caixa.map((_, i) => <Cell key={i} fillOpacity={i === mesSel ? 1 : 0.55} />)}
                                </Bar>
                                <Bar dataKey="Pago a subs" fill="#14b8a6" radius={[4, 4, 0, 0]}>
                                    {d.caixa.map((_, i) => <Cell key={i} fillOpacity={i === mesSel ? 1 : 0.55} />)}
                                </Bar>
                            </BarChart>
                        )}
                    </ResponsiveContainer>

                    {/* Detalhe do mês selecionado */}
                    <div className="mt-3 bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                            <button onClick={() => setMesSel(m => Math.max(0, m - 1))} className="px-2 text-gray-500 font-bold" aria-label="Mês anterior">‹</button>
                            <p className="text-sm font-bold text-gray-900">{MESES_LONGOS[mesSel]} {ano}</p>
                            <button onClick={() => setMesSel(m => Math.min(11, m + 1))} className="px-2 text-gray-500 font-bold" aria-label="Próximo mês">›</button>
                        </div>
                        {modoGrafico === 'competencia' ? (
                            mes.count === 0 ? (
                                <p className="text-xs text-gray-500 text-center">Nenhum freela neste mês.</p>
                            ) : (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <span className="text-gray-600">Faturado ({mes.count})</span><span className="text-right font-bold text-gray-900">{brl(mes.total)}</span>
                                    {SITUACOES.filter(sit => mes[sit.label] > 0).map(sit => (
                                        <React.Fragment key={sit.id}>
                                            <span className="text-gray-600 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${sit.barra}`} />{sit.label}</span>
                                            <span className="text-right font-semibold text-gray-900">{brl(mes[sit.label])}</span>
                                        </React.Fragment>
                                    ))}
                                    {mes.subs > 0 && (
                                        <>
                                            <span className="text-gray-600">Repasse a subs</span><span className="text-right font-semibold text-teal-700">− {brl(mes.subs)}</span>
                                            <span className="text-gray-700 font-semibold">Líquido</span><span className="text-right font-bold text-emerald-600">{brl(mes.total - mes.subs)}</span>
                                        </>
                                    )}
                                </div>
                            )
                        ) : (
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                <span className="text-gray-600">Entrou</span><span className="text-right font-semibold text-gray-900">{brl(mesCaixa.Entradas)}</span>
                                <span className="text-gray-600">Pago a subs</span><span className="text-right font-semibold text-teal-700">− {brl(mesCaixa['Pago a subs'])}</span>
                                <span className="text-gray-700 font-semibold">Saldo do mês</span>
                                <span className={`text-right font-bold ${mesCaixa.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{brl(mesCaixa.saldo)}</span>
                            </div>
                        )}
                    </div>

                    {modoGrafico === 'competencia' && d.melhor && (
                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                            <div className="bg-gray-50 rounded-lg p-2">
                                <p className="text-gray-500">🏆 Melhor mês</p>
                                <p className="font-bold text-gray-900">{MESES[d.melhor.i]} • {brl(d.melhor.total)}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2">
                                <p className="text-gray-500">📉 Mês mais fraco</p>
                                <p className="font-bold text-gray-900">{d.pior ? `${MESES[d.pior.i]} • ${brl(d.pior.total)}` : '—'}</p>
                            </div>
                        </div>
                    )}
                    {modoGrafico === 'caixa' && (
                        <div className="flex justify-between text-xs mt-3 px-1">
                            <span className="text-gray-600">Saldo de caixa em {ano}</span>
                            <span className="font-bold text-gray-900">{brl(d.caixa.reduce((acc, m) => acc + m.saldo, 0))}</span>
                        </div>
                    )}
                </Secao>

                {/* Previsão */}
                {s.agendado.valor > 0 && (
                    <Secao titulo="🔮 Previsão" subtitulo="Freelas já agendados para os próximos meses">
                        <div className="space-y-1.5 text-sm">
                            <div className="flex justify-between"><span className="text-gray-600">Realizado até hoje</span><span className="font-semibold text-gray-900">{brl(realizado)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">Agendado ({s.agendado.count} freela{s.agendado.count !== 1 ? 's' : ''})</span><span className="font-semibold text-violet-600">+ {brl(s.agendado.valor)}</span></div>
                            <div className="flex justify-between pt-1.5 border-t border-gray-200"><span className="font-bold text-gray-800">Projeção {ano}</span><span className="font-black text-gray-900">{brl(resumo.total)}</span></div>
                            {d.anoAnteriorCompleto > 0 && (
                                <p className="text-[11px] text-gray-500 text-right">{ano - 1} fechou em {brl(d.anoAnteriorCompleto)}</p>
                            )}
                        </div>
                    </Secao>
                )}

                {/* Contratantes */}
                {!contratante && d.porContratante.length > 0 && (
                    <Secao titulo="👥 De onde vem sua receita">
                        {topCliente && topCliente.pct >= 50 && d.porContratante.length >= 1 && resumo.count >= 5 && (
                            <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5 mb-3 text-xs text-amber-900">
                                ⚠️ <strong>{topCliente.pct}%</strong> do seu faturamento vem de <strong>{topCliente.nome}</strong>. Depender muito de um só contratante é arriscado: vale buscar novos clientes.
                            </div>
                        )}
                        <div className="space-y-3">
                            {d.porContratante.slice(0, 5).map(c => (
                                <BarraParticipacao key={c.nome} rotulo={c.nome} valor={c.valor} pct={c.pct} count={c.count} cor="bg-sky-500" />
                            ))}
                            {d.porContratante.length > 5 && (() => {
                                const outros = d.porContratante.slice(5);
                                return (
                                    <BarraParticipacao
                                        rotulo={`Outros ${outros.length}`}
                                        valor={outros.reduce((acc, c) => acc + c.valor, 0)}
                                        pct={outros.reduce((acc, c) => acc + c.pct, 0)}
                                        count={outros.reduce((acc, c) => acc + c.count, 0)}
                                        cor="bg-gray-400"
                                    />
                                );
                            })()}
                        </div>
                    </Secao>
                )}

                {/* Funções */}
                {d.porFuncao.length > 0 && (
                    <Secao titulo="🏷️ Por função">
                        <div className="space-y-3">
                            {d.porFuncao.map(c => (
                                <BarraParticipacao key={c.nome} rotulo={c.nome} valor={c.valor} pct={c.pct} count={c.count} cor="bg-purple-500" />
                            ))}
                        </div>
                    </Secao>
                )}

                {/* MEI */}
                <Secao titulo={`🧾 Limite MEI ${ano}`}>
                    <div className="flex justify-between items-baseline text-sm mb-1">
                        <span className="text-gray-600">Declarado como MEI</span>
                        <span className="font-bold text-gray-900 whitespace-nowrap">{brl(resumo.mei)}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${meiPct >= 90 ? 'bg-red-500' : meiPct >= 70 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${meiPct}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                        {resumo.mei === 0
                            ? 'Nenhum freela marcado como MEI neste ano.'
                            : `${meiPct}% do limite de ${brl(meiLimiteAnual)} • restam ${brl(Math.max(0, meiLimiteAnual - resumo.mei))}`}
                    </p>
                </Secao>

                {/* IA externa (Gemini) */}
                {IA_EXTERNA_ATIVA && (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
                    <h4 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        Análise com IA (Gemini)
                    </h4>
                    <p className="text-sm text-gray-700 mb-3">
                        Dicas personalizadas sobre sazonalidade, preços, clientes e saúde financeira com base nos dados deste ano.
                    </p>
                    <button
                        onClick={handleGenerateInsights}
                        disabled={isLoadingInsights || d.doAno.length < 3}
                        className="bg-indigo-600 text-white py-2 px-5 rounded-lg hover:bg-indigo-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                    >
                        {isLoadingInsights ? 'Analisando...' : 'Gerar Insights'}
                    </button>
                    {d.doAno.length < 3 && <p className="text-xs text-indigo-700 mt-2">É necessário ter pelo menos 3 freelas registrados no ano para gerar insights.</p>}
                    {isLoadingInsights && (
                        <div className="mt-4 flex items-center justify-center p-6 bg-white rounded-lg border">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <p className="ml-3 text-gray-600">Aguarde, a IA está pensando...</p>
                        </div>
                    )}
                    {insights && (
                        <div className="mt-4 p-4 bg-white rounded-lg border prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: insights.replace(/\n/g, '<br />') }} />
                    )}
                </div>
                )}
            </div>

            {cobrarDe && ReactDOM.createPortal(
                <InvoiceModal
                    isOpen={true}
                    onClose={() => setCobrarDe(null)}
                    freelas={allFreelas}
                    contratanteInicial={cobrarDe}
                    periodoInicial={{ start: '', end: hoje }}
                />,
                document.getElementById('modal-root') || document.body
            )}
        </BaseModal>
    );
};

export default DashboardModal;
