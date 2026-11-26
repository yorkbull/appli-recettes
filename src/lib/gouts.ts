// Goûts et allergies : repérer dans une recette les ingrédients que quelqu'un ne mange pas.
// Un mot peut désigner une famille (« fromage », « fruits de mer », « champignons ») : on cherche alors tous ses membres.
import type { Gout, Recette } from '../types';

const sa = (s: string) => ' ' + s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').toLowerCase().replace(/[’'-]/g, ' ').replace(/\s+/g, ' ') + ' ';

const FAMILLES: Record<string, string[]> = {
  fromage: ['fromage', 'emmental', 'gruyere', 'comte', 'parmesan', 'mozzarella', 'feta', 'chevre', 'camembert', 'brie', 'roquefort', 'bleu', 'raclette', 'reblochon',
    'ricotta', 'mascarpone', 'cheddar', 'burrata', 'pecorino', 'tomme', 'boursin', 'saint moret', 'philadelphia', 'gorgonzola', 'beaufort', 'cantal', 'morbier', 'munster', 'halloumi', 'grana padano', 'maroilles', 'mimolette', 'coulommiers', 'saint nectaire', 'abondance', 'vacherin', 'mont d or'],
  'fruits de mer': ['fruits de mer', 'crevette', 'gambas', 'moule', 'huitre', 'saint jacques', 'coquille', 'calamar', 'encornet', 'seiche', 'poulpe', 'crabe', 'homard', 'langouste', 'langoustine', 'ecrevisse', 'palourde', 'coque', 'bulot', 'bigorneau', 'couteau', 'oursin', 'tourteau'],
  champignon: ['champignon', 'cepe', 'girolle', 'morille', 'pleurote', 'shiitake', 'trompette', 'chanterelle', 'pied de mouton', 'truffe'],
  poisson: ['poisson', 'saumon', 'thon', 'cabillaud', 'colin', 'lieu', 'merlu', 'sardine', 'maquereau', 'truite', 'dorade', 'bar', 'sole', 'lotte', 'eglefin', 'haddock', 'anchois', 'hareng', 'surimi'],
  gluten: ['farine', 'pain', 'pate', 'pates', 'spaghetti', 'tagliatelle', 'penne', 'semoule', 'boulgour', 'chapelure', 'biscuit', 'brioche', 'tortilla', 'ble', 'seigle', 'orge'],
  lactose: ['lait', 'creme', 'beurre', 'yaourt', 'fromage blanc'],
  'fruits a coque': ['amande', 'noisette', 'noix', 'pignon', 'cajou', 'pistache', 'pecan', 'macadamia'],
  arachide: ['arachide', 'cacahuete', 'beurre de cacahuete'],
  porc: ['porc', 'lardon', 'jambon', 'bacon', 'saucisse', 'saucisson', 'chorizo', 'chipolata', 'poitrine', 'rillettes'],
  oeuf: ['oeuf', 'jaune d oeuf', 'blanc d oeuf', 'mayonnaise'],
};
// Familles proposées à la saisie
export const SUGGESTIONS_GOUTS = ['fromage', 'fruits de mer', 'champignons', 'poisson', 'gluten', 'lactose', 'fruits à coque', 'arachide', 'porc', 'œuf'];

const famille = (mot: string) => {
  const m = sa(mot).trim().replace(/s$/, '');
  return FAMILLES[m] ?? FAMILLES[m + 's'] ?? (m === 'oeuf' ? FAMILLES.oeuf : null) ?? [m];
};
const present = (texte: string, mot: string) => new RegExp(` ${sa(mot).trim()}(s|x)? `).test(texte);
const liste = (s: string) => s.split(/[,;]| et /).map(x => x.trim()).filter(Boolean);

export interface Conflit { gout: Gout; ingredients: string[] }

// Ingrédients d'une recette qui posent problème, par goût
export function conflits(r: Recette, gouts: Gout[]): Conflit[] {
  const out: Conflit[] = [];
  for (const g of gouts) {
    const mots = famille(g.mot), sauf = liste(g.sauf);
    const touches = r.ingredients.filter(l => { const t = sa(l); return mots.some(m => present(t, m)) && !sauf.some(x => present(t, x)); });
    if (touches.length) out.push({ gout: g, ingredients: touches });
  }
  return out;
}

export const resumeGout = (g: Gout) => `${g.allergie ? 'allergie : ' : 'n’aime pas : '}${g.mot}${g.sauf ? ` (sauf ${g.sauf})` : ''}`;
// « Marion (fromage), Charles (fruits de mer) »
export const resumeConflits = (c: Conflit[]) => c.map(x => `${x.gout.personne} (${x.gout.allergie ? 'allergie, ' : ''}${x.gout.mot})`).join(', ');
