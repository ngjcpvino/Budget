/* =====================================================================
   LE CODE D'ENTRÉE (4 chiffres), ET LA LIAISON D'UN APPAREIL (6 chiffres, une seule fois)
   - Un appareil neuf n'a pas de clé : il demande le code de liaison (ancienne app : Plus → Relier la nouvelle app).
     La feuille l'échange contre une clé longue, gardée dans l'appareil; on ne la tape jamais.
   - Puis, à l'ouverture et après 5 minutes sans s'en servir : le code d'entrée, sur un pavé; rien du budget ne paraît derrière.
     L'appareil garde le sel et l'empreinte du bon code (jamais le code) pour vérifier sans réseau; la feuille le vérifie à chaque appel.
     Un code que l'appareil ne reconnaît pas est vérifié par la feuille (code changé ailleurs, ou effacé parce qu'oublié).
     La 1re fois sur un appareil, il faut le réseau. 5 essais manqués : une minute d'attente.
   etape : liaison · entrer · choisir, confirmer (la 1re fois) · actuel, nouveau, nouveau2 (Plus → Changer le code) · attente, reseau (pas encore de sel)
   ===================================================================== */

const DELAI_CODE = 5 * 60000;
const TEXTES_CODE = {
  liaison: 'Entre le code de liaison (6 chiffres)',
  entrer: 'Entre ton code',
  choisir: 'Choisis ton code (4 chiffres)',
  confirmer: 'Tape-le encore une fois',
  actuel: 'Entre ton code actuel',
  nouveau: 'Choisis ton nouveau code',
  nouveau2: 'Tape-le encore une fois',
  attente: 'Connexion…',
  reseau: 'Il faut le réseau la première fois sur cet appareil.'
};
let code = {};                 // { sel, e } : le sel et l'empreinte du bon code
let verrou = null;             // l'écran du code, quand il est là
let derniereActivite = Date.now();

const garderCode = o => {
  code = o;
  ecrireMemoire({ etat: { code: o } });
};
const empreinte = async chiffres => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.sel + chiffres)))]
  .map(x => x.toString(16).padStart(2, '0')).join('');
const sorteCode = e => (/CODE:(\w+)/.exec(String((e && e.message) || e)) || [])[1];
const longueurCode = () => verrou && verrou.etape === 'liaison' ? 6 : 4;

function verrouiller(etape) {
  verrou = { etape: etape || (!cleAppareil ? 'liaison' : code.e ? 'entrer' : 'attente'), ch: '', premier: '', manques: 0, jusqua: 0 };
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  trouver('#verrou').classList.remove('cache');
  dessinerCode();
  if (verrou.etape === 'attente') chercherSel();
}

/* Pas encore d'empreinte sur cet appareil : le sel, et s'il y a déjà un code (sinon, on le choisit) */
function chercherSel() {
  const v = verrou;
  appelServeur('selCode').then(r => {
    garderCode({ sel: r.sel });
    if (verrou === v) { v.etape = r.existe ? 'entrer' : 'choisir'; dessinerCode(); }
  }, e => {
    if (erreurCle(e)) return;
    if (verrou === v) { v.etape = 'reseau'; dessinerCode(); }
  });
}

function dessinerCode() {
  const v = verrou;
  if (!v) return;
  const pave = v.etape !== 'attente' && v.etape !== 'reseau', touche = k => `<button class=carre onclick="toucherCode('${k}')">${k}</button>`;
  const annuler = ['actuel', 'nouveau', 'nouveau2'].includes(v.etape) ? '<button class="carre texte-discret" onclick="ouvrirApp()" aria-label="Annuler">✕</button>' : '<span></span>';
  const points = Array.from({ length: longueurCode() }, (x, i) => `<i${i < v.ch.length ? ' class=plein' : ''}></i>`).join('');
  const aide = v.etape === 'liaison' ? "<p class=texte-discret>Dans l'ancienne app : Plus → Relier la nouvelle app.</p>" : '';
  trouver('#verrou').innerHTML = `<div class=code><h1>Budget</h1><p>${TEXTES_CODE[v.etape]}</p>`
    + (!pave ? (v.etape === 'reseau' ? '<button onclick="verrouiller()">Réessayer</button>' : '')
      : `<div class=points>${points}</div><div class=pave>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(touche).join('')}${annuler}${touche(0)}<button class="carre texte-discret" onclick="toucherCode('&lt;')" aria-label="Effacer">⌫</button></div>${aide}`)
    + '</div>';
}

function toucherCode(chiffre) {
  const v = verrou;
  if (!v || v.occupe) return;
  if (Date.now() < v.jusqua) return afficherMessage('Attends une minute.');
  if (chiffre === '<') v.ch = v.ch.slice(0, -1);
  else if (v.ch.length < longueurCode()) v.ch += chiffre;
  dessinerCode();
  if (v.ch.length === longueurCode()) traiterCode();
}

