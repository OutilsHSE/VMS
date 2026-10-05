/* VMS — Visite Managériale de Sécurité · CDES — page V2 (05/10/2026)
   Découpée : index.html · css/vms.css · js/vms.js · data/listes.json.
   Ni adresse de serveur, ni mot de passe, ni nom de personne dans ce dépôt public :
   l'appareil est « branché » par le lien distribué par l'intranet HSE. */
// ========================================================
// SERVEUR — branchement de l'appareil (V2)
// ========================================================
// Aucune adresse ni mot de passe dans ce fichier public. L'appareil est « branché »
// une fois, en ouvrant la VMS depuis la tuile de l'intranet HSE (lien …#config=…) :
// l'adresse du serveur et le mot de passe sont alors gardés sur CET appareil.
const CLE_CONF = 'vms_conf_v2', CLE_LISTES = 'vms_listes_v2', CLE_RESP = 'vms_responsables_v2';
function lireConf() { try { return JSON.parse(localStorage.getItem(CLE_CONF) || '{}'); } catch (e) { return {}; } }
function ecrireConf(c) { try { localStorage.setItem(CLE_CONF, JSON.stringify(c)); } catch (e) {} }
let CONF = lireConf();
function estBranche() { return !!(CONF.webhook && CONF.secret); }

async function poster(charge) {
  if (!estBranche()) throw new Error('appareil non branché');
  charge.secret = CONF.secret;
  const r = await fetch(CONF.webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // évite le pré-vol CORS
    body: JSON.stringify(charge)
  });
  const t = await r.text();
  if (/^\s*</.test(t)) throw new Error('le serveur a renvoyé une page web');
  let j;
  try { j = JSON.parse(t); } catch (e) { throw new Error('réponse illisible du serveur'); }
  if (j && j.refus) { const e = new Error(j.message || 'accès refusé'); e.refus = true; majBandeau(true); throw e; }
  return j;
}

// Lien de branchement : …/#config=<adresse + mot de passe encodés>. Lu UNE fois,
// mémorisé sur l'appareil, puis retiré de la barre d'adresse.
function appliquerLienBranchement() {
  const m = /[#&]config=([A-Za-z0-9_-]+)/.exec(location.hash || '');
  if (!m) return false;
  try {
    let b = m[1].replace(/-/g, '+').replace(/_/g, '/');
    b += '='.repeat((4 - b.length % 4) % 4);
    const c = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), ch => ch.charCodeAt(0))));
    if (c && /\/exec$/.test(c.u || '') && c.s) {
      CONF = { webhook: c.u, secret: c.s }; ecrireConf(CONF);
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => toast('Appareil branché au serveur CDES ✓', 'success'), 400);
      return true;
    }
  } catch (e) { /* lien abîmé */ }
  setTimeout(() => toast('Lien de branchement illisible : rouvre la VMS depuis l\'intranet', 'error'), 400);
  return false;
}

function majBandeau(refus) {
  const b = document.getElementById('etat-branchement');
  if (!b) return;
  if (refus) b.innerHTML = '<div class="bandeau ko">⛔ <b>Accès refusé par le serveur.</b> Rouvre la VMS depuis la tuile de l\'intranet HSE pour rebrancher cet appareil.</div>';
  else if (!estBranche()) b.innerHTML = '<div class="bandeau">🔌 <b>Appareil non branché.</b> Ouvre la VMS depuis la tuile de l\'intranet HSE. En attendant, tu peux remplir la visite et enregistrer le PDF ; l\'envoi au plan d\'actions et par mail se fera une fois branché.</div>';
  else b.innerHTML = '';
}

// Listes non sensibles (activités, mémo FHO) : data/listes.json, copie gardée hors ligne.
async function chargerListes() {
  const appliquer = l => {
    if (!l || !Array.isArray(l.activites) || !Array.isArray(l.memo)) return false;
    const sel = document.getElementById('activite');
    sel.innerHTML = '<option value="">— Sélectionner —</option>' + l.activites.map(a => '<option>' + echapper(a) + '</option>').join('');
    MEMO = l.memo;
    return true;
  };
  try {
    const r = await fetch('data/listes.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const l = await r.json();
    if (appliquer(l)) { try { localStorage.setItem(CLE_LISTES, JSON.stringify(l)); } catch (e) {} return 'reseau'; }
  } catch (e) {}
  try { if (appliquer(JSON.parse(localStorage.getItem(CLE_LISTES) || 'null'))) return 'copie'; } catch (e) {}
  return 'defaut';
}
function echapper(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// Responsables (conducteurs de travaux) : envoyés par le serveur, depuis le Référentiel CDES,
// seulement à un appareil branché. Le champ reste libre.
function afficherResponsables() {
  let l = [];
  try { l = JSON.parse(localStorage.getItem(CLE_RESP) || '[]'); } catch (e) {}
  document.getElementById('dl-responsables').innerHTML = l.map(n => '<option value="' + echapper(n) + '">').join('');
}
async function pingServeur() {
  if (!estBranche()) return;
  try {
    const j = await poster({ action: 'ping' });
    if (j.ok && Array.isArray(j.responsables)) {
      try { localStorage.setItem(CLE_RESP, JSON.stringify(j.responsables)); } catch (e) {}
      afficherResponsables();
    }
  } catch (e) { /* hors réseau : la dernière liste reçue sert */ }
}

// ========================================================
// NUMÉROTATION AUTOMATIQUE
// ========================================================
// Le NUMÉRO est donné par le serveur au premier envoi (deux appareils ne peuvent plus
// produire le même). Sans réseau ni branchement : numéro local unique (VMS-2026-L…).
let numeroDefinitif = false;
function numeroProvisoire() { return 'VMS-' + new Date().getFullYear() + '-···'; }
function genererNumeroLocal() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = ''; for (let i = 0; i < 4; i++) s += a[Math.floor(Math.random() * a.length)];
  return 'VMS-' + new Date().getFullYear() + '-L' + s;
}
async function assurerNumero() {
  if (numeroDefinitif) return;
  let n = '';
  if (estBranche()) {
    try { const j = await poster({ action: 'numero', annee: String(new Date().getFullYear()) }); if (j.ok && j.numero) n = j.numero; }
    catch (e) { /* hors réseau : numéro local */ }
  }
  document.getElementById('vms-numero').textContent = n || genererNumeroLocal();
  numeroDefinitif = true;
}

// ========================================================
// TOAST
// ========================================================
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 3200);
}

