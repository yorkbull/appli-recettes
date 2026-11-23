import { useState } from 'react';
import { useStore } from './store';
import { Feuille } from './ui';
import { euros, parUnite, quantiteLisible, type Cout, type LignePrix } from './lib/prix';

// Saisie des prix relevés en magasin. Un prix vaut pour toutes les recettes qui utilisent le produit.
function LigneSaisie({ l }: { l: LignePrix }) {
  const { prix, modifierPrix } = useStore();
  const [texte, setTexte] = useState(prix[l.cle] != null ? String(prix[l.cle]).replace('.', ',') : '');
  const valider = (t: string) => {
    setTexte(t);
    const v = parseFloat(t.replace(',', '.').replace(/[^\d.]/g, ''));
    modifierPrix(l.cle, Number.isFinite(v) && v > 0 ? v : null);
  };
  return (
    <div className="ligne-prix">
      <div className="ligne-prix-nom">
        {l.nom}
        <small className="doux">{quantiteLisible(l.quantite, l.unite)}{l.montant != null ? ` · ${euros(l.montant)}` : ''}</small>
      </div>
      <label className="ligne-prix-champ">
        <input type="text" inputMode="decimal" placeholder="—" value={texte} aria-label={`Prix ${l.nom} en euros ${parUnite(l.unite)}`} onChange={e => valider(e.target.value)} />
        <span className="doux petit">€ {parUnite(l.unite)}</span>
      </label>
    </div>
  );
}

export function FeuillePrix({ cout, onFermer }: { cout: Cout; onFermer: () => void }) {
  return (
    <Feuille titre="Prix des produits" sousTitre="Prix payé en magasin, au kilo, au litre ou à la pièce. Il sert pour toutes les recettes." onFermer={onFermer}>
      {cout.lignes.map(l => <LigneSaisie key={l.cle} l={l} />)}
      {cout.nonComptes.length > 0 && <p className="doux petit">Non comptés (petites quantités) : {cout.nonComptes.join(', ')}.</p>}
      <p style={{ fontWeight: 600 }}>Total : {euros(cout.total)}{cout.sansPrix ? ` (${cout.sansPrix} sans prix)` : ''}</p>
      <button className="btn principal plein" onClick={onFermer}>Terminé</button>
    </Feuille>
  );
}

// Résumé du coût, avec le bouton qui ouvre la saisie des prix
export function ResumeCout({ cout, portions }: { cout: Cout; portions?: number }) {
  const [ouvert, setOuvert] = useState(false);
  if (!cout.lignes.length) return null;
  const complet = cout.sansPrix === 0;
  return (
    <>
      <div className="nutrition">
        {cout.total > 0 ? <>
          <strong style={{ color: 'var(--texte)' }}>{complet ? '' : 'Au moins '}{euros(cout.total)}</strong>
          {portions ? ` · ${euros(cout.total / portions)} la portion` : ''}
          {!complet && <><br /><span className="petit">{cout.sansPrix} produit{cout.sansPrix > 1 ? 's' : ''} sans prix</span></>}
        </> : 'Saisissez le prix des produits achetés pour connaître le coût.'}
      </div>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => setOuvert(true)}>Saisir les prix</button>
      {ouvert && <FeuillePrix cout={cout} onFermer={() => setOuvert(false)} />}
    </>
  );
}
