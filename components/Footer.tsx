
import React, { useEffect, useMemo } from 'react';
import { Freela } from '../types';

interface FooterProps {
    currentDate: Date;
    freelas: Freela[];
    setMeiStatus: React.Dispatch<React.SetStateAction<'ok' | 'warning' | 'danger'>>;
    setMeiInfo: React.Dispatch<React.SetStateAction<{ total: number, limit: number }>>;
    meiPopupShown: Record<string, boolean>;
    setMeiPopupShown: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const Footer: React.FC<FooterProps> = ({ currentDate, freelas, setMeiStatus, setMeiInfo, meiPopupShown, setMeiPopupShown }) => {
    const monthData = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthFreelas = freelas.filter(freela => {
            const freelaDate = new Date(freela.data_evento + 'T00:00:00');
            return freelaDate.getFullYear() === year && freelaDate.getMonth() === month;
        });

        const total = monthFreelas.reduce((sum, f) => sum + f.valor, 0);
        const pending = monthFreelas
            .filter(f => f.status === 'pendente' || f.status === 'atrasada')
            .reduce((sum, f) => sum + f.valor, 0);
        
        const paidCount = monthFreelas.filter(f => f.status === 'pago').length;
        const pendingCount = monthFreelas.length - paidCount;

        const totalMei = monthFreelas
            .filter(f => f.declara_mei)
            .reduce((sum, f) => sum + f.valor, 0);

        return { total, pending, paidCount, pendingCount, totalMei };
    }, [currentDate, freelas]);

    const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    const limiteMei = 6750;
    const percentualMei = (monthData.totalMei / limiteMei) * 100;
    
    let meiColorClass = 'text-green-400';
    if (monthData.totalMei > limiteMei) {
        meiColorClass = 'text-red-400 font-bold';
    } else if (percentualMei >= 80) {
        meiColorClass = 'text-yellow-400 font-bold';
    }
    
    useEffect(() => {
        const currentMonthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
        setMeiInfo({ total: monthData.totalMei, limit: limiteMei });

        if (monthData.totalMei > limiteMei) {
            if (!meiPopupShown[currentMonthKey + '-danger']) {
                setMeiStatus('danger');
                setMeiPopupShown(prev => ({ ...prev, [currentMonthKey + '-danger']: true }));
            }
        } else if (percentualMei >= 80) {
            if (!meiPopupShown[currentMonthKey + '-warning']) {
                setMeiStatus('warning');
                setMeiPopupShown(prev => ({ ...prev, [currentMonthKey + '-warning']: true }));
            }
        } else {
             setMeiStatus('ok');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [monthData.totalMei, percentualMei, currentDate, setMeiStatus, setMeiInfo]);


    return (
        <footer className="bg-gradient-to-r from-gray-900 via-purple-900 to-gray-900 text-white p-4 sm:rounded-b-2xl border-t-2 border-white/10 shadow-lg shrink-0">
            <div className="flex justify-between items-center text-sm mb-2">
                <div>
                    <div className="text-green-400 font-semibold">Total: <span>{formatCurrency(monthData.total)}</span></div>
                    <div className="text-yellow-400 font-semibold">A receber: <span>{formatCurrency(monthData.pending)}</span></div>
                </div>
                <div className="text-right">
                    <div className="text-gray-300">Pagos: <span>{monthData.paidCount}</span></div>
                    <div className="text-gray-300">Pendentes: <span>{monthData.pendingCount}</span></div>
                </div>
            </div>
            <div className="border-t border-white/20 pt-2">
                <div className="text-xs font-semibold text-gray-300">
                    MEI declarado: <span className={meiColorClass}>{formatCurrency(monthData.totalMei)}</span> / <span className="text-blue-300">R$ 6.750,00</span>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
