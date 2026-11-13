/* =====================================================================
   LE RELEVÉ DE LA CARTE (le fichier CSV de la banque : le + → Import)
   Tout le fichier est montré, sauf ce qui est déjà dans l'app; une case à cocher par ligne : rien n'entre avant d'être coché.
   Chaque achat arrive avec ce que l'historique propose (le nom, la catégorie, le « Juste pour » s'il est clair);
   une note sous la ligne dit ce qui manque.
   ===================================================================== */

/* Un montant de la banque : « -234.24 », « 1868.85 », « 1,868.85 » */
const montantBanque = texte => {
  const s = String(texte || '').replace(/[\s$]/g, '');
  return lireMontant(s.includes('.') ? s.replace(/,/g, '') : s);
};

/* Les rangées d'un fichier CSV (les guillemets permis) */
function lireCsv(texte) {
  const rangees = [];
  let rangee = [], cellule = '', entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const x = texte[i];
    if (entreGuillemets) {
      if (x === '"' && texte[i + 1] === '"') { cellule += '"'; i++; }
      else if (x === '"') entreGuillemets = false;
      else cellule += x;
    } else if (x === '"') entreGuillemets = true;
    else if (x === ',') { rangee.push(cellule); cellule = ''; }
    else if (x === '\n' || x === '\r') {
      if (x === '\r' && texte[i + 1] === '\n') i++;
      rangee.push(cellule);
      rangees.push(rangee);
      rangee = [];
      cellule = '';
    } else cellule += x;
  }
  rangee.push(cellule);
  rangees.push(rangee);
  return rangees.filter(l => l.some(v => v.trim()));
}

/* Le fichier choisi : lu en UTF-8, sinon dans l'ancien codage de Windows (celui de la banque) */
function lireReleve(champ) {
  const fichier = champ.files[0];
  if (!fichier) return;
  const lecteur = new FileReader();
  lecteur.onload = () => {
    let texte;
    try { texte = new TextDecoder('utf-8', { fatal: true }).decode(lecteur.result); }
    catch (e) { texte = new TextDecoder('windows-1252').decode(lecteur.result); }
    champ.value = '';
    const message = preparerReleve(texte);
    if (message) return afficherMessage(message);
    if (vue !== 'rel') retourReleve = vue;
    aller('rel');
    scrollTo(0, 0);
  };
  lecteur.readAsArrayBuffer(fichier);
}

/* Les colonnes sont repérées par leur titre; la date est mois/jour/année; un achat est en moins, un paiement en plus.
   Chaque ligne de la banque a un identifiant fixe (date, montant, nom, et son rang si la même revient). Une ligne déjà dans l'app
   (venue d'un fichier précédent, même supprimée depuis) est cachée : relire un fichier ne double rien */
function preparerReleve(texte) {
  const [N] = donnees.p, carte = carteDe(N), rangees = lireCsv(texte), titres = (rangees[0] || []).map(simplifier);
  const [colDate, colNom, colMontant] = ['date', 'nom', 'montant'].map(x => titres.findIndex(v => v.startsWith(x)));
  if (!carte) return 'Il manque la carte de crédit de ' + N + ' (Plus → Comptes).';
  if (colDate < 0 || colNom < 0 || colMontant < 0) return "Ce fichier n'est pas un relevé de la " + nomCompte(carte) + '.';
  const depenses = lignesVivantes().filter(e => e.type === 'e').sort((a, b) => b.d.localeCompare(a.d)), noms = depenses.map(e => simplifier(e.desc));
  const H = { l: depenses, s: noms, d: [...new Set(noms)].filter(d => d.length > 2) }, vus = {}, lignes = [];
  let sautees = 0;
  rangees.slice(1).forEach(r => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((r[colDate] || '').trim()), v = montantBanque(r[colMontant]), nb = (r[colNom] || '').trim().replace(/\s+/g, ' ');
    const d = m ? m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0') : '';
    if (!m || !dateValide(d) || !v || !nb) { sautees++; return; }
    const k = 'tg' + d.replace(/-/g, '') + '-' + Math.round(Math.abs(v) * 100) + '-' + simplifier(nb).replace(/ /g, '').slice(0, 12), n = vus[k] = (vus[k] || 0) + 1;
    lignes.push(proposerLigne({ k: k + (n > 1 ? '-' + n : ''), d, nb, v }, carte, H));
  });
  if (!lignes.length) return 'Aucune ligne à lire dans ce fichier.';
  const dejaLa = new Set(donnees.ex.map(e => e.id)), aMontrer = lignes.filter(x => !dejaLa.has(x.k));
  if (!aMontrer.length) return "Toutes les lignes de ce fichier sont déjà dans l'app.";
  aMontrer.sort((a, b) => b.d.localeCompare(a.d));
  releve = { L: aMontrer, mc: carte, sautees, deja: lignes.length - aMontrer.length };
  return '';
}