// ========================================================
// MODALES
// ========================================================
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

// ========================================================
// COMPTEURS + RATIO
// ========================================================
function majCompteurs() {
  const rows = document.querySelectorAll('#obs-tbody tr');
  let c = { PP: 0, CD: 0, AD: 0 };
  rows.forEach(tr => {
    const v = tr.querySelector('.sel-type').value;
    if (c[v] !== undefined) c[v]++;
  });
  ['PP','CD','AD'].forEach(t => { document.getElementById('count-' + t).textContent = c[t]; });

  // Ratio 3 PP pour 1 AD/CD
  const badge = document.getElementById('ratio-badge');
  const negatifs = c.CD + c.AD;
  if (negatifs === 0 && c.PP === 0) {
    badge.textContent = 'Objectif : 3 PP pour 1 AD/CD';
    badge.className = 'ratio-badge';
  } else {
    const ratio = negatifs === 0 ? c.PP : (c.PP / negatifs);
    const txt = 'Ratio PP / (AD+CD) : ' + (negatifs === 0 ? c.PP + ' / 0' : ratio.toFixed(1));
    badge.textContent = txt;
    badge.className = 'ratio-badge ' + (ratio >= 3 ? 'ok' : 'ko');
  }

  renumeroter();
}

function renumeroter() {
  document.querySelectorAll('#obs-tbody tr').forEach((tr, i) => {
    tr.querySelector('.obs-num').textContent = i + 1;
  });
}

// ========================================================
// GESTION LIGNE PP (désactiver champs action)
// ========================================================
function majLigneType(tr) {
  const type = tr.querySelector('.sel-type').value;
  const toDisable = tr.querySelectorAll('.can-disable');
  if (type === 'PP') {
    toDisable.forEach(el => { el.disabled = true; });
    tr.className = 'PP';
  } else {
    toDisable.forEach(el => { el.disabled = false; });
    tr.className = type;
  }
  majCompteurs();
}

// ========================================================
// AJOUTER UNE OBSERVATION
// ========================================================
function ajouterObs(data = {}) {
  const tbody = document.getElementById('obs-tbody');
  const tr = document.createElement('tr');
  tr.className = data.type || 'PP';

  tr.innerHTML = `
    <td class="col-num"><span class="obs-num"></span></td>
    <td class="col-type">
      <select class="sel-type" onchange="majLigneType(this.closest('tr'))">
        <option value="PP" ${(data.type||'PP')==='PP'?'selected':''}>PP 👍</option>
        <option value="CD" ${data.type==='CD'?'selected':''}>CD ⚠️</option>
        <option value="AD" ${data.type==='AD'?'selected':''}>AD 🚫</option>
      </select>
    </td>
    <td class="col-desc">
      <textarea class="inp-desc" placeholder="Description de l'observation..." oninput="autoH(this)">${data.desc||''}</textarea>
      <button class="btn-ia no-print" onclick="suggererIA(this.closest('tr'))" title="Suggérer Domaine / Impact / Transversal par IA">✨ IA</button>
    </td>
    <td class="col-action">
      <textarea class="can-disable inp-action" placeholder="Action convenue conjointement..." oninput="autoH(this)">${data.action||''}</textarea>
    </td>
    <td class="col-domaine">
      <select class="can-disable inp-domaine">
        <option value="">—</option>
        <option ${data.domaine==='Sécurité'?'selected':''}>Sécurité</option>
        <option ${data.domaine==='Santé'?'selected':''}>Santé</option>
        <option ${data.domaine==='Environnement'?'selected':''}>Environnement</option>
        <option ${data.domaine==='Réglementaire'?'selected':''}>Réglementaire</option>
        <option ${data.domaine==='Démarche SSE'?'selected':''}>Démarche SSE</option>
      </select>
    </td>
    <td class="col-impact">
      <select class="can-disable inp-impact">
        <option value="">—</option>
        <option value="4" ${data.impact==='4'?'selected':''}>4 — Majeur</option>
        <option value="3" ${data.impact==='3'?'selected':''}>3 — Important</option>
        <option value="2" ${data.impact==='2'?'selected':''}>2 — Modéré</option>
        <option value="1" ${data.impact==='1'?'selected':''}>1 — Mineur</option>
      </select>
    </td>
    <td class="col-transv">
      <select class="can-disable inp-transv">
        <option value="">—</option>
        <option value="1" ${data.transversal==='1'?'selected':''}>Oui</option>
        <option value="0" ${data.transversal==='0'?'selected':''}>Non</option>
      </select>
    </td>
    <td class="col-pilote">
      <input type="text" class="can-disable inp-pilote" placeholder="Responsable" value="${data.pilote||''}">
    </td>
    <td class="col-echeance">
      <input type="date" class="can-disable inp-echeance" value="${data.echeance||''}">
    </td>
    <td class="col-photo">
      <div class="obs-photo-cell">
        <input type="file" accept="image/*" capture="environment" class="inp-photo" style="display:none" onchange="ajouterPhotoObs(this)">
        <button class="obs-photo-btn no-print" onclick="this.previousElementSibling.click()">📷 Photo</button>
        <div class="photo-preview-container"></div>
      </div>
    </td>
    <td class="col-del no-print">
      <button class="btn-del-obs" onclick="supprimerObs(this)" title="Supprimer">✕</button>
    </td>
  `;

  tbody.appendChild(tr);
  majLigneType(tr);
  tr.querySelector('.inp-desc').focus();
}

