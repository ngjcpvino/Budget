/* =====================================================================
   NAVIGATION ET ACCUEIL
   ===================================================================== */

/* Les choix du budget : les communes, le perso de chacun, tout */
const MODES = () => [['', 'Communes'], ...donnees.p.map(p => [p, p]), ['t', 'Tout']];
const libelleMode = m => m === '' ? 'Dépenses communes' : m === 't' ? 'Toutes les dépenses' : 'Perso de ' + m;

/* La barre du bas */
const ICONES_NAVIGATION = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  ti: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-4 3-6 6-6s6 2 6 6M16 5a3 3 0 010 6M18 14c2 1 3 3 3 6"/>',
  env: '<path d="M3 7h18v12H3zM3 7l9 7 9-7"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'
};
function afficherNavigation() {
  const allume = page => vue === page || (page === 'more' && ['cpt', 'rel', 'cl'].includes(vue)) || (page === 'env' && vue === 'pl');
  trouver('#navigation').innerHTML = [['home', 'Accueil'], ['list', 'Dépenses'], ['env', 'Placements'], ['ti', 'Tiers'], ['more', 'Plus']]
    .map(([page, mot]) => `<button class="icone-mot${allume(page) ? ' actif' : ''}" onclick="aller('${page}')"><svg viewBox="0 0 24 24">${ICONES_NAVIGATION[page]}</svg>${mot}</button>`)
    .join('');
}

/* Aller à une page (f : des filtres pour la page Dépenses). Rouvrir l'Accueil le remet aux communes; changer de page referme la liste d'un tiers */
function aller(page, f) {
  vue = page;
  if (f) {
    filtres = { m: '', c: '', p: '', q: '', ...f };
    niveau = f.c ? 'd' : 'c';
  }
  if (page === 'home') modeAccueil = '';
  tiersOuvert = '';
  nouvelleEntree(false);
  afficher();
}

/* Redessiner la page en cours */
const PAGES = {
  home: () => pageAccueil(), list: () => pageDepenses(), ti: () => pageTiers(), env: () => pageEnveloppes(), pl: () => pagePlacement(),
  cpt: () => pageComptes(), cmp: () => pageComparatif(), rel: () => pageReleve(), cl: () => pageCompteLignes(), more: () => pagePlus()
};
function afficher() {
  const titre = vue === 'cmp' ? 'Comparatif' : 'Budget ' + anneeCourante;
  trouver('#titre').textContent = titre;
  trouver('#annees').innerHTML = listeAnnees();
  document.title = titre;
  afficherNavigation();
  trouver('#contenu').innerHTML = lecture ? pageLecture() : (PAGES[vue] || PAGES.more)();
}

/* Le menu des années : les années, Comparatif, Ajouter */
function listeAnnees() {
  const annees = [...new Set([new Date().getFullYear(), anneeCourante, ...(donnees.yrs || []), ...donnees.ex.filter(e => e.d).map(e => +e.d.slice(0, 4))])].sort();
  return annees.map(y => `<option ${vue !== 'cmp' && y === anneeCourante ? 'selected' : ''}>${y}</option>`).join('')
    + `<option value=cmp ${vue === 'cmp' ? 'selected' : ''}>Comparatif</option><option value=add>Ajouter</option>`;
}
function changerAnnee(choix) {
  filtres = { m: '', c: '', p: '', q: '' };
  modeAccueil = '';
  tiersOuvert = '';
  nouvelleEntree(false);
  if (choix === 'cmp') {
    vue = 'cmp';
    return afficher();
  }
  vue = 'home';
  if (choix === 'add' && lecture) {
    afficherMessage(PAS_LUES);
    return afficher();
  }
  if (choix === 'add') return demanderTexte('Quelle année ?', '', texte => {
    const n = +texte;
    if (n >= 2000 && n <= 2100) {
      donnees.yrs = [...new Set([...(donnees.yrs || []), n])];
      changerReglages();
      anneeCourante = n;
      fermerFenetre();
      afficher();
    } else afficherMessage('Entre une année, par exemple 2027.');
  }, () => { fermerFenetre(); afficher(); });
  anneeCourante = +choix;
  afficher();
}

/* Pendant la première lecture de la feuille (rien encore sur l'appareil), sur toutes les pages */
function pageLecture() {
  return lecture === 'attente'
    ? '<div class=carte><div class=vide>Lecture du budget…</div></div>'
    : `<div class=carte><div class=vide>Les dépenses n'ont pas pu être lues : vérifie le réseau.</div><div class=boutons><button onclick="actualiser()">Réessayer</button></div></div>`;
}

/* ----- Page Accueil ----- */
/* Toucher le « Perso » d'une personne : graphique et catégories ne montrent que son perso; le retoucher (ou ✕) ramène aux communes */
function voirMode(p) {
  modeAccueil = modeAccueil === p ? '' : p;
  afficher();
}

function pageAccueil() {
  const [N, J] = donnees.p, y = anneeCourante, lignes = depensesAnnee();
  const communes = stats(lignes, '').tot, perso = { [N]: stats(lignes, N).tot, [J]: stats(lignes, J).tot };
  const dettes = soldes(lignesJusqua(y + '-12-31')), doit = dettes.solde, aZero = Math.abs(doit) < 0.005;
  if (!lignes.length && aZero) return `<div class=carte><div class=vide>Aucune dépense en ${y}.<br>Touche + pour commencer.</div></div>`;
  const choix = modeAccueil, s = stats(lignes, choix);
  const retour = choix ? `<div class="carte mode-actif"><span class=${choix === N ? 'texte-n' : 'texte-jc'}>${securiser(libelleMode(choix))}</span><button class=carre onclick="voirMode('')" aria-label="Revenir aux communes">✕</button></div>` : '';
  return [blocCommunes(N, J, y, communes, perso, choix), blocCarte(N, J, dettes, doit, aZero), blocPlacements(y), retour, blocGraphique(s, choix), blocCategories(s, choix)].join('\n');
}

