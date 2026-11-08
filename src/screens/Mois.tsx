import { useState } from 'react';
import { useStore } from '../store';
import { MOMENTS, MOMENT_LABEL } from '../types';
import { aujourdhui, dateLongue, depuisIso, iso, lundi, nomMois } from '../lib/dates';
import { Icone } from '../ui';

export default function Mois() {
  const { planning, parId } = useStore();
  const auj = aujourdhui();
  const [ref, setRef] = useState(() => { const d = depuisIso(auj); return { a: d.getFullYear(), m: d.getMonth() }; });
  const [choisi, setChoisi] = useState<string>(auj);
  const premier = new Date(ref.a, ref.m, 1);
  const decalage = (premier.getDay() + 6) % 7;
  const nbJours = new Date(ref.a, ref.m + 1, 0).getDate();
  const cases = [...Array(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => iso(new Date(ref.a, ref.m, i + 1)))];
  const changer = (n: number) => setRef(({ a, m }) => { const d = new Date(a, m + n, 1); return { a: d.getFullYear(), m: d.getMonth() }; });
  const total = cases.filter(Boolean).reduce((n, d) => n + Object.keys(planning[d!] ?? {}).length, 0);

  const libelle = (d: string, m: (typeof MOMENTS)[number]) => {
    const c = planning[d]?.[m];
    if (!c) return null;
    if (c.type === 'dehors') return 'Repas dehors';
    if (c.type === 'note') return c.texte;
    const r = parId[c.recetteId];
    return r ? (c.type === 'restes' ? 'Restes : ' : '') + r.titre : 'Recette supprimée';
  };

  return (
    <div className="page">
      <div className="nav-semaine">
        <button className="icone" aria-label="Mois précédent" onClick={() => changer(-1)}>{Icone.retour}</button>
        <div className="titre"><h1 style={{ textTransform: 'capitalize' }}>{nomMois(ref.m)} {ref.a}</h1><small>{total} repas prévu{total > 1 ? 's' : ''}</small></div>
        <button className="icone" aria-label="Mois suivant" onClick={() => changer(1)}>{Icone.avant}</button>
      </div>
      <div className="grille-mois">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j, i) => <div key={i} className="entete" aria-hidden>{j}</div>)}
        {cases.map((d, i) => d ? (
          <button key={d} className={'jour-mois' + (d === auj ? ' auj' : '') + (d === choisi ? ' choisi' : '')} onClick={() => setChoisi(d)}
            aria-label={`${dateLongue(d)}, ${Object.keys(planning[d] ?? {}).length} repas`} aria-pressed={d === choisi}>
            <span>{depuisIso(d).getDate()}</span>
            <span className="points">{MOMENTS.map(m => <i key={m} className={planning[d]?.[m] ? 'plein' : ''} />)}</span>
          </button>
        ) : <div key={'v' + i} className="jour-mois hors" />)}
      </div>
      {choisi && depuisIso(choisi).getMonth() === ref.m && (
        <div className="detail-jour">
          <h2>{dateLongue(choisi).replace(/^./, c => c.toUpperCase())}</h2>
          {MOMENTS.map(m => <p key={m}><span className="doux petit" style={{ display: 'inline-block', width: 56 }}>{MOMENT_LABEL[m]}</span>{libelle(choisi, m) ?? <span className="doux">—</span>}</p>)}
          <button className="lien" onClick={() => { sessionStorage.setItem('semaine', lundi(choisi)); location.hash = '/semaine'; }}>Voir et modifier cette semaine</button>
        </div>
      )}
    </div>
  );
}
