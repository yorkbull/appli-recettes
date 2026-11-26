import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { aujourdhui } from '../lib/dates';
import { MOMENT_LABEL } from '../types';
import { listeCourses, RAYONS, texteCourses } from '../lib/courses';
import { duree } from '../lib/quantites';
import { conservation, libelleRepas, periodeSession, planCuisine, planningSession, platsSession, prochaineSession, repasCouverts, texteDuree, titreSession, TITRES_PHASES, type Tache } from '../lib/batch';
import { Icone, toast } from '../ui';
import { conseilInduction } from '../lib/induction';
import { alerte } from '../lib/sonnerie';

// Batch cooking : session du dimanche (repas jusqu'au mercredi midi) et du mercredi (jusqu'au vendredi midi)
export default function Batch() {
  const { planning, parId, reglages } = useStore();
  const induction = reglages.induction !== false;
  const [decalage, setDecalage] = useState(0);
  const s = useMemo(() => prochaineSession(aujourdhui(), decalage), [decalage]);

  const repas = useMemo(() => repasCouverts(s, planning), [s, planning]);
  const plats = useMemo(() => platsSession(repas, parId), [repas, parId]);
  const plan = useMemo(() => planCuisine(plats, induction), [plats, induction]);
  const conserver = useMemo(() => conservation(s, plats), [s, plats]);
  const courses = useMemo(() => { const p = planningSession(s, planning); return listeCourses(p.jours, p.planning, parId).articles; }, [s, planning, parId]);

  // Étapes cochées pendant la session, gardées sur le téléphone
  const cle = `batch-faites-${s.jour}`;
  const [faites, setFaites] = useState<string[]>([]);
  useEffect(() => { setFaites(JSON.parse(localStorage.getItem(cle) ?? '[]')); }, [cle]);
  const basculer = (id: string) => { const n = faites.includes(id) ? faites.filter(x => x !== id) : [...faites, id]; setFaites(n); localStorage.setItem(cle, JSON.stringify(n)); };

  // Plan dans l'ordre d'affichage ; l'étape « en cours » est la première pas encore cochée
  const ordre = useMemo(() => ([1, 2, 3, 4, 5] as const).flatMap(ph => plan.taches.filter(t => t.phase === ph)), [plan]);
  const courante = ordre.find(t => !faites.includes(t.id));

  // Minuteurs de cuisson
  type Minuteur = { id: string; fin: number; libelle: string; sonne?: boolean };
  const [minuteurs, setMinuteurs] = useState<Minuteur[]>([]);
  const [, tic] = useState(0);
  useEffect(() => {
    if (!minuteurs.length) return;
    const t = setInterval(() => {
      tic(x => x + 1);
      setMinuteurs(ms => ms.map(m => {
        if (m.sonne || Date.now() < m.fin) return m;
        alerte(); toast(`Minuteur terminé : ${m.libelle}`);
        return { ...m, sonne: true };
      }));
    }, 1000);
    return () => clearInterval(t);
  }, [minuteurs.length]);
  const lancerMinuteur = (t?: Tache) => {
    if (!t?.minutes) return;
    setMinuteurs(ms => [...ms.filter(m => m.id !== t.id), { id: t.id, fin: Date.now() + t.minutes! * 60000, libelle: t.plat ?? 'cuisson' }]);
  };
  const reste = (m: Minuteur) => { const s2 = Math.max(0, Math.round((m.fin - Date.now()) / 1000)); return `${Math.floor(s2 / 60)}:${String(s2 % 60).padStart(2, '0')}`; };

  // Gros bouton rouge : valide l'étape en cours, lance son minuteur s'il y a une cuisson,
  // puis fait remonter la suivante en haut de l'écran (aucune autre manipulation)
  // place l'étape juste sous la barre du haut et les minuteurs
  const decalageHaut = () => Math.max(64, document.querySelector('.minuteurs-batch')?.getBoundingClientRect().bottom ?? 0) + 10;
  const montrer = (id?: string) => {
    if (!id) return;
    setTimeout(() => { const e = document.getElementById('etape-' + id); if (e) window.scrollBy({ top: e.getBoundingClientRect().top - decalageHaut(), behavior: 'smooth' }); }, 60);
  };
  const valider = () => {
    if (!courante) return;
    // étape en cours hors de l'écran : le premier appui la montre, sans rien cocher à l'aveugle
    const e = document.getElementById('etape-' + courante.id)?.getBoundingClientRect();
    if (!e || e.top < decalageHaut() - 20 || e.bottom > innerHeight - 160) { montrer(courante.id); return; }
    const n = [...faites, courante.id]; setFaites(n); localStorage.setItem(cle, JSON.stringify(n));
    navigator.vibrate?.(30);
    if (courante.minutes) lancerMinuteur(courante);
    const suivante = ordre.find(t => !n.includes(t.id));
    if (suivante) montrer(suivante.id); else toast('Tout est fait. Bravo !');
  };
  const annuler = () => {
    const derniere = [...ordre].reverse().find(t => faites.includes(t.id));
    if (!derniere) return;
    const n = faites.filter(x => x !== derniere.id); setFaites(n); localStorage.setItem(cle, JSON.stringify(n));
    montrer(derniere.id);
  };

  const partagerCourses = async () => {
    const texte = texteCourses(`Courses batch cooking du ${titreSession(s).toLowerCase()}`, courses);
    try {
      if (navigator.share) await navigator.share({ title: 'Courses batch cooking', text: texte });
      else { await navigator.clipboard.writeText(texte); toast('Liste copiée'); }
    } catch { /* partage annulé */ }
  };

  const phases = ([1, 2, 3, 4, 5] as const).map(ph => ({ ph, taches: plan.taches.filter(t => t.phase === ph) })).filter(x => x.taches.length);
  const autres = repas.filter(x => x.c.type === 'dehors' || x.c.type === 'note');

  return (
    <div className="page">
      <div className="nav-semaine">
        <button className="icone" aria-label="Session précédente" onClick={() => setDecalage(decalage - 1)}>{Icone.retour}</button>
        <div className="titre">
          <h1>Batch cooking</h1>
          <small>{decalage === 0 ? 'Prochaine session : ' : ''}{titreSession(s)}</small>
        </div>
        <button className="icone" aria-label="Session suivante" onClick={() => setDecalage(decalage + 1)}>{Icone.avant}</button>
      </div>
      {decalage !== 0 && <p style={{ textAlign: 'center', marginTop: -6 }}><button className="lien" onClick={() => setDecalage(0)}>Revenir à la prochaine session</button></p>}
      <p className="doux petit" style={{ textAlign: 'center', marginTop: 0 }}>{periodeSession(s)}</p>

      {!plats.length ? (
        <div className="vide-etat">
          <p>Aucune recette n’est prévue pour ces repas.</p>
          <a className="btn" href="#/semaine">Planifier la semaine</a>
        </div>
      ) : <>
        <section className="carte">
          <h2>À cuisiner</h2>
          {plats.map(p => (
            <div key={p.r.id} className="ligne-reglage" style={{ alignItems: 'flex-start' }}>
              <span style={{ flex: 1 }}>
                <a href={`#/recette/${p.r.id}?portions=${p.portions}`}><b>{p.r.titre}</b></a>
                <br /><span className="doux petit">{p.portions} portion{p.portions > 1 ? 's' : ''} · {p.repas.map(x => `${x.c.type === 'restes' ? 'restes ' : ''}${libelleRepas(x.date, x.moment)}`).join(', ')}</span>
              </span>
            </div>
          ))}
          {autres.length > 0 && <p className="doux petit">Pas de cuisine pour : {autres.map(x => `${libelleRepas(x.date, x.moment)} (${x.c.type === 'dehors' ? 'repas dehors' : x.c.type === 'note' ? x.c.texte : ''})`).join(', ')}.</p>}
          <div className="nutrition" style={{ marginTop: 8 }}>
            <strong style={{ color: 'var(--texte)' }}>Environ {texteDuree(plan.minutesSession)}</strong> en cuisinant tout d’un coup,
            {plan.minutesSepares > plan.minutesSession ? <> au lieu de {texteDuree(plan.minutesSepares)} en cuisinant chaque plat à part.</> : '.'}
          </div>
        </section>

        <section className="carte">
          <h2>Courses de la session <span className="doux petit">{courses.length} articles</span></h2>
          <p className="doux petit" style={{ marginTop: 0 }}>Seulement les repas de cette session. La liste de la semaine reste dans l’onglet Courses.</p>
          <button className="btn plein" onClick={partagerCourses} disabled={!courses.length}>Partager la liste</button>
          <details style={{ marginTop: 8 }}>
            <summary className="lien">Voir la liste</summary>
            {RAYONS.map(({ id, titre }) => {
              const l = courses.filter(a => a.rayon === id);
              return l.length ? <p key={id} className="petit"><b>{titre}</b> : {l.map(a => a.nom + (a.quantite ? ` (${a.quantite})` : '')).join(', ')}</p> : null;
            })}
          </details>
        </section>

        <section className="carte">
          <h2>Plan de cuisine</h2>
          <p className="doux petit" style={{ marginTop: 0 }}>Dans cet ordre, les cuissons longues tournent pendant que vous préparez le reste. Appuyez sur le gros bouton rouge à chaque étape terminée : la suivante remonte en haut de l’écran et les cuissons lancent leur minuteur.</p>
          {minuteurs.length > 0 && <div className="minuteurs-batch">
            {minuteurs.map(m => <button key={m.id} className={'minuteur petit-minuteur ' + (m.sonne ? 'fini' : 'encours')} onClick={() => setMinuteurs(ms => ms.filter(x => x.id !== m.id))}
              aria-label={`Minuteur ${m.libelle}, toucher pour arrêter`}>⏱ {m.sonne ? 'Terminé !' : reste(m)} · {m.libelle}</button>)}
          </div>}
          {phases.map(({ ph, taches }, rang) => (
            <div key={ph}>
              <h3 style={{ margin: '14px 0 4px' }}>{rang + 1}. {TITRES_PHASES[ph]}</h3>
              {taches.map(t => <Etape key={t.id} t={t} induction={induction} faite={faites.includes(t.id)} enCours={courante?.id === t.id} onMinuteur={() => lancerMinuteur(t)} onBasculer={() => basculer(t.id)} />)}
            </div>
          ))}
          {faites.length > 0 && <button className="lien" onClick={() => { setFaites([]); localStorage.removeItem(cle); }}>Tout décocher</button>}
          <div style={{ height: '55vh' }} aria-hidden="true" />{/* place pour faire remonter la dernière étape en haut */}
        </section>

        <section className="carte">
          <h2>Conservation</h2>
          {conserver.conseils.map((c, i) => (
            <p key={i} style={{ margin: '6px 0' }}><b>{c.plat}</b>, {MOMENT_LABEL[c.repas.moment].toLowerCase()} : <span className={c.lieu === 'congelateur' ? '' : 'doux'}>{c.texte}</span></p>
          ))}
          {conserver.jourMeme.length > 0 && <>
            <h3 style={{ margin: '14px 0 4px' }}>À préparer le jour même</h3>
            <p className="doux petit" style={{ marginTop: 0 }}>Ces ingrédients frais se gardent mal une fois coupés ou assaisonnés : les ajouter au moment du repas.</p>
            <ul style={{ margin: 0, paddingLeft: 20 }}>{conserver.jourMeme.map(x => <li key={x} className="petit">{x}</li>)}</ul>
          </>}
          <p className="doux petit">Frigo entre 0 et 4 °C : 3 jours maximum pour un plat cuisiné, 2 jours pour le poisson. Au-delà, congeler le jour de la cuisson. Réchauffer une seule fois, bien chaud à cœur. Ne jamais recongeler un plat décongelé.</p>
        </section>

        {courante && (
          <div className="batch-boutons">
            {faites.length > 0 ? <button className="batch-annuler" aria-label="Revenir à l’étape précédente" onClick={annuler}>↶</button> : <span className="batch-annuler vide" />}
            <button className="batch-valider" onClick={valider} aria-label={`Étape faite : ${courante.texte}`}>✓<small>Fait</small></button>
            <span className="batch-annuler vide" />
          </div>
        )}
      </>}
    </div>
  );
}

