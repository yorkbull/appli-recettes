// Sonnerie de fin de minuteur, sans connexion : bips forts répétés + vibration, jusqu'à ce qu'on l'arrête.
// Le son doit être « débloqué » par un appui de l'utilisateur (règle des navigateurs) : deverrouillerSon() à chaque appui.
let ctx: AudioContext | null = null;
let boucle: ReturnType<typeof setInterval> | null = null;
let arret: ReturnType<typeof setTimeout> | null = null;

export function deverrouillerSon() {
  try { ctx ??= new AudioContext(); if (ctx.state === 'suspended') void ctx.resume(); } catch { /* pas de son disponible */ }
}

function bips() {
  navigator.vibrate?.([500, 150, 500, 150, 500]);
  try {
    deverrouillerSon();
    if (!ctx) return;
    const c = ctx;
    [0, 0.25, 0.5, 0.75].forEach((t, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = 'square'; o.frequency.value = i % 2 ? 1320 : 990; g.gain.value = 0.5;
      o.connect(g).connect(c.destination); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.18);
    });
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
