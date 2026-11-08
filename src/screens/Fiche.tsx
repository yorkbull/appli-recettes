import { useState } from 'react';
import { nouvelId, useStore } from '../store';
import { ajusterLigne, duree } from '../lib/quantites';
import { Compteur, Icone, toast } from '../ui';
import { aller } from '../App';

export default function Fiche({ id }: { id: string }) {
  const { parId, enregistrerRecette, supprimerRecette } = useStore();
  const r = parId[id];
  const depart = Number(new URLSearchParams(location.hash.split('?')[1] ?? '').get('portions')) || r?.portions || 1;
  const [portions, setPortions] = useState(depart);
  const [note, setNote] = useState('');
  if (!r) return <div className="page"><p>Cette recette n’existe plus.</p><a className="btn" href="#/recettes">Mes recettes</a></div>;
  const facteur = portions / (r.portions || 1);

  const ajouterNote = async () => {
    if (!note.trim()) return;
    await enregistrerRecette({ ...r, annotations: [...r.annotations, { id: nouvelId(), date: new Date().toISOString(), texte: note.trim() }] });
    setNote('');
    toast('Annotation ajoutée');
  };

  return (
    <article className="page fiche">
      <div className="page-tete">
        <button className="icone" aria-label="Retour" onClick={() => history.length > 1 ? history.back() : aller('/recettes')}>{Icone.retour}</button>
        <button className="icone" aria-label={r.favori ? 'Retirer des favoris' : 'Ajouter aux favoris'} aria-pressed={r.favori}
          style={{ color: r.favori ? 'var(--accent)' : undefined }} onClick={() => enregistrerRecette({ ...r, favori: !r.favori })}>{r.favori ? Icone.coeurPlein : Icone.coeur}</button>
      </div>
      {r.photo && <img className="fiche-photo" src={r.photo} alt="" />}
      <h1>{r.titre}</h1>
      <div className="infos">
        {r.preparationMin ? <span>Préparation {duree(r.preparationMin)}</span> : null}
        {r.cuissonMin ? <span>Cuisson {duree(r.cuissonMin)}</span> : null}
        {r.thematiques.map(t => <span key={t} className="etiquette">{t}</span>)}
      </div>

      <div className="portions"><span>Portions</span><Compteur valeur={portions} onChange={setPortions} libelle="Portions" /></div>

      <div className="actions-fiche">
        <a className="btn principal" href={`#/cuisine/${r.id}?portions=${portions}`}>Mode cuisine</a>
        <a className="btn" href={`#/editer/${r.id}`}>Modifier</a>
      </div>

      <section className="section">
        <h2>Ingrédients</h2>
        <ul className="ingredients">{r.ingredients.map((l, i) => <li key={i}>{ajusterLigne(l, facteur)}</li>)}</ul>
        {facteur !== 1 && <p className="doux petit">Quantités calculées pour {portions} portions (recette prévue pour {r.portions}).</p>}
      </section>

      <section className="section">
        <h2>Préparation</h2>
        <ol className="etapes">{r.etapes.map((e, i) => <li key={i}>{e}</li>)}</ol>
      </section>

      <section className="section">
        <h2>Annotations</h2>
        {r.annotations.map(a => (
          <div key={a.id} className="annotation">
            <div>{a.texte}<small>{new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</small></div>
            <button className="icone" style={{ width: 36, height: 36 }} aria-label="Supprimer l’annotation"
              onClick={() => confirm('Supprimer cette annotation ?') && enregistrerRecette({ ...r, annotations: r.annotations.filter(x => x.id !== a.id) })}>{Icone.fermer}</button>
          </div>
        ))}
        <label className="champ" style={{ marginTop: 8 }}>
          <span className="visually-hidden">Nouvelle annotation</span>
          <textarea style={{ minHeight: 80 }} placeholder="Ex. : moins de sel, doubler la sauce…" value={note} onChange={e => setNote(e.target.value)} />
        </label>
        <button className="btn" onClick={ajouterNote} disabled={!note.trim()}>Ajouter l’annotation</button>
      </section>

      {r.source?.url && <p className="petit doux">Source : <a href={r.source.url} target="_blank" rel="noreferrer">{new URL(r.source.url).hostname}</a></p>}

      <section className="section">
        <h2>Calories et nutriments</h2>
        <div className="nutrition">Le calcul des calories et des nutriments par portion arrive avec la phase 3 (base Ciqual).</div>
      </section>

      <button className="btn danger plein" onClick={async () => { if (confirm(`Supprimer « ${r.titre} » ? Elle sera aussi retirée du planning.`)) { await supprimerRecette(r.id); toast('Recette supprimée'); aller('/recettes'); } }}>Supprimer la recette</button>
    </article>
  );
}
