import { useEffect, useRef, useState } from 'react';
import { nouvelId, useStore } from '../store';
import { MOMENTS, MOMENT_LABEL, type Moment, type Recette } from '../types';
import { compresserPhoto } from '../lib/photo';
import { lireTexteColle } from '../lib/texte-colle';
import { lirePhoto as lireTexteImagePara } from '../lib/ocr';
import { analyser, assembler, ROLES, type Bloc, type Infos } from '../lib/fiche-photo';
import { lireLien } from '../lib/lien';
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
  const [lecture, setLecture] = useState<number | null>(null); // avancement de la lecture du texte (0 à 1)
  const originale = useRef<File | null>(null); // photo d'origine, meilleure que la version compressée pour lire le texte

  const choisirPhoto = async (f?: File) => {
    if (!f) return;
    originale.current = f;
    setPhotoEnCours(true);
    try { setPhoto(await compresserPhoto(f)); } catch { toast('Cette photo n’a pas pu être lue'); }
    setPhotoEnCours(false);
  };

  // Lit la photo, découpe le texte en blocs (titre, ingrédients, étapes…) et ouvre le tri pour vérification.
  // Plusieurs photos s'ajoutent (recette sur deux pages).
  const [tri, setTri] = useState<{ blocs: Bloc[]; infos: Infos } | null>(null);
  const lirePhoto = async (f?: Blob | null) => {
    if (!f || lecture !== null) return;
    setLecture(0);
    try {
      const paragraphes = await lireTexteImagePara(f, setLecture);
      const depart = tri ? Math.max(0, ...tri.blocs.map(b => b.id)) + 1 : 0;
      const r = analyser(paragraphes, depart);
      if (!r.blocs.length) toast('Aucun texte lisible sur cette photo : photographiez la page bien à plat, nette et éclairée');
      else setTri(t => t ? { blocs: [...t.blocs, ...r.blocs], infos: { ...r.infos, ...t.infos } } : r);
    } catch {
      toast(navigator.onLine ? 'La lecture de la photo a échoué' : 'La première lecture de photo demande une connexion internet');
    }
    setLecture(null);
  };
  const enLecture = lecture !== null ? `Lecture du texte… ${Math.round(lecture * 100)} %` : null;

  const appliquerTri = () => {
    if (!tri) return;
    const r = assembler(tri.blocs);
    if (r.titre) setTitre(r.titre);
    if (tri.infos.portions) setPortions(tri.infos.portions);
    if (tri.infos.preparationMin) setPrep(String(tri.infos.preparationMin));
    if (tri.infos.cuissonMin) setCuisson(String(tri.infos.cuissonMin));
    if (r.ingredients.length) setIngredients(r.ingredients.join('\n'));
    if (r.etapes.length) setEtapes(r.etapes.join('\n\n'));
    setTri(null);
    toast(`${r.ingredients.length} ingrédients et ${r.etapes.length} étapes repris : relisez avant d’enregistrer`);
  };

  // Import depuis un lien : on remplit tous les champs avec ce que le site décrit
  const [adresse, setAdresse] = useState(partage?.lien ?? '');
  const [importEnCours, setImportEnCours] = useState(false);
  const importer = async (u = adresse) => {
    let url: string;
    try { url = new URL(u.trim()).toString(); } catch { toast('Collez l’adresse complète de la page (https://…)'); return; }
    setImportEnCours(true);
    try {
      const r = await lireLien(url);
      if (r.titre) setTitre(r.titre);
      if (r.portions) setPortions(r.portions);
      setPrep(r.preparationMin ? String(r.preparationMin) : '');
      setCuisson(r.cuissonMin ? String(r.cuissonMin) : '');
      setIngredients(r.ingredients.join('\n'));
      setEtapes(r.etapes.join('\n\n'));
      setLien(url);
      // thématiques et moments déduits des catégories du site, quand elles correspondent
      const cats = r.categories.map(c => c.toLowerCase());
      const t = reglages.thematiques.filter(th => cats.some(c => c.includes(th.toLowerCase())) || (th === 'Végétarien' && cats.some(c => c.includes('végé'))));
      if (t.length) setThemes(x => [...new Set([...x, ...t])]);
      if (cats.some(c => /petit[- ]d[ée]jeuner|brunch/.test(c))) setMoments(m => m.length ? m : ['matin']);
      if (r.photo) {
        try {
          const img = await fetch(`https://wsrv.nl/?url=${encodeURIComponent(r.photo)}&w=1200&output=jpg`);
          if (img.ok) setPhoto(await compresserPhoto(await img.blob()));
        } catch { /* recette importée sans photo */ }
      }
      toast(`Recette importée : ${r.ingredients.length} ingrédients, ${r.etapes.length} étapes. Relisez avant d’enregistrer`);
    } catch (e) {
      toast(!navigator.onLine ? 'Pas de connexion internet'
        : (e as Error).message === 'pas de recette' ? 'Pas de recette reconnue sur cette page : copiez son texte et utilisez « Coller »'
        : 'La page n’a pas pu être lue, réessayez dans un instant');
    }
    setImportEnCours(false);
  };
  // lien reçu par « Partager » depuis Chrome : import automatique
  const dejaImporte = useRef(false);
  useEffect(() => {
    if (partage?.lien && !dejaImporte.current) { dejaImporte.current = true; importer(partage.lien); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          <p style={{ marginTop: 0 }}><b>Gagner du temps</b><br /><span className="doux petit">Donnez le lien d’une recette, photographiez-la (livre, fiche) ou collez son texte : l’appli remplit la fiche.</span></p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input type="url" inputMode="url" placeholder="Lien de la recette (https://…)" value={adresse} onChange={e => setAdresse(e.target.value)} aria-label="Lien de la recette" />
            <button className="btn principal" disabled={!adresse.trim() || importEnCours} onClick={() => importer()}>{importEnCours ? '…' : 'Importer'}</button>
          </div>
          {importEnCours && <p className="doux petit" role="status" style={{ marginTop: 0 }}>Lecture de la page…</p>}
          <label className="btn plein" style={{ position: 'relative', marginBottom: 8 }} aria-busy={lecture !== null}>
            {enLecture ?? 'Lire une recette sur une photo'}
            <input type="file" accept="image/*" disabled={lecture !== null} style={{ position: 'absolute', inset: 0, opacity: 0 }} aria-label="Lire une recette sur une photo"
              onChange={e => { lirePhoto(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <button className="btn plein" onClick={() => setColler(true)}>Coller le texte d’une recette</button>
          <p className="doux petit" style={{ marginBottom: 0 }}>Photo : page bien à plat, prise de face, nette et éclairée, sans ombre ; une photo par page si la recette en a deux. La première fois, l’appli télécharge le lecteur de texte (quelques Mo).</p>
        </div>
      )}

      <label className="champ"><span>Nom de la recette</span><input type="text" value={titre} onChange={e => setTitre(e.target.value)} placeholder="Ex. : Gratin dauphinois" /></label>

      <div className="champ">
        <span>Photo</span>
        <label className="photo-choix">
          {photo ? <img src={photo} alt="Photo de la recette" /> : <span>{photoEnCours ? 'Préparation de la photo…' : 'Prendre ou choisir une photo'}</span>}
          <input type="file" accept="image/*" onChange={e => choisirPhoto(e.target.files?.[0])} aria-label="Photo de la recette" />
        </label>
        {photo && <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <button className="lien" disabled={lecture !== null} onClick={async () => lirePhoto(originale.current ?? await (await fetch(photo)).blob())}>{enLecture ?? 'Lire le texte de cette photo'}</button>
          <button className="lien" onClick={() => { setPhoto(undefined); originale.current = null; }}>Retirer la photo</button>
        </div>}
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

      {tri && (
        <Feuille titre="Texte lu sur la photo" sousTitre="Vérifiez à quoi sert chaque bloc, puis remplissez la fiche." onFermer={() => setTri(null)}>
          {(tri.infos.portions || tri.infos.preparationMin || tri.infos.cuissonMin) && (
            <p className="petit" style={{ marginTop: 0 }}>
              {[tri.infos.portions && `${tri.infos.portions} personnes`, tri.infos.preparationMin && `préparation ${tri.infos.preparationMin} min`, tri.infos.cuissonMin && `cuisson ${tri.infos.cuissonMin} min`].filter(Boolean).join(' · ')}
            </p>
          )}
          {tri.blocs.map(b => (
            <div key={b.id} className={'bloc-lu' + (b.role === 'ignorer' ? ' ignore' : '')}>
              <p className="bloc-texte">{b.lignes.join('\n')}</p>
              <div className="pastilles wrap" role="radiogroup" aria-label="Ce bloc est">
                {ROLES.map(r => (
                  <button key={r.id} type="button" role="radio" aria-checked={b.role === r.id} className={'pastille petite' + (b.role === r.id ? ' on' : '')}
                    onClick={() => setTri(t => t && { ...t, blocs: t.blocs.map(x => x.id === b.id ? { ...x, role: r.id } : x) })}>{r.libelle}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="deux" style={{ marginTop: 12, position: 'sticky', bottom: 0, background: 'var(--surface)', paddingTop: 8 }}>
            <label className="btn" style={{ position: 'relative' }} aria-busy={lecture !== null}>
              {enLecture ?? 'Ajouter une page'}
              <input type="file" accept="image/*" disabled={lecture !== null} style={{ position: 'absolute', inset: 0, opacity: 0 }} aria-label="Ajouter une page"
                onChange={e => { lirePhoto(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <button className="btn principal" onClick={appliquerTri}>Remplir la fiche</button>
          </div>
        </Feuille>
      )}

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
