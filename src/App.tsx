// Main application component.
import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import ReactDOM from 'react-dom';
import { Freela, Categoria, TipoServico } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAuth } from './contexts/AuthContext';
import { uploadBackup, getCloudBackup, findOrCreateCalendar, syncFreelaToCalendar, deleteCalendarEvent } from './services/googleService';
import SplashScreen from './components/SplashScreen';
import Header from './components/Header';
import Calendar from './components/Calendar';
import FreelaList from './components/FreelaList';
import Footer from './components/Footer';
import FAB from './components/FAB';
import FreelaFormModal from './components/modals/FreelaFormModal';
import FreelaDetailsModal from './components/modals/FreelaDetailsModal';
import BackupModal from './components/modals/BackupModal';
import ReportModal from './components/modals/ReportModal';
import MeiPopup from './components/modals/MeiPopup';
import MeiConfigModal from './components/modals/MeiConfigModal';
import Toast from './components/Toast';
import ConflictModal from './components/modals/ConflictModal';
import PrivacyPolicyModal from './components/modals/PrivacyPolicyModal';
import AboutModal from './components/modals/AboutModal';
import DayFreelasModal from './components/modals/DayFreelasModal';

// Carregado sob demanda: o Dashboard puxa Recharts e a lib do Gemini,
// que são pesadas — assim o app abre mais rápido no celular.
const DashboardModal = React.lazy(() => import('./components/modals/DashboardModal'));

const modalRoot = document.getElementById('modal-root');

