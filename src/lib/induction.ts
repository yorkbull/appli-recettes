// Plaques à induction : traduire « feu doux / moyen / vif » des recettes en puissance de plaque (échelle 1 à 9)
// et rappeler ce qui change : l'eau bout très vite, la poêle chauffe en 1 minute, la chaleur s'arrête dès qu'on retire la casserole.
const sa = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const REGLES: [RegExp, string][] = [
  [/(porter|amener) a ebullition|eau (bouillante|frem|salee)|casserole d.eau|faire bouillir|blanchir/, 'Booster (P) avec couvercle : l’eau bout en 4 à 6 min, inutile de la lancer à l’avance. Puis 7 pour garder l’ébullition.'],
  [/feu tres vif|saisir|faire sauter|wok/, 'Puissance 8 à 9. Poêle chaude en 1 min : ajoutez la matière grasse juste avant.'],
  [/feu vif|faire (bien )?dorer|colorer|griller/, 'Puissance 7 à 8.'],
  [/feu moyen|feu modere|faire revenir|suer|fondre (les |l )?oignon/, 'Puissance 5 à 6.'],
  [/feu (tres )?doux|mijot|fremi|a couvert|compot|reduire|epaissi/, 'Puissance 3 à 4 (2 pour un mijotage très lent).'],
  [/(faire |laisser )?fondre (le |du )?(beurre|chocolat)|au bain.marie/, 'Puissance 2 à 3 : l’induction brûle vite le beurre et le chocolat.'],
  [/(maintenir|garder) au chaud|rechauff/, 'Puissance 1 à 2 (ou fonction maintien au chaud).'],
];

// Conseil pour une étape de recette, ou null si l'étape ne se fait pas sur les plaques
export function conseilInduction(etape: string): string | null {
  const t = sa(etape).replace(/hors du feu[^.]*/g, '').replace(/eau de cuisson/g, '');
  if (/\b(four|enfourn|gratiner)\b/.test(t) && !/poele|casserole|cocotte|sauteuse|feu/.test(t)) return null;
  for (const [re, conseil] of REGLES) if (re.test(t)) return conseil;
  if (/\bfeu\b|poele|casserole|sauteuse|cocotte/.test(t) && /cuire|chauff|cuisson/.test(t)) return 'Puissance 5 à 6 par défaut, à ajuster.';
  return null;
}
