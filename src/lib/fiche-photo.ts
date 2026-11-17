// Range le texte lu sur une photo de recette dans les champs de la fiche.
// Une recette imprimée suit presque toujours le même plan :
//   - le titre, en gros caractères, en haut ;
//   - des infos pratiques : « Pour 4 personnes », « Préparation : 20 min », « Cuisson : 45 min » ;
//   - la liste des ingrédients (souvent sous un titre « Ingrédients ») : lignes courtes qui commencent par une quantité ;
//   - les étapes (sous « Préparation », « Réalisation »…) : phrases longues, souvent numérotées ;
//   - parfois une introduction, une astuce, un accord vin, un numéro de page : à ignorer.
// Chaque bloc de texte reçoit un rôle proposé, que l'on peut corriger avant de remplir la fiche.
import type { Paragraphe } from './ocr';
import { lireQuantite, minuteurs } from './quantites';

export type Role = 'titre' | 'ingredients' | 'etapes' | 'ignorer';
export const ROLES: { id: Role; libelle: string }[] = [
  { id: 'titre', libelle: 'Titre' }, { id: 'ingredients', libelle: 'Ingrédients' }, { id: 'etapes', libelle: 'Étapes' }, { id: 'ignorer', libelle: 'Ignorer' },
];

export interface Bloc { id: number; lignes: string[]; role: Role; hauteur: number }
export interface Infos { portions?: number; preparationMin?: number; cuissonMin?: number }

const TITRE_ING = /^ingr[ée]dients?\b\s*:?/i;
const TITRE_ETAPES = /^(pr[ée]paration|r[ée]alisation|instructions?|[ée]tapes|la recette|d[ée]roulement|recette|progression)\s*:?\s*$/i;
const A_IGNORER = /^(astuce|conseil|le conseil|notre conseil|variante|le petit plus|accord|vin conseill|bon app[ée]tit|difficult[ée]|co[uû]t|niveau)\b/i;
const PORTIONS = /(?:pour\s+(\d{1,2})\s*(?:pers|personnes?|parts?|portions?|convives?)?)|(\d{1,2})\s*(?:pers\b|pers\.|personnes?|parts|portions)/i;
const TEMPS = /(pr[ée]paration|pr[ée]p\.?|cuisson|repos|temps total)\s*:?\s*(.*\d.*)/i;

// Repère et retire les infos pratiques (portions, temps) d'une ligne
function lireInfos(l: string, infos: Infos): boolean {
  let trouve = false;
  // une même ligne peut tout donner : « Pour 6 personnes  Préparation : 30 min  Cuisson : 2 h »
  for (const morceau of l.split(/(?=(?:pr[ée]paration|pr[ée]p\.|cuisson|repos|temps total)\s*:?\s*\d)/i)) {
    const t = morceau.match(TEMPS);
    if (!t) continue;
    const min = minuteurs(t[2]).reduce((s, m) => s + m.secondes / 60, 0) || (+(t[2].match(/^\s*(\d+)/)?.[1] ?? 0));
    if (!min) continue;
    if (/cuisson/i.test(t[1])) infos.cuissonMin ??= min;
    else if (/pr[ée]p/i.test(t[1])) infos.preparationMin ??= min;
    trouve = true;
  }
  const p = l.match(PORTIONS);
  if (p && (trouve || l.length < 60)) { infos.portions ??= +(p[1] ?? p[2]); trouve = true; }
  return trouve && l.length < 100;
}

// Lettres mal lues en début de ligne : puces « • » lues « e », « ° », « » »…
const sansPuce = (l: string) => l.replace(/^[-–—•*·°»«>~+]\s*/, '').replace(/^[eo©®]\s+(?=\d)/, '').trim();
const estQuantite = (l: string) => !!lireQuantite(sansPuce(l)) || /^[-–•*·°»]/.test(l);

function noter(lignes: string[]) {
  const n = lignes.length || 1;
  const quant = lignes.filter(estQuantite).length / n;
  const courtes = lignes.filter(l => l.length <= 45 && !/[.!]$/.test(l)).length / n;
  const moyenne = lignes.reduce((s, l) => s + l.length, 0) / n;
  const phrases = lignes.filter(l => /[.!]$/.test(l) || /^\d{1,2}\s*[.)]\s/.test(l)).length / n;
  return { quant, courtes, moyenne, phrases };
}

