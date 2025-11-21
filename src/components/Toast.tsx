
import React, { useState, useEffect } from 'react';

interface ToastProps {
    message: string;
    type: 'success' | 'error';
}

const Toast: React.FC<ToastProps> = ({ message, type }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setVisible(true);
        const timer = setTimeout(() => {
            setVisible(false);
        }, 2700);
        return () => clearTimeout(timer);
    }, [message, type]);

    const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';

    return (
        <div 
            className={`absolute bottom-56 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-white shadow-lg z-[1001] transition-transform duration-300 ${bgColor} ${visible ? 'translate-y-0' : 'translate-y-20 opacity-0'}`}
        >
            {message}
        </div>
    );
};

export default Toast;