function supprimerObs(btn) {
  btn.closest('tr').remove();
  majCompteurs();
}

// Compression avant stockage/envoi (photos terrain -> payload raisonnable)
function resizeImage(dataURL, maxW, maxH, cb) {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxW / img.width, maxH / img.height);
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    cb(c.toDataURL('image/jpeg', 0.72));
  };
  img.src = dataURL;
}

function ajouterPhotoObs(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    resizeImage(e.target.result, 1280, 1280, function(src) {
      const cell = input.closest('.obs-photo-cell');
      const container = cell.querySelector('.photo-preview-container');
      const btn = cell.querySelector('.obs-photo-btn');
      container.innerHTML = '';
      const wrap = document.createElement('div');
      wrap.className = 'obs-photo-preview';
      const img = document.createElement('img');
      img.src = src;
      img.title = 'Cliquer pour agrandir';
      img.onclick = () => {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer';
        const bigImg = document.createElement('img');
        bigImg.src = src;
        bigImg.style.cssText = 'max-width:95%;max-height:95%;border-radius:8px';
        modal.appendChild(bigImg);
        modal.onclick = () => modal.remove();
        document.body.appendChild(modal);
      };
      const del = document.createElement('button');
      del.className = 'photo-del-btn no-print';
      del.textContent = '✕';
      del.onclick = (ev) => { ev.stopPropagation(); container.innerHTML = ''; btn.style.display = 'inline-block'; input.value = ''; };
      wrap.appendChild(img);
      wrap.appendChild(del);
      container.appendChild(wrap);
      btn.style.display = 'none';
    });
  };
  reader.readAsDataURL(file);
}

