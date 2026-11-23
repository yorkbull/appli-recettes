import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { ajouterJours, aujourdhui, joursSemaine, lundi, titreSemaine } from '../lib/dates';
import { cleDe, lignesPrevues, listeCourses, rayonDe, RAYONS, texteCourses, type Article } from '../lib/courses';
import { cout } from '../lib/prix';
import { ResumeCout } from '../Prix';
import { Icone, toast } from '../ui';

// Liste de courses de la semaine, cochable, rangée par rayon, à copier ou partager vers une note
export default function Courses() {
  const { planning, parId, prix } = useStore();
  const auj = aujourdhui();
  const [debut, setDebut] = useState(() => lundi(auj));
  const cleCoches = `courses-coches-${debut}`;
  const [coches, setCoches] = useState<string[]>([]);
  useEffect(() => { setCoches(JSON.parse(localStorage.getItem(cleCoches) ?? '[]')); }, [cleCoches]);
  const basculer = (cle: string) => {
    const n = coches.includes(cle) ? coches.filter(c => c !== cle) : [...coches, cle];
    setCoches(n); localStorage.setItem(cleCoches, JSON.stringify(n));
  };

  // Articles ajoutés à la main (café, lessive…), gardés pour la semaine affichée
  const cleLibres = `courses-libres-${debut}`;
  const [libres, setLibres] = useState<string[]>([]);
  const [nouveau, setNouveau] = useState('');
  useEffect(() => { setLibres(JSON.parse(localStorage.getItem(cleLibres) ?? '[]')); }, [cleLibres]);
  const changerLibres = (n: string[]) => { setLibres(n); localStorage.setItem(cleLibres, JSON.stringify(n)); };
  const ajouterLibre = () => {
    const nom = nouveau.trim().replace(/^./, c => c.toUpperCase());
    if (!nom) return;
    if (!libres.some(l => cleDe(l) === cleDe(nom))) changerLibres([...libres, nom]);
    setNouveau('');
  };

  const prevus = useMemo(() => listeCourses(joursSemaine(debut), planning, parId), [debut, planning, parId]);
  const recettes = prevus.recettes;
  const articles: Article[] = useMemo(() => [
    ...prevus.articles,
    ...libres.map(nom => ({ cle: 'libre:' + cleDe(nom), nom, quantite: '', rayon: rayonDe(nom), libre: true })),
  ].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), [prevus, libres]);
  const coutSemaine = useMemo(() => cout(lignesPrevues(joursSemaine(debut), planning, parId), prix), [debut, planning, parId, prix]);
  const aAcheter = articles.filter(a => !coches.includes(a.cle));
  const titre = `Courses ${titreSemaine(debut)}`;
  const texte = () => texteCourses(titre, aAcheter);

  const copier = async () => {
    try { await navigator.clipboard.writeText(texte()); toast('Liste copiée : collez-la dans Samsung Notes'); }
    catch { toast('Copie impossible sur ce téléphone, utilisez « Partager »'); }
  };
  const partager = async () => {
    if (!navigator.share) { copier(); return; }
    try { await navigator.share({ title: titre, text: texte() }); } catch { /* partage annulé */ }
  };

  return (
    <div className="page">
      <div className="nav-semaine">
        <button className="icone" aria-label="Semaine précédente" onClick={() => setDebut(ajouterJours(debut, -7))}>{Icone.retour}</button>
        <div className="titre">
          <h1>Courses</h1>
          <small>{titreSemaine(debut)}</small>
        </div>
        <button className="icone" aria-label="Semaine suivante" onClick={() => setDebut(ajouterJours(debut, 7))}>{Icone.avant}</button>
      </div>

      {!recettes.length && (
        <div className="vide-etat" style={{ paddingTop: 8, paddingBottom: 8 }}>
          <p>Aucun repas avec une recette n’est prévu cette semaine.</p>
          <a className="btn" href="#/semaine">Planifier la semaine</a>
        </div>
      )}

      <form className="ligne-reglage" style={{ borderBottom: 0, marginBottom: 8 }} onSubmit={e => { e.preventDefault(); ajouterLibre(); }}>
        <input type="text" placeholder="Ajouter un article (café, lessive…)" aria-label="Ajouter un article à la liste" value={nouveau} onChange={e => setNouveau(e.target.value)} />
        <button className="btn" type="submit" disabled={!nouveau.trim()}>Ajouter</button>
      </form>

      {articles.length > 0 && <>
        <p className="doux petit" style={{ marginTop: 0 }}>
          {recettes.length > 0 && <>Pour {recettes.length} recette{recettes.length > 1 ? 's' : ''} : {recettes.join(', ')}. </>}Cochez ce que vous avez déjà ou ce qui est acheté.
        </p>
        <div className="deux" style={{ marginBottom: 6 }}>
          <button className="btn principal" disabled={!aAcheter.length} onClick={partager}>Partager</button>
          <button className="btn" disabled={!aAcheter.length} onClick={copier}>Copier la liste</button>
        </div>
        <p className="doux petit" style={{ marginTop: 0, textAlign: 'center' }}>
          {aAcheter.length} article{aAcheter.length > 1 ? 's' : ''} à acheter · les articles cochés ne sont pas exportés
        </p>

        {RAYONS.map(({ id, titre: t }) => {
          const liste = articles.filter(a => a.rayon === id);
          if (!liste.length) return null;
          return (
            <section key={id} className="carte rayon">
              <h2>{t} <span className="doux petit">{liste.filter(a => !coches.includes(a.cle)).length}/{liste.length}</span></h2>
              {liste.map(a => (
                <label key={a.cle} className={'article' + (coches.includes(a.cle) ? ' coche' : '')}>
                  <input type="checkbox" checked={coches.includes(a.cle)} onChange={() => basculer(a.cle)} />
                  <span className="article-nom">{a.nom}</span>
                  {a.quantite && <span className="article-qte">{a.quantite}</span>}
                  {a.libre && <button type="button" className="corbeille" aria-label={`Retirer ${a.nom} de la liste`}
                    onClick={e => { e.preventDefault(); changerLibres(libres.filter(l => 'libre:' + cleDe(l) !== a.cle)); }}>{Icone.corbeille}</button>}
                </label>
              ))}
            </section>
          );
        })}
        {coches.length > 0 && <button className="lien" onClick={() => { setCoches([]); localStorage.removeItem(cleCoches); }}>Tout décocher</button>}

        {recettes.length > 0 && (
          <section className="carte">
            <h2>Coût estimé de la semaine</h2>
            <ResumeCout cout={coutSemaine} />
          </section>
        )}
      </>}
    </div>
  );
}
