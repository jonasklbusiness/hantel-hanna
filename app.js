'use strict';

/* Hantel-Hanna – Hannas Trainingsplan.
   Aufbau: Pläne (z. B. Upper, Lower) → Übungen im Plan → Einträge (Gewicht pro Tag).
   Alle Daten liegen nur lokal auf dem Handy (localStorage). */

const STORE_KEY = 'hantel-hanna-v1';
const STEPS = [1, 2.5, 5];
const PLAN_NAMES = ['Upper', 'Lower', 'Push', 'Pull', 'Beine', 'Oberkörper', 'Unterkörper', 'Ganzkörper', 'Tag A', 'Tag B'];
const TEMPLATES = [
  ['Upper / Lower', ['Upper', 'Lower']],
  ['Push / Pull / Beine', ['Push', 'Pull', 'Beine']],
  ['Ganzkörper', ['Ganzkörper']],
];
const SUGGESTIONS = {
  lower: ['Beinpresse', 'Kniebeugen', 'Beinstrecker', 'Beinbeuger', 'Hip Thrust', 'Rumänisches Kreuzheben', 'Ausfallschritte', 'Abduktoren', 'Adduktoren', 'Wadenheben'],
  push: ['Bankdrücken', 'Brustpresse', 'Butterfly', 'Schulterpresse', 'Seitheben', 'Trizepsdrücken'],
  pull: ['Latzug', 'Rudern sitzend', 'Klimmzüge', 'Face Pulls', 'Bizeps-Curls'],
  core: ['Bauchpresse', 'Rückenstrecker'],
};
const SMALL_STEPS = ['Seitheben', 'Bizeps-Curls']; // Kurzhanteln: 1-kg-Schritte

// Passende Vorschläge zum Plan-Namen („Lower“ → Beinübungen usw.)
function suggestionsFor(planName) {
  const n = planName.toLowerCase();
  const kinds = /low|bein|leg|unter/.test(n) ? ['lower', 'core']
    : /upper|ober/.test(n) ? ['push', 'pull', 'core']
    : /push|drück/.test(n) ? ['push', 'core']
    : /pull|zieh/.test(n) ? ['pull', 'core']
    : ['lower', 'push', 'pull', 'core'];
  return kinds.flatMap(k => SUGGESTIONS[k]);
}

/* ---------- Kleine Helfer ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nf = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });
const kg = n => nf.format(n);
const round2 = n => Math.round(n * 100) / 100;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const parseNum = s => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const pad = n => String(n).padStart(2, '0');
const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyToDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => dateKey(new Date());
const daysAgo = k => Math.round((keyToDate(today()) - keyToDate(k)) / 86400000);
const sameYear = k => k.slice(0, 4) === today().slice(0, 4);
const fmtDate = (k, opts) => keyToDate(k).toLocaleDateString('de-DE', sameYear(k) ? opts : { ...opts, year: 'numeric' });

function relDay(k) {
  const n = daysAgo(k);
  if (n <= 0) return 'heute';
  if (n === 1) return 'gestern';
  if (n < 14) return `vor ${n} Tagen`;
  if (n < 60) return `vor ${Math.round(n / 7)} Wochen`;
  return `am ${fmtDate(k, { day: 'numeric', month: 'short' })}`;
}

function shiftMonth(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  el.focus();
}

/* ---------- Icons ---------- */

const ICONS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 6l6 6-6 6',
  up: 'M12 19V6M6.5 11.5 12 6l5.5 5.5',
  down: 'M12 5v13M6.5 12.5 12 18l5.5-5.5',
  edit: 'M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4',
  chart: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  calendar: 'M7 3v3M17 3v3M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  dumbbell: 'M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 16V5M7 10l5-5 5 5M5 20h14',
  save: 'M12 3v11M7.5 9.5 12 14l4.5-4.5M4 15v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3',
  trophy: 'M8 4h8v6a4 4 0 0 1-8 0V4zM8 6H5.5a2.5 2.5 0 0 0 2.6 3.6M16 6h2.5a2.5 2.5 0 0 1-2.6 3.6M12 14v3M8 21h8M9.5 17h5l.5 4h-6z',
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;

// Das Logo: eine liegende Hantel, die gleichzeitig ein „H“ ist.
const H_SHAPE = '<rect x="11" y="14" width="11" height="36" rx="4"/><rect x="23.5" y="21" width="5.5" height="22" rx="2.5"/><rect x="28" y="28.5" width="8" height="7" rx="1.5"/><rect x="35" y="21" width="5.5" height="22" rx="2.5"/><rect x="42" y="14" width="11" height="36" rx="4"/>';
const LOGO = `<svg class="logo" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="16" fill="var(--accent)"/><g fill="#fff">${H_SHAPE}</g></svg>`;

/* ---------- Daten ---------- */

function emptyData() {
  return { version: 2, plans: [], exercises: [], logs: [], lastBackup: null };
}

// Prüft und bereinigt Daten (beim Start und beim Backup-Laden).
function sanitize(d) {
  if (!d || !Array.isArray(d.exercises) || !Array.isArray(d.logs)) return null;
  const isDate = v => /^\d{4}-\d\d-\d\d$/.test(v);
  const weight = v => Math.max(0, round2(parseNum(v)));
  const count = (v, def) => clamp(parseInt(v, 10) || def, 1, 99);

  const plans = (Array.isArray(d.plans) ? d.plans : []).filter(p => p && p.id && p.name)
    .map(p => ({ id: String(p.id), name: String(p.name) }));
  const planIds = new Set(plans.map(p => p.id));
  let fallback = null; // Übungen ohne Plan (ältere Version) landen in „Mein Training“

  const exercises = d.exercises.filter(e => e && e.id && e.name).map(e => {
    let planId = String(e.planId || '');
    if (!planIds.has(planId)) {
      if (!fallback) {
        fallback = { id: uid(), name: 'Mein Training' };
        plans.push(fallback);
        planIds.add(fallback.id);
      }
      planId = fallback.id;
    }
    return {
      id: String(e.id), planId, name: String(e.name), note: String(e.note || ''),
      weight: weight(e.weight), sets: count(e.sets, 3), reps: count(e.reps, 10),
      step: STEPS.includes(Number(e.step)) ? Number(e.step) : 2.5, createdAt: Number(e.createdAt) || 0,
    };
  });

  const ids = new Set(exercises.map(e => e.id));
  const perDay = new Map(); // höchstens ein Eintrag pro Übung und Tag
  d.logs.filter(l => l && ids.has(String(l.exId)) && isDate(l.date)).forEach(l => perDay.set(`${l.exId}|${l.date}`, {
    id: String(l.id || uid()), exId: String(l.exId), date: l.date,
    weight: weight(l.weight), sets: count(l.sets, 3), reps: count(l.reps, 10), ts: Number(l.ts) || 0,
  }));

  return { version: 2, plans, exercises, logs: [...perDay.values()], lastBackup: isDate(d.lastBackup) ? d.lastBackup : null };
}

