/* =====================================================================
   MODÈLE — ce que chaque ligne fait, décrit UNE SEULE FOIS (effetsDe),
   et tous les chiffres de l'app qui en découlent : les dépenses communes et
   le perso, les dettes (qui doit à qui, les tiers), les cartes de crédit,
   ce qui est payé avec un débit ou un comptant, les placements.
   Chaque page tire ses chiffres d'ici : ses totaux s'accordent par construction.

   Une ligne (comme dans la feuille) :
     d date · type · desc · cat · env (placement) · amt montant · by payé par
     mode (compte d'où part l'argent) · to (compte d'arrivée)
     nz/nzf, nz2/nzf2, nz3/nzf3 (les parts « Juste pour » et pour qui) · del (supprimée)
   Les genres (type) : e dépense · m placement · f intérêts ou remise · t paiement sur une carte
     · r paiement à une personne (nzf = qui reçoit) · p un placement paie la carte (to = la carte, cat = la catégorie qui baisse)
   ===================================================================== */

/* ----- Les personnes et les comptes ----- */
const lesDeux = () => donnees.p;                      // [1re personne, 2e personne]
const estPersonne = qui => donnees.p.includes(qui);

/* Un compte se nomme avec son propriétaire (« Débit · Marie ») : c'est ce que les lignes gardent */
const cleCompte = compte => compte.o ? compte.n + ' · ' + compte.o : compte.n;
const compteDe = cle => donnees.modes.find(m => cleCompte(m) === cle);
const nomCompte = cle => (compteDe(cle) || { n: cle }).n;
const proprietaireCompte = cle => (compteDe(cle) || {}).o || '';
const estCarte = cle => (compteDe(cle) || {}).k === 'p';

/* La carte de crédit d'une personne (choisie d'avance quand elle paie une dépense) */
const carteDe = qui => {
  const carte = donnees.modes.find(m => m.o === qui && m.k === 'p');
  return carte ? cleCompte(carte) : '';
};

/* ----- Les parts « Juste pour » ----- */
/* [[pour qui, montant], …] : jusqu'à 3; une 1re part sans nom = la part de celui qui paie */
const partsDe = ligne => [[ligne.nzf || ligne.by, +ligne.nz || 0], [ligne.nzf2, +ligne.nz2 || 0], [ligne.nzf3, +ligne.nz3 || 0]]
  .filter(part => part[0] && part[1]);

/* Ce qui compte dans les dépenses : les dépenses, les placements, et (en moins) un placement qui paie la carte */
const compteDansBudget = ligne => ligne.type === 'e' || ligne.type === 'm' || ligne.type === 'p';

