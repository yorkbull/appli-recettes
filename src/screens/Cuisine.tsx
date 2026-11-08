import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { ajusterLigne, minuteurs } from '../lib/quantites';
import { Feuille, Icone } from '../ui';

type Minuteur = { cle: string; fin: number; total: number; libelle: string };

// Mode cuisine : une étape à la fois, en grand, écran toujours allumé, minuteurs à toucher
export default function Cuisine({ id }: { id: string }) {
  const { parId } = useStore();
  const r = parId[id];
  const portions = Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('portions')) || r?.portions || 1;
  const [i, setI] = useState(0);
  const [ingr, setIngr] = useState(false);
  const [mins, setMins] = useState<Minuteur[]>([]);
  const [, tic] = useState(0);
  const lock = useRef<WakeLockSentinel | null>(null);
  const sonnes = useRef(new Set<string>());

  // Écran allumé, repris quand on revient dans l'appli
  useEffect(() => {
    const prendre = async () => { try { lock.current = await navigator.wakeLock?.request('screen') ?? null; } catch { /* refusé : sans effet */ } };
    prendre();
    const vis = () => document.visibilityState === 'visible' && prendre();
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); lock.current?.release().catch(() => {}); };
  }, []);

  useEffect(() => {
    if (!mins.length) return;
    const t = setInterval(() => {
      tic(x => x + 1);
      for (const m of mins) if (Date.now() >= m.fin && !sonnes.current.has(m.cle)) { sonnes.current.add(m.cle); alerte(); }
    }, 500);
    return () => clearInterval(t);
  }, [mins]);

  if (!r) return <div className="page"><p>Recette introuvable.</p><a href="#/recettes">Mes recettes</a></div>;
  const n = r.etapes.length;
  const etape = r.etapes[i] ?? '';
  const quitter = () => (history.length > 1 ? history.back() : (location.hash = `/recette/${r.id}`));

  const lancer = (cle: string, secondes: number, libelle: string) => {
    setMins(ms => ms.some(m => m.cle === cle) ? ms.filter(m => m.cle !== cle) : [...ms, { cle, fin: Date.now() + secondes * 1000, total: secondes, libelle }]);
    sonnes.current.delete(cle);
  };
  const reste = (m: Minuteur) => { const s = Math.max(0, Math.round((m.fin - Date.now()) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  return (
    <div className="cuisine">
      <div className="cuisine-tete">
        <button className="icone" aria-label="Quitter le mode cuisine" onClick={quitter}>{Icone.fermer}</button>
        <b style={{ flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titre}</b>
        <button className="lien" onClick={() => setIngr(true)}>Ingrédients</button>
      </div>
      <div className="progression" aria-hidden><i style={{ width: `${n ? ((i + 1) / n) * 100 : 0}%` }} /></div>
      {mins.length > 0 && (
        <div>{mins.map(m => <button key={m.cle} className={'minuteur ' + (Date.now() >= m.fin ? 'fini' : 'encours')} onClick={() => setMins(ms => ms.filter(x => x.cle !== m.cle))}
          aria-label={`Minuteur ${m.libelle}, toucher pour arrêter`}>⏱ {Date.now() >= m.fin ? 'Terminé !' : reste(m)} · {m.libelle}</button>)}</div>
      )}
      <div className="cuisine-etape" aria-live="polite">
        {n ? <>
          <div className="num">Étape {i + 1} sur {n}</div>
          <p>{etape}</p>
          <div>{minuteurs(etape).map((t, k) => {
            const cle = `${i}-${k}`; const actif = mins.some(m => m.cle === cle);
            return <button key={cle} className={'minuteur' + (actif ? ' encours' : '')} onClick={() => lancer(cle, t.secondes, t.texte)}>⏱ {actif ? 'Arrêter' : 'Lancer'} {t.texte}</button>;
          })}</div>
        </> : <p>Cette recette n’a pas encore d’étapes.</p>}
      </div>
      <div className="cuisine-nav">
        <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>Précédente</button>
        {i < n - 1 ? <button className="btn principal" onClick={() => setI(i + 1)}>Suivante</button> : <button className="btn principal" onClick={quitter}>Terminé</button>}
      </div>
      {ingr && (
        <Feuille titre={`Ingrédients · ${portions} portions`} onFermer={() => setIngr(false)}>
          <ul className="ingredients">{r.ingredients.map((l, k) => <li key={k}>{ajusterLigne(l, portions / (r.portions || 1))}</li>)}</ul>
        </Feuille>
      )}
    </div>
  );
}

function alerte() {
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach(t => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = 880; g.gain.value = 0.2; o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2); });
  } catch { /* pas de son disponible */ }
}