function load() {
  try { return sanitize(JSON.parse(localStorage.getItem(STORE_KEY))) || emptyData(); }
  catch { return emptyData(); }
}

let data = load();
let askedPersist = false;

function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
  catch { toast('Speichern hat nicht geklappt.'); }
  // Bittet das iPhone, die Daten dauerhaft zu behalten.
  if (!askedPersist) { askedPersist = true; navigator.storage?.persist?.().catch(() => {}); }
}

// Für Rückgängig: kompletter Stand vor einer Löschung.
const snapshot = () => ({ plans: [...data.plans], exercises: [...data.exercises], logs: [...data.logs] });

const newExercise = v => ({ id: uid(), planId: '', name: '', note: '', weight: 0, sets: 3, reps: 10, step: 2.5, createdAt: Date.now(), ...v });
const planById = id => data.plans.find(p => p.id === id);
const exById = id => data.exercises.find(e => e.id === id);
const exercisesOf = planId => data.exercises.filter(e => e.planId === planId);
const byDate = (a, b) => a.date.localeCompare(b.date) || a.ts - b.ts;
const logsOf = id => data.logs.filter(l => l.exId === id).sort(byDate);
const logOn = (id, date) => data.logs.find(l => l.exId === id && l.date === date);
const prevLog = (id, date) => logsOf(id).filter(l => l.date < date).at(-1);
const trainingDays = () => [...new Set(data.logs.map(l => l.date))].sort().reverse();

function isRecord(log) {
  const earlier = data.logs.filter(l => l.exId === log.exId && l.date < log.date);
  return earlier.length > 0 && log.weight > Math.max(...earlier.map(l => l.weight));
}

// Letzter Tag, an dem eine Übung aus dem Plan eingetragen wurde.
function lastTrained(planId) {
  const ids = new Set(exercisesOf(planId).map(e => e.id));
  return data.logs.reduce((last, l) => (ids.has(l.exId) && l.date > last ? l.date : last), '') || null;
}

// Welcher Plan ist heute dran? Der heute schon begonnene – sonst der, der am längsten her ist.
function nextPlan() {
  const plans = data.plans.filter(p => exercisesOf(p.id).length);
  return plans.find(p => lastTrained(p.id) === today())
    || [...plans].sort((a, b) => (lastTrained(a.id) || '').localeCompare(lastTrained(b.id) || ''))[0]
    || null;
}

/* ---------- Ansichten ---------- */

const ui = { tab: 'training', plan: null, month: today().slice(0, 7), picked: new Set() };

function renderChrome() {
  $('#top').innerHTML = `<div class="bar-in">
    <div class="brand">${LOGO}<span>Hantel-<b>Hanna</b></span></div>
    <button class="icon-btn" data-action="settings" aria-label="Einstellungen">${icon('sliders')}</button>
  </div>`;
  const tabs = [['training', 'dumbbell', 'Training'], ['verlauf', 'calendar', 'Verlauf'], ['fortschritt', 'chart', 'Fortschritt']];
  $('#tabs').innerHTML = `<div class="bar-in">${tabs.map(([id, ic, label]) =>
    `<button class="tab" data-tab="${id}">${icon(ic)}<span>${label}</span></button>`).join('')}</div>`;
}

function render() {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  const views = { training: viewTraining, verlauf: viewHistory, fortschritt: viewProgress };
  $('#main').innerHTML = views[ui.tab]();
}

const weightText = w => w > 0 ? `${kg(w)} kg` : 'ohne Gewicht';
const progressBar = (done, total) => done ? `<span class="progress"><i style="width:${(done / total) * 100}%"></i></span>` : '';

const emptyState = (ic, title, text) =>
  `<div class="empty"><div class="empty-ic">${icon(ic)}</div><h2>${title}</h2><p>${text}</p></div>`;

function greeting() {
  const h = new Date().getHours();
  return h >= 5 && h < 11 ? 'Guten Morgen' : h >= 18 && h < 23 ? 'Guten Abend' : 'Hey';
}

function backupBanner() {
  const due = data.logs.length >= 8 && (!data.lastBackup || daysAgo(data.lastBackup) > 30);
  return due ? `<button class="banner" data-action="settings">${icon('save')}
    <span><b>Zeit für ein Backup</b>Dauert 5 Sekunden – sicher ist sicher.</span>${icon('right')}</button>` : '';
}

/* Training: Übersicht der Pläne */

function viewTraining() {
  const plan = planById(ui.plan);
  if (plan) return viewPlan(plan);
  ui.plan = null;
  if (!data.plans.length) return viewWelcome();

  const t = today();
  const next = nextPlan();
  const sub = !next ? 'Tipp auf einen Plan und füg deine Übungen hinzu.'
    : lastTrained(next.id) === t ? `Heute: <b>${esc(next.name)}</b> – weiter so!`
    : `Heute dran: <b>${esc(next.name)}</b>`;

  return `
    <header class="hello">
      <p class="eyebrow">${fmtDate(t, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1>${greeting()}, Hanna!</h1>
      <p class="sub">${sub}</p>
    </header>
    ${backupBanner()}
    <h2 class="section-title">Deine Pläne</h2>
    <div class="cards">${data.plans.map(p => planCard(p, p === next)).join('')}</div>
    <button class="add-btn" data-action="new-plan">${icon('plus')} Neuer Plan</button>`;
}

function planCard(p, isNext) {
  const exs = exercisesOf(p.id);
  const done = exs.filter(e => logOn(e.id, today())).length;
  const last = lastTrained(p.id);
  const meta = !exs.length ? 'Noch leer – tipp hier, um Übungen hinzuzufügen'
    : `${plural(exs.length, 'Übung', 'Übungen')} · ${done ? `heute ${done} von ${exs.length}` : last ? `zuletzt ${relDay(last)}` : 'noch nicht trainiert'}`;
  return `<button class="plan${isNext ? ' next' : ''}" data-action="open-plan" data-id="${p.id}">
    <span class="plan-icon">${icon('dumbbell')}</span>
    <span class="txt">
      ${isNext ? `<span class="next-tag">${done ? 'Heute' : 'Heute dran'}</span>` : ''}
      <span class="plan-name">${esc(p.name)}</span>
      <span class="meta">${meta}</span>
      ${exs.length ? `<span class="preview">${exs.map(e => esc(e.name)).join(' · ')}</span>` : ''}
      ${progressBar(done, exs.length)}
    </span>
    ${icon('right')}
  </button>`;
}