/* ===== LES EFFETS D'UNE LIGNE : la seule description de ce qu'elle fait ===== */
function effetsDe(ligne) {
  const T = +ligne.amt || 0, type = ligne.type, effets = { budget: null, sortie: null, entree: null, placement: null, dettes: [], tiers: [], paiementTiers: null };

  /* Le budget : la part commune, et les parts de chacun */
  if (compteDansBudget(ligne)) {
    if (type === 'p') effets.budget = { commun: -T, parts: [] };
    else {
      const parts = partsDe(ligne);
      effets.budget = { commun: T - parts.reduce((s, p) => s + p[1], 0), parts };
    }
  }

  /* Les comptes : l'argent sort du compte « mode » (une carte : ce qui reste à payer monte);
     un paiement arrive sur le compte « to » (une carte : ce qui reste à payer baisse).
     « paye » : ce qui compte dans le « Payé en » d'un débit ou d'un comptant (dépenses et placements) */
  if (ligne.mode && ['e', 'm', 't', 'p'].includes(type)) effets.sortie = { cle: ligne.mode, montant: T, paye: type === 'e' || type === 'm' };
  if (ligne.to && (type === 't' || type === 'p')) effets.entree = { cle: ligne.to, montant: T };

  /* Les placements : placé, intérêts et remises en plus; un paiement de la carte en moins */
  if (ligne.env && (type === 'm' || type === 'f' || type === 'p')) effets.placement = { nom: ligne.env, montant: type === 'p' ? -T : T, genre: type };

  /* Les dettes entre les deux personnes et envers les tiers */
  const [N, J] = lesDeux();
  if (type === 't' || type === 'r') {
    const qui = type === 'r' || ligne.by ? ligne.by : proprietaireCompte(ligne.mode);
    const aQui = type === 'r' ? ligne.nzf : proprietaireCompte(ligne.to);
    if (estPersonne(qui) && estPersonne(aQui)) {
      if (qui === N && aQui === J) effets.dettes.push({ doit: J, a: N, montant: T });
      else if (qui === J && aQui === N) effets.dettes.push({ doit: J, a: N, montant: -T });
    } else if (qui && estPersonne(aQui)) effets.paiementTiers = { tiers: qui, recoit: aQui, montant: T };
  } else if (effets.budget) {
    const paye = type === 'p' ? proprietaireCompte(ligne.to) || N : ligne.by;
    if (estPersonne(paye)) {
      const signe = paye === N ? 1 : -1;
      const parts = effets.budget.parts, montant = type === 'p' ? -T : T;
      /* La part commune se partage moitié-moitié */
      effets.dettes.push({ doit: J, a: N, montant: signe * (montant - parts.reduce((s, p) => s + p[1], 0)) / 2 });
      parts.forEach(([pourQui, z]) => {
        if (pourQui === paye) return;
        if (estPersonne(pourQui)) effets.dettes.push({ doit: J, a: N, montant: signe * z });
        else effets.tiers.push({ tiers: pourQui, envers: paye, montant: z });
      });
    }
  }
  return effets;
}

/* Le montant d'une ligne dans le budget, selon le choix :
   '' = sa part commune · 't' = tout (sans les parts des tiers) · un nom = la part de cette personne ou de ce tiers.
   Hors budget (un paiement) : son montant en « Tout », rien ailleurs */
function partDe(ligne, choix) {
  const b = effetsDe(ligne).budget;
  if (!b) return choix === 't' ? +ligne.amt || 0 : 0;
  if (choix === '') return b.commun;
  if (choix === 't') return b.commun + b.parts.filter(p => estPersonne(p[0])).reduce((s, p) => s + p[1], 0);
  return b.parts.filter(p => p[0] === choix).reduce((s, p) => s + p[1], 0);
}

/* ----- Les lignes ----- */
const lignesVivantes = () => donnees.ex.filter(e => !e.del && e.d);
const depensesAnnee = () => lignesVivantes().filter(e => e.d.startsWith(anneeCourante));
const lignesJusqua = fin => lignesVivantes().filter(e => e.d <= fin);
/* Les dettes (qui doit à qui, les tiers) au 31 décembre d'une année */
const soldesAu = y => soldes(lignesJusqua(y + '-12-31'));

/* Les totaux d'un choix (voir partDe) : total, par catégorie, par mois, et par catégorie dans chaque mois */
function stats(lignes, choix) {
  const c = { tot: 0, cat: {}, mon: Array(12).fill(0), mc: Array.from({ length: 12 }, () => ({})) };
  lignes.forEach(e => {
    const v = compteDansBudget(e) ? partDe(e, choix) : 0;
    if (!v) return;
    const mois = +e.d.slice(5, 7) - 1;
    c.tot += v;
    c.cat[e.cat] = (c.cat[e.cat] || 0) + v;
    c.mon[mois] += v;
    c.mc[mois][e.cat] = (c.mc[mois][e.cat] || 0) + v;
  });
  return c;
}

/* Les dettes : solde > 0 = la 2e personne doit à la 1re; ti[tiers][personne] = ce que le tiers lui doit.
   Un tiers qui paie R : sa dette envers R baisse d'abord; le reste baisse sa dette envers l'autre, et R doit ce reste à l'autre.
   Les lignes sont prises dans l'ordre des dates : ce partage dépend de ce qui était dû au moment du paiement */
