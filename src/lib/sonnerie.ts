// Sonnerie de fin de minuteur, sans connexion : bips forts répétés + vibration, jusqu'à ce qu'on l'arrête.
// Le son doit être « débloqué » par un appui de l'utilisateur (règle des navigateurs) : deverrouillerSon() à chaque appui.
let ctx: AudioContext | null = null;
let boucle: ReturnType<typeof setInterval> | null = null;
let arret: ReturnType<typeof setTimeout> | null = null;

export function deverrouillerSon() {
  try { ctx ??= new AudioContext(); if (ctx.state === 'suspended') void ctx.resume(); } catch { /* pas de son disponible */ }
}

// Quatre bips forts à partir de l'instant « a » (horloge audio), envoyés vers « sortie »
function serie(c: AudioContext, sortie: AudioNode, a: number) {
  [0, 0.25, 0.5, 0.75].forEach((t, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'square'; o.frequency.value = i % 2 ? 1320 : 990; g.gain.value = 0.5;
    o.connect(g).connect(sortie); o.start(a + t); o.stop(a + t + 0.18);
  });
}

// Sonnerie programmée sur l'horloge audio dès le lancement du minuteur : elle part à l'heure exacte,
// même si le téléphone ralentit la page (écran éteint, autre appli au premier plan).
const DUREE = 120; // secondes, comme sonner()
const programmes = new Map<string, { sortie: GainNode; debut: number; fin: number }>();
export function programmerSonnerie(id: string, finMs: number) {
  if (programmes.has(id) || !ctx || ctx.state !== 'running') return; // son pas encore débloqué : la boucle de sonner() prendra le relais
  try {
    const c = ctx; const debut = c.currentTime + Math.max(0, (finMs - Date.now()) / 1000);
    const sortie = c.createGain(); sortie.connect(c.destination);
    for (let k = 0; k * 1.5 < DUREE; k++) serie(c, sortie, debut + k * 1.5);
    programmes.set(id, { sortie, debut, fin: debut + DUREE });
  } catch { /* pas de son disponible */ }
}
export function annulerSonnerie(id: string) {
  const p = programmes.get(id);
  if (p) { p.sortie.disconnect(); programmes.delete(id); }
}
export const sonneriesProgrammees = () => [...programmes.keys()];

function bips() {
  navigator.vibrate?.([500, 150, 500, 150, 500]);
  try {
    deverrouillerSon();
    if (!ctx) return;
    const c = ctx;
    // une sonnerie programmée joue déjà : pas de double son
    if ([...programmes.values()].some(p => p.debut <= c.currentTime && c.currentTime < p.fin)) return;
    serie(c, c.destination, c.currentTime);
  } catch { /* pas de son disponible */ }
}

// Sonne toutes les 1,5 s pendant 2 minutes au plus, jusqu'à arreterSonnerie()
export function sonner() {
  if (boucle) return;
  bips();
  boucle = setInterval(bips, 1500);
  arret = setTimeout(arreterSonnerie, 120000);
}

export function arreterSonnerie() {
  if (boucle) clearInterval(boucle);
  if (arret) clearTimeout(arret);
  boucle = null; arret = null;
  navigator.vibrate?.(0);
}

// Ancienne sonnerie courte (mode cuisine d'une recette)
export const alerte = bips;

// Écran allumé tant qu'un minuteur tourne (sinon le téléphone se met en veille et le minuteur s'arrête)
let verrou: WakeLockSentinel | null = null;
export function ecranAllume(oui: boolean) {
  if (oui && !verrou) navigator.wakeLock?.request('screen').then(l => { verrou = l; l.addEventListener('release', () => { verrou = null; }); }).catch(() => {});
  if (!oui && verrou) { void verrou.release().catch(() => {}); verrou = null; }
}
