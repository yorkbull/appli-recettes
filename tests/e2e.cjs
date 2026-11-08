const { chromium, devices } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8800/appli-recettes/';
const SHOTS = process.argv[2], PHOTO = process.argv[3];
const res = []; const ok = (n, c, d = '') => { res.push([c ? '✓' : '✗', n, d]); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const shot = n => page.screenshot({ path: `${SHOTS}/${n}.png` });
  await page.goto(BASE); await page.waitForSelector('.barre');
  await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready, null, { timeout: 10000 });
  const inst = await cdp.send('Page.getInstallabilityErrors'); ok('Installable (Chrome Android)', inst.installabilityErrors.length === 0, JSON.stringify(inst.installabilityErrors));
  const man = await cdp.send('Page.getAppManifest'); ok('Manifeste sans erreur', !man.errors.length, JSON.stringify(man.errors));
  ok('Écran Semaine au lancement', await page.locator('h1', { hasText: 'Cette semaine' }).count() === 1);
  ok('7 jours × 3 repas', await page.locator('.case').count() === 21);
  await shot('01-semaine-vide');

  // Mes recettes : exemples
  await page.click('.menu a:has-text("Mes recettes")'); await page.click('text=Ajouter 5 recettes d’exemple');
  await page.waitForSelector('.ligne-recette'); ok('5 recettes d’exemple', await page.locator('.ligne-recette').count() === 5);
  await page.fill('input[type=search]', 'lardons'); ok('Recherche par ingrédient', await page.locator('.ligne-recette').count() === 1);
  await page.fill('input[type=search]', ''); await page.click('.pastille:has-text("Végétarien")');
  ok('Filtre thématique', await page.locator('.ligne-recette').count() === 2);
  await page.click('.pastille:has-text("Végétarien")'); await page.click('.pastille:has-text("Moins de 20 min")');
  ok('Filtre moins de 20 min', await page.locator('.ligne-recette').count() === 2, String(await page.locator('.ligne-recette').count()));
  await page.click('.pastille:has-text("Moins de 20 min")');
  await shot('02-mes-recettes');

  // Fiche : portions, annotation, favori
  await page.click('.ligne-recette:has-text("Gratin")');
  ok('Fiche : 1,5 kg pour 6', await page.locator('.ingredients li').first().innerText() === '1,5 kg de pommes de terre');
  for (let k = 0; k < 2; k++) await page.click('.portions button[aria-label=Moins]');
  ok('Portions 6 → 4 : 1 kg', await page.locator('.ingredients li').first().innerText() === '1 kg de pommes de terre', await page.locator('.ingredients li').first().innerText());
  ok('Portions 6 → 4 : 33 cl de crème', (await page.locator('.ingredients li').nth(1).innerText()).startsWith('33 cl'), await page.locator('.ingredients li').nth(1).innerText());
  await page.fill('textarea', 'Moins de crème, plus de muscade'); await page.click('text=Ajouter l’annotation');
  await page.click('button[aria-label="Ajouter aux favoris"]');
  await shot('03-fiche');
  await page.reload(); await page.waitForSelector('.annotation');
  ok('Annotation et favori gardés après rechargement', await page.locator('.annotation').count() === 1 && await page.locator('button[aria-label="Retirer des favoris"]').count() === 1);

  // Mode cuisine
  await page.click('text=Mode cuisine'); await page.waitForSelector('.cuisine');
  ok('Mode cuisine : étape 1 sur 4', (await page.locator('.num').innerText()) === 'Étape 1 sur 4');
  await page.click('text=Suivante'); await page.click('text=Suivante');
  const mn = await page.locator('.cuisine-etape .minuteur').allInnerTexts(); ok('Minuteur détecté (10 min)', mn.some(t => t.includes('10 min')), JSON.stringify(mn));
  await page.locator('.cuisine-etape .minuteur').first().click(); await page.waitForTimeout(1200);
  ok('Minuteur lancé (compte à rebours affiché)', /\d+:\d\d · 10 min/.test(await page.locator('.cuisine').innerText()), await page.locator('.cuisine > div').nth(2).innerText());
  ok('Écran maintenu allumé disponible', await page.evaluate(() => 'wakeLock' in navigator));
  await shot('04-mode-cuisine');
  await page.click('button[aria-label="Quitter le mode cuisine"]');

  // Semaine : choisir, restes, déplacer
  await page.click('.menu a:has-text("Semaine")'); await page.waitForSelector('.case');
  await page.locator('.jour').nth(0).locator('.case').nth(2).click(); // lundi soir
  await page.waitForSelector('.feuille');
  const sugg = await page.locator('.feuille .ligne-recette b').allInnerTexts();
  ok('Suggestions du soir en premier', /Gratin|Saumon|carbonara/.test(sugg[0]) && !/Porridge|Croque/.test(sugg.slice(0, 3).join()), JSON.stringify(sugg));
  await shot('05-choisir');
  await page.locator('.feuille .ligne-recette', { hasText: 'carbonara' }).click();
  ok('Repas placé lundi soir', (await page.locator('.jour').nth(0).locator('.case').nth(2).innerText()).includes('carbonara'));
  const caseLundiSoir = page.locator('.jour').nth(0).locator('.case').nth(2);
  const b = await caseLundiSoir.boundingBox();
  await page.mouse.move(b.x + 100, b.y + 20); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await page.waitForSelector('.feuille'); await page.click('text=Faire des restes pour mardi midi');
  ok('Restes mardi midi', (await page.locator('.jour').nth(1).locator('.case').nth(1).innerText()).includes('Restes'));
  ok('Portions doublées lundi soir (2 → 4)', (await caseLundiSoir.innerText()).includes('4 p.'), await caseLundiSoir.innerText());
  // déplacer les restes vers jeudi midi
  const mardi = page.locator('.jour').nth(1).locator('.case').nth(1); const bb = await mardi.boundingBox();
  await page.mouse.move(bb.x + 100, bb.y + 20); await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
  await page.click('.feuille >> text=Déplacer'); await page.locator('.jour').nth(3).locator('.case').nth(1).click();
  ok('Déplacer vers jeudi midi', (await page.locator('.jour').nth(3).locator('.case').nth(1).innerText()).includes('Restes') && (await mardi.innerText()).includes('Choisir'));
  // repas dehors mercredi midi
  await page.locator('.jour').nth(2).locator('.case').nth(1).click(); await page.click('.feuille >> text=Repas dehors');
  ok('Repas dehors', (await page.locator('.jour').nth(2).locator('.case').nth(1).innerText()).includes('Repas dehors'));
  await page.locator('.jour').nth(0).locator('.case').nth(0).click(); await page.locator('.feuille .ligne-recette', { hasText: 'Porridge' }).click();
  await shot('06-semaine');

  // Semaine suivante + reprendre
  await page.click('.carte-suivante'); ok('Semaine suivante', await page.locator('h1', { hasText: 'Semaine prochaine' }).count() === 1);
  await page.click('text=Reprendre la semaine dernière'); await page.waitForTimeout(300);
  const n2 = await page.evaluate(() => [...document.querySelectorAll('.case')].filter(c => !c.innerText.includes('Choisir')).length);
  ok('Reprendre la semaine dernière : 4 repas', n2 === 4, String(n2));
  await page.click('.barre .nom'); await page.waitForTimeout(200);
  ok('Toucher le nom ramène à cette semaine', await page.locator('h1', { hasText: 'Cette semaine' }).count() === 1);

  // Mois
  await page.click('.menu a:has-text("Mois")'); await page.waitForSelector('.grille-mois');
  ok('Vue mois avec repas', (await page.locator('.points i.plein').count()) >= 4, String(await page.locator('.points i.plein').count()));
  await shot('07-mois');

  // Nouvelle recette par texte collé + photo
  await page.click('a[aria-label="Ajouter une recette"]'); await page.click('text=Coller le texte d’une recette');
  await page.fill('.feuille textarea', 'Velouté de potiron\nPour 4 personnes\nIngrédients\n- 1 kg de potiron\n- 1 oignon\n- 20 cl de crème\nPréparation\n1. Couper le potiron et l’oignon.\n2. Cuire 25 min dans 1 l d’eau.\n3. Mixer avec la crème.');
  await page.click('.feuille >> text=Remplir');
  ok('Texte collé : titre repris', await page.inputValue('input[type=text] >> nth=0') === 'Velouté de potiron');
  await page.setInputFiles('input[type=file]', PHOTO); await page.waitForSelector('.photo-choix img', { timeout: 20000 });
  const taille = await page.evaluate(() => Math.round(document.querySelector('.photo-choix img').src.length * 0.75 / 1000));
  ok('Photo 12 Mpx compressée', taille < 200, taille + ' Ko');
  await shot('08-ajouter');
  await page.click('text=Enregistrer'); await page.waitForSelector('.fiche');
  ok('Recette créée : 3 ingrédients, 3 étapes', await page.locator('.ingredients li').count() === 3 && await page.locator('.etapes li').count() === 3);
  await page.goBack(); await page.waitForTimeout(300);
  ok('Retour après enregistrement : pas de formulaire', !(await page.url()).includes('editer'), page.url());

  // Hors ligne
  await ctx.setOffline(true); await page.goto(BASE + '#/recettes'); await page.waitForSelector('.ligne-recette');
  ok('Hors ligne : 6 recettes', await page.locator('.ligne-recette').count() === 6);
  await ctx.setOffline(false);
  // Partage Android
  await page.goto(BASE + '?titre=Tarte&texte=Regarde%20https%3A%2F%2Fwww.marmiton.org%2Frecettes%2Ftarte.aspx');
  await page.waitForSelector('text=Lien reçu'); ok('Partage Android : lien reçu', (await page.locator('.carte.petit a').innerText()).includes('marmiton'));
  // Réglages
  await page.goto(BASE + '#/reglages'); await page.waitForSelector('text=Thématiques');
  await page.fill('input[placeholder="Nouvelle thématique"]', 'Dessert'); await page.click('.ligne-reglage >> text=Ajouter');
  ok('Thématique ajoutée', await page.locator('.ligne-reglage input').count() === 7);
  await shot('09-reglages');
  // Supprimer une recette planifiée : retirée du planning
  await page.goto(BASE + '#/recettes'); await page.click('.ligne-recette:has-text("carbonara")');
  page.once('dialog', d => d.accept()); await page.click('text=Supprimer la recette'); await page.waitForSelector('h1:has-text("Mes recettes")');
  await page.goto(BASE + '#/semaine'); await page.waitForSelector('.case');
  ok('Recette supprimée retirée du planning', !(await page.locator('.jour').nth(0).innerText()).includes('carbonara'));
  ok('Aucune erreur dans la console', errs.length === 0, errs.join(' | '));
  await browser.close();
  for (const r of res) console.log(r.join(' '));
  console.log(`\n${res.filter(r => r[0] === '✓').length}/${res.length} contrôles réussis`);
})().catch(async e => { for (const r of res) console.log(r.join(' ')); console.error('ERREUR', e.message); process.exit(1); });
