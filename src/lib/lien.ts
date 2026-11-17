// Import d'une recette depuis un lien (Marmiton, 750g, CuisineAZ, blogs…).
// Presque tous les sites de recettes décrivent la recette dans un bloc de données standard (schema.org « Recipe »,
// lu aussi par Google) : on ne garde que ce qui sert à la fiche — titre, photo, portions, temps, ingrédients, étapes.
// L'appli n'a pas de serveur : la page est récupérée via un service relais public (le navigateur interdit de lire
// directement une page d'un autre site). Seule l'adresse de la recette lui est transmise.

export interface RecetteImportee {
  titre: string;
  photo?: string; // adresse de l'image
  portions?: number;
  preparationMin?: number;
  cuissonMin?: number;
  ingredients: string[];
  etapes: string[];
  categories: string[]; // catégorie, cuisine, mots-clés du site
}

const RELAIS: ((u: string) => { url: string; init?: RequestInit })[] = [
  u => ({ url: `https://r.jina.ai/${u}`, init: { headers: { 'X-Return-Format': 'html' } } }),
  u => ({ url: `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` }),
  u => ({ url: `https://corsproxy.io/?url=${encodeURIComponent(u)}` }),
];

async function telecharger(url: string): Promise<string> {
  let derniere: unknown;
  for (const relais of RELAIS) {
    const { url: r, init } = relais(url);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25_000);
    try {
      const rep = await fetch(r, { ...init, signal: ctl.signal });
      if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
      const html = await rep.text();
      if (html.length > 500) return html;
    } catch (e) { derniere = e; } finally { clearTimeout(t); }
  }
  throw derniere ?? new Error('page');
}

export async function lireLien(url: string): Promise<RecetteImportee> {
  const html = await telecharger(url);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const r = depuisJsonLd(doc) ?? depuisMicrodonnees(doc);
  if (!r || (!r.ingredients.length && !r.etapes.length)) throw new Error('pas de recette');
  // pas de photo dans la recette : l'image d'aperçu de la page (celle des partages sur les réseaux)
  r.photo ||= doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? undefined;
  return r;
}

// ——— Données structurées JSON-LD ———
type Obj = Record<string, unknown>;
const estRecette = (o: Obj) => { const t = o['@type']; return t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe')); };

function chercherRecette(x: unknown): Obj | null {
  if (Array.isArray(x)) { for (const e of x) { const r = chercherRecette(e); if (r) return r; } return null; }
  if (x && typeof x === 'object') {
    const o = x as Obj;
    if (estRecette(o)) return o;
    for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement']) { const r = chercherRecette(o[k]); if (r) return r; }
  }
  return null;
}

function depuisJsonLd(doc: Document): RecetteImportee | null {
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try { data = JSON.parse(s.textContent ?? ''); } catch { continue; }
    const o = chercherRecette(data);
    if (!o) continue;
    return {
      titre: propre(texte(o.name)),
      photo: image(o.image),
      portions: portions(o.recipeYield),
      preparationMin: duree(o.prepTime),
      cuissonMin: duree(o.cookTime) ?? (duree(o.totalTime) != null && duree(o.prepTime) != null ? Math.max(0, duree(o.totalTime)! - duree(o.prepTime)!) || undefined : undefined),
      ingredients: liste(o.recipeIngredient ?? o.ingredients).map(propre).filter(Boolean),
      etapes: etapes(o.recipeInstructions),
      categories: [o.recipeCategory, o.recipeCuisine, o.keywords].flatMap(x => liste(x).flatMap(s => s.split(','))).map(s => propre(s)).filter(Boolean),
    };
  }
  return null;
}

// ——— Microdonnées (sites plus anciens) ———
function depuisMicrodonnees(doc: Document): RecetteImportee | null {
  const racine = doc.querySelector('[itemtype*="schema.org/Recipe"]');
  if (!racine) return null;
  const p = (n: string) => [...racine.querySelectorAll(`[itemprop="${n}"]`)].map(e => (e.getAttribute('content') ?? e.textContent ?? '').trim()).filter(Boolean);
  const img = racine.querySelector('[itemprop="image"]');
  return {
    titre: propre(p('name')[0] ?? ''),
    photo: img?.getAttribute('src') ?? img?.getAttribute('content') ?? undefined,
    portions: portions(p('recipeYield')[0]),
    preparationMin: duree(p('prepTime')[0]), cuissonMin: duree(p('cookTime')[0]),
    ingredients: [...p('recipeIngredient'), ...p('ingredients')].map(propre),
    etapes: p('recipeInstructions').flatMap(s => s.split(/\n+/)).map(propre).filter(Boolean),
    categories: p('recipeCategory'),
  };
}

// ——— Petits lecteurs ———
const decodeur = typeof document !== 'undefined' ? document.createElement('textarea') : null;
// Retire les balises et les codes HTML (&eacute;…) que certains sites laissent dans les données
function propre(s: string): string {
  let t = s.replace(/<[^>]+>/g, ' ');
  if (decodeur) { decodeur.innerHTML = t; t = decodeur.value; }
  return t.replace(/\s+/g, ' ').trim();
}
const texte = (x: unknown): string => typeof x === 'string' ? x : Array.isArray(x) ? texte(x[0]) : x && typeof x === 'object' ? texte((x as Obj).text ?? (x as Obj).name ?? '') : x == null ? '' : String(x);
const liste = (x: unknown): string[] => x == null ? [] : Array.isArray(x) ? x.flatMap(liste) : [texte(x)];

function image(x: unknown): string | undefined {
  if (!x) return undefined;
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return image(x[x.length > 1 && typeof x[x.length - 1] === 'string' ? x.length - 1 : 0]); // souvent du plus petit au plus grand
  const o = x as Obj;
  return image(o.url ?? o.contentUrl);
}

function portions(x: unknown): number | undefined {
  const m = liste(x).join(' ').match(/\d+/);
  const n = m ? +m[0] : NaN;
  return n > 0 && n < 100 ? n : undefined;
}

// « PT1H30M » → 90 ; « 20 min » → 20
function duree(x: unknown): number | undefined {
  const s = texte(x);
  if (!s) return undefined;
  const iso = s.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  let min: number;
  if (iso && s.length > 1) min = (+(iso[1] ?? 0)) * 1440 + (+(iso[2] ?? 0)) * 60 + (+(iso[3] ?? 0));
  else { const h = s.match(/(\d+)\s*h/i), m = s.match(/(\d+)\s*min/i); min = (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0); }
  return min > 0 ? min : undefined;
}

function etapes(x: unknown): string[] {
  if (x == null) return [];
  if (typeof x === 'string') return x.split(/\n+|(?<=\.)\s+(?=\d+[.)]\s)/).map(s => propre(s).replace(/^(?:[ée]tape\s*)?\d+\s*[.):-]\s*/i, '')).filter(Boolean);
  if (Array.isArray(x)) return x.flatMap(etapes);
  const o = x as Obj;
  if (o.itemListElement) return etapes(o.itemListElement); // HowToSection : groupe d'étapes
  return etapes(texte(o.text ?? o.name ?? ''));
}
