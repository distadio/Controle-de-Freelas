// Geração de PIX estático "copia e cola" (BR Code, padrão EMV do Banco Central).

export type TipoChavePix = 'cpf_cnpj' | 'telefone' | 'email' | 'aleatoria';

export interface PixConfig {
    tipo: TipoChavePix;
    chave: string;
    nome: string; // nome do favorecido (titular da conta)
    cidade: string;
}

export const TIPOS_CHAVE_PIX: { id: TipoChavePix; label: string; placeholder: string }[] = [
    { id: 'cpf_cnpj', label: 'CPF / CNPJ', placeholder: '000.000.000-00' },
    { id: 'telefone', label: 'Celular', placeholder: '(11) 99999-9999' },
    { id: 'email', label: 'E-mail', placeholder: 'voce@email.com' },
    { id: 'aleatoria', label: 'Chave aleatória', placeholder: '123e4567-e89b-12d3-a456-426614174000' },
];

const soDigitos = (s: string) => s.replace(/\D/g, '');

// Remove acentos e qualquer caractere fora do ASCII imprimível (exigência do BR Code)
const ascii = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7E]/g, '').trim();

const telefoneSemPais = (chave: string) => {
    const d = soDigitos(chave);
    return d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
};

export const normalizarChavePix = (tipo: TipoChavePix, chave: string): string => {
    const c = chave.trim();
    switch (tipo) {
        case 'cpf_cnpj': return soDigitos(c);
        case 'telefone': return `+55${telefoneSemPais(c)}`;
        case 'email':
        case 'aleatoria': return c.toLowerCase();
    }
};

// Retorna a mensagem de erro, ou null se a chave for válida
export const validarChavePix = (tipo: TipoChavePix, chave: string): string | null => {
    const c = chave.trim();
    if (!c) return 'Informe a chave PIX.';
    switch (tipo) {
        case 'cpf_cnpj': {
            const n = soDigitos(c).length;
            return n === 11 || n === 14 ? null : 'CPF deve ter 11 dígitos e CNPJ, 14.';
        }
        case 'telefone': {
            const n = telefoneSemPais(c).length;
            return n === 10 || n === 11 ? null : 'Informe o celular com DDD, ex: (11) 99999-9999.';
        }
        case 'email':
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) ? null : 'E-mail inválido.';
        case 'aleatoria':
            return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c) ? null : 'Chave aleatória inválida (formato 8-4-4-4-12).';
    }
};

// CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF), exigido no campo 63
export const crc16 = (payload: string): string => {
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let b = 0; b < 8; b++) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
            crc &= 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
};

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, '0')}${valor}`;

export const gerarPixCopiaECola = (params: {
    chave: string; // já normalizada
    nome: string;
    cidade: string;
    valor?: number;
    txid?: string;
}): string => {
    const txid = (params.txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';
    const payload =
        campo('00', '01') +
        campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', params.chave)) +
        campo('52', '0000') +
        campo('53', '986') +
        (params.valor && params.valor > 0 ? campo('54', params.valor.toFixed(2)) : '') +
        campo('58', 'BR') +
        campo('59', ascii(params.nome).slice(0, 25) || 'RECEBEDOR') +
        campo('60', ascii(params.cidade).slice(0, 15) || 'BRASIL') +
        campo('62', campo('05', txid)) +
        '6304';
    return payload + crc16(payload);
};