function autoH(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

// ========================================================
// IMPORT DE REMONTÉES (depuis le Sheet, format PA)
// ========================================================
// Parseur TSV gérant les cellules entre guillemets (avec sauts de ligne / tabulations)
function parseTSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === '\t') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function frDate(s) { // "29/07/2026" -> "2026-07-29"
  const m = (s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '';
}

function typeDepuisSujet(s) {
  const t = (s || '').toLowerCase();
  if (t.includes('acte dangereux')) return 'AD';
  if (t.includes('condition dangereuse')) return 'CD';
  if (t.includes('point positif')) return 'PP';
  return 'CD';
}

function importerRemontees() {
  const text = document.getElementById('import-text').value;
  const nbPP = parseInt(document.getElementById('import-pp').value || '0', 10) || 0;
  const rows = parseTSV(text).filter(r =>
    r.length > 6 && (r[6] || '').trim() && (r[0] || '').trim().toLowerCase() !== 'origine');
  if (rows.length === 0) { toast('Aucune ligne détectée', 'error'); return; }

  // Chantier + date depuis la 1re ligne (si non déjà remplis)
  const first = rows[0];
  const chp = document.getElementById('chantier');
  if (!chp.value.trim() && first[1]) chp.value = first[1].trim();
  const d = frDate(first[2]);
  if (d) document.getElementById('date-visite').value = d;

  // On retire les lignes existantes vides (ex. la ligne PP par défaut)
  document.querySelectorAll('#obs-tbody tr').forEach(tr => {
    if (!tr.querySelector('.inp-desc').value.trim() && !tr.querySelector('.inp-action').value.trim()) tr.remove();
  });

  // Lignes PP vierges (à compléter à la main)
  for (let i = 0; i < nbPP; i++) ajouterObs({ type: 'PP' });

  // Remontées CD/AD pré-remplies
  rows.forEach(r => {
    ajouterObs({
      type: typeDepuisSujet(r[5]),
      desc: (r[6] || '').trim(),
      action: (r[7] || '').trim(),
      domaine: (r[4] || '').trim(),
      impact: (r[8] || '').trim(),
      transversal: (r[9] || '').trim(),
      pilote: (r[12] || '').trim(),
      echeance: frDate(r[13])
    });
  });

  document.querySelectorAll('#obs-tbody textarea').forEach(autoH);
  majCompteurs();
  closeModal('modal-import');
  document.getElementById('import-text').value = '';
  toast('✅ ' + rows.length + ' remontée(s) importée(s) + ' + nbPP + ' PP vierge(s)', 'success');
}

// ========================================================
// SUGGESTION IA (Domaine / Impact / Transversal via Groq)
// ========================================================
// Appel en JSONP : contourne le CORS d'Apps Script depuis GitHub Pages
// V2 : appel POST protégé par le mot de passe (plus de JSONP ni d'adresse dans la page)
function appelIA(description) { return poster({ action: 'suggest', description }); }

async function suggererIA(tr) {
  const type = tr.querySelector('.sel-type').value;
  if (type === 'PP') { toast('IA disponible pour les CD/AD', 'error'); return; }
  const desc = tr.querySelector('.inp-desc').value.trim();
  if (!desc) { toast('Décris d\'abord l\'observation', 'error'); return; }
  if (!estBranche()) { toast('🔌 Appareil non branché : ouvre la VMS depuis l\'intranet HSE', 'error'); return; }

  const btn = tr.querySelector('.btn-ia');
  const label = btn.innerHTML;
  btn.innerHTML = '⏳'; btn.disabled = true;
  try {
    const data = await appelIA(desc);
    if (!data.ok) throw new Error(data.message || data.erreur || 'Erreur IA');
    // La saisie manuelle est PRIORITAIRE : l'IA ne remplit que les champs restés vides
    let rempli = 0;
    const dom = tr.querySelector('.inp-domaine');
    const imp = tr.querySelector('.inp-impact');
    const tra = tr.querySelector('.inp-transv');
    if (!dom.value && data.domaine) { dom.value = data.domaine; rempli++; }
    if (!imp.value && data.impact)  { imp.value = String(data.impact); rempli++; }
    if (!tra.value && (data.transversal === 0 || data.transversal === 1)) { tra.value = String(data.transversal); rempli++; }
    if (rempli > 0) toast('✨ ' + rempli + ' champ(s) complété(s) par l\'IA ✓', 'success');
    else toast('Champs déjà renseignés — l\'IA n\'a rien modifié');
  } catch (e) {
    toast('❌ IA indisponible : ' + e.message, 'error');
  } finally {
    btn.innerHTML = label; btn.disabled = false;
  }
}

// ========================================================
// PHOTOS CHANTIER
// ========================================================
document.getElementById('photos-chantier-input').addEventListener('change', function() {
  const preview = document.getElementById('photos-chantier-preview');
  Array.from(this.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const wrap = document.createElement('div');
      wrap.className = 'photo-thumb';
      const img = document.createElement('img');
      img.src = e.target.result;
      img.onclick = () => {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer';
        const big = document.createElement('img');
        big.src = e.target.result;
        big.style.cssText = 'max-width:95%;max-height:95%;border-radius:8px';
        modal.appendChild(big); modal.onclick = () => modal.remove();
        document.body.appendChild(modal);
      };
      const btn = document.createElement('button');
      btn.className = 'del-photo no-print';
      btn.textContent = '✕';
      btn.onclick = () => wrap.remove();
      wrap.appendChild(img);
      wrap.appendChild(btn);
      preview.appendChild(wrap);
    };
    reader.readAsDataURL(file);
  });
  this.value = '';
});

// ========================================================
// COLLECTER LES DONNÉES
// ========================================================
function collecterDonnees() {
  const g = id => document.getElementById(id).value;
  const observations = [];
  document.querySelectorAll('#obs-tbody tr').forEach((tr, i) => {
    observations.push({
      nObs: i + 1,
      type: tr.querySelector('.sel-type').value,
      description: tr.querySelector('.inp-desc').value,
      action: tr.querySelector('.inp-action').value,
      domaine: tr.querySelector('.inp-domaine').value,
      impact: tr.querySelector('.inp-impact').value,
      transversal: tr.querySelector('.inp-transv').value,
      pilote: tr.querySelector('.inp-pilote').value,
      echeance: tr.querySelector('.inp-echeance').value,
      photo: (tr.querySelector('.obs-photo-preview img') || {}).src || '',
    });
  });
  return {
    nVMS: document.getElementById('vms-numero').textContent,
    date: g('date-visite'),
    chantier: g('chantier'),
    agence: g('agence'),
    activite: g('activite'),
    visiteur: g('visiteur'),
    conducteur: g('conducteur'),
    collaborateurs: g('collaborateurs'),
    bilan: g('bilan-global'),
    commentaires: g('commentaires'),
    observations
  };
}

// ========================================================
// ENVOI SHEET (caché) + MAIL + PDF
// ========================================================
// Un seul envoi par VMS, même si on clique successivement (ou simultanément) Mail ET PDF.
// On mémorise la PROMESSE d'envoi : un 2e clic pendant l'envoi attend le 1er au lieu de relancer.
let envoiPromise = null;

