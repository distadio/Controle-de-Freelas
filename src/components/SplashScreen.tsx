
import React from 'react';

interface SplashScreenProps {
    onStart: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onStart }) => {
    return (
        <div 
            className="fixed inset-0 flex flex-col items-center justify-center z-50 cursor-pointer"
            style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)',
                backgroundSize: '400% 400%',
                animation: 'gradientShift 15s ease infinite'
            }}
            onClick={onStart}
        >
            <div className="text-[120px] mb-8 animate-bounce-slow drop-shadow-lg">
                🎭
            </div>
            <h1 className="text-5xl font-black text-white mb-5 text-center drop-shadow-2xl tracking-tight">
                Controle de Freelas
            </h1>
            <p className="text-lg text-white/95 mb-16 text-center font-medium drop-shadow-xl leading-relaxed max-w-sm">
                Sua vida de freelancer, agora 100% automatizada<br/>e organizada na nuvem!
            </p>
            <div className="text-base text-white text-center font-semibold animate-pulse-slow drop-shadow-lg mt-10">
                Toque em qualquer lugar para começar
            </div>
            <div className="absolute bottom-8 text-center text-xs text-white/70 font-normal drop-shadow-md">
                este app foi desenvolvido por pulodogatoead
            </div>
        </div>
    );
};

export default SplashScreen;