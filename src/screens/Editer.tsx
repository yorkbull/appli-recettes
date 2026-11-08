import { useState } from 'react';
import { nouvelId, useStore } from '../store';
import { MOMENTS, MOMENT_LABEL, type Moment, type Recette } from '../types';
import { compresserPhoto } from '../lib/photo';
import { lireTexteColle } from '../lib/texte-colle';
import { Compteur, Feuille, Icone, toast } from '../ui';

const lignes = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean);

export default function Editer({ id }: { id: string }) {
  const { parId, reglages, enregistrerRecette, modifierReglages } = useStore();
  const existante = id !== 'nouvelle' ? parId[id] : undefined;
  const partage = !existante ? JSON.parse(sessionStorage.getItem('partage') ?? 'null') as { lien: string; texte: string; titre: string } | null : null;

  const [titre, setTitre] = useState(existante?.titre ?? partage?.titre ?? '');
  const [photo, setPhoto] = useState(existante?.photo);
  const [portions, setPortions] = useState(existante?.portions ?? reglages.portionsParDefaut);
  const [prep, setPrep] = useState(existante?.preparationMin?.toString() ?? '');
  const [cuisson, setCuisson] = useState(existante?.cuissonMin?.toString() ?? '');
  const [themes, setThemes] = useState<string[]>(existante?.thematiques ?? []);
  const [moments, setMoments] = useState<Moment[]>(existante?.moments ?? []);
  const [ingredients, setIngredients] = useState(existante?.ingredients.join('\n') ?? '');
  const [etapes, setEtapes] = useState(existante?.etapes.join('\n\n') ?? '');
  const [lien, setLien] = useState(existante?.source?.url ?? partage?.lien ?? '');
  const [coller, setColler] = useState(false);
  const [texte, setTexte] = useState('');
  const [nouveauTheme, setNouveauTheme] = useState('');
  const [photoEnCours, setPhotoEnCours] = useState(false);

  const choisirPhoto = async (f?: File) => {
    if (!f) return;
    setPhotoEnCours(true);
    try { setPhoto(await compresserPhoto(f)); } catch { toast('Cette photo n’a pas pu être lue'); }
    setPhotoEnCours(false);
  };

  const appliquerTexte = () => {
    const r = lireTexteColle(texte);
    if (r.titre && !titre) setTitre(r.titre);
    if (r.portions) setPortions(r.portions);
    if (r.ingredients.length) setIngredients(r.ingredients.join('\n'));
    if (r.etapes.length) setEtapes(r.etapes.join('\n\n'));
    setColler(false);
    toast(`${r.ingredients.length} ingrédients et ${r.etapes.length} étapes repris : relisez avant d’enregistrer`);
  };

  const enregistrer = async () => {
    if (!titre.trim()) { toast('Donnez un nom à la recette'); return; }
    let url: string | undefined;
    try { url = lien.trim() ? new URL(lien.trim()).toString() : undefined; } catch { url = undefined; }
    const maintenant = new Date().toISOString();
    const r: Recette = {
      id: existante?.id ?? nouvelId(), titre: titre.trim(), photo, portions,
      preparationMin: Number(prep) || undefined, cuissonMin: Number(cuisson) || undefined,
      thematiques: themes, moments,
      ingredients: lignes(ingredients),
      etapes: etapes.split(/\n\s*\n|\n(?=\s*\d+[.)]\s)/).map(e => e.replace(/\s*\n\s*/g, ' ').replace(/^\d+[.)]\s+/, '').trim()).filter(Boolean),
      annotations: existante?.annotations ?? [], favori: existante?.favori ?? false,
      source: url ? { type: 'lien', url } : existante?.source ?? { type: 'manuel' },
      creeLe: existante?.creeLe ?? maintenant, modifieLe: maintenant,
    };
    await enregistrerRecette(r);
    sessionStorage.removeItem('partage');
    toast(existante ? 'Recette modifiée' : 'Recette ajoutée');
    location.replace(`#/recette/${r.id}`); // remplace l'écran d'édition : le retour ne rouvre pas le formulaire
  };

  const basc = <T,>(liste: T[], set: (x: T[]) => void, v: T) => set(liste.includes(v) ? liste.filter(x => x !== v) : [...liste, v]);

  return (
    <div className="page">
      <div className="page-tete">
        <button className="icone" aria-label="Annuler" onClick={() => history.back()}>{Icone.retour}</button>
        <h1 style={{ flex: 1 }}>{existante ? 'Modifier' : 'Nouvelle recette'}</h1>
      </div>

      {!existante && (
        <div className="carte">
          <p style={{ marginTop: 0 }}><b>Gagner du temps</b><br /><span className="doux petit">Copiez le texte d’une recette (site, message, note) et collez-le : l’appli remplit les champs.</span></p>
          <button className="btn plein" onClick={() => setColler(true)}>Coller le texte d’une recette</button>
          <p className="doux petit" style={{ marginBottom: 0 }}>L’import automatique depuis un lien ou une photo de livre arrive en phase 4.</p>
        </div>
      )}
      {partage?.lien && !existante && <p className="carte petit">Lien reçu : <a href={partage.lien} target="_blank" rel="noreferrer">{partage.lien}</a><br /><span className="doux">Ouvrez-le, copiez le texte de la recette et collez-le ci-dessus.</span></p>}

      <label className="champ"><span>Nom de la recette</span><input type="text" value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex. : Gratin dauphinois" /></label>

      <div className="champ">
        <span>Photo</span>
        <label className="photo-choix">
          {photo ? <img src={photo} alt="Photo de la recette" /> : <span>{photoEnCours ? 'Préparation de la photo…' : 'Prendre ou choisir une photo'}</span>}
          <input type="file" accept="image/*" onChange={e => choisirPhoto(e.target.files?.[0])} aria-label="Photo de la recette" />
        </label>
        {photo && <button className="lien" onClick={() => setPhoto(undefined)}>Retirer la photo</button>}
      </div>

      <div className="portions"><span>Portions</span><Compteur valeur={portions} onChange={setPortions} libelle="Portions" /></div>
      <div className="deux">
        <label className="champ"><span>Préparation (min)</span><input type="number" inputMode="numeric" min={0} value={prep} onChange={e => setPrep(e.target.value)} /></label>
        <label className="champ"><span>Cuisson (min)</span><input type="number" inputMode="numeric" min={0} value={cuisson} onChange={e => setCuisson(e.target.value)} /></label>
      </div>

      <div className="champ">
        <span>Thématiques</span>
        <div className="pastilles wrap">
          {reglages.thematiques.map(t => <button key={t} type="button" className={'pastille' + (themes.includes(t) ? ' on' : '')} aria-pressed={themes.includes(t)} onClick={() => basc(themes, setThemes, t)}>{t}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="text" placeholder="Nouvelle thématique" value={nouveauTheme} onChange={e => setNouveauTheme(e.target.value)} />
          <button className="btn" type="button" disabled={!nouveauTheme.trim()} onClick={() => {
            const t = nouveauTheme.trim(); if (!reglages.thematiques.includes(t)) modifierReglages({ thematiques: [...reglages.thematiques, t] });
            if (!themes.includes(t)) setThemes([...themes, t]); setNouveauTheme('');
          }}>Ajouter</button>
        </div>
      </div>

      <div className="champ">
        <span>Plutôt pour le…</span>
        <div className="pastilles wrap">{MOMENTS.map(m => <button key={m} type="button" className={'pastille' + (moments.includes(m) ? ' on' : '')} aria-pressed={moments.includes(m)} onClick={() => basc(moments, setMoments, m)}>{MOMENT_LABEL[m]}</button>)}</div>
        <small>Sert aux suggestions du planning. Rien de coché = tous les moments.</small>
      </div>

      <label className="champ"><span>Ingrédients</span><textarea value={ingredients} onChange={e => setIngredients(e.target.value)} placeholder={'Un ingrédient par ligne\n500 g de pâtes\n20 cl de crème\n1 oignon'} /><small>Un par ligne, quantité en premier : les quantités s’ajustent au nombre de portions.</small></label>
      <label className="champ"><span>Étapes</span><textarea style={{ minHeight: 200 }} value={etapes} onChange={e => setEtapes(e.target.value)} placeholder={'Laissez une ligne vide entre deux étapes.\n\nFaire revenir l’oignon 5 min.\n\nAjouter la crème…'} /><small>Une ligne vide entre deux étapes. Les durées (« 20 min ») deviennent des minuteurs en mode cuisine.</small></label>
      <label className="champ"><span>Lien d’origine (facultatif)</span><input type="url" inputMode="url" value={lien} onChange={e => setLien(e.target.value)} placeholder="https://" /></label>

      <button className="btn principal plein" onClick={enregistrer}>Enregistrer</button>

      {coller && (
        <Feuille titre="Coller une recette" sousTitre="Titre, « Ingrédients », puis « Préparation » : l’appli s’y retrouve aussi sans ces titres." onFermer={() => setColler(false)}>
          <textarea autoFocus style={{ minHeight: 240 }} value={texte} onChange={e => setTexte(e.target.value)} placeholder="Collez ici le texte de la recette" />
          <div className="deux" style={{ marginTop: 12 }}>
            <button className="btn" onClick={async () => { try { setTexte(await navigator.clipboard.readText()); } catch { toast('Appuyez longuement dans le champ puis « Coller »'); } }}>Coller</button>
            <button className="btn principal" disabled={!texte.trim()} onClick={appliquerTexte}>Remplir</button>
          </div>
        </Feuille>
      )}
    </div>
  );
}
