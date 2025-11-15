
import React, { useEffect, useState } from 'react';

interface MeiPopupProps {
    status: 'warning' | 'danger';
    meiInfo: { total: number; limit: number };
    onClose: () => void;
}

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const MeiPopup: React.FC<MeiPopupProps> = ({ status, meiInfo, onClose }) => {
    const [show, setShow] = useState(false);
    
    useEffect(() => {
        setShow(true);
    }, []);

    const handleClose = () => {
        setShow(false);
        setTimeout(onClose, 300);
    }
    
    const isWarning = status === 'warning';
    const headerClass = isWarning ? 'bg-gradient-to-r from-yellow-400 to-orange-400' : 'bg-gradient-to-r from-red-500 to-pink-500';
    const buttonClass = isWarning ? 'bg-yellow-400 hover:bg-yellow-500 text-gray-800' : 'bg-red-500 hover:bg-red-600 text-white';
    
    const title = isWarning ? 'Atenção: Limite MEI Próximo!' : 'Limite MEI Ultrapassado!';
    const icon = isWarning ? '⚠️' : '🚨';
    const message = isWarning 
        ? `Você atingiu 80% do limite mensal MEI de ${formatCurrency(meiInfo.limit)}. Fique atento aos próximos freelas.`
        : `Você ultrapassou o limite mensal de ${formatCurrency(meiInfo.limit)} para MEI. Considere não declarar os próximos freelas como MEI este mês.`;

    const remaining = meiInfo.limit - meiInfo.total;
    const excess = meiInfo.total - meiInfo.limit;

    return (
        <>
            <div className={`fixed inset-0 bg-black/50 z-[1001] transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose}></div>
            <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[1002] w-full max-w-sm transition-all duration-300 ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                <div className={`p-5 rounded-t-2xl text-center text-white ${headerClass}`}>
                    <div className="text-5xl mb-2">{icon}</div>
                    <h3 className="text-xl font-bold">{title}</h3>
                </div>
                <div className="p-6 text-center">
                    <p className="text-sm text-gray-600 mb-5 leading-relaxed">{message}</p>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                        <div className="flex justify-between font-medium">
                            <span className="text-gray-500">Declarado MEI:</span>
                            <span className={isWarning ? 'text-yellow-600' : 'text-red-600'}>{formatCurrency(meiInfo.total)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Limite Mensal:</span>
                            <span>{formatCurrency(meiInfo.limit)}</span>
                        </div>
                        <div className="flex justify-between font-bold pt-2 border-t mt-2">
                             {isWarning ? (
                                <>
                                 <span className="text-gray-500">Disponível:</span>
                                 <span className="text-green-600">{formatCurrency(remaining)}</span>
                                </>
                            ) : (
                                <>
                                 <span className="text-gray-500">Excedente:</span>
                                 <span className="text-red-600">{formatCurrency(excess)}</span>
                                </>
                            )}
                        </div>
                    </div>
                    <button onClick={handleClose} className={`w-full mt-5 py-2.5 rounded-lg font-semibold transition-colors ${buttonClass}`}>
                        Entendi
                    </button>
                </div>
            </div>
        </>
    );
};

export default MeiPopup;
