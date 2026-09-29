import { Freela } from '../types';
import { isMultiDay } from './bloqueioService';
import { PixConfig, TIPOS_CHAVE_PIX, normalizarChavePix, gerarPixCopiaECola } from './pixService';

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
}

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

const VIOLETA: [number, number, number] = [124, 58, 237];
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

    // ---- Cabeçalho ----
    doc.setFillColor(...VIOLETA);
    doc.rect(0, 0, W, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('INVOICE', M, 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('Fatura de Serviços', M, 25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Nº ${d.numero}`, W - M, 14, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Emissão: ${dataBR(d.emissao)}`, W - M, 21, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`Vencimento: ${dataBR(d.vencimento)}`, W - M, 27, { align: 'right' });

    // ---- Prestador / Contratante ----
    const boxY = 44;
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
        const horario = f.horario_inicio
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
        foot: [[{ content: 'TOTAL A PAGAR', colSpan: 6, styles: { halign: 'right' } }, brl(total)]],
        showFoot: 'lastPage',
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: CINZA_TEXTO, lineColor: [229, 231, 235], lineWidth: 0.2, valign: 'middle' },
        headStyles: { fillColor: VIOLETA, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        footStyles: { fillColor: [237, 233, 254], textColor: [46, 16, 101], fontStyle: 'bold', fontSize: 10.5 },
        alternateRowStyles: { fillColor: [250, 249, 255] },
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

    // ---- Pagamento via PIX ----
    if (d.pix) {
        const chave = normalizarChavePix(d.pix.tipo, d.pix.chave);
        const copiaECola = gerarPixCopiaECola({ chave, nome: d.pix.nome, cidade: d.pix.cidade, valor: total, txid: d.numero });
        const qr = await QRCode.toDataURL(copiaECola, { errorCorrectionLevel: 'M', margin: 1, width: 360 });
        const linhasCopia: string[] = doc.setFont('courier', 'normal').setFontSize(6.5).splitTextToSize(copiaECola, W - 2 * M - 60);
        const altura = Math.max(56, 40 + linhasCopia.length * 2.8);

        garantirEspaco(altura);
        doc.setDrawColor(...VIOLETA);
        doc.setLineWidth(0.5);
        doc.roundedRect(M, y, W - 2 * M, altura, 2, 2);
        doc.addImage(qr, 'PNG', M + 4, y + 5, 46, 46, undefined, 'FAST');

        const x = M + 56;
        doc.setTextColor(...VIOLETA);
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
        doc.text(`Invoice ${d.numero} - gerada pelo app Controle de Freelas`, M, H - 8);
        doc.text(`Página ${p} de ${paginas}`, W - M, H - 8, { align: 'right' });
    }

    return doc.output('blob');
};
