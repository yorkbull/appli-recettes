import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { MOMENTS, MOMENT_LABEL, sansCoche, type Case, type Moment } from '../types';
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
  const [detail, setDetail] = useState<string | null>(null); // jour affiché en détail
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
            c[jours[i]] = { ...(c[jours[i]] ?? {}), [m]: sansCoche(src) }; n++;
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
        mettreCase(pos.date, pos.moment, mode.type === 'copier' ? sansCoche(src) : src);
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

  const vider = (pos: Position) => { mettreCase(pos.date, pos.moment, null); toast('Repas retiré'); };

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

      <div className="grille-semaine">
        <div className="grille-tete" aria-hidden="true"><span />{MOMENTS.map(m => <span key={m}>{MOMENT_LABEL[m]}</span>)}</div>
        {jours.map(d => {
          const ouvert = detail === d && !mode;
          const props = (m: Moment) => ({
            date: d, moment: m, c: planning[d]?.[m], cible: !!mode,
            onToucher: () => toucher({ date: d, moment: m }),
            onLong: () => { if (!mode && planning[d]?.[m]) setMenu({ date: d, moment: m }); },
            onVider: () => vider({ date: d, moment: m }),
          });
          return (
            <section key={d} className={'jour' + (d === auj ? ' auj' : '') + (ouvert ? ' ouvert' : '')} aria-label={dateLongue(d)}>
              {ouvert ? <>
                <button className="jour-detail-tete" aria-expanded="true" onClick={() => setDetail(null)}>
                  <b>{dateLongue(d)}</b><span className="lien" style={{ minHeight: 0 }}>Réduire</span>
                </button>
                {MOMENTS.map(m => <LigneRepas key={m} {...props(m)} />)}
              </> : <>
                <button className="jour-court" aria-label={`Voir le détail de ${dateLongue(d)}`} aria-expanded="false" onClick={() => setDetail(d)}>
                  <b>{nomJour(d).slice(0, 3)}</b><span>{depuisIso(d).getDate()}</span>
                </button>
                {MOMENTS.map(m => <CaseRepas key={m} {...props(m)} />)}
              </>}
            </section>
          );
        })}
      </div>

      <button className="carte-suivante" onClick={() => setDebut(ajouterJours(debut, 7))}>
        <span>Voir la semaine suivante<br /><span className="doux petit">{nbSuivante ? `${nbSuivante} repas déjà prévu${nbSuivante > 1 ? 's' : ''}` : 'Rien de prévu pour l’instant'}</span></span>
        {Icone.avant}
      </button>

      {choix && <Choisir date={choix.date} moment={choix.moment} onFermer={fermerChoix} />}
      {menu && <MenuCase pos={menu} onFermer={fermerMenu} onMode={t => { setMode({ type: t, depuis: menu }); setMenu(null); }} />}
    </div>
  );
}

type PropsCase = { date: string; moment: Moment; c?: Case; cible: boolean; onToucher: () => void; onLong: () => void; onVider: () => void };

const decrire = (c: Case | undefined, parId: Record<string, { titre: string }>): string => {
  if (!c) return 'rien de prévu';
  if (c.mange) return `${decrire({ ...c, mange: false }, parId)}, déjà mangé`;
  if (c.type === 'dehors') return 'Repas dehors';
  if (c.type === 'note') return c.texte;
  const r = parId[c.recetteId];
  return r ? (c.type === 'restes' ? `Restes : ${r.titre}` : r.titre) : 'Recette supprimée';
};

// Case de la grille : titre du repas, portions et corbeille pour retirer le choix
function CaseRepas({ date, moment, c, cible, onToucher, onLong, onVider }: PropsCase) {
  const { parId } = useStore();
  const appui = useAppuiLong(onLong, onToucher);
  const texte = decrire(c, parId);
  return (
    <div className={'case' + (cible ? ' cible' : '')}>
      <button className={'case-titre' + (c ? '' : ' vide') + (c?.mange ? ' mange' : '')} {...appui} aria-label={`${MOMENT_LABEL[moment]}, ${dateLongue(date)} : ${texte}`}>
        {c ? (c.mange ? `✓ ${decrire({ ...c, mange: false }, parId)}` : texte) : '+ Choisir'}
      </button>
      {c && (
        <div className="case-pied">
          <span>{'portions' in c ? `${c.portions} p.` : ''}</span>
          {!cible && <button className="corbeille" aria-label={`Retirer le repas du ${MOMENT_LABEL[moment].toLowerCase()}`} onClick={onVider}>{Icone.corbeille}</button>}
        </div>
      )}
    </div>
  );
}

// Ligne du détail d'un jour : photo, titre complet, portions et corbeille
function LigneRepas({ date, moment, c, cible, onToucher, onLong, onVider }: PropsCase) {
  const { parId } = useStore();
  const appui = useAppuiLong(onLong, onToucher);
  const r = c && (c.type === 'recette' || c.type === 'restes') ? parId[c.recetteId] : undefined;
  return (
    <div className="ligne-repas">
      <button className="case-ligne" {...appui} aria-label={`${MOMENT_LABEL[moment]}, ${dateLongue(date)} : ${decrire(c, parId)}`}>
        <span className="moment">{MOMENT_LABEL[moment]}</span>
        <span className={'contenu' + (c?.mange ? ' mange' : '')}>
          {c?.mange && <span aria-hidden="true">✓</span>}
          {!c && <span className="vide">+ Choisir</span>}
          {c?.type === 'dehors' && <span>Repas dehors</span>}
          {c?.type === 'note' && <span>{c.texte}</span>}
          {(c?.type === 'recette' || c?.type === 'restes') && (r ? <>
            {r.photo ? <img className="vignette" src={r.photo} alt="" /> : <span className="vignette sans-photo" style={{ fontSize: '1rem' }}>{r.titre[0]}</span>}
            <span>{c.type === 'restes' && <span className="etiquette restes">Restes</span>} {r.titre}</span>
          </> : <span className="vide">Recette supprimée</span>)}
        </span>
        {c && <span className="doux petit">{'portions' in c ? `${c.portions} p.` : ''}</span>}
      </button>
      {c && !cible ? <button className="corbeille" aria-label={`Retirer le repas du ${MOMENT_LABEL[moment].toLowerCase()}`} onClick={onVider}>{Icone.corbeille}</button> : <span />}
    </div>
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
      <button className="action" onClick={() => { mettreCase(pos.date, pos.moment, c.mange ? sansCoche(c) : { ...c, mange: true }); toast(c.mange ? 'Repas à manger' : 'Repas marqué comme mangé'); onFermer(); }}>
        {c.mange ? 'Pas encore mangé' : 'Marquer comme mangé'}
      </button>
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
