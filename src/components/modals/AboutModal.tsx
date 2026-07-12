import React from 'react';
import BaseModal from './BaseModal';

interface AboutModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
    const year = new Date().getFullYear();

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Sobre o Aplicativo" titleIcon="ℹ️" applyPhoneAspectRatio={false}>
            <div className="p-6 text-center">
                <div className="text-5xl mb-3">🎭</div>
                <h2 className="text-xl font-bold text-gray-900">Controle de Freelas</h2>
                <p className="text-sm text-gray-500 mt-1">Versão {__APP_VERSION__}</p>

                <p className="text-sm text-gray-700 mt-4">
                    Aplicativo de organização de agenda e finanças para freelancers, com sincronização
                    opcional com Google Agenda e Google Drive.
                </p>

                <div className="border-t border-gray-100 mt-6 pt-4 text-xs text-gray-500 space-y-1">
                    <p>© {year} Pulo do Gato EAD. Todos os direitos reservados.</p>
                    <p>contato@pulodogatoead.com.br</p>
                    <p>
                        <a href="https://pulodogatoead.com.br" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            pulodogatoead.com.br
                        </a>
                    </p>
                </div>
            </div>
        </BaseModal>
    );
};

export default AboutModal;