function soldes(lignes) {
  const [N, J] = lesDeux(), c = { solde: 0, ti: {} };
  const ti = t => c.ti[t] = c.ti[t] || { [N]: 0, [J]: 0 };
  donnees.tiers.forEach(ti);
  enOrdre(lignes).forEach(e => {
    const f = effetsDe(e);
    f.dettes.forEach(x => { c.solde += x.montant; });
    f.tiers.forEach(x => { ti(x.tiers)[x.envers] += x.montant; });
    if (f.paiementTiers) {
      const { tiers, recoit: R, montant: T } = f.paiementTiers, o = ti(tiers), A = R === N ? J : N;
      const reste = Math.min(Math.max(T - Math.max(o[R], 0), 0), Math.max(o[A], 0));
      o[R] -= T - reste;
      o[A] -= reste;
      c.solde += R === J ? reste : -reste;
    }
  });
  return c;
}

/* Les lignes par date (puis par identifiant) : le même ordre sur tous les appareils */
const enOrdre = lignes => lignes.slice().sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/* Ce qu'une ligne fait à un compte : une carte (ce qui reste à payer) ou un débit (ce qui est payé avec lui) */
function montantPourCompte(ligne, cle) {
  const f = effetsDe(ligne);
  if (estCarte(cle)) return (f.sortie && f.sortie.cle === cle ? f.sortie.montant : 0) - (f.entree && f.entree.cle === cle ? f.entree.montant : 0);
  return f.sortie && f.sortie.cle === cle && f.sortie.paye ? f.sortie.montant : 0;
}

/* Les comptes : une carte = « à payer » (solde de départ + ce qui en sort − les paiements reçus, jusqu'au 31 décembre de l'année choisie);
   un débit ou un comptant = « payé » (ce qui en est sorti dans l'année) */
function calculerComptes() {
  const fin = anneeCourante + '-12-31', annee = String(anneeCourante);
  const c = donnees.modes.map((m, i) => ({ i, cle: cleCompte(m), nom: m.n, o: m.o || '', k: m.k, depart: +m.s || 0, aPayer: 0, paye: 0 }));
  const parCle = {}; c.forEach(x => { parCle[x.cle] = x; });
  lignesJusqua(fin).forEach(e => {
    const f = effetsDe(e), s = f.sortie && parCle[f.sortie.cle], a = f.entree && parCle[f.entree.cle];
    if (s) { s.aPayer += f.sortie.montant; if (f.sortie.paye && e.d.startsWith(annee)) s.paye += f.sortie.montant; }
    if (a) a.aPayer -= f.entree.montant;
  });
  c.forEach(x => { x.valeur = x.k === 'p' ? x.depart + x.aPayer : x.paye; });
  return c;
}

/* Les placements : le solde compte tout jusqu'au 31 décembre de l'année choisie; « an » = l'année choisie seulement */
function calculerEnveloppes() {
  const fin = anneeCourante + '-12-31', annee = String(anneeCourante), c = {};
  donnees.env.forEach(x => { c[x.n] = { nom: x.n, ic: x.ic, depart: +x.s || 0, m: 0, f: 0, p: 0, an: { m: 0, f: 0, p: 0 } }; });
  lignesJusqua(fin).forEach(e => {
    const pl = effetsDe(e).placement, o = pl && c[pl.nom];
    if (!o) return;
    o[pl.genre] += +e.amt;
    if (e.d.startsWith(annee)) o.an[pl.genre] += +e.amt;
  });
  return donnees.env.map(x => {
    const o = c[x.n];
    o.solde = o.depart + o.m + o.f - o.p;
    return o;
  });
}

/* Ce qu'une ligne fait à un placement (en plus ou en moins) */
const montantPourPlacement = (ligne, nom) => {
  const pl = effetsDe(ligne).placement;
  return pl && pl.nom === nom ? pl.montant : 0;
};
