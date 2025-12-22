// ===== Navigazione tra sezioni (SPA leggera) =====
const navLinks = Array.from(document.querySelectorAll('.nav a[data-page]'));
const pages = Array.from(document.querySelectorAll('section.page'));

function showPage(pageKey){
  const id = 'page-' + pageKey;
  const target = document.getElementById(id);
  if(!target) return;

  pages.forEach(p => p.classList.remove('active'));
  target.classList.add('active');

  navLinks.forEach(a => a.classList.remove('active'));
  const activeLink = navLinks.find(a => a.getAttribute('data-page') === pageKey);
  if(activeLink) activeLink.classList.add('active');

  // hash “pulito”
  history.replaceState(null, '', '#' + pageKey);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navLinks.forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const key = a.getAttribute('data-page');
    showPage(key);
  });
});

const initial = (location.hash || '').replace('#','') || 'home';
showPage(initial);

// ===== Agenda tabs (Oggi / Settimana) =====
const agendaTabs = Array.from(document.querySelectorAll('#agendaTabs .tab'));
const agendaPanels = Array.from(document.querySelectorAll('[data-agenda-panel]'));
if(agendaTabs.length && agendaPanels.length){
  agendaTabs.forEach(t => {
    t.addEventListener('click', () => {
      const key = t.getAttribute('data-agenda');
      agendaTabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      agendaPanels.forEach(p => {
        p.style.display = (p.getAttribute('data-agenda-panel') === key) ? 'grid' : 'none';
      });
    });
  });
}

// ===== Clienti: selezione + checklist + scoring =====
const clientItems = Array.from(document.querySelectorAll('#clientList .item'));
const clientTitle = document.getElementById('clientTitle');
const clientSubtitle = document.getElementById('clientSubtitle');

const closeRing = document.getElementById('closeRing');
const closePct = document.getElementById('closePct');
const checklistGrid = document.getElementById('checklistGrid');
const breakdownList = document.getElementById('breakdownList');
const clientBranch = document.getElementById('clientBranch');
const clientStage = document.getElementById('clientStage');

const lastDate = document.getElementById('lastDate');
const lastChannel = document.getElementById('lastChannel');
const lastOutcome = document.getElementById('lastOutcome');
const nextDue = document.getElementById('nextDue');
const nextAction = document.getElementById('nextAction');
const clientReset = document.getElementById('clientReset');

let selectedClient = '';

// === Modello % di chiusura (spiegabile) ===
// Checklist = 80, Recency = 10, Prossima azione = 10 => 100
const CHECK_ITEMS = [
  { key:'profile', label:'Profilo cliente completo', points:10, tip:'Dati base + contesto (famiglia/lavoro/obiettivi)' },
  { key:'needs_explicit', label:'Bisogni espliciti chiari', points:10, tip:'Cosa vuole ottenere, detto da lui' },
  { key:'needs_latent', label:'Bisogni latenti ipotizzati', points:5, tip:'Rischi/opportunità non ancora esplicitati' },
  { key:'solution_fit', label:'Soluzione/prodotto coerente', points:10, tip:'Proposta allineata ai bisogni' },
  { key:'objections', label:'Obiezioni mappate', points:10, tip:'Prezzo, tempo, vincoli, confronto…' },
  { key:'dm_involved', label:'Decision maker coinvolto', points:10, tip:'Coniuge/socio/chi decide è dentro' },
  { key:'proposal_sent', label:'Proposta inviata', points:10, tip:'Documento o opzioni presentate' },
  { key:'followup_done', label:'Follow-up fatto', points:5, tip:'Ricontatto dopo proposta' },
  { key:'timing_clear', label:'Timing decisionale chiaro', points:5, tip:'Quando decidono e perché' },
  { key:'next_step_set', label:'Prossimo step fissato', points:5, tip:'Data/azione concordata' },
];

const DEFAULTS = {
  'Cliente A': { branch:'Vita', stage:'In valutazione' },
  'Cliente B': { branch:'Investimenti', stage:'Primo contatto' },
  'Cliente C': { branch:'Danni', stage:'Documenti' },
};

function storageKey(client){ return `gaih_client_${client}`; }

function loadClientState(client){
  try{
    const raw = localStorage.getItem(storageKey(client));
    if(raw){
      const parsed = JSON.parse(raw);
      return {
        checks: parsed.checks || {},
        lastDate: parsed.lastDate || '',
        lastChannel: parsed.lastChannel || '',
        lastOutcome: parsed.lastOutcome || '',
        nextDue: parsed.nextDue || '',
        nextAction: parsed.nextAction || ''
      };
    }
  }catch{}
  return { checks:{}, lastDate:'', lastChannel:'', lastOutcome:'', nextDue:'', nextAction:'' };
}

function saveClientState(client, state){
  try{ localStorage.setItem(storageKey(client), JSON.stringify(state)); }catch{}
}

