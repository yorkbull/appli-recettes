// Calories et nutriments par portion, calculés à partir des ingrédients.
// Valeurs moyennes pour 100 g, arrondies, d'après la table Ciqual de l'ANSES (aliments crus sauf mention).
// Format : mots-clés (;) | kcal | protéines | glucides | lipides | poids d'une pièce en g | densité (g/ml)
import { lireLigne } from './courses';

const TABLE = String.raw`
carotte|36|0.6|7|0.3|100|
oignon;oignon rouge;oignon nouveau|40|1.2|7|0.2|100|
oignons grelots;petits oignons|40|1.2|7|0.2|15|
echalote|75|2.5|15|0.2|25|
ail;gousse d ail|131|6|24|0.5|5|
poireau|30|1.5|4.5|0.3|200|
pomme de terre;pommes de terre;patate|80|2|17|0.1|150|
patate douce|86|1.6|20|0.1|300|
courgette|16|1.2|2|0.3|250|
aubergine|20|1|3|0.2|300|
poivron|28|1|5|0.3|170|
tomate|19|0.8|3|0.3|120|
tomate cerise;tomates cerises|19|0.8|3|0.3|15|
concombre|13|0.6|2|0.1|400|
salade;laitue;batavia;scarole|15|1.2|1.5|0.2|300|
mache;roquette;pousses|25|2|2|0.4||
epinard|28|3|1.5|0.5||
chou;chou vert;chou rouge|30|1.5|5|0.2|1000|
chou-fleur;chou fleur|25|2|3|0.3|800|
brocoli|33|3|4|0.4|400|
chou de bruxelles;choux de bruxelles|43|3.4|5|0.3|15|
haricot vert;haricots verts|30|2|4|0.2||
petits pois;petit pois|80|5.5|13|0.4||
champignon|22|2.5|1|0.3|20|
celeri|15|0.7|2|0.2|60|
celeri-rave;celeri rave|30|1.5|5|0.3|600|
fenouil|20|1.2|3|0.2|300|
navet|22|0.8|4|0.2|150|
betterave|45|1.6|9|0.1|150|
radis|15|0.8|2|0.1|10|
potiron;potimarron;courge;butternut|30|1|6|0.1||
asperge|25|2.5|2.5|0.2|20|
endive|17|1|2.5|0.1|150|
mais|105|3|19|1.5||
avocat|160|2|2|15|200|
citron|30|0.8|3|0.3|100|
citron vert|30|0.7|3|0.2|70|
orange|45|1|9|0.2|200|
pomme|54|0.3|12|0.2|150|
poire|55|0.4|12|0.2|170|
banane|90|1.2|20|0.2|120|
fraise|33|0.7|6|0.3|15|
framboise;fruits rouges;myrtille;mure;groseille;cassis|45|1|7|0.4||
raisin|70|0.7|16|0.2||
peche;nectarine|40|0.8|9|0.2|150|
abricot|45|0.8|9|0.2|45|
cerise|60|1|13|0.3||
ananas|50|0.5|11|0.2|1000|
mangue|65|0.6|14|0.3|350|
kiwi|55|1|10|0.6|80|
melon|35|0.8|7|0.2|1000|
pasteque|30|0.6|7|0.2||
persil;ciboulette;coriandre;basilic;menthe;aneth;cerfeuil;estragon|40|3|4|0.5|20|
thym;romarin;laurier;bouquet garni;herbes de provence|0|0|0|0|5|
gingembre|80|1.8|16|0.8|20|
boeuf;paleron;macreuse;roti de boeuf;bourguignon|190|27|0|9||
steak|150|27|0|5|150|
viande hachee;boeuf hache;steak hache|250|19|0|20|125|
veau|150|21|0|7||
porc;filet mignon;echine|200|21|0|13||
cote de porc;cotelette|220|20|0|15|180|
agneau;gigot|230|20|0|17||
poulet;blanc de poulet;escalope de poulet;filet de poulet|120|23|0|2|150|
cuisse de poulet;haut de cuisse|180|18|0|12|250|
dinde;escalope de dinde|110|24|0|1.5|130|
canard;magret|200|20|0|13|350|
lapin|140|21|0|6||
saucisse;chipolata;merguez;saucisse de toulouse|290|14|1|25|80|
lardon;poitrine fumee|300|15|0.5|26||
jambon;jambon blanc|115|20|1|3.5|45|
jambon cru;jambon de bayonne;jambon de parme|250|26|0.5|16|20|
chorizo|450|24|2|38||
saucisson|420|26|2|34||
bacon|150|23|1|6|12|
saumon;pave de saumon|200|20|0|13|125|
saumon fume|180|22|0|10|25|
cabillaud;colin;lieu;merlu;eglefin;poisson blanc|82|18|0|0.8|130|
thon|130|26|0|3|150|
thon en boite;thon au naturel|115|26|0|1||
sardine|200|24|0|11|25|
maquereau|200|19|0|14||
truite|140|20|0|6|150|
crevette;gambas|90|20|0|1|15|
moule|90|14|3|2||
saint-jacques;noix de saint-jacques|85|16|3|0.8|25|
surimi|105|8|14|2|17|
anchois|200|25|0|10|4|
oeuf|140|12.5|0.5|10|55|
jaune d oeuf;jaunes d oeuf;jaune|330|16|0.5|29|18|
blanc d oeuf;blancs d oeuf|47|10.5|0.7|0.2|35|
lait|47|3.3|4.8|1.6||1.03
lait de coco|180|1.8|3|18||1
lait d avoine;lait de soja;lait d amande;lait vegetal|40|2|4|1.5||1.03
creme;creme liquide;creme fraiche;creme epaisse;creme entiere|290|2.3|3|30||1
creme legere;creme allegee|160|2.5|4|15||1
beurre|745|0.7|0.6|82||0.95
margarine|540|0|0|60||0.95
yaourt;yogourt|60|4|5|3|125|
fromage blanc|75|7.5|4|3||1
skyr|60|10|4|0.2||
emmental;gruyere;fromage rape|380|29|0|29||
comte|410|28|0|34||
parmesan;pecorino|400|33|0|29||
mozzarella;burrata|240|18|1|18|125|
chevre;buche de chevre|300|18|1|25||
feta|270|16|1|22||
camembert;brie|290|20|0.5|23|250|
roquefort;bleu|360|19|0|31||
raclette|340|23|0|27|30|
reblochon|330|20|0|28|450|
ricotta|140|9|3|10||
mascarpone|430|5|3.5|44||
cheddar|410|25|1|34|20|
fromage frais;boursin;saint moret;philadelphia|250|7|3|23||
pain;baguette|270|9|55|1.5|250|
pain de mie|270|8.5|49|4|25|
pain burger;pain a hamburger;pain hamburger|280|9|50|5|60|
pain complet|240|9|45|3|500|
tortilla;wrap|300|8|50|7|40|
pain pita;pita|275|9|55|1.2|70|
brioche|360|8|50|14|40|
pate feuilletee|400|5.5|37|25|230|
pate brisee;pate sablee|430|6|45|25|230|
pate a pizza|270|8|45|6|260|
pate;pates;spaghetti;tagliatelle;penne;macaroni;coquillette;fusilli;linguine;farfalle;vermicelle;lasagne|355|12|71|1.5||
pates fraiches;raviolis;ravioli|280|11|52|2.5||
gnocchi|150|3.5|32|0.5||
riz;riz basmati;riz rond;riz thai;riz arborio;riz a risotto|355|7.5|78|0.7||0.85
riz complet|350|7.5|72|2.5||0.85
semoule|355|12|72|1.5||0.7
boulgour|345|12|69|1.5||0.7
quinoa|370|14|64|6||0.75
nouilles|360|11|72|2||
lentille|335|24|50|1.5||0.8
pois chiche|140|7.5|18|2.5||
haricots rouges;haricots blancs;flageolets|100|7|14|0.6||
flocons d avoine;flocon d avoine;flocons|370|13|59|7||0.4
farine|345|10|72|1.2||0.55
maizena;fecule|350|0.3|86|0.1||0.6
chapelure|380|12|72|4.5||0.45
sucre;sucre roux;sucre en poudre;cassonade;sucre glace|400|0|100|0||0.85
sucre vanille;sucre vanille|400|0|100|0|7.5|
miel|330|0.4|81|0||1.4
sirop d erable|260|0|67|0||1.3
levure;levure chimique;levure boulangere|150|10|20|2|10|
chocolat;chocolat noir;chocolat patissier|550|7|35|40|10|
chocolat au lait|540|7|56|31|10|
cacao|380|20|12|21||0.45
amande;poudre d amande|610|22|7|53||0.45
noisette|650|15|7|62||
noix|700|15|7|66||
pignon|670|14|4|68||
cajou;noix de cajou|590|18|27|46||
cacahuete|600|25|12|50||
raisins secs|300|3|70|0.5||
graines;sesame;graines de tournesol;chia;lin|580|20|12|50||0.6
huile;huile d olive;huile de tournesol;huile de colza;huile de sesame|900|0|0|100||0.92
vinaigre;vinaigre balsamique|20|0|0.5|0||1.01
moutarde|150|7|4|11||1.05
mayonnaise|700|1.3|1.5|77||0.95
ketchup|110|1.3|25|0.2||1.1
sauce soja|60|8|6|0.5||1.15
pesto|450|5|5|45||1
sauce tomate;coulis de tomate;passata|45|1.5|7|1||1.05
tomates pelees;tomate pelee;tomates concassees|22|1|3.5|0.2||1.05
concentre de tomate|80|4.5|13|0.5||1.1
olive;olives|150|1|1|15|4|
cornichon|15|0.5|2|0.2|8|
capre|25|2|2|0.9||1
bouillon;fond de veau;fumet|5|0.5|0.5|0.2||1
cube;cube de bouillon;bouillon cube|250|10|25|12|10|
sel;fleur de sel;sel fin;gros sel|0|0|0|0||1.2
poivre;paprika;cumin;curry;cannelle;muscade;noix de muscade;piment;curcuma;origan;epices;ras el hanout;piment d espelette|0|0|0|0||0.5
vanille;gousse de vanille;extrait de vanille|0|0|0|0|3|
vin;vin rouge;vin blanc|70|0|0.5|0||1
biere|40|0.4|3|0||1
eau;eau tiede;eau froide;eau chaude|0|0|0|0||1
cafe;the|0|0|0|0|2|
jus d orange;jus|45|0.6|10|0.1||1.04
jus de citron|25|0.4|2.5|0.2||1
tofu|130|13|2|8||
steak vegetal|220|16|8|13|100|
houmous|300|8|14|23||
confiture|250|0.4|60|0.1||1.3
pate a tartiner|540|6|58|31||
cereales|380|8|80|2||0.35
biscuit;speculoos;boudoir|470|6.5|70|18|8|
compote|70|0.3|16|0.2||1.05
glace|200|3.5|24|10||0.6
legumes surgeles;poelee de legumes|35|2|5|0.5||
frites|200|3|30|7||
pizza|250|11|30|9|400|
puree|85|2|12|3||
gelatine|340|85|0|0|2|
`;

