import { Freela } from '../types';
import { isMultiDay } from './bloqueioService';
import { PixConfig, TIPOS_CHAVE_PIX, normalizarChavePix, gerarPixCopiaECola } from './pixService';
import { Marca, MARCA_PADRAO, hexParaRgb, textoSobre, clarear, corDeTexto, fundoDoLogo } from './marcaService';

export interface Prestador {
    nome: string;
    documento?: string; // CPF/CNPJ
    contato?: string;   // telefone / e-mail
}

export interface InvoiceData {
    numero: string;       // ex: 2026-0001
    emissao: string;      // YYYY-MM-DD
    vencimento: string;   // YYYY-MM-DD
    prestador: Prestador;
    contratante: string;
    itens: Freela[];
    observacoes?: string;
    pix?: PixConfig | null;
    marca?: Marca | null; // logo e cor do cabeçalho
    segundaVia?: boolean;
    pagaEm?: string | null; // invoice já paga: sai como recibo, sem PIX
}

// Invoice emitida: fica registrada para consulta, baixa de pagamento e 2ª via
export interface InvoiceRegistro {
    id: string;
    numero: string;
    emissao: string;
    vencimento: string;
    contratante: string;
    itens: Freela[]; // retrato dos freelas na emissão (a 2ª via sai igual à original)
    total: number;
    observacoes?: string | null;
    prestador: Prestador;
    pix: PixConfig | null;
    cor?: string; // cor do cabeçalho usada na emissão
    paga_em?: string | null; // baixa da invoice
    pagos_pela_invoice?: string[]; // freelas que a baixa marcou como pagos (para desfazer)
    cancelada?: boolean;
    created_at: string;
}

export interface InvoiceOps {
    lista: InvoiceRegistro[];
    registrar: (inv: InvoiceRegistro) => void;
    pagar: (id: string, data: string) => void;
    desfazerPagamento: (id: string) => void;
    cancelar: (id: string) => void;
    excluir: (id: string) => void;
}

export type SituacaoInvoice = 'paga' | 'parcial' | 'vencida' | 'aberta' | 'cancelada';

export const SITUACAO_INVOICE: Record<SituacaoInvoice, { texto: string; selo: string }> = {
    paga: { texto: 'Paga', selo: 'bg-green-100 text-green-800' },
    parcial: { texto: 'Paga em parte', selo: 'bg-sky-100 text-sky-800' },
    vencida: { texto: 'Vencida', selo: 'bg-red-100 text-red-800' },
    aberta: { texto: 'Em aberto', selo: 'bg-amber-100 text-amber-800' },
    cancelada: { texto: 'Cancelada', selo: 'bg-gray-200 text-gray-700' },
};

// Situação atual, considerando também freelas pagos um a um depois da emissão
export const situacaoInvoice = (inv: InvoiceRegistro, freelas: Freela[], hoje: string): { situacao: SituacaoInvoice; pagaEm: string | null } => {
    if (inv.cancelada) return { situacao: 'cancelada', pagaEm: null };
    if (inv.paga_em) return { situacao: 'paga', pagaEm: inv.paga_em };
    const atuais = inv.itens.map(i => freelas.find(f => f.id === i.id)).filter((f): f is Freela => !!f);
    const pagos = atuais.filter(f => f.status === 'pago');
    if (atuais.length > 0 && pagos.length === atuais.length) {
        const ultima = pagos.reduce((m, f) => ((f.data_pagamento || '') > m ? f.data_pagamento || '' : m), '');
        return { situacao: 'paga', pagaEm: ultima || null };
    }
    if (pagos.length > 0) return { situacao: 'parcial', pagaEm: null };
    return { situacao: inv.vencimento < hoje ? 'vencida' : 'aberta', pagaEm: null };
};

