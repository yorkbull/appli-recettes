import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { Compteur, toast } from '../ui';
import { demanderPersistance, type Sauvegarde } from '../db';

export default function Reglages() {
  const { reglages, modifierReglages, recettes, planning, importer } = useStore();
  const [nouveau, setNouveau] = useState('');
  const [persist, setPersist] = useState<string>('…');
  useEffect(() => { navigator.storage?.persisted?.().then(p => setPersist(p ? 'protégées' : 'non protégées')).catch(() => setPersist('inconnu')); }, []);

  const renommer = (i: number, v: string) => { const t = reglages.thematiques.slice(); t[i] = v; modifierReglages({ thematiques: t }); };

  const exporter = () => {
    const s: Sauvegarde = { version: 1, date: new Date().toISOString(), recettes, planning, reglages };
    const url = URL.createObjectURL(new Blob([JSON.stringify(s)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `recettes-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const restaurer = async (f?: File) => {
    if (!f) return;
    try {
      const s = JSON.parse(await f.text()) as Sauvegarde;
      if (s.version !== 1 || !Array.isArray(s.recettes)) throw new Error();
      if (!confirm(`Remplacer vos ${recettes.length} recettes et votre planning par cette sauvegarde (${s.recettes.length} recettes) ?`)) return;
      await importer(s); toast('Sauvegarde restaurée');
    } catch { toast('Ce fichier n’est pas une sauvegarde de l’appli'); }
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 16 }}>Réglages</h1>

      <div className="carte">
        <label className="champ" style={{ marginBottom: 0 }}><span>Nom de l’appli</span><input type="text" value={reglages.nomAppli} onChange={e => modifierReglages({ nomAppli: e.target.value })} /></label>
      </div>

      <div className="carte">
        <div className="portions" style={{ margin: 0, border: 0, padding: 0 }}><span>Portions par défaut</span><Compteur valeur={reglages.portionsParDefaut} onChange={v => modifierReglages({ portionsParDefaut: v })} libelle="Portions par défaut" /></div>
      </div>

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
        <p className="doux petit" style={{ marginTop: 0 }}>Les recettes sont enregistrées sur ce téléphone ({recettes.length} recettes, données {persist}). La sauvegarde en ligne automatique arrive avec la mise en ligne. En attendant, gardez une copie de temps en temps.</p>
        <div className="deux">
          <button className="btn" onClick={exporter}>Exporter</button>
          <label className="btn" style={{ position: 'relative' }}>Restaurer<input type="file" accept="application/json,.json" style={{ position: 'absolute', inset: 0, opacity: 0 }} onChange={e => restaurer(e.target.files?.[0])} /></label>
        </div>
        {persist === 'non protégées' && <button className="lien" onClick={async () => { const r = await demanderPersistance(); setPersist(r === 'accorde' ? 'protégées' : 'non protégées'); toast(r === 'accorde' ? 'Données protégées' : 'Android protégera les données une fois l’appli installée'); }}>Protéger les données</button>}
      </div>

      <p className="doux petit" style={{ textAlign: 'center' }}>Version 0.2 · phase 2 · DA provisoire</p>
    </div>
  );
}
