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

const TITRE_ING = /^in[gc]r[ée]dients?\b\s*:?/i; // « INCRÉDIENTS » : G lu C
const TITRE_ETAPES = /^(pr[ée]paration|r[ée]alisation|instructions?|[ée]tapes|la recette|d[ée]roulement|recette|progression)\s*:?\s*$/i;
const A_IGNORER = /^(astuce|conseil|le conseil|notre conseil|variante|le petit plus|accord|vin conseill|bon app[ée]tit|difficult[ée]|co[uû]t|niveau|mat[ée]riel|ustensiles?)\b/i;
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
  // forme inversée : « 20 min de préparation », « 1 h 30 de cuisson »
  for (const t of l.matchAll(/(\d+\s*(?:h|heures?|min|minutes?)(?:\s*\d+)?)\s*(?:min\w*)?\s*(?:de|d['’])\s*(pr[ée]paration|cuisson)/gi)) {
    const min = minuteurs(t[1]).reduce((s, m) => s + m.secondes / 60, 0) || (/h/i.test(t[1]) ? +t[1].match(/\d+/)![0] * 60 : +t[1].match(/\d+/)![0]);
    if (!min) continue;
    if (/cuisson/i.test(t[2])) infos.cuissonMin ??= min; else infos.preparationMin ??= min;
    trouve = true;
  }
  const p = l.match(PORTIONS);
  if (p && (trouve || l.length < 60)) { infos.portions ??= +(p[1] ?? p[2]); trouve = true; }
  return trouve && l.length < 100;
}

// Lettres mal lues en début de ligne : puces « • » lues « e », « ° », « » »…
const sansPuce = (l: string) => l.replace(/^[-–—•*·°»«>~+]\s*/, '').replace(/^[eo©®]\s+(?=\d)/, '').trim();
const estQuantite = (l: string) => !!lireQuantite(sansPuce(l)) || /^[-–•*·°»]/.test(l);

// Ingrédients écrits à la suite, séparés par des puces : « 500 g de crevettes • 2 échalotes • Poivre ».
// La puce « • » est lue de bien des façons (* ® © » « e ¢ = +) : on coupe sur ces signes isolés entre deux espaces.
const PUCE = /\s+[•*®©»«·¢=+°e]\s+|\s+[•*®©»«·¢=+°]$/g;
function eclater(lignes: string[], min = 2): string[] {
  const texte = lignes.join(' ');
  if ((texte.match(PUCE) ?? []).length < min) return lignes;
  return texte.split(PUCE).flatMap(couperQuantites).map(x => x.trim()).filter(x => (x.match(/[a-zà-ÿ]/gi)?.length ?? 0) >= 2);
}
// une puce perdue à la lecture colle deux ingrédients : « 1 poivron rouge 1 petit piment rouge ».
// On recoupe devant une nouvelle quantité suivie d'une unité ou d'un mot (pas après « de », « à », « ou »).
const UNITE = '(?:k?g|cl|ml|l|cuil|c\\.|cs|cc|pots?|bottes?|gousses?|tranches?|pinc[ée]es?|sachets?|feuilles?|brins?|petite?s?|grosse?s?|belles?|[a-zà-ÿœ]{3,})';
const NOUVELLE_QTE = new RegExp(`(?<!(?:^|\\s)(?:de|à|ou|et|en|sur|par|soupe|café|avec|environ))\\s+(?=\\d+(?:[,.]\\d+)?\\s?${UNITE}(?![a-zà-ÿœ]))`, 'i');
// (et devant un assaisonnement seul en fin de ligne, quand la puce qui le séparait a été perdue : « … huile végétale Poivre »)
const couperQuantites = (x: string) => x.split(NOUVELLE_QTE).flatMap(m => m.split(/\s+(?=(?:Sel|Poivre|Sucre|Beurre|Persil|Ciboulette|Fleur de sel)$)/));
// « ½ » est souvent lu Y, %, V ou //, : on le remet devant une unité courante ;
// « 2 botte » (nom au singulier après 2) est aussi un ½ mal lu
const demi = (l: string) => l.replace(/^[[(|]?\s*(?:Y|%|V|¥|Vz|Ya|\/\/|1\/2)[»,.]?\s+(?=(botte|cuil|c\.|verre|tasse|sachet|citron|gousse|bouquet|litre|l\b|cl\b|kg\b|g\b))/i, '½ ')
  .replace(/^2\s+(?=(?:botte|gousse|tranche|pinc[ée]e|tasse|verre|sachet|bouquet|branche|feuille|citron|oignon)\b(?!s))/i, '½ ');
// combien de « quantité + ingrédient » dans un texte (« 1 citron vert », « 4 cuil. à soupe… »)
const nbQuantites = (t: string) => (t.match(new RegExp(`(?:^|\\s)\\d+(?:[,.]\\d+)?\\s?${UNITE}(?![a-zà-ÿœ])`, 'gi')) ?? []).length;
// numéro d'étape mal lu en début de bloc : « ka. », « ®. », « T. », « M. »
const NUM_MAL_LU = /^[^\sA-Za-zÀ-ÿ]{0,2}[A-Za-z%®©]{0,2}\s*[.)]\s+(?=[A-ZÀ-Ý])/;
// fin de phrase, sauf le point d'une abréviation (« 4 cuil. », « 1 c. », « env. »)
const finDePhrase = (t: string) => /[.!]\s*$/.test(t) && !/\b(cuil|c|env|gr|pers|cs|cc|càs|càc)\.\s*$/i.test(t);
const suiteDePhrase =(t: string) => /^[a-zà-ÿ]/.test(t) && !NUM_MAL_LU.test(t);

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

  let groupe = -1, utile: Role | null = null, enteteSeul = false;
  for (const p of paragraphes) {
    // un encadré ignoré (astuce…) s'arrête à la fin de sa colonne,
    // sauf si son intertitre (« CONSEIL ») formait un bloc à lui seul : le bloc suivant est alors son texte
    if (p.groupe !== groupe) { groupe = p.groupe; if (courant === 'ignorer' && !enteteSeul) courant = utile; }
    enteteSeul = p.lignes.length === 1 && A_IGNORER.test(p.lignes[0]) && p.lignes[0].length < 30;
    if (courant === 'ingredients' || courant === 'etapes') utile = courant;
    // un paragraphe peut contenir un intertitre (« Ingrédients ») suivi de sa liste : on le coupe là
    let seg: string[] = [], force: Role | null = null;
    const pousser = () => {
      if (!seg.length) return;
      const prec = blocs[blocs.length - 1];
      // un bloc qui commence par une minuscule est la suite du bloc précédent (phrase coupée par la mise en page)
      const role = force ?? (prec && suiteDePhrase(seg[0]) ? prec.role : deviner(seg));
      blocs.push({ id: id++, lignes: seg, role, hauteur: p.hauteur });
      // une fois les étapes commencées, la suite de la colonne est lue comme des étapes
      if (!force && role === 'etapes' && courant !== 'ignorer') courant = 'etapes';
      // de même pour une liste d'ingrédients reconnue sans intertitre lisible
      if (!force && role === 'ingredients' && courant === null) courant = 'ingredients';
      seg = [];
    };
    const deviner = (lignes: string[]): Role => {
      const s = noter(lignes);
      const texte = lignes.join(' ');
      if (A_IGNORER.test(lignes[0]) || /^\s*[\d\s/|-]{1,7}\s*$/.test(texte)) return 'ignorer'; // astuce, numéro de page
      if (courant === 'ignorer') return 'ignorer';
      // lignes tout en capitales avant la recette : morceau de titre, pas une liste
      if (courant === null && lignes.every(l => l === l.toUpperCase() && /[A-ZÀ-Ý]{3}/.test(l))) return 'ignorer';
      // « 1. Décortiquez… » : un numéro suivi d'une phrase est une étape, pas « 1 » ingrédient
      if (courant !== null && /^\d{1,2}\s*[.)]\s+[A-ZÀ-Ý][a-zà-ÿ]/.test(lignes[0]) && s.moyenne >= 25) return 'etapes';
      if (avecIntertitres && courant === null) return s.quant >= 0.6 && lignes.length >= 3 ? 'ingredients' : 'ignorer';
      if (courant === 'ingredients' && (s.quant >= 0.3 || s.courtes >= 0.7)) return 'ingredients';
      // fin d'une liste d'ingrédients à la suite : « Le jus de 1 citron vert • 4 cuil. à soupe d'huile »
      if (courant === 'ingredients' && (texte.match(PUCE) ?? []).length >= 1 && !finDePhrase(texte)) return 'ingredients';
      // …ou même sans puce lisible et placée plus loin (bout de ligne d'une page bombée) : plusieurs
      // « quantité + ingrédient », pas de phrase, pas de verbe en tête (« Ajoutez 2 cuil… » est une étape)
      if (courant !== null && nbQuantites(texte) >= 2 && !finDePhrase(texte) && lignes.length <= 3 && !/^[A-ZÀ-Ý][a-zà-ÿ]+(ez|er)\b/.test(texte)) return 'ingredients';
      if (courant === 'etapes' && (s.moyenne >= 25 || s.phrases >= 0.5)) return 'etapes';
      if (s.quant >= 0.5 && s.moyenne < 55) return 'ingredients';
      if (s.phrases >= 0.3 || s.moyenne >= 45) return 'etapes';
      if (s.courtes >= 0.8 && lignes.length >= 3) return 'ingredients';
      return 'ignorer';
    };
    // un intertitre « Ingrédients : » suivi de la liste à la suite, sur la même ligne
    const lignesP = TITRE_ING.test(p.lignes[0] ?? '') && p.lignes[0].length >= 30
      ? ['Ingrédients', ...eclater([p.lignes[0].replace(TITRE_ING, '').trim(), ...p.lignes.slice(1)])]
      : eclater(p.lignes);
    for (const l of lignesP) {
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
    return b.lignes.length <= 4 && t.length <= 90 && (t.match(/[a-zà-ÿ]/gi)?.length ?? 0) >= 5 && !estQuantite(b.lignes[0]) && !A_IGNORER.test(t);
  });
  // un titre sur plusieurs blocs (« CREVETTES SAUTÉES » puis « AUX HARICOTS VERTS ») : tous les blocs nettement
  // plus gros que le texte courant, placés avant la recette, forment le titre
  const gros = candidats.filter(b => b.hauteur >= mediane * 1.6);
  if (gros.length) gros.forEach(b => { b.role = 'titre'; });
  else {
    const titre = [...candidats].sort((a, b) => b.hauteur - a.hauteur)[0];
    if (titre && (titre.hauteur >= mediane * 1.25 || candidats.length === 1)) titre.role = 'titre';
  }
  return { blocs, infos };
}

export function assembler(blocs: Bloc[]) {
  const titres = blocs.filter(b => b.role === 'titre').flatMap(b => b.lignes).join(' ').trim();
  const titre = titres === titres.toUpperCase() ? titres.charAt(0) + titres.slice(1).toLowerCase() : titres;

  // Ingrédients : une ligne par ingrédient ; une ligne sans quantité qui commence en minuscule continue la précédente
  const ingredients: string[] = [];
  // (découpe aussi sans puce visible : « Le jus de 1 citron vert 4 cuil. à soupe… » → deux ingrédients)
  for (const b of blocs.filter(x => x.role === 'ingredients').map(x => ({ ...x, lignes: x.lignes.flatMap(l => eclater([l], 1)).flatMap(couperQuantites).map(l => l.trim()).filter(Boolean) }))) for (const [i, brut] of b.lignes.entries()) {
    const l = demi(sansPuce(brut));
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
  const NUM = /(?:^|\s)(?=[ÉEée]tape\s*\d{1,2}\b|\d{1,2}\s*[.)/]\s*[A-ZÀ-Ý])/;
  // un bloc = une étape, sauf s'il commence par une minuscule (suite de la phrase du bloc précédent)
  const blocsEtapes: string[] = [];
  for (const b of blocs.filter(x => x.role === 'etapes')) {
    const t = coller(b.lignes);
    if (blocsEtapes.length && suiteDePhrase(t)) blocsEtapes[blocsEtapes.length - 1] = coller([blocsEtapes[blocsEtapes.length - 1], t]);
    else blocsEtapes.push(t);
  }
  // en plus, une numérotation (1. 2. / Étape 3) à l'intérieur d'un bloc découpe ce bloc
  const numerote = blocsEtapes.join(' ').match(new RegExp(NUM.source, 'g'))?.length ?? 0;
  const etapes = blocsEtapes.flatMap(t => numerote >= 2 ? t.split(NUM) : [t])
    .map(m => m.replace(/^[^\sA-Za-zÀ-ÿ]{0,2}[A-Za-z%]{0,2}\s*[.)]\s+(?=[A-ZÀ-Ý])/, '').replace(/^[^A-Za-zÀ-ÿ0-9]+\s*(?=[A-ZÀ-Ý])/, '')) // numéro d'étape mal lu : « T. », « %. », « ka. »
    .map(m => m.replace(/^[ée]tape\s*\d{1,2}\s*[:.)-]?\s*/i, '').replace(/^\d{1,2}\s*[.)/]\s*/, '').replace(/^\d{1,2}\s+(?=[A-ZÀ-Ý])/, '').trim()).filter(m => m.length > 1);
  return { titre, ingredients, etapes };
}