/* L'historique d'un commerçant, le plus récent en premier : les dépenses déjà venues de la banque sous ce nom; sinon celles dont la description
   commence un mot du nom de la banque (« Super C » dans « SUPER C BERTHIERVILLE »; la plus longue description gagne).
   H est préparé une fois par fichier : l = les dépenses (la plus récente d'abord), s = leurs descriptions simplifiées, d = ces descriptions sans doublons */
/* Le nom de la banque, plus lisible (J-C, 2026-11-13) : les mots collés par leurs majuscules se séparent (« LaMaisonSimons » → « La Maison Simons »),
   et « QC » s'en va (aussi un « Q » seul au bout : le QC coupé par la banque). Le nom à la banque, lui, reste tel quel (la mémoire des commerçants) */
const nomPropre = nb => String(nb || '').replace(/([a-zà-ÿ])([A-ZÀ-Ý])/g, '$1 $2').replace(/(^|\s)QC(?=\s|$)/gi, ' ').replace(/\s+Q\s*$/i, '').replace(/\s+/g, ' ').trim();

function historique(nb, H) {
  const memeNom = H.l.filter(e => e.nb === nb);
  if (memeNom.length) return memeNom;
  const s = ' ' + simplifier(nomPropre(nb)), d = H.d.filter(d => new RegExp(' ' + d + '(?![a-z])').test(s)).sort((p, q) => q.length - p.length)[0];
  return d ? H.l.filter((e, i) => H.s[i] === d) : [];
}

/* Pour qui était une ligne : '' = en commun, un nom = toute la ligne pour lui, '*' = en plusieurs parts */
const pourQui = e => {
  const parts = partsDe(e);
  return !parts.length ? '' : parts.length === 1 && Math.abs(parts[0][1] - e.amt) < 0.005 ? parts[0][0] : '*';
};
/* [valeur, nombre], la plus fréquente d'abord */
const compter = liste => {
  const c = new Map();
  liste.forEach(v => c.set(v, (c.get(v) || 0) + 1));
  return [...c].sort((p, q) => q[1] - p[1]);
};
const noteVerifier = J => 'À vérifier : « Juste pour » ? Avant : ' + J.map(([q, n]) => n + ' fois ' + (q === '' ? 'en commun' : q === '*' ? 'en plusieurs parts' : 'pour ' + q)).join(', ') + '.';

/* Une ligne de la banque devient une proposition. Un paiement : qui paie reste à choisir. Un achat (ou un retour, en moins) de la 1re personne
   sur sa carte : le nom le plus récent, la catégorie la plus fréquente, et le « Juste pour » s'il est clair (au moins 2 fois sur 3), sinon « à vérifier » */