// Envoi des actions (CD/AD) au plan d'actions : UN appel pour toute la VMS,
// réponse lue (une erreur se voit), mot de passe joint.
async function envoyerAuSheet(data) {
  if (!estBranche()) return { ok: false, nonBranche: true };
  // PP exclus + lignes vides ignorées (les lignes blanches servent à la saisie papier)
  const aEnvoyer = data.observations.filter(o => o.type !== 'PP' && ((o.description || '').trim() || (o.action || '').trim()));
  if (aEnvoyer.length === 0) return { ok: true, aucune: true };
  try {
    const j = await poster({ action: 'lignes', nVMS: data.nVMS, dateVisite: data.date, chantier: data.chantier, agence: data.agence,
      observations: aEnvoyer.map(o => ({ nObs: o.nObs, type: o.type, description: o.description, action: o.action, pilote: o.pilote,
        domaine: o.domaine, impact: o.impact, transversal: o.transversal, echeance: o.echeance, photo: o.photo })) });
    return j.ok ? { ok: true, ajoutees: j.ajoutees, maj: j.maj } : { ok: false, erreur: j.erreur || j.message };
  } catch (e) { return { ok: false, erreur: e.message, refus: e.refus }; }
}

// UN SEUL envoi par VMS, même si on clique Mail ET PDF ; un envoi raté peut être retenté.
function assurerEnvoi(data) {
  if (!envoiPromise) {
    envoiPromise = envoyerAuSheet(data).then(r => { if (!r.ok) envoiPromise = null; return r; });
  }
  return envoiPromise;
}
function signalerEnvoi(r) {
  if (r.nonBranche) toast('🔌 Non envoyé au plan d\'actions : appareil non branché', 'error');
  else if (!r.ok) toast('❌ Plan d\'actions : ' + (r.erreur || 'envoi impossible'), 'error');
}

// ========================================================
// PDF VECTORIEL (jsPDF + autoTable) — mise en page maîtrisée
// ========================================================
const PDF_C = {
  marine: [0, 58, 110], clair: [0, 119, 182], pale: [232, 244, 253],
  vert: [45, 198, 83], orange: [244, 160, 58], rouge: [230, 57, 70],
  texte: [26, 43, 60], bord: [208, 218, 232], gris: [245, 247, 250], gris2: [110, 125, 140]
};
const PDF_LIB = { PP: 'Point positif', CD: 'Condition dangereuse', AD: 'Acte dangereux' };
const AGENCES = { IDF: 'IDF — Île-de-France', NA: 'NA — Nouvelle-Aquitaine', BPL: 'BPL — Bretagne / Pays de la Loire' };

function fmtDateFR(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}
function imgFormat(src) { return /^data:image\/png/i.test(src) ? 'PNG' : 'JPEG'; }

// Signature : renvoie un JPEG aplati sur blanc, ou '' si le pad est vide
function signatureImage(canvasId) {
  const c = document.getElementById(canvasId);
  if (!c || !c.width || !c.height) return '';
  try {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let vide = true;
    for (let i = 3; i < d.length; i += 4) { if (d[i] !== 0) { vide = false; break; } }
    if (vide) return '';
  } catch (e) { return ''; }
  const out = document.createElement('canvas');
  out.width = c.width; out.height = c.height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(c, 0, 0);
  return out.toDataURL('image/jpeg', 0.9);
}

function photosChantier() {
  return Array.from(document.querySelectorAll('#photos-chantier-preview img')).map(i => i.src);
}

