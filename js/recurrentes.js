/* =====================================================================
   LES RÉCURRENTES : codées une fois, elles s'ajoutent seules aux dépenses
   Les modèles (fréquence « Aléatoire », x) : des dépenses semblables, sans date fixe; ils ne s'ajoutent jamais seuls
   (on part d'un modèle en haut d'une nouvelle dépense : formulaires.js)
   Chaque occurrence a un identifiant fixe : « g » + la récurrence + sa date d'origine. Elle n'est jamais refaite :
   une ligne qu'on a déplacée à une autre date, ou corrigée, garde son identifiant et reste telle quelle.
   ===================================================================== */

/* La date de la k-ième occurrence (0 = la première date) */
function dateOccurrence(r, k) {
  const [y, m, d] = r.start.split('-').map(Number);
  if (r.freq === 'w' || r.freq === 'b') return dateIso(new Date(y, m - 1, d + k * (r.freq === 'w' ? 7 : 14)));
  const jour = new Date(y, m - 1 + { m: 1, q: 3, s: 6 }[r.freq] * k, 1);
  jour.setDate(Math.min(d, new Date(jour.getFullYear(), jour.getMonth() + 1, 0).getDate()));
  return dateIso(jour);
}

/* Ajoute, jusqu'à aujourd'hui, les occurrences qui manquent. Seulement après une lecture de la feuille réussie :
   une ligne déjà créée par l'autre appareil est alors connue, et n'est pas refaite (et la feuille ne l'écrase jamais : « creer ») */
function genererRecurrentes() {
  const fin = aujourdhui(), ids = new Set(donnees.ex.map(e => e.id)), neuves = [];
  donnees.rec.filter(r => !r.del && r.freq !== 'x' && dateValide(r.start)).forEach(r => {
    for (let k = 0, d; (d = dateOccurrence(r, k)) <= fin && (!r.end || d <= r.end); k++) {
      const id = 'g' + r.id + d;
      if (ids.has(id) || donnees.ex.some(e => e.rid === r.id && e.d === d)) continue;
      const ligne = { id, rid: r.id, d, desc: r.desc, cat: r.cat, amt: r.amt, by: r.by, mode: r.mode, to: '', nz: r.nz, nzf: r.nzf, nz2: r.nz2 || 0, nzf2: r.nzf2 || '',
        nz3: r.nz3 || 0, nzf3: r.nzf3 || '', type: r.type || 'e', env: r.env || '', nb: '', u: Date.now() };
      donnees.ex.push(ligne);
      ids.add(id);
      neuves.push({ genre: 'creer', objet: ligne });
    }
  });
  if (neuves.length) memoriser(neuves);
}

/* ----- La fenêtre des récurrentes : la liste, puis le formulaire d'une récurrente ----- */
const lireRecurrente = () => ({ ...lireFormulaire(), id: trouver('#f_id').value, freq: trouver('#f_fq').value, start: lc('f_d'), end: lc('f_end') });

/* Une rangée de la liste : une récurrente (sa fréquence, depuis quand) ou un modèle (son compte; son montant, ou « à entrer ») */
const rangeeRecurrente = r => `<div class=ligne-depense onclick="pageRecurrentes('${r.id}')"><span class=icone>${ICONES_TYPE[r.type] || iconeCategorie(r.cat) || ''}</span>`
  + `<div><b>${securiser(r.desc)}</b><small>${FREQUENCES[r.freq] + (r.freq === 'x' ? (r.mode ? ' · ' + securiser(r.mode) : '') : ' · dès le ' + r.start)}</small></div>`
  + (r.freq === 'x' && !+r.amt ? '<small>à entrer</small>' : `<b>${argent(r.amt)}</b>`) + '</div>';

