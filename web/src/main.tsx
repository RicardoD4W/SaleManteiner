import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { App } from './App';
import { AppToaster } from './components/ui/AppToaster';
import './index.css';
// CSS propio de sileo (variables y animaciones de los toasts). Va después
// del CSS de la app para que sus reglas ganen.
import 'sileo/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <AppToaster />
    </QueryClientProvider>
  </StrictMode>,
);
