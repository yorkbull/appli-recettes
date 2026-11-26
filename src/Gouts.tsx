import { useState } from 'react';
import { nouvelId, useStore } from './store';
import { resumeGout, SUGGESTIONS_GOUTS } from './lib/gouts';
import { toast } from './ui';

// Réglages : qui ne mange pas quoi (allergies et « je n'aime pas »), à ajouter ou retirer
export default function Gouts() {
  const { reglages, modifierReglages } = useStore();
  const gouts = reglages.gouts ?? [];
  const personnes = [...new Set(gouts.map(g => g.personne))];
  const [personne, setPersonne] = useState(personnes[0] ?? '');
  const [mot, setMot] = useState('');
  const [sauf, setSauf] = useState('');
  const [allergie, setAllergie] = useState(false);

  const ajouter = () => {
    if (!personne.trim() || !mot.trim()) return;
    modifierReglages({ gouts: [...gouts, { id: nouvelId(), personne: personne.trim().replace(/^./, c => c.toUpperCase()), mot: mot.trim().toLowerCase(), sauf: sauf.trim().toLowerCase(), allergie }] });
    setMot(''); setSauf(''); setAllergie(false);
    toast('Ajouté : les recettes concernées sont signalées');
  };
  const retirer = (id: string) => modifierReglages({ gouts: gouts.filter(g => g.id !== id) });

  return (
    <div className="carte">
      <h2>Goûts et allergies</h2>
      <p className="doux petit" style={{ marginTop: 0 }}>Les recettes qui contiennent ces ingrédients sont signalées et passent en dernier dans les suggestions.</p>
      {personnes.map(p => (
        <div key={p} style={{ marginBottom: 8 }}>
          <b>{p}</b>
          {gouts.filter(g => g.personne === p).map(g => (
            <div key={g.id} className="ligne-reglage">
              <span style={{ flex: 1 }}>{g.allergie && <span className="etiquette" style={{ marginRight: 6 }}>Allergie</span>}{resumeGout(g)}</span>
              <button className="btn danger" aria-label={`Retirer ${g.mot} pour ${p}`} onClick={() => retirer(g.id)}>✕</button>
            </div>
          ))}
        </div>
      ))}
      <form onSubmit={e => { e.preventDefault(); ajouter(); }}>
        <div className="deux" style={{ marginBottom: 8 }}>
          <input type="text" placeholder="Qui ? (Marion…)" aria-label="Personne" list="gouts-personnes" value={personne} onChange={e => setPersonne(e.target.value)} />
          <input type="text" placeholder="Ingrédient" aria-label="Ingrédient à éviter" list="gouts-mots" value={mot} onChange={e => setMot(e.target.value)} />
        </div>
        <datalist id="gouts-personnes">{personnes.map(p => <option key={p} value={p} />)}</datalist>
        <datalist id="gouts-mots">{SUGGESTIONS_GOUTS.map(m => <option key={m} value={m} />)}</datalist>
        <input type="text" placeholder="Sauf… (facultatif, ex. : mozzarella)" aria-label="Exceptions" value={sauf} onChange={e => setSauf(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
        <div className="pastilles" role="group" aria-label="Type">
          <button type="button" className={'pastille' + (!allergie ? ' on' : '')} aria-pressed={!allergie} onClick={() => setAllergie(false)}>N’aime pas</button>
          <button type="button" className={'pastille' + (allergie ? ' on' : '')} aria-pressed={allergie} onClick={() => setAllergie(true)}>Allergie</button>
        </div>
        <button className="btn plein" type="submit" disabled={!personne.trim() || !mot.trim()}>Ajouter</button>
      </form>
    </div>
  );
}
