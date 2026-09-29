import React from 'react';
import { Freela, Bloqueio } from '../types';
import { getHoliday } from '../services/dateService';
import { findBloqueio, findFestival, isMultiDay, rotuloBloqueio, iconeBloqueio } from '../services/bloqueioService';

interface CalendarProps {
    currentDate: Date;
    freelas: Freela[];
    bloqueios: Bloqueio[];
    onDayClick: (date: string) => void;
}

const statusDot: Record<string, string> = {
    pago: 'bg-green-400',
    pendente: 'bg-yellow-300',
    atrasada: 'bg-red-500',
};

const CategoriaIcons: Record<string, string> = {
    'som': '🔊', 'iluminacao': '💡', 'video': '📹', 'producao': '🎬', 
    'performance': '🎭', 'bombeiro_civil': '⛑️', 'seguranca_patrimonial': '🛡️',
    'fotografia': '📸', 'videomaker': '🎥', 'edicao_audiovisual': '✂️',
    'mixagem_masterizacao': '🎚️', 'outro': '⚙️'
};

const Calendar: React.FC<CalendarProps> = ({ currentDate, freelas, bloqueios, onDayClick }) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Freelas de um dia só, agrupados por data (festivais são tratados à parte, pelo período)
    const freelasByDate: { [key: string]: Freela[] } = freelas.reduce((acc, freela) => {
        if (isMultiDay(freela)) return acc;
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
        const bloqueio = findBloqueio(bloqueios, dateString);
        const festival = bloqueio ? undefined : findFestival(freelas, dateString);
        // Festival com freela adicional no mesmo dia = data alterada
        const alterada = !!festival && dailyFreelas.length > 0;

        let cellClasses = `aspect-square flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all duration-200 font-semibold relative p-1 text-xs sm:text-base`;
        let titulo: string | undefined;
        if (bloqueio) {
            cellClasses += ` bg-gray-300 text-gray-500 opacity-60 hover:opacity-80`;
            titulo = `${rotuloBloqueio(bloqueio)} — toque para desbloquear`;
        } else if (festival) {
            cellClasses += alterada
                ? ` bg-gradient-to-br from-violet-600 to-orange-500 text-white ring-2 ring-orange-400`
                : ` bg-violet-600 text-white`;
            titulo = alterada
                ? `${festival.descricao} + ${dailyFreelas.length} freela(s) adicional(is)`
                : festival.descricao;
        } else if (statusClass) {
            cellClasses += ` ${statusClass}`;
        } else {
            cellClasses += ` bg-gray-100 hover:bg-gray-200 text-gray-700`;
        }

        if (isCurrentDay && !alterada) {
            cellClasses += ` ring-2 ring-offset-2 ring-blue-500`;
        }

        const rotulo = bloqueio
            ? `${iconeBloqueio(bloqueio)} ${rotuloBloqueio(bloqueio)}`
            : festival
                ? `${alterada ? `+${dailyFreelas.length} ` : '🎪 '}${festival.descricao}`
                : null;

        calendarCells.push(
            <div
                key={day}
                className={cellClasses}
                onClick={() => onDayClick(dateString)}
                data-holiday-name={holiday?.name}
                title={titulo}
            >
                {holiday && (
                    <span
                        className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${holiday.type === 'nacional' ? 'bg-orange-500' : 'bg-blue-500'}`}
                    >!</span>
                )}
                {festival && (
                    <span className={`absolute top-1 left-1 w-2 h-2 rounded-full border border-white/70 ${statusDot[festival.status] || statusDot.pendente}`} />
                )}
                <span>{day}</span>
                {rotulo ? (
                    <div className="absolute bottom-0.5 left-0.5 right-0.5 text-[7px] sm:text-[9px] leading-none font-bold truncate text-center">
                        {rotulo}
                    </div>
                ) : dailyFreelas.length > 0 && (
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