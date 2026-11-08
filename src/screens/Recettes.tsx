import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { Icone, toast } from '../ui';
import { duree } from '../lib/quantites';
import { EXEMPLES } from '../exemples';

export const normaliser = (s: string) => s.replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Recettes() {
  const { recettes, reglages, enregistrerRecette } = useStore();
  const [q, setQ] = useState(() => sessionStorage.getItem('recherche') ?? '');
  const [filtres, setFiltres] = useState<string[]>([]);
  const basculer = (f: string) => setFiltres(x => x.includes(f) ? x.filter(y => y !== f) : [...x, f]);

  const liste = useMemo(() => {
    const nq = normaliser(q.trim());
    return recettes.filter(r => {
      if (nq && !normaliser([r.titre, ...r.ingredients, ...r.thematiques].join(' ')).includes(nq)) return false;
      for (const f of filtres) {
        if (f === '♥ Favoris' && !r.favori) return false;
        if (f === 'Moins de 20 min' && !((r.preparationMin ?? 0) + (r.cuissonMin ?? 0) > 0 && (r.preparationMin ?? 0) + (r.cuissonMin ?? 0) <= 20)) return false;
        if (reglages.thematiques.includes(f) && !r.thematiques.includes(f)) return false;
      }
      return true;
    }).sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
  }, [recettes, q, filtres, reglages.thematiques]);

  const ajouterExemples = async () => {
    for (const e of EXEMPLES()) await enregistrerRecette(e);
    toast('5 recettes d’exemple ajoutées');
  };

  if (!recettes.length) return (
    <div className="page vide-etat">
      <h1>Mes recettes</h1>
      <p>Votre bibliothèque est vide. Ajoutez une première recette, ou essayez l’appli avec quelques exemples.</p>
      <p><a className="btn principal" href="#/editer/nouvelle">Ajouter une recette</a></p>
      <p><button className="lien" onClick={ajouterExemples}>Ajouter 5 recettes d’exemple</button></p>
    </div>
  );

  return (
    <div className="page">
      <div className="page-tete"><h1>Mes recettes</h1><span className="doux petit">{liste.length} / {recettes.length}</span></div>
      <div className="recherche">{Icone.loupe}<input type="search" placeholder="Nom ou ingrédient" value={q} aria-label="Chercher une recette"
        onChange={e => { setQ(e.target.value); sessionStorage.setItem('recherche', e.target.value); }} /></div>
      <div className="pastilles" role="group" aria-label="Filtres">
        {['♥ Favoris', 'Moins de 20 min', ...reglages.thematiques].map(f => (
          <button key={f} className={'pastille' + (filtres.includes(f) ? ' on' : '')} aria-pressed={filtres.includes(f)} onClick={() => basculer(f)}>{f}</button>
        ))}
      </div>
      <div className="liste">
        {liste.map(r => (
          <a key={r.id} className="ligne-recette" href={`#/recette/${r.id}`}>
            {r.photo ? <img src={r.photo} alt="" loading="lazy" /> : <span className="sans-photo">{r.titre[0]}</span>}
            <span>
              <b>{r.favori ? '♥ ' : ''}{r.titre}</b>
              <span className="meta">{[r.thematiques.join(', '), duree((r.preparationMin ?? 0) + (r.cuissonMin ?? 0))].filter(Boolean).join(' · ')}</span>
            </span>
          </a>
        ))}
        {!liste.length && <p className="doux">Aucune recette ne correspond. <button className="lien" onClick={() => { setQ(''); setFiltres([]); sessionStorage.removeItem('recherche'); }}>Tout afficher</button></p>}
      </div>
    </div>
  );
}
