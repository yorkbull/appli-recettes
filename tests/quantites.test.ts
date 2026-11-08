import { ajusterLigne, minuteurs, formater } from '../src/lib/quantites';
const cas: [string, number, string][] = [
  ['1,5 kg de pommes de terre', 4/6, '1 kg de pommes de terre'], ['50 cl de crème', 4/6, '33 cl de crème'], ['1 gousse d’ail', 4/6, '1 gousse d’ail'],
  ['1 pincée de muscade', 4/6, '1 pincée de muscade'], ['3 œufs', 0.5, '1 ½ œufs'], ['2 oignons', 3, '6 oignons'], ['½ banane', 2, '1 banane'],
  ['2-3 courgettes', 2, '4 à 6 courgettes'], ['1 c. à soupe d’huile', 2, '2 c. à soupe d’huile'], ['200 g de riz', 1.5, '300 g de riz'], ['sel, poivre', 2, 'sel, poivre'],
  ['une pincée de sel', 3, '3 pincée de sel'], ['150 g de lardons', 1/3, '50 g de lardons'], ['1 ½ verre de lait', 2, '3 verre de lait'],
];
let ok = 0; for (const [l, f, att] of cas) { const r = ajusterLigne(l, f); r === att ? ok++ : console.log('✗', l, '×', f.toFixed(2), '→', r, '(attendu', att + ')'); }
const m = minuteurs('Cuire 10 min puis enfourner 1 h 30, laisser reposer 5 minutes.'); console.log('minuteurs', m.map(x => x.texte + '=' + x.secondes));
console.log(`${ok}/${cas.length}`, formater(0.333));