interface Aliment { mots: string[]; kcal: number; prot: number; gluc: number; lip: number; piece?: number; densite?: number }
const sansAccent = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();

const ALIMENTS: Aliment[] = TABLE.trim().split('\n').map(l => {
  const [mots, kcal, prot, gluc, lip, piece, densite] = l.split('|');
  return { mots: mots.split(';').map(sansAccent), kcal: +kcal, prot: +prot, gluc: +gluc, lip: +lip, piece: piece ? +piece : undefined, densite: densite ? +densite : undefined };
});

// Mot-clé le plus long trouvé dans le nom : « pommes de terre » gagne sur « pomme », « huile d'olive » sur « olive »
export function trouverAliment(nom: string): Aliment | null {
  const n = ' ' + sansAccent(nom) + ' ';
  let best: Aliment | null = null, lg = 0;
  for (const a of ALIMENTS) for (const m of a.mots) {
    if (m.length > lg && new RegExp(`[^a-z]${m.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')}(s|x)?[^a-z]`).test(n)) { best = a; lg = m.length; }
  }
  return best;
}

// Contenants et mesures usuels, en grammes ou millilitres
const MESURES: Record<string, { ml?: number; g?: number }> = {
  'c. à soupe': { ml: 15 }, 'c. à café': { ml: 5 }, pincée: { g: 0.5 }, verre: { ml: 200 }, bol: { ml: 300 }, tasse: { ml: 200 },
  brique: { ml: 200 }, 'boîte': { g: 400 }, boite: { g: 400 }, sachet: { g: 10 }, pot: { g: 125 }, poignée: { g: 30 }, noix: { g: 15 }, noisette: { g: 5 },
};

