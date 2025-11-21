
import React, { useState, useEffect, useCallback } from 'react';
import { Freela, Backup, BackupConfig, GoogleUser, CloudBackupInfo } from '../../types';
import BaseModal from './BaseModal';
import { uploadBackup, downloadBackup, getBackupMetadata } from '../../services/googleService';

interface BackupModalProps {
    isOpen: boolean;
    onClose: () => void;
    freelas: Freela[];
    setFreelas: React.Dispatch<React.SetStateAction<Freela[]>>;
    showToast: (message: string, type?: 'success' | 'error') => void;
    isLoggedIn: boolean;
    user: GoogleUser | null;
    onLoginClick: () => void;
    isAutoBackupEnabled: boolean;
    onToggleAutoBackup: (enabled: boolean) => void;
}

const BACKUP_KEY_PREFIX = 'controle_freelas_backup_';
const BACKUP_CONFIG_KEY = 'controle_freelas_backup_config';
const MAX_BACKUPS = 5;

const BackupModal: React.FC<BackupModalProps> = ({ 
    isOpen, onClose, freelas, setFreelas, showToast, 
    isLoggedIn, user, onLoginClick, isAutoBackupEnabled, onToggleAutoBackup 
}) => {
    const [backups, setBackups] = useState<Backup[]>([]);
    const [config, setConfig] = useState<BackupConfig>({ enabled: false, intervalHours: 24, lastBackupTime: null, nextBackupTime: null });
    const [cloudBackupInfo, setCloudBackupInfo] = useState<CloudBackupInfo | null>(null);
    const [isCloudLoading, setCloudLoading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const getBackupsList = useCallback(() => {
        try {
            const indexStr = localStorage.getItem(`${BACKUP_KEY_PREFIX}index`);
            if (!indexStr) return [];
            const index: { id: number }[] = JSON.parse(indexStr);
            return index
                .map(item => {
                    const backupStr = localStorage.getItem(`${BACKUP_KEY_PREFIX}${item.id}`);
                    return backupStr ? JSON.parse(backupStr) : null;
                })
                .filter(b => b !== null)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        } catch (error) {
            console.error('Error loading backups:', error);
            return [];
        }
    }, []);

    const fetchCloudBackupInfo = useCallback(async () => {
        if (isLoggedIn) {
            setCloudLoading(true);
            try {
                const metadata = await getBackupMetadata();
                setCloudBackupInfo(metadata);
            } catch (error) {
                console.error('Failed to fetch cloud backup info', error);
                setCloudBackupInfo(null);
            } finally {
                setCloudLoading(false);
            }
        }
    }, [isLoggedIn]);

    useEffect(() => {
        if (isOpen) {
            const storedConfig = localStorage.getItem(BACKUP_CONFIG_KEY);
            if (storedConfig) setConfig(JSON.parse(storedConfig));
            setBackups(getBackupsList());
            fetchCloudBackupInfo();
        }
    }, [isOpen, getBackupsList, fetchCloudBackupInfo]);
    
    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const newConfig = { ...config, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : parseInt(value) };
        setConfig(newConfig);
        localStorage.setItem(BACKUP_CONFIG_KEY, JSON.stringify(newConfig));
        showToast('Configurações salvas!');
    };
    
    const createBackup = useCallback((isManual = false) => {
        try {
            const currentBackups = getBackupsList();
            const newBackup: Backup = { id: Date.now(), timestamp: new Date().toISOString(), data: freelas, count: freelas.length };
            
            let updatedBackups = [newBackup, ...currentBackups];
            if (updatedBackups.length > MAX_BACKUPS) {
                const oldest = updatedBackups.pop();
                if(oldest) localStorage.removeItem(`${BACKUP_KEY_PREFIX}${oldest.id}`);
            }

            localStorage.setItem(`${BACKUP_KEY_PREFIX}${newBackup.id}`, JSON.stringify(newBackup));
            const newIndex = updatedBackups.map(b => ({ id: b.id, timestamp: b.timestamp, count: b.count }));
            localStorage.setItem(`${BACKUP_KEY_PREFIX}index`, JSON.stringify(newIndex));

            setBackups(updatedBackups);
            if (isManual) showToast('Backup local criado com sucesso!');
            return true;
        } catch (error) {
            console.error("Backup creation failed:", error);
            if (isManual) showToast('Falha ao criar backup local', 'error');
            return false;
        }
    }, [freelas, getBackupsList, showToast]);

    const restoreBackup = (backupId: number) => {
        const backup = backups.find(b => b.id === backupId);
        if (backup) {
            setFreelas(backup.data);
            showToast('Backup local restaurado com sucesso!');
            onClose();
        } else {
            showToast('Backup não encontrado', 'error');
        }
    };
    
    const deleteBackup = (backupId: number) => {
        localStorage.removeItem(`${BACKUP_KEY_PREFIX}${backupId}`);
        const updatedBackups = backups.filter(b => b.id !== backupId);
        const newIndex = updatedBackups.map(b => ({ id: b.id, timestamp: b.timestamp, count: b.count }));
        localStorage.setItem(`${BACKUP_KEY_PREFIX}index`, JSON.stringify(newIndex));
        setBackups(updatedBackups);
        showToast('Backup local excluído.');
    };
    
    const exportData = (data: any, fileName: string) => {
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = fileName;
        link.click();
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const dataToImport = JSON.parse(event.target?.result as string);
                // Handle both raw freela array and backup object formats
                const freelasToImport = Array.isArray(dataToImport) ? dataToImport : dataToImport.data;
                
                if (freelasToImport && Array.isArray(freelasToImport)) {
                    createBackup(); // Backup before import
                    setFreelas(freelasToImport);
                    showToast(`${freelasToImport.length} freelas importados!`);
                    onClose();
                } else {
                    showToast('Arquivo de importação inválido.', 'error');
                }
            } catch (error) {
                showToast('Erro ao ler o arquivo.', 'error');
            }
        };
        reader.readAsText(file);
    };

    const handleCloudUpload = async () => {
        setCloudLoading(true);
        try {
            await uploadBackup(freelas);
            await fetchCloudBackupInfo();
            showToast('Backup salvo na nuvem com sucesso!');
        } catch (error) {
            showToast('Falha ao salvar na nuvem.', 'error');
            console.error(error);
        } finally {
            setCloudLoading(false);
        }
    };
    
    const handleCloudDownload = async () => {
        setCloudLoading(true);
        try {
            const cloudFreelas = await downloadBackup();
            if (cloudFreelas) {
                createBackup(); // Create local backup before restoring
                setFreelas(cloudFreelas);
                showToast('Dados restaurados da nuvem!');
                onClose();
            } else {
                showToast('Nenhum backup encontrado na nuvem.', 'error');
            }
        } catch (error) {
            showToast('Falha ao restaurar da nuvem.', 'error');
            console.error(error);
        } finally {
            setCloudLoading(false);
        }
    };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Backup & Restauração" titleIcon="💾" maxWidth="sm:max-w-xl">
            <div className="p-6 space-y-6">
                
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <h4 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
                        Backup na Nuvem (Google Drive)
                    </h4>
                    {isLoggedIn && user ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 bg-white p-3 rounded-lg">
                                <img src={user.picture} alt={user.name} className="w-10 h-10 rounded-full" />
                                <div>
                                    <p className="font-semibold text-gray-800">{user.name}</p>
                                    <p className="text-xs text-gray-500">{user.email}</p>
                                </div>
                            </div>
                            
                            <label className="flex items-center gap-3 cursor-pointer bg-white p-3 rounded-lg">
                               <input type="checkbox" checked={isAutoBackupEnabled} onChange={(e) => onToggleAutoBackup(e.target.checked)} className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500" />
                                <div>
                                    <div className="font-semibold text-gray-900">Backup Automático na Nuvem</div>
                                    <div className="text-xs text-gray-600">Salva alterações automaticamente no Google Drive.</div>
                                </div>
                            </label>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <button onClick={handleCloudUpload} disabled={isCloudLoading} className="bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isCloudLoading ? 'Salvando...' : <><span>☁️</span> Salvar na Nuvem Agora</>}
                                </button>
                                <button onClick={handleCloudDownload} disabled={isCloudLoading || !cloudBackupInfo} className="bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                                     {isCloudLoading ? 'Restaurando...' : <><span>🔄</span> Restaurar da Nuvem</>}
                                </button>
                            </div>
                            <div className="text-center text-xs text-gray-600 mt-2">
                                {isCloudLoading ? 'Acessando Google Drive...' : cloudBackupInfo ? `Último backup: ${new Date(cloudBackupInfo.modifiedTime).toLocaleString('pt-BR')}` : 'Nenhum backup encontrado na nuvem.'}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="mb-4 text-gray-700">Faça login com sua conta Google para salvar seus freelas na nuvem e sincronizar com a Agenda.</p>
                            <button onClick={onLoginClick} className="bg-red-500 text-white font-semibold py-2 px-6 rounded-lg hover:bg-red-600 transition flex items-center justify-center gap-2 mx-auto">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zM5.12 6.162a5.98 5.98 0 018.76 0l-1.32 1.32a3.987 3.987 0 00-6.12 0L5.12 6.162zM10 12a2 2 0 110-4 2 2 0 010 4zm0 2a4 4 0 100-8 4 4 0 000 8zm-3.838.878a5.982 5.982 0 018.76 0l-1.32-1.32a3.987 3.987 0 00-6.12 0l-1.32 1.32z"/></svg>
                                Conectar com Google
                            </button>
                             <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 text-left text-sm rounded-r-lg" role="alert">
                                <p className="font-bold">Aviso Importante</p>
                                <p className="mt-1">
                                    Para usar os recursos na nuvem, o Google pode exigir a ativação de suas APIs, o que pode envolver a configuração de um faturamento e a adição de um cartão de crédito.
                                    Este é um procedimento padrão do Google para verificação e prevenção de abusos, mesmo que o uso se mantenha na faixa gratuita. O app não tem controle sobre este processo.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                    <h4 className="text-lg font-bold text-gray-900 mb-3">📤 Exportar / Importar Local</h4>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                         <button onClick={() => exportData({ type: 'manual_export', data: freelas }, `freelas-manual-backup-${Date.now()}.json`)} className="bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition font-medium flex items-center justify-center gap-2"><span>📥</span> Exportar Dados</button>
                         <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-medium flex items-center justify-center gap-2"><span>📤</span> Importar Dados</button>
                         <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
                    </div>
                </div>

                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-3">
                        <h4 className="text-lg font-bold text-gray-900">🗂️ Backups Locais ({backups.length}/{MAX_BACKUPS})</h4>
                        <button onClick={() => createBackup(true)} className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition font-medium text-sm">Gerar Backup Local</button>
                    </div>
                    <div className="space-y-3">
                        {backups.length > 0 ? backups.map((backup, index) => (
                            <div key={backup.id} className="bg-white border-2 border-gray-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                     <div>
                                        <div className="font-bold text-gray-900">Backup #{backups.length - index}</div>
                                        <div className="text-xs text-gray-600">{new Date(backup.timestamp).toLocaleString('pt-BR')} • {backup.count} freelas</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => restoreBackup(backup.id)} className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 text-xs font-medium">Restaurar</button>
                                        <button onClick={() => deleteBackup(backup.id)} className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 text-xs font-medium">Excluir</button>
                                    </div>
                                </div>
                            </div>
                        )) : <p className="text-center text-gray-500 py-4">Nenhum backup local salvo.</p>}
                    </div>
                </div>
            </div>
        </BaseModal>
    );
};

export default BackupModal;