function daysBetween(isoDate){
  if(!isoDate) return null;
  const d = new Date(isoDate + 'T00:00:00');
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  return Math.floor(diff / (1000*60*60*24));
}

function recencyPoints(isoDate){
  const days = daysBetween(isoDate);
  if(days === null) return 0;
  if(days <= 7) return 10;
  if(days <= 14) return 5;
  return 0;
}

function nextActionPoints(action, due){
  if((action||'').trim() && (due||'').trim()) return 10;
  if((action||'').trim() || (due||'').trim()) return 5;
  return 0;
}

function computeScore(state){
  const checklistScore = CHECK_ITEMS.reduce((sum, it) => sum + (state.checks?.[it.key] ? it.points : 0), 0);
  const r = recencyPoints(state.lastDate);
  const n = nextActionPoints(state.nextAction, state.nextDue);
  const total = Math.max(0, Math.min(100, checklistScore + r + n));
  return { total, checklistScore, recency:r, nextAction:n };
}

function setRing(percent){
  const p = Math.max(0, Math.min(100, percent));
  if(closePct) closePct.textContent = `${p}%`;
  if(closeRing){
    closeRing.style.background = `conic-gradient(from -90deg, rgba(61,220,151,.95) ${p}%, rgba(255,255,255,.10) 0)`;
  }
}

function renderBreakdown(state){
  if(!breakdownList) return;
  const s = computeScore(state);
  breakdownList.innerHTML = '';

  const rows = [
    { title:'Checklist', sub:`${s.checklistScore}/80`, val:`+${s.checklistScore}` },
    { title:'Freschezza contatto', sub:`${s.recency}/10 (≤7gg=10, ≤14gg=5)`, val:`+${s.recency}` },
    { title:'Prossima azione', sub:`${s.nextAction}/10 (azione+scadenza)`, val:`+${s.nextAction}` },
  ];

  rows.forEach(r => {
    const div = document.createElement('div');
    div.className = 'bdRow';
    div.innerHTML = `<div><b>${r.title}</b><br><small>${r.sub}</small></div><span class="tag">${r.val}</span>`;
    breakdownList.appendChild(div);
  });

  const hint = document.createElement('div');
  hint.className = 'bdRow';
  hint.innerHTML = `<div><b>Totale</b><br><small>0–100 (spiegabile)</small></div><span class="tag ok">${s.total}%</span>`;
  breakdownList.appendChild(hint);
}

function renderChecklist(state){
  if(!checklistGrid) return;
  checklistGrid.innerHTML = '';

  CHECK_ITEMS.forEach(it => {
    const div = document.createElement('div');
    const active = !!state.checks?.[it.key];
    div.className = 'checkItem' + (active ? ' active' : '');
    div.innerHTML = `
      <div class="checkLeft">
        <div class="box">${active ? '✓' : ''}</div>
        <div>
          <b>${it.label}</b><br>
          <span class="mini">${it.tip}</span>
        </div>
      </div>
      <span class="tag">+${it.points}</span>
    `;

    div.addEventListener('click', () => {
      if(!selectedClient) return;
      state.checks = state.checks || {};
      state.checks[it.key] = !state.checks[it.key];
      saveClientState(selectedClient, state);
      refreshClientUI(state);
    });

    checklistGrid.appendChild(div);
  });
}

function refreshClientListPercents(){
  clientItems.forEach(it => {
    const name = it.getAttribute('data-client');
    const state = loadClientState(name);
    const score = computeScore(state).total;
    const badge = it.querySelector('.tag');
    if(badge){
      badge.textContent = `${score}%`;
      badge.classList.remove('ok','warn');
      if(score >= 70) badge.classList.add('ok');
      else if(score >= 40) badge.classList.add('warn');
    }
  });
}

function refreshClientUI(state){
  const s = computeScore(state);
  setRing(s.total);
  renderChecklist(state);
  renderBreakdown(state);

  if(lastDate) lastDate.value = state.lastDate || '';
  if(lastChannel) lastChannel.value = state.lastChannel || '';
  if(lastOutcome) lastOutcome.value = state.lastOutcome || '';
  if(nextDue) nextDue.value = state.nextDue || '';
  if(nextAction) nextAction.value = state.nextAction || '';

  const meta = DEFAULTS[selectedClient] || {};
  if(clientBranch) clientBranch.textContent = `Ramo: ${meta.branch || '—'}`;
  if(clientStage) clientStage.textContent = `Stato: ${meta.stage || '—'}`;
  refreshClientListPercents();
}

