import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import App from './App';
import './index.css';

const isStandaloneShare = Boolean((window as Window & { __SKYHAWK_STANDALONE__?: boolean }).__SKYHAWK_STANDALONE__) || window.location.protocol === 'file:' || window.location.pathname.toLowerCase().endsWith('skyhawk_arena_share.html');
const AppRouter = isStandaloneShare ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppRouter>
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </AppRouter>
  </React.StrictMode>
);
