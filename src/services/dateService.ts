
// Feriados Nacionais Fixos (formato: MM-DD)
const feriadosNacionaisFixos: { [key: string]: string } = {
    '01-01': 'Ano Novo',
    '04-21': 'Tiradentes',
    '05-01': 'Dia do Trabalho',
    '09-07': 'Independência do Brasil',
    '10-12': 'Nossa Senhora Aparecida',
    '11-02': 'Finados',
    '11-15': 'Proclamação da República',
    '11-20': 'Consciência Negra',
    '12-25': 'Natal'
};

// Feriados Municipais de São Paulo (formato: MM-DD)
const feriadosMunicipaisSP: { [key: string]: string } = {
    '01-25': 'Aniversário de São Paulo',
    '07-09': 'Revolução Constitucionalista'
};

// Função para calcular Páscoa (algoritmo de Meeus/Jones/Butcher)
const calcularPascoa = (ano: number): string => {
    const a = ano % 19;
    const b = Math.floor(ano / 100);
    const c = ano % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31);
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
};

// Gera feriados móveis para um ano específico
const getFeriadosMoveis = (ano: number): { [key: string]: string } => {
    const pascoa = calcularPascoa(ano);
    const [mesPascoa, diaPascoa] = pascoa.split('-').map(Number);
    const dataPascoa = new Date(ano, mesPascoa - 1, diaPascoa);

    const dataCarnaval = new Date(dataPascoa);
    dataCarnaval.setDate(dataPascoa.getDate() - 47);
    const carnaval = `${String(dataCarnaval.getMonth() + 1).padStart(2, '0')}-${String(dataCarnaval.getDate()).padStart(2, '0')}`;

    const dataSextaSanta = new Date(dataPascoa);
    dataSextaSanta.setDate(dataPascoa.getDate() - 2);
    const sextaSanta = `${String(dataSextaSanta.getMonth() + 1).padStart(2, '0')}-${String(dataSextaSanta.getDate()).padStart(2, '0')}`;
    
    const dataCorpusChristi = new Date(dataPascoa);
    dataCorpusChristi.setDate(dataPascoa.getDate() + 60);
    const corpusChristi = `${String(dataCorpusChristi.getMonth() + 1).padStart(2, '0')}-${String(dataCorpusChristi.getDate()).padStart(2, '0')}`;

    return {
        [carnaval]: 'Carnaval',
        [sextaSanta]: 'Sexta-feira Santa',
        [pascoa]: 'Páscoa',
        [corpusChristi]: 'Corpus Christi'
    };
};

const feriadosMoveisCache: { [key: number]: { [key: string]: string } } = {};

export const getHoliday = (dateString: string): { name: string; type: 'nacional' | 'municipal' } | null => {
    const [anoStr, mes, dia] = dateString.split('-');
    const ano = parseInt(anoStr);
    const mmdd = `${mes}-${dia}`;

    // Checa feriados fixos
    if (feriadosNacionaisFixos[mmdd]) return { name: feriadosNacionaisFixos[mmdd], type: 'nacional' };
    if (feriadosMunicipaisSP[mmdd]) return { name: feriadosMunicipaisSP[mmdd], type: 'municipal' };

    // Checa feriados móveis (com cache)
    if (!feriadosMoveisCache[ano]) {
        feriadosMoveisCache[ano] = getFeriadosMoveis(ano);
    }
    if (feriadosMoveisCache[ano][mmdd]) return { name: feriadosMoveisCache[ano][mmdd], type: 'nacional' };
    
    return null;
};
