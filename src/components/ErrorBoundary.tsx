import React from 'react';

interface State {
    hasError: boolean;
}

// Evita a "tela branca" em erros inesperados do React: mostra uma tela
// amigável com opção de recarregar. Os dados ficam intactos no localStorage.
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('Erro inesperado capturado pelo ErrorBoundary:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-purple-600 to-pink-600 text-white">
                    <div className="text-6xl mb-4">🎭</div>
                    <h1 className="text-2xl font-bold mb-2">Ops! Algo deu errado.</h1>
                    <p className="mb-6 max-w-sm opacity-90">
                        Não se preocupe: seus freelas estão salvos no aparelho.
                        Toque no botão abaixo para recarregar o aplicativo.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-white text-purple-700 font-bold py-3 px-8 rounded-xl shadow-lg hover:scale-105 transition-transform"
                    >
                        Recarregar
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
