// Identidade visual da invoice: logo da empresa e cor do cabeçalho.

export interface Marca {
    logo: string | null; // data URL (PNG ou JPEG) já redimensionado
    transparente?: boolean; // logo com fundo transparente
    logoLum?: number; // luminância média do logo (0 = escuro, 1 = claro)
    histLum?: number[]; // fração do logo em cada faixa de luminância (faixas perceptuais, ver faixaDe)
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
const MAX_DATA_URL = 450 * 1024; // mantém o armazenamento do aparelho leve

const carregarImagem = (arquivo: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagem inválida')); };
    img.src = url;
});

// Cores predominantes do logo (ignora transparência, branco, preto e cinzas)
const extrairCores = (img: HTMLImageElement): string[] => {
    const lado = 64;
    const canvas = document.createElement('canvas');
    canvas.width = lado;
    canvas.height = lado;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, lado, lado);
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

export const processarLogo = async (arquivo: File): Promise<Omit<Marca, 'cor'>> => {
    const nome = arquivo.name.toLowerCase();
    if (!TIPOS_ACEITOS.includes(arquivo.type) && !/\.(png|jpe?g)$/.test(nome)) {
        throw new Error('Use uma imagem PNG (de preferência com fundo transparente) ou JPG/JPEG.');
    }
    if (arquivo.size > MAX_ARQUIVO) throw new Error('A imagem passa de 10 MB. Use um arquivo menor.');

    let img: HTMLImageElement;
    try {
        img = await carregarImagem(arquivo);
    } catch {
        throw new Error('Não foi possível abrir a imagem. Verifique se o arquivo é um PNG ou JPG válido.');
    }
    const png = arquivo.type === 'image/png' || nome.endsWith('.png');

    // Redimensiona até caber no limite de tamanho
    let logo = '';
    let transparente = false;
    let somaLum = 0;
    let somaAlfa = 0;
    let hist: number[] = [];
    for (const maxLado of [600, 420, 300]) {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * escala));
        const h = Math.max(1, Math.round(img.height * escala));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        if (!png) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);

        const px = ctx.getImageData(0, 0, w, h).data;
        transparente = false;
        somaLum = 0;
        somaAlfa = 0;
        hist = new Array(FAIXAS_LUM).fill(0);
        for (let i = 0; i < px.length; i += 16) { // amostra 1 a cada 4 pixels
            const a = px[i + 3] / 255;
            if (a < 0.98) transparente = true;
            if (a < 0.5) continue; // bordas e fundo transparente não contam
            const l = luminancia([px[i], px[i + 1], px[i + 2]]);
            somaLum += l;
            somaAlfa += 1;
            hist[faixaDe(l)] += 1;
        }
        logo = png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
        if (logo.length <= MAX_DATA_URL) break;
    }
    if (logo.length > MAX_DATA_URL) {
        throw new Error('Esse logo é muito pesado. Tente uma versão mais simples ou em JPG.');
    }
    return {
        logo,
        transparente: png && transparente,
        logoLum: somaAlfa > 0 ? somaLum / somaAlfa : 0.5,
        histLum: hist.map(n => (somaAlfa > 0 ? n / somaAlfa : 0)),
        coresLogo: extrairCores(img),
    };
};
