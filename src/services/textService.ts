// Normalização de nomes digitados livremente (contratantes etc.):
// remove espaços nas pontas e colapsa espaços duplicados internos.
export const normalizeName = (s?: string | null): string => (s || '').trim().replace(/\s+/g, ' ');

// Chave de agrupamento: além da normalização de espaços, ignora
// maiúsculas/minúsculas para tratar "Pulga" e "pulga" como o mesmo nome.
export const nameKey = (s?: string | null): string => normalizeName(s).toLocaleLowerCase('pt-BR');
