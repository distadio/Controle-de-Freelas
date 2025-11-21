
import React, { useState } from 'react';
import { GoogleUser } from '../types';

interface HeaderProps {
    currentDate: Date;
    onPrevMonth: () => void;
    onNextMonth: () => void;
    onOpenReport: () => void;
    user: GoogleUser | null;
    isLoggedIn: boolean;
    onLoginClick: () => void;
    onLogoutClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentDate, onPrevMonth, onNextMonth, onOpenReport, user, isLoggedIn, onLoginClick, onLogoutClick }) => {
    const [showLogout, setShowLogout] = useState(false);
    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long' });
    const year = currentDate.getFullYear();
    const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const handleProfileClick = () => {
        if (isLoggedIn) {
            setShowLogout(!showLogout);
        } else {
            onLoginClick();
        }
    }

    return (
        <header className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 text-white p-4 flex items-center justify-between relative overflow-hidden shadow-md">
             <div className="absolute inset-0 bg-black/10"></div>
             <div className="absolute top-0 left-0 w-full h-full">
                 <div className="absolute top-2 left-4 w-2 h-2 bg-white/20 rounded-full animate-pulse"></div>
                 <div className="absolute top-6 right-8 w-1 h-1 bg-white/30 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
                 <div className="absolute bottom-3 left-12 w-1.5 h-1.5 bg-white/25 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
            </div>
            <button onClick={onPrevMonth} className="relative z-10 p-2 hover:bg-white/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            </button>
            <div className="flex-1 text-center">
                 <h1 className="relative z-10 text-xl font-bold text-center">
                    {formattedMonth} {year}
                </h1>
            </div>
             <div className="flex items-center gap-2 relative z-10">
                <button onClick={onOpenReport} className="p-2 hover:bg-white/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50" title="Relatório do Mês">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v6.167a1.5 1.5 0 01-3 0V10.333a1.5 1.5 0 013 0zM10 3.5a1.5 1.5 0 013 0v13a1.5 1.5 0 01-3 0v-13zM14 8.5a1.5 1.5 0 013 0v8a1.5 1.5 0 01-3 0v-8z" />
                    </svg>
                </button>
                 <div className="relative">
                    <button onClick={handleProfileClick} onBlur={() => setTimeout(() => setShowLogout(false), 200)} className="p-1 hover:bg-white/20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50" title={isLoggedIn ? user?.name : 'Login com Google'}>
                       {isLoggedIn && user ? (
                           <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full" />
                       ) : (
                           <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                           </div>
                       )}
                    </button>
                    {isLoggedIn && showLogout && (
                         <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20">
                            <div className="px-4 py-2 text-sm text-gray-700 border-b">
                                <p className="font-semibold truncate">{user?.name}</p>
                                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                            </div>
                            <a href="#" onClick={(e) => { e.preventDefault(); onLogoutClick(); setShowLogout(false); }} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                Sair
                            </a>
                        </div>
                    )}
                </div>
            </div>
            <button onClick={onNextMonth} className="relative z-10 p-2 hover:bg-white/20 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/50">
                <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </button>
        </header>
    );
};

export default Header;