const CATEGORIAS: Record<string, string> = {
    som: 'Som', iluminacao: 'Iluminação', video: 'Vídeo', producao: 'Produção', performance: 'Performance',
    bombeiro_civil: 'Bombeiro Civil', seguranca_patrimonial: 'Segurança', fotografia: 'Fotografia',
    videomaker: 'VideoMaker', edicao_audiovisual: 'Ed. Audiovisual', mixagem_masterizacao: 'Mix/Master',
    garcom: 'Garçom', outro: 'Outro',
};

const categoriaLabel = (f: Freela) =>
    f.categoria === 'outro' && f.categoria_customizada ? f.categoria_customizada : (CATEGORIAS[f.categoria] || f.categoria);

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const dataBR = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR');

// As fontes padrão do PDF só cobrem Latin-1: remove emojis e símbolos fora dessa faixa
const pdfText = (s?: string | null) => (s || '').normalize('NFC').replace(/[^\u0000-\u00ff]/g, '').trim();

export const totalInvoice = (itens: Freela[]) => itens.reduce((s, f) => s + f.valor, 0);

export const periodoInvoice = (itens: Freela[]): { inicio: string; fim: string } | null => {
    if (itens.length === 0) return null;
    const inicio = itens.reduce((m, f) => (f.data_evento < m ? f.data_evento : m), itens[0].data_evento);
    const fim = itens.reduce((m, f) => {
        const d = isMultiDay(f) ? f.data_fim! : f.data_evento;
        return d > m ? d : m;
    }, itens[0].data_evento);
    return { inicio, fim };
};

export const nomeArquivoInvoice = (d: InvoiceData) =>
    `invoice-${d.numero}-${pdfText(d.contratante).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'contratante'}.pdf`;

const CINZA_TEXTO: [number, number, number] = [55, 65, 81];
const CINZA_CLARO: [number, number, number] = [107, 114, 128];

