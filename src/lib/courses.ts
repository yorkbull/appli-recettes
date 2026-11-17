// Liste de courses : additionne les ingrédients des repas prévus sur une semaine (quantités ajustées aux portions)
// et les range par rayon.
import type { Planning, Recette } from '../types';
import { MOMENTS } from '../types';
import { lireQuantite, formater } from './quantites';

export type Rayon = 'fruits' | 'legumes' | 'viande' | 'autres';
export const RAYONS: { id: Rayon; titre: string }[] = [
  { id: 'fruits', titre: 'Fruits' },
  { id: 'legumes', titre: 'Légumes' },
  { id: 'viande', titre: 'Viande et poisson' },
  { id: 'autres', titre: 'Autres' },
];

export interface Article { cle: string; nom: string; quantite: string; rayon: Rayon }

const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').toLowerCase();
const contient = (nom: string, mots: string[]) => mots.some(m => new RegExp(`(^|[^a-z])${m}`).test(nom));

// Mots-clés sans accents, au singulier (le pluriel est couvert : « carotte » trouve « carottes »)
const NON_FRAIS = ['bouillon', 'fond de', 'cube', 'confiture', 'jus d', 'sirop', 'compote', 'sauce', 'puree d', 'concentre', 'noix de muscade', 'en poudre', 'seche'];
const LEGUMES = ['pomme de terre', 'pommes de terre', 'patate', 'carotte', 'oignon', 'echalote', 'ail\\b', 'poireau', 'courgette', 'aubergine', 'poivron', 'tomate', 'salade', 'laitue', 'epinard',
  'chou', 'brocoli', 'haricot vert', 'haricots verts', 'petits pois', 'petit pois', 'champignon', 'concombre', 'radis', 'navet', 'betterave', 'celeri', 'fenouil', 'potiron', 'potimarron', 'courge',
  'butternut', 'asperge', 'artichaut', 'endive', 'mache', 'roquette', 'mais\\b', 'avocat', 'gingembre', 'piment', 'persil', 'ciboulette', 'basilic', 'coriandre', 'menthe', 'aneth', 'thym', 'romarin',
  'estragon', 'cerfeuil', 'legume', 'panais', 'topinambour', 'blette', 'cresson', 'pousses'];
const FRUITS = ['pomme', 'banane', 'citron', 'orange', 'fraise', 'framboise', 'fruit', 'myrtille', 'mure', 'cerise', 'poire', 'peche', 'abricot', 'raisin', 'kiwi', 'ananas', 'mangue', 'melon',
  'pasteque', 'prune', 'mirabelle', 'figue', 'clementine', 'mandarine', 'pamplemousse', 'grenade', 'rhubarbe', 'cassis', 'groseille', 'noix de coco', 'nectarine', 'litchi', 'fruit de la passion'];
const VIANDES = ['boeuf', 'veau', 'porc', 'poulet', 'dinde', 'canard', 'agneau', 'lardon', 'jambon', 'bacon', 'saucisse', 'saucisson', 'chorizo', 'steak', 'viande', 'hache', 'escalope', 'cote de',
  'roti', 'filet mignon', 'magret', 'merguez', 'chipolata', 'lapin', 'pintade', 'blanc de', 'cuisse', 'saumon', 'thon', 'cabillaud', 'colin', 'crevette', 'moule', 'poisson', 'sardine', 'maquereau',
  'truite', 'lieu\\b', 'dorade', 'bar\\b', 'gambas', 'calamar', 'saint-jacques', 'noix de saint', 'surimi', 'anchois', 'merlu', 'sole\\b', 'eglefin', 'haddock', 'lotte', 'crabe', 'homard'];

export function rayonDe(nom: string): Rayon {
  const n = sansAccent(nom);
  if (contient(n, NON_FRAIS)) return 'autres';
  if (contient(n, VIANDES)) return 'viande';
  if (contient(n, LEGUMES)) return 'legumes'; // avant les fruits : « pomme de terre » n'est pas une pomme
  if (contient(n, FRUITS)) return 'fruits';
  return 'autres';
}

// Unités : poids ramenés au gramme, volumes au millilitre, le reste compté tel quel (gousse, tranche…)
// (« \b » ne marche pas après une lettre accentuée : on vérifie à la main que le mot est fini)
const u = (motif: string) => new RegExp(`^(?:${motif})(?![a-zà-ÿ])\\.?`, 'i');
const UNITES: [RegExp, string, number][] = [
  [u('kg|kilos?|kilogrammes?'), 'g', 1000], [u('g|gr|grammes?'), 'g', 1],
  [u('l|litres?'), 'ml', 1000], [u('dl'), 'ml', 100], [u('cl'), 'ml', 10], [u('ml'), 'ml', 1],
  [u('(?:c\\.|cuill?\\.?|cuill[eè]res?)\\s*(?:à|a)\\s*soupe|cs|càs|cas'), 'c. à soupe', 1],
  [u('(?:c\\.|cuill?\\.?|cuill[eè]res?)\\s*(?:à|a)\\s*caf[ée]|cc|càc|cac'), 'c. à café', 1],
  [u('pinc[ée]es?|gousses?|tranches?|pav[ée]s?|bo[iî]tes?|sachets?|bottes?|brins?|feuilles?|verres?|bols?|filets?|briques?|pots?|bouquets?|t[eê]tes?|branches?|morceaux?|poign[ée]es?'), '', 1],
];
// « 2 pavés » et « 1 pavé » s'additionnent : l'unité comptée est gardée au singulier
const singulier = (s: string) => s.toLowerCase().replace(/\.$/, '').replace(/eaux$/, 'eau').replace(/s$/, '');
const pluriel = (s: string, n: number) => n <= 1 || /[sx]$/.test(s) ? s : s.endsWith('eau') ? s + 'x' : s + 's';

