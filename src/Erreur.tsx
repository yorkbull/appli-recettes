import { Component, type ErrorInfo, type ReactNode } from 'react';

// Filet de sécurité : si un écran plante, on affiche un message au lieu d'une page blanche.
// Les données (recettes, planning, prix) restent sur le téléphone : recharger suffit.
export default class Erreur extends Component<{ children: ReactNode }, { erreur: Error | null }> {
  state = { erreur: null as Error | null };
  static getDerivedStateFromError(erreur: Error) { return { erreur }; }
  componentDidCatch(e: Error, info: ErrorInfo) { console.error(e, info.componentStack); }
  render() {
    if (!this.state.erreur) return this.props.children;
    const recharger = (versSemaine: boolean) => { if (versSemaine) location.hash = '/semaine'; location.reload(); };
    return (
      <div className="page vide-etat" role="alert">
        <h1>Un problème est survenu</h1>
        <p>Cet écran n’a pas pu s’afficher. Vos recettes et votre planning ne sont pas touchés.</p>
        <p><button className="btn principal" onClick={() => recharger(false)}>Recharger</button></p>
        <p><button className="lien" onClick={() => recharger(true)}>Revenir à la semaine</button></p>
        <p className="doux petit">Détail : {this.state.erreur.message}</p>
      </div>
    );
  }
}
