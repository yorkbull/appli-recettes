import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { MOMENTS, MOMENT_LABEL, type Case, type Moment } from '../types';
import { ajouterJours, aujourdhui, dateLongue, depuisIso, joursSemaine, lundi, nomJour, titreSemaine } from '../lib/dates';
import { Feuille, Icone, toast, useAppuiLong } from '../ui';
import Choisir from './Choisir';
import { aller } from '../App';

type Position = { date: string; moment: Moment };
type Mode = { type: 'deplacer' | 'copier'; depuis: Position } | null;

export default function Semaine() {
  const { planning, parId, mettreCase, modifierPlanning } = useStore();
  const [debut, setDebut] = useState(() => { const s = sessionStorage.getItem('semaine'); sessionStorage.removeItem('semaine'); return s ?? lundi(aujourdhui()); });
  const [choix, setChoix] = useState<Position | null>(null);
  const [menu, setMenu] = useState<Position | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const auj = aujourdhui();
  const jours = joursSemaine(debut);
  const estCourante = debut === lundi(auj);

  useEffect(() => {
    const f = () => setDebut(lundi(aujourdhui()));
    window.addEventListener('semaine-courante', f);
    return () => window.removeEventListener('semaine-courante', f);
  }, []);

  const nbSuivante = useMemo(() => joursSemaine(ajouterJours(debut, 7)).reduce((n, d) => n + Object.keys(planning[d] ?? {}).length, 0), [planning, debut]);
  const precedente = joursSemaine(ajouterJours(debut, -7));
  const casesVides = jours.reduce((n, d) => n + MOMENTS.filter(m => !planning[d]?.[m]).length, 0);
  const aReprendre = precedente.some((d, i) => MOMENTS.some(m => planning[d]?.[m] && !planning[jours[i]]?.[m]));

  const reprendre = () => {
    let n = 0;
    modifierPlanning(p => {
      const c = { ...p };
      precedente.forEach((d, i) => {
        for (const m of MOMENTS) {
          const src = p[d]?.[m];
          if (src && !p[jours[i]]?.[m] && (src.type !== 'recette' && src.type !== 'restes' || parId[src.recetteId])) {
            c[jours[i]] = { ...(c[jours[i]] ?? {}), [m]: src }; n++;
          }
        }
      });
      return c;
    });
    setTimeout(() => toast(n ? `${n} repas repris de la semaine dernière` : 'Rien à reprendre'), 0);
  };

  const toucher = (pos: Position) => {
    if (mode) {
      const src = planning[mode.depuis.date]?.[mode.depuis.moment];
      if (src && !(pos.date === mode.depuis.date && pos.moment === mode.depuis.moment)) {
        mettreCase(pos.date, pos.moment, src);
        if (mode.type === 'deplacer') mettreCase(mode.depuis.date, mode.depuis.moment, null);
        toast(mode.type === 'deplacer' ? 'Repas déplacé' : 'Repas copié');
      }
      setMode(null);
      return;
    }
    const c = planning[pos.date]?.[pos.moment];
    if (c && (c.type === 'recette' || c.type === 'restes') && parId[c.recetteId]) aller(`/recette/${c.recetteId}?portions=${c.portions}`);
    else setChoix(pos);
  };

  const fermerChoix = useCallback(() => setChoix(null), []);
  const fermerMenu = useCallback(() => setMenu(null), []);

  return (
    <div className="page">
      {mode && (
        <div className="bandeau" role="status">
          <span>Touchez la case où {mode.type === 'deplacer' ? 'déplacer' : 'copier'} le repas</span>
          <button onClick={() => setMode(null)}>Annuler</button>
        </div>
      )}
      <div className="nav-semaine">
        <button className="icone" aria-label="Semaine précédente" onClick={() => setDebut(ajouterJours(debut, -7))}>{Icone.retour}</button>
        <div className="titre">
          <h1>{estCourante ? 'Cette semaine' : debut === lundi(ajouterJours(auj, 7)) ? 'Semaine prochaine' : 'Semaine'}</h1>
          <small>{titreSemaine(debut)}</small>
        </div>
        <button className="icone" aria-label="Semaine suivante" onClick={() => setDebut(ajouterJours(debut, 7))}>{Icone.avant}</button>
      </div>
      {!estCourante && <p style={{ textAlign: 'center', marginTop: -6 }}><button className="lien" onClick={() => setDebut(lundi(auj))}>Revenir à cette semaine</button></p>}
      {aReprendre && casesVides > 0 && !mode && (
        <button className="btn plein" style={{ marginBottom: 12 }} onClick={reprendre}>Reprendre la semaine dernière</button>
      )}

      {jours.map(d => (
        <section key={d} className={'jour' + (d === auj ? ' auj' : '')} aria-label={dateLongue(d)}>
          <div className="jour-tete"><b>{nomJour(d)}</b><span className="doux petit">{depuisIso(d).getDate()}</span></div>
          {MOMENTS.map(m => (
            <CaseRepas key={m} date={d} moment={m} c={planning[d]?.[m]} cible={!!mode}
              onToucher={() => toucher({ date: d, moment: m })} onLong={() => !mode && planning[d]?.[m] && setMenu({ date: d, moment: m })} />
          ))}
        </section>
      ))}

      <button className="carte-suivante" onClick={() => setDebut(ajouterJours(debut, 7))}>
        <span>Voir la semaine suivante<br /><span className="doux petit">{nbSuivante ? `${nbSuivante} repas déjà prévu${nbSuivante > 1 ? 's' : ''}` : 'Rien de prévu pour l’instant'}</span></span>
        {Icone.avant}
      </button>

      {choix && <Choisir date={choix.date} moment={choix.moment} onFermer={fermerChoix} />}
      {menu && <MenuCase pos={menu} onFermer={fermerMenu} onMode={t => { setMode({ type: t, depuis: menu }); setMenu(null); }} />}
    </div>
  );
}

