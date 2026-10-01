// Identidade visual da invoice: logo da empresa e cor do cabeçalho.

export interface Marca {
    logo: string | null; // data URL (PNG ou JPEG) já redimensionado, na versão em uso
    logoAlternativo?: string | null; // a outra versão (original com fundo, ou sem fundo), para alternar
    semFundo?: boolean; // o logo em uso teve o fundo removido pelo app (undefined = ainda não analisado)
    transparente?: boolean; // logo com fundo transparente
    logoLum?: number; // luminância média do logo (0 = escuro, 1 = claro)
    histLum?: number[]; // fração do contorno do logo em cada faixa de luminância (ver faixaDe)
    coresLogo?: string[]; // cores sugeridas extraídas do logo
    cor: string; // cor do cabeçalho (#rrggbb)
}

export const MARCA_PADRAO: Marca = { logo: null, cor: '#7c3aed' };

export const CORES_PADRAO: { cor: string; nome: string }[] = [
    { cor: '#7c3aed', nome: 'Violeta' },
    { cor: '#2563eb', nome: 'Azul' },
    { cor: '#0f766e', nome: 'Verde-petróleo' },
    { cor: '#059669', nome: 'Verde' },
    { cor: '#ea580c', nome: 'Laranja' },
    { cor: '#dc2626', nome: 'Vermelho' },
    { cor: '#db2777', nome: 'Rosa' },
    { cor: '#1f2937', nome: 'Grafite' },
];

export type RGB = [number, number, number];