function proposerLigne(x, carte, H) {
  const [N] = donnees.p, o = { d: x.d, desc: '', cat: '', env: '', mode: '', to: '', nz: 0, nzf: '', nz2: 0, nzf2: '', nz3: 0, nzf3: '', nb: x.nb };
  x.coche = false;
  if (x.v > 0 && simplifier(x.nb).includes('paiement')) return Object.assign(x, { paie: 1, etat: 'qui', o: { ...o, type: 't', amt: x.v, by: '', to: carte } });
  Object.assign(o, { type: 'e', amt: -x.v, by: N, mode: carte });
  const avant = historique(x.nb, H);
  if (!avant.length) return Object.assign(x, { etat: 'nouveau', o: { ...o, desc: nomPropre(x.nb) } });
  const J = compter(avant.map(pourQui)), [q, n] = J[0], clair = q !== '*' && n * 3 >= avant.length * 2;
  const cat = compter(avant.map(e => e.cat)).map(c => c[0]).find(c => donnees.cats.includes(c)) || '';
  return Object.assign(x, { etat: clair ? 'pret' : 'verifier', nv: clair ? '' : noteVerifier(J), o: { ...o, desc: avant[0].desc, cat, ...(clair && q ? { nz: o.amt, nzf: q } : {}) } });
}

/* ----- La page du relevé : la période et le nombre de lignes; une rangée par ligne de la banque (sa note dessous, sa case au bout); Annuler · Enregistrer ----- */
const NOTES_RELEVE = {
  nouveau: 'Nouveau commerçant : touche la ligne pour lui donner un nom et une catégorie.',
  qui: 'Qui a payé ? Touche la ligne pour choisir.'
};
/* « du 16 au 22 octobre », « le 1er novembre »… */
function periode(debut, fin) {
  const jour = d => +d.slice(8) === 1 ? '1er' : +d.slice(8), mois = d => MOIS_LONGS[+d.slice(5, 7) - 1].toLowerCase(), autreAnnee = debut.slice(0, 4) !== fin.slice(0, 4);
  if (debut === fin) return 'le ' + jour(fin) + ' ' + mois(fin);
  return 'du ' + jour(debut) + (debut.slice(0, 7) !== fin.slice(0, 7) ? ' ' + mois(debut) + (autreAnnee ? ' ' + debut.slice(0, 4) : '') : '') + ' au ' + jour(fin) + ' ' + mois(fin) + (autreAnnee ? ' ' + fin.slice(0, 4) : '');
}
function pageReleve() {
  if (!releve) {
    vue = 'more';
    return pagePlus();
  }
  const [N, J] = donnees.p, { L, mc: carte, sautees, deja } = releve, cochees = L.filter(x => x.coche).length, combien = f => L.filter(f).length;
  const rangeeReleve = (x, i) => {
    const e = x.o, note = NOTES_RELEVE[x.etat] || (x.etat === 'verifier' ? x.nv : '');
    return `<div class=ligne-depense onclick="editerReleve(${i})">${caseDate(e.d)}<span class=icone>${ICONES_TYPE[e.type] || iconeCategorie(e.cat) || '❔'}</span>`
      + `<div><b>${securiser(e.desc || (e.type === 'e' ? e.cat : 'Paiement sur la ' + nomCompte(carte)))}</b><small>${e.type === 't' && !e.by ? securiser(x.nb) : detailsLigne(e)}</small>${note ? `<small class=texte-principal><b>${securiser(note)}</b></small>` : ''}</div>`
      + `<b class="${e.by === N ? 'texte-n' : e.by === J ? 'texte-jc' : ''}">${argent(e.amt)}</b>`
      + `<button class="carre${x.coche ? ' bouton-principal' : ''}" onclick="event.stopPropagation();cocherReleve(${i})" aria-label="Cocher la ligne">${x.coche ? '✓' : ''}</button></div>`;
  };
  const sortes = [[combien(x => !x.paie && x.v < 0), 'achat'], [combien(x => !x.paie && x.v > 0), 'retour'], [combien(x => x.paie), 'paiement']].filter(x => x[0]).map(x => pluriel(...x)).join(' · ');
  return `<div class="carte grande"><small>Relevé de la ${securiser(nomCompte(carte))}, ${periode(L[L.length - 1].d, L[0].d)}</small><b>${pluriel(L.length, 'ligne')}</b><small>${sortes}</small></div>`
    + (sautees ? `<p class=texte-discret>${sautees > 1 ? sautees + " lignes du fichier n'ont pas pu être lues" : "1 ligne du fichier n'a pas pu être lue"} (date ou montant).</p>` : '')
    + (deja ? `<p class=texte-discret>${deja > 1 ? deja + " lignes du fichier sont déjà dans l'app (cachées)" : "1 ligne du fichier est déjà dans l'app (cachée)"}.</p>` : '')
    + L.map(rangeeReleve).join('')
    + `<div class="boutons espace-haut"><button onclick="releve=null;aller(retourReleve)">Annuler</button><button class=bouton-principal onclick="enregistrerReleve()">${cochees > 1 ? 'Enregistrer les ' + cochees + ' lignes cochées' : cochees ? 'Enregistrer la ligne cochée' : 'Enregistrer'}</button></div>`;
}