// Poids en grammes d'une quantité lue sur la ligne d'ingrédient, ou null si on ne sait pas
function grammes(valeur: number, unite: string, a: Aliment): number | null {
  if (unite === 'g') return valeur;
  if (unite === 'ml') return valeur * (a.densite ?? 1);
  const m = MESURES[unite];
  if (m?.g != null) return valeur * m.g;
  if (m?.ml != null) return valeur * m.ml * (a.densite ?? 1);
  // pièce, tranche, gousse, pavé, filet… : poids moyen d'une pièce de l'aliment
  return a.piece != null ? valeur * a.piece : null;
}

export interface Nutrition { kcal: number; prot: number; gluc: number; lip: number; comptes: number; nonComptes: string[] }

// Valeurs pour toute la recette telle qu'elle est écrite ; diviser par le nombre de portions pour une portion
export function nutrition(ingredients: string[]): Nutrition {
  const t: Nutrition = { kcal: 0, prot: 0, gluc: 0, lip: 0, comptes: 0, nonComptes: [] };
  for (const ligne of ingredients) for (const l of lireLigne(ligne, 1)) {
    const a = trouverAliment(l.nom);
    // sans quantité (« sel, poivre », « quelques fruits rouges ») : négligeable si l'aliment est connu
    const g = a && (l.valeur == null ? (a.kcal < 50 ? 0 : null) : grammes(l.valeur, l.unite, a));
    if (!a || g == null) { if (l.nom.trim()) t.nonComptes.push(l.nom.trim()); continue; }
    t.kcal += a.kcal * g / 100; t.prot += a.prot * g / 100; t.gluc += a.gluc * g / 100; t.lip += a.lip * g / 100;
    t.comptes++;
  }
  return t;
}
