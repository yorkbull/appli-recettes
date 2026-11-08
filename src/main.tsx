import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { StoreProvider } from './store';
import { demanderPersistance } from './db';

// Lien partagé depuis une autre appli Android (bouton « Partager ») : ouvre l'ajout de recette pré-rempli
const p = new URLSearchParams(location.search);
if (p.has('lien') || p.has('texte') || p.has('titre')) {
  const lien = p.get('lien') || (p.get('texte') ?? '').match(/https?:\/\/\S+/)?.[0] || '';
  sessionStorage.setItem('partage', JSON.stringify({ lien, texte: p.get('texte') ?? '', titre: p.get('titre') ?? '' }));
  history.replaceState(null, '', location.pathname + '#/editer/nouvelle');
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
// Appli installée : on demande à Android de garder les données
if (matchMedia('(display-mode: standalone)').matches) demanderPersistance().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