// Construit le document PDF complet et le renvoie (objet jsPDF)
function construirePDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  const W = doc.internal.pageSize.getWidth();   // 297
  const H = doc.internal.pageSize.getHeight();  // 210
  const M = 10;
  const LARG = W - 2 * M;

  // ---------- Bandeau de titre ----------
  doc.setFillColor.apply(doc, PDF_C.marine);
  doc.rect(0, 0, W, 22, 'F');
  doc.setFillColor.apply(doc, PDF_C.clair);
  doc.rect(0, 22, W, 1.6, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
  doc.text('VMS', M, 11);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text('Visite Managériale de Sécurité', M, 17.5);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(data.nVMS || '', W - M, 11, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text((data.chantier || '') + (data.agence ? '  ·  ' + data.agence : '')
    + (data.date ? '  ·  ' + fmtDateFR(data.date) : ''), W - M, 17.5, { align: 'right' });

  // ---------- Informations de la visite ----------
  const info = [
    ['Date de visite', fmtDateFR(data.date), 'Chantier', data.chantier || ''],
    ['Agence', AGENCES[data.agence] || data.agence || '', 'Activité', data.activite || ''],
    ['Visiteur (manager)', data.visiteur || '', 'Conducteur / Responsable', data.conducteur || ''],
    ['Collaborateurs rencontrés', { content: data.collaborateurs || '', colSpan: 3 }]
  ];
  doc.autoTable({
    startY: 29,
    margin: { left: M, right: M },
    body: info,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2, textColor: PDF_C.texte, lineColor: PDF_C.bord, lineWidth: 0.15, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 46, fillColor: PDF_C.pale, fontStyle: 'bold', textColor: PDF_C.marine },
      1: { cellWidth: 92 },
      2: { cellWidth: 46, fillColor: PDF_C.pale, fontStyle: 'bold', textColor: PDF_C.marine },
      3: { cellWidth: LARG - 184 }
    }
  });

  // ---------- Compteurs ----------
  // TOUTES les lignes sont imprimées, y compris les lignes vides ajoutées
  // volontairement (ex. lignes PP à compléter à la main sur le terrain).
  const obs = data.observations;
  const estVide = o => !((o.description || '').trim() || (o.action || '').trim());
  const nb = t => obs.filter(o => o.type === t).length;
  let y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'bold');
  const puces = [
    { l: 'PP  ' + nb('PP'), c: PDF_C.vert },
    { l: 'CD  ' + nb('CD'), c: PDF_C.orange },
    { l: 'AD  ' + nb('AD'), c: PDF_C.rouge }
  ];
  let x = M;
  puces.forEach(p => {
    doc.setFillColor.apply(doc, p.c);
    doc.roundedRect(x, y - 4.4, 24, 6.6, 1.4, 1.4, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(p.l, x + 12, y, { align: 'center' });
    x += 28;
  });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.setTextColor.apply(doc, PDF_C.gris2);
  doc.text('Objectif : 3 points positifs pour 1 AD/CD', x + 2, y);

  // ---------- Tableau des observations ----------
  const corps = obs.map((o, i) => ([
    String(i + 1),
    o.type || '',
    o.description || '',
    o.action || '',
    o.domaine || '',
    o.impact || '',
    o.transversal === '1' ? 'Oui' : (o.transversal === '0' ? 'Non' : ''),
    o.pilote || '',
    fmtDateFR(o.echeance),
    ''
  ]));

  doc.autoTable({
    startY: y + 4,
    margin: { left: M, right: M, top: 14, bottom: 14 },
    head: [['#', 'Type', 'Observation / Constat', 'Action convenue', 'Domaine', 'Impact', 'Transv.', 'Pilote', 'Échéance', 'Photo']],
    body: corps.length ? corps : [['', '', 'Aucune observation saisie', '', '', '', '', '', '', '']],
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 7.6, cellPadding: 1.8, overflow: 'linebreak', valign: 'top', textColor: PDF_C.texte, lineColor: PDF_C.bord, lineWidth: 0.15 },
    headStyles: { fillColor: PDF_C.marine, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center', valign: 'middle' },
    alternateRowStyles: { fillColor: [250, 252, 255] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 16, halign: 'center', valign: 'middle', fontStyle: 'bold' },
      2: { cellWidth: 66 },
      3: { cellWidth: 61 },
      4: { cellWidth: 26 },
      5: { cellWidth: 14, halign: 'center' },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 26 },
      8: { cellWidth: 20, halign: 'center' },
      9: { cellWidth: 26, halign: 'center' }
    },
    didParseCell: d => {
      if (d.section !== 'body') return;
      const o = obs[d.row.index];
      if (d.column.index === 1 && o) {
        const c = o.type === 'PP' ? PDF_C.vert : (o.type === 'AD' ? PDF_C.rouge : PDF_C.orange);
        d.cell.styles.fillColor = c;
        d.cell.styles.textColor = [255, 255, 255];
      }
      if (d.column.index === 9 && o && o.photo) d.cell.styles.minCellHeight = 24;
      // ligne laissée vide → on réserve de la hauteur pour l'écriture manuscrite
      if (o && estVide(o)) d.cell.styles.minCellHeight = 14;
    },
    didDrawCell: d => {
      if (d.section !== 'body' || d.column.index !== 9) return;
      const o = obs[d.row.index];
      if (!o || !o.photo) return;
      try {
        const p = doc.getImageProperties(o.photo);
        const maxW = d.cell.width - 3, maxH = d.cell.height - 3;
        const r = Math.min(maxW / p.width, maxH / p.height);
        const w = p.width * r, h = p.height * r;
        doc.addImage(o.photo, imgFormat(o.photo),
          d.cell.x + (d.cell.width - w) / 2, d.cell.y + (d.cell.height - h) / 2, w, h);
      } catch (e) { /* photo illisible : on laisse la cellule vide */ }
    }
  });

  // ---------- Curseur de mise en page ----------
  let curY = doc.lastAutoTable.finalY;
  // réserve un bloc de hauteur "besoin" : saute de page si nécessaire
  const reserver = (besoin) => {
    if (curY + 7 + besoin > H - 14) { doc.addPage(); curY = 16; return curY; }
    curY += 7;
    return curY;
  };
  const titreBloc = (txt) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.setTextColor.apply(doc, PDF_C.marine);
    doc.text(txt, M, curY);
    curY += 4;
  };

  // ---------- Bilan ----------
  doc.autoTable({
    startY: reserver(30),
    margin: { left: M, right: M, top: 14, bottom: 14 },
    head: [['Bilan global de la visite', 'Commentaires des collaborateurs']],
    body: [[data.bilan || '—', data.commentaires || '—']],
    theme: 'grid',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3, overflow: 'linebreak', valign: 'top', textColor: PDF_C.texte, lineColor: PDF_C.bord, lineWidth: 0.15 },
    headStyles: { fillColor: PDF_C.clair, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5, minCellHeight: 0, cellPadding: 2 },
    bodyStyles: { minCellHeight: 24 },
    columnStyles: { 0: { cellWidth: LARG / 2 }, 1: { cellWidth: LARG / 2 } }
  });
  curY = doc.lastAutoTable.finalY;

  // ---------- Photos du chantier ----------
  const photos = data.photosChantier || [];
  if (photos.length) {
    const cw = (LARG - 3 * 5) / 4, ch = 44;
    reserver(ch + 6);
    titreBloc('Photos du chantier');
    let py = curY;
    photos.forEach((src, i) => {
      const col = i % 4;
      if (col === 0 && i > 0) py += ch + 5;
      if (py + ch > H - 14) { doc.addPage(); py = 16; }
      const cx = M + col * (cw + 5);
      doc.setDrawColor.apply(doc, PDF_C.bord);
      doc.setFillColor.apply(doc, PDF_C.gris);
      doc.roundedRect(cx, py, cw, ch, 1.5, 1.5, 'FD');
      try {
        const p = doc.getImageProperties(src);
        const r = Math.min((cw - 3) / p.width, (ch - 3) / p.height);
        doc.addImage(src, imgFormat(src), cx + (cw - p.width * r) / 2, py + (ch - p.height * r) / 2, p.width * r, p.height * r);
      } catch (e) { /* ignore */ }
    });
    curY = py + ch;
  }

  // ---------- Signatures ----------
  const bh = 42;
  reserver(bh + 6);
  titreBloc('Signatures');
  const sy = curY;
  const bw = (LARG - 8) / 2;
  const boites = [
    { titre: 'Visiteur (manager)', nom: (document.getElementById('sign-name-1') || {}).value || data.visiteur || '', img: signatureImage('drawingCanvas1') },
    { titre: 'Intervenant(s)', nom: (document.getElementById('sign-name-2') || {}).value || '', img: signatureImage('drawingCanvas2') }
  ];
  boites.forEach((b, i) => {
    const bx = M + i * (bw + 8);
    doc.setDrawColor.apply(doc, PDF_C.bord);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(bx, sy, bw, bh, 2, 2, 'FD');
    doc.setFillColor.apply(doc, PDF_C.pale);
    doc.roundedRect(bx, sy, bw, 8, 2, 2, 'F');
    doc.rect(bx, sy + 5, bw, 3, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, PDF_C.marine);
    doc.text(b.titre, bx + 3, sy + 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, PDF_C.texte);
    doc.text(b.nom || '', bx + 3, sy + 13);
    if (b.img) {
      try {
        const p = doc.getImageProperties(b.img);
        const zw = bw - 8, zh = bh - 20;
        const r = Math.min(zw / p.width, zh / p.height);
        doc.addImage(b.img, 'JPEG', bx + (bw - p.width * r) / 2, sy + 16 + (zh - p.height * r) / 2, p.width * r, p.height * r);
      } catch (e) { /* ignore */ }
    }
  });

  // ---------- Pieds de page ----------
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor.apply(doc, PDF_C.bord);
    doc.line(M, H - 10, W - M, H - 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor.apply(doc, PDF_C.gris2);
    doc.text('CDES · VMS ' + (data.nVMS || '') + (data.chantier ? ' — ' + data.chantier : ''), M, H - 6);
    doc.text('Page ' + i + '/' + total, W - M, H - 6, { align: 'right' });
  }
  return doc;
}