// Note de 0 à 1 d'une lecture : sert à choisir la meilleure mise en page parmi plusieurs essais.
// Une bonne fiche a des ingrédients courts qui commencent par une quantité (ou très courts : « Poivre »)
// et des étapes faites de vraies phrases ; un titre est un petit plus.
export function qualite(p: Paragraphe[]): number {
  const r = analyser(p);
  const a = assembler(r.blocs);
  const ing = a.ingredients, et = a.etapes;
  const avecQte = ing.filter(l => l.length <= 55 && !!lireQuantite(l)).length;
  const bonsIng = avecQte + ing.filter(l => !lireQuantite(l) && l.split(' ').length <= 3 && l !== l.toUpperCase()).length;
  const bonnesEt = et.filter(e => e.length >= 25 && e.length <= 700 && /[a-zà-ÿ]/.test(e)).length;
  let n = 0;
  if (ing.length) n += 0.45 * (bonsIng / ing.length) * Math.min(1, avecQte / 3);
  if (et.length) n += 0.45 * (bonnesEt / et.length) * Math.min(1, et.length / 2);
  if (a.titre && a.titre.length >= 5) n += 0.1;
  // Départage des bonnes lectures (plusieurs atteignent 1) : plus d'ingrédients et d'étapes propres, c'est mieux ;
  // deux ingrédients collés, une puce restée dans une étape ou une étape qui commence en minuscule, c'est moins bien.
  n += 0.004 * Math.min(avecQte, 25) + 0.004 * Math.min(bonnesEt, 15);
  n -= 0.03 * ing.filter(l => nbQuantites(l) >= 2 || /\bà soupe\b.*\bà soupe\b/.test(l)).length;
  n -= 0.03 * et.filter(e => /^[a-zà-ÿ]/.test(e) || /\s[•*®©«»]\s|\s[•*®©«»]$/.test(e) || nbQuantites(e) >= 2 && !/[.!]$/.test(e)).length;
  return n;
}