function viewWelcome() {
  return `<section class="welcome">
    ${LOGO}
    <h1>Willkommen, Hanna!</h1>
    <p>Leg zuerst deine Trainingspläne an. In jeden Plan kommen dann die passenden Übungen.</p>
    <p class="eyebrow welcome-q">Wie trainierst du?</p>
    <div class="templates">${TEMPLATES.map(([label, names], i) => `
      <button class="template" data-action="template" data-id="${i}">
        <span class="txt"><span class="plan-name">${label}</span><span class="meta">${plural(names.length, 'Plan', 'Pläne')}: ${names.join(', ')}</span></span>
        ${icon('right')}
      </button>`).join('')}
    </div>
    <button class="link" data-action="new-plan">${icon('edit')} Eigenen Plan anlegen</button>
  </section>`;
}

function createFromTemplate(i) {
  const plans = TEMPLATES[i][1].map(name => ({ id: uid(), name }));
  data.plans.push(...plans);
  if (plans.length === 1) ui.plan = plans[0].id;
  save();
  render();
  window.scrollTo(0, 0);
  toast(plans.length === 1 ? 'Plan angelegt – jetzt kommen die Übungen rein!' : `${plural(plans.length, 'Plan', 'Pläne')} angelegt – tipp einen an!`);
}

/* Training: ein Plan mit seinen Übungen */

function viewPlan(plan) {
  const exs = exercisesOf(plan.id);
  const done = exs.filter(e => logOn(e.id, today())).length;
  const last = lastTrained(plan.id);
  const sub = !exs.length ? 'Füg die Übungen hinzu, die du an diesem Tag machst.'
    : done === exs.length ? 'Alles geschafft für heute – stark! 🎉'
    : done ? `Heute schon ${done} von ${exs.length} geschafft.`
    : last ? `Zuletzt trainiert: ${relDay(last)}` : 'Tipp auf eine Übung, um dein Gewicht einzutragen.';

  return `
    <div class="plan-top">
      <button class="back" data-action="back">${icon('left')} Pläne</button>
      <button class="icon-btn soft" data-action="edit-plan" data-id="${plan.id}" aria-label="Plan bearbeiten">${icon('edit')}</button>
    </div>
    <header class="hello">
      <h1>${esc(plan.name)}</h1>
      <p class="sub">${sub}</p>
      ${progressBar(done, exs.length)}
    </header>
    ${exs.length
      ? `<div class="cards">${exs.map(cardExercise).join('')}</div>
         <button class="add-btn" data-action="new-exercise">${icon('plus')} Übung hinzufügen</button>`
      : picker(plan)}`;
}

function cardExercise(e) {
  const logs = logsOf(e.id);
  const last = logs.at(-1), prev = logs.at(-2);
  const done = last && last.date === today();
  const gain = last && prev ? round2(last.weight - prev.weight) : 0;
  const when = done ? 'heute erledigt' : last ? `zuletzt ${relDay(last.date)}` : 'noch nicht eingetragen';
  const weight = e.weight > 0
    ? `<span><span class="num">${kg(e.weight)}</span><span class="unit">kg</span></span>`
    : last ? '<span class="unit">ohne Gewicht</span>' : '<span class="num muted">–</span>';
  return `<button class="ex${done ? ' done' : ''}" data-action="log" data-id="${e.id}">
    <span class="tick">${icon('check')}</span>
    <span class="txt">
      <span class="name">${esc(e.name)}</span>
      <span class="meta">${e.sets} × ${e.reps} · ${when}</span>
    </span>
    <span class="wt">${weight}${gain > 0 ? `<span class="up">${icon('up')}${kg(gain)}</span>` : ''}</span>
  </button>`;
}

// Leerer Plan: mehrere Übungen auf einmal antippen.
function picker(plan) {
  const n = ui.picked.size;
  return `<section class="picker">
    <p class="picker-title">Welche Übungen gehören zu „${esc(plan.name)}“?</p>
    <p class="picker-sub">Tipp sie in der Reihenfolge an, in der du sie machst.</p>
    <div class="pick">${suggestionsFor(plan.name).map(name => {
      const on = ui.picked.has(name);
      return `<button class="chip${on ? ' on' : ''}" data-action="pick" data-id="${esc(name)}">${icon(on ? 'check' : 'plus')}${esc(name)}</button>`;
    }).join('')}</div>
    <button class="primary" data-action="add-picked" ${n ? '' : 'disabled'}>${n ? `${plural(n, 'Übung', 'Übungen')} hinzufügen` : 'Übungen auswählen'}</button>
    <button class="link" data-action="new-exercise">${icon('edit')} Eigene Übung anlegen</button>
  </section>`;
}

function addPicked() {
  const names = [...ui.picked];
  if (!planById(ui.plan) || !names.length) return;
  for (const name of names) data.exercises.push(newExercise({ name, planId: ui.plan, step: SMALL_STEPS.includes(name) ? 1 : 2.5 }));
  ui.picked.clear();
  save();
  render();
  window.scrollTo(0, 0);
  toast(`${plural(names.length, 'Übung', 'Übungen')} hinzugefügt – tipp eine an!`);
}

/* Verlauf */

function viewHistory() {
  const days = trainingDays();
  if (!days.length) return `<h1 class="page-title">Verlauf</h1>
    ${emptyState('calendar', 'Noch kein Training', 'Sobald du eine Übung einträgst, siehst du hier, wann du was trainiert hast.')}`;

  const t = today();
  const now = new Date();
  const monday = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + 6) % 7));
  const stat = (n, label) => `<div class="stat"><span class="num">${n}</span>
    <span class="lbl">${n === 1 ? 'Training' : 'Trainings'}<br>${label}</span></div>`;

  return `<h1 class="page-title">Verlauf</h1>
    <div class="stats">
      ${stat(days.filter(d => d >= monday).length, 'diese Woche')}
      ${stat(days.filter(d => d.startsWith(t.slice(0, 7))).length, 'diesen Monat')}
      ${stat(days.length, 'insgesamt')}
    </div>
    ${calendar(new Set(days), days.at(-1))}
    <h2 class="section-title">Deine Trainings</h2>
    ${days.map(dayCard).join('')}`;
}

function calendar(trained, firstDay) {
  const [y, m] = ui.month.split('-').map(Number);
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Woche beginnt am Montag
  const length = new Date(y, m, 0).getDate();
  const t = today();
  let cells = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => `<span class="wd">${d}</span>`).join('');
  cells += '<span></span>'.repeat(offset);
  let count = 0;
  for (let d = 1; d <= length; d++) {
    const k = `${ui.month}-${pad(d)}`;
    const on = trained.has(k);
    if (on) count++;
    const cls = `d${on ? ' on' : ''}${k === t ? ' today' : ''}`;
    cells += on ? `<button class="${cls}" data-action="goto-day" data-date="${k}">${d}</button>` : `<span class="${cls}">${d}</span>`;
  }
  const title = new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  return `<section class="cal">
    <div class="cal-head">
      <button class="icon-btn" data-action="month" data-d="-1" aria-label="Vorheriger Monat" ${ui.month > firstDay.slice(0, 7) ? '' : 'disabled'}>${icon('left')}</button>
      <div><h3>${title}</h3><p>${plural(count, 'Training', 'Trainings')}</p></div>
      <button class="icon-btn" data-action="month" data-d="1" aria-label="Nächster Monat" ${ui.month < t.slice(0, 7) ? '' : 'disabled'}>${icon('right')}</button>
    </div>
    <div class="cal-grid">${cells}</div>
  </section>`;
}