/* Le 1er rectangle : les dépenses communes, puis une colonne par personne (part commune, perso, total) */
function blocCommunes(N, J, y, communes, perso, choix) {
  const colonne = (p, i) => `<div><h3 class=${i ? 'texte-jc' : 'texte-n'}>${securiser(p)}</h3>`
    + `<p class=texte-discret>Part commune <b>${argent(communes / 2)}</b></p>`
    + `<p class="texte-discret touche${choix === p ? ' actif' : ''}" onclick="voirMode('${js(p)}')">Perso <b>${argent(perso[p])}</b></p>`
    + `<p class="texte-discret total">Total <b>${argent(communes / 2 + perso[p])}</b></p></div>`;
  return `<div class="carte grande"><small>Dépenses communes en ${y}</small><b>${argent(communes)}</b><div class="separe colonnes">${[N, J].map(colonne).join('')}</div></div>`;
}

/* La carte de crédit de la 1re personne (la MC) se partage : la 2e personne y paie ce qu'elle doit, chaque tiers ce qu'il doit encore à la 1re,
   la 1re le reste. Sans carte : l'ancien « qui doit à qui » */
function blocCarte(N, J, dettes, doit, aZero) {
  const carte = carteDe(N);
  if (!carte) {
    if (aZero) return `<div class="carte grande"><b>${argent(0)}</b></div>`;
    return `<div class="carte grande solde ${doit > 0 ? 'personne-2' : 'personne-1'}"><small>${doit > 0 ? securiser(J) + ' doit à ' + securiser(N) : securiser(N) + ' doit à ' + securiser(J)}</small><b>${argent(Math.abs(doit))}</b></div>`;
  }
  const nom = securiser(nomCompte(carte)), soldeCarte = (calculerComptes().find(x => x.cle === carte) || {}).valeur || 0;
  const tiers = Object.entries(dettes.ti).filter(x => x[1][N] > 0.004), partTiers = tiers.reduce((s, x) => s + x[1][N], 0);
  return `<div class=cartes><div class="carte grande solde personne-2"><small>${securiser(J)} doit payer sur la ${nom}</small><b>${argent(doit)}</b></div>`
    + `<div class="carte grande solde personne-1"><small>${securiser(N)}, sur la ${nom}</small><b>${argent(soldeCarte - doit - partTiers)}</b></div>`
    + tiers.map(x => `<div class="carte grande tiers-mc"><small>${securiser(x[0])}, sur la ${nom}</small><b>${argent(x[1][N])}</b></div>`).join('')
    + `</div><p class=texte-discret>Solde de la ${nom} : ${argent(soldeCarte)}</p>`;
}

/* Nos placements : une tuile par placement (toucher = sa page) */
function blocPlacements(y) {
  const E = calculerEnveloppes();
  if (!E.length) return '';
  const passee = y < new Date().getFullYear();
  return `<div class=carte><div class=titre-bloc><h3>Nos placements</h3>${passee ? `<small>au 31 décembre ${y}</small>` : ''}</div><div class=tuiles>`
    + E.map(x => `<div class=tuile onclick="voirPlacement('${js(x.nom)}')"><span class=icone>${iconeEnveloppe(x)}</span><div>${securiser(x.nom)}<b class="${x.solde < 0 ? 'negatif' : ''}">${argent(x.solde)}</b></div></div>`).join('')
    + '</div></div>';
}

/* Le graphique des mois (empilé par catégorie), la moyenne en pointillé; toucher un mois = la page Dépenses */
function blocGraphique(s, choix) {
  const max = Math.max(...s.mon, 1), actifs = s.mon.filter(v => v > 0), moyenne = actifs.length ? actifs.reduce((a, v) => a + v, 0) / actifs.length : 0;
  const colonne = (v, i) => `<div class=colonne onclick="aller('list',{m:'${i + 1}',p:'${js(choix)}'})"><div class=pile style="height:${v / max * 100}%">`
    + Object.entries(s.mc[i]).filter(x => x[1] > 0).map(x => `<i style="flex:${x[1]};background:${couleurCategorie(x[0])}"></i>`).join('') + '</div></div>';
  return `<div class=carte><h3>Dépenses mensuelles</h3><div class=graphique><div class=ligne-moyenne style="bottom:${moyenne / max * 100}%"></div>${s.mon.map(colonne).join('')}</div>`
    + `<div class=etiquettes-mois>${MOIS_COURTS.map(m => `<span class=texte-discret data-i="${m[0]}">${m}</span>`).join('')}</div>`
    + `<div class=sous-texte>Moyenne mensuelle : ${argent(moyenne)} (ligne pointillée)</div></div>`;
}

/* Une carte par catégorie, la plus grosse en haut; toucher = la page Dépenses de cette catégorie */
function blocCategories(s, choix) {
  return Object.entries(s.cat).sort((x, z) => z[1] - x[1]).filter(x => x[1] > 0.005)
    .map(x => carteCategorie(x[0], x[1], s.tot, '', "aller('list',{c:'" + js(x[0]) + "',p:'" + js(choix) + "'})")).join('')
    || '<div class=carte><div class=vide>Rien à afficher.</div></div>';
}
