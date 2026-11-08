import { useEffect, useState } from 'react';
import { useStore } from './store';
import { Icone, Toasts } from './ui';
import Semaine from './screens/Semaine';
import Mois from './screens/Mois';
import Recettes from './screens/Recettes';
import Fiche from './screens/Fiche';
import Editer from './screens/Editer';
import Cuisine from './screens/Cuisine';
import ReglagesEcran from './screens/Reglages';
import Batch from './screens/Batch';

// Navigation par l'adresse (#/semaine, #/recette/abc…) : le bouton retour d'Android fonctionne naturellement
export const aller = (chemin: string) => { location.hash = chemin; };
const lireRoute = () => (location.hash.replace(/^#/, '') || '/semaine').split('?')[0].split('/').filter(Boolean);

export default function App() {
  const { pret, reglages } = useStore();
  const [route, setRoute] = useState(lireRoute);
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
    case 'recette': contenu = <Fiche id={id} />; break;
    case 'editer': contenu = <Editer id={id} />; break;
    case 'cuisine': return <Cuisine id={id} />;
    case 'reglages': contenu = <ReglagesEcran />; break;
    case 'batch': contenu = <Batch />; break;
    default: contenu = <Semaine />;
  }

  return (
    <div className="app">
      <header className="barre">
        <a className="icone" href="#/editer/nouvelle" aria-label="Ajouter une recette">{Icone.plus}</a>
        <button className="nom" onClick={() => { location.hash = '/semaine'; window.dispatchEvent(new Event('semaine-courante')); }}>{reglages.nomAppli}</button>
        <a className="icone" href="#/reglages" aria-label="Réglages">{Icone.reglages}</a>
      </header>
      <main>{contenu}</main>
      <nav className="menu" aria-label="Menu principal">
        <a href="#/semaine" className={onglet === 'semaine' || !onglet ? 'actif' : ''}>{Icone.semaine}Semaine</a>
        <a href="#/mois" className={onglet === 'mois' ? 'actif' : ''}>{Icone.mois}Mois</a>
        <a href="#/recettes" className={onglet === 'recettes' ? 'actif' : ''}>{Icone.livre}Mes recettes</a>
        <a href="#/batch" className={onglet === 'batch' ? 'actif' : ''}>{Icone.batch}Batch cooking</a>
      </nav>
      <Toasts />
    </div>
  );
}