export const gerarInvoicePdf = async (d: InvoiceData): Promise<Blob> => {
    // Bibliotecas pesadas carregadas só quando uma invoice é gerada
    const [{ jsPDF }, { default: autoTable }, QRCode] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
        import('qrcode'),
    ]);

    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const M = 15;
    const total = totalInvoice(d.itens);
    const periodo = periodoInvoice(d.itens);

    // Cores da marca: cabeçalho, tabela e destaques seguem a cor escolhida
    const marca = d.marca || MARCA_PADRAO;
    const COR = hexParaRgb(marca.cor);
    const TEXTO_CABECALHO = textoSobre(marca.cor);
    const COR_TEXTO = corDeTexto(marca.cor);

    // ---- Cabeçalho (logo centralizado entre o título e os dados da invoice) ----
    const headerH = marca.logo ? 40 : 36;
    const dy = (headerH - 36) / 2;
    doc.setFillColor(...COR);
    doc.rect(0, 0, W, headerH, 'F');
    doc.setTextColor(...TEXTO_CABECALHO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('INVOICE', M, 17 + dy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(d.segundaVia ? 'Fatura de Serviços - 2ª via' : 'Fatura de Serviços', M, 25 + dy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Nº ${d.numero}`, W - M, 14 + dy, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Emissão: ${dataBR(d.emissao)}`, W - M, 21 + dy, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Vencimento: ${dataBR(d.vencimento)}`, W - M, 27 + dy, { align: 'right' });

    if (marca.logo) {
        const props = doc.getImageProperties(marca.logo);
        const escala = Math.min(62 / props.width, (headerH - 10) / props.height);
        const w = props.width * escala;
        const h = props.height * escala;
        const x = (W - w) / 2;
        const y = (headerH - h) / 2;
        const fundo = fundoDoLogo(marca);
        if (fundo) {
            doc.setFillColor(...fundo);
            doc.roundedRect(x - 2.5, y - 2, w + 5, h + 4, 2, 2, 'F');
        }
        doc.addImage(marca.logo, props.fileType === 'PNG' ? 'PNG' : 'JPEG', x, y, w, h, 'logo', 'FAST');
    }

    // ---- Prestador / Contratante ----
    const boxY = headerH + 8;
    const boxW = (W - 2 * M - 6) / 2;
    const boxH = 30;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, boxY, boxW, boxH, 2, 2);
    doc.roundedRect(M + boxW + 6, boxY, boxW, boxH, 2, 2);

    const bloco = (x: number, titulo: string, linhas: { t: string; bold?: boolean; size?: number }[]) => {
        doc.setTextColor(...CINZA_CLARO);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(titulo, x + 4, boxY + 6);
        let y = boxY + 12;
        linhas.forEach(l => {
            doc.setTextColor(...CINZA_TEXTO);
            doc.setFont('helvetica', l.bold ? 'bold' : 'normal');
            doc.setFontSize(l.size || 9);
            doc.text(doc.splitTextToSize(l.t, boxW - 8)[0], x + 4, y);
            y += l.size && l.size > 10 ? 6 : 5;
        });
    };

    bloco(M, 'PRESTADOR DE SERVIÇOS', [
        { t: pdfText(d.prestador.nome), bold: true, size: 11 },
        ...(d.prestador.documento ? [{ t: `CPF/CNPJ: ${pdfText(d.prestador.documento)}` }] : []),
        ...(d.prestador.contato ? [{ t: pdfText(d.prestador.contato) }] : []),
    ]);
    bloco(M + boxW + 6, 'CONTRATANTE', [
        { t: pdfText(d.contratante), bold: true, size: 11 },
        ...(periodo ? [{ t: `Período: ${dataBR(periodo.inicio)} a ${dataBR(periodo.fim)}` }] : []),
        { t: `${d.itens.length} serviço${d.itens.length !== 1 ? 's' : ''} prestado${d.itens.length !== 1 ? 's' : ''}` },
    ]);

    // ---- Tabela de serviços (uma linha por data, para conferência) ----
    const itens = [...d.itens].sort((a, b) => a.data_evento.localeCompare(b.data_evento) || (a.horario_inicio || '').localeCompare(b.horario_inicio || ''));
    const body = itens.map((f, i) => {
        const multi = isMultiDay(f);
        const data = multi ? `${dataBR(f.data_evento)} a ${dataBR(f.data_fim!)}` : dataBR(f.data_evento);
        const horario = f.entrega
            ? `Entrega${f.entrega.hora ? ` até ${f.entrega.hora}` : ''}`
            : f.horario_inicio
                ? `${f.horario_inicio}${f.horario_fim ? ` - ${f.horario_fim}` : ''}${multi ? ' (diário)' : ''}`
                : '-';
        return [
            String(i + 1),
            data,
            pdfText(f.descricao) + (multi ? ' (cachê único)' : ''),
            pdfText(categoriaLabel(f)),
            pdfText(f.local) || '-',
            horario,
            brl(f.valor),
        ];
    });

    autoTable(doc, {
        startY: boxY + boxH + 8,
        margin: { left: M, right: M },
        head: [['#', 'Data', 'Descrição', 'Função', 'Local', 'Horário', 'Valor']],
        body,
        foot: [[{ content: d.pagaEm ? 'TOTAL PAGO' : 'TOTAL A PAGAR', colSpan: 6, styles: { halign: 'right' } }, brl(total)]],
        showFoot: 'lastPage',
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: CINZA_TEXTO, lineColor: [229, 231, 235], lineWidth: 0.2, valign: 'middle' },
        headStyles: { fillColor: COR, textColor: TEXTO_CABECALHO, fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: clarear(marca.cor, 0.85), textColor: COR_TEXTO, fontStyle: 'bold', fontSize: 10.5 },
        alternateRowStyles: { fillColor: clarear(marca.cor, 0.96) },
        columnStyles: {
            0: { cellWidth: 8, halign: 'center' },
            1: { cellWidth: 24 },
            3: { cellWidth: 22 },
            4: { cellWidth: 30 },
            5: { cellWidth: 22 },
            6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        },
    });

    let y = ((doc as any).lastAutoTable?.finalY ?? 120) + 8;
    const garantirEspaco = (altura: number) => {
        if (y + altura > H - 18) {
            doc.addPage();
            y = 20;
        }
    };

    // ---- Invoice paga: selo de quitação no lugar do PIX ----
    if (d.pagaEm) {
        garantirEspaco(20);
        doc.setFillColor(220, 252, 231);
        doc.setDrawColor(22, 163, 74);
        doc.setLineWidth(0.6);
        doc.roundedRect(M, y, W - 2 * M, 16, 2, 2, 'FD');
        doc.setTextColor(21, 128, 61);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text(`PAGO EM ${dataBR(d.pagaEm)}`, W / 2, y + 7, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Recebemos ${brl(total)} referentes aos serviços acima. Obrigado!`, W / 2, y + 12.5, { align: 'center' });
        y += 24;
    }

    // ---- Pagamento via PIX ----
    if (d.pix && !d.pagaEm) {
        const chave = normalizarChavePix(d.pix.tipo, d.pix.chave);
        const copiaECola = gerarPixCopiaECola({ chave, nome: d.pix.nome, cidade: d.pix.cidade, valor: total, txid: d.numero });
        const qr = await QRCode.toDataURL(copiaECola, { errorCorrectionLevel: 'M', margin: 1, width: 360 });
        const linhasCopia: string[] = doc.setFont('courier', 'normal').setFontSize(6.5).splitTextToSize(copiaECola, W - 2 * M - 60);
        const altura = Math.max(56, 40 + linhasCopia.length * 2.8);

        garantirEspaco(altura);
        doc.setDrawColor(...COR);
        doc.setLineWidth(0.5);
        doc.roundedRect(M, y, W - 2 * M, altura, 2, 2);
        doc.addImage(qr, 'PNG', M + 4, y + 5, 46, 46, undefined, 'FAST');

        const x = M + 56;
        doc.setTextColor(...COR_TEXTO);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('PAGAMENTO VIA PIX', x, y + 9);
        doc.setTextColor(...CINZA_TEXTO);
        doc.setFontSize(13);
        doc.text(`Valor: ${brl(total)}`, x, y + 17);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const tipoLabel = TIPOS_CHAVE_PIX.find(t => t.id === d.pix!.tipo)?.label || 'Chave';
        doc.text(`Chave PIX (${tipoLabel}): ${pdfText(d.pix.chave)}`, x, y + 24);
        doc.text(`Favorecido: ${pdfText(d.pix.nome)}`, x, y + 29);
        doc.setTextColor(...CINZA_CLARO);
        doc.setFontSize(7.5);
        doc.text('Aponte a câmera do app do banco para o QR Code, ou use o PIX Copia e Cola:', x, y + 35);
        doc.setFont('courier', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...CINZA_TEXTO);
        doc.text(linhasCopia, x, y + 39.5);
        y += altura + 8;
    }

    // ---- Observações ----
    const obs = pdfText(d.observacoes);
    if (obs) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const linhas: string[] = doc.splitTextToSize(obs, W - 2 * M);
        garantirEspaco(10 + linhas.length * 4.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...CINZA_CLARO);
        doc.text('OBSERVAÇÕES', M, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...CINZA_TEXTO);
        doc.text(linhas, M, y + 5);
    }

    // ---- Rodapé em todas as páginas ----
    const paginas = doc.getNumberOfPages();
    for (let p = 1; p <= paginas; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...CINZA_CLARO);
        doc.text(`Invoice ${d.numero}${d.segundaVia ? ' (2ª via)' : ''} - gerada pelo app Controle de Freelas`, M, H - 8);
        doc.text(`Página ${p} de ${paginas}`, W - M, H - 8, { align: 'right' });
    }

    return doc.output('blob');
};
