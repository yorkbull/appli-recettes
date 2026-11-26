// Sonnerie de fin de minuteur (vibration + trois bips), sans connexion
export function alerte() {
  navigator.vibrate?.([400, 200, 400, 200, 400]);
  try {
    const ctx = new AudioContext();
    [0, 0.35, 0.7].forEach(t => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = 880; g.gain.value = 0.2; o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2); });
  } catch { /* pas de son disponible */ }
}
