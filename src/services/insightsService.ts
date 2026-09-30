import { Freela, Bloqueio } from '../types';
import { nameKey, normalizeName } from './textService';
import { addDays, daysBetween, eachDate, isMultiDay } from './bloqueioService';
import { getHoliday } from './dateService';
import { comparacaoAnoAnterior } from './dashboardService';

// Banco de insights local: regras simples sobre os próprios freelas do usuário,
// sem API externa e sem enviar dados para fora do aparelho.

export type TipoInsight = 'alerta' | 'oportunidade' | 'dica' | 'conquista';

export interface Insight {
    id: string;
    tipo: TipoInsight;
    icone: string;
    titulo: string;
    texto: string;
    sugestao?: string;
    prioridade: number; // maior aparece primeiro
    cobrar?: string; // contratante para o botão "Cobrar"
}

export interface ContextoInsights {
    todos: Freela[];
    bloqueios: Bloqueio[];
    ano: number;
    hoje: string; // YYYY-MM-DD
    meiLimite: number;
}

const brl = (v: number) => {
    const casas = v % 1 === 0 ? 0 : 2;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas }).format(v);
};
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_SEMANA = ['domingos', 'segundas', 'terças', 'quartas', 'quintas', 'sextas', 'sábados'];
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const lista = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`);
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const CATEGORIA: Record<string, string> = {
    som: 'Som', iluminacao: 'Iluminação', video: 'Vídeo', producao: 'Produção', performance: 'Performance',
    bombeiro_civil: 'Bombeiro Civil', seguranca_patrimonial: 'Segurança', fotografia: 'Fotografia', videomaker: 'VideoMaker',
    edicao_audiovisual: 'Edição audiovisual', mixagem_masterizacao: 'Mixagem/Master', garcom: 'Garçom', outro: 'Outros',
};
const TIPO: Record<string, string> = {
    show: 'Shows', evento_corporativo: 'Eventos corporativos', festa_particular: 'Festas particulares',
    casa_de_show_eventos: 'Casas de show', teatro: 'Teatro', workshop: 'Workshops', studio: 'Estúdio', outro: 'Outros',
};

// ---- Auxiliares ----
const minutosDe = (f: Freela): number | null => {
    if (!f.horario_inicio || !f.horario_fim) return null;
    const [h1, m1] = f.horario_inicio.split(':').map(Number);
    const [h2, m2] = f.horario_fim.split(':').map(Number);
    const ini = h1 * 60 + m1;
    let fim = h2 * 60 + m2;
    if (fim <= ini) fim += 24 * 60;
    return fim - ini;
};
const presencial = (f: Freela) => !f.sub && !f.entrega; // trabalhos em que eu estou lá
const diaUnico = (f: Freela) => !isMultiDay(f);
const diasDe = (f: Freela) => (isMultiDay(f) ? eachDate(f.data_evento, f.data_fim!) : [f.data_evento]);
const media = (valores: number[]) => (valores.length ? valores.reduce((s, x) => s + x, 0) / valores.length : 0);
const soma = (l: Freela[]) => l.reduce((s, f) => s + f.valor, 0);
const agrupar = (l: Freela[], chave: (f: Freela) => string) => {
    const mapa = new Map<string, Freela[]>();
    l.forEach(f => { const k = chave(f); if (k) (mapa.get(k) || mapa.set(k, []).get(k)!).push(f); });
    return mapa;
};
const nomeCliente = (l: Freela[]) => normalizeName(l[0].contratante);
const moda = (valores: string[]) => {
    const c = new Map<string, number>();
    valores.forEach(v => c.set(v, (c.get(v) || 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};

export const gerarInsights = ({ todos, bloqueios, ano, hoje, meiLimite }: ContextoInsights): Insight[] => {
    const out: Insight[] = [];
    const add = (i: Insight) => out.push(i);

    const anoAtual = parseInt(hoje.slice(0, 4), 10);
    const ehAnoAtual = ano === anoAtual;
    const mesAtual = parseInt(hoje.slice(5, 7), 10) - 1;
    const doAno = todos.filter(f => f.data_evento.startsWith(`${ano}-`));
    const doAnoAnterior = todos.filter(f => f.data_evento.startsWith(`${ano - 1}-`));
    const realizados = todos.filter(f => f.data_evento <= hoje);
    const ultimos12m = realizados.filter(f => f.data_evento > addDays(hoje, -365));
    const totalAno = soma(doAno);
    const ticketAno = doAno.length ? totalAno / doAno.length : 0;

    if (doAno.length < 5) {
        add({
            id: 'poucos-dados', tipo: 'dica', icone: '📝', prioridade: 1,
            titulo: 'Quanto mais freelas, melhores os insights',
            texto: `${doAno.length === 0 ? 'Ainda não há freelas cadastrados' : `Há só ${plural(doAno.length, 'freela cadastrado', 'freelas cadastrados')}`} em ${ano}. Com mais registros, o app identifica padrões de preço, clientes e agenda.`,
            sugestao: 'Cadastre também os freelas passados deste ano, com horário, função e contratante.',
        });
    }

    // ================= Recebimentos =================

    // Pagamentos atrasados (qualquer ano)
    const atrasados = todos.filter(f => f.status === 'atrasada');
    if (atrasados.length > 0) {
        const porCliente = [...agrupar(atrasados, f => nameKey(f.contratante) || '-').values()]
            .map(l => ({ nome: l[0].contratante ? nomeCliente(l) : '', total: soma(l) }))
            .sort((a, b) => b.total - a.total);
        const principal = porCliente[0];
        add({
            id: 'inadimplencia', tipo: 'alerta', icone: '⏰', prioridade: 95,
            titulo: 'Dinheiro parado em atraso',
            texto: `Você tem ${brl(soma(atrasados))} em ${plural(atrasados.length, 'pagamento atrasado', 'pagamentos atrasados')}` +
                (!principal.nome ? '.'
                    : porCliente.length === 1 ? `, ${atrasados.length === 1 ? 'de' : 'todos de'} ${principal.nome}.`
                        : `, principalmente de ${principal.nome} (${brl(principal.total)}).`),
            sugestao: 'Cobre logo: envie uma invoice com PIX, com a lista das datas e valores. Quanto mais o tempo passa, mais difícil fica receber.',
            cobrar: principal.nome || undefined,
        });
    } else if (realizados.length >= 5 && ehAnoAtual) {
        add({
            id: 'sem-atrasos', tipo: 'conquista', icone: '👏', prioridade: 10,
            titulo: 'Nenhum pagamento atrasado',
            texto: 'Todos os seus contratantes estão em dia. Continue enviando a cobrança logo após cada trabalho.',
        });
    }

    // Contratante que demora para pagar
    const pagos = ultimos12m.filter(f => f.status === 'pago' && f.data_pagamento && f.data_pagamento >= f.data_evento);
    if (pagos.length >= 6) {
        const prazo = (f: Freela) => daysBetween(f.data_evento, f.data_pagamento!);
        const geral = media(pagos.map(prazo));
        const lento = [...agrupar(pagos, f => nameKey(f.contratante)).values()]
            .filter(l => l.length >= 3)
            .map(l => ({ nome: nomeCliente(l), dias: media(l.map(prazo)) }))
            .sort((a, b) => b.dias - a.dias)[0];
        if (lento && lento.dias >= 20 && lento.dias >= geral * 1.3) {
            add({
                id: 'pagador-lento', tipo: 'oportunidade', icone: '🐢', prioridade: 55,
                titulo: `${lento.nome} demora para pagar`,
                texto: `${lento.nome} leva em média ${Math.round(lento.dias)} dias para pagar, contra ${Math.round(geral)} dias da média dos seus contratantes.`,
                sugestao: 'Combine por escrito um prazo (ex.: até 7 dias após o trabalho) e envie a invoice no mesmo dia. Para esse contratante, vale pedir parte adiantada.',
            });
        }
    }

    // Trabalhos grandes: pedir sinal
    if (doAno.length >= 5) {
        const grandes = doAno.filter(f => f.valor >= ticketAno * 2.5).sort((a, b) => b.valor - a.valor);
        if (grandes.length > 0) {
            add({
                id: 'sinal', tipo: 'dica', icone: '🤝', prioridade: 28,
                titulo: 'Peça sinal nos trabalhos grandes',
                texto: `${plural(grandes.length, 'trabalho', 'trabalhos')} em ${ano} ${grandes.length === 1 ? 'valeu' : 'valeram'} mais de ${brl(Math.round(ticketAno * 2.5))}, como "${grandes[0].descricao}" (${brl(grandes[0].valor)}).`,
                sugestao: 'Em trabalhos de valor alto, peça um sinal de 30% a 50% na confirmação. Isso protege sua agenda contra cancelamentos de última hora.',
            });
        }
    }

    // ================= Contratantes =================
    const porClienteAno = agrupar(doAno, f => nameKey(f.contratante));

    // Dependência de um contratante
    if (doAno.length >= 5 && totalAno > 0) {
        const top = [...porClienteAno.values()].map(l => ({ nome: nomeCliente(l), total: soma(l) })).sort((a, b) => b.total - a.total)[0];
        const p = top ? Math.round((top.total / totalAno) * 100) : 0;
        if (top && p >= 50) {
            add({
                id: 'concentracao', tipo: p >= 70 ? 'alerta' : 'oportunidade', icone: '⚖️', prioridade: p >= 70 ? 90 : 70,
                titulo: 'Dependência de um contratante',
                texto: `${p}% do seu faturamento em ${ano} veio de ${top.nome} (${brl(top.total)}). Se esse contratante diminuir os pedidos, sua renda cai na mesma proporção.`,
                sugestao: 'Uma meta saudável é nenhum contratante passar de 40% a 50%. Peça indicações a quem já te contrata e ofereça seu trabalho a 1 ou 2 novos contratantes por mês.',
            });
        } else if (porClienteAno.size <= 2 && doAno.length >= 10) {
            add({
                id: 'poucos-clientes', tipo: 'oportunidade', icone: '👥', prioridade: 50,
                titulo: 'Poucos contratantes',
                texto: `Todo o seu faturamento de ${ano} veio de ${plural(porClienteAno.size, 'contratante', 'contratantes')}.`,
                sugestao: 'Diversificar a carteira deixa sua renda mais estável. Comece pelos locais onde você já trabalha: produtores, bandas e casas vizinhas.',
            });
        }
    }

    // Contratante que paga abaixo dos outros pela mesma função
    const comparaveis = doAno.filter(f => presencial(f) && diaUnico(f));
    let abaixo: { nome: string; media: number; outros: number; n: number; cat: string } | null = null;
    agrupar(comparaveis, f => nameKey(f.contratante)).forEach((l, k) => {
        if (l.length < 3) return;
        const cat = moda(l.map(f => f.categoria));
        const doCliente = l.filter(f => f.categoria === cat);
        const outros = comparaveis.filter(f => f.categoria === cat && nameKey(f.contratante) !== k);
        if (doCliente.length < 3 || outros.length < 3) return;
        const mC = media(doCliente.map(f => f.valor));
        const mO = media(outros.map(f => f.valor));
        if (mC < mO * 0.85 && (!abaixo || doCliente.length > abaixo.n)) {
            abaixo = { nome: nomeCliente(l), media: mC, outros: mO, n: doCliente.length, cat };
        }
    });
    if (abaixo) {
        const a = abaixo as { nome: string; media: number; outros: number; n: number; cat: string };
        add({
            id: 'cliente-abaixo', tipo: 'oportunidade', icone: '📉', prioridade: 65,
            titulo: `${a.nome} paga menos que os outros`,
            texto: `Em ${CATEGORIA[a.cat] || a.cat}, ${a.nome} paga em média ${brl(Math.round(a.media))} por freela, ${Math.round((1 - a.media / a.outros) * 100)}% abaixo dos outros contratantes (${brl(Math.round(a.outros))}).`,
            sugestao: `Na próxima negociação, proponha chegar perto de ${brl(Math.round(a.outros))}. Se ele contrata com frequência, ofereça um pacote de datas em troca do reajuste.`,
        });
    }

    if (ehAnoAtual) {
        // Contratante que sumiu
        const sumido = [...agrupar(ultimos12m, f => nameKey(f.contratante)).entries()]
            .filter(([, l]) => l.length >= 3)
            .map(([k, l]) => {
                const ultima = todos.filter(f => nameKey(f.contratante) === k).reduce((m, f) => (f.data_evento > m ? f.data_evento : m), '');
                return { nome: nomeCliente(l), n: l.length, total: soma(l), ultima };
            })
            .filter(c => c.ultima < addDays(hoje, -60))
            .sort((a, b) => b.total - a.total)[0];
        if (sumido) {
            add({
                id: 'cliente-sumido', tipo: 'oportunidade', icone: '📞', prioridade: 58,
                titulo: `${sumido.nome} não te chama há um tempo`,
                texto: `Faz ${daysBetween(sumido.ultima, hoje)} dias que ${sumido.nome} não te contrata. No último ano foram ${plural(sumido.n, 'freela', 'freelas')} (${brl(sumido.total)}).`,
                sugestao: 'Mande uma mensagem com suas próximas datas livres. Reativar quem já te contratou é o jeito mais barato de conseguir trabalho.',
            });
        }

        // Contratante recorrente: propor pacote
        const recorrente = [...agrupar(realizados.filter(f => f.data_evento > addDays(hoje, -90)), f => nameKey(f.contratante)).values()]
            .filter(l => l.length >= 6)
            .sort((a, b) => b.length - a.length)[0];
        if (recorrente) {
            add({
                id: 'pacote', tipo: 'oportunidade', icone: '📦', prioridade: 48,
                titulo: `Proponha um pacote a ${nomeCliente(recorrente)}`,
                texto: `${nomeCliente(recorrente)} te contratou ${recorrente.length} vezes nos últimos 3 meses.`,
                sugestao: 'Ofereça um pacote mensal com datas fixas e pagamento no início do mês: você ganha renda previsível e ele garante sua disponibilidade.',
            });
        }
    }

    // ================= Preço =================

    // Ticket médio parado ou caindo
    if (doAno.length >= 10 && doAnoAnterior.length >= 10) {
        const tAnt = soma(doAnoAnterior) / doAnoAnterior.length;
        const v = Math.round(((ticketAno - tAnt) / tAnt) * 100);
        if (v <= -5) {
            add({
                id: 'ticket-queda', tipo: 'alerta', icone: '🔻', prioridade: 75,
                titulo: 'Seu ticket médio caiu',
                texto: `Em ${ano} você recebe em média ${brl(ticketAno)} por freela, ${Math.abs(v)}% a menos que em ${ano - 1} (${brl(tAnt)}).`,
                sugestao: 'Veja quais contratantes ou funções puxaram a média para baixo e evite aceitar trabalhos abaixo do seu valor mínimo.',
            });
        } else if (v < 3) {
            add({
                id: 'ticket-parado', tipo: 'oportunidade', icone: '💲', prioridade: 60,
                titulo: 'Hora de reajustar seus valores',
                texto: `Seu ticket médio em ${ano} (${brl(ticketAno)}) está praticamente igual ao de ${ano - 1} (${brl(tAnt)}).`,
                sugestao: `Com a inflação, cobrar o mesmo é ganhar menos. Um reajuste anual de 5% a 10% levaria seu ticket para ${brl(Math.round(ticketAno * 1.05))} a ${brl(Math.round(ticketAno * 1.1))}. Comece pelos contratantes novos.`,
            });
        } else if (v >= 10) {
            add({
                id: 'ticket-alta', tipo: 'conquista', icone: '📈', prioridade: 18,
                titulo: 'Seu ticket médio subiu',
                texto: `Você passou a receber em média ${brl(ticketAno)} por freela, ${v}% a mais que em ${ano - 1}.`,
            });
        }
    }

    // Jornadas longas e hora extra
    const comHorario = doAno.filter(f => presencial(f) && diaUnico(f) && minutosDe(f) !== null && f.valor > 0);
    const longos = comHorario.filter(f => minutosDe(f)! > 8 * 60);
    const curtos = comHorario.filter(f => minutosDe(f)! <= 8 * 60);
    const valorHora = (l: Freela[]) => media(l.map(f => f.valor / (minutosDe(f)! / 60)));
    if (longos.length >= 2) {
        const hL = valorHora(longos);
        const hC = curtos.length >= 3 ? valorHora(curtos) : hL;
        const extra = Math.round(hC * 1.5);
        if (curtos.length >= 3 && hL < hC * 0.85) {
            add({
                id: 'hora-extra', tipo: 'oportunidade', icone: '⏱️', prioridade: 72,
                titulo: 'Jornadas longas estão pagando menos',
                texto: `Nos ${longos.length} freelas com mais de 8h você ganhou em média ${brl(Math.round(hL))}/h, contra ${brl(Math.round(hC))}/h nos trabalhos de até 8h.`,
                sugestao: `Defina uma diária de até 8h e cobre hora extra acima disso, por exemplo ${brl(extra)}/h (sua hora média + 50%).`,
            });
        } else {
            add({
                id: 'hora-extra', tipo: 'dica', icone: '⏱️', prioridade: 38,
                titulo: 'Combine a hora extra antes',
                texto: `Você fez ${longos.length} jornadas acima de 8h em ${ano}.`,
                sugestao: `Deixe combinado antes de fechar: diária de até 8h + hora extra de ${brl(extra)}/h (sua hora média + 50%). Evita trabalhar horas a mais sem receber.`,
            });
        }
    }

    // Madrugada
    const madrugada = comHorario.filter(f => {
        const [h1] = f.horario_inicio!.split(':').map(Number);
        return f.horario_fim! <= f.horario_inicio! || h1 >= 22;
    });
    if (madrugada.length >= 3) {
        add({
            id: 'noturno', tipo: 'dica', icone: '🌙', prioridade: 34,
            titulo: 'Adicional noturno',
            texto: `${plural(madrugada.length, 'freela seu atravessou', 'freelas seus atravessaram')} a madrugada em ${ano}.`,
            sugestao: 'Trabalho noturno costuma valer mais. Como referência, a CLT paga 20% a mais entre 22h e 5h. Vale incluir um adicional na sua tabela.',
        });
    }

    // Feriados
    const feriados = [...new Set(doAno.filter(presencial).flatMap(diasDe).filter(d => d.startsWith(`${ano}-`) && getHoliday(d)))].sort();
    if (feriados.length >= 2) {
        const nomes = feriados.map(d => getHoliday(d)!.name);
        add({
            id: 'feriados', tipo: 'dica', icone: '🎉', prioridade: 33,
            titulo: 'Feriados valem mais',
            texto: `Você trabalhou em ${plural(feriados.length, 'feriado', 'feriados')} em ${ano} (${nomes.length > 3 ? `${nomes.slice(0, 3).join(', ')} e outros` : lista(nomes)}).`,
            sugestao: 'Feriados são datas de alta demanda e pouca gente disponível. Muitos profissionais cobram de 30% a 50% a mais nessas datas.',
        });
    }

    // Função e tipo de serviço mais rentáveis
    const maisRentavel = (chave: (f: Freela) => string, rotulos: Record<string, string>, id: string, icone: string, prioridade: number) => {
        const grupos = [...agrupar(comparaveis, chave).entries()]
            .filter(([, l]) => l.length >= 3)
            .map(([k, l]) => ({ nome: rotulos[k] || k, media: media(l.map(f => f.valor)) }))
            .sort((a, b) => b.media - a.media);
        if (grupos.length < 2) return;
        const melhor = grupos[0];
        const pior = grupos[grupos.length - 1];
        if (melhor.media < pior.media * 1.25) return;
        add({
            id, tipo: 'oportunidade', icone, prioridade,
            titulo: `${melhor.nome}: seu melhor retorno`,
            texto: `Freelas de ${melhor.nome.toLowerCase()} pagam em média ${brl(Math.round(melhor.media))}, ${Math.round((melhor.media / pior.media - 1) * 100)}% a mais que os de ${pior.nome.toLowerCase()} (${brl(Math.round(pior.media))}).`,
            sugestao: `Divulgue mais seu trabalho em ${melhor.nome.toLowerCase()} e reveja seu preço em ${pior.nome.toLowerCase()}.`,
        });
    };
    maisRentavel(f => f.categoria === 'outro' && f.categoria_customizada ? f.categoria_customizada : f.categoria, CATEGORIA, 'funcao-rentavel', '🏷️', 45);
    maisRentavel(f => f.tipo_servico, TIPO, 'tipo-rentavel', '🎟️', 42);

    // Entregas: fora do prazo e prazos curtos
    const entregas = doAno.filter(f => f.entrega);
    const foraDoPrazo = entregas.filter(f => f.entrega!.entregue && f.entrega!.data_entregue && f.entrega!.data_entregue > f.data_evento);
    if (foraDoPrazo.length >= 2) {
        add({
            id: 'entregas-atrasadas', tipo: 'dica', icone: '📦', prioridade: 40,
            titulo: 'Entregas depois do prazo',
            texto: `${plural(foraDoPrazo.length, 'entrega foi concluída', 'entregas foram concluídas')} depois do prazo em ${ano}.`,
            sugestao: 'Negocie prazos com folga para revisões e, quando o cliente precisar de urgência, cobre por isso.',
        });
    }
    const urgentes = entregas.filter(f => f.created_at && daysBetween(f.created_at.slice(0, 10), f.data_evento) <= 3);
    if (urgentes.length >= 2) {
        add({
            id: 'taxa-urgencia', tipo: 'oportunidade', icone: '⚡', prioridade: 44,
            titulo: 'Cobre taxa de urgência',
            texto: `${plural(urgentes.length, 'trabalho com prazo foi pedido', 'trabalhos com prazo foram pedidos')} com 3 dias ou menos de antecedência em ${ano}.`,
            sugestao: 'Crie uma taxa de urgência para prazos curtos (ex.: +30% a +50%). Quem precisa com pressa costuma aceitar pagar mais.',
        });
    }

    // ================= Agenda e carga de trabalho =================
    const diasTrabalho = [...new Set(doAno.filter(presencial).flatMap(diasDe))].sort();

    // Sequência de dias seguidos
    let melhorSeq = { n: 0, ini: '', fim: '' };
    let seq = { n: 0, ini: '', fim: '' };
    diasTrabalho.forEach((d, i) => {
        seq = i > 0 && daysBetween(diasTrabalho[i - 1], d) === 1 ? { n: seq.n + 1, ini: seq.ini, fim: d } : { n: 1, ini: d, fim: d };
        if (seq.n > melhorSeq.n) melhorSeq = { ...seq };
    });
    if (melhorSeq.n >= 7) {
        add({
            id: 'sequencia', tipo: melhorSeq.n >= 10 ? 'alerta' : 'dica', icone: '🔋', prioridade: melhorSeq.n >= 10 ? 62 : 46,
            titulo: 'Muitos dias seguidos de trabalho',
            texto: `Você ${melhorSeq.fim > hoje ? 'tem' : 'teve'} uma sequência de ${melhorSeq.n} dias seguidos de trabalho (${ddmm(melhorSeq.ini)} a ${ddmm(melhorSeq.fim)}).`,
            sugestao: 'Sequências longas aumentam o cansaço e o risco de erro. Nos períodos cheios, priorize os trabalhos que pagam mais, suba o preço das datas disputadas ou bloqueie uma folga na agenda.',
        });
    }

    // Horas por mês
    const horasMes = new Array(12).fill(0);
    doAno.filter(f => presencial(f) && minutosDe(f) !== null).forEach(f => {
        diasDe(f).forEach(d => { if (d.startsWith(`${ano}-`)) horasMes[parseInt(d.slice(5, 7), 10) - 1] += minutosDe(f)! / 60; });
    });
    const mesMaisHoras = horasMes.reduce((m, h, i) => (h > horasMes[m] ? i : m), 0);
    if (horasMes[mesMaisHoras] > 180) {
        add({
            id: 'carga-mensal', tipo: 'alerta', icone: '🥵', prioridade: 57,
            titulo: 'Mês pesado de trabalho',
            texto: `Em ${MESES[mesMaisHoras]} você somou ${Math.round(horasMes[mesMaisHoras])} horas de freelas, mais que uma jornada CLT completa (cerca de 180h).`,
            sugestao: 'Em meses de pico, aumente o preço para novos pedidos: você trabalha menos pelo mesmo dinheiro e sobra tempo para descansar.',
        });
    }

    // Dias da semana parados
    const ult12Presenciais = ultimos12m.filter(presencial);
    if (ult12Presenciais.length >= 20) {
        const porDia = new Array(7).fill(0);
        ult12Presenciais.forEach(f => { porDia[new Date(f.data_evento + 'T00:00:00').getDay()] += 1; });
        const fracos = [1, 2, 3, 4].filter(d => porDia[d] <= ult12Presenciais.length * 0.05);
        const fortes = porDia.map((n, d) => ({ n, d })).sort((a, b) => b.n - a.n).slice(0, 2).map(x => DIAS_SEMANA[x.d]);
        if (fracos.length >= 2) {
            add({
                id: 'dias-parados', tipo: 'oportunidade', icone: '📅', prioridade: 30,
                titulo: 'Dias da semana parados',
                texto: `Seus freelas se concentram nas ${lista(fortes)}. ${maiuscula(lista(fracos.map(d => DIAS_SEMANA[d])))} quase não têm trabalho.`,
                sugestao: 'Dias parados podem render com trabalhos de estúdio, edição, montagem e ensaios, ou com um valor especial para eventos corporativos durante a semana.',
            });
        }
    }

    if (ehAnoAtual) {
        // Agenda vazia à frente
        const proximos30 = todos.filter(f => f.data_evento > hoje && f.data_evento <= addDays(hoje, 30)).length;
        const mediaMensal = realizados.filter(f => f.data_evento > addDays(hoje, -180)).length / 6;
        if (mediaMensal >= 4 && proximos30 < mediaMensal * 0.5) {
            add({
                id: 'agenda-vazia', tipo: 'oportunidade', icone: '🗓️', prioridade: 52,
                titulo: 'Agenda fraca nos próximos 30 dias',
                texto: `${proximos30 === 0 ? 'Você não tem nenhum freela agendado' : `Você tem só ${plural(proximos30, 'freela agendado', 'freelas agendados')}`} para os próximos 30 dias. Sua média é de ${Math.round(mediaMensal)} por mês.`,
                sugestao: 'Hora de prospectar: avise seus contratantes das datas livres e ofereça condições para fechar com antecedência.',
            });
        }

        // Sazonalidade: meses fracos do ano anterior que estão chegando
        const mensalAnterior = new Array(12).fill(0);
        doAnoAnterior.forEach(f => { mensalAnterior[parseInt(f.data_evento.slice(5, 7), 10) - 1] += f.valor; });
        const mesesComDados = mensalAnterior.map((v, i) => ({ v, i })).filter(m => m.v > 0);
        if (mesesComDados.length >= 6) {
            const fracos = [...mesesComDados].sort((a, b) => a.v - b.v).slice(0, 2).sort((a, b) => a.i - b.i);
            const chegando = fracos.some(m => (m.i - mesAtual + 12) % 12 <= 2);
            add({
                id: 'sazonalidade', tipo: 'dica', icone: '🌦️', prioridade: chegando ? 50 : 22,
                titulo: chegando ? 'Meses fracos chegando' : 'Seus meses mais fracos',
                texto: `Em ${ano - 1}, ${lista(fracos.map(m => MESES[m.i]))} foram seus meses mais fracos (${lista(fracos.map(m => brl(m.v)))}).`,
                sugestao: 'Comece a prospectar com antecedência e guarde uma parte do que entra nos meses fortes para atravessar esse período.',
            });
        }

        // Férias
        const diasUlt12 = new Set(ultimos12m.filter(presencial).flatMap(diasDe)).size;
        const teveFerias = bloqueios.some(b => b.tipo === 'ferias' && b.data_fim >= addDays(hoje, -365));
        if (diasUlt12 >= 150 && !teveFerias) {
            add({
                id: 'ferias', tipo: 'dica', icone: '🏖️', prioridade: 26,
                titulo: 'Planeje um descanso',
                texto: `Você trabalhou ${diasUlt12} dias nos últimos 12 meses e não tem férias registradas.`,
                sugestao: 'Escolha um período historicamente fraco e bloqueie alguns dias de férias na agenda (Bloquear data → Férias). Descansar também protege sua renda.',
            });
        }
    }

    // ================= Caixa =================

    // Renda que oscila muito: reserva
    const porMes = new Map<string, number>();
    ultimos12m.forEach(f => porMes.set(f.data_evento.slice(0, 7), (porMes.get(f.data_evento.slice(0, 7)) || 0) + f.valor));
    if (porMes.size >= 6) {
        const meses = [...porMes.entries()].sort((a, b) => a[1] - b[1]);
        const [mMin, vMin] = meses[0];
        const [mMax, vMax] = meses[meses.length - 1];
        if (vMax >= vMin * 1.8) {
            const mediaM = [...porMes.values()].reduce((s, v) => s + v, 0) / porMes.size;
            add({
                id: 'reserva', tipo: 'dica', icone: '🐷', prioridade: 40,
                titulo: 'Renda que oscila: tenha uma reserva',
                texto: `Nos últimos 12 meses, sua renda variou de ${brl(vMin)} (${MESES[parseInt(mMin.slice(5), 10) - 1]}) a ${brl(vMax)} (${MESES[parseInt(mMax.slice(5), 10) - 1]}).`,
                sugestao: `Separe uma parte dos meses fortes para cobrir os fracos. Uma meta comum é juntar o equivalente a 3 meses da sua média (${brl(Math.round(mediaM * 3))}).`,
            });
        }
    }

    // ================= Subs =================
    const integrais = doAno.filter(f => f.sub?.integral);
    if (integrais.length >= 2) {
        add({
            id: 'sub-integral', tipo: 'dica', icone: '🔁', prioridade: 36,
            titulo: 'Repasse integral ao sub',
            texto: `Em ${plural(integrais.length, 'freela', 'freelas')} de ${ano} você repassou 100% do cachê ao sub (${brl(soma(integrais))}) e ficou sem lucro.`,
            sugestao: 'Quando o trabalho veio por você, é comum reter uma parte (10% a 20%) pela intermediação e pela responsabilidade com o contratante.',
        });
    }
    const subsAtrasados = todos.filter(f => f.sub && !f.sub.pago && f.data_evento < addDays(hoje, -15));
    if (subsAtrasados.length > 0) {
        const total = subsAtrasados.reduce((s, f) => s + (f.sub!.integral ? f.valor : f.sub!.valor), 0);
        const nomes = [...new Set(subsAtrasados.map(f => normalizeName(f.sub!.nome)))];
        add({
            id: 'subs-atrasados', tipo: 'alerta', icone: '🔁', prioridade: 60,
            titulo: 'Subs esperando pagamento',
            texto: `Você deve ${brl(total)} a ${lista(nomes)} por trabalhos de mais de 15 dias atrás.`,
            sugestao: 'Pagar os subs em dia mantém sua rede de confiança: são eles que cobrem você quando não pode ir.',
        });
    }

    // ================= MEI =================
    const mei = doAno.filter(f => f.declara_mei).reduce((s, f) => s + f.valor, 0);
    if (meiLimite > 0) {
        const diaDoAno = daysBetween(`${ano}-01-01`, hoje) + 1;
        const projecao = ehAnoAtual && diaDoAno >= 60 ? (mei / diaDoAno) * 365 : 0;
        if (mei >= meiLimite * 0.8) {
            add({
                id: 'mei-limite', tipo: 'alerta', icone: '🧾', prioridade: 85,
                titulo: 'Perto do limite do MEI',
                texto: `Você já declarou ${brl(mei)} como MEI em ${ano}, ${Math.round((mei / meiLimite) * 100)}% do limite de ${brl(meiLimite)}.`,
                sugestao: 'Converse com um contador antes de ultrapassar o limite, para planejar o enquadramento.',
            });
        } else if (projecao > meiLimite) {
            add({
                id: 'mei-projecao', tipo: 'alerta', icone: '🧾', prioridade: 80,
                titulo: 'MEI pode estourar o limite',
                texto: `No ritmo atual, o valor declarado como MEI chega a ${brl(Math.round(projecao))} em ${ano}, acima do limite de ${brl(meiLimite)}.`,
                sugestao: 'Converse com um contador para planejar os próximos meses.',
            });
        } else if (totalAno > meiLimite) {
            add({
                id: 'mei-faturamento', tipo: 'dica', icone: '🧾', prioridade: 44,
                titulo: 'Faturamento acima do limite do MEI',
                texto: `Seu faturamento total em ${ano} (${brl(totalAno)}) passa o limite anual do MEI (${brl(meiLimite)}).`,
                sugestao: 'Se você atua como MEI, confirme com um contador como esse faturamento deve ser declarado.',
            });
        }
    }

    // ================= Conquistas =================
    const comp = comparacaoAnoAnterior(todos, ano, hoje);
    if (comp.variacao !== null && comp.variacao >= 10) {
        add({
            id: 'crescimento', tipo: 'conquista', icone: '🚀', prioridade: 20,
            titulo: 'Seu faturamento cresceu',
            texto: `${comp.variacao}% a mais que ${comp.parcial ? `o mesmo período de ${ano - 1}` : ano - 1} (${brl(comp.atual)} contra ${brl(comp.anterior)}).`,
            sugestao: 'Bom momento para reajustar preços e escolher melhor os trabalhos que aceita.',
        });
    }
    if (doAnoAnterior.length > 0) {
        const primeiraData = new Map<string, string>();
        todos.forEach(f => {
            const k = nameKey(f.contratante);
            if (k && (!primeiraData.has(k) || f.data_evento < primeiraData.get(k)!)) primeiraData.set(k, f.data_evento);
        });
        const novos = [...porClienteAno.entries()].filter(([k]) => primeiraData.get(k)?.startsWith(`${ano}-`)).map(([, l]) => nomeCliente(l));
        if (novos.length > 0) {
            add({
                id: 'novos-clientes', tipo: 'conquista', icone: '🤝', prioridade: 15,
                titulo: novos.length === 1 ? 'Novo contratante' : 'Novos contratantes',
                texto: `Você conquistou ${plural(novos.length, 'novo contratante', 'novos contratantes')} em ${ano}: ${novos.length > 4 ? `${novos.slice(0, 4).join(', ')} e mais ${novos.length - 4}` : lista(novos)}.`,
            });
        }
    }
    if (ehAnoAtual) {
        const historico = new Map<string, number>();
        realizados.forEach(f => historico.set(f.data_evento.slice(0, 7), (historico.get(f.data_evento.slice(0, 7)) || 0) + f.valor));
        if (historico.size >= 6) {
            const [mesRecorde, valorRecorde] = [...historico.entries()].sort((a, b) => b[1] - a[1])[0];
            const recentes = [hoje.slice(0, 7), addDays(`${hoje.slice(0, 7)}-01`, -1).slice(0, 7)];
            if (recentes.includes(mesRecorde)) {
                add({
                    id: 'recorde', tipo: 'conquista', icone: '🏆', prioridade: 25,
                    titulo: 'Mês recorde!',
                    texto: `${MESES[parseInt(mesRecorde.slice(5), 10) - 1][0].toUpperCase()}${MESES[parseInt(mesRecorde.slice(5), 10) - 1].slice(1)} foi seu melhor mês registrado, com ${brl(valorRecorde)}.`,
                });
            }
        }
    }

    return out.sort((a, b) => b.prioridade - a.prioridade);
};
