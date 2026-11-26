import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Compteur, Feuille, toast } from '../ui';
import { demanderPersistance, type Sauvegarde } from '../db';
import Suggestions from '../Suggestions';
import Gouts from '../Gouts';
import { fusionner } from '../lib/fusion';
import { avecPhotos, garderAvantRetour, lireAvantRetour, lireHistorique, nbRepas, type Instantane } from '../lib/historique';

export default function Reglages() {
  const { reglages, modifierReglages, recettes, planning, importer, prix, parId } = useStore();
  const [nouveau, setNouveau] = useState('');
  const [persist, setPersist] = useState<string>('…');
  useEffect(() => { navigator.storage?.persisted?.().then(p => setPersist(p ? 'protégées' : 'non protégées')).catch(() => setPersist('inconnu')); }, []);

  const renommer = (i: number, v: string) => { const t = reglages.thematiques.slice(); t[i] = v; modifierReglages({ thematiques: t }); };

  const sauvegarde = (): Sauvegarde => ({ version: 1, date: new Date().toISOString(), recettes, planning, reglages, prix });
  const nomFichier = () => `recettes-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  const exporter = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(sauvegarde())], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = nomFichier(); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  // Envoi du fichier par message (WhatsApp, SMS, mail…) grâce au partage d'Android ; sinon téléchargement
  const partager = async () => {
    const f = new File([JSON.stringify(sauvegarde())], nomFichier(), { type: 'application/json' });
    if (navigator.canShare?.({ files: [f] })) {
      try { await navigator.share({ files: [f], title: 'Mes recettes', text: 'Mes recettes : ouvrez l’appli, Réglages, « Importer des données », puis choisissez ce fichier.' }); }
      catch { /* partage annulé */ }
    } else { exporter(); toast('Fichier téléchargé : envoyez-le par message'); }
  };

  const [recu, setRecu] = useState<Sauvegarde | null>(null);
  const lireFichier = async (f?: File) => {
    if (!f) return;
    try {
      const s = JSON.parse(await f.text()) as Sauvegarde;
      if (s.version !== 1 || !Array.isArray(s.recettes)) throw new Error();
      setRecu(s);
    } catch { toast('Ce fichier n’est pas une sauvegarde de l’appli'); }
  };
  const remplacer = async () => {
    if (!recu) return;
    await importer(recu); setRecu(null); toast('Données remplacées');
  };
  const fusion = async () => {
    if (!recu) return;
    const { s, bilan } = fusionner(sauvegarde(), recu);
    await importer(s); setRecu(null);
    toast(`${bilan.ajoutees} recette${bilan.ajoutees > 1 ? 's' : ''} ajoutée${bilan.ajoutees > 1 ? 's' : ''}, ${bilan.repas} repas, ${bilan.prix} prix`);
  };

  // Historique des copies automatiques
  const [historique, setHistorique] = useState<Instantane[] | null>(null);
  const [avantRetour, setAvantRetour] = useState<Instantane | null>(null);
  const ouvrirHistorique = async () => { setAvantRetour(await lireAvantRetour()); setHistorique(await lireHistorique()); };
  const jourLisible = (jour: string) => new Date(jour + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const quand = (i: Instantane) => `${jourLisible(i.jour)}, ${new Date(i.heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  const restaurer = async (i: Instantane) => {
    if (!confirm(`Revenir aux recettes et au planning du ${quand(i)} ? Ce qui a été fait depuis sera remplacé.`)) return;
    await garderAvantRetour(sauvegarde());
    await importer(avecPhotos(i.s, parId)); setHistorique(null); toast(`Données du ${quand(i)} remises`);
  };
  const annulerRetour = async () => {
    if (!avantRetour || !confirm('Annuler le dernier retour en arrière et retrouver les données d’avant ?')) return;
    await importer(avecPhotos(avantRetour.s, parId)); setHistorique(null); toast('Retour en arrière annulé');
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 16 }}>Réglages</h1>

      <Suggestions />

      <div className="carte">
        <label className="champ" style={{ marginBottom: 0 }}><span>Nom de l’appli</span><input type="text" value={reglages.nomAppli} onChange={e => modifierReglages({ nomAppli: e.target.value })} /></label>
      </div>

      <div className="carte">
        <div className="portions" style={{ margin: 0, border: 0, padding: 0 }}><span>Portions par défaut</span><Compteur valeur={reglages.portionsParDefaut} onChange={v => modifierReglages({ portionsParDefaut: v })} libelle="Portions par défaut" /></div>
      </div>

      <div className="carte">
        <label className="portions" style={{ margin: 0, border: 0, padding: 0, cursor: 'pointer' }}>
          <span>Plaques à induction<br /><span className="doux petit">Puissance conseillée (1 à 9) sous les étapes des recettes et du batch cooking.</span></span>
          <input type="checkbox" checked={reglages.induction !== false} onChange={e => modifierReglages({ induction: e.target.checked })} style={{ width: 24, height: 24, flex: 'none' }} />
        </label>
      </div>

      <Gouts />

      <div className="carte">
        <h2>Thématiques</h2>
        {reglages.thematiques.map((t, i) => (
          <div key={i} className="ligne-reglage">
            <input type="text" value={t} aria-label={`Thématique ${i + 1}`} onChange={e => renommer(i, e.target.value)} />
            <button className="btn danger" aria-label={`Supprimer ${t}`} onClick={() => confirm(`Supprimer la thématique « ${t} » ? Les recettes ne sont pas supprimées.`) && modifierReglages({ thematiques: reglages.thematiques.filter((_, k) => k !== i) })}>✕</button>
          </div>
        ))}
        <div className="ligne-reglage" style={{ borderBottom: 0 }}>
          <input type="text" placeholder="Nouvelle thématique" value={nouveau} onChange={e => setNouveau(e.target.value)} />
          <button className="btn" disabled={!nouveau.trim() || reglages.thematiques.includes(nouveau.trim())} onClick={() => { modifierReglages({ thematiques: [...reglages.thematiques, nouveau.trim()] }); setNouveau(''); }}>Ajouter</button>
        </div>
      </div>

      <div className="carte">
        <h2>Sauvegarde</h2>
        <p className="doux petit" style={{ marginTop: 0 }}>Tout est enregistré sur ce téléphone ({recettes.length} recettes, {nbRepas({ version: 1, date: '', recettes, planning, reglages })} repas au planning, données {persist}). L’appli garde aussi des copies automatiques des recettes et des menus pendant 30 jours.</p>
        <button className="btn plein" style={{ marginBottom: 8 }} onClick={ouvrirHistorique}>Sauvegardes automatiques</button>
        <button className="btn principal plein" style={{ marginBottom: 8 }} onClick={partager}>Partager mes données</button>
        <p className="doux petit" style={{ marginTop: 0 }}>Envoie un fichier par message à l’autre personne, qui l’ouvre ici avec « Importer des données ». Pour garder une copie hors du téléphone, choisissez Google Drive dans la liste.</p>
        <div className="deux">
          <button className="btn" onClick={exporter}>Exporter</button>
          <label className="btn" style={{ position: 'relative' }}>Importer des données<input type="file" accept="application/json,.json" style={{ position: 'absolute', inset: 0, opacity: 0 }} onChange={e => { lireFichier(e.target.files?.[0]); e.target.value = ''; }} /></label>
        </div>
        {persist === 'non protégées' && <button className="lien" onClick={async () => { const r = await demanderPersistance(); setPersist(r === 'accorde' ? 'protégées' : 'non protégées'); toast(r === 'accorde' ? 'Données protégées' : 'Android protégera les données une fois l’appli installée'); }}>Protéger les données</button>}
      </div>

      {recu && (
        <Feuille titre="Importer des données" sousTitre={`Fichier du ${new Date(recu.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} : ${recu.recettes.length} recettes.`} onFermer={() => setRecu(null)}>
          <button className="btn principal plein" style={{ marginBottom: 4 }} onClick={fusion}>Fusionner</button>
          <p className="doux petit" style={{ marginTop: 0 }}>Ajoute les recettes, repas et prix qui manquent ici. Rien n’est effacé, pas de doublon.</p>
          <button className="btn danger plein" style={{ marginBottom: 4 }} onClick={() => confirm(`Effacer vos ${recettes.length} recettes et votre planning pour les remplacer par ce fichier ?`) && remplacer()}>Remplacer</button>
          <p className="doux petit" style={{ marginTop: 0 }}>Efface les données de ce téléphone et met celles du fichier à la place.</p>
          <button className="btn plein" onClick={() => setRecu(null)}>Annuler</button>
        </Feuille>
      )}

      {historique && (
        <Feuille titre="Sauvegardes automatiques" sousTitre="Copies des recettes, des menus et des prix : après chaque changement aujourd’hui, puis une par jour pendant 30 jours." onFermer={() => setHistorique(null)}>
          {avantRetour && <button className="lien" onClick={annulerRetour}>Annuler le dernier retour en arrière</button>}
          {!historique.length && <p className="doux">Pas encore de copie : elle se fait quelques secondes après un changement.</p>}
          {historique.map(i => (
            <div key={i.heure} className="ligne-reglage">
              <span style={{ flex: 1 }}><b>{quand(i).replace(/^./, c => c.toUpperCase())}</b><br /><span className="doux petit">{i.s.recettes.length} recettes · {nbRepas(i.s)} repas</span></span>
              <button className="btn" onClick={() => restaurer(i)}>Revenir ici</button>
            </div>
          ))}
          <button className="btn plein" style={{ marginTop: 8 }} onClick={() => setHistorique(null)}>Fermer</button>
        </Feuille>
      )}

      <p className="doux petit" style={{ textAlign: 'center' }}>Version 0.3 · DA provisoire</p>
    </div>
  );
}
