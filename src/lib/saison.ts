// Fruits et légumes de saison en France (mois de récolte en plein champ, 1 = janvier).
// Les produits de garde ou importés toute l'année (oignon, pomme de terre, carotte, citron, banane…) ne comptent pas.
import type { Recette } from '../types';

const T = String.raw`
asperge|4,5,6
artichaut|5,6,7,8,9
aubergine|6,7,8,9
betterave|7,8,9,10,11,12,1,2,3
brocoli|6,7,8,9,10,11
chou-fleur;chou fleur|9,10,11,12,1,2,3,4
chou de bruxelles;choux de bruxelles|10,11,12,1,2
chou;chou vert;chou rouge;chou frise|10,11,12,1,2,3
celeri|9,10,11,12,1,2,3
concombre|5,6,7,8,9
courgette|5,6,7,8,9
courge;potiron;potimarron;butternut;citrouille|9,10,11,12,1,2
endive|10,11,12,1,2,3,4
epinard|3,4,5,6,9,10,11
fenouil|6,7,8,9,10,11
haricot vert;haricots verts|6,7,8,9
mache|10,11,12,1,2,3
navet|10,11,12,1,2,3
petits pois;petit pois|5,6,7
poireau|9,10,11,12,1,2,3,4
poivron|6,7,8,9
radis|3,4,5,6,7
salade;laitue;batavia;roquette|4,5,6,7,8,9,10
tomate;tomates cerises|6,7,8,9
mais|7,8,9
panais|10,11,12,1,2,3
topinambour|10,11,12,1,2,3
blette|6,7,8,9,10
abricot|6,7,8
cerise|5,6,7
fraise|4,5,6,7
framboise|6,7,8,9
myrtille|7,8,9
melon|6,7,8,9
pasteque|7,8,9
peche;nectarine|6,7,8,9
prune|7,8,9
mirabelle|8,9
figue|8,9,10
raisin|8,9,10
poire|8,9,10,11,12,1
pomme|9,10,11,12,1,2,3,4
kiwi|11,12,1,2,3,4
clementine;mandarine|11,12,1,2
orange;pamplemousse|12,1,2,3,4
rhubarbe|4,5,6
cassis;groseille;fruits rouges|6,7,8
chataigne;marron|10,11,12
coing|10,11,12
`;

const sa = (s: string) => ' ' + s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').toLowerCase().replace(/[’'-]/g, ' ').replace(/\s+/g, ' ') + ' ';
const PRODUITS = T.trim().split('\n').map(l => { const [mots, mois] = l.split('|'); return { nom: mots.split(';')[0], mots: mots.split(';').map(m => sa(m).trim()), mois: mois.split(',').map(Number) }; });

// Le produit le plus précis trouvé dans une ligne (« chou-fleur » plutôt que « chou », « pomme de terre » n'est pas une pomme)
function produit(ligne: string) {
  const t = sa(ligne);
  if (/ pommes? de terre /.test(t) || / noix de coco /.test(t) || / jus d/.test(t)) return null;
  let best: (typeof PRODUITS)[number] | null = null, lg = 0;
  for (const p of PRODUITS) for (const m of p.mots) if (m.length > lg && new RegExp(` ${m}(s|x)? `).test(t)) { best = p; lg = m.length; }
  return best;
}

export function deSaison(r: Recette, mois = new Date().getMonth() + 1): { saison: boolean; dans: string[]; hors: string[] } {
  const dans = new Set<string>(), hors = new Set<string>();
  for (const l of r.ingredients) { const p = produit(l); if (p) (p.mois.includes(mois) ? dans : hors).add(p.nom); }
  return { saison: dans.size > 0 && hors.size === 0, dans: [...dans], hors: [...hors] };
}