export function analyser(paragraphes: Paragraphe[], depart = 0): { blocs: Bloc[]; infos: Infos } {
  const infos: Infos = {};
  const blocs: Bloc[] = [];
  let id = depart, courant: Role | null = null;
  const hauteurs = paragraphes.map(p => p.hauteur).sort((a, b) => a - b);
  const mediane = hauteurs[Math.floor(hauteurs.length / 2)] ?? 0;
  // Page avec des intertitres (« Ingrédients », « Préparation ») : le texte placé avant eux est une introduction
  const avecIntertitres = paragraphes.some(p => p.lignes.some(l => (TITRE_ING.test(l) && l.length < 30) || TITRE_ETAPES.test(l)));

  let groupe = -1, utile: Role | null = null;
  for (const p of paragraphes) {
    // un encadré ignoré (astuce…) s'arrête à la fin de sa colonne
    if (p.groupe !== groupe) { groupe = p.groupe; if (courant === 'ignorer') courant = utile; }
    if (courant === 'ingredients' || courant === 'etapes') utile = courant;
    // un paragraphe peut contenir un intertitre (« Ingrédients ») suivi de sa liste : on le coupe là
    let seg: string[] = [], force: Role | null = null;
    const pousser = () => {
      if (!seg.length) return;
      blocs.push({ id: id++, lignes: seg, role: force ?? deviner(seg), hauteur: p.hauteur });
      seg = [];
    };
    const deviner = (lignes: string[]): Role => {
      const s = noter(lignes);
      const texte = lignes.join(' ');
      if (A_IGNORER.test(lignes[0]) || /^\s*[\d\s/|-]{1,7}\s*$/.test(texte)) return 'ignorer'; // astuce, numéro de page
      if (courant === 'ignorer') return 'ignorer';
      if (avecIntertitres && courant === null) return s.quant >= 0.6 && lignes.length >= 3 ? 'ingredients' : 'ignorer';
      if (courant === 'ingredients' && (s.quant >= 0.3 || s.courtes >= 0.7)) return 'ingredients';
      if (courant === 'etapes' && (s.moyenne >= 25 || s.phrases >= 0.5)) return 'etapes';
      if (s.quant >= 0.5 && s.moyenne < 55) return 'ingredients';
      if (s.phrases >= 0.3 || s.moyenne >= 45) return 'etapes';
      if (s.courtes >= 0.8 && lignes.length >= 3) return 'ingredients';
      return 'ignorer';
    };
    for (const l of p.lignes) {
      if (TITRE_ING.test(l) && l.length < 30) { pousser(); courant = force = 'ingredients'; const reste = l.replace(TITRE_ING, '').trim(); if (reste) seg.push(reste); continue; }
      if (TITRE_ETAPES.test(l)) { pousser(); courant = force = 'etapes'; continue; }
      // « Astuce », « Conseil »… : l'encadré qui suit est ignoré jusqu'au prochain intertitre
      if (A_IGNORER.test(l) && l.length < 30) { pousser(); courant = force = 'ignorer'; seg.push(l); continue; }
      if (lireInfos(l, infos)) continue;
      seg.push(l);
    }
    pousser();
  }
  // Titre : le texte court écrit le plus gros, placé avant les ingrédients et les étapes
  // (au moins 5 lettres : un reflet sur la photo lu « T6 » n'est pas un titre)
  const debut = blocs.findIndex(b => b.role === 'ingredients' || b.role === 'etapes');
  const candidats = blocs.slice(0, debut < 0 ? blocs.length : debut).filter(b => {
    const t = b.lignes.join(' ');
    return b.lignes.length <= 2 && t.length <= 70 && (t.match(/[a-zà-ÿ]/gi)?.length ?? 0) >= 5 && !estQuantite(b.lignes[0]) && !A_IGNORER.test(t);
  });
  const titre = candidats.sort((a, b) => b.hauteur - a.hauteur)[0];
  if (titre && (titre.hauteur >= mediane * 1.25 || candidats.length === 1)) titre.role = 'titre';
  return { blocs, infos };
}

export function assembler(blocs: Bloc[]) {
  const titres = blocs.filter(b => b.role === 'titre').flatMap(b => b.lignes).join(' ').trim();
  const titre = titres === titres.toUpperCase() ? titres.charAt(0) + titres.slice(1).toLowerCase() : titres;

  // Ingrédients : une ligne par ingrédient ; une ligne sans quantité qui commence en minuscule continue la précédente
  const ingredients: string[] = [];
  for (const b of blocs.filter(x => x.role === 'ingredients')) for (const [i, brut] of b.lignes.entries()) {
    const l = sansPuce(brut);
    if (!l) continue;
    const prec = ingredients[ingredients.length - 1];
    // la ligne précédente allait jusqu'au bout de la colonne : elle était coupée
    const pleine = i > 0 && b.lignes[i - 1].length >= 0.95 * Math.max(...b.lignes.map(x => x.length));
    const suite = i > 0 && prec != null && !/^[-–•*·°»+]/.test(brut)
      && ((pleine && /^[a-zà-ÿ(]/.test(l) && !lireQuantite(l)) || /(\s(de|d[’']|à|au|aux|et|avec|ou|en)|,)$/i.test(prec));
    if (suite) ingredients[ingredients.length - 1] += ' ' + l;
    else ingredients.push(l);
  }

  // Étapes : si la recette est numérotée (1. 2. 3.), c'est la numérotation qui découpe, même à travers les blocs ;
  // sinon un bloc = une étape. Les mots coupés en fin de ligne (« mi- / joter ») sont recollés.
  const coller = (lignes: string[]) => lignes.reduce((t, l) => !t ? l : t.endsWith('-') ? t.slice(0, -1) + l : `${t} ${l}`, '');
  const NUM = /(?:^|\s)(?=[ÉEée]tape\s*\d{1,2}\b|\d{1,2}\s*[.)/]\s*[A-ZÀ-Ýa-zà-ÿ])/;
  const blocsEtapes = blocs.filter(x => x.role === 'etapes').map(b => coller(b.lignes));
  const numerote = blocsEtapes.filter(t => /^\d{1,2}\s*[.)/]\s*[A-ZÀ-Ý]/.test(t) || /(^|\s)\d{1,2}\s*[.)]\s+[A-ZÀ-Ý]/.test(t) || /[ée]tape\s*\d/i.test(t)).length >= 2;
  const etapes = (numerote ? coller(blocsEtapes).split(NUM) : blocsEtapes)
    .map(m => m.replace(/^[ée]tape\s*\d{1,2}\s*[:.)-]?\s*/i, '').replace(/^\d{1,2}\s*[.)/]\s*/, '').replace(/^\d{1,2}\s+(?=[A-ZÀ-Ý])/, '').trim()).filter(m => m.length > 1);
  return { titre, ingredients, etapes };
}
