/* =====================================================================
   PLACEMENTS, ET LA PAGE DE LIGNES (un placement, un compte)
   ===================================================================== */

/* Une page de lignes, comme Dépenses en Détail : en haut le chiffre, le menu des mois et le tri, « n ligne(s) · total », les rangées.
   montantDe(ligne) = ce que la ligne fait ici (en plus ou en moins). Sans mois choisi, une rangée « Reporté » (au 31 décembre d'avant)
   quand il en restait : le total égale le chiffre du haut. */
function pageLignes({ haut, valeur, lignes, montantDe, report, icone, texteReport }) {
  const y = anneeCourante, avecReport = !moisLignes && Math.abs(report) > 0.004;
  const ici = lignes.filter(e => e.d.startsWith(y) && (!moisLignes || +e.d.slice(5, 7) == moisLignes))
    .sort(tri === 'd' ? (p, q) => q.d.localeCompare(p.d) : (p, q) => montantDe(q) - montantDe(p));
  const total = ici.reduce((s, e) => s + montantDe(e), avecReport ? report : 0);
  const rangeeReport = `<div class=ligne-depense>${caseDate((y - 1) + '-12-31')}<span class=icone>${icone}</span><div><b>Reporté de ${y - 1}</b><small>${texteReport} ${y - 1}</small></div><b>${argent(report)}</b></div>`;
  return `<div class="carte grande"><small>${haut}</small><b class="${valeur < 0 ? 'negatif' : ''}">${argent(valeur)}</b></div>`
    + `<div class=filtres><select onchange="moisLignes=this.value;afficher()">${options(CHOIX_MOIS(), moisLignes, "Toute l'année")}</select><select onchange="tri=this.value;afficher()">${options(CHOIX_TRI, tri)}</select></div>`
    + `<div class=texte-discret>${ici.length} ligne(s) · ${argent(total)}</div>`
    + ici.map(e => rangee(e, montantDe(e))).join('')
    + (avecReport ? rangeeReport : ici.length ? '' : '<div class=vide>Rien à afficher.</div>');
}

/* Toutes les lignes (des années d'avant aussi) qui touchent un placement ou un compte, sans les supprimées */
const lignesQui = montantDe => lignesVivantes().filter(e => montantDe(e));

/* Ce qui restait au 31 décembre d'avant : le départ et toutes les lignes avant l'année choisie */
const reportAvant = (depart, lignes, montantDe) => depart + lignes.filter(e => e.d < anneeCourante + '-01-01').reduce((s, e) => s + montantDe(e), 0);

const finAnnee = y => y < new Date().getFullYear() ? ' au 31 décembre ' + y : '';

/* La page d'un placement (toucher sa tuile sur l'Accueil) : placés, intérêts et remises en plus, payé sur la carte en moins */
function voirPlacement(nom) {
  placementOuvert = nom;
  aller('pl');
}
function pagePlacement() {
  const y = anneeCourante, x = calculerEnveloppes().find(o => o.nom === placementOuvert);
  if (!x) {
    vue = 'env';
    return pageEnveloppes();
  }
  const montantDe = e => montantPourPlacement(e, x.nom), lignes = lignesQui(montantDe);
  return pageLignes({
    haut: `${iconeEnveloppe(x)} ${securiser(x.nom)} · ${y < new Date().getFullYear() ? 'solde au 31 décembre ' + y : 'solde'}`,
    valeur: x.solde, lignes, montantDe, report: reportAvant(x.depart, lignes, montantDe), icone: iconeEnveloppe(x), texteReport: 'Solde au 31 décembre'
  });
}

/* La page Placements : chaque placement, son solde, ce qui s'y est passé dans l'année, et ses quatre boutons */
function pageEnveloppes() {
  const liste = calculerEnveloppes(), y = anneeCourante;
  if (!liste.length) return `<div class=carte><div class=vide>Aucun placement.<br>Crée-en un dans Plus.</div></div>`;
  return liste.map((x, i) => `<div class=carte><h3>${iconeEnveloppe(x)} ${securiser(x.nom)}</h3>`
    + `<div class=gros-chiffre><small>${y < new Date().getFullYear() ? 'Solde au 31 décembre ' + y : 'Solde'}</small><b class="${x.solde < 0 ? 'negatif' : ''}">${argent(x.solde)}</b></div>`
    + `<p>Placé en ${y} <b>${argent(x.an.m)}</b></p><p>Intérêts et remises <b>${argent(x.an.f)}</b></p><p>Payé sur la MC <b>${argent(x.an.p)}</b></p>`
    + `<div class="boutons espace-haut"><button class=bouton-principal onclick="editerEntree(null,{type:'m',env:donnees.env[${i}].n})">Placement</button>`
    + `<button onclick="editerEntree(null,{type:'f',desc:'Intérêts',env:donnees.env[${i}].n})">Intérêts</button>`
    + `<button onclick="editerEntree(null,{type:'f',desc:'Remise',env:donnees.env[${i}].n})">Remise</button>`
    + `<button onclick="editerPaiement(null,{by:PLACEMENT,env:donnees.env[${i}].n})">Payer la MC</button></div></div>`).join('');
}
