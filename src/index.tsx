
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Aplica o tema salvo antes do primeiro render para evitar "flash" claro.
try {
  if (JSON.parse(localStorage.getItem('controle_freelas_theme') || '"light"') === 'dark') {
    document.documentElement.classList.add('dark');
  }
} catch { /* tema padrão claro */ }

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);