function Etape({ t, induction, faite, enCours, onBasculer, onMinuteur }: { t: Tache; induction: boolean; faite: boolean; enCours: boolean; onBasculer: () => void; onMinuteur: () => void }) {
  return (
    <label id={'etape-' + t.id} className={'article etape-batch' + (faite ? ' coche' : '') + (enCours ? ' en-cours' : '')} style={{ alignItems: 'start', paddingTop: 10, paddingBottom: 10 }}>
      <input type="checkbox" checked={faite} onChange={onBasculer} style={{ marginTop: 2 }} />
      <span className="article-nom">
        {t.plat && <span className="etiquette" style={{ marginRight: 6 }}>{t.plat}</span>}
        {t.texte}
        {t.attente && t.minutes ? <span className="doux petit"> · cuit seul {duree(Math.round(t.minutes))}, passer à la suite</span> : null}
        {induction && !faite && conseilInduction(t.texte) && <span className="conseil-induction">Induction : {conseilInduction(t.texte)}</span>}
      </span>
      {t.minutes ? <button type="button" className="corbeille" aria-label={`Lancer un minuteur de ${duree(Math.round(t.minutes))}`} onClick={e => { e.preventDefault(); onMinuteur(); }}>⏱</button> : <span />}
    </label>
  );
}