function dayCard(k) {
  const logs = data.logs.filter(l => l.date === k).sort((a, b) => a.ts - b.ts);
  const n = daysAgo(k);
  const tag = n === 0 ? 'heute' : n === 1 ? 'gestern' : '';
  const plans = [...new Set(logs.map(l => planById(exById(l.exId)?.planId)?.name).filter(Boolean))];
  const sub = [...plans.map(p => `<b>${esc(p)}</b>`), plural(logs.length, 'Übung', 'Übungen')].join(' · ');
  return `<article class="day" id="day-${k}">
    <header>
      <div><h3>${fmtDate(k, { weekday: 'long', day: 'numeric', month: 'long' })}</h3><p class="day-sub">${sub}</p></div>
      ${tag ? `<span class="pill">${tag}</span>` : ''}
    </header>
    ${logs.map(l => {
      const e = exById(l.exId);
      return e ? logRow(l, esc(e.name)) : '';
    }).join('')}
  </article>`;
}

function logRow(l, label) {
  return `<button class="row" data-action="edit-log" data-ex="${l.exId}" data-date="${l.date}">
    <span class="name">${label}</span>
    ${deltaBadge(l)}
    <span class="val">${weightText(l.weight)}<small>${l.sets}×${l.reps}</small></span>
  </button>`;
}

function deltaBadge(l) {
  const prev = prevLog(l.exId, l.date);
  if (!prev) return '<span class="badge new">Start</span>';
  const d = round2(l.weight - prev.weight);
  if (isRecord(l)) return `<span class="badge rec">${icon('trophy')} +${kg(d)}</span>`;
  if (d > 0) return `<span class="badge">+${kg(d)}</span>`;
  if (d < 0) return `<span class="badge down">−${kg(-d)}</span>`;
  return '';
}