function nomFichierPDF(data) {
  return (data.nVMS || 'VMS') + '_' + (data.chantier || 'export').replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
}

// PDF en base64 (pour la pièce jointe du mail)
function genererPDF(data) {
  return construirePDF(data).output('datauristring');
}

// Bouton : Enregistrer en PDF (téléchargement direct) + envoi caché au Sheet
async function enregistrerPDF() {
  if (!document.getElementById('chantier').value.trim()) { toast('Veuillez renseigner le nom du chantier', 'error'); return; }
  await assurerNumero();
  const data = collecterDonnees();
  data.photosChantier = photosChantier();
  const r = await assurerEnvoi(data);
  try {
    construirePDF(data).save(nomFichierPDF(data));
    if (r.ok) toast('🖨️ PDF enregistré ✓', 'success'); else signalerEnvoi(r);
  } catch (e) {
    toast('❌ Échec de la génération du PDF : ' + e.message, 'error');
  }
}

// Bouton : Envoyer la VMS par mail (PDF en pièce jointe) + envoi caché au Sheet
async function envoyerParMail() {
  if (!document.getElementById('chantier').value.trim()) { toast('Veuillez renseigner le nom du chantier', 'error'); return; }
  if (!estBranche()) { toast('🔌 Appareil non branché : ouvre la VMS depuis l\'intranet HSE', 'error'); return; }

  const btn = document.querySelector('.btn-mail');
  const label = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = '⏳ Envoi...'; btn.disabled = true; }
  toast('⏳ Génération du PDF et envoi...');
  try {
    await assurerNumero();
    const data = collecterDonnees();
    data.photosChantier = photosChantier();
    const r = await assurerEnvoi(data);       // actions au plan d'actions
    const pdf = genererPDF(data);             // PDF vectoriel en base64
    const j = await poster({ action: 'email', pdf, nVMS: data.nVMS, chantier: data.chantier,
      agence: data.agence, dateVisite: data.date, visiteur: data.visiteur });
    if (!j.ok) throw new Error(j.erreur || j.message || 'Erreur serveur');
    if (r.ok) toast('📧 VMS envoyée ✓ — elle part de la boîte Outlook CDES', 'success'); else signalerEnvoi(r);
  } catch (e) {
    toast('❌ Échec de l\'envoi du mail : ' + e.message, 'error');
  } finally {
    if (btn) { btn.innerHTML = label; btn.disabled = false; }
  }
}

