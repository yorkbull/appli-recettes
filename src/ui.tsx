import { useEffect, useRef, useState, type ReactNode } from 'react';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
export const Icone = {
  plus: <svg viewBox="0 0 24 24" {...P}><path d="M12 5v14M5 12h14" /></svg>,
  reglages: <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  semaine: <svg viewBox="0 0 24 24" {...P}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7" /></svg>,
  mois: <svg viewBox="0 0 24 24" {...P}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>,
  livre: <svg viewBox="0 0 24 24" {...P}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></svg>,
  batch: <svg viewBox="0 0 24 24" {...P}><path d="M4 11h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-6zM2 11h20M9 7c0-2 2-2 2-4M14 7c0-2 2-2 2-4" /></svg>,
  retour: <svg viewBox="0 0 24 24" {...P}><path d="M15 18l-6-6 6-6" /></svg>,
  avant: <svg viewBox="0 0 24 24" {...P}><path d="M9 18l6-6-6-6" /></svg>,
  plusDe: <svg viewBox="0 0 24 24" {...P}><circle cx="5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="19" cy="12" r="1.3" /></svg>,
  loupe: <svg viewBox="0 0 24 24" {...P}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>,
  coeur: <svg viewBox="0 0 24 24" {...P}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>,
  coeurPlein: <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.8"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z" /></svg>,
  fermer: <svg viewBox="0 0 24 24" {...P}><path d="M18 6L6 18M6 6l12 12" /></svg>,
};

export function Feuille({ titre, sousTitre, onFermer, children }: { titre?: string; sousTitre?: string; onFermer: () => void; children: ReactNode }) {
  // la fonction de fermeture peut changer à chaque rendu : on garde la dernière sans relancer l'effet
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && fermer.current();
    window.addEventListener('keydown', k);
    // le bouton retour d'Android ferme la feuille au lieu de quitter l'écran
    history.pushState({ feuille: true }, '');
    const pop = () => fermer.current();
    window.addEventListener('popstate', pop);
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('popstate', pop); if (history.state?.feuille) history.back(); };
  }, []);
  return (
    <div className="voile" onClick={onFermer} role="presentation">
      <div className="feuille" role="dialog" aria-modal="true" aria-label={titre} onClick={e => e.stopPropagation()}>
        <div className="poignee" />
        {titre && <h2>{titre}</h2>}
        {sousTitre && <p className="doux petit" style={{ marginTop: 0 }}>{sousTitre}</p>}
        {children}
      </div>
    </div>
  );
}

// Appui long (500 ms) sans déclencher le toucher simple
export function useAppuiLong(onLong: () => void, onClic: () => void, delai = 500) {
  const t = useRef<number | null>(null);
  const long = useRef(false);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const annuler = () => { if (t.current) clearTimeout(t.current); t.current = null; };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      long.current = false; depart.current = { x: e.clientX, y: e.clientY };
      t.current = window.setTimeout(() => { long.current = true; navigator.vibrate?.(30); onLong(); }, delai);
    },
    onPointerMove: (e: React.PointerEvent) => { if (depart.current && Math.hypot(e.clientX - depart.current.x, e.clientY - depart.current.y) > 10) annuler(); },
    onPointerUp: annuler, onPointerLeave: annuler, onPointerCancel: annuler,
    onClick: () => { if (!long.current) onClic(); long.current = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

let afficherToast: (m: string) => void = () => {};
export const toast = (m: string) => afficherToast(m);
export function Toasts() {
  const [m, setM] = useState<string | null>(null);
  useEffect(() => { let t = 0; afficherToast = x => { setM(x); clearTimeout(t); t = window.setTimeout(() => setM(null), 2600); }; }, []);
  return m ? <div className="toast" role="status">{m}</div> : null;
}

export function Compteur({ valeur, onChange, min = 1, max = 50, libelle }: { valeur: number; onChange: (n: number) => void; min?: number; max?: number; libelle: string }) {
  return (
    <div className="compteur" role="group" aria-label={libelle}>
      <button type="button" aria-label="Moins" onClick={() => onChange(Math.max(min, valeur - 1))} disabled={valeur <= min}>−</button>
      <output aria-live="polite">{valeur}</output>
      <button type="button" aria-label="Plus" onClick={() => onChange(Math.min(max, valeur + 1))} disabled={valeur >= max}>+</button>
    </div>
  );
}