function gotoDay(k) {
  const el = document.getElementById(`day-${k}`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.remove('flash');
  void el.offsetWidth;
  el.classList.add('flash');
}

/* Fortschritt */

function viewProgress() {
  const rows = data.exercises.map(e => ({ e, logs: logsOf(e.id) })).filter(r => r.logs.length)
    .map(r => ({ ...r, gain: round2(r.logs.at(-1).weight - r.logs[0].weight) }));
  if (!rows.length) return `<h1 class="page-title">Fortschritt</h1>
    ${emptyState('chart', 'Hier wächst bald was', 'Trag deine Gewichte ein – dann siehst du hier, wie du von Woche zu Woche stärker wirst.')}`;

  const total = round2(rows.reduce((sum, r) => sum + Math.max(0, r.gain), 0));
  const improved = rows.filter(r => r.gain > 0).length;
  const month = today().slice(0, 7);
  const records = data.logs.filter(l => l.date.startsWith(month) && isRecord(l)).length;
  const monthName = new Date().toLocaleDateString('de-DE', { month: 'long' });

  const hero = total > 0
    ? `<p class="eyebrow">Seit du angefangen hast</p>
       <div class="big">+${kg(total)} kg</div>
       <p>Bei ${improved} von ${plural(rows.length, 'Übung', 'Übungen')} hast du dein Gewicht gesteigert.</p>`
    : `<p class="eyebrow">Dein Fortschritt</p>
       <div class="big">Los geht's!</div>
       <p>Steigere ein Gewicht – dann siehst du hier, wie viel stärker du geworden bist.</p>`;

  const progRow = ({ e, logs, gain }) => `<button class="prog" data-action="detail" data-id="${e.id}">
    <span class="txt">
      <span class="name">${esc(e.name)}</span>
      <span class="range">${kg(logs[0].weight)} → ${kg(logs.at(-1).weight)} kg</span>
    </span>
    ${sparkSVG(logs)}
    <span class="delta${gain > 0 ? '' : ' flat'}">${gain > 0 ? '+' + kg(gain) : gain < 0 ? '−' + kg(-gain) : '±0'}<small>kg</small></span>
  </button>`;

  return `<h1 class="page-title">Fortschritt</h1>
    <section class="hero">
      <svg class="hero-mark" viewBox="0 0 64 64" aria-hidden="true"><g fill="currentColor">${H_SHAPE}</g></svg>
      ${hero}
      ${records ? `<span class="hero-pill">${icon('trophy')} ${plural(records, 'neuer Rekord', 'neue Rekorde')} im ${monthName}</span>` : ''}
    </section>
    ${data.plans.map(p => {
      const own = rows.filter(r => r.e.planId === p.id);
      return own.length ? `<h2 class="group-title">${esc(p.name)}</h2>${own.map(progRow).join('')}` : '';
    }).join('')}`;
}

/* ---------- Diagramme ---------- */

let chartId = 0;

function chartSVG(logs) {
  const W = 340, H = 180, L = 30, R = 14, T = 24, B = 24;
  const ws = logs.map(l => l.weight);
  const lo = Math.min(...ws), hi = Math.max(...ws);
  let min = lo, max = hi;
  if (max - min < 2) { min -= 2.5; max += 2.5; }
  const padY = (max - min) * 0.1;
  min = Math.max(0, min - padY); max += padY;

  const ts = logs.map(l => keyToDate(l.date).getTime());
  const x = t => logs.length === 1 ? (L + W - R) / 2 : L + (t - ts[0]) / (ts.at(-1) - ts[0]) * (W - L - R);
  const y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const pts = logs.map((l, i) => [x(ts[i]), y(l.weight)].map(n => n.toFixed(1)));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('');
  const area = `${line}L${pts.at(-1)[0]},${H - B}L${pts[0][0]},${H - B}Z`;
  const id = `grad${++chartId}`;
  const last = pts.at(-1);

  const grid = [...new Set([lo, hi])].map(v =>
    `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line-2)" stroke-dasharray="3 4"/>
     <text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${kg(v)}</text>`).join('');
  const short = k => fmtDate(k, { day: 'numeric', month: 'short' });
  const xLabels = logs.length > 1
    ? `<text x="${L}" y="${H - 4}">${short(logs[0].date)}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${short(logs.at(-1).date)}</text>`
    : `<text x="${last[0]}" y="${H - 4}" text-anchor="middle">${short(logs[0].date)}</text>`;
  const dots = logs.length <= 30
    ? pts.slice(0, -1).map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.5"/>`).join('')
    : '';

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gewichtsverlauf">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color:var(--accent);stop-opacity:.28"/>
      <stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/>
    </linearGradient></defs>
    ${grid}
    ${logs.length > 1 ? `<path d="${area}" fill="url(#${id})"/>
      <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    ${dots}
    <circle cx="${last[0]}" cy="${last[1]}" r="6" fill="var(--accent)" stroke="var(--surface)" stroke-width="3"/>
    <text class="val-label" x="${last[0]}" y="${(last[1] - 12).toFixed(1)}" text-anchor="${logs.length > 1 ? 'end' : 'middle'}">${kg(logs.at(-1).weight)} kg</text>
    ${xLabels}
  </svg>`;
}

function sparkSVG(logs) {
  const W = 72, H = 34, P = 4;
  const ws = logs.map(l => l.weight);
  let min = Math.min(...ws), max = Math.max(...ws);
  if (max === min) { min -= 1; max += 1; }
  const x = i => logs.length === 1 ? W / 2 : P + i / (logs.length - 1) * (W - 2 * P);
  const y = v => P + (1 - (v - min) / (max - min)) * (H - 2 * P);
  const pts = ws.map((w, i) => `${x(i).toFixed(1)},${y(w).toFixed(1)}`);
  const [lx, ly] = pts.at(-1).split(',');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    ${logs.length > 1 ? `<polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    <circle cx="${lx}" cy="${ly}" r="3.5" fill="var(--accent)"/>
  </svg>`;
}

/* ---------- Bottom-Sheets ---------- */

// Sheets liegen auf einem Stapel: „Schließen“ führt zurück zum vorherigen.
let stack = [];

function openSheet(sheet) {
  stack.push(sheet);
  const d = $('#sheet');
  if (!d.open) d.showModal();
  paintSheet();
}

function paintSheet(keepScroll = false) {
  const d = $('#sheet');
  const sheet = stack.at(-1);
  const html = sheet.html();
  if (html == null) return closeSheet(); // Übung oder Plan gibt es nicht mehr
  const top = d.scrollTop;
  d.innerHTML = `<div class="sheet"><div class="grab"></div>${html}</div>`;
  d.scrollTop = keepScroll ? top : 0;
  sheet.mount?.(d.firstElementChild);
}

function closeSheet() {
  stack.pop();
  if (stack.length) paintSheet();
  else $('#sheet').close();
}

function closeAll() {
  stack = [];
  $('#sheet').close();
}

const head = (title, sub = '') => `<div class="sheet-head">
  <div><h2>${title}</h2>${sub}</div>
  <button class="icon-btn" data-action="close" aria-label="Schließen">${icon('x')}</button>
</div>`;

const stepper = (key, label, value) => `<div class="stepper">
  <span class="lbl">${label}</span>
  <div class="ctl">
    <button data-inc="${key}" data-d="-1" aria-label="${label}: weniger">${icon('minus')}</button>
    <output id="${key}">${value}</output>
    <button data-inc="${key}" data-d="1" aria-label="${label}: mehr">${icon('plus')}</button>
  </div>
</div>`;

/* Gewicht eintragen */

function logSheet(exId, date = today()) {
  const e = exById(exId);
  const entry = logOn(exId, date);
  const s = { date, weight: entry?.weight ?? e.weight, sets: entry?.sets ?? e.sets, reps: entry?.reps ?? e.reps };

  return {
    html() {
      if (!exById(exId)) return null;
      const existing = logOn(exId, s.date);
      const prev = prevLog(exId, s.date);
      return `${head(esc(e.name), e.note ? `<p class="note">${icon('info')} ${esc(e.note)}</p>` : '')}
        <p class="last">${prev
          ? `Letztes Mal (${relDay(prev.date)}): <b>${weightText(prev.weight)}</b> · ${prev.sets} × ${prev.reps}`
          : 'Erstes Mal – trag einfach ein, womit du startest.'}</p>
        <div class="weight-ctl">
          <button class="round" data-step="-1" aria-label="${kg(e.step)} kg weniger">${icon('minus')}</button>
          <label class="weight-field"><input id="w" inputmode="decimal" enterkeyhint="done" autocomplete="off" value="${kg(s.weight)}" aria-label="Gewicht in kg"><span>kg</span></label>
          <button class="round" data-step="1" aria-label="${kg(e.step)} kg mehr">${icon('plus')}</button>
        </div>
        <p class="hint">± ${kg(e.step)} kg pro Tipp · oder Zahl antippen und eintippen</p>
        <div class="steppers">${stepper('sets', 'Sätze', s.sets)}${stepper('reps', 'Wiederholungen', s.reps)}</div>
        <label class="date-row"><span>Datum</span><input type="date" id="d" value="${s.date}" max="${today()}"></label>
        <button class="primary" data-act="save">${icon('check')} ${existing ? 'Änderung speichern' : 'Eintragen'}</button>
        <div class="sheet-links">
          <button class="link" data-action="detail" data-id="${e.id}">${icon('chart')} Verlauf</button>
          <button class="link" data-action="edit-exercise" data-id="${e.id}">${icon('edit')} Bearbeiten</button>
          ${existing ? `<button class="link danger" data-act="delete" data-id="${existing.id}">Eintrag löschen</button>` : ''}
        </div>`;
    },
    mount(root) {
      const w = $('#w', root);
      const fit = () => { w.style.width = `${Math.max(2, w.value.length + 0.4)}ch`; };
      const setWeight = v => {
        s.weight = Math.max(0, round2(v));
        w.value = kg(s.weight);
        fit();
        w.parentElement.classList.remove('bump');
        void w.offsetWidth;
        w.parentElement.classList.add('bump');
      };
      fit();
      w.addEventListener('focus', () => setTimeout(() => w.setSelectionRange(0, w.value.length)));
      w.addEventListener('input', () => { s.weight = Math.max(0, round2(parseNum(w.value))); fit(); });
      w.addEventListener('blur', () => { w.value = kg(s.weight); fit(); });
      w.addEventListener('keydown', ev => { if (ev.key === 'Enter') w.blur(); });

      $('#d', root).addEventListener('change', ev => {
        s.date = !ev.target.value || ev.target.value > today() ? today() : ev.target.value;
        const other = logOn(exId, s.date);
        if (other) Object.assign(s, { weight: other.weight, sets: other.sets, reps: other.reps });
        paintSheet();
      });

      root.addEventListener('click', ev => {
        const b = ev.target.closest('button');
        if (!b) return;
        if (b.dataset.step) setWeight(s.weight + Number(b.dataset.step) * e.step);
        else if (b.dataset.inc) {
          const key = b.dataset.inc;
          s[key] = clamp(s[key] + Number(b.dataset.d), 1, 99);
          $(`#${key}`, root).textContent = s[key];
        }
        else if (b.dataset.act === 'save') saveLog(e, s);
        else if (b.dataset.act === 'delete') deleteLog(b.dataset.id);
      });
    },
  };
}

function saveLog(e, s) {
  const earlier = data.logs.filter(l => l.exId === e.id && l.date !== s.date);
  const best = Math.max(0, ...earlier.map(l => l.weight));
  const values = { weight: s.weight, sets: s.sets, reps: s.reps };

  const entry = logOn(e.id, s.date);
  if (entry) Object.assign(entry, values);
  else data.logs.push({ id: uid(), exId: e.id, date: s.date, ...values, ts: Date.now() });

  // Der neueste Eintrag ist gleichzeitig das aktuelle Gewicht der Übung.
  if (logsOf(e.id).at(-1).date === s.date) Object.assign(e, values);

  save();
  closeSheet();
  render();
  if (earlier.length && s.weight > best) {
    celebrate();
    toast(`Neuer Rekord: ${kg(s.weight)} kg bei ${e.name}! 🏆`);
  } else {
    toast(`${e.name} eingetragen ✓`);
  }
}

function deleteLog(id) {
  const gone = data.logs.find(l => l.id === id);
  if (!gone) return;
  const e = exById(gone.exId);
  const before = { weight: e.weight, sets: e.sets, reps: e.reps };
  data.logs = data.logs.filter(l => l !== gone);
  const latest = logsOf(e.id).at(-1);
  if (latest && gone.date > latest.date) Object.assign(e, { weight: latest.weight, sets: latest.sets, reps: latest.reps });

  save();
  closeSheet();
  render();
  toast('Eintrag gelöscht', () => {
    data.logs.push(gone);
    Object.assign(e, before);
    save();
    render();
    if (stack.length) paintSheet();
  });
}

/* Übung anlegen / bearbeiten */

function exerciseSheet(id) {
  const e = id ? exById(id) : null;
  let step = e?.step ?? 2.5;
  let planId = e?.planId ?? ui.plan;

  return {
    html() {
      if (id && !exById(id)) return null;
      const plan = planById(planId);
      if (!plan) return null;
      const taken = new Set(exercisesOf(plan.id).map(x => x.name.toLowerCase()));
      const suggestions = e ? [] : suggestionsFor(plan.name).filter(n => !taken.has(n.toLowerCase()));
      return `${head(e ? 'Übung bearbeiten' : 'Neue Übung', e ? '' : `<p class="note">in ${esc(plan.name)}</p>`)}
        <label class="field"><span>Name</span>
          <input id="f-name" value="${esc(e?.name)}" placeholder="z. B. Beinpresse" autocomplete="off" enterkeyhint="done">
        </label>
        ${suggestions.length ? `<div class="chips">${suggestions.map(n => `<button class="chip" data-namev="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
        <label class="field"><span>Notiz <i>· optional</i></span>
          <input id="f-note" value="${esc(e?.note)}" placeholder="z. B. Sitz auf Stufe 4" autocomplete="off">
        </label>
        <div class="row3">
          <label class="field"><span>Gewicht (kg)</span><input id="f-weight" inputmode="decimal" value="${e?.weight ? kg(e.weight) : ''}" placeholder="0"></label>
          <label class="field"><span>Sätze</span><input id="f-sets" type="number" inputmode="numeric" pattern="[0-9]*" min="1" max="99" value="${e?.sets ?? 3}"></label>
          <label class="field"><span>Wdh.</span><input id="f-reps" type="number" inputmode="numeric" pattern="[0-9]*" min="1" max="99" value="${e?.reps ?? 10}"></label>
        </div>
        <div class="field"><span>Gewicht erhöhen in Schritten von</span>
          <div class="seg">${STEPS.map(v => `<button class="${v === step ? 'on' : ''}" data-stepv="${v}">${kg(v)} kg</button>`).join('')}</div>
        </div>
        ${e && data.plans.length > 1 ? `<div class="field"><span>Gehört zum Plan</span>
          <div class="chips">${data.plans.map(p => `<button class="chip${p.id === planId ? ' on' : ''}" data-planv="${p.id}">${esc(p.name)}</button>`).join('')}</div>
        </div>` : ''}
        <div class="form-actions">
          <button class="primary" data-act="save">${icon('check')} Speichern</button>
          ${e ? '<button class="link danger" data-act="delete">Übung löschen</button>' : ''}
        </div>`;
    },
    mount(root) {
      const setStep = v => {
        step = v;
        root.querySelectorAll('[data-stepv]').forEach(x => x.classList.toggle('on', Number(x.dataset.stepv) === v));
      };
      root.addEventListener('click', ev => {
        const b = ev.target.closest('button');
        if (!b) return;
        if (b.dataset.namev) {
          $('#f-name', root).value = b.dataset.namev;
          setStep(SMALL_STEPS.includes(b.dataset.namev) ? 1 : 2.5);
        }
        else if (b.dataset.stepv) setStep(Number(b.dataset.stepv));
        else if (b.dataset.planv) {
          planId = b.dataset.planv;
          root.querySelectorAll('[data-planv]').forEach(x => x.classList.toggle('on', x === b));
        }
        else if (b.dataset.act === 'save') saveExercise(e, root, step, planId);
        else if (b.dataset.act === 'delete') deleteExercise(e);
      });
    },
  };
}

function saveExercise(e, root, step, planId) {
  const field = sel => $(sel, root).value.trim();
  const name = field('#f-name');
  if (!name) return shake($('#f-name', root));
  const values = {
    name, planId, step, note: field('#f-note'),
    weight: Math.max(0, round2(parseNum(field('#f-weight')))),
    sets: clamp(parseInt(field('#f-sets'), 10) || 3, 1, 99),
    reps: clamp(parseInt(field('#f-reps'), 10) || 10, 1, 99),
  };
  if (e) {
    const moved = e.planId !== planId;
    Object.assign(e, values);
    if (moved) data.exercises = [...data.exercises.filter(x => x !== e), e]; // ans Ende des neuen Plans
  } else {
    data.exercises.push(newExercise(values));
  }
  save();
  closeSheet();
  render();
  toast(e ? 'Gespeichert ✓' : `${name} hinzugefügt ✓`);
}

function deleteExercise(e) {
  const logs = data.logs.filter(l => l.exId === e.id);
  if (logs.length && !confirm(`„${e.name}“ wirklich löschen?\n\nAuch ${plural(logs.length, 'Eintrag', 'Einträge')} im Verlauf werden gelöscht.`)) return;
  const before = snapshot();
  data.exercises = data.exercises.filter(x => x !== e);
  data.logs = data.logs.filter(l => l.exId !== e.id);
  save();
  closeAll();
  render();
  toast(`${e.name} gelöscht`, () => { Object.assign(data, before); save(); render(); });
}

/* Plan anlegen / bearbeiten */

function planSheet(id) {
  const plan = id ? planById(id) : null;
  let name = plan?.name ?? '';
  const order = plan ? exercisesOf(plan.id).map(e => e.id) : [];

  return {
    html() {
      if (id && !planById(id)) return null;
      const taken = new Set(data.plans.filter(p => p !== plan).map(p => p.name.toLowerCase()));
      const names = PLAN_NAMES.filter(n => !taken.has(n.toLowerCase()));
      const rows = order.map((exId, i) => `<div class="plan-row">
          <span class="pos">${i + 1}</span>
          <span class="row-name">${esc(exById(exId)?.name)}</span>
          <button class="mini" data-move="${i}" data-d="-1" ${i ? '' : 'disabled'} aria-label="Nach oben">${icon('up')}</button>
          <button class="mini" data-move="${i}" data-d="1" ${i < order.length - 1 ? '' : 'disabled'} aria-label="Nach unten">${icon('down')}</button>
        </div>`).join('');
      return `${head(plan ? 'Plan bearbeiten' : 'Neuer Plan')}
        <label class="field"><span>Name des Plans</span>
          <input id="p-name" value="${esc(name)}" placeholder="z. B. Upper" autocomplete="off" enterkeyhint="done">
        </label>
        ${names.length ? `<div class="chips">${names.map(n => `<button class="chip" data-namev="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
        ${order.length > 1 ? `<h3 class="list-title">Reihenfolge der Übungen</h3>
          <p class="list-sub">So, wie du sie im Gym machst.</p>
          <div class="plan-list">${rows}</div>` : ''}
        <div class="form-actions">
          <button class="primary" data-act="save">${icon('check')} ${plan ? 'Speichern' : 'Plan anlegen'}</button>
          ${plan ? '<button class="link danger" data-act="delete">Plan löschen</button>' : ''}
        </div>`;
    },
    mount(root) {
      const input = $('#p-name', root);
      input.addEventListener('input', () => { name = input.value; });
      input.addEventListener('keydown', ev => { if (ev.key === 'Enter') input.blur(); });
      root.addEventListener('click', ev => {
        const b = ev.target.closest('button');
        if (!b) return;
        if (b.dataset.namev) { name = b.dataset.namev; input.value = name; }
        else if (b.dataset.move) {
          const i = Number(b.dataset.move), j = i + Number(b.dataset.d);
          [order[i], order[j]] = [order[j], order[i]];
          paintSheet(true);
        }
        else if (b.dataset.act === 'save') savePlan(plan, name, order, root);
        else if (b.dataset.act === 'delete') deletePlan(plan);
      });
    },
  };
}

function savePlan(plan, rawName, order, root) {
  const name = rawName.trim();
  if (!name) return shake($('#p-name', root));
  if (plan) {
    plan.name = name;
    // Übungen des Plans in der neuen Reihenfolge einsortieren
    data.exercises = [...data.exercises.filter(e => e.planId !== plan.id), ...order.map(exById).filter(Boolean)];
  } else {
    const created = { id: uid(), name };
    data.plans.push(created);
    ui.plan = created.id;
    ui.picked.clear();
    ui.tab = 'training';
  }
  save();
  closeSheet();
  render();
  window.scrollTo(0, 0);
  toast(plan ? 'Gespeichert ✓' : `Plan „${name}“ angelegt – jetzt kommen die Übungen rein!`);
}

function deletePlan(plan) {
  const exs = exercisesOf(plan.id);
  const ids = new Set(exs.map(e => e.id));
  const logs = data.logs.filter(l => ids.has(l.exId)).length;
  const lost = [exs.length && plural(exs.length, 'Übung', 'Übungen'), logs && plural(logs, 'Eintrag', 'Einträge')].filter(Boolean);
  if (lost.length && !confirm(`Plan „${plan.name}“ wirklich löschen?\n\nDabei werden auch ${lost.join(' und ')} gelöscht.`)) return;
  const before = snapshot();
  data.plans = data.plans.filter(p => p !== plan);
  data.exercises = data.exercises.filter(e => !ids.has(e.id));
  data.logs = data.logs.filter(l => !ids.has(l.exId));
  ui.plan = null;
  save();
  closeAll();
  render();
  window.scrollTo(0, 0);
  toast(`Plan „${plan.name}“ gelöscht`, () => { Object.assign(data, before); save(); render(); });
}

/* Detail einer Übung */

function detailSheet(id) {
  return {
    html() {
      const e = exById(id);
      if (!e) return null;
      const logs = logsOf(id);
      const sub = [planById(e.planId)?.name, e.note].filter(Boolean).map(esc).join(' · ');
      const todayLog = logOn(id, today());
      const actions = `<button class="primary" data-action="log" data-id="${id}">${icon(todayLog ? 'edit' : 'plus')} ${todayLog ? 'Heute bearbeiten' : 'Heute eintragen'}</button>
        <div class="sheet-links"><button class="link" data-action="edit-exercise" data-id="${id}">${icon('edit')} Übung bearbeiten</button></div>`;
      const top = head(esc(e.name), sub ? `<p class="note">${sub}</p>` : '');
      if (!logs.length) return `${top}${emptyState('chart', 'Noch keine Einträge', 'Trag dein erstes Gewicht ein – dann wächst hier deine Kurve.')}${actions}`;

      const first = logs[0], last = logs.at(-1);
      const best = Math.max(...logs.map(l => l.weight));
      const gain = round2(last.weight - first.weight);
      const pct = first.weight > 0 ? Math.round(gain / first.weight * 100) : 0;
      const summary = gain > 0
        ? `Seit ${fmtDate(first.date, { day: 'numeric', month: 'long' })}: <b>+${kg(gain)} kg${pct ? ` (+${pct} %)` : ''}</b> – richtig stark! 💪`
        : logs.length > 1 ? 'Dranbleiben – die nächste Steigerung kommt!' : 'Dein Startpunkt ist gesetzt. Ab jetzt geht\'s aufwärts!';
      const tile = (value, label, unit = true) =>
        `<div class="tile"><span class="num">${value}${unit ? '<small>kg</small>' : ''}</span><span class="lbl">${label}</span></div>`;

      return `${top}
        <p class="summary">${summary}</p>
        ${chartSVG(logs)}
        <div class="tiles">
          ${tile(kg(first.weight), 'Start')}${tile(kg(last.weight), 'Aktuell')}${tile(kg(best), 'Rekord')}${tile(logs.length, 'Trainings', false)}
        </div>
        ${actions}
        <h3 class="list-title">Alle Einträge</h3>
        <div class="entries">${[...logs].reverse().map(l => logRow(l, fmtDate(l.date, { weekday: 'short', day: 'numeric', month: 'short' }))).join('')}</div>`;
    },
  };
}

/* Einstellungen & Backup */

function settingsSheet() {
  return {
    html: () => `${head('Einstellungen')}
      <section class="panel">
        <h3>${icon('save')} Backup</h3>
        <p>Deine Daten sind nur auf diesem iPhone gespeichert. Sichere sie ab und zu – z. B. in der „Dateien“-App (iCloud) oder schick sie dir per WhatsApp.</p>
        <p class="small">${data.lastBackup ? `Letztes Backup: ${relDay(data.lastBackup)}` : 'Du hast noch kein Backup gemacht.'}</p>
        <button class="primary" data-act="export">${icon('download')} Backup speichern</button>
        <button class="secondary" data-act="import">${icon('upload')} Backup laden</button>
        <input type="file" id="file" accept=".json,application/json" hidden>
      </section>
      <section class="panel">
        <h3>${icon('info')} So geht's</h3>
        <p>Leg für jeden Trainingstag einen Plan an, z. B. „Upper“ und „Lower“, und füg dort deine Übungen hinzu.</p>
        <p>Im Gym tippst du auf den Plan, dann auf eine Übung, stellst das Gewicht mit + und − ein und drückst „Eintragen“. Die App merkt sich dein Gewicht fürs nächste Mal.</p>
      </section>
      <p class="credit">Hantel-Hanna · mit ♥ gebaut von Jonas</p>`,
    mount(root) {
      const file = $('#file', root);
      file.addEventListener('change', () => { if (file.files[0]) importBackup(file.files[0]); });
      root.addEventListener('click', ev => {
        const b = ev.target.closest('[data-act]');
        if (b?.dataset.act === 'export') exportBackup();
        if (b?.dataset.act === 'import') file.click();
      });
    },
  };
}

async function exportBackup() {
  const name = `hantel-hanna-backup-${today()}.json`;
  const file = new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
    else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  } catch (err) {
    if (err.name !== 'AbortError') toast('Backup hat nicht geklappt.');
    return;
  }
  data.lastBackup = today();
  save();
  if (stack.length) paintSheet();
  render();
  toast('Backup gespeichert ✓');
}

async function importBackup(file) {
  let backup;
  try { backup = sanitize(JSON.parse(await file.text())); } catch { backup = null; }
  if (!backup) return toast('Das ist leider kein Hantel-Hanna-Backup.');
  const ok = confirm(`Backup laden?\n\nDarin: ${plural(backup.plans.length, 'Plan', 'Pläne')}, ${plural(backup.exercises.length, 'Übung', 'Übungen')}, ${plural(backup.logs.length, 'Eintrag', 'Einträge')}.\nDeine jetzigen Daten auf diesem Handy werden ersetzt.`);
  if (!ok) return;
  data = backup;
  ui.plan = null;
  save();
  closeAll();
  render();
  toast('Backup geladen ✓');
}

/* ---------- Rückmeldungen ---------- */

let toastTimer;

function toast(message, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(message)}</span>${undo ? '<button>Rückgängig</button>' : ''}`;
  if (undo) el.querySelector('button').onclick = () => { undo(); hideToast(); };
  // Als Popover liegt der Toast auch über einem offenen Sheet.
  try { el.hidePopover?.(); } catch {}
  try { el.showPopover?.(); } catch {}
  el.classList.remove('show');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, undo ? 5000 : 2600);
}

function hideToast() {
  const el = $('#toast');
  el.classList.remove('show');
  setTimeout(() => {
    if (!el.classList.contains('show')) try { el.hidePopover?.(); } catch {}
  }, 250);
}

function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const fx = $('#fx');
  try { fx.showPopover?.(); } catch {}
  const colors = ['#FF5A36', '#FFC53D', '#47D196', '#5B8CFF', '#FF8FB1'];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('i');
    const angle = Math.random() * Math.PI * 2;
    const speed = 90 + Math.random() * 150;
    p.className = 'confetti';
    p.style.cssText = `--x:${(Math.cos(angle) * speed).toFixed(0)}px;--y:${(Math.sin(angle) * speed - 110).toFixed(0)}px;` +
      `--r:${Math.round(Math.random() * 720 - 360)}deg;background:${colors[i % colors.length]};animation-delay:${Math.round(Math.random() * 90)}ms`;
    fx.appendChild(p);
  }
  setTimeout(() => {
    fx.replaceChildren();
    try { fx.hidePopover?.(); } catch {}
  }, 1500);
}

/* ---------- Bedienung ---------- */

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-tab], [data-action]');
  if (!t) return;
  if (t.dataset.tab) {
    // Nochmal auf „Training“ tippen führt zurück zur Plan-Übersicht.
    if (t.dataset.tab === 'training' && ui.tab === 'training') ui.plan = null;
    ui.tab = t.dataset.tab;
    render();
    window.scrollTo(0, 0);
    return;
  }
  const { id } = t.dataset;
  switch (t.dataset.action) {
    case 'open-plan': ui.plan = id; ui.picked.clear(); render(); window.scrollTo(0, 0); break;
    case 'back': ui.plan = null; ui.picked.clear(); render(); window.scrollTo(0, 0); break;
    case 'template': createFromTemplate(Number(id)); break;
    case 'new-plan': openSheet(planSheet()); break;
    case 'edit-plan': openSheet(planSheet(id)); break;
    case 'pick': ui.picked.has(id) ? ui.picked.delete(id) : ui.picked.add(id); render(); break;
    case 'add-picked': addPicked(); break;
    case 'new-exercise': openSheet(exerciseSheet()); break;
    case 'edit-exercise': openSheet(exerciseSheet(id)); break;
    case 'log': openSheet(logSheet(id)); break;
    case 'edit-log': openSheet(logSheet(t.dataset.ex, t.dataset.date)); break;
    case 'detail': openSheet(detailSheet(id)); break;
    case 'settings': openSheet(settingsSheet()); break;
    case 'close': closeSheet(); break;
    case 'month': ui.month = shiftMonth(ui.month, Number(t.dataset.d)); render(); break;
    case 'goto-day': gotoDay(t.dataset.date); break;
  }
});

// Tipp auf den dunklen Hintergrund schließt alle Sheets.
$('#sheet').addEventListener('click', ev => { if (ev.target === ev.currentTarget) closeAll(); });
$('#sheet').addEventListener('cancel', ev => { ev.preventDefault(); closeSheet(); });

// Wenn die App am nächsten Tag wieder geöffnet wird, „heute“ aktualisieren.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !stack.length) render();
});

renderChrome();
render();

if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) {
  navigator.serviceWorker.register('sw.js');
}