function pageRecurrentes(id, pre) {
  if (id === undefined && !pre) {
    const liste = donnees.rec.filter(r => !r.del && r.freq !== 'x');
    return ouvrirFenetre(`<h2>Récurrentes</h2><p class=texte-discret>Codées une fois, elles s'ajoutent seules aux dépenses.</p>`
      + (liste.map(rangeeRecurrente).join('') || '<div class=vide>Aucune récurrente.</div>')
      + `<h3 class=espace-haut>Modèles</h3><p class=texte-discret>Ils ne s'ajoutent jamais seuls : on part d'un modèle en haut d'une nouvelle dépense.</p>`
      + (modeles().map(rangeeRecurrente).join('') || '<div class=vide>Aucun modèle. Touche « + Nouvelle récurrente », puis la fréquence « Aléatoire (modèle) ».</div>')
      + `<div class="boutons espace-haut"><button onclick="fermerFenetre()">Fermer</button><button class=bouton-principal onclick="pageRecurrentes(null,{})">+ Nouvelle récurrente</button></div>`);
  }
  const base = id ? donnees.rec.find(x => x.id === id) : {};
  const e = { type: 'e', by: donnees.p[0], mode: '', cat: '', amt: '', desc: '', freq: 'm', start: '', end: '', ...base, ...(pre || {}) };
  const modele = e.freq === 'x';
  if (modele && !+e.amt) e.amt = '';
  if (modele && !e.pj) e.pj = partsModele(e);
  rouvrir = o => pageRecurrentes(o.id || null, o);
  lireEtat = lireRecurrente;
  const frequence = `<label>Fréquence<select id=f_fq onchange="rafraichirFormulaire()">${options(Object.entries({ ...FREQUENCES, x: 'Aléatoire (modèle)' }), e.freq)}</select></label>`;
  ouvrirFenetre(`<h2>${modele ? (e.id ? 'Modifier le modèle' : 'Nouveau modèle') : e.id ? 'Modifier la récurrente' : 'Nouvelle récurrente'}</h2><input type=hidden id=f_id value="${e.id || ''}">${champsFormulaire(e, true)}`
    + (modele ? frequence : `<div class=deux-colonnes>${frequence}<label>Dernière date (facultatif)<input id=f_end type=date value="${e.end || ''}"></label></div>`)
    + `<div class="boutons espace-haut">${e.id ? `<button class=bouton-danger onclick="supprimerRecurrente('${e.id}')">Supprimer</button>` : ''}<button onclick="pageRecurrentes()">Retour</button><button class=bouton-principal onclick="enregistrerRecurrente()">Enregistrer</button></div>`);
}

/* Un modèle sans montant : ses parts gardent leur nom, avec ou sans montant (sans montant : la part prendra ce qui reste) */
function partsSansMontant(o) {
  const parts = o.type === 'e' ? (o.pj || []).filter(p => p[0]) : [];
  ['', 2, 3].forEach((suite, i) => {
    o['nz' + suite] = parts[i] ? Math.abs(+parts[i][1] || 0) : 0;
    o['nzf' + suite] = parts[i] ? parts[i][0] : '';
  });
  delete o.pj;
}

function enregistrerRecurrente() {
  if (!trouver('#f_id')) return;
  const o = lireRecurrente(), modele = o.freq === 'x';
  if (modele) {
    if (!o.desc.trim()) return afficherMessage('Donne un nom au modèle (la description).');
    if (o.amt !== '' && !(o.amt > 0)) return afficherMessage('Le montant doit être plus grand que zéro, ou vide.');
    o.start = o.end = '';
  } else {
    if (!dateValide(o.start) || !(o.amt > 0)) return afficherMessage('Entre une date de début et un montant.');
    if (o.end && !dateValide(o.end)) return afficherMessage('La dernière date est illisible.');
  }
  if (o.type === 'm' && !o.env) return afficherMessage('Choisis un placement (à créer dans Plus).');
  if (!o.cat) return afficherMessage('Choisis une catégorie.');
  if (modele && o.amt === '') partsSansMontant(o);
  else {
    const erreur = appliquerParts(o);
    if (erreur) return afficherMessage(erreur);
  }
  const r = { desc: o.desc, amt: o.amt || 0, cat: o.cat, by: o.by, mode: o.mode, nz: o.nz, nzf: o.nzf, nz2: o.nz2, nzf2: o.nzf2, nz3: o.nz3, nzf3: o.nzf3,
    freq: o.freq, start: o.start, end: o.end, type: o.type, env: o.env, u: Date.now() };
  let recurrente;
  if (o.id) recurrente = Object.assign(donnees.rec.find(x => x.id === o.id), r);
  else donnees.rec.push(recurrente = { ...r, id: nouvelId() });
  memoriser([{ genre: 'rec', objet: recurrente }]);
  genererRecurrentes();
  pageRecurrentes();
  afficher();
}

function supprimerRecurrente(id) {
  const modele = (donnees.rec.find(x => x.id === id) || {}).freq === 'x';
  confirmer(modele ? 'Supprimer ce modèle ? Les dépenses déjà entrées restent.' : 'Supprimer cette récurrente ? Les lignes déjà créées restent.', () => {
    const r = donnees.rec.find(x => x.id === id);
    r.del = true;
    r.u = Date.now();
    memoriser([{ genre: 'supprimerRec', id }]);
    pageRecurrentes();
    afficher();
  }, () => pageRecurrentes(id));
}
