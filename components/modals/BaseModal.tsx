import React from 'react';

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title: string;
    titleIcon?: string;
    headerGradient?: string;
    maxWidth?: string;
    applyPhoneAspectRatio?: boolean;
}

const BaseModal: React.FC<BaseModalProps> = ({ 
    isOpen, 
    onClose, 
    children, 
    title, 
    titleIcon, 
    headerGradient = 'from-blue-600 to-purple-600', 
    maxWidth = 'sm:max-w-[450px]',
    applyPhoneAspectRatio = true
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity duration-300" onClick={onClose}>
            <div 
                className={`modal-content bg-white rounded-2xl w-full shadow-2xl flex flex-col max-h-[90vh] transition-transform duration-300 transform scale-95 animate-modal-in ${applyPhoneAspectRatio ? 'sm:aspect-[9/16]' : ''} ${maxWidth}`}
                onClick={(e) => e.stopPropagation()}
            >
                <header className={`bg-gradient-to-r ${headerGradient} text-white p-4 flex items-center justify-between rounded-t-2xl flex-shrink-0`}>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        {titleIcon && <span className="text-xl">{titleIcon}</span>}
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-white hover:bg-white/20 p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-white/50">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    </button>
                </header>
                <div className="overflow-y-auto">
                    {children}
                </div>
            </div>
            <style>{`
                @keyframes modal-in {
                    from { opacity: 0; transform: scale(0.95) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .animate-modal-in {
                    animation: modal-in 0.3s ease-out forwards;
                }
            `}</style>
        </div>
    );
};

export default BaseModal;