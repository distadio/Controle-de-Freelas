
import { Freela, CloudBackupInfo, GoogleUser } from '../types';

declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

const CLIENT_ID = '165800758744-iagdlnets04qum5939s8bnpomqk1v4hm.apps.googleusercontent.com';
const API_KEY = process.env.API_KEY;
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar';
const DISCOVERY_DOCS = [
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"
];

const BACKUP_FILENAME = 'controle-freelas-backup.json';
const CALENDAR_NAME = 'Controle de Freelas';
const CALENDAR_ID_STORAGE_KEY = 'freela_calendar_id';

let tokenClient: any;
let gapiInited = false;
let gisInited = false;

const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(script);
    });
};


export const initGoogleClient = (callback: (tokenResponse: any) => void) => {
    const init = async () => {
        try {
            // Carrega os scripts do Google em paralelo
            await Promise.all([
                loadScript('https://apis.google.com/js/api.js'),
                loadScript('https://accounts.google.com/gsi/client')
            ]);

            // Após carregar, inicializa o GAPI
            await new Promise<void>((resolve) => {
                window.gapi.load('client', () => resolve());
            });

            if (!API_KEY) {
                console.error("Google API Key not provided. Google services will be unavailable.");
                return;
            }

            await window.gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: DISCOVERY_DOCS,
            });
            gapiInited = true;

            // Inicializa o GIS
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: callback,
            });
            gisInited = true;

        } catch (error) {
            console.error("Error initializing Google Client:", error);
        }
    };
    init();
};

export const signIn = () => {
    if (!gisInited) {
        console.error("Google Identity Services not initialized.");
        return;
    }
    if (window.gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
};

export const signOut = () => {
    const token = window.gapi.client.getToken();
    if (token !== null) {
        window.google.accounts.oauth2.revoke(token.access_token, () => {});
        window.gapi.client.setToken(null);
        localStorage.removeItem(CALENDAR_ID_STORAGE_KEY);
    }
};

const getFileId = async (): Promise<string | null> => {
    const response = await window.gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        fields: 'files(id, name)',
    });
    const file = response.result.files.find((f: any) => f.name === BACKUP_FILENAME);
    return file ? file.id : null;
};

export const uploadBackup = async (freelas: Freela[]) => {
    const fileId = await getFileId();
    const fileContent = JSON.stringify({ data: freelas, timestamp: new Date().toISOString() });
    
    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const metadata = {
        name: BACKUP_FILENAME,
        mimeType: 'application/json',
        ...( !fileId && { parents: ['appDataFolder'] } )
    };

    const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        close_delim;

    const request = window.gapi.client.request({
        path: `/upload/drive/v3/files${fileId ? `/${fileId}` : ''}`,
        method: fileId ? 'PATCH' : 'POST',
        params: { uploadType: 'multipart' },
        headers: {
            'Content-Type': 'multipart/related; boundary="' + boundary + '"',
        },
        body: multipartRequestBody,
    });
    
    return new Promise((resolve, reject) => {
        request.execute((file: any, err: any) => {
            if (err) {
                console.error("Upload error", err);
                reject(err);
            } else {
                resolve(file);
            }
        });
    });
};


export const downloadBackup = async (): Promise<Freela[] | null> => {
    const fileId = await getFileId();
    if (!fileId) return null;
    
    try {
        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        // The body is a string, parse it to get the object
        const backupObject = JSON.parse(response.body);
        if (backupObject && backupObject.data) {
            return backupObject.data as Freela[];
        }
    } catch (error) {
        console.error("Error downloading or parsing backup:", error);
    }
    
    return null;
};

export const getBackupMetadata = async (): Promise<CloudBackupInfo | null> => {
    const fileId = await getFileId();
    if (!fileId) return null;
    
    const response = await window.gapi.client.drive.files.get({
        fileId: fileId,
        fields: 'id,modifiedTime',
    });
    return response.result as CloudBackupInfo;
};

export const findOrCreateCalendar = async (): Promise<string | null> => {
    const storedCalendarId = localStorage.getItem(CALENDAR_ID_STORAGE_KEY);
    if (storedCalendarId) return storedCalendarId;

    const response = await window.gapi.client.calendar.calendarList.list();
    const existingCalendar = response.result.items.find((c: any) => c.summary === CALENDAR_NAME);

    if (existingCalendar) {
        localStorage.setItem(CALENDAR_ID_STORAGE_KEY, existingCalendar.id);
        return existingCalendar.id;
    } else {
        const createResponse = await window.gapi.client.calendar.calendars.insert({
            summary: CALENDAR_NAME,
        });
        const newCalendarId = createResponse.result.id;
        localStorage.setItem(CALENDAR_ID_STORAGE_KEY, newCalendarId);
        return newCalendarId;
    }
};

export const syncFreelaToCalendar = async (calendarId: string, freela: Freela): Promise<string | null> => {
    const isAllDay = !freela.horario_inicio;
    let start, end;

    if (isAllDay) {
        const endDate = new Date(freela.data_evento + 'T00:00:00');
        endDate.setDate(endDate.getDate() + 1);
        start = { 'date': freela.data_evento };
        end = { 'date': endDate.toISOString().split('T')[0] };
    } else {
        const startTime = freela.horario_inicio;
        let endTime = freela.horario_fim;
        if (!endTime) {
            const d = new Date(`1970-01-01T${startTime}`);
            d.setHours(d.getHours() + 1);
            endTime = d.toTimeString().split(' ')[0].substring(0, 5);
        }
        start = { 'dateTime': `${freela.data_evento}T${startTime}:00`, 'timeZone': 'America/Sao_Paulo' };
        end = { 'dateTime': `${freela.data_evento}T${endTime}:00`, 'timeZone': 'America/Sao_Paulo' };
    }
    
    const eventResource = {
        'summary': freela.descricao,
        'location': freela.local || '',
        'description': `<b>Contratante:</b> ${freela.contratante || 'N/A'}\n<b>Tipo:</b> ${freela.tipo_servico.replace(/_/g, ' ')}\n<b>Função:</b> ${freela.categoria.replace(/_/g, ' ')}\n\n<b>Observações:</b> ${freela.observacoes || ''}\n\n<i>Gerado por Controle de Freelas. (Valor não incluído por privacidade)</i>`,
        'start': start,
        'end': end,
        'reminders': {
            'useDefault': false,
            'overrides': [
                { 'method': 'popup', 'minutes': 24 * 60 },
                { 'method': 'popup', 'minutes': 120 },
            ],
        },
    };

    let request;
    if (freela.google_calendar_event_id) {
        request = window.gapi.client.calendar.events.update({
            calendarId: calendarId,
            eventId: freela.google_calendar_event_id,
            resource: eventResource,
        });
    } else {
        request = window.gapi.client.calendar.events.insert({
            calendarId: calendarId,
            resource: eventResource,
        });
    }

    const response = await request;
    return response.result.id;
};

export const deleteCalendarEvent = (calendarId: string, eventId: string) => {
    return window.gapi.client.calendar.events.delete({
        calendarId: calendarId,
        eventId: eventId,
    });
};
