import { useEffect, useState } from 'react';
import { toast } from './ui';

// Boîte à idées : chaque message devient un « ticket » (issue) du dépôt GitHub de l'appli,
// pour garder la liste des choses à changer au même endroit que le code.
// Avec « ecran » (bouton Remarque de la barre du haut), le ticket s'appelle « Remarque : … »
// et indique l'écran où l'on se trouvait.
const DEPOT = 'https://github.com/yorkbull/appli-recettes';

export default function Suggestions({ ecran }: { ecran?: string }) {
  const cle = ecran ? 'remarque-brouillon' : 'suggestion-brouillon';
  const [texte, setTexte] = useState(() => localStorage.getItem(cle) ?? '');
  useEffect(() => { localStorage.setItem(cle, texte); }, [cle, texte]);
  const message = texte.trim();

  const envoyer = () => {
    const debut = (ecran ? 'Remarque : ' : '') + message.split('\n')[0];
    const titre = debut.slice(0, 70) + (debut.length > 70 ? '…' : '');
    const corps = `${message}\n\n---\n${ecran ? `Écran : ${ecran}\n` : ''}Envoyé depuis l'appli le ${new Date().toLocaleString('fr-FR')}`;
    window.open(`${DEPOT}/issues/new?title=${encodeURIComponent(titre)}&body=${encodeURIComponent(corps)}`, '_blank', 'noopener');
    setTexte('');
    toast('Appuyez sur « Create » dans GitHub pour envoyer');
  };

  const partager = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Suggestion pour l’appli recettes', text: message });
      else { await navigator.clipboard.writeText(message); toast('Message copié'); }
    } catch { /* partage annulé */ }
  };

  return (
    <div className={ecran ? '' : 'carte'}>
      {!ecran && <h2>Une idée, quelque chose à changer ?</h2>}
      <label className="champ" style={{ marginBottom: 12 }}>
        <textarea aria-label="Votre message" style={{ minHeight: 100 }} value={texte} onChange={e => setTexte(e.target.value)}
          placeholder={ecran ? 'Ex. : ce bouton est trop petit, il manque une information ici…' : 'Ex. : mettre les courses par rayon, agrandir le texte en mode cuisine…'} />
        <small>Le message s’ouvre sur GitHub (compte yorkbull) : appuyez sur « Create » pour l’enregistrer dans la liste des choses à faire.</small>
      </label>
      <div className="deux">
        <button className="btn" disabled={!message} onClick={envoyer}>Envoyer</button>
        <button className="btn" disabled={!message} onClick={partager}>Partager</button>
      </div>
      <a className="lien" href={`${DEPOT}/issues`} target="_blank" rel="noreferrer">Voir les messages envoyés</a>
    </div>
  );
}