function bindFormAutosave(state){
  const onChange = () => {
    if(!selectedClient) return;
    state.lastDate = lastDate?.value || '';
    state.lastChannel = lastChannel?.value || '';
    state.lastOutcome = lastOutcome?.value || '';
    state.nextDue = nextDue?.value || '';
    state.nextAction = nextAction?.value || '';
    saveClientState(selectedClient, state);
    refreshClientUI(state);
  };

  lastDate?.addEventListener('change', onChange);
  lastChannel?.addEventListener('change', onChange);
  lastOutcome?.addEventListener('change', onChange);
  nextDue?.addEventListener('change', onChange);
  nextAction?.addEventListener('input', onChange);

  clientReset?.addEventListener('click', () => {
    if(!selectedClient) return;
    try{ localStorage.removeItem(storageKey(selectedClient)); }catch{}
    const fresh = loadClientState(selectedClient);
    refreshClientUI(fresh);
  });
}

function selectClient(name){
  selectedClient = name || '';
  if(clientTitle) clientTitle.textContent = name ? `Dettaglio — ${name}` : 'Dettaglio cliente';
  if(clientSubtitle) clientSubtitle.textContent = name ? 'Checklist + log + prossima azione (auto-save). % live e spiegabile.' : 'Seleziona un cliente a sinistra.';

  if(!name){
    setRing(0);
    return;
  }

  const state = loadClientState(name);
  refreshClientUI(state);
  bindFormAutosave(state);
}

// bind lista clienti
if(clientItems.length){
  clientItems.forEach(it => it.addEventListener('click', () => selectClient(it.getAttribute('data-client'))));
  refreshClientListPercents();
}

// ===== Toolkit AI (prompt builder) =====
const aiMode = document.getElementById('aiMode');
const aiNotes = document.getElementById('aiNotes');
const aiPrompt = document.getElementById('aiPrompt');
const aiGenerate = document.getElementById('aiGenerate');
const aiCopy = document.getElementById('aiCopy');

function buildPrompt(){
  const mode = aiMode?.value || 'followup';
  const notes = (aiNotes?.value || '').trim();
  const client = selectedClient ? `Cliente: ${selectedClient}\n` : '';

  const baseContext =
    `Agisci come un consulente assicurativo italiano (Generali), professionale ma empatico.\n` +
    `Obiettivo: aiutarmi a gestire la trattativa in modo pratico, con prossimi step chiari.\n` +
    `${client}`;

  const inputNotes = `\nNote rapide:\n${notes || '(Nessuna nota fornita)'}\n`;

  let request = '';
  if(mode === 'followup') request = 'Scrivi un follow-up (WhatsApp + Email) semplice, umano, senza gergo, con prossimo step chiaro.';
  if(mode === 'obiezioni') request = 'Elenca le obiezioni probabili e dammi risposte brevi + una strategia di conversazione.';
  if(mode === 'chiusura') request = 'Stima una probabilità di chiusura motivata (con fattori) e dammi i 3 prossimi step migliori.';
  if(mode === 'sentiment') request = 'Valuta il sentiment e i rischi principali. Suggerisci come ridurre i rischi e aumentare fiducia.';

  const outputFormat =
    `\n\nOutput richiesto:\n` +
    `- 3 punti chiave\n` +
    `- Testo pronto\n` +
    `- Prossimi step\n`;

  return baseContext + inputNotes + "\nRichiesta:\n" + request + outputFormat;
}

aiGenerate?.addEventListener('click', ()=> {
  if(!aiPrompt) return;
  aiPrompt.value = buildPrompt();
  aiPrompt.focus();
  aiPrompt.scrollTop = 0;
});

aiCopy?.addEventListener('click', async ()=> {
  if(!aiPrompt) return;
  if(!aiPrompt.value) aiPrompt.value = buildPrompt();
  try{
    await navigator.clipboard.writeText(aiPrompt.value);
    alert('Prompt copiato. Incollalo su ChatGPT.');
  }catch{
    aiPrompt.focus();
    aiPrompt.select();
    alert('Selezionato: premi CTRL/CMD + C per copiare.');
  }
});

// ===== Accessi rapidi (jump) =====
document.querySelectorAll('[data-jump]').forEach(btn => {
  btn.addEventListener('click', ()=> {
    const key = btn.getAttribute('data-jump');
    showPage(key);
  });
});

// ===== Logout (DEV) =====
document.getElementById('logout')?.addEventListener('click', ()=>alert('Anteprima: logout disattivato.'));

// ===== DEV badge =====
const devBadge = document.getElementById('devBadge');
function setBadge(ok, msg){
  if(!devBadge) return;
  devBadge.className = 'dev-badge ' + (ok ? 'ok' : 'bad');
  devBadge.innerHTML = ok ? `✅ <b>DEV OK</b> <span>${msg||''}</span>` : `⚠️ <b>DEV ERRORE</b> <span>${msg||''}</span>`;
}
try{
  const assert = (name, cond) => { if(!cond) throw new Error(name); };
  assert('navLinks', navLinks.length > 0);
  assert('pages', pages.length > 0);
  assert('showPage()', typeof showPage === 'function');
  assert('CHECK_ITEMS', CHECK_ITEMS.length >= 5);
  setBadge(true, 'navigazione + clienti + toolkit AI');
}catch(e){
  console.error(e);
  setBadge(false, e.message);
}