interface Lu { nom: string; unite: string; valeur: number | null }

function lireLigne(ligne: string, facteur: number): Lu[] {
  const l = ligne.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const q = /^(un peu|quelques)\b/i.test(l) ? null : lireQuantite(l);
  if (!q) {
    // « sel, poivre », « aneth, sel, poivre » : un article par élément, sans quantité
    return l.replace(/^(quelques|un peu d[e’']|du|de la|des)\s+/i, '').split(/\s*,\s*|\s+et\s+/).filter(Boolean).map(n => ({ nom: n, unite: '', valeur: null }));
  }
  let reste = l.slice(q.fin).trim(), unite = '', k = 1;
  for (const [re, base, mult] of UNITES) {
    const m = reste.match(re);
    if (m) { unite = base || singulier(m[0]); k = mult; reste = reste.slice(m[0].length).trim(); break; }
  }
  const nom = reste.replace(/^(de\s+|d[’']\s*)/i, '').trim();
  return [{ nom: nom || l, unite, valeur: q.v * k * facteur }];
}

const cleDe = (nom: string) => sansAccent(nom).replace(/[’']/g, ' ').replace(/\b(\w{3,}?)(s|x)\b/g, '$1').replace(/\s+/g, ' ').trim();

function formaterQuantite(v: number, unite: string): string {
  if (unite === 'g') return v >= 1000 ? `${formater(v / 1000)} kg` : `${formater(v)} g`;
  if (unite === 'ml') return v >= 1000 ? `${formater(v / 1000)} l` : v >= 10 ? `${formater(v / 10)} cl` : `${formater(v)} ml`;
  // pour acheter, on arrondit au-dessus : jamais « 2,3 oignons »
  // (sans unité, c'est un nombre de pièces à acheter : jamais « ½ banane »)
  const n = v >= 3 || !unite ? Math.ceil(v - 1e-9) : Math.ceil(v * 2 - 1e-9) / 2;
  return unite ? `${formater(n)} ${unite.startsWith('c. à') ? unite : pluriel(unite, n)}` : formater(n);
}

export function listeCourses(jours: string[], planning: Planning, parId: Record<string, Recette>): { articles: Article[]; recettes: string[] } {
  const total = new Map<string, { nom: string; parUnite: Map<string, number | null> }>();
  const recettes = new Set<string>();
  for (const d of jours) for (const m of MOMENTS) {
    const c = planning[d]?.[m];
    if (!c || c.type !== 'recette') continue; // les restes sont déjà comptés avec le repas d'origine
    const r = parId[c.recetteId];
    if (!r) continue;
    recettes.add(r.titre);
    const facteur = c.portions / (r.portions || 1);
    for (const ligne of r.ingredients) for (const a of lireLigne(ligne, facteur)) {
      const cle = cleDe(a.nom);
      if (!cle) continue;
      const e = total.get(cle) ?? { nom: a.nom, parUnite: new Map() };
      const avant = e.parUnite.get(a.unite);
      e.parUnite.set(a.unite, a.valeur == null ? (avant ?? null) : (avant ?? 0) + a.valeur);
      total.set(cle, e);
    }
  }
  const articles: Article[] = [...total].map(([cle, e]) => {
    const quantites = [...e.parUnite].filter(([, v]) => v != null).map(([u, v]) => formaterQuantite(v!, u));
    const nom = e.nom.charAt(0).toUpperCase() + e.nom.slice(1);
    return { cle, nom, quantite: quantites.join(' + '), rayon: rayonDe(e.nom) };
  }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  return { articles, recettes: [...recettes] };
}

// Texte à coller dans une note (Samsung Notes, Keep…) : une case ☐ par article, rangé par rayon
export function texteCourses(titre: string, articles: Article[]): string {
  const blocs = RAYONS.map(({ id, titre: t }) => {
    const l = articles.filter(a => a.rayon === id);
    return l.length ? `${t.toUpperCase()}\n${l.map(a => `☐ ${a.nom}${a.quantite ? ` (${a.quantite})` : ''}`).join('\n')}` : '';
  }).filter(Boolean);
  return `${titre}\n\n${blocs.join('\n\n')}`;
}