function cocherReleve(i) {
  const x = releve.L[i];
  if (!x.coche && (x.etat === 'nouveau' || x.etat === 'qui' || (x.o.type === 'e' && !x.o.cat))) return afficherMessage("Touche d'abord la ligne pour la compléter.");
  x.coche = !x.coche;
  afficher();
}

/* Toucher une ligne : son formulaire, déjà rempli, avec « Valider » */
function editerReleve(i) {
  const o = releve.L[i].o;
  ligneReleve = i;
  if (o.type === 'e') return editerEntree(null, o);
  editerPaiement(null, { d: o.d, desc: o.desc, amt: o.amt, by: o.type === 'p' ? PLACEMENT : o.by, aq: o.type === 'r' ? o.nzf : 'mc', env: o.env, cat: o.cat });
}

/* Valider : la ligne prend le formulaire et revient cochée; les autres lignes de ce nouveau commerçant prennent son nom, sa catégorie et son « Juste pour » */
function validerReleve() {
  if (ligneReleve < 0 || !releve || !trouver('#f_amt')) return;
  const x = releve.L[ligneReleve], o = trouver('#f_t') ? objetEntree() : objetPaiement();
  if (!o) return;
  Object.assign(x, { o: { ...x.o, ...o }, etat: 'pret', coche: true });
  if (x.o.type === 'e') {
    const q = pourQui(x.o);
    releve.L.forEach(y => {
      if (y.nb === x.nb && y.etat === 'nouveau') Object.assign(y, { etat: q === '*' ? 'verifier' : 'pret', nv: noteVerifier([['*', 1]]), o: { ...y.o, desc: x.o.desc, cat: x.o.cat, ...(q && q !== '*' ? { nz: y.o.amt, nzf: q } : {}) } });
    });
  }
  fermerFenetre();
  afficher();
}

/* Enregistrer : les lignes cochées entrent d'un coup, chacune sous l'identifiant de sa ligne de banque (un reclic, ou le même fichier relu, ne double rien) */
function enregistrerReleve() {
  if (!releve) return;
  const cochees = releve.L.filter(x => x.coche), t = Date.now();
  if (!cochees.length) return afficherMessage('Coche au moins une ligne.');
  const changements = cochees.map(x => {
    const o = { ...x.o, id: x.k, u: t };
    let ligne = donnees.ex.find(y => y.id === x.k);
    if (ligne) { Object.assign(ligne, o); delete ligne.del; }
    else donnees.ex.push(ligne = o);
    return { genre: 'ligne', objet: ligne };
  });
  memoriser(changements);
  releve = null;
  aller(retourReleve);
  afficherMessage(cochees.length > 1 ? cochees.length + ' lignes ajoutées.' : '1 ligne ajoutée.');
}
