import React from 'react';
import { Freela } from '../types';
import { getHoliday } from '../services/dateService';

interface CalendarProps {
    currentDate: Date;
    freelas: Freela[];
    onDayClick: (date: string) => void;
}

const CategoriaIcons: Record<string, string> = {
    'som': '🔊', 'iluminacao': '💡', 'video': '📹', 'producao': '🎬', 
    'performance': '🎭', 'bombeiro_civil': '⛑️', 'seguranca_patrimonial': '🛡️',
    'fotografia': '📸', 'videomaker': '🎥', 'edicao_audiovisual': '✂️',
    'mixagem_masterizacao': '🎚️', 'outro': '⚙️'
};

const Calendar: React.FC<CalendarProps> = ({ currentDate, freelas, onDayClick }) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const freelasByDate: { [key: string]: Freela[] } = freelas.reduce((acc, freela) => {
        (acc[freela.data_evento] = acc[freela.data_evento] || []).push(freela);
        return acc;
    }, {} as { [key: string]: Freela[] });

    const getDateStatus = (dateString: string) => {
        const dailyFreelas = freelasByDate[dateString];
        if (!dailyFreelas || dailyFreelas.length === 0) return '';
        if (dailyFreelas.some(f => f.status === 'atrasada')) return 'bg-red-500 text-white';
        if (dailyFreelas.some(f => f.status === 'pendente')) return 'bg-yellow-400 text-gray-800';
        return 'bg-green-500 text-white';
    };

    const calendarCells = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
        calendarCells.push(<div key={`empty-start-${i}`} className="aspect-square"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const holiday = getHoliday(dateString);
        const isCurrentDay = date.getTime() === today.getTime();
        const statusClass = getDateStatus(dateString);
        const dailyFreelas = freelasByDate[dateString] || [];

        let cellClasses = `aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all duration-200 font-semibold relative p-1 text-xs sm:text-base`;
        if (statusClass) {
            cellClasses += ` ${statusClass}`;
        } else {
            cellClasses += ` bg-gray-100 hover:bg-gray-200 text-gray-700`;
        }

        if (isCurrentDay) {
            cellClasses += ` ring-2 ring-offset-2 ring-blue-500`;
        }
        
        calendarCells.push(
            <div 
                key={day} 
                className={cellClasses} 
                onClick={() => onDayClick(dateString)}
                data-holiday-name={holiday?.name}
            >
                {holiday && (
                    <span 
                        className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${holiday.type === 'nacional' ? 'bg-orange-500' : 'bg-blue-500'}`}
                    >!</span>
                )}
                <span>{day}</span>
                {dailyFreelas.length > 0 && (
                    <div className="absolute bottom-1 left-0 right-0 flex flex-wrap gap-px justify-center items-center max-h-4 overflow-hidden">
                        {dailyFreelas.slice(0, 4).map(f => (
                             <span key={f.id} className="text-[8px] leading-none opacity-90" title={f.descricao}>
                                {CategoriaIcons[f.categoria] || CategoriaIcons['outro']}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const totalCells = startingDayOfWeek + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
        calendarCells.push(<div key={`empty-end-${i}`} className="aspect-square"></div>);
    }

    return (
        <div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs sm:text-sm font-medium text-gray-600 mb-2">
                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {calendarCells}
            </div>
        </div>
    );
};

export default Calendar;