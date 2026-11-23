// Coût des recettes : prix relevés en magasin (au kilo, au litre ou à la pièce),
// partagés entre toutes les recettes, puis appliqués aux quantités des ingrédients.
import type { Prix } from '../types';
import { cleDe, lireLigne } from './courses';
import { formater } from './quantites';

export interface LignePrix {
  cle: string;          // produit + unité : « farine|g », « oeuf| », « gousse d ail|gousse »
  nom: string;
  unite: string;        // 'g', 'ml', '' (pièce) ou unité comptée (gousse, tranche…)
  quantite: number;     // en g, ml ou pièces
  montant: number | null; // null tant que le prix n'est pas saisi
}

export interface Cout { lignes: LignePrix[]; total: number; sansPrix: number; nonComptes: string[] }

export const clePrix = (nom: string, unite: string) => `${cleDe(nom)}|${unite}`;

// Libellé de l'unité de prix : « le kg », « le litre », « la pièce », « / gousse »
export const parUnite = (unite: string) =>
  unite === 'g' ? 'le kg' : unite === 'ml' ? 'le litre' : !unite ? 'la pièce' : `/ ${unite}`;

// Le prix est saisi au kilo ou au litre, les quantités sont en grammes ou millilitres
const quantiteFacturee = (q: number, unite: string) => unite === 'g' || unite === 'ml' ? q / 1000 : q;

export const euros = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

export function cout(lignes: { ligne: string; facteur: number }[], prix: Prix): Cout {
  const parCle = new Map<string, LignePrix>();
  const nonComptes = new Set<string>();
  for (const { ligne, facteur } of lignes) for (const a of lireLigne(ligne, facteur)) {
    // sel, poivre, « 1 c. à soupe d'huile » : quantités trop petites pour compter
    if (a.valeur == null || a.unite.startsWith('c. à')) { if (cleDe(a.nom)) nonComptes.add(a.nom); continue; }
    const cle = clePrix(a.nom, a.unite);
    const e = parCle.get(cle) ?? { cle, nom: a.nom.charAt(0).toUpperCase() + a.nom.slice(1), unite: a.unite, quantite: 0, montant: null };
    e.quantite += a.valeur;
    parCle.set(cle, e);
  }
  const res = [...parCle.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  let total = 0, sansPrix = 0;
  for (const l of res) {
    const p = prix[l.cle];
    if (p == null) { sansPrix++; continue; }
    l.montant = quantiteFacturee(l.quantite, l.unite) * p;
    total += l.montant;
  }
  return { lignes: res, total, sansPrix, nonComptes: [...nonComptes] };
}

export function quantiteLisible(q: number, unite: string) {
  if (unite === 'g') return q >= 1000 ? `${formater(q / 1000)} kg` : `${formater(q)} g`;
  if (unite === 'ml') return q >= 1000 ? `${formater(q / 1000)} l` : `${formater(q)} ml`;
  const pluriel = q > 1 && !/[sx]$/.test(unite) ? (unite.endsWith('eau') ? 'x' : 's') : '';
  return unite ? `${formater(q)} ${unite}${pluriel}` : formater(q);
}