export const hexParaRgb = (hex: string): RGB => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgbParaHex = ([r, g, b]: RGB): string =>
    `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

// Luminância relativa (WCAG), de 0 a 1
export const luminancia = ([r, g, b]: RGB): number => {
    const canal = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
};

const contraste = (l1: number, l2: number) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

const TEXTO_ESCURO: RGB = [31, 41, 55];

// Cor do texto sobre o cabeçalho: branco ou grafite, o que tiver mais contraste
export const textoSobre = (hex: string): RGB => {
    const l = luminancia(hexParaRgb(hex));
    return contraste(l, 1) >= contraste(l, luminancia(TEXTO_ESCURO)) ? [255, 255, 255] : TEXTO_ESCURO;
};

// Mistura a cor com branco (t = 1 → branco) ou com preto (t negativo)
export const clarear = (hex: string, t: number): RGB => {
    const [r, g, b] = hexParaRgb(hex);
    return t >= 0
        ? [r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t].map(Math.round) as RGB
        : [r * (1 + t), g * (1 + t), b * (1 + t)].map(Math.round) as RGB;
};

// Versão da cor legível como texto sobre fundo branco
export const corDeTexto = (hex: string): RGB => {
    let rgb = hexParaRgb(hex);
    for (let i = 0; i < 6 && contraste(luminancia(rgb), 1) < 4.5; i++) rgb = rgb.map(c => Math.round(c * 0.8)) as RGB;
    return rgb;
};

// Faixas uniformes em escala de contraste (log de L + 0,05): cada faixa ≈ 16% de contraste
const FAIXAS_LUM = 20;
const LOG_MIN = Math.log(0.05);
const LOG_AMPLITUDE = Math.log(1.05) - LOG_MIN;
const faixaDe = (l: number) => Math.min(FAIXAS_LUM - 1, Math.floor(((Math.log(l + 0.05) - LOG_MIN) / LOG_AMPLITUDE) * FAIXAS_LUM));
const centroDaFaixa = (i: number) => Math.exp(LOG_MIN + ((i + 0.5) / FAIXAS_LUM) * LOG_AMPLITUDE) - 0.05;

// Fração do logo com pouco contraste sobre um fundo de luminância l
const fracaoApagada = (hist: number[], l: number) =>
    hist.reduce((s, frac, i) => s + (contraste(centroDaFaixa(i), l) < 2 ? frac : 0), 0);

// Logo transparente que se confunde com o cabeçalho ganha um fundo (branco ou grafite) atrás
export const fundoDoLogo = (marca: Marca): RGB | null => {
    if (!marca.logo || !marca.transparente) return null;
    const lCabecalho = luminancia(hexParaRgb(marca.cor));
    if (!marca.histLum) {
        if (marca.logoLum === undefined || contraste(marca.logoLum, lCabecalho) >= 1.8) return null;
        return marca.logoLum > 0.4 ? TEXTO_ESCURO : [255, 255, 255];
    }
    if (fracaoApagada(marca.histLum, lCabecalho) < 0.15) return null;
    return fracaoApagada(marca.histLum, 1) <= fracaoApagada(marca.histLum, luminancia(TEXTO_ESCURO)) ? [255, 255, 255] : TEXTO_ESCURO;
};

// ---- Processamento do arquivo enviado ----

const TIPOS_ACEITOS = ['image/png', 'image/jpeg', 'image/jpg'];
const MAX_ARQUIVO = 10 * 1024 * 1024;
const MAX_TOTAL = 800 * 1024; // as duas versões do logo juntas: mantém o armazenamento do aparelho leve

const carregarImagem = (src: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('imagem inválida'));
    img.src = src;
});

const novoCanvas = (w: number, h: number) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
};
const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;

// Remove o fundo que encosta nas bordas da imagem: cor sólida ou degradê suave, opaco ou semitransparente.
// O preenchimento parte das bordas e para onde a cor muda de forma brusca (o contorno do logo),
// então o que fica dentro do logo é preservado. Retorna a fração removida (0 = nada a remover) e se
// o fundo é neutro (cinza, branco, preto ou semitransparente) — fundo colorido pode ser parte da arte.
const removerFundo = (dados: ImageData): { fracao: number; neutro: boolean } => {
    const nada = { fracao: 0, neutro: false };
    const { width: w, height: h, data } = dados;
    const n = w * h;
    const orig = new Uint8ClampedArray(data);

    const borda: number[] = [];
    for (let x = 0; x < w; x++) borda.push(x, (h - 1) * w + x);
    for (let y = 1; y < h - 1; y++) borda.push(y * w, y * w + w - 1);

    // Bordas já transparentes: não há fundo
    if (borda.filter(p => orig[p * 4 + 3] < 16).length / borda.length > 0.9) return nada;

    const mediana = (canal: number) => {
        const v = borda.map(p => orig[p * 4 + canal]).sort((a, b) => a - b);
        return v[v.length >> 1];
    };
    const ref = [mediana(0), mediana(1), mediana(2), mediana(3)];
    const distRef = (p: number) => Math.hypot(orig[p * 4] - ref[0], orig[p * 4 + 1] - ref[1], orig[p * 4 + 2] - ref[2], orig[p * 4 + 3] - ref[3]);
    const distPx = (p: number, q: number) => Math.hypot(
        orig[p * 4] - orig[q * 4], orig[p * 4 + 1] - orig[q * 4 + 1], orig[p * 4 + 2] - orig[q * 4 + 2], orig[p * 4 + 3] - orig[q * 4 + 3],
    );

    // Borda muito variada é arte encostando na margem, não fundo
    if (borda.filter(p => distRef(p) < 60).length / borda.length < 0.7) return nada;

    const removido = new Uint8Array(n);
    const fila = new Int32Array(n);
    let ini = 0;
    let fim = 0;
    borda.forEach(p => { if (!removido[p] && distRef(p) < 60) { removido[p] = 1; fila[fim++] = p; } });
    while (ini < fim) {
        const p = fila[ini++];
        const x = p % w;
        const y = (p / w) | 0;
        const vizinhos = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
        for (const q of vizinhos) {
            if (q < 0 || removido[q]) continue;
            if (distPx(p, q) <= 28 && distRef(q) <= 110) { removido[q] = 1; fila[fim++] = q; }
        }
    }
    const fracao = fim / n;
    if (fracao < 0.03 || fracao > 0.95) return nada; // nada relevante, ou apagaria o logo inteiro

    for (let p = 0; p < n; p++) if (removido[p]) data[p * 4 + 3] = 0;
    // Suaviza o contorno: pixels de transição parecidos com o fundo ficam semitransparentes
    for (let p = 0; p < n; p++) {
        if (removido[p]) continue;
        const x = p % w;
        const y = (p / w) | 0;
        const encosta = (x > 0 && removido[p - 1]) || (x < w - 1 && removido[p + 1]) || (y > 0 && removido[p - w]) || (y < h - 1 && removido[p + w]);
        if (!encosta) continue;
        const d = distRef(p);
        if (d < 60) data[p * 4 + 3] = Math.round(data[p * 4 + 3] * (d / 60));
    }
    const max = Math.max(ref[0], ref[1], ref[2]);
    const min = Math.min(ref[0], ref[1], ref[2]);
    const neutro = ref[3] < 200 || max < 45 || min > 215 || (max - min) / Math.max(1, max) <= 0.3;
    return { fracao, neutro };
};

// Corta as margens transparentes, para o logo ocupar bem o espaço do cabeçalho
const recortar = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const { width: w, height: h } = canvas;
    const px = ctx2d(canvas).getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (px[(y * w + x) * 4 + 3] > 16) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
        }
    }
    if (x1 < 0) return canvas;
    const folga = Math.max(2, Math.round(Math.max(w, h) * 0.02));
    x0 = Math.max(0, x0 - folga); y0 = Math.max(0, y0 - folga);
    x1 = Math.min(w - 1, x1 + folga); y1 = Math.min(h - 1, y1 + folga);
    if (x0 === 0 && y0 === 0 && x1 === w - 1 && y1 === h - 1) return canvas;
    const out = novoCanvas(x1 - x0 + 1, y1 - y0 + 1);
    ctx2d(out).drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
    return out;
};

// Cores predominantes do logo (ignora transparência, branco, preto e cinzas)
const extrairCores = (fonte: HTMLCanvasElement): string[] => {
    const lado = 64;
    const canvas = novoCanvas(lado, lado);
    const ctx = ctx2d(canvas);
    ctx.drawImage(fonte, 0, 0, lado, lado);
    const px = ctx.getImageData(0, 0, lado, lado).data;
    const grupos = new Map<string, { r: number; g: number; b: number; n: number }>();
    for (let i = 0; i < px.length; i += 4) {
        const [r, g, b, a] = [px[i], px[i + 1], px[i + 2], px[i + 3]];
        if (a < 128) continue;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max < 35 || min > 225 || (max - min) / max < 0.22) continue;
        const k = `${r >> 5},${g >> 5},${b >> 5}`;
        const e = grupos.get(k) || { r: 0, g: 0, b: 0, n: 0 };
        e.r += r; e.g += g; e.b += b; e.n += 1;
        grupos.set(k, e);
    }
    // Descarta tons de borda (mistura de cores no antisserrilhado): cada cor precisa de ao menos 4% do logo
    const minimo = Math.max(6, [...grupos.values()].reduce((s, e) => s + e.n, 0) * 0.04);
    // Tons claros/escuros do mesmo matiz (bordas suavizadas) contam como a mesma cor
    const matiz = ([r, g, b]: RGB) => {
        const max = Math.max(r, g, b);
        const d = max - Math.min(r, g, b);
        if (d === 0) return 0;
        const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return (h * 60 + 360) % 360;
    };
    const difMatiz = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
    const cores: RGB[] = [];
    [...grupos.values()].sort((a, b) => b.n - a.n).forEach(e => {
        const c: RGB = [e.r / e.n, e.g / e.n, e.b / e.n];
        const distinta = cores.every(o => difMatiz(matiz(o), matiz(c)) >= 25);
        if (distinta && cores.length < 4 && e.n >= minimo) cores.push(c);
    });
    return cores.map(rgbParaHex);
};

type Analise = Pick<Marca, 'transparente' | 'logoLum' | 'histLum' | 'coresLogo'>;

// O que decide se o logo "some" no cabeçalho é o contorno (pixels do logo encostados na transparência):
// um logo redondo com anel branco aparece bem num cabeçalho escuro, mesmo com o miolo escuro.
const analisar = (canvas: HTMLCanvasElement): Analise => {
    const { width: w, height: h } = canvas;
    const px = ctx2d(canvas).getImageData(0, 0, w, h).data;
    const opaco = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3] >= 128;
    let transparente = false;
    let somaLum = 0;
    let nLum = 0;
    let nContorno = 0;
    const hist = new Array(FAIXAS_LUM).fill(0);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if (px[i + 3] < 250) transparente = true;
            if (px[i + 3] < 128) continue;
            const l = luminancia([px[i], px[i + 1], px[i + 2]]);
            somaLum += l;
            nLum++;
            if (!opaco(x - 1, y) || !opaco(x + 1, y) || !opaco(x, y - 1) || !opaco(x, y + 1)) {
                hist[faixaDe(l)] += 1;
                nContorno++;
            }
        }
    }
    return {
        transparente,
        logoLum: nLum ? somaLum / nLum : 0.5,
        histLum: hist.map(v => (nContorno ? v / nContorno : 0)),
        coresLogo: extrairCores(canvas),
    };
};

// Redimensiona, remove o fundo (quando houver) e analisa; guarda também a outra versão para alternar
const montarLogo = (img: HTMLImageElement, arquivoPng: boolean): Omit<Marca, 'cor'> => {
    for (const maxLado of [600, 420, 300]) {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const base = novoCanvas(w, h);
        ctx2d(base).drawImage(img, 0, 0, w, h);
        const dados = ctx2d(base).getImageData(0, 0, w, h);

        let limpo: HTMLCanvasElement | null = null;
        const copia = new ImageData(new Uint8ClampedArray(dados.data), w, h);
        const fundo = removerFundo(copia);
        if (fundo.fracao > 0) {
            limpo = novoCanvas(w, h);
            ctx2d(limpo).putImageData(copia, 0, 0);
            limpo = recortar(limpo);
        }
        const original = recortar(base);
        const exportar = (c: HTMLCanvasElement) => (c === limpo || arquivoPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9));

        // Fundo neutro sai automaticamente; fundo colorido fica (pode ser a arte), com opção de remover
        const ativo = limpo && fundo.neutro ? limpo : original;
        const outro = limpo ? (ativo === limpo ? original : limpo) : null;
        const logo = exportar(ativo);
        const logoAlternativo = outro ? exportar(outro) : null;
        if (logo.length + (logoAlternativo?.length || 0) <= MAX_TOTAL) {
            return { logo, logoAlternativo, semFundo: ativo === limpo, ...analisar(ativo) };
        }
    }
    throw new Error('Esse logo é muito pesado. Tente uma versão mais simples ou em JPG.');
};

export const processarLogo = async (arquivo: File): Promise<Omit<Marca, 'cor'>> => {
    const nome = arquivo.name.toLowerCase();
    if (!TIPOS_ACEITOS.includes(arquivo.type) && !/\.(png|jpe?g)$/.test(nome)) {
        throw new Error('Use uma imagem PNG (de preferência com fundo transparente) ou JPG/JPEG.');
    }
    if (arquivo.size > MAX_ARQUIVO) throw new Error('A imagem passa de 10 MB. Use um arquivo menor.');

    const url = URL.createObjectURL(arquivo);
    try {
        const img = await carregarImagem(url);
        return montarLogo(img, arquivo.type === 'image/png' || nome.endsWith('.png'));
    } catch (e) {
        if ((e as Error).message.includes('pesado')) throw e;
        throw new Error('Não foi possível abrir a imagem. Verifique se o arquivo é um PNG ou JPG válido.');
    } finally {
        URL.revokeObjectURL(url);
    }
};

// Logos salvos antes da remoção automática de fundo: passam pelo mesmo tratamento
export const reprocessarLogo = async (logo: string): Promise<Omit<Marca, 'cor'>> =>
    montarLogo(await carregarImagem(logo), logo.startsWith('data:image/png'));

// Alterna entre o logo sem fundo e o original
export const alternarFundo = async (marca: Marca): Promise<Marca> => {
    if (!marca.logo || !marca.logoAlternativo) return marca;
    const img = await carregarImagem(marca.logoAlternativo);
    const c = novoCanvas(img.width, img.height);
    ctx2d(c).drawImage(img, 0, 0);
    return { ...marca, logo: marca.logoAlternativo, logoAlternativo: marca.logo, semFundo: !marca.semFundo, ...analisar(c) };
};