const todayString = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const App: React.FC = () => {
    const [showSplash, setShowSplash] = useState(true);
    const [freelas, setFreelas] = useLocalStorage<Freela[]>('controle_freelas_data_v2', []);
    const [isCloudAutoBackupEnabled, setCloudAutoBackupEnabled] = useLocalStorage('controle_freelas_auto_cloud_backup', false);
    const [privacyPolicyAccepted, setPrivacyPolicyAccepted] = useLocalStorage('controle_freelas_privacy_policy_accepted', false);
    const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
    const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('controle_freelas_theme', 'light');
    const [meiLimiteAnual, setMeiLimiteAnual] = useLocalStorage<number>('controle_freelas_mei_limite_anual', 81000);
    const [bannerDismissedOn, setBannerDismissedOn] = useLocalStorage<string>('controle_freelas_banner_dismissed', '');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedFreela, setSelectedFreela] = useState<Freela | null>(null);
    const [conflictState, setConflictState] = useState<{ conflicting: Freela; pending: Partial<Freela> } | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [meiStatus, setMeiStatus] = useState<'ok' | 'warning' | 'danger'>('ok');
    const [meiInfo, setMeiInfo] = useState({ total: 0, limit: 6750 });
    const [meiPopupShown, setMeiPopupShown] = useState<Record<string, boolean>>({});
    const { user, isLoggedIn, signIn, signOut } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasReconciledCloudRef = useRef(false);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, [theme]);

    // Resumo do dia: freelas de hoje + pagamentos atrasados (banner dispensável 1x/dia)
    const todayInfo = useMemo(() => {
        const today = todayString();
        const todayFreelas = freelas
            .filter(f => f.data_evento === today)
            .sort((a, b) => (a.horario_inicio || '').localeCompare(b.horario_inicio || ''));
        const overdue = freelas.filter(f => f.status === 'atrasada');
        const overdueTotal = overdue.reduce((s, f) => s + f.valor, 0);
        return { today, todayFreelas, overdueCount: overdue.length, overdueTotal };
    }, [freelas]);

    const showTodayBanner = bannerDismissedOn !== todayInfo.today
        && (todayInfo.todayFreelas.length > 0 || todayInfo.overdueCount > 0);

    // Troca de mês por gesto de deslizar (swipe horizontal)
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
        const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
        touchStartRef.current = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) {
            setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + (dx < 0 ? 1 : -1), 1));
        }
    };

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const updateFreelasStatus = useCallback(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const updatedFreelas = freelas.map(freela => {
            if (freela.status !== 'pago' && freela.data_vencimento) {
                const dueDate = new Date(freela.data_vencimento + 'T00:00:00');
                if (dueDate < today) {
                    return { ...freela, status: 'atrasada' };
                } else if (freela.status === 'atrasada') {
                    return { ...freela, status: 'pendente' };
                }
            }
            return freela;
        });

        if (JSON.stringify(updatedFreelas) !== JSON.stringify(freelas)) {
            setFreelas(updatedFreelas);
        }
    }, [freelas, setFreelas]);

    useEffect(() => {
        updateFreelasStatus();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate]);
    
    // Auto Cloud Backup with Debounce
    useEffect(() => {
        if (isLoggedIn && isCloudAutoBackupEnabled) {
             if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
            debounceTimeoutRef.current = setTimeout(async () => {
                console.log("Auto-saving to cloud...");
                try {
                    await uploadBackup(freelas);
                     // Optionally show a subtle toast
                     // showToast("Progresso salvo na nuvem.", "success");
                } catch (error) {
                    console.error("Auto cloud backup failed:", error);
                    showToast("Falha no backup automático.", "error");
                }
            }, 2000); // 2-second debounce
        }
        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [freelas, isLoggedIn, isCloudAutoBackupEnabled, showToast]);

    // On connecting to Google, reconcile local data with whatever is in the cloud:
    // whichever has more freelas (or, if tied, is more recently updated) wins, and
    // the result is saved back to Drive so both sides stay in sync.
    useEffect(() => {
        if (!isLoggedIn) {
            hasReconciledCloudRef.current = false;
            return;
        }
        if (hasReconciledCloudRef.current) return;
        hasReconciledCloudRef.current = true;

        (async () => {
            try {
                const cloudBackup = await getCloudBackup();

                if (!cloudBackup) {
                    if (freelas.length > 0) {
                        await uploadBackup(freelas);
                        showToast('Backup inicial salvo no Google Drive.', 'success');
                    }
                    return;
                }

                const localLatest = freelas.reduce((max, f) => {
                    const t = f.updated_at || f.created_at || '';
                    return t > max ? t : max;
                }, '');

                const cloudIsWinner =
                    cloudBackup.data.length > freelas.length ||
                    (cloudBackup.data.length === freelas.length && cloudBackup.timestamp > localLatest);

                if (cloudIsWinner) {
                    setFreelas(cloudBackup.data);
                    showToast('Dados mais recentes do Google Drive foram restaurados.', 'success');
                } else if (freelas.length > 0) {
                    await uploadBackup(freelas);
                    showToast('Seus dados locais (mais recentes) foram salvos no Google Drive.', 'success');
                }
            } catch (error) {
                console.error('Cloud reconciliation failed:', error);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoggedIn]);

    const handleSaveFreela = (freela: Freela) => {
        const index = freelas.findIndex(f => f.id === freela.id);
        if (index > -1) {
            const updatedFreelas = [...freelas];
            updatedFreelas[index] = freela;
            setFreelas(updatedFreelas);
            showToast('Freela atualizado com sucesso!');
        } else {
            setFreelas([...freelas, freela]);
            showToast('Freela adicionado com sucesso!');
        }
        setActiveModal(null);
    };

    // Salva várias ocorrências de uma vez (recorrência semanal do formulário)
    const handleSaveMany = (novos: Freela[]) => {
        setFreelas([...freelas, ...novos]);
        showToast(`${novos.length} freelas adicionados!`);
        setActiveModal(null);
    };

    // Atualização pontual (ex: data de pagamento) sem fechar o modal de detalhes
    const handleUpdateFreela = (updated: Freela) => {
        setFreelas(freelas.map(f => (f.id === updated.id ? updated : f)));
        setSelectedFreela(updated);
        showToast('Freela atualizado!');
    };

    // Duplicar: abre o formulário pré-preenchido como um NOVO freela
    const handleDuplicateFreela = (freela: Freela) => {
        setSelectedFreela({
            ...freela,
            id: '',
            status: 'pendente',
            data_pagamento: null,
            google_calendar_event_id: null,
            conflictWith: undefined,
        });
        setSelectedDate(null);
        setActiveModal('freelaForm');
    };

    const handleConflict = (conflicting: Freela, pending: Partial<Freela>) => {
        setConflictState({ conflicting, pending });
    };

    const handleConfirmConflict = () => {
        if (!conflictState) return;
    
        const { conflicting, pending } = conflictState;
        const now = new Date().toISOString();
    
        const newFreela: Freela = {
            id: `freela_${Date.now()}`,
            descricao: pending.descricao || '',
            valor: pending.valor || 0,
            data_evento: pending.data_evento || '',
            horario_inicio: pending.horario_inicio,
            horario_fim: pending.horario_fim,
            data_vencimento: pending.data_vencimento,
            tipo_servico: pending.tipo_servico || TipoServico.Outro,
            categoria: pending.categoria || Categoria.Outro,
            categoria_customizada: pending.categoria === 'outro' ? pending.categoria_customizada : null,
            local: pending.local,
            contratante: pending.contratante,
            observacoes: pending.observacoes,
            status: 'pendente',
            data_pagamento: null,
            declara_mei: pending.declara_mei || false,
            google_calendar_event_id: null,
            created_at: now,
            updated_at: now,
            conflictWith: conflicting.id,
        };
    
        const updatedFreelas = freelas.map(f =>
            f.id === conflicting.id
                ? { ...f, conflictWith: newFreela.id, updated_at: now }
                : f
        );
    
        setFreelas([...updatedFreelas, newFreela]);
        showToast('Freela adicionado com conflito!');
        
        setConflictState(null);
        setActiveModal(null);
    };

    const handleDeleteFreela = useCallback(async (id: string) => {
        const freelaToDelete = freelas.find(f => f.id === id);
        
        if (isLoggedIn && freelaToDelete?.google_calendar_event_id) {
            try {
                const calendarId = localStorage.getItem('freela_calendar_id');
                if (calendarId) {
                    await deleteCalendarEvent(calendarId, freelaToDelete.google_calendar_event_id);
                    showToast('Evento removido da agenda.', 'success');
                }
            } catch (error) {
                console.error('Failed to delete calendar event:', error);
                showToast('Falha ao remover evento da Agenda.', 'error');
            }
        }

        // Unlink any freela that was conflicting with the one being deleted
        const updatedFreelas = freelas.map(f => 
            f.conflictWith === id ? { ...f, conflictWith: undefined } : f
        ).filter(f => f.id !== id);


        setFreelas(updatedFreelas);
        showToast('Freela excluído com sucesso!');
        setActiveModal(null);
    }, [freelas, setFreelas, showToast, isLoggedIn]);


    const handleTogglePayment = (freela: Freela) => {
        const newStatus = freela.status === 'pago' ? 'pendente' : 'pago';
        const updatedFreela = {
            ...freela,
            status: newStatus,
            data_pagamento: newStatus === 'pago' ? new Date().toISOString().split('T')[0] : null,
        };
        handleSaveFreela(updatedFreela);
        setActiveModal(null);
    };
    
    const handleSyncGoogleCalendar = useCallback(async () => {
        if (isSyncing) return;

        if (!isLoggedIn) {
            showToast('Faça login com Google para sincronizar.', 'error');
            signIn();
            return;
        }

        setIsSyncing(true);
        showToast('Sincronizando com Google Agenda...', 'success');
        try {
            const calendarId = await findOrCreateCalendar();
            if (!calendarId) {
                throw new Error('Não foi possível encontrar ou criar a agenda.');
            }
            
            const updatedFreelas = [...freelas];
            let changesMade = 0;

            for (let i = 0; i < updatedFreelas.length; i++) {
                const freela = updatedFreelas[i];
                const eventId = await syncFreelaToCalendar(calendarId, freela);
                if (eventId && eventId !== freela.google_calendar_event_id) {
                    updatedFreelas[i] = { ...freela, google_calendar_event_id: eventId };
                    changesMade++;
                }
            }
            
            if (changesMade > 0) {
                setFreelas(updatedFreelas);
            }

            showToast('Sincronização com a Agenda concluída!', 'success');
        } catch (error) {
            console.error('Google Calendar sync failed:', error);
            showToast('Falha na sincronização com a Agenda.', 'error');
        } finally {
            setIsSyncing(false);
        }
    }, [isLoggedIn, signIn, showToast, freelas, setFreelas, isSyncing]);

    useEffect(() => {
        if (activeModal === 'syncGoogle') {
            setActiveModal(null); // Close the "modal" immediately and trigger the action
            handleSyncGoogleCalendar();
        }
    }, [activeModal, handleSyncGoogleCalendar]);

    useEffect(() => {
        if (!showSplash && !privacyPolicyAccepted) {
            setShowPrivacyPolicy(true);
        }
    }, [showSplash, privacyPolicyAccepted]);

    const handleAcceptPrivacyPolicy = () => {
        setPrivacyPolicyAccepted(true);
        setShowPrivacyPolicy(false);
    };

    if (showSplash) {
        return <SplashScreen onStart={() => setShowSplash(false)} />;
    }

    const modals = (
      <>
        {activeModal === 'freelaForm' && (
            <FreelaFormModal
                isOpen={true}
                onClose={() => setActiveModal(null)}
                onSave={handleSaveFreela}
                onSaveMany={handleSaveMany}
                onConflict={handleConflict}
                allFreelas={freelas}
                freelaToEdit={selectedFreela}
                selectedDate={selectedDate}
            />
        )}

        {activeModal === 'dayFreelas' && selectedDate && (
            <DayFreelasModal
                isOpen={true}
                onClose={() => setActiveModal(null)}
                date={selectedDate}
                freelas={freelas.filter(f => f.data_evento === selectedDate)}
                allFreelas={freelas}
                onNewFreela={() => {
                    setSelectedFreela(null);
                    setActiveModal('freelaForm');
                }}
                onFreelaClick={(freela) => {
                    setSelectedFreela(freela);
                    setActiveModal('freelaDetails');
                }}
            />
        )}

        {activeModal === 'freelaDetails' && selectedFreela && (
            <FreelaDetailsModal
                isOpen={true}
                onClose={() => setActiveModal(null)}
                freela={selectedFreela}
                onEdit={(freela) => {
                    setSelectedFreela(freela);
                    setActiveModal('freelaForm');
                }}
                onDelete={handleDeleteFreela}
                onTogglePayment={handleTogglePayment}
                onDuplicate={handleDuplicateFreela}
                onUpdate={handleUpdateFreela}
            />
        )}
        
        {activeModal === 'backup' && (
            <BackupModal 
                isOpen={true}
                onClose={() => setActiveModal(null)}
                freelas={freelas}
                setFreelas={setFreelas}
                showToast={showToast}
                isLoggedIn={isLoggedIn}
                user={user}
                onLoginClick={signIn}
                isAutoBackupEnabled={isCloudAutoBackupEnabled}
                onToggleAutoBackup={setCloudAutoBackupEnabled}
            />
        )}
        
        {activeModal === 'dashboard' && (
            <Suspense fallback={
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                </div>
            }>
                <DashboardModal
                    isOpen={true}
                    onClose={() => setActiveModal(null)}
                    allFreelas={freelas}
                />
            </Suspense>
        )}

        {activeModal === 'meiConfig' && (
            <MeiConfigModal
                isOpen={true}
                onClose={() => setActiveModal(null)}
                limiteAnual={meiLimiteAnual}
                onSave={(novo) => {
                    setMeiLimiteAnual(novo);
                    showToast('Limite MEI atualizado!');
                    setActiveModal(null);
                }}
            />
        )}
        
        {activeModal === 'report' && (
             <ReportModal
                isOpen={true}
                onClose={() => setActiveModal(null)}
                freelas={freelas}
                currentDate={currentDate}
             />
        )}
        
        {conflictState && (
            <ConflictModal
                isOpen={true}
                onClose={() => setConflictState(null)}
                onConfirm={handleConfirmConflict}
                conflictingFreela={conflictState.conflicting}
            />
        )}

        {(meiStatus === 'warning' || meiStatus === 'danger') && (
            <MeiPopup 
                status={meiStatus} 
                meiInfo={meiInfo} 
                onClose={() => setMeiStatus('ok')} 
            />
        )}

        {toast && <Toast message={toast.message} type={toast.type} />}

        <PrivacyPolicyModal
            isOpen={showPrivacyPolicy}
            mode="gate"
            onAccept={handleAcceptPrivacyPolicy}
        />

        {activeModal === 'about' && (
            <AboutModal
                isOpen={true}
                onClose={() => setActiveModal(null)}
            />
        )}

        {activeModal === 'policies' && (
            <PrivacyPolicyModal
                isOpen={true}
                mode="viewer"
                onClose={() => setActiveModal(null)}
            />
        )}
      </>
    );

    return (
        <div className="font-sans p-0 sm:p-4 h-screen w-screen flex items-center justify-center">
            <div id="app" className="max-w-md mx-auto bg-white relative rounded-none sm:rounded-2xl shadow-2xl sm:border-4 sm:border-white/30 backdrop-blur-sm overflow-hidden h-full w-full sm:h-auto sm:aspect-[9/16] sm:max-h-[95vh] flex flex-col pt-[env(safe-area-inset-top)]">
                <Header
                    currentDate={currentDate}
                    onPrevMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                    onNextMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                    onGoToday={() => setCurrentDate(new Date())}
                    onOpenReport={() => setActiveModal('report')}
                    theme={theme}
                    onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    user={user}
                    isLoggedIn={isLoggedIn}
                    onLoginClick={signIn}
                    onLogoutClick={signOut}
                />
                <main className="flex-1 overflow-y-auto pb-32" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                    {showTodayBanner && (
                        <div className="mx-4 mt-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg p-3 flex items-start gap-3">
                            <span className="text-2xl">📣</span>
                            <div className="flex-1 min-w-0 text-sm">
                                {todayInfo.todayFreelas.length > 0 && (
                                    <p className="font-semibold truncate">
                                        Hoje: {todayInfo.todayFreelas[0].descricao}
                                        {todayInfo.todayFreelas[0].horario_inicio ? ` às ${todayInfo.todayFreelas[0].horario_inicio}` : ''}
                                        {todayInfo.todayFreelas.length > 1 ? ` +${todayInfo.todayFreelas.length - 1}` : ''}
                                    </p>
                                )}
                                {todayInfo.overdueCount > 0 && (
                                    <p className="opacity-90">
                                        ⚠️ {todayInfo.overdueCount} pagamento{todayInfo.overdueCount > 1 ? 's' : ''} atrasado{todayInfo.overdueCount > 1 ? 's' : ''}: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(todayInfo.overdueTotal)}
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setBannerDismissedOn(todayInfo.today)}
                                className="p-1 hover:bg-white/20 rounded-full flex-shrink-0"
                                aria-label="Dispensar aviso"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                            </button>
                        </div>
                    )}
                    <div className="p-4 bg-white">
                        <Calendar
                            currentDate={currentDate}
                            freelas={freelas}
                            onDayClick={(date) => {
                                setSelectedDate(date);
                                setSelectedFreela(null);
                                const hasFreelas = freelas.some(f => f.data_evento === date);
                                setActiveModal(hasFreelas ? 'dayFreelas' : 'freelaForm');
                            }}
                        />
                    </div>
                    <div className="px-4 mt-4">
                        <FreelaList 
                            currentDate={currentDate}
                            freelas={freelas}
                            onFreelaClick={(freela) => {
                                setSelectedFreela(freela);
                                setActiveModal('freelaDetails');
                            }}
                        />
                    </div>
                </main>
                <Footer
                    currentDate={currentDate}
                    freelas={freelas}
                    limiteAnual={meiLimiteAnual}
                    onOpenMeiConfig={() => setActiveModal('meiConfig')}
                    setMeiStatus={setMeiStatus}
                    setMeiInfo={setMeiInfo}
                    meiPopupShown={meiPopupShown}
                    setMeiPopupShown={setMeiPopupShown}
                />
                <FAB onMenuClick={(action) => {
                    if (action === 'feedback') {
                        const texto = encodeURIComponent('Olá! Tenho um feedback sobre o app Controle de Freelas: ');
                        window.open(`https://wa.me/5511995700408?text=${texto}`, '_blank', 'noopener');
                        return;
                    }
                    setActiveModal(action);
                }} />
                
                {modalRoot && ReactDOM.createPortal(modals, modalRoot)}
            </div>
        </div>
    );
};

export default App;