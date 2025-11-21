import React, { useState, useRef, useEffect } from 'react';

interface FABProps {
    onMenuClick: (action: 'freelaForm' | 'backup' | 'dashboard' | 'syncGoogle') => void;
}

const menuItems = [
    { id: 'freelaForm', icon: '📝', title: 'Inserir Novo Freela', description: 'Adicione um novo trabalho', action: () => {} },
    { id: 'backup', icon: '💾', title: 'Backup & Restauração', description: 'Gerencie seus backups', action: () => {} },
    { id: 'dashboard', icon: '📊', title: 'Dashboard', description: 'Visualize estatísticas', action: () => {} },
    { id: 'syncGoogle', icon: '🔄', title: 'Sincronizar com Google', description: 'Exporte para Google Agenda', action: () => {} },
];

const FAB: React.FC<FABProps> = ({ onMenuClick }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const toggleMenu = () => setIsOpen(!isOpen);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
                const fabButton = document.getElementById('fab-button');
                if (fabButton && !fabButton.contains(event.target as Node)) {
                   setIsOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);


    return (
        <>
            <div 
                className={`fixed inset-0 bg-black/30 z-30 transition-opacity duration-300 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                onClick={toggleMenu}
            ></div>
            
            <div 
                ref={menuRef} 
                className={`absolute bottom-52 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)] ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-80 invisible'}`}
            >
                 <div className="bg-white rounded-2xl shadow-2xl min-w-[280px]">
                     {menuItems.map((item, index) => (
                         <div
                             key={item.id}
                             onClick={(e) => {
                                 e.stopPropagation(); // <-- A CORREÇÃO DEFINITIVA
                                 onMenuClick(item.id as any);
                                 setIsOpen(false);
                             }}
                             className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-100 transition-colors duration-200 ${index > 0 ? 'border-t border-gray-100' : ''}`}
                         >
                            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-2xl rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 text-white shadow-md">
                                 {item.icon}
                             </div>
                             <div>
                                 <div className="font-semibold text-gray-800">{item.title}</div>
                                 <div className="text-xs text-gray-500">{item.description}</div>
                             </div>
                         </div>
                     ))}
                 </div>
            </div>

            <button
                id="fab-button"
                onClick={toggleMenu}
                className="absolute bottom-32 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full flex items-center justify-center text-white text-3xl font-light cursor-pointer shadow-lg hover:scale-110 transition-transform duration-200 z-50 backdrop-blur-md border-2 border-white/30"
                style={{
                    background: 'linear-gradient(135deg, rgba(102,126,234,0.7) 0%, rgba(118,75,162,0.7) 100%)',
                }}
            >
                <span className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}>+</span>
            </button>
        </>
    );
};

export default FAB;