// ========================================================
// EXPORT EXCEL
// ========================================================
function exportExcel() {
  const data = collecterDonnees();
  const rows = [['N° VMS','Date','Chantier','Agence','Activité','Visiteur','Conducteur','Collaborateurs','N° Obs','Type','Description','Action convenue','Domaine','Impact SSE','Transversal','Pilote','Échéance']];
  data.observations.forEach(o => {
    rows.push([data.nVMS, data.date, data.chantier, data.agence, data.activite, data.visiteur, data.conducteur, data.collaborateurs,
      o.nObs, o.type, o.description, o.action, o.domaine, o.impact, o.transversal, o.pilote, o.echeance]);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [14,12,22,8,18,18,20,20,6,6,45,45,14,10,10,16,12].map(w => ({wch:w}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'VMS');
  XLSX.writeFile(wb, (data.nVMS || 'VMS') + '_' + (data.chantier || 'export').replace(/[^a-zA-Z0-9]/g,'_') + '.xlsx');
}

// ========================================================
// NOUVELLE VMS
// ========================================================
function nouvelleVMS() {
  if (!confirm('Créer une nouvelle VMS ? Les données non envoyées seront perdues.')) return;
  envoiPromise = null;
  numeroDefinitif = false;
  document.getElementById('vms-numero').textContent = numeroProvisoire();
  document.getElementById('date-visite').valueAsDate = new Date();
  ['chantier','agence','activite','visiteur','conducteur','collaborateurs','bilan-global','commentaires','sign-name-1','sign-name-2']
    .forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('obs-tbody').innerHTML = '';
  document.getElementById('photos-chantier-preview').innerHTML = '';
  clearCanvas('drawingCanvas1');
  clearCanvas('drawingCanvas2');
  majCompteurs();
  ajouterObs();
}

// ========================================================
// SIGNATURES (canvas, souris + tactile, haute résolution)
// ========================================================
function setupCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  let painting = false;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    // Sauvegarde du tracé
    const data = canvas.width ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#12305A';
    if (data) ctx.putImageData(data, 0, 0);
  }

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) ? e.touches[0] : e;
    return { x: p.clientX - rect.left, y: p.clientY - rect.top };
  }
  function start(e) { painting = true; const c = pos(e); ctx.beginPath(); ctx.moveTo(c.x, c.y); e.preventDefault(); }
  function draw(e) { if (!painting) return; const c = pos(e); ctx.lineTo(c.x, c.y); ctx.stroke(); e.preventDefault(); }
  function end(e) { painting = false; ctx.beginPath(); }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', end);
  canvas.addEventListener('mouseout', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', end);

  setTimeout(resize, 0);
  window.addEventListener('resize', () => setTimeout(resize, 100));
}

function clearCanvas(canvasId) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ========================================================
// MÉMO — CARTOGRAPHIE FHO (cliquable → observation)
// ========================================================
let MEMO = [];   // chargé depuis data/listes.json

function renderMemo() {
  const grid = document.getElementById('memo-grid');
  MEMO.forEach(f => {
    const card = document.createElement('div');
    card.className = 'memo-card ' + f.cls;
    card.innerHTML = `<div class="memo-card-head"><span class="ico">${f.ico}</span>${f.title}</div><div class="memo-card-body"></div>`;
    const body = card.querySelector('.memo-card-body');
    f.items.forEach(txt => {
      const it = document.createElement('div');
      it.className = 'memo-item';
      const label = document.createElement('span');
      label.textContent = txt;
      it.innerHTML = '<span class="plus">＋</span>';
      it.appendChild(label);
      it.onclick = () => memoAdd(txt);
      body.appendChild(it);
    });
    grid.appendChild(card);
  });
}

function memoAdd(text) {
  const descs = [...document.querySelectorAll('#obs-tbody .inp-desc')];
  const existing = descs.find(t => t.value.trim().toLowerCase() === text.toLowerCase());
  if (existing) {
    const tr = existing.closest('tr');
    tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    existing.focus();
    toast('Déjà dans la liste');
    return;
  }
  ajouterObs({ desc: text });
  const tr = document.querySelector('#obs-tbody tr:last-child');
  tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
  autoH(tr.querySelector('.inp-desc'));
  toast('Observation ajoutée ✓', 'success');
}

// ========================================================
// INITIALISATION
// ========================================================
async function demarrerVms() {
  appliquerLienBranchement();
  await chargerListes();
  renderMemo();
  document.getElementById('vms-numero').textContent = numeroProvisoire();
  document.getElementById('date-visite').valueAsDate = new Date();
  ajouterObs();
  setupCanvas('drawingCanvas1');
  setupCanvas('drawingCanvas2');
  afficherResponsables();
  majBandeau();
  pingServeur();
}
demarrerVms();
