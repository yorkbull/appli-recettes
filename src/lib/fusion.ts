// Fusion d'une sauvegarde reçue (envoyée par une autre personne) avec les données de ce téléphone, sans doublons :
// - recettes : même identifiant -> on garde la plus récemment modifiée ; même titre -> on garde celle d'ici
// - planning : les repas déjà prévus ici sont gardés, les cases vides sont complétées
// - prix : ceux d'ici sont gardés, les nouveaux produits sont ajoutés
// - thématiques : réunies ; les autres réglages restent ceux d'ici
import type { Sauvegarde } from '../db';
import type { Case, Moment, Planning, Recette } from '../types';

const titreCle = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export interface Bilan { ajoutees: number; misesAJour: number; repas: number; prix: number }

export function fusionner(ici: Sauvegarde, recu: Sauvegarde): { s: Sauvegarde; bilan: Bilan } {
  const parId = new Map(ici.recettes.map(r => [r.id, r]));
  const parTitre = new Map(ici.recettes.map(r => [titreCle(r.titre), r.id]));
  const renommer = new Map<string, string>(); // id reçu -> id d'ici (même recette sous un autre identifiant)
  const bilan: Bilan = { ajoutees: 0, misesAJour: 0, repas: 0, prix: 0 };

  for (const r of recu.recettes) {
    const meme = parId.get(r.id);
    if (meme) {
      if (r.modifieLe > meme.modifieLe) { parId.set(r.id, r); bilan.misesAJour++; }
      continue;
    }
    const idTitre = parTitre.get(titreCle(r.titre));
    if (idTitre) { renommer.set(r.id, idTitre); continue; }
    parId.set(r.id, r); parTitre.set(titreCle(r.titre), r.id); bilan.ajoutees++;
  }
  const recettes: Recette[] = [...parId.values()];

  const planning: Planning = { ...ici.planning };
  for (const [d, jour] of Object.entries(recu.planning ?? {})) {
    const n = { ...(planning[d] ?? {}) };
    for (const [m, c] of Object.entries(jour) as [Moment, Case][]) {
      if (!c || n[m]) continue;
      const cc = c.pour ? { ...c, pour: c.pour.map(p => ({ ...p, recetteId: renommer.get(p.recetteId) ?? p.recetteId })) } : c;
      n[m] = 'recetteId' in cc ? { ...cc, recetteId: renommer.get(cc.recetteId) ?? cc.recetteId } : cc;
      bilan.repas++;
    }
    if (Object.keys(n).length) planning[d] = n;
  }

  const prix = { ...(ici.prix ?? {}) };
  for (const [k, v] of Object.entries(recu.prix ?? {})) if (prix[k] == null) { prix[k] = v; bilan.prix++; }

  const thematiques = [...ici.reglages.thematiques];
  for (const t of recu.reglages?.thematiques ?? []) if (!thematiques.includes(t)) thematiques.push(t);

  const cleGout = (g: { personne: string; mot: string }) => titreCle(g.personne + '|' + g.mot);
  const gouts = [...(ici.reglages.gouts ?? [])];
  for (const g of recu.reglages?.gouts ?? []) if (!gouts.some(x => cleGout(x) === cleGout(g))) gouts.push(g);
  const frigo = [...(ici.reglages.frigo ?? [])];
  for (const f of recu.reglages?.frigo ?? []) if (!frigo.some(x => titreCle(x) === titreCle(f))) frigo.push(f);

  return { s: { version: 1, date: new Date().toISOString(), recettes, planning, reglages: { ...ici.reglages, thematiques, gouts, frigo }, prix }, bilan };
}
