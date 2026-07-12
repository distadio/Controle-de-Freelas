declare const __APP_VERSION__: string;

export enum FreelaStatus {
    Pago = 'pago',
    Pendente = 'pendente',
    Atrasada = 'atrasada'
}

export enum TipoServico {
    Show = 'show',
    EventoCorporativo = 'evento_corporativo',
    FestaParticular = 'festa_particular',
    CasaDeShowEventos = 'casa_de_show_eventos',
    Teatro = 'teatro',
    Workshop = 'workshop',
    Studio = 'studio',
    Outro = 'outro'
}

export enum Categoria {
    Som = 'som',
    Iluminacao = 'iluminacao',
    Video = 'video',
    Producao = 'producao',
    Performance = 'performance',
    BombeiroCivil = 'bombeiro_civil',
    SegurancaPatrimonial = 'seguranca_patrimonial',
    Fotografia = 'fotografia',
    Videomaker = 'videomaker',
    EdicaoAudiovisual = 'edicao_audiovisual',
    MixagemMasterizacao = 'mixagem_masterizacao',
    Garcom = 'garcom',
    Outro = 'outro'
}

export interface Freela {
    id: string;
    descricao: string;
    valor: number;
    data_evento: string; // YYYY-MM-DD
    horario_inicio?: string | null; // HH:MM
    horario_fim?: string | null; // HH:MM
    data_vencimento?: string | null; // YYYY-MM-DD
    tipo_servico: TipoServico | string;
    categoria: Categoria | string;
    categoria_customizada?: string | null;
    local?: string | null;
    contratante?: string | null;
    observacoes?: string | null;
    status: FreelaStatus | string;
    data_pagamento?: string | null; // YYYY-MM-DD
    declara_mei: boolean;
    google_calendar_event_id?: string | null;
    created_at: string; // ISO String
    updated_at: string; // ISO String
    conflictWith?: string; // ID of the conflicting freela
}

export interface Backup {
    id: number;
    timestamp: string;
    data: Freela[];
    count: number;
}

export interface BackupConfig {
    enabled: boolean;
    intervalHours: number;
    lastBackupTime: string | null;
    nextBackupTime: string | null;
}

export interface GapiAuthToken {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
}

export interface GoogleUser {
    email: string;
    name: string;
    picture: string;
}

export interface CloudBackupInfo {
    id: string;
    modifiedTime: string;
}