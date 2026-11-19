import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.DEV) {
      navigator.serviceWorker.register('/offline-sw.js').catch(() => {});
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
