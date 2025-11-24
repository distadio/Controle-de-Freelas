import { Freela, CloudBackupInfo } from '../types';

declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

// ✅ CLIENT ID DO PROJETO "CONTROLE DE FREELAS"
const CLIENT_ID = '542665329030-t7djtrtqqctm9soleiqg6nbiipvng7sr.apps.googleusercontent.com';

function getCheckedApiKey(): string {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("VITE_GOOGLE_API_KEY is not defined. Please check your environment variables or GitHub Secrets.");
    }
    return apiKey;
}

const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const DISCOVERY_DOCS = [
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"
];

const BACKUP_FILENAME = 'controle-freelas-backup.json';
const CALENDAR_NAME = 'Controle de Freelas';
const CALENDAR_ID_STORAGE_KEY = 'freela_calendar_id';

let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;

const waitForGoogleLibs = (): Promise<void> => {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (window.gapi && window.google && window.google.accounts) {
                clearInterval(checkInterval);
                console.log("✅ Google libraries loaded");
                resolve();
            }
        }, 100);
        
        setTimeout(() => {
            clearInterval(checkInterval);
            if (!window.gapi || !window.google) {
                console.error("❌ Google libraries failed to load");
            }
        }, 10000);
    });
};

export const initGoogleClient = async (callback: (tokenResponse: any) => void) => {
    try {
        await waitForGoogleLibs();

        await new Promise<void>((resolve) => {
            window.gapi.load('client', () => {
                console.log("✅ GAPI client loaded");
                resolve();
            });
        });

        await window.gapi.client.init({
            apiKey: getCheckedApiKey(),
            discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        console.log("✅ GAPI initialized");

        tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: async (response: any) => {
                console.log("🔐 Token response:", response);
                
                if (response.access_token) {
                    window.gapi.client.setToken({
                        access_token: response.access_token
                    });
                    callback(response);
                } else if (response.error) {
                    console.error("❌ Auth error:", response);
                    alert('Erro na autenticação: ' + response.error);
                }
            },
        });
        gisInited = true;
        console.log("✅ GIS initialized");

    } catch (error) {
        console.error("❌ Error initializing Google Client:", error);
        alert("Erro ao inicializar APIs do Google. Recarregue a página.");
    }
};

export const signIn = () => {
    console.log("🔐 signIn called, gisInited:", gisInited);
    
    if (!gisInited || !tokenClient) {
        console.error("❌ Google Identity Services not initialized");
        alert("Google OAuth ainda não foi inicializado. Aguarde e tente novamente.");
        return;
    }
    
    try {
        const token = window.gapi.client.getToken();
        if (token === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    } catch (error) {
        console.error("❌ Error during sign in:", error);
        alert("Erro ao fazer login: " + error);
    }
};

export const signOut = () => {
    const token = window.gapi.client.getToken();
    if (token !== null) {
        window.google.accounts.oauth2.revoke(token.access_token, () => {
            console.log("✅ Token revoked");
        });
        window.gapi.client.setToken(null);
        localStorage.removeItem(CALENDAR_ID_STORAGE_KEY);
    }
};

const getFileId = async (): Promise<string | null> => {
    try {
        const response = await window.gapi.client.drive.files.list({
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
        });
        const file = response.result.files?.find((f: any) => f.name === BACKUP_FILENAME);
        return file ? file.id : null;
    } catch (error) {
        console.error("❌ Error getting file ID:", error);
        return null;
    }
};

export const uploadBackup = async (freelas: Freela[]) => {
    try {
        const fileId = await getFileId();
        const fileContent = JSON.stringify({ 
            data: freelas, 
            timestamp: new Date().toISOString() 
        });
        
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const metadata = {
            name: BACKUP_FILENAME,
            mimeType: 'application/json',
            ...(!fileId && { parents: ['appDataFolder'] })
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
                    console.error("❌ Upload error:", err);
                    reject(err);
                } else {
                    console.log("✅ Backup uploaded successfully");
                    resolve(file);
                }
            });
        });
    } catch (error) {
        console.error("❌ Error uploading backup:", error);
        throw error;
    }
};

export const downloadBackup = async (): Promise<Freela[] | null> => {
    try {
        const fileId = await getFileId();
        if (!fileId) {
            console.log("ℹ️ No backup file found");
            return null;
        }
        
        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        const backupObject = JSON.parse(response.body);
        if (backupObject && backupObject.data) {
            console.log("✅ Backup downloaded successfully");
            return backupObject.data as Freela[];
        }
        return null;
    } catch (error) {
        console.error("❌ Error downloading backup:", error);
        return null;
    }
};

export const getBackupMetadata = async (): Promise<CloudBackupInfo | null> => {
    try {
        const fileId = await getFileId();
        if (!fileId) return null;
        
        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            fields: 'id,modifiedTime',
        });
        console.log("✅ Backup metadata retrieved");
        return response.result as CloudBackupInfo;
    } catch (error) {
        console.error("❌ Error getting backup metadata:", error);
        return null;
    }
};

export const findOrCreateCalendar = async (): Promise<string | null> => {
    try {
        const storedCalendarId = localStorage.getItem(CALENDAR_ID_STORAGE_KEY);
        if (storedCalendarId) {
            console.log("✅ Using stored calendar ID");
            return storedCalendarId;
        }

        const response = await window.gapi.client.calendar.calendarList.list();
        const existingCalendar = response.result.items?.find((c: any) => c.summary === CALENDAR_NAME);

        if (existingCalendar) {
            console.log("✅ Found existing calendar");
            localStorage.setItem(CALENDAR_ID_STORAGE_KEY, existingCalendar.id);
            return existingCalendar.id;
        } else {
            console.log("📅 Creating new calendar");
            const createResponse = await window.gapi.client.calendar.calendars.insert({
                summary: CALENDAR_NAME,
            });
            const newCalendarId = createResponse.result.id;
            localStorage.setItem(CALENDAR_ID_STORAGE_KEY, newCalendarId);
            console.log("✅ Calendar created successfully");
            return newCalendarId;
        }
    } catch (error) {
        console.error("❌ Error with calendar:", error);
        throw error;
    }
};

export const syncFreelaToCalendar = async (calendarId: string, freela: Freela): Promise<string | null> => {
    try {
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
            'description': `Contratante: ${freela.contratante || 'N/A'}\nTipo: ${freela.tipo_servico.replace(/_/g, ' ')}\nFunção: ${freela.categoria.replace(/_/g, ' ')}\n\nObservações: ${freela.observacoes || ''}\n\nGerado por Controle de Freelas`,
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
        console.log("✅ Event synced to calendar");
        return response.result.id;
    } catch (error) {
        console.error("❌ Error syncing to calendar:", error);
        throw error;
    }
};

export const deleteCalendarEvent = async (calendarId: string, eventId: string) => {
    try {
        await window.gapi.client.calendar.events.delete({
            calendarId: calendarId,
            eventId: eventId,
        });
        console.log("✅ Event deleted from calendar");
    } catch (error) {
        console.error("❌ Error deleting event:", error);
        throw error;
    }
};