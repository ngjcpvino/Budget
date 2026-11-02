/* =====================================================================
   TIERS, PLUS, COMPARATIF
   ===================================================================== */

/* ----- Page Tiers : ce que chaque tiers doit à chacun (tout jusqu'au 31 décembre de l'année choisie); toucher un tiers ouvre ses transactions de l'année ----- */
function pageTiers() {
  const [N, J] = donnees.p, y = anneeCourante, maintenant = soldes(lignesJusqua(y + '-12-31')).ti, avant = soldes(lignesJusqua((y - 1) + '-12-31')).ti;
  const lignes = depensesAnnee(), rien = { [N]: 0, [J]: 0 };
  return donnees.tiers.map(t => {
    const o = maintenant[t] || rien;
    return `<div class="carte tiers ${tiersOuvert === t ? 'ouvert' : ''}" onclick="ouvrirTiers('${js(t)}')"><h3>${securiser(t)}</h3>`
      + `<p>Doit à ${securiser(N)} <b class=texte-n>${argent(o[N])}</b></p><p>Doit à ${securiser(J)} <b class=texte-jc>${argent(o[J])}</b></p>`
      + `<div class=boutons><button class=bouton-principal onclick="event.stopPropagation();editerPaiement(null,{by:'${js(t)}'})">↩ Inscrire un remboursement</button></div>`
      + (tiersOuvert === t ? listeTiers(t, lignes, avant[t] || rien) : '') + '</div>';
  }).join('') + `<div class=boutons><button onclick="ajouterTiers()">+ Ajouter un tiers</button></div>`;
}
function ouvrirTiers(t) {
  tiersOuvert = tiersOuvert === t ? '' : t;
  afficher();
}
/* Une rangée par transaction (sa part, ou le remboursement en moins), la plus récente en haut, puis ce qui restait dû de l'année d'avant */
function listeTiers(t, lignes, report) {
  const [N, J] = donnees.p, y = anneeCourante - 1, liste = [];
  lignes.forEach(e => {
    if ((e.type === 'r' || e.type === 't') && e.by === t) liste.push({ e, v: -(+e.amt || 0), qui: e.type === 'r' ? 'à ' + e.nzf : 'sur la ' + nomCompte(e.to) });
    else if (compteDansBudget(e)) {
      const v = partDe(e, t);
      if (v) liste.push({ e, v, qui: e.by });
    }
  });
  liste.sort((a, b) => b.e.d.localeCompare(a.e.d));
  const reports = [N, J].filter(p => Math.abs(report[p]) > 0.004)
    .map(p => `<div class=rangee-tiers><span class="quand texte-discret">${y}</span><span class=quoi>Reporté de ${y}<small>à ${securiser(p)}</small></span><b class=${p === N ? 'texte-n' : 'texte-jc'}>${argent(report[p])}</b></div>`);
  const rangeeTiers = x => `<div class=rangee-tiers onclick="editerEntree('${x.e.id}')"><span class="quand texte-discret">${dateCourte(x.e.d)}</span>`
    + `<span class=quoi>${securiser(x.e.desc || (x.e.type === 'r' || x.e.type === 't' ? LIBELLES_TYPE.r : x.e.cat))}<small>${securiser(x.qui)}</small></span>`
    + `<b class="${x.v < 0 ? '' : x.e.by === N ? 'texte-n' : 'texte-jc'}">${x.v < 0 ? '− ' + argent(-x.v) : argent(x.v)}</b></div>`;
  return `<div class=liste-tiers onclick="event.stopPropagation()">${liste.map(rangeeTiers).join('')}${reports.join('')}${liste.length || reports.length ? '' : `<div class=vide>Aucune transaction en ${anneeCourante}.</div>`}</div>`;
}
function ajouterTiers() {
  demanderTexte('Nom du tiers', '', nom => {
    if (!donnees.tiers.includes(nom)) {
      donnees.tiers.push(nom);
      changerReglages();
    }
    fermerFenetre();
    afficher();
  }, fermerFenetre);
}

/* ----- Page Plus ----- */
function pagePlus() {
  return `<div class=carte><h3>Données</h3><div class=boutons><button onclick="actualiser()">Actualiser</button><button onclick="copieSecurite()">Copie de sécurité</button><button onclick="trouver('#fr').click()">Importer un relevé</button></div></div>`
    + `<div class=carte><h3>Comptes</h3><div class=boutons><button onclick="aller('cpt')">Voir les soldes des comptes</button></div></div>`
    + `<div class=carte><h3>Récurrentes</h3><div class=boutons><button onclick="pageRecurrentes()">Gérer les récurrentes</button></div></div>`
    + `<div class=carte><h3>Modifier</h3><div class=boutons><button onclick="listeModifiable('cats')">Catégories</button><button onclick="listeModifiable('tiers')">Tiers</button><button onclick="listeModifiable('env')">Placements</button><button onclick="listeModifiable('modes')">Comptes</button></div></div>`
    + `<div class=carte><h3>Code d'entrée</h3><div class=boutons><button onclick="verrouiller('actuel')">Changer le code</button></div>`
    + `<label class=espace-haut>Relier un autre appareil : envoyer le lien et le code à<input id=f_courriel type=email autocomplete=email value="${securiser(courrielLiaison)}"></label>`
    + '<div class=boutons><button id=b_courriel class=bouton-principal onclick="relierAutreAppareil()">Envoyer</button></div></div>'
    + '<div class=carte><div class=boutons><button onclick="verrouiller()">Déconnexion</button></div></div>';
}

