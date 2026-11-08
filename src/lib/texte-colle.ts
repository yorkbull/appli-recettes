// Découpe un texte de recette collé (depuis un site, un message, une note) en titre, portions, ingrédients et étapes.
export interface RecetteLue { titre: string | null; portions: number | null; ingredients: string[]; etapes: string[] }

export function lireTexteColle(texte: string): RecetteLue {
  const lignes = texte.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const estIng = (l: string) => /^ingr[ée]dients?\b/i.test(l);
  const estEtapes = (l: string) => /^(pr[ée]paration|instructions?|[ée]tapes|d[ée]roul[ée])\b/i.test(l);
  let titre: string | null = null, mode: 'i' | 'e' | null = null, portions: number | null = null;
  const ingredients: string[] = [], etapes: string[] = [];
  for (const l of lignes) {
    const p = l.match(/(?:pour|portions?\s*:?)\s*(\d+)\s*(?:personnes?|pers\.?|parts?|portions?)?/i);
    if (p && !portions && (estIng(l) || /personne|pers\.|parts|portion/i.test(l))) portions = +p[1];
    if (estIng(l)) { mode = 'i'; continue; }
    if (estEtapes(l)) { mode = 'e'; continue; }
    if (!mode) { if (!titre && l.length < 90 && !p) titre = l; continue; }
    const propre = l.replace(/^[-•*·]\s*/, '').replace(/^(?:[ée]tape\s*)?\d+\s*[.):-]\s+/i, '');
    (mode === 'i' ? ingredients : etapes).push(propre);
  }
  if (!ingredients.length && !etapes.length) {
    for (const l of lignes.slice(1)) {
      if (/personne|pers\.|parts|portion/i.test(l) && l.length < 40) continue;
      (/^[-•*]?\s*(\d|½|¼|une?\s|quelques)/i.test(l) && l.length < 80 ? ingredients : etapes).push(l.replace(/^[-•*]\s*/, ''));
    }
  }
  return { titre: titre ?? lignes[0] ?? null, portions, ingredients, etapes };
}
