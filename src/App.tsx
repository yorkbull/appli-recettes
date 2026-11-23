import { useEffect, useState } from 'react';
import { useStore } from './store';
import { Feuille, Icone, Toasts } from './ui';
import Suggestions from './Suggestions';
import Semaine from './screens/Semaine';
import Mois from './screens/Mois';
import Recettes from './screens/Recettes';
import Fiche from './screens/Fiche';
import Editer from './screens/Editer';
import Cuisine from './screens/Cuisine';
import ReglagesEcran from './screens/Reglages';
import Batch from './screens/Batch';
import Courses from './screens/Courses';

// Navigation par l'adresse (#/semaine, #/recette/abc…) : le bouton retour d'Android fonctionne naturellement
export const aller = (chemin: string) => { location.hash = chemin; };
const lireRoute = () => (location.hash.replace(/^#/, '') || '/semaine').split('?')[0].split('/').filter(Boolean);

// Nom lisible de l'écran, pour le bouton Remarque : « Fiche « Croque-monsieur » » plutôt que « #/recette/b446… »
const NOMS: Record<string, string> = { semaine: 'Semaine', mois: 'Mois', recettes: 'Mes recettes', courses: 'Courses', batch: 'Batch cooking', reglages: 'Réglages' };
function nomEcran(hash: string, titreDe: (id: string) => string | undefined): string {
  const [ecran, id] = (hash.replace(/^#/, '') || '/semaine').split('?')[0].split('/').filter(Boolean);
  const titre = id ? titreDe(id) : undefined;
  const avec = (nom: string) => titre ? `${nom} « ${titre} »` : nom;
  if (ecran === 'recette') return avec('Fiche');
  if (ecran === 'cuisine') return avec('Mode cuisine');
  if (ecran === 'editer') return id === 'nouvelle' ? 'Nouvelle recette' : avec('Modifier la recette');
  return NOMS[ecran] ?? 'Semaine';
}

export default function App() {
  const { pret, reglages, parId } = useStore();
  const [route, setRoute] = useState(lireRoute);
  // Bouton Remarque : écran en cours au moment de l'appui (null = feuille fermée)
  const [remarque, setRemarque] = useState<string | null>(null);
  useEffect(() => {
    const f = () => { setRoute(lireRoute()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  if (!pret) return <div className="page doux">Chargement…</div>;

  const [ecran, id] = route;
  const onglet = ecran === 'recette' || ecran === 'editer' ? 'recettes' : ecran;
  let contenu;
  switch (ecran) {
    case 'mois': contenu = <Mois />; break;
    case 'recettes': contenu = <Recettes />; break;
    case 'recette': contenu = <Fiche key={id} id={id} />; break;
    case 'editer': contenu = <Editer id={id} />; break;
    case 'cuisine': return <Cuisine id={id} />;
    case 'reglages': contenu = <ReglagesEcran />; break;
    case 'batch': contenu = <Batch />; break;
    case 'courses': contenu = <Courses />; break;
    default: contenu = <Semaine />;
  }

  return (
    <div className="app">
      <header className="barre">
        <div className="barre-cote"><a className="icone" href="#/editer/nouvelle" aria-label="Ajouter une recette">{Icone.plus}</a></div>
        <button className="nom" onClick={() => { location.hash = '/semaine'; window.dispatchEvent(new Event('semaine-courante')); }}>{reglages.nomAppli}</button>
        <div className="barre-cote">
          <button className="icone" aria-label="Faire une remarque sur cet écran" onClick={() => setRemarque(location.hash || '#/semaine')}>{Icone.bulle}</button>
          <a className="icone" href="#/reglages" aria-label="Réglages">{Icone.reglages}</a>
        </div>
      </header>
      <main>{contenu}</main>
      <nav className="menu" aria-label="Menu principal">
        <a href="#/semaine" className={onglet === 'semaine' || !onglet ? 'actif' : ''}>{Icone.semaine}Semaine</a>
        <a href="#/mois" className={onglet === 'mois' ? 'actif' : ''}>{Icone.mois}Mois</a>
        <a href="#/recettes" className={onglet === 'recettes' ? 'actif' : ''}>{Icone.livre}Mes recettes</a>
        <a href="#/courses" className={onglet === 'courses' ? 'actif' : ''}>{Icone.courses}Courses</a>
        <a href="#/batch" className={onglet === 'batch' ? 'actif' : ''}>{Icone.batch}Batch cooking</a>
      </nav>
      {remarque && (
        <Feuille titre="Remarque" sousTitre={`Sur l’écran ${nomEcran(remarque, id => parId[id]?.titre)}`} onFermer={() => setRemarque(null)}>
          <Suggestions ecran={`${nomEcran(remarque, id => parId[id]?.titre)} (${remarque})`} />
        </Feuille>
      )}
      <Toasts />
    </div>
  );
}