/* La copie de sécurité : tout le budget dans un fichier (budget-2026-11-02.json) */
function copieSecurite() {
  const texte = JSON.stringify({ ex: donnees.ex, rec: donnees.rec, cfg: configuration() });
  ouvrirFenetre(`<h2>Copie de sécurité</h2><textarea id=f_bk class=zone-copie>${securiser(texte)}</textarea><div class="boutons espace-haut"><button onclick="fermerFenetre()">Fermer</button><button class=bouton-principal onclick="telecharger()">Télécharger</button></div>`);
}
function telecharger() {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([trouver('#f_bk').value], { type: 'application/json' }));
  lien.download = 'budget-' + aujourdhui() + '.json';
  lien.click();
}

/* ----- Comparatif entre les années (menu des années) : les années décochées restent décochées sur l'appareil;
   « Même période » = du 1er janvier à la même date qu'aujourd'hui ----- */
function cocherAnnee(y) {
  decochees = decochees.includes(y) ? decochees.filter(x => x !== y) : [...decochees, y];
  try { localStorage.setItem('budgetCmp', JSON.stringify(decochees)); } catch (e) { /* le choix vaut pour cette fois */ }
  afficher();
}
const ecart = (v, avant) => {
  const x = (v / avant - 1) * 100;
  return (x < 0 ? '−' : '+') + Math.abs(x).toLocaleString('fr-CA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
};
function pageComparatif() {
  const [N, J] = donnees.p, choix = cmpMode, jour = aujourdhui().slice(5);
  const annees = [...new Set(lignesVivantes().filter(compteDansBudget).map(e => +e.d.slice(0, 4)))].sort(), cochees = annees.filter(y => !decochees.includes(y));
  if (!annees.length) return `<div class=carte><div class=vide>Aucune donnée à comparer.</div></div>`;
  const haut = `<div class=filtres>${annees.map(y => `<button class="coche ${cochees.includes(y) ? 'bouton-principal' : ''}" onclick="cocherAnnee(${y})">${cochees.includes(y) ? '☑' : '☐'} ${y}</button>`).join('')}</div>`
    + `<div class=filtres><button class="${cmpPeriode === 'p' ? 'bouton-principal' : ''}" onclick="cmpPeriode='p';afficher()">Même période</button><button class="${cmpPeriode === 'c' ? 'bouton-principal' : ''}" onclick="cmpPeriode='c';afficher()">Années complètes</button><select onchange="cmpMode=this.value;afficher()">${options(MODES(), choix)}</select></div>`
    + `<p class=texte-discret>${cmpPeriode === 'p' ? `Du 1er janvier au ${+jour.slice(3)} ${MOIS_LONGS[+jour.slice(0, 2) - 1].toLowerCase()} de chaque année.` : 'Les années complètes.'}</p>`;
  if (!cochees.length) return haut + `<div class=carte><div class=vide>Coche au moins une année.</div></div>`;
  const S = cochees.map(y => stats(lignesVivantes().filter(e => e.d.startsWith(y) && (cmpPeriode === 'c' || e.d.slice(5) <= jour)), choix));
  const carte = (titre, valeurs, couleur) => `<div class=carte><h3>${titre}</h3><div class=annees style="--c:${couleur}">${valeurs.map((v, i) => `<div><small>${cochees[i]}${i && valeurs[i - 1] > 0 ? ' · ' + ecart(v, valeurs[i - 1]) : ''}</small><b>${argent(v)}</b></div>`).join('')}</div></div>`;
  const categories = [...new Set(S.flatMap(s => Object.keys(s.cat)))].filter(k => S.some(s => (s.cat[k] || 0) > 0.004)).sort((x, y) => (S[S.length - 1].cat[y] || 0) - (S[S.length - 1].cat[x] || 0));
  return haut + carte(securiser(libelleMode(choix)), S.map(s => s.tot), choix === N ? 'var(--couleur-n)' : choix === J ? 'var(--couleur-jc)' : 'var(--couleur-principale)')
    + categories.map(k => carte(iconeCategorie(k) + ' ' + securiser(k), S.map(s => s.cat[k] || 0), couleurCategorie(k))).join('');
}