// Ingrédients qu'une autre bonne lecture de la même photo a trouvés et qui manquent à la lecture retenue
// (une ligne au bord d'une page bombée est parfois lue par une version de la photo et pas par l'autre).
const normaliser = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function ressemblance(a: string, b: string): number {
  a = normaliser(a); b = normaliser(b);
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  let prec = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prec = cur;
  }
  return 1 - prec[n] / Math.max(m, n);
}
export function ingredientsManquants(retenue: Paragraphe[], autres: Paragraphe[][]): string[] {
  const deja = assembler(analyser(retenue).blocs).ingredients;
  const ajouts: string[] = [];
  for (const p of autres) {
    if (p === retenue || qualite(p) < 0.8) continue;
    for (const l of assembler(analyser(p).blocs).ingredients) {
      const mots = normaliser(l).split(' ').filter(m => m.length >= 4 && !['cuil', 'soupe', 'cafe', 'cuillere'].includes(m));
      // un ingrédient n'est ni une phrase (« …Réserver. »), ni une étape numérotée, ni un début de consigne (« Saler, … »)
      const propre = l.length <= 55 && nbQuantites(l) <= 1 && !/[•*®©«»]/.test(l) && mots.length >= 1 && l !== l.toUpperCase()
        && !finDePhrase(l) && !/^\d{1,2}\s*[.)]/.test(l) && !/^[A-ZÀ-Ý][a-zà-ÿ]+(er|ez)\b/.test(l) && !/[.!]\s+[A-ZÀ-Ý]/.test(l);
      const connu = [...deja, ...ajouts].some(d => ressemblance(d, l) >= 0.75 || normaliser(l).startsWith(normaliser(d)) || normaliser(d).includes(normaliser(l)));
      if (propre && !connu) ajouts.push(l);
    }
  }
  return ajouts;
}