function CaseRepas({ date, moment, c, cible, onToucher, onLong }: { date: string; moment: Moment; c?: Case; cible: boolean; onToucher: () => void; onLong: () => void }) {
  const { parId } = useStore();
  const appui = useAppuiLong(onLong, onToucher);
  const r = c && (c.type === 'recette' || c.type === 'restes') ? parId[c.recetteId] : undefined;
  return (
    <button className={'case' + (cible ? ' cible' : '')} {...appui} aria-label={`${MOMENT_LABEL[moment]}, ${dateLongue(date)} : ${r ? r.titre : c?.type === 'dehors' ? 'repas dehors' : c?.type === 'note' ? c.texte : 'rien de prévu'}`}>
      <span className="moment">{MOMENT_LABEL[moment]}</span>
      <span className="contenu">
        {!c && <span className="vide">+ Choisir</span>}
        {c?.type === 'dehors' && <span>Repas dehors</span>}
        {c?.type === 'note' && <span>{c.texte}</span>}
        {(c?.type === 'recette' || c?.type === 'restes') && (r ? <>
          {r.photo ? <img className="vignette" src={r.photo} alt="" /> : <span className="vignette sans-photo" style={{ fontSize: '1rem' }}>{r.titre[0]}</span>}
          <span>{c.type === 'restes' && <span className="etiquette restes">Restes</span>} {r.titre}</span>
        </> : <span className="vide">Recette supprimée</span>)}
      </span>
      {c && <span className="doux petit" style={{ paddingRight: 8 }}>{'portions' in c ? `${c.portions} p.` : ''}</span>}
    </button>
  );
}

function MenuCase({ pos, onFermer, onMode }: { pos: Position; onFermer: () => void; onMode: (t: 'deplacer' | 'copier') => void }) {
  const { planning, parId, mettreCase } = useStore();
  const c = planning[pos.date]?.[pos.moment];
  if (!c) return null;
  const r = 'recetteId' in c ? parId[c.recetteId] : undefined;
  const demain = ajouterJours(pos.date, 1);
  const cibleRestes = planning[demain]?.midi;
  const restes = () => {
    if (c.type !== 'recette') return;
    if (cibleRestes && !confirm(`Remplacer le repas prévu ${nomJour(demain)} midi ?`)) return;
    mettreCase(pos.date, pos.moment, { ...c, portions: c.portions * 2 });
    mettreCase(demain, 'midi', { type: 'restes', recetteId: c.recetteId, portions: c.portions });
    toast(`Portions doublées, restes ${nomJour(demain)} midi`);
    onFermer();
  };
  return (
    <Feuille titre={r?.titre ?? (c.type === 'dehors' ? 'Repas dehors' : 'Repas')} sousTitre={`${dateLongue(pos.date)} · ${MOMENT_LABEL[pos.moment]}`} onFermer={onFermer}>
      {r && <button className="action" onClick={() => aller(`/recette/${r.id}?portions=${'portions' in c ? c.portions : r.portions}`)}>Voir la recette</button>}
      <button className="action" onClick={() => onMode('deplacer')}>Déplacer</button>
      <button className="action" onClick={() => onMode('copier')}>Copier vers une autre case</button>
      {c.type === 'recette' && <button className="action" onClick={restes}>Faire des restes pour {nomJour(demain)} midi</button>}
      {'portions' in c && (
        <div className="action" style={{ justifyContent: 'space-between' }}>
          <span>Portions</span>
          <span className="compteur">
            <button aria-label="Moins" onClick={() => mettreCase(pos.date, pos.moment, { ...c, portions: Math.max(1, c.portions - 1) })}>−</button>
            <output>{c.portions}</output>
            <button aria-label="Plus" onClick={() => mettreCase(pos.date, pos.moment, { ...c, portions: c.portions + 1 })}>+</button>
          </span>
        </div>
      )}
      <button className="action danger" onClick={() => { mettreCase(pos.date, pos.moment, null); toast('Case vidée'); onFermer(); }}>Vider la case</button>
    </Feuille>
  );
}
