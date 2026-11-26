// Frigo et placard : produits déjà à la maison.
// Ils sortent de la liste de courses, et « Avec ce que j'ai » classe les recettes selon ce qu'il manque.
import type { Recette } from '../types';
import { cleDe, lireLigne } from './courses';
import { trouverAliment } from './nutrition';

// Même produit ? « emmental râpé » = « emmental », « pommes de terre » = « pomme de terre », mais « lait de coco » ≠ « lait »
export function memeProduit(a: string, b: string): boolean {
  if (cleDe(a) === cleDe(b)) return true;
  const x = trouverAliment(a), y = trouverAliment(b);
  return !!x && x === y;
}

export const aLaMaison = (nom: string, frigo: string[]) => frigo.some(f => memeProduit(nom, f));

// Sel, poivre, épices, eau : toujours là, on ne les compte pas
const toujoursLa = (nom: string) => { const a = trouverAliment(nom); return !!a && a.kcal === 0; };

// Ingrédients qui manquent pour faire la recette
export function manquants(r: Recette, frigo: string[]): string[] {
  const out: string[] = [];
  for (const l of r.ingredients) for (const a of lireLigne(l, 1)) {
    const nom = a.nom.trim();
    if (!nom || toujoursLa(nom) || aLaMaison(nom, frigo)) continue;
    if (!out.some(x => memeProduit(x, nom))) out.push(nom);
  }
  return out;
}
