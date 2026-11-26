import { useMemo, useState } from 'react';
import { ilYa, useStore } from '../store';
import { MOMENT_LABEL, type Moment, type Recette } from '../types';
import { ajouterJours, dateLongue } from '../lib/dates';
import { Compteur, Feuille, Icone, toast } from '../ui';
import { aller } from '../App';
import { normaliser } from './Recettes';
import { conflits, personnesGouts, resumeConflits } from '../lib/gouts';

// Choisir une recette pour une case du planning : suggestions adaptées au moment, puis celles pas faites depuis longtemps.
// Avec « pour » : plat de remplacement pour une personne qui ne mange pas le plat prévu (seulement des recettes qu'elle mange)
export default function Choisir({ date, moment, pour, onFermer }: { date: string; moment: Moment; pour?: string; onFermer: () => void }) {
  const { recettes, planning, reglages, mettreCase, derniereFois, parId } = useStore();
  const [q, setQ] = useState('');
  const gouts = useMemo(() => reglages.gouts ?? [], [reglages.gouts]);
  const actuel = planning[date]?.[moment];
  // Autre plat au même repas : pour qui ? ('' = tout le monde, sinon une personne)
  const [qui, setQui] = useState<string | undefined>(pour);
  const autrePlat = qui !== undefined && actuel?.type === 'recette';
  const deuxieme = qui === '';
  const portionsPour = (p?: string) => p ? 1 : p === '' && actuel && 'portions' in actuel ? actuel.portions : reglages.portionsParDefaut;
  const [portions, setPortions] = useState(() => portionsPour(pour));
  const choisirQui = (p: string) => { setQui(p); setPortions(portionsPour(p)); };
  const personnes = personnesGouts(gouts);

  const triees = useMemo(() => {
    const score = (r: Recette) => {
      const adapte = r.moments.length === 0 || r.moments.includes(moment) ? 0 : 1;
      const d = derniereFois(r.id);
      const gene = conflits(r, gouts).length ? 1 : 0; // ce que quelqu'un ne mange pas passe en dernier
      return [adapte + gene * 2, r.favori ? 0 : 1, d ?? '0000'] as const;
    };
    const liste = recettes.filter(r => !autrePlat || (r.id !== (actuel && 'recetteId' in actuel ? actuel.recetteId : '') && !conflits(r, gouts).some(c => c.gout.personne === qui)))
      .filter(r => !q || normaliser(r.titre + ' ' + r.ingredients.join(' ') + ' ' + r.thematiques.join(' ')).includes(normaliser(q)));
    return liste.map(r => ({ r, s: score(r) })).sort((a, b) => a.s[0] - b.s[0] || a.s[1] - b.s[1] || a.s[2].localeCompare(b.s[2]) || a.r.titre.localeCompare(b.r.titre)).map(x => x.r);
  }, [recettes, q, moment, derniereFois, gouts, qui, actuel, autrePlat]);

  // Restes possibles : recettes prévues la veille ou l'avant-veille
  const restesPossibles = useMemo(() => {
    const ids = new Set<string>();
    for (const d of [ajouterJours(date, -1), ajouterJours(date, -2)]) for (const c of Object.values(planning[d] ?? {})) if (c && c.type === 'recette' && parId[c.recetteId]) ids.add(c.recetteId);
    return [...ids].map(id => parId[id]);
  }, [planning, date, parId]);

  const choisir = (r: Recette, restes = false) => {
    if (autrePlat && qui !== undefined && actuel?.type === 'recette') {
      // le plat de la personne remplace sa part du plat prévu : une portion de moins (si on l'ajoute, pas si on le change)
      const deja = actuel.pour?.some(p => p.personne === qui);
      mettreCase(date, moment, { ...actuel, portions: deja || deuxieme ? actuel.portions : Math.max(1, actuel.portions - portions),
        pour: [...(actuel.pour ?? []).filter(p => p.personne !== qui), { personne: qui, recetteId: r.id, portions }] });
      toast(`${deuxieme ? 'Autre plat' : `Pour ${qui}`} : ${r.titre}`);
      onFermer();
      return;
    }
    mettreCase(date, moment, { type: restes ? 'restes' : 'recette', recetteId: r.id, portions });
    toast(`${r.titre} · ${dateLongue(date)} ${MOMENT_LABEL[moment].toLowerCase()}`);
    onFermer();
  };

  return (
    <Feuille titre={autrePlat ? 'Un autre plat au même repas' : 'Choisir un repas'} sousTitre={`${dateLongue(date)} · ${MOMENT_LABEL[moment]}`} onFermer={onFermer}>
      <div className="portions" style={{ marginBottom: 12 }}><span>Pour</span><Compteur valeur={portions} onChange={setPortions} libelle="Nombre de portions" /><span>pers.</span></div>
      {autrePlat ? <>
        <div className="pastilles wrap" role="radiogroup" aria-label="Pour qui ?" style={{ marginBottom: 6 }}>
          <span className="doux petit" style={{ alignSelf: 'center' }}>Pour qui ?</span>
          {['', ...personnes].map(p => <button key={p || 'tous'} role="radio" aria-checked={qui === p} className={'pastille' + (qui === p ? ' on' : '')} onClick={() => choisirQui(p)}>{p || 'Tout le monde'}</button>)}
        </div>
        <p className="doux petit" style={{ marginTop: 0 }}>{qui ? `Seulement des recettes que ${qui} mange. Sa portion est retirée du plat prévu.` : 'Servi en plus du plat prévu.'}</p>
      </> : <div className="pastilles">
        <button className="pastille" onClick={() => { mettreCase(date, moment, { type: 'dehors' }); onFermer(); }}>Repas dehors</button>
        {restesPossibles.map(r => <button key={r.id} className="pastille" onClick={() => choisir(r, true)}>Restes : {r.titre}</button>)}
      </div>}
      {recettes.length === 0 ? (
        <div className="vide-etat">
          <p>Aucune recette pour l’instant.</p>
          <button className="btn principal" onClick={() => aller('/editer/nouvelle')}>Ajouter une recette</button>
        </div>
      ) : <>
        <div className="recherche">{Icone.loupe}<input type="search" placeholder="Chercher une recette ou un ingrédient" value={q} onChange={e => setQ(e.target.value)} aria-label="Chercher" /></div>
        {!q && <h3 style={{ margin: '4px 0 8px' }}>{deuxieme ? 'Suggestions' : autrePlat && qui ? `Ce que ${qui} peut manger` : `Suggestions pour le ${MOMENT_LABEL[moment].toLowerCase()}`}</h3>}
        <div className="liste">
          {triees.slice(0, q ? 50 : 20).map(r => (
            <button key={r.id} className="ligne-recette" onClick={() => choisir(r)}>
              {r.photo ? <img src={r.photo} alt="" /> : <span className="sans-photo">{r.titre[0]}</span>}
              <span><b>{r.favori ? '♥ ' : ''}{r.titre}</b><span className="meta">{ilYa(derniereFois(r.id))}</span>{conflits(r, gouts).length > 0 && <span className="meta meta-gout">Pas pour : {resumeConflits(conflits(r, gouts))}</span>}</span>
            </button>
          ))}
          {!triees.length && <p className="doux">Aucune recette ne correspond.</p>}
        </div>
      </>}
    </Feuille>
  );
}