function codeManque(v) {
  v.ch = '';
  if (++v.manques >= 5) {
    v.manques = 0;
    v.jusqua = Date.now() + 60000;
    afficherMessage('5 essais manqués : attends une minute.');
  } else afficherMessage("Ce n'est pas le bon code.");
}

/* Le dernier chiffre : relier l'appareil, choisir (et retaper), ou vérifier (sur l'appareil, sinon à la feuille) */
async function traiterCode() {
  const v = verrou, chiffres = v.ch;
  v.occupe = true;
  try {
    if (v.etape === 'liaison') return await relier(v, chiffres);
    if (v.etape === 'choisir' || v.etape === 'nouveau') {
      v.premier = chiffres;
      v.ch = '';
      v.etape = v.etape === 'choisir' ? 'confirmer' : 'nouveau2';
      return;
    }
    if (v.etape === 'confirmer' || v.etape === 'nouveau2') {
      const premiereFois = v.etape === 'confirmer';
      if (chiffres !== v.premier) {
        v.ch = '';
        v.etape = premiereFois ? 'choisir' : 'nouveau';
        return afficherMessage('Les deux codes ne sont pas pareils. Recommence.');
      }
      const h = await empreinte(chiffres);
      await appelServeur('choisirCode', { nouvelle: h, actuelle: code.e || '' });
      garderCode({ sel: code.sel, e: h });
      ouvrirApp();
      return afficherMessage(premiereFois ? 'Code enregistré.' : 'Code changé.');
    }
    const h = await empreinte(chiffres), bon = () => {
      if (v.etape === 'actuel') { v.ch = ''; v.etape = 'nouveau'; } else ouvrirApp();
    };
    if (h === code.e) return bon();
    try {
      await appelServeur('verifierCode', { empreinte: h });
      garderCode({ sel: code.sel, e: h });
      bon();
    } catch (e) {
      if (erreurCle(e)) return;
      const sorte = sorteCode(e);
      v.ch = '';
      if (sorte === 'aucun') {
        garderCode({ sel: code.sel });
        v.etape = 'choisir';
        afficherMessage('Choisis un nouveau code.');
      } else if (sorte === 'attendre') afficherMessage("Trop d'essais : attends une minute.");
      else if (sorte || code.e) codeManque(v);
      else afficherMessage(TEXTES_CODE.reseau);
    }
  } catch (e) {
    v.ch = '';
    afficherMessage(sorteCode(e) === 'attendre' ? "Trop d'essais : attends une minute." : 'Connexion impossible : réessaie.');
  } finally {
    v.occupe = false;
    if (verrou === v) dessinerCode();
  }
}

/* Le code de liaison contre la clé de l'appareil, gardée dans sa mémoire */
async function relier(v, chiffres) {
  v.ch = '';
  let r;
  try {
    r = await appelServeur('relier', { code: chiffres, appareil: deviner() });
  } catch (e) {
    const m = String(e.message);
    return afficherMessage(m === 'reseau' ? 'Il faut le réseau pour relier cet appareil.' : m === 'LIAISON:mauvais' ? "Ce n'est pas le bon code."
      : 'Ce code ne vaut plus : demandes-en un autre.');
  }
  cleAppareil = r.cle;
  nomAppareil = deviner();
  await ecrireMemoire({ etat: { cle: cleAppareil, appareil: nomAppareil } });
  afficherMessage('Appareil relié.');
  verrouiller();
}
/* Le nom que le Journal de la feuille donnera à cet appareil */
const deviner = () => /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document ? 'iPad' : /iPhone/.test(navigator.userAgent) ? 'iPhone' : /Windows/.test(navigator.userAgent) ? 'Ordi' : 'Appareil';

function ouvrirApp() {
  verrou = null;
  trouver('#verrou').classList.add('cache');
  derniereActivite = Date.now();
  if (lecture || fileEnvois.length || Date.now() - dernierChargement > 30000) synchroniser();
}

/* La feuille refuse le code (changé sur l'autre appareil, ou effacé) : on oublie l'empreinte et on revient sur l'écran du code */
function erreurCode(e) {
  const sorte = sorteCode(e);
  if (!sorte) return false;
  afficherStatut('');
  if (sorte === 'attendre') afficherMessage("Trop d'essais : attends une minute.");
  else {
    garderCode({ sel: code.sel });
    verrouiller(sorte === 'aucun' ? 'choisir' : 'entrer');
    afficherMessage(sorte === 'aucun' ? 'Choisis un nouveau code.' : 'Le code a changé : entre le nouveau.');
  }
  return true;
}

/* 5 minutes sans toucher l'app : l'écran du code */
['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, () => { if (!verrou) derniereActivite = Date.now(); }, true));
setInterval(() => { if (!verrou && !document.hidden && Date.now() - derniereActivite > DELAI_CODE) verrouiller(); }, 15000);
