/* Studio Books — business app for a piercing & tattoo studio.
 *
 * Everything is stored on this phone in IndexedDB (database "studio-books").
 * Money is always stored as whole cents (integers) so totals never drift.
 * Dates are stored as local "YYYY-MM-DD" strings.
 *
 * Sections:  utilities · storage · business math · imports · receipts ·
 *            backup · views · actions · startup
 */
'use strict';
(function () {

/* =====================================================================
 * Constants
 * ===================================================================== */
const APP = 'studio-books';
const VERSION = '1.0.0';
const DB_NAME = 'studio-books';
const DB_VER = 1;
const LIST_STORES = ['sales', 'income', 'expenses', 'stock', 'trips', 'taxPayments'];
const ALL_STORES = [...LIST_STORES, 'receipts', 'kv'];

const EXPENSE_CATS = [
  { id: 'rent', label: 'Studio rent', line: '20b', lineLabel: 'Rent on business property' },
  { id: 'inventory', label: 'Jewelry & aftercare stock', line: 'COGS', lineLabel: 'Purchases (cost of goods sold)' },
  { id: 'supplies', label: 'Studio supplies', line: '22', lineLabel: 'Supplies' },
  { id: 'equipment', label: 'Equipment & tools', line: '13', lineLabel: 'Equipment (depreciation or Section 179)' },
  { id: 'marketing', label: 'Marketing & ads', line: '8', lineLabel: 'Advertising' },
  { id: 'software', label: 'Software & booking', line: '27a', lineLabel: 'Other expenses' },
  { id: 'fees', label: 'Payment & bank fees', line: '10', lineLabel: 'Commissions and fees' },
  { id: 'insurance', label: 'Insurance', line: '15', lineLabel: 'Insurance' },
  { id: 'licenses', label: 'Licenses & permits', line: '23', lineLabel: 'Taxes and licenses' },
  { id: 'utilities', label: 'Utilities & phone', line: '25', lineLabel: 'Utilities' },
  { id: 'repairs', label: 'Repairs & upkeep', line: '21', lineLabel: 'Repairs and maintenance' },
  { id: 'education', label: 'Training & education', line: '27a', lineLabel: 'Other expenses' },
  { id: 'other', label: 'Other business costs', line: '27a', lineLabel: 'Other expenses' },
  { id: 'personal', label: 'Personal (not business)', line: null },
  { id: 'uncategorized', label: 'Needs a category', line: null },
];
const CAT = Object.fromEntries(EXPENSE_CATS.map(c => [c.id, c]));
const LINE_ORDER = ['8', '9', '10', '13', '15', '20b', '21', '22', '23', '25', '27a'];

const INCOME_LABELS = {
  services: 'Services',
  jewelry: 'Jewelry sales',
  aftercare: 'Aftercare sales',
  products: 'Other product sales',
  tips: 'Tips',
  'apprentice-rent': 'Apprentice rent',
  other: 'Other income',
};
const STOCK_CATS = ['Jewelry', 'Aftercare', 'Supplies'];
const PAY_METHODS = ['Venmo', 'Cash', 'Card', 'Gift card', 'Other'];
const DEFAULT_SERVICES = ['Lobe', 'Nostril', 'Helix', 'Septum', 'Navel', 'Tragus', 'Industrial', 'Tattoo', 'Downsize', 'Jewelry change'];

const KEYWORD_CATS = [
  [/\brent\b|lease|landlord|property mgmt|property management/i, 'rent'],
  [/anatometal|neometal|industrial strength|bvla|junipurr|body ?jewel|jewelry|titanium|implant grade|\b14k\b/i, 'inventory'],
  [/aftercare|saline|neilmed/i, 'inventory'],
  [/glove|needle|steriliz|pouch|barrier|henry schein|medical supply|cartridge|tattoo ink|\bink\b|cotton|alcohol prep/i, 'supplies'],
  [/autoclave|statim|equipment/i, 'equipment'],
  [/facebook|\bmeta\b|instagram|google ads|yelp|vistaprint|tiktok ads|canva|business cards/i, 'marketing'],
  [/adobe|vagaro|squarespace|\bwix\b|godaddy|google workspace|gsuite|icloud|dropbox|subscription|software|calendly|square appointments|glossgenius/i, 'software'],
  [/insur/i, 'insurance'],
  [/license|permit|health dep|county of|city of|state of|licensing/i, 'licenses'],
  [/xcel|energy|electric|water dept|utility|internet|comcast|xfinity|verizon|t-mobile|at&t|spectrum/i, 'utilities'],
  [/\bfee\b|fees|service charge|interest charge/i, 'fees'],
  [/repair|plumb|janitor|cleaning/i, 'repairs'],
  [/course|class|training|seminar|conference|bloodborne|\bapp\b membership|association of professional piercers/i, 'education'],
];

const ICONS = {
  today: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  money: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  stock: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  taxes: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  card: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  jar: '<path d="M8 3h8v3l2 3v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9l2-3z"/><path d="M8 6h8M10 14h4"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.5"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  repeat: '<path d="M4 11a7 7 0 0 1 12.5-4.3L19 9M19 4v5h-5"/><path d="M20 13a7 7 0 0 1-12.5 4.3L5 15M5 20v-5h5"/>',
  receipt: '<path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
};
function icon(name, size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
}

/* =====================================================================
 * Utilities
 * ===================================================================== */
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
const pad = n => String(n).padStart(2, '0');
const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
const clone = o => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

function uid() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* fall through */ }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/* Money: strings like "$1,234.50", "(45.00)", "- $12" → cents */
function toCents(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : 0;
  let s = String(v ?? '').trim();
  if (!s) return 0;
  let neg = false;
  if (/^\(.*\)$/.test(s)) neg = true;
  if (/[-−]/.test(s)) neg = true;
  s = s.replace(/[^0-9.]/g, '');
  if (!s || s === '.') return 0;
  const parts = s.split('.');
  const n = parseFloat(parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : ''));
  if (!Number.isFinite(n)) return 0;
  const c = Math.round(n * 100);
  return neg ? -c : c;
}
function money(c) {
  c = Math.round(c || 0);
  const a = Math.abs(c);
  return (c < 0 ? '−' : '') + '$' + Math.floor(a / 100).toLocaleString('en-US') + '.' + pad(a % 100);
}
function money0(c) {
  const d = Math.round((c || 0) / 100);
  return (d < 0 ? '−' : '') + '$' + Math.abs(d).toLocaleString('en-US');
}
const centsToInput = c => (c ? (c / 100).toFixed(2) : '');

/* Dates */
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
function parseISO(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
const monthKey = s => String(s).slice(0, 7);
function daysInMonth(mk) { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); }
function addMonths(mk, n) { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function monthRange(mk) { return [mk + '-01', mk + '-' + pad(daysInMonth(mk))]; }
function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 864e5); }
function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return isoDate(d); }
const fmtDate = s => parseISO(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fmtDateYear = s => parseISO(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtDateLong = s => parseISO(s).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
function fmtMonth(mk) { const [y, m] = mk.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
function monthName(mk) { const [y, m] = mk.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' }); }
function isValidISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(parseISO(s).getTime()); }

function parseAnyDate(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    let y = +m[3]; if (y < 100) y += 2000;
    const mo = +m[1], d = +m[2];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad(mo)}-${pad(d)}`;
  }
  return null;
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function plural(n, one, many) { return `${n} ${n === 1 ? one : (many || one + 's')}`; }
function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function vendorKey(s) {
  return String(s || '').toLowerCase()
    .replace(/(pos|debit card|card purchase|purchase|recurring|payment to|ach|withdrawal|online|pmt)\b/g, ' ')
    .replace(/[^a-z& ]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
    .split(' ').filter(Boolean).slice(0, 3).join(' ');
}
function guessCategory(text) {
  const key = vendorKey(text);
  if (key && S.rules[key]) return S.rules[key];
  for (const [re, cat] of KEYWORD_CATS) if (re.test(text || '')) return cat;
  return null;
}
function initials(name) {
  const w = String(name || '').replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean);
  return ((w[0] || 'S')[0] + (w[1] || 'B')[0]).toUpperCase();
}
function withTimeout(p, ms, msg) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error(msg || 'Timed out')), ms);
    p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); });
  });
}

/* =====================================================================
 * State & storage (IndexedDB, with an in-memory fallback)
 * ===================================================================== */
const S = { sales: [], income: [], expenses: [], stock: [], trips: [], taxPayments: [], settings: null, rules: {}, meta: {} };
let idb = null;
let memoryOnly = false;
const memReceipts = new Map();
let persistAsked = false;

function defaultSettings() {
  return {
    businessName: 'Sydney Whetman Piercing & Tattoos',
    ownerName: 'Sydney',
    services: DEFAULT_SERVICES.map(name => ({ id: uid(), name, price: 0 })),
    apprentice: { enabled: false, name: '', rent: 0, dueDay: 1 },
    recurring: [],
    budgets: {},
    taxPct: 25,
    mileageRate: 72.5, // cents per mile, IRS business rate for 2026
    salesTax: { enabled: false, rate: 0 },
    beginInventory: {},
    lock: { enabled: false, credId: null },
    lastMethod: 'Venmo',
  };
}
function withDefaults(s) {
  const d = defaultSettings();
  if (!s) return null;
  const out = Object.assign({}, d, s);
  out.apprentice = Object.assign({}, d.apprentice, s.apprentice || {});
  out.salesTax = Object.assign({}, d.salesTax, s.salesTax || {});
  out.lock = Object.assign({}, d.lock, s.lock || {});
  out.budgets = s.budgets || {};
  out.beginInventory = s.beginInventory || {};
  out.recurring = Array.isArray(s.recurring) ? s.recurring : [];
  out.services = Array.isArray(s.services) ? s.services : d.services;
  return out;
}

function openDB() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ALL_STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'kv' ? 'key' : 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Storage is blocked by another open copy of the app'));
  });
}
const reqP = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const txDone = t => new Promise((res, rej) => {
  t.oncomplete = () => res();
  t.onerror = () => rej(t.error);
  t.onabort = () => rej(t.error || new Error('The save was interrupted'));
});
async function dbGetAll(store) {
  if (!idb) return [];
  return reqP(idb.transaction(store, 'readonly').objectStore(store).getAll());
}

/* Every change goes through commit(): one IndexedDB transaction for all the
 * records involved (a sale plus its stock changes, say), and memory is only
 * updated once the phone confirms the write. */
async function commit(ops) {
  if (!ops.length) return;
  if (idb) {
    try {
      const stores = [...new Set(ops.map(o => o.store))];
      const t = idb.transaction(stores, 'readwrite');
      for (const o of ops) {
        const st = t.objectStore(o.store);
        if (o.del !== undefined) st.delete(o.del); else st.put(o.put);
      }
      await txDone(t);
    } catch (e) {
      console.error(e);
      const full = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''));
      toast(full ? "Couldn't save: the phone is out of storage space." : "Couldn't save that. Please try again.", 'error');
      e._toasted = true;
      throw e;
    }
  }
  for (const o of ops) {
    if (o.store === 'kv') { if (o.put) applyKV(o.put); continue; }
    if (o.store === 'receipts') {
      if (!idb) { if (o.del !== undefined) memReceipts.delete(o.del); else memReceipts.set(o.put.id, o.put); }
      continue;
    }
    const arr = S[o.store];
    const id = o.del !== undefined ? o.del : o.put.id;
    const i = arr.findIndex(x => x.id === id);
    if (o.del !== undefined) { if (i >= 0) arr.splice(i, 1); }
    else if (i >= 0) arr[i] = o.put; else arr.push(o.put);
  }
  if (!persistAsked) requestPersist();
}
function applyKV(kv) {
  if (kv.key === 'settings') S.settings = withDefaults(kv.value);
  else if (kv.key === 'rules') S.rules = kv.value || {};
  else if (kv.key === 'meta') S.meta = kv.value || {};
}
const kvPut = (key, value) => ({ store: 'kv', put: { key, value } });

async function requestPersist() {
  persistAsked = true;
  try {
    if (navigator.storage && navigator.storage.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch (e) { /* not supported */ }
}

async function loadAll() {
  if (!idb && !memoryOnly) {
    try { idb = await withTimeout(openDB(), 8000, 'Storage did not open'); }
    catch (e) { console.warn('IndexedDB unavailable, using memory only', e); idb = null; memoryOnly = true; }
  }
  for (const s of LIST_STORES) S[s] = [];
  S.settings = null; S.rules = {}; S.meta = {};
  if (idb) {
    for (const s of LIST_STORES) S[s] = await dbGetAll(s);
    (await dbGetAll('kv')).forEach(applyKV);
  }
}
async function getReceipt(id) {
  if (!id) return null;
  if (!idb) return memReceipts.get(id) || null;
  return reqP(idb.transaction('receipts', 'readonly').objectStore('receipts').get(id));
}
async function wipeAll() {
  if (idb) {
    const t = idb.transaction(ALL_STORES, 'readwrite');
    for (const s of ALL_STORES) t.objectStore(s).clear();
    await txDone(t);
  }
  memReceipts.clear();
  await loadAll();
}

/* =====================================================================
 * Business math
 * ===================================================================== */
function itemIncomeKey(cat) { return cat === 'Jewelry' ? 'jewelry' : cat === 'Aftercare' ? 'aftercare' : 'products'; }
function saleTotals(s) {
  let services = 0, products = 0, cost = 0;
  const byCat = {};
  for (const l of s.lines || []) {
    const q = l.qty || 1;
    const amt = (l.price || 0) * q;
    if (l.kind === 'item') {
      products += amt; cost += (l.cost || 0) * q;
      const k = itemIncomeKey(l.cat);
      byCat[k] = (byCat[k] || 0) + amt;
    } else {
      services += amt;
      byCat.services = (byCat.services || 0) + amt;
    }
  }
  const tip = s.tip || 0, tax = s.salesTax || 0;
  if (tip) byCat.tips = tip;
  return { services, products, tip, tax, cost, byCat, income: services + products + tip, total: services + products + tip + tax };
}
function saleLabel(s) {
  const names = (s.lines || []).map(l => (l.kind === 'item' && (l.qty || 1) > 1 ? `${l.name} ×${l.qty}` : l.name));
  if (!names.length) return s.tip ? 'Tip' : 'Sale';
  return names.length > 2 ? `${names[0]} + ${names.length - 1} more` : names.join(' + ');
}
function computeSalesTax(lines) {
  const st = S.settings.salesTax;
  if (!st.enabled || !st.rate) return 0;
  const products = sum(lines.filter(l => l.kind === 'item'), l => (l.price || 0) * (l.qty || 1));
  return Math.round(products * st.rate / 100);
}
const inRange = (d, from, to) => d >= from && d <= to;

function periodSummary(from, to) {
  const incomeByCat = {}, expByCat = {};
  let moneyIn = 0, moneyOut = 0, salesTax = 0, cogsSold = 0, personal = 0;
  for (const s of S.sales) {
    if (!inRange(s.date, from, to)) continue;
    const t = saleTotals(s);
    for (const [k, v] of Object.entries(t.byCat)) incomeByCat[k] = (incomeByCat[k] || 0) + v;
    moneyIn += t.income; salesTax += t.tax; cogsSold += t.cost;
  }
  for (const i of S.income) {
    if (!inRange(i.date, from, to)) continue;
    incomeByCat[i.category] = (incomeByCat[i.category] || 0) + i.amount;
    moneyIn += i.amount;
  }
  for (const e of S.expenses) {
    if (!inRange(e.date, from, to)) continue;
    if (e.category === 'personal') { personal += e.amount; continue; }
    expByCat[e.category] = (expByCat[e.category] || 0) + e.amount;
    moneyOut += e.amount;
  }
  return { incomeByCat, expByCat, moneyIn, moneyOut, profit: moneyIn - moneyOut, salesTax, cogsSold, personal };
}
function weekBuckets(mk) {
  const dim = daysInMonth(mk);
  const ranges = [[1, 7], [8, 14], [15, 21], [22, 28]];
  if (dim > 28) ranges.push([29, dim]);
  return ranges.map(([a, b]) => {
    const p = periodSummary(`${mk}-${pad(a)}`, `${mk}-${pad(b)}`);
    return { label: a === b ? `${a}` : `${a}–${b}`, in: p.moneyIn, out: p.moneyOut };
  });
}
function stockValue() { return sum(S.stock, i => Math.max(0, i.qty || 0) * (i.cost || 0)); }
function soldLast30() {
  const from = addDays(today(), -30);
  const m = {};
  for (const s of S.sales) {
    if (s.date < from) continue;
    for (const l of s.lines || []) if (l.kind === 'item' && l.stockId) m[l.stockId] = (m[l.stockId] || 0) + (l.qty || 1);
  }
  return m;
}
function stockStatus(item, sold) {
  const s30 = sold[item.id] || 0;
  const perDay = s30 / 30;
  const daysLeft = perDay > 0 ? Math.floor(Math.max(0, item.qty || 0) / perDay) : null;
  const low = (item.qty || 0) <= (item.lowAt || 0) || (daysLeft !== null && daysLeft <= 14);
  return { s30, daysLeft, low };
}
function lowStock(sold) { sold = sold || soldLast30(); return S.stock.filter(i => stockStatus(i, sold).low); }
function hasReceipt(e) { return !!(e.receiptId || e.receiptDemo); }
function needsReceipt(e) { return !hasReceipt(e) && !['personal', 'fees'].includes(e.category) && e.source !== 'recurring'; }
function reviewItems() {
  return {
    sales: S.sales.filter(s => s.needsReview),
    uncat: S.expenses.filter(e => e.category === 'uncategorized' || e.needsReview),
  };
}

function shiftWeekend(iso) {
  const d = parseISO(iso);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return isoDate(d);
}
function dueDates(y) {
  y = +y;
  return [[1, `${y}-04-15`], [2, `${y}-06-15`], [3, `${y}-09-15`], [4, `${y + 1}-01-15`]].map(([q, d]) => ({ q, date: shiftWeekend(d) }));
}
function taxSummary(y) {
  y = String(y);
  const p = periodSummary(`${y}-01-01`, `${y}-12-31`);
  const gross = p.moneyIn;
  const purchases = p.expByCat.inventory || 0;
  const beginInv = S.settings.beginInventory[y] || 0;
  const endInv = stockValue();
  const cogs = Math.max(0, beginInv + purchases - endInv);
  const lines = {};
  for (const c of EXPENSE_CATS) {
    if (!c.line || c.line === 'COGS') continue;
    const a = p.expByCat[c.id] || 0;
    if (!a) continue;
    lines[c.line] = lines[c.line] || { line: c.line, label: c.lineLabel, amount: 0 };
    lines[c.line].amount += a;
  }
  const miles = sum(S.trips.filter(t => String(t.date).startsWith(y)), t => t.miles || 0);
  const car = Math.round(miles * (S.settings.mileageRate || 0));
  if (car) lines['9'] = { line: '9', label: 'Car and truck (standard mileage)', amount: car };
  const lineList = LINE_ORDER.filter(k => lines[k]).map(k => lines[k]);
  const expenses = sum(lineList, l => l.amount);
  const profit = gross - cogs - expenses;
  const setAside = Math.round(Math.max(0, profit) * (S.settings.taxPct || 0) / 100);
  const paid = sum(S.taxPayments.filter(t => t.year === y), t => t.amount);
  const seTax = Math.round(Math.max(0, profit) * 0.9235 * 0.153);
  return {
    y, p, gross, purchases, beginInv, endInv, cogs, lineList, expenses, miles, car, profit,
    setAside, paid, seTax, salesTax: p.salesTax, uncategorized: p.expByCat.uncategorized || 0,
  };
}
function nextDue(y) {
  const now = today();
  const pays = S.taxPayments.filter(t => t.year === String(y));
  return dueDates(y).find(d => d.date >= now && !pays.some(p => p.quarter === d.q)) || null;
}
function apprenticeStatus(mk) {
  const a = S.settings.apprentice;
  if (!a.enabled || !a.rent) return null;
  const [from, to] = monthRange(mk);
  const received = sum(S.income.filter(i => i.category === 'apprentice-rent' && inRange(i.date, from, to)), i => i.amount);
  const due = `${mk}-${pad(Math.min(a.dueDay || 1, daysInMonth(mk)))}`;
  const state = received >= a.rent ? 'paid' : today() > due ? 'late' : 'due';
  return { name: a.name, rent: a.rent, received, due, state };
}
function allTxns(from, to) {
  const out = [];
  for (const s of S.sales) {
    if (!inRange(s.date, from, to)) continue;
    const t = saleTotals(s);
    out.push({ kind: 'sale', id: s.id, date: s.date, created: s.created || 0, label: saleLabel(s), sub: [s.client, s.method].filter(Boolean).join(' · '), amount: t.income, flag: !!s.needsReview });
  }
  for (const i of S.income) {
    if (!inRange(i.date, from, to)) continue;
    out.push({ kind: 'income', id: i.id, date: i.date, created: i.created || 0, label: INCOME_LABELS[i.category] || 'Income', sub: [i.note, i.method].filter(Boolean).join(' · '), amount: i.amount });
  }
  for (const e of S.expenses) {
    if (!inRange(e.date, from, to)) continue;
    const c = CAT[e.category] || CAT.other;
    out.push({ kind: 'expense', id: e.id, date: e.date, created: e.created || 0, label: e.vendor || c.label, sub: c.label, amount: -e.amount, flag: e.category === 'uncategorized' || !!e.needsReview, excluded: e.category === 'personal' });
  }
  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.created || 0) - (a.created || 0)));
  return out;
}

/* Repeating expenses (rent, subscriptions): filled in each time the app opens */
async function runRecurring() {
  const recs = S.settings.recurring || [];
  if (!recs.length) return;
  const meta = clone(S.meta);
  meta.recurringRun = meta.recurringRun || {};
  const now = today(), cur = monthKey(now);
  const ops = [];
  let added = 0;
  for (const r of recs) {
    if (!r.amount || !r.name) continue;
    let m = meta.recurringRun[r.id] ? addMonths(meta.recurringRun[r.id], 1) : (r.startMonth || cur);
    let guard = 0;
    while (m <= cur && guard++ < 36) {
      const date = `${m}-${pad(Math.min(r.day || 1, daysInMonth(m)))}`;
      if (date > now) break;
      ops.push({ store: 'expenses', put: { id: uid(), date, vendor: r.name, amount: r.amount, category: r.category || 'other', note: 'Added automatically each month', source: 'recurring', recurringId: r.id, created: Date.now() } });
      meta.recurringRun[r.id] = m;
      added++;
      m = addMonths(m, 1);
    }
  }
  if (!ops.length) return;
  ops.push(kvPut('meta', meta));
  try {
    await commit(ops);
    toast(`Added ${plural(added, 'repeating expense')}`);
  } catch (e) { /* toast already shown */ }
}

/* =====================================================================
 * CSV imports (Venmo statements, bank exports)
 * ===================================================================== */
function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
      continue;
    }
    if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}
function findSaleMatch(amount, date, used) {
  return S.sales.find(s => !s.extId && !used.has(s.id) && s.method === 'Venmo' &&
    Math.abs(daysBetween(s.date, date)) <= 1 && saleTotals(s).total === amount) || null;
}
function looksLogged(amount, date) {
  return S.expenses.find(e => e.amount === amount && Math.abs(daysBetween(e.date, date)) <= 3) || null;
}
function apprenticeMatch(who) {
  const a = S.settings.apprentice;
  if (!a.enabled || !a.name) return false;
  const first = a.name.trim().split(/\s+/)[0].toLowerCase();
  return first.length > 1 && String(who).toLowerCase().split(/\s+/).includes(first);
}

function buildImport(text) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error('That file is empty.');
  const isVenmo = rows.some(r => r.some(c => c.trim() === 'Datetime') && r.some(c => c.trim() === 'Amount (total)'));
  const seen = S.meta.seenExt || {};
  const skipped = S.meta.skippedExt || {};
  const out = isVenmo ? parseVenmo(rows) : parseBank(rows);
  const fresh = out.filter(r => !seen[r.extId]);
  for (const r of fresh) {
    if (skipped[r.extId]) { r.on = false; r.hint = 'You skipped this last time'; }
  }
  return { source: isVenmo ? 'venmo' : 'bank', rows: fresh, already: out.length - fresh.length };
}

function parseVenmo(rows) {
  const h = rows.findIndex(r => r.some(c => c.trim() === 'Datetime') && r.some(c => c.trim() === 'Amount (total)'));
  const head = rows[h].map(c => c.trim());
  const col = n => head.indexOf(n);
  const ci = { id: col('ID'), date: col('Datetime'), type: col('Type'), status: col('Status'), note: col('Note'), from: col('From'), to: col('To'), amt: col('Amount (total)'), fee: col('Amount (fee)') };
  const used = new Set();
  const out = [];
  for (const r of rows.slice(h + 1)) {
    const id = (r[ci.id] || '').trim();
    if (!id) continue;
    const status = (r[ci.status] || '').trim();
    if (status && !/complete|issued/i.test(status)) continue;
    const type = (r[ci.type] || '').trim();
    if (/transfer/i.test(type)) continue; // moving money to the bank is not income or spending
    const amount = toCents(r[ci.amt]);
    const date = parseAnyDate(r[ci.date]);
    if (!amount || !date) continue;
    const fee = ci.fee >= 0 ? Math.abs(toCents(r[ci.fee])) : 0;
    const dir = amount > 0 ? 'in' : 'out';
    const who = ((dir === 'in' ? r[ci.from] : r[ci.to]) || '').trim();
    const note = (r[ci.note] || '').trim();
    const row = { extId: 'venmo:' + id, date, amount: Math.abs(amount), dir, who, note, fee, on: true, as: 'sale', hint: '' };
    if (dir === 'in') {
      if (apprenticeMatch(who)) { row.as = 'apprentice-rent'; row.hint = 'Looks like apprentice rent'; }
      else {
        const m = findSaleMatch(Math.abs(amount), date, used);
        if (m) { used.add(m.id); row.as = 'match:' + m.id; row.hint = `Matches your ${fmtDate(m.date)} sale, so it won't be counted twice`; }
        else row.hint = 'Adds a sale you can fill in later';
      }
    } else {
      const g = guessCategory(who + ' ' + note);
      row.as = g || 'uncategorized';
      row.on = !!g;
      row.hint = g ? '' : 'Turn on if this was for the studio';
    }
    out.push(row);
  }
  return out;
}

function parseBank(rows) {
  const isHead = r => r.some(c => /date/i.test(c)) && r.some(c => /amount|debit|credit|withdraw|deposit/i.test(c));
  const h = rows.findIndex(isHead);
  if (h < 0) throw new Error("Couldn't find the date and amount columns. Is this a Venmo or bank CSV file?");
  const head = rows[h].map(c => c.trim().toLowerCase());
  const find = (...res) => { for (const re of res) { const i = head.findIndex(c => re.test(c)); if (i >= 0) return i; } return -1; };
  const cDate = find(/^posting date$/, /^transaction date$/, /^date$/, /date/);
  const cDesc = find(/^description$/, /description/, /payee|merchant|name/, /memo|details/);
  const cAmt = find(/^amount$/, /^amount/);
  const cDebit = find(/debit|withdraw/);
  const cCredit = find(/credit|deposit/);
  const cType = find(/^type$|transaction type|^details$/);
  const cMemo = find(/memo/);
  if (cDate < 0 || (cAmt < 0 && cDebit < 0 && cCredit < 0)) throw new Error("Couldn't find the date and amount columns in that file.");
  const out = [];
  const count = {};
  for (const r of rows.slice(h + 1)) {
    const date = parseAnyDate(r[cDate]);
    if (!date) continue;
    let amt;
    if (cAmt >= 0) {
      amt = toCents(r[cAmt]);
      if (cType >= 0 && /debit|withdraw/i.test(r[cType] || '') && amt > 0) amt = -amt;
    } else {
      amt = Math.abs(toCents(r[cCredit] || '')) - Math.abs(toCents(r[cDebit] || ''));
    }
    if (!amt) continue;
    const desc = ((r[cDesc] || '') + (cMemo >= 0 && cMemo !== cDesc && r[cMemo] ? ' ' + r[cMemo] : '')).replace(/\s+/g, ' ').trim();
    const base = `${date}|${desc}|${amt}`;
    count[base] = (count[base] || 0) + 1;
    const dir = amt > 0 ? 'in' : 'out';
    const row = { extId: 'bank:' + hashStr(base + '|' + count[base]), date, amount: Math.abs(amt), dir, who: tidyVendor(desc), note: desc, fee: 0, on: true, as: 'uncategorized', hint: '' };
    if (dir === 'in') {
      row.on = false; row.as = 'other';
      row.hint = /venmo/i.test(desc) ? 'Venmo cash-out. Import your Venmo statement instead' : 'Deposits are usually Venmo cash-outs or cash you already logged';
    } else if (/venmo|transfer|credit card|card payment|autopay|thank you/i.test(desc)) {
      row.on = false; row.hint = 'Looks like a transfer or card payment';
    } else {
      const dup = looksLogged(row.amount, date);
      const g = guessCategory(row.who) || guessCategory(desc);
      row.as = g || 'uncategorized';
      if (dup) { row.on = false; row.hint = `Looks already logged (${dup.vendor || 'expense'}, ${fmtDate(dup.date)})`; }
      else if (!g) row.hint = 'Pick a category, or leave it to sort out later';
    }
    out.push(row);
  }
  return out;
}
function tidyVendor(desc) {
  const s = String(desc || '')
    .replace(/\b(pos|debit card|card purchase|purchase|recurring|ach|withdrawal|online|pmt|web|id:?)\b/gi, ' ')
    .replace(/#?\d{3,}/g, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}\b/g, ' ')
    .replace(/\s*-\s*(-\s*)+/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-*]+|[\s\-*]+$/g, '')
    .replace(/\s-\s[A-Z]{2}$/, '')
    .trim();
  const out = s.slice(0, 48) || String(desc || '');
  // Banks shout in capitals; make it easier to read.
  return out === out.toUpperCase() ? out.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : out;
}

/* =====================================================================
 * Receipts: compress photos, read them on the phone (no upload)
 * ===================================================================== */
function loadImage(url) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = () => rej(new Error('Image could not be opened')); img.src = url; });
}
async function compressImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const max = 1600;
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * sc);
    c.height = Math.round(img.naturalHeight * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.72));
    return blob || file;
  } catch (e) {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
let tessLoading = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (tessLoading) return tessLoading;
  tessLoading = new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = new URL('vendor/tesseract/tesseract.min.js', location.href).href;
    sc.onload = () => (window.Tesseract ? res(window.Tesseract) : rej(new Error('Reader did not load')));
    sc.onerror = () => { tessLoading = null; rej(new Error('Reader did not load')); };
    document.head.appendChild(sc);
  });
  return tessLoading;
}
async function readReceiptText(blob) {
  const T = await withTimeout(loadTesseract(), 20000, 'Reader did not load');
  const base = location.href.replace(/[#?].*$/, '');
  const worker = await withTimeout(T.createWorker('eng', 1, {
    workerPath: new URL('vendor/tesseract/worker.min.js', base).href,
    corePath: new URL('vendor/tesseract/', base).href,
    langPath: new URL('vendor/lang', base).href,
    workerBlobURL: false,
    gzip: true,
  }), 45000, 'Reader took too long to start');
  try {
    const { data } = await withTimeout(worker.recognize(blob), 60000, 'Reading took too long');
    return data.text || '';
  } finally {
    try { await worker.terminate(); } catch (e) { /* ignore */ }
  }
}
function parseReceipt(text) {
  const lines = String(text).split(/\n/).map(l => l.trim()).filter(Boolean);
  const amtRe = /\$?\s?(\d{1,3}(?:,\d{3})+|\d+)[.,](\d{2})(?!\d)/g;
  const amounts = l => [...l.matchAll(amtRe)].map(m => toCents(m[1].replace(/,/g, '') + '.' + m[2]));
  let total = null;
  for (const l of lines) {
    if (/total|amount due|balance due|grand|amount paid|charged/i.test(l) && !/sub\s?-?total|total\s*tax|tax\s*total|savings|discount|items?\s*total/i.test(l)) {
      const a = amounts(l);
      if (a.length) total = a[a.length - 1];
    }
  }
  if (total === null) {
    const all = lines.flatMap(amounts).filter(a => a > 0 && a < 5000000);
    if (all.length) total = Math.max(...all);
  }
  let date = null;
  for (const l of lines) {
    const m = l.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(\d{4}-\d{2}-\d{2})/);
    if (m) { date = parseAnyDate(m[0]); if (date) break; }
    const m2 = l.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/i);
    if (m2) {
      const mo = 'janfebmaraprmayjunjulaugsepoctnovdec'.indexOf(m2[1].toLowerCase().slice(0, 3)) / 3 + 1;
      date = `${m2[3]}-${pad(mo)}-${pad(+m2[2])}`; break;
    }
  }
  if (date && (date > today() || date < '2000-01-01')) date = null;
  let vendor = '';
  for (const l of lines.slice(0, 6)) {
    const letters = (l.match(/[A-Za-z]/g) || []).length;
    if (letters >= 3 && letters / l.length > 0.5 && !/receipt|invoice|welcome|thank/i.test(l)) { vendor = l.replace(/[^A-Za-z0-9&'.,\- ]/g, '').trim().slice(0, 40); break; }
  }
  return { total, date, vendor };
}

/* =====================================================================
 * Files out: backups and tax exports
 * ===================================================================== */
const isTouch = () => matchMedia('(pointer: coarse)').matches;
async function claudeCap(name) {
  try { if (window.claude && typeof window.claude.use === 'function') return await withTimeout(window.claude.use(name), 11000, 'no viewer'); } catch (e) { /* none */ }
  return null;
}
async function saveFile(name, data, mime) {
  const dl = await claudeCap('downloads');
  if (dl) {
    try { await dl.save({ filename: name, data }); return true; }
    catch (e) { if (e && e.code === 'declined') return false; toast("Couldn't save the file here."); return false; }
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  try {
    const file = new File([blob], name, { type: mime });
    if (isTouch() && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return true;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return true;
}
function blobToB64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
function b64ToBlob(b64, type) {
  const bin = atob(b64 || '');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: type || 'application/octet-stream' });
}
async function exportBackup() {
  const receipts = [];
  const all = idb ? await dbGetAll('receipts') : [...memReceipts.values()];
  for (const r of all) receipts.push({ id: r.id, type: r.type, name: r.name, created: r.created, data: await blobToB64(r.blob) });
  const data = {};
  for (const s of LIST_STORES) data[s] = S[s];
  data.settings = S.settings; data.rules = S.rules; data.meta = S.meta;
  const payload = { app: APP, format: 1, exportedAt: new Date().toISOString(), data, receipts };
  const ok = await saveFile(`studio-books-backup-${today()}.json`, JSON.stringify(payload), 'application/json');
  if (!ok) return;
  const meta = clone(S.meta); meta.lastBackup = new Date().toISOString();
  await commit([kvPut('meta', meta)]);
  toast('Backup saved');
  render();
}
async function restoreBackup(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch (e) { toast("That file isn't a Studio Books backup."); return; }
  if (!obj || obj.app !== APP || !obj.data || !Array.isArray(obj.data.sales)) { toast("That file isn't a Studio Books backup."); return; }
  const when = obj.exportedAt ? fmtDateYear(obj.exportedAt.slice(0, 10)) : 'an unknown date';
  const ok = await confirmSheet({
    title: 'Restore this backup?',
    body: `It was made on ${esc(when)}. Everything in the app on this phone right now will be replaced by it.`,
    ok: 'Restore', danger: true,
  });
  if (!ok) return;
  const receipts = (obj.receipts || []).map(r => ({ id: r.id, type: r.type, name: r.name, created: r.created, blob: b64ToBlob(r.data, r.type) }));
  if (idb) {
    const t = idb.transaction(ALL_STORES, 'readwrite');
    for (const s of ALL_STORES) t.objectStore(s).clear();
    for (const s of LIST_STORES) for (const rec of (obj.data[s] || [])) if (rec && rec.id) t.objectStore(s).put(rec);
    t.objectStore('kv').put({ key: 'settings', value: obj.data.settings || defaultSettings() });
    t.objectStore('kv').put({ key: 'rules', value: obj.data.rules || {} });
    t.objectStore('kv').put({ key: 'meta', value: obj.data.meta || {} });
    for (const r of receipts) t.objectStore('receipts').put(r);
    try { await txDone(t); } catch (e) { toast("Couldn't restore that backup. Nothing was changed.", 'error'); return; }
    await loadAll();
  } else {
    for (const s of LIST_STORES) S[s] = (obj.data[s] || []).filter(r => r && r.id);
    S.settings = withDefaults(obj.data.settings || defaultSettings()); S.rules = obj.data.rules || {}; S.meta = obj.data.meta || {};
    memReceipts.clear(); receipts.forEach(r => memReceipts.set(r.id, r));
  }
  resetDraft();
  toast('Backup restored');
  go('today', { replace: true });
}
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const csvLine = arr => arr.map(csvCell).join(',');
const dollars = c => (Math.round(c || 0) / 100).toFixed(2);
async function exportTransactions(y) {
  const rows = [csvLine(['Date', 'Type', 'Category', 'Schedule C line', 'Description', 'Amount', 'Sales tax', 'Paid with', 'Receipt', 'Note'])];
  const from = `${y}-01-01`, to = `${y}-12-31`;
  const items = [];
  for (const s of S.sales) if (inRange(s.date, from, to)) {
    const t = saleTotals(s);
    items.push([s.date, 'Income', 'Sale', '1', saleLabel(s) + (s.client ? ` (${s.client})` : ''), dollars(t.income), dollars(t.tax), s.method || '', '', s.note || '']);
  }
  for (const i of S.income) if (inRange(i.date, from, to)) {
    items.push([i.date, 'Income', INCOME_LABELS[i.category] || 'Other income', '1', i.note || '', dollars(i.amount), '', i.method || '', '', '']);
  }
  for (const e of S.expenses) if (inRange(e.date, from, to)) {
    const c = CAT[e.category] || CAT.other;
    items.push([e.date, e.category === 'personal' ? 'Personal' : 'Expense', c.label, c.line || '', e.vendor || '', dollars(-e.amount), '', '', hasReceipt(e) ? 'Yes' : 'No', e.note || '']);
  }
  for (const t of S.trips) if (inRange(t.date, from, to)) {
    items.push([t.date, 'Mileage', 'Business driving', '9', `${t.miles} miles: ${t.purpose || ''}`, '', '', '', '', '']);
  }
  items.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const it of items) rows.push(csvLine(it));
  await saveFile(`studio-books-${y}-transactions.csv`, rows.join('\r\n'), 'text/csv');
}
async function exportSummary(y) {
  const t = taxSummary(y);
  const rows = [csvLine(['Schedule C line', 'What it is', 'Amount'])];
  rows.push(csvLine(['1', 'Gross receipts (sales, tips, apprentice rent, other income)', dollars(t.gross)]));
  rows.push(csvLine(['Part III 35', 'Inventory at start of year', dollars(t.beginInv)]));
  rows.push(csvLine(['Part III 36', 'Purchases of jewelry and aftercare', dollars(t.purchases)]));
  rows.push(csvLine(['Part III 41', 'Inventory on hand now (at cost)', dollars(t.endInv)]));
  rows.push(csvLine(['4', 'Cost of goods sold', dollars(t.cogs)]));
  for (const l of t.lineList) rows.push(csvLine([l.line, l.label, dollars(l.amount)]));
  rows.push(csvLine(['28', 'Total expenses', dollars(t.expenses)]));
  rows.push(csvLine(['31', 'Net profit (estimate)', dollars(t.profit)]));
  rows.push(csvLine(['', '', '']));
  rows.push(csvLine(['', `Business miles driven (${S.settings.mileageRate}¢ per mile)`, String(Math.round(t.miles * 10) / 10)]));
  rows.push(csvLine(['', 'Estimated self-employment tax (Schedule SE)', dollars(t.seTax)]));
  rows.push(csvLine(['', 'Estimated tax payments made', dollars(t.paid)]));
  if (S.settings.salesTax.enabled) rows.push(csvLine(['', 'Sales tax collected (owed to the state, not income)', dollars(t.salesTax)]));
  if (t.uncategorized) rows.push(csvLine(['', 'Expenses still needing a category (not included above)', dollars(t.uncategorized)]));
  await saveFile(`studio-books-${y}-tax-summary.csv`, rows.join('\r\n'), 'text/csv');
}

/* =====================================================================
 * App lock (Face ID / fingerprint through the phone's passkey support)
 * ===================================================================== */
let locked = false;
let hiddenAt = 0;
const rand = n => crypto.getRandomValues(new Uint8Array(n));
const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function lockSupported() {
  try {
    if (window.top !== window.self) return false; // not inside another page
    if (!window.PublicKeyCredential || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) { return false; }
}
async function enableLock() {
  if (!(await lockSupported())) { toast("This phone or browser can't do Face ID or fingerprint here."); return; }
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: rand(32),
        rp: { name: 'Studio Books' },
        user: { id: rand(16), name: 'studio-books', displayName: S.settings.ownerName || 'Studio Books' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000,
        attestation: 'none',
      },
    });
    const s = clone(S.settings);
    s.lock = { enabled: true, credId: toB64(cred.rawId) };
    await commit([kvPut('settings', s)]);
    toast('App lock is on');
  } catch (e) {
    toast('App lock was not turned on.');
  }
  render();
}
async function disableLock() {
  const s = clone(S.settings);
  s.lock = { enabled: false, credId: null };
  await commit([kvPut('settings', s)]);
  toast('App lock is off');
  render();
}
async function tryUnlock(silent) {
  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        allowCredentials: [{ type: 'public-key', id: fromB64(S.settings.lock.credId) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    locked = false;
    render();
  } catch (e) {
    if (!silent) toast("That didn't unlock. Try again.");
  }
}

/* =====================================================================
 * UI plumbing: router, drafts, toast, sheets
 * ===================================================================== */
const appEl = $('#app');
const sheetRoot = $('#sheet-root');
let route = { name: 'today', params: [] };
let lastRouteKey = '';
const navStack = [];
let historyOK = true;
let hook = {};
const ui = { stockFilter: 'All', scrollTo: null, ocr: null };
let draft = null;
let draftKey = null;

function parseRoute(h) {
  const parts = String(h || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  let params = [];
  try { params = parts.slice(1).map(decodeURIComponent); } catch (e) { params = parts.slice(1); }
  return { name: parts[0] || 'today', params };
}
function go(path, opts = {}) {
  const target = '#/' + String(path).replace(/^[#/]+/, '');
  if (historyOK) {
    try {
      if (opts.replace) history.replaceState(null, '', target); else history.pushState(null, '', target);
    } catch (e) { historyOK = false; }
  }
  if (opts.replace || !historyOK) navStack[Math.max(0, navStack.length - 1)] = target; else navStack.push(target);
  route = parseRoute(target);
  render();
}
function back(fallback) {
  resetDraft();
  if (historyOK && navStack.length > 1) history.back();
  else go(fallback || 'today', { replace: true });
}
window.addEventListener('popstate', () => {
  if (navStack.length > 1) navStack.pop();
  closeSheet();
  route = parseRoute(location.hash);
  render();
});
function resetDraft() { draft = null; draftKey = null; ui.ocr = null; }
function ensureDraft(key, init) {
  if (draftKey !== key) { draft = init(); draftKey = key; ui.ocr = null; }
  return draft;
}
function setBind(obj, path, val) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = /^\d+$/.test(parts[i]) ? +parts[i] : parts[i];
    if (o[k] == null) o[k] = {};
    o = o[k];
  }
  const last = parts[parts.length - 1];
  o[/^\d+$/.test(last) ? +last : last] = val;
}
function getBind(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[/^\d+$/.test(k) ? +k : k]), obj);
}
function readInput(el) {
  if (el.type === 'checkbox') return el.checked;
  const t = el.dataset.type;
  if (t === 'money') return Math.abs(toCents(el.value));
  if (t === 'int') { const n = parseInt(el.value, 10); return Number.isFinite(n) ? n : 0; }
  if (t === 'num') { const n = parseFloat(el.value); return Number.isFinite(n) ? n : 0; }
  return el.value;
}

let toastTimer = null;
function toast(msg, kind) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3400);
}

let sheetResolve = null;
let sheetTyped = null;
function openSheet(html, label) {
  sheetRoot.innerHTML = `<div class="sheet-backdrop" data-act="close-sheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label || 'Dialog')}">${html}</div>`;
  sheetRoot.hidden = false;
  document.body.classList.add('sheet-open');
  const f = sheetRoot.querySelector('[autofocus]') || sheetRoot.querySelector('.sheet button, .sheet input');
  if (f && !isTouch()) f.focus();
}
function closeSheet() {
  if (sheetRoot.hidden) return;
  sheetRoot.hidden = true;
  sheetRoot.innerHTML = '';
  document.body.classList.remove('sheet-open');
  if (sheetResolve) { const r = sheetResolve; sheetResolve = null; r(false); }
}
function confirmSheet({ title, body = '', ok = 'OK', danger = false, typed = null }) {
  return new Promise(res => {
    openSheet(`
      <h2 class="sheet-title">${esc(title)}</h2>
      ${body ? `<p class="sheet-body">${body}</p>` : ''}
      ${typed ? `<label class="field"><span>Type ${esc(typed)} to confirm</span><input id="confirm-typed" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>` : ''}
      <div class="sheet-actions">
        <button type="button" class="btn ghost" data-act="close-sheet">Cancel</button>
        <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-act="confirm-ok">${esc(ok)}</button>
      </div>`, title);
    sheetResolve = res;
    sheetTyped = typed;
  });
}

/* =====================================================================
 * Shared view pieces
 * ===================================================================== */
function navBar(active) {
  const b = (name, label, ic) => `<button type="button" class="nav-btn" data-act="tab" data-to="${name}" ${active === name ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`;
  return `<nav class="navbar" aria-label="Main"><div class="navbar-in">
    ${b('today', 'Today', 'today')}
    ${b('money', 'Money', 'money')}
    <button type="button" class="nav-fab" data-act="go" data-to="sale/new" aria-label="Log a sale">${icon('plus', 28)}</button>
    ${b('stock', 'Stock', 'stock')}
    ${b('taxes', 'Taxes', 'taxes')}
  </div></nav>`;
}
function shell(content, { nav = null, footer = '' } = {}) {
  return `<main class="screen${nav ? ' has-nav' : ''}${footer ? ' has-footer' : ''}">${content}</main>` +
    (footer ? `<div class="footer-bar"><div class="footer-in">${footer}</div></div>` : '') +
    (nav ? navBar(nav) : '');
}
function subHead(title, { backTo = 'today', sub = '', right = '' } = {}) {
  return `<header class="top">
    <button type="button" class="icon-btn" data-act="back" data-to="${esc(backTo)}" aria-label="Back">${icon('back', 20)}</button>
    <div class="top-text"><h1 class="display sm">${esc(title)}</h1>${sub ? `<span class="eyebrow">${sub}</span>` : ''}</div>
    ${right}
  </header>`;
}
function txnRow(t) {
  const pos = t.amount >= 0;
  const cls = t.excluded ? 'amt muted' : pos ? 'amt in' : 'amt';
  return `<button type="button" class="row-btn" data-act="go" data-to="${t.kind}/${encodeURIComponent(t.id)}">
    <span class="row-main"><span class="row-title">${esc(t.label)}</span><span class="row-sub">${esc(fmtDate(t.date))}${t.sub ? ' · ' + esc(t.sub) : ''}</span></span>
    ${t.flag ? '<span class="pill warn">Check</span>' : ''}
    <span class="${cls}">${pos ? '+' : ''}${money(t.amount)}</span>
  </button>`;
}
function moneyField(label, bind, value, { big = false, id = '', autofocus = false } = {}) {
  const fid = id || 'f-' + bind.replace(/\./g, '-');
  return `<label class="field${big ? ' big' : ''}" for="${fid}"><span>${esc(label)}</span>
    <div class="money-in"><input id="${fid}" inputmode="decimal" autocomplete="off" data-bind="${bind}" data-type="money" value="${esc(centsToInput(value))}" placeholder="0.00"${autofocus ? ' autofocus' : ''}></div></label>`;
}
function textField(label, bind, value, { placeholder = '', type = 'text', id = '', extra = '' } = {}) {
  const fid = id || 'f-' + bind.replace(/\./g, '-');
  return `<label class="field" for="${fid}"><span>${esc(label)}</span><input id="${fid}" type="${type}" data-bind="${bind}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" ${extra}></label>`;
}
function catOptions(selected, { includeUncat = true } = {}) {
  return EXPENSE_CATS.filter(c => includeUncat || c.id !== 'uncategorized')
    .map(c => `<option value="${c.id}"${c.id === selected ? ' selected' : ''}>${esc(c.label)}</option>`).join('');
}
function notFound() {
  return shell(`${subHead('Not found')}<div class="empty">That item isn't here anymore. It may have been deleted.</div>`);
}

/* =====================================================================
 * Views
 * ===================================================================== */
function viewWelcome() {
  const name = 'Studio Books';
  return `<main class="screen welcome">
    <div class="crest" aria-hidden="true">${esc(initials('Sydney Whetman'))}</div>
    <h1 class="display">${name}</h1>
    <p>Sales, expenses, stock and taxes for the studio, all in one place on your phone.</p>
    <ul>
      <li>${icon('check', 18)}<span>Log a sale in a few taps. Jewelry comes out of stock on its own.</span></li>
      <li>${icon('check', 18)}<span>Snap receipts, and import Venmo or bank statements instead of typing them.</span></li>
      <li>${icon('check', 18)}<span>See what to set aside for taxes, then export a year-end summary to file with.</span></li>
    </ul>
    <div class="form">
      <button type="button" class="btn primary block" data-act="start-fresh">Start with my own numbers</button>
      <button type="button" class="btn ghost block" data-act="start-demo">Look around with sample numbers</button>
    </div>
    <p class="fine">Everything stays on this phone. Nothing is sent anywhere. Make a backup from Settings now and then.</p>
  </main>`;
}

function viewLock() {
  return `<main class="screen lock-screen">
    ${icon('lock', 44)}
    <h1 class="display">Studio Books is locked</h1>
    <button type="button" class="btn primary" data-act="unlock">Unlock</button>
    <button type="button" class="link" data-act="lock-help">Can't unlock?</button>
  </main>`;
}

function viewToday() {
  const s = S.settings;
  const now = today(), mk = monthKey(now), y = now.slice(0, 4);
  const ms = periodSummary(...monthRange(mk));
  const tx = taxSummary(y);
  const sold = soldLast30();
  const low = lowStock(sold).length;
  const rev = reviewItems();
  const revN = rev.sales.length + rev.uncat.length;
  const anyData = S.sales.length + S.expenses.length + S.income.length + S.stock.length > 0;
  const lastB = S.meta.lastBackup ? S.meta.lastBackup.slice(0, 10) : null;
  const bAge = lastB ? daysBetween(lastB, now) : null;
  const needBackup = anyData && !memoryOnly && (bAge === null || bAge >= 14);
  const appr = apprenticeStatus(mk);
  const recent = allTxns('0000-01-01', '9999-12-31').slice(0, 8);
  const remain = Math.max(0, tx.setAside - tx.paid);
  const due = nextDue(y) || nextDue(+y + 1);

  const chips = [];
  if (low) chips.push(`<button type="button" class="chip warn" data-act="stock-low">${plural(low, 'item')} running low</button>`);
  if (revN) chips.push(`<button type="button" class="chip" data-act="go" data-to="review">${revN} to check</button>`);
  if (needBackup) chips.push(`<button type="button" class="chip" data-act="goto-backup">${bAge === null ? 'No backup yet' : `Last backup ${bAge} days ago`}</button>`);

  const apprName = appr && appr.name ? `${appr.name}'s rent` : 'Apprentice rent';
  const apprCard = appr ? `<div class="card row-card">
      <span class="row-main"><span class="row-title">${esc(apprName)} · ${esc(monthName(mk))}</span>
      <span class="row-sub">${appr.state === 'paid' ? `${money(appr.received)} received` : `${money(appr.rent - appr.received)} ${appr.state === 'late' ? 'was due' : 'due'} ${esc(fmtDate(appr.due))}`}</span></span>
      ${appr.state === 'paid' ? '<span class="pill good">Received</span>' : `<button type="button" class="btn small" data-act="appr-received">Mark received</button>`}
    </div>` : '';

  return shell(`
    <header class="top">
      <div class="top-text"><span class="eyebrow">${esc(fmtDateLong(now))}</span><h1 class="display">${greeting()}${s.ownerName ? ', ' + esc(s.ownerName) : ''}</h1></div>
      <button type="button" class="icon-btn" data-act="go" data-to="settings" aria-label="Settings">${icon('gear')}</button>
    </header>
    ${window.__STUDIO_PREVIEW__ ? `<div class="notice"><div><strong>Test drive.</strong> What you enter here stays in this browser only. Reading receipts and the Face ID lock only work in the installed app.</div></div>` : ''}
    ${memoryOnly ? `<div class="notice warn"><div>This browser isn't letting the app save. Anything you enter will be gone when you close it. Open the app from the home screen icon or in Safari or Chrome.</div></div>` : ''}
    ${S.meta.demo ? `<div class="notice"><div><strong>These are sample numbers.</strong> Clear them when you're ready to use your own.</div><button type="button" class="btn small" data-act="clear-demo">Clear samples</button></div>` : ''}
    <section class="card">
      <div class="card-head"><span class="label">${esc(monthName(mk))} so far</span><button type="button" class="link" data-act="go" data-to="money/${mk}">Details</button></div>
      <div class="stat"><span class="stat-label">Profit</span><span class="stat-big${ms.profit < 0 ? ' neg' : ''}">${money0(ms.profit)}</span></div>
      <div class="grid2">
        <div class="stat"><span class="stat-label">Money in</span><span class="stat-mid">${money0(ms.moneyIn)}</span></div>
        <div class="stat"><span class="stat-label">Money out</span><span class="stat-mid">${money0(ms.moneyOut)}</span></div>
      </div>
    </section>
    <button type="button" class="card gold row-card" data-act="go" data-to="taxes/${y}">
      <span style="color: var(--gold)">${icon('jar', 26)}</span>
      <span class="row-main"><span class="row-title">${money0(remain)} to keep in tax savings</span>
      <span class="row-sub soft">${tx.profit > 0 ? `${s.taxPct}% of this year's profit, less ${money0(tx.paid)} already paid` : 'No profit yet this year, so nothing to set aside'}${due ? `. Next estimated payment due ${esc(fmtDate(due.date))}.` : ''}</span></span>
      ${icon('chevR', 18)}
    </button>
    <div class="grid3">
      <button type="button" class="quick-btn" data-act="go" data-to="sale/new">${icon('card', 24)}Log a sale</button>
      <button type="button" class="quick-btn" data-act="go" data-to="expense/new">${icon('camera', 24)}Add expense</button>
      <button type="button" class="quick-btn" data-act="go" data-to="trips">${icon('route', 24)}Log a drive</button>
    </div>
    ${apprCard}
    ${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
    <section class="section">
      <div class="section-head"><h2>Recent</h2>${recent.length ? `<button type="button" class="link" data-act="go" data-to="money/${mk}">See the month</button>` : ''}</div>
      ${recent.length ? `<div class="list">${recent.map(txnRow).join('')}</div>` :
        `<div class="empty">Nothing logged yet. Tap the + button after a client pays, or add an expense when you buy something for the studio.</div>`}
    </section>
  `, { nav: 'today' });
}

function viewMoney(mk) {
  const cur = monthKey(today());
  mk = /^\d{4}-\d{2}$/.test(mk || '') ? mk : cur;
  const [from, to] = monthRange(mk);
  const p = periodSummary(from, to);
  const wk = weekBuckets(mk);
  const tx = allTxns(from, to);
  const maxW = Math.max(1, ...wk.map(w => Math.max(w.in, w.out)));
  const pct = v => Math.round((v / maxW) * 100);
  const inRows = Object.entries(p.incomeByCat).filter(([, v]) => v).sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<div class="kv"><span>${esc(INCOME_LABELS[k] || k)}</span><span>${money(v)}</span></div>`).join('');
  const budgets = S.settings.budgets || {};
  const outRows = EXPENSE_CATS.filter(c => c.id !== 'personal' && ((p.expByCat[c.id] || 0) > 0 || (budgets[c.id] || 0) > 0)).map(c => {
    const a = p.expByCat[c.id] || 0, b = budgets[c.id] || 0;
    if (!b) return `<div class="kv"><span>${esc(c.label)}</span><span>${money(a)}</span></div>`;
    const over = a > b;
    return `<div class="budget${over ? ' over' : ''}">
      <div class="kv"><span>${esc(c.label)}</span><span>${money0(a)} of ${money0(b)}${over ? ' · over' : ''}</span></div>
      <div class="track" role="img" aria-label="${esc(c.label)}: ${money0(a)} of a ${money0(b)} budget"><span style="width:${Math.min(100, Math.round(a / b * 100))}%"></span></div>
    </div>`;
  }).join('');

  return shell(`
    <header class="top">
      <div class="top-text"><h1 class="display">Money</h1></div>
      <button type="button" class="icon-btn plain" data-act="go" data-to="money/${addMonths(mk, -1)}" data-replace="1" aria-label="Previous month">${icon('back', 20)}</button>
      <span style="font-weight:700; white-space:nowrap">${esc(fmtMonth(mk))}</span>
      <button type="button" class="icon-btn plain" data-act="go" data-to="money/${addMonths(mk, 1)}" data-replace="1" aria-label="Next month" ${mk >= cur ? 'disabled' : ''}>${icon('chevR', 20)}</button>
    </header>
    <section class="card">
      <div class="grid2" style="align-items:end">
        <div class="stat"><span class="stat-label">Profit</span><span class="stat-big${p.profit < 0 ? ' neg' : ''}">${money0(p.profit)}</span></div>
        <div class="stat" style="align-items:flex-end"><span class="row-sub">${money0(p.moneyIn)} in</span><span class="row-sub">${money0(p.moneyOut)} out</span></div>
      </div>
      <div class="wk-chart" role="img" aria-label="Money in and out for each week of ${esc(fmtMonth(mk))}">
        ${wk.map(w => `<div class="wk"><div class="wk-bars"><span class="bar-in" style="height:${pct(w.in)}%" title="In ${money0(w.in)}"></span><span class="bar-out" style="height:${pct(w.out)}%" title="Out ${money0(w.out)}"></span></div><span class="wk-label">${w.label}</span></div>`).join('')}
      </div>
      <div class="legend"><span><i class="sw in"></i>Money in</span><span><i class="sw out"></i>Money out</span><span>by days of the month</span></div>
    </section>
    <div class="btn-row">
      <button type="button" class="btn small" data-act="go" data-to="expense/new">Add expense</button>
      <button type="button" class="btn small" data-act="go" data-to="income/new">Other income</button>
      <button type="button" class="btn small" data-act="go" data-to="import">${icon('upload', 18)}Import</button>
    </div>
    <section class="section">
      <h2>Where it came from</h2>
      ${inRows || '<p class="fine">No money in yet this month.</p>'}
    </section>
    <section class="section">
      <div class="section-head"><h2>Where it went</h2><button type="button" class="link" data-act="goto-budgets">Set budgets</button></div>
      ${outRows || '<p class="fine">No expenses yet this month.</p>'}
      ${p.personal ? `<p class="fine">${money(p.personal)} marked personal isn't counted.</p>` : ''}
    </section>
    <section class="section">
      <h2>Everything in ${esc(monthName(mk))}</h2>
      ${tx.length ? `<div class="list">${tx.map(txnRow).join('')}</div>` : '<div class="empty">Nothing logged this month.</div>'}
    </section>
  `, { nav: 'money' });
}

function viewStock() {
  const f = ui.stockFilter || 'All';
  const sold = soldLast30();
  const all = S.stock.map(i => ({ i, st: stockStatus(i, sold) }));
  const lows = all.filter(x => x.st.low);
  const shown = all.filter(x => f === 'All' || (f === 'Low' ? x.st.low : x.i.cat === f))
    .sort((a, b) => (b.st.low - a.st.low) || a.i.name.localeCompare(b.i.name));
  const filters = ['All', 'Low', ...STOCK_CATS].map(n => `<button type="button" class="chip" data-act="stock-filter" data-f="${n}" aria-pressed="${f === n}">${n}${n === 'Low' && lows.length ? ` (${lows.length})` : ''}</button>`).join('');
  const rows = shown.map(({ i, st }) => `
    <button type="button" class="row-btn" data-act="go" data-to="item/${encodeURIComponent(i.id)}" data-text="${esc((i.name + ' ' + i.cat).toLowerCase())}">
      <span class="row-main"><span class="row-title">${esc(i.name)}</span>
      <span class="row-sub">${esc(i.cat)} · costs ${money(i.cost)}${i.price ? ` · sells ${money(i.price)}` : ''}</span></span>
      <span class="row-end"><span class="qty">${i.qty || 0}</span>
      ${st.low ? '<span class="pill warn">Low</span>' : st.daysLeft !== null ? `<span class="row-sub">~${st.daysLeft} days</span>` : '<span class="row-sub">in stock</span>'}</span>
    </button>`).join('');
  return shell(`
    <header class="top">
      <div class="top-text"><h1 class="display">Stock</h1><span class="eyebrow">${money0(stockValue())} on the shelf at cost</span></div>
      <button type="button" class="btn small" data-act="go" data-to="item/new">${icon('plus', 18)}Add item</button>
    </header>
    ${S.stock.length ? `
    <label class="field" for="stock-search"><span class="sr-only">Search stock</span>
      <input id="stock-search" type="search" placeholder="Search jewelry, aftercare, supplies" data-filter="#stock-list" autocomplete="off"></label>
    <div class="chips scroll">${filters}</div>
    ${lows.length ? `<div class="notice warn"><div><strong>${plural(lows.length, 'item')} running low.</strong> Based on your count and how fast it's selling.</div><button type="button" class="btn small" data-act="reorder-list">Reorder list</button></div>` : ''}
    <div class="list" id="stock-list">${rows || '<div class="empty">Nothing in this group.</div>'}</div>` :
    `<div class="empty">No items yet. Add your jewelry, aftercare and supplies with how many you have. Sales and receipts will keep the counts up to date from then on.
      <button type="button" class="btn primary" data-act="go" data-to="item/new">Add the first item</button></div>`}
  `, { nav: 'stock' });
}

function viewItem(id) {
  const isNew = !id || id === 'new';
  const existing = isNew ? null : S.stock.find(i => i.id === id);
  if (!isNew && !existing) return notFound();
  const d = ensureDraft('item:' + (id || 'new'), () => existing ? clone(existing) :
    { id: null, name: '', cat: ui.stockFilter && STOCK_CATS.includes(ui.stockFilter) ? ui.stockFilter : 'Jewelry', qty: 0, cost: 0, price: 0, lowAt: 2 });
  const st = existing ? stockStatus(existing, soldLast30()) : null;
  return shell(`
    ${subHead(isNew ? 'New stock item' : 'Stock item', { backTo: 'stock' })}
    <div class="form">
      ${textField('Name', 'name', d.name, { placeholder: 'e.g. Titanium labret 16g, 6mm', extra: isNew ? 'autofocus' : '' })}
      <div class="field"><span class="field-label">Group</span>
        <div class="seg" role="group" aria-label="Group">${STOCK_CATS.map(c => `<button type="button" data-act="set-draft" data-bind="cat" data-val="${c}" aria-pressed="${d.cat === c}">${c}</button>`).join('')}</div></div>
      <div class="field"><label class="field-label" for="f-qty">How many you have</label>
        <div class="stepper" style="align-self:flex-start">
          <button type="button" data-act="step" data-bind="qty" data-step="-1" aria-label="One less">${icon('minus', 18)}</button>
          <input id="f-qty" inputmode="numeric" data-bind="qty" data-type="int" value="${d.qty || 0}">
          <button type="button" data-act="step" data-bind="qty" data-step="1" aria-label="One more">${icon('plus', 18)}</button>
        </div></div>
      <div class="grid2">
        ${moneyField('What you pay (each)', 'cost', d.cost)}
        ${moneyField(d.cat === 'Supplies' ? 'You charge (optional)' : 'You charge', 'price', d.price)}
      </div>
      <label class="field" for="f-lowAt"><span>Warn me when it gets down to</span>
        <input id="f-lowAt" inputmode="numeric" data-bind="lowAt" data-type="int" value="${d.lowAt || 0}"></label>
      ${st ? `<p class="fine">${plural(st.s30, 'sold', 'sold')} in the last 30 days${st.daysLeft !== null ? `, about ${st.daysLeft} days left at that pace` : ''}.</p>` : ''}
    </div>
  `, { footer: `${!isNew ? `<button type="button" class="btn danger icon-only" data-act="delete-item" aria-label="Delete item">${icon('trash', 20)}</button>` : ''}<button type="button" class="btn primary" data-act="save-item">Save item</button>` });
}

function viewSale(id) {
  const isNew = !id || id === 'new';
  const existing = isNew ? null : S.sales.find(s => s.id === id);
  if (!isNew && !existing) return notFound();
  const d = ensureDraft('sale:' + (id || 'new'), () => existing ? clone(existing) :
    { id: null, date: today(), client: '', lines: [], tip: 0, salesTax: 0, method: S.settings.lastMethod || 'Venmo', note: '' });
  hook.onInput = () => updateSaleTotals();
  const services = S.settings.services.map(sv => `<button type="button" class="chip" data-act="sale-add-service" data-id="${esc(sv.id)}">${esc(sv.name)}</button>`).join('');
  const lines = d.lines.map((l, idx) => {
    const stockItem = l.kind === 'item' ? S.stock.find(i => i.id === l.stockId) : null;
    const left = stockItem ? (stockItem.qty || 0) - (l.qty || 1) + (existing ? sum(existing.lines.filter(x => x.stockId === l.stockId), x => x.qty || 1) : 0) : null;
    return `<div class="line-row">
      <span class="row-main"><span class="row-title">${l.kind === 'service' ? `<input class="input" style="width:100%;text-align:left;padding-left:10px;min-height:40px" aria-label="Service name" data-bind="lines.${idx}.name" value="${esc(l.name)}">` : esc(l.name)}</span></span>
      <span class="money-in"><input inputmode="decimal" aria-label="Price for ${esc(l.name)}" data-bind="lines.${idx}.price" data-type="money" value="${esc(centsToInput(l.price))}" placeholder="0.00"></span>
      <button type="button" class="icon-btn plain" data-act="sale-remove-line" data-i="${idx}" aria-label="Remove ${esc(l.name)}">${icon('close', 18)}</button>
      ${l.kind === 'item' ? `<div class="line-sub">
        <span class="stepper"><button type="button" data-act="line-qty" data-i="${idx}" data-step="-1" aria-label="One less">${icon('minus', 16)}</button><span>${l.qty || 1}</span><button type="button" data-act="line-qty" data-i="${idx}" data-step="1" aria-label="One more">${icon('plus', 16)}</button></span>
        <span>${esc(l.cat || '')}${left !== null ? ` · ${left < 0 ? `<span style="color:var(--warn)">stock will show ${left}</span>` : `${left} left after this`}` : ''}</span></div>` : ''}
    </div>`;
  }).join('');
  return shell(`
    ${subHead(isNew ? 'Log a sale' : 'Sale', { backTo: 'today', sub: d.source === 'venmo' ? 'Imported from Venmo' : '' })}
    ${d.needsReview ? `<div class="notice"><div>This came from a Venmo import. Add what it was for, then save.</div></div>` : ''}
    <div class="form">
      <div class="field"><span class="field-label">Services</span>
        <div class="chips">${services}<button type="button" class="chip add" data-act="sale-add-custom">${icon('plus', 16)}Other</button></div></div>
      <div class="field"><span class="field-label">Jewelry & products</span>
        <div class="chips"><button type="button" class="chip add" data-act="pick-stock" data-mode="sale">${icon('plus', 16)}Add from stock</button></div></div>
      ${lines ? `<div class="list">${lines}</div>` : '<p class="fine">Tap a service or add jewelry to start.</p>'}
      <div class="grid2">
        ${moneyField('Tip', 'tip', d.tip)}
        ${textField('Date', 'date', d.date, { type: 'date' })}
      </div>
      <div class="field"><span class="field-label">Paid with</span>
        <div class="chips">${PAY_METHODS.map(m => `<button type="button" class="chip" data-act="set-draft" data-bind="method" data-val="${m}" aria-pressed="${d.method === m}">${m}</button>`).join('')}</div></div>
      ${textField('Client (optional)', 'client', d.client, { placeholder: 'First name' })}
      <label class="field" for="f-note"><span>Note (optional)</span><textarea id="f-note" data-bind="note" placeholder="Jewelry details, aftercare given…">${esc(d.note)}</textarea></label>
      <section class="card" aria-live="polite" id="sale-totals">${saleTotalsHTML(d)}</section>
    </div>
  `, { footer: `${!isNew ? `<button type="button" class="btn danger icon-only" data-act="delete-sale" aria-label="Delete sale">${icon('trash', 20)}</button>` : ''}<button type="button" class="btn primary" data-act="save-sale" id="save-sale-btn">Save sale</button>` });
}
function saleTotalsHTML(d) {
  d.salesTax = S.settings.salesTax.enabled ? computeSalesTax(d.lines) : (d.salesTax || 0);
  const t = saleTotals(d);
  return `
    ${t.services ? `<div class="kv"><span>Services</span><span>${money(t.services)}</span></div>` : ''}
    ${t.products ? `<div class="kv"><span>Jewelry & products</span><span>${money(t.products)}</span></div>` : ''}
    ${t.tax ? `<div class="kv"><span>Sales tax (${S.settings.salesTax.rate}%)</span><span>${money(t.tax)}</span></div>` : ''}
    ${t.tip ? `<div class="kv"><span>Tip</span><span>${money(t.tip)}</span></div>` : ''}
    <hr class="divider">
    <div class="kv total"><span>Total</span><span>${money(t.total)}</span></div>
    ${t.cost ? `<p class="fine">Jewelry cost you ${money(t.cost)}, so you keep ${money(t.income - t.cost)}.</p>` : ''}`;
}
function updateSaleTotals() {
  const box = $('#sale-totals');
  if (box && draft) box.innerHTML = saleTotalsHTML(draft);
}

function viewExpense(id) {
  const isNew = !id || id === 'new';
  const existing = isNew ? null : S.expenses.find(e => e.id === id);
  if (!isNew && !existing) return notFound();
  const d = ensureDraft('expense:' + (id || 'new'), () => existing ? Object.assign(clone(existing), { stockAdds: clone(existing.stockAdds || []) }) :
    { id: null, date: today(), vendor: '', amount: 0, category: 'uncategorized', note: '', receiptId: null, stockAdds: [] });
  hook.onInput = (el) => {
    if (el.dataset.bind === 'category') d._catTouched = true;
    if (el.dataset.bind === 'vendor' && !d._catTouched && isNew) {
      const g = guessCategory(d.vendor);
      if (g && g !== d.category) { d.category = g; const sel = $('#f-category'); if (sel) sel.value = g; }
    }
  };
  const hasPhoto = !!(d._newReceipt || d.receiptId || d.receiptDemo);
  const isPdf = d._newReceipt ? /pdf/.test(d._newReceipt.type) : false;
  const showStock = ['inventory', 'supplies', 'equipment'].includes(d.category) || (d.stockAdds || []).length;
  const ocr = ui.ocr;
  const adds = (d.stockAdds || []).map((a, idx) => {
    const it = S.stock.find(i => i.id === a.stockId);
    return `<div class="line-row">
      <span class="row-main"><span class="row-title">${esc(it ? it.name : a.name || 'Item')}</span><span class="row-sub">${it ? `${it.qty || 0} on the shelf now` : 'No longer in stock list'}</span></span>
      <span class="stepper"><button type="button" data-act="add-qty" data-i="${idx}" data-step="-1" aria-label="One less">${icon('minus', 16)}</button><span>${a.qty}</span><button type="button" data-act="add-qty" data-i="${idx}" data-step="1" aria-label="One more">${icon('plus', 16)}</button></span>
      <button type="button" class="icon-btn plain" data-act="remove-add" data-i="${idx}" aria-label="Remove">${icon('close', 18)}</button>
    </div>`;
  }).join('');
  return shell(`
    ${subHead(isNew ? 'Add an expense' : 'Expense', { backTo: 'money', sub: d.source === 'recurring' ? 'Added automatically each month' : d.source === 'venmo' ? 'Imported from Venmo' : d.source === 'bank' ? 'Imported from the bank' : '' })}
    <div class="receipt-box${hasPhoto ? ' has' : ''}">
      ${hasPhoto ? `
        <button type="button" class="receipt-thumb" data-act="view-receipt" aria-label="View receipt">${isPdf ? icon('file', 30) : `<img id="receipt-img" alt="Receipt photo">`}</button>
        <div class="row-main">
          <span class="row-title">${d.receiptDemo && !d._newReceipt && !d.receiptId ? 'Sample receipt' : 'Receipt saved'}</span>
          ${ocr === 'reading' ? '<span class="status-line"><span class="spinner"></span>Reading the receipt…</span>' :
            ocr === 'done' ? '<span class="status-line">Filled in from the receipt. Check the numbers.</span>' :
            ocr === 'failed' ? '<span class="row-sub">Couldn\'t read it automatically. Fill in the details below.</span>' : ''}
          <div class="btn-row" style="margin-top:6px">
            <label class="btn small">Replace<input type="file" accept="image/*,application/pdf" data-file="receipt"></label>
            <button type="button" class="btn small ghost" data-act="remove-receipt">Remove</button>
          </div>
        </div>` : `
        <div class="row-main"><span class="row-title">Receipt</span><span class="row-sub">Take a photo and the app will try to fill in the amount, date and store for you.</span></div>
        <div class="btn-row">
          <label class="btn primary">${icon('camera', 20)}Take photo<input type="file" accept="image/*" capture="environment" data-file="receipt"></label>
          <label class="btn">${icon('upload', 20)}Choose file<input type="file" accept="image/*,application/pdf" data-file="receipt"></label>
        </div>`}
    </div>
    <div class="form">
      ${moneyField('Amount', 'amount', d.amount, { big: true })}
      ${textField('Paid to', 'vendor', d.vendor, { placeholder: 'Store or company', extra: 'data-rerender="1"' })}
      <div class="grid2">
        <label class="field" for="f-category"><span>Category</span><select id="f-category" data-bind="category" data-rerender="1">${catOptions(d.category)}</select></label>
        ${textField('Date', 'date', d.date, { type: 'date' })}
      </div>
      ${showStock ? `<section class="section">
        <div class="section-head"><h2>Add these to stock</h2></div>
        ${adds ? `<div class="list">${adds}</div>` : '<p class="fine">Bought jewelry or aftercare? Add the items so your counts go up.</p>'}
        <div><button type="button" class="chip add" data-act="pick-stock" data-mode="expense">${icon('plus', 16)}Add item</button></div>
      </section>` : ''}
      <label class="field" for="f-note"><span>Note (optional)</span><textarea id="f-note" data-bind="note">${esc(d.note)}</textarea></label>
      <p class="fine">${d.category && CAT[d.category] && CAT[d.category].line ? `Counts toward ${CAT[d.category].line === 'COGS' ? 'cost of goods sold' : `Schedule C line ${CAT[d.category].line}`} at tax time.` : d.category === 'personal' ? "Personal costs aren't counted in profit or taxes." : 'Pick a category so this counts at tax time.'}</p>
    </div>
  `, { footer: `${!isNew ? `<button type="button" class="btn danger icon-only" data-act="delete-expense" aria-label="Delete expense">${icon('trash', 20)}</button>` : ''}<button type="button" class="btn primary" data-act="save-expense">Save expense</button>` });
}

function viewIncome(id) {
  const isNew = !id || id === 'new' || id === 'apprentice';
  const existing = isNew ? null : S.income.find(i => i.id === id);
  if (!isNew && !existing) return notFound();
  const a = S.settings.apprentice;
  const d = ensureDraft('income:' + (id || 'new'), () => existing ? clone(existing) :
    { id: null, date: today(), category: id === 'apprentice' ? 'apprentice-rent' : 'other', amount: id === 'apprentice' ? a.rent : 0, method: 'Venmo', note: '' });
  return shell(`
    ${subHead(isNew ? 'Other income' : 'Income', { backTo: 'money' })}
    <div class="form">
      <div class="field"><span class="field-label">What is it</span>
        <div class="seg" role="group" aria-label="Kind of income">
          <button type="button" data-act="set-draft" data-bind="category" data-val="apprentice-rent" aria-pressed="${d.category === 'apprentice-rent'}">Apprentice rent</button>
          <button type="button" data-act="set-draft" data-bind="category" data-val="other" aria-pressed="${d.category === 'other'}">Something else</button>
        </div></div>
      ${moneyField('Amount', 'amount', d.amount, { big: true })}
      <div class="grid2">
        ${textField('Date', 'date', d.date, { type: 'date' })}
        <label class="field" for="f-method"><span>Paid with</span><select id="f-method" data-bind="method">${PAY_METHODS.map(m => `<option${m === d.method ? ' selected' : ''}>${m}</option>`).join('')}</select></label>
      </div>
      ${textField('Note (optional)', 'note', d.note, { placeholder: d.category === 'apprentice-rent' ? 'e.g. October share of rent' : 'e.g. guest spot fee' })}
      <p class="fine">Counts as business income at tax time.</p>
    </div>
  `, { footer: `${!isNew ? `<button type="button" class="btn danger icon-only" data-act="delete-income" aria-label="Delete">${icon('trash', 20)}</button>` : ''}<button type="button" class="btn primary" data-act="save-income">Save</button>` });
}

function viewTaxes(y) {
  const cy = today().slice(0, 4);
  y = /^\d{4}$/.test(y || '') ? y : cy;
  const t = taxSummary(y);
  const now = today();
  const pays = S.taxPayments.filter(p => p.year === y).sort((a, b) => (a.date < b.date ? -1 : 1));
  const remain = Math.max(0, t.setAside - t.paid);
  const dues = dueDates(y);
  const nd = nextDue(y);
  const qTiles = dues.map(d => {
    const paid = sum(pays.filter(p => p.quarter === d.q), p => p.amount);
    let cls = '', state = '<em>Later</em>';
    if (paid) state = `<em class="good">Paid ${money0(paid)}</em>`;
    else if (nd && nd.q === d.q) { cls = 'next'; state = '<em class="gold">Next up</em>'; }
    else if (d.date < now) { cls = 'late'; state = '<em class="warn">Not logged</em>'; }
    return `<div class="q ${cls}"><b>Q${d.q}</b><span>${esc(fmtDate(d.date))}</span>${state}</div>`;
  }).join('');
  const missing = S.expenses.filter(e => e.date.startsWith(y) && needsReceipt(e));
  const rev = reviewItems();
  const yearsWithData = [...new Set([cy, ...S.sales.map(s => s.date.slice(0, 4)), ...S.expenses.map(e => e.date.slice(0, 4))])].sort();
  const yi = yearsWithData.indexOf(y);
  const st = S.settings.salesTax;
  return shell(`
    <header class="top">
      <div class="top-text"><h1 class="display">Taxes · ${esc(y)}</h1><span class="eyebrow">Estimates to plan with, from what's in the app.</span></div>
      ${yearsWithData.length > 1 ? `<button type="button" class="icon-btn plain" data-act="go" data-replace="1" data-to="taxes/${yearsWithData[yi - 1] || y}" aria-label="Previous year" ${yi <= 0 ? 'disabled' : ''}>${icon('back', 20)}</button>
      <button type="button" class="icon-btn plain" data-act="go" data-replace="1" data-to="taxes/${yearsWithData[yi + 1] || y}" aria-label="Next year" ${yi >= yearsWithData.length - 1 ? 'disabled' : ''}>${icon('chevR', 20)}</button>` : ''}
    </header>
    <section class="card gold">
      <div class="card-head"><span class="label" style="color:var(--gold-hi)">Tax savings</span><span class="row-sub soft">${S.settings.taxPct}% of profit</span></div>
      <div class="stat"><span class="stat-big">${money0(remain)}</span><span class="row-sub soft">still to set aside, after ${money0(t.paid)} in estimated payments</span></div>
      <div class="track thick" role="img" aria-label="${money0(t.paid)} paid of ${money0(t.setAside)} to set aside"><span style="width:${t.setAside ? Math.min(100, Math.round(t.paid / t.setAside * 100)) : 0}%"></span></div>
      <p class="fine" style="color:var(--gold-hi)">Self-employment tax alone is about ${money0(t.seTax)} on this profit. Income tax comes on top, which is what the rest of the ${S.settings.taxPct}% is for.</p>
    </section>
    <section class="section">
      <div class="section-head"><h2>Estimated payments</h2><button type="button" class="link" data-act="log-tax-payment" data-year="${y}">Log a payment</button></div>
      <div class="grid4">${qTiles}</div>
      ${pays.length ? `<div class="list">${pays.map(p => `<div class="row"><span class="row-main"><span class="row-title">Q${p.quarter} payment</span><span class="row-sub">${esc(fmtDateYear(p.date))}</span></span><span class="amt">${money(p.amount)}</span><button type="button" class="icon-btn plain" data-act="delete-tax-payment" data-id="${esc(p.id)}" aria-label="Delete Q${p.quarter} payment">${icon('trash', 18)}</button></div>`).join('')}</div>` : ''}
      <p class="fine">Pay at IRS Direct Pay or with your IRS online account, then log it here so the savings number stays right.</p>
    </section>
    <section class="section">
      <h2>Schedule C so far</h2>
      <div class="table-wrap"><table class="sched">
        <thead><tr><th>Line</th><th>What it is</th><th class="num">Amount</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Gross receipts<small>Sales, tips, apprentice rent, other income${t.salesTax ? '. Sales tax left out.' : ''}</small></td><td class="num">${money(t.gross)}</td></tr>
          <tr><td>4</td><td>Cost of goods sold<small>${money0(t.beginInv)} at start + ${money0(t.purchases)} bought − ${money0(t.endInv)} on hand</small></td><td class="num">${money(t.cogs)}</td></tr>
          ${t.lineList.map(l => `<tr><td>${l.line}</td><td>${esc(l.label)}${l.line === '9' ? `<small>${Math.round(t.miles * 10) / 10} miles at ${S.settings.mileageRate}¢</small>` : ''}</td><td class="num">${money(l.amount)}</td></tr>`).join('')}
          <tr class="strong"><td>28</td><td>Total expenses</td><td class="num">${money(t.expenses)}</td></tr>
          <tr class="strong"><td>31</td><td>Net profit</td><td class="num">${money(t.profit)}</td></tr>
        </tbody>
      </table></div>
      ${t.uncategorized ? `<div class="notice warn"><div>${money(t.uncategorized)} of expenses still need a category and aren't counted yet.</div><button type="button" class="btn small" data-act="go" data-to="review">Sort them</button></div>` : ''}
    </section>
    <section class="card">
      <h2>Inventory for cost of goods sold</h2>
      <label class="field" for="begin-inv"><span>What your stock was worth on Jan 1, ${esc(y)} (at cost)</span>
        <div class="money-in"><input id="begin-inv" inputmode="decimal" data-save-setting="beginInventory" data-year="${esc(y)}" value="${esc(centsToInput(t.beginInv))}" placeholder="0.00"></div></label>
      <p class="fine">On hand now: ${money(t.endInv)}, from the Stock tab. Count your shelf on Dec 31 and fix any counts so this is right at year end.</p>
    </section>
    <section class="section">
      <div class="section-head"><h2>Business driving</h2><button type="button" class="link" data-act="go" data-to="trips">Mileage log</button></div>
      <div class="kv"><span>${Math.round(t.miles * 10) / 10} miles logged in ${esc(y)}</span><span>${money(t.car)}</span></div>
      <p class="fine">Supply runs, the bank, conventions. Not the drive from home to the studio.</p>
    </section>
    <section class="section">
      <h2>Before you file</h2>
      <div class="list">
        ${missing.length ? `<button type="button" class="row-btn" data-act="go" data-to="review">${icon('alert', 20)}<span class="row-main"><span class="row-title">${plural(missing.length, 'expense')} without a receipt photo</span><span class="row-sub">Keep receipts for anything you deduct</span></span>${icon('chevR', 18)}</button>` :
          `<div class="row">${icon('check', 20)}<span class="row-main"><span class="row-title">Every expense has a receipt</span></span></div>`}
        ${rev.sales.length ? `<button type="button" class="row-btn" data-act="go" data-to="review">${icon('alert', 20)}<span class="row-main"><span class="row-title">${plural(rev.sales.length, 'imported sale')} to fill in</span></span>${icon('chevR', 18)}</button>` : ''}
        ${st.enabled ? `<div class="row">${icon('check', 20)}<span class="row-main"><span class="row-title">Sales tax collected: ${money(t.salesTax)}</span><span class="row-sub">Owed to the state, so it isn't counted as income</span></span></div>` :
          `<button type="button" class="row-btn" data-act="goto-taxsettings">${icon('alert', 20)}<span class="row-main"><span class="row-title">Sales tax isn't being tracked</span><span class="row-sub">Many states tax jewelry and aftercare sales. Check yours, then turn it on in Settings if it applies.</span></span>${icon('chevR', 18)}</button>`}
        ${S.settings.apprentice.enabled ? `<div class="row">${icon('check', 20)}<span class="row-main"><span class="row-title">Apprentice rent counted as income</span><span class="row-sub">${money(t.p.incomeByCat['apprentice-rent'] || 0)} so far this year</span></span></div>` : ''}
      </div>
    </section>
    <div class="form">
      <button type="button" class="btn primary block" data-act="export-summary" data-year="${y}">${icon('taxes', 20)}Download tax summary</button>
      <button type="button" class="btn block" data-act="export-txns" data-year="${y}">${icon('file', 20)}Download every transaction</button>
      <p class="fine">Both are spreadsheet files you can open in Numbers, Excel or Google Sheets, or bring to whoever helps with your return. This app doesn't give tax advice; check the IRS Schedule C and SE instructions or a tax professional when you're unsure.</p>
    </div>
  `, { nav: 'taxes' });
}

function viewTrips() {
  const y = today().slice(0, 4);
  const d = ensureDraft('trips', () => ({ date: today(), miles: '', purpose: '' }));
  const trips = S.trips.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const ytd = sum(trips.filter(t => t.date.startsWith(y)), t => t.miles || 0);
  return shell(`
    ${subHead('Mileage log', { backTo: 'today', sub: `${Math.round(ytd * 10) / 10} miles in ${y} · worth ${money(Math.round(ytd * S.settings.mileageRate))} at ${S.settings.mileageRate}¢ a mile` })}
    <section class="card">
      <h2>Log a drive</h2>
      <div class="grid2">
        ${textField('Date', 'date', d.date, { type: 'date', id: 'trip-date' })}
        <label class="field" for="trip-miles"><span>Miles (round trip)</span><input id="trip-miles" inputmode="decimal" data-bind="miles" data-type="num" value="${esc(d.miles)}" placeholder="0"></label>
      </div>
      ${textField('Where and why', 'purpose', d.purpose, { placeholder: 'e.g. Supply run to the medical supply store', id: 'trip-purpose' })}
      <button type="button" class="btn primary" data-act="save-trip">Add drive</button>
    </section>
    <section class="section">
      <h2>Drives</h2>
      ${trips.length ? `<div class="list">${trips.map(t => `<div class="row"><span class="row-main"><span class="row-title">${esc(t.purpose || 'Business drive')}</span><span class="row-sub">${esc(fmtDateYear(t.date))}</span></span><span class="amt">${t.miles} mi</span><button type="button" class="icon-btn plain" data-act="delete-trip" data-id="${esc(t.id)}" aria-label="Delete drive">${icon('trash', 18)}</button></div>`).join('')}</div>` :
        '<div class="empty">No drives yet. The IRS wants the date, miles and reason for each one, so log them as you go.</div>'}
    </section>
  `);
}

function viewReview() {
  const r = reviewItems();
  const y = today().slice(0, 4);
  const missing = S.expenses.filter(e => e.date.startsWith(y) && needsReceipt(e)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const row = (kind, rec, title, sub) => `<button type="button" class="row-btn" data-act="go" data-to="${kind}/${encodeURIComponent(rec.id)}"><span class="row-main"><span class="row-title">${esc(title)}</span><span class="row-sub">${esc(sub)}</span></span>${icon('chevR', 18)}</button>`;
  return shell(`
    ${subHead('To check', { backTo: 'today' })}
    <section class="section"><h2>Expenses that need a category</h2>
      ${r.uncat.length ? `<div class="list">${r.uncat.map(e => row('expense', e, `${e.vendor || 'Expense'} · ${money(e.amount)}`, fmtDate(e.date))).join('')}</div>` : '<p class="fine">All sorted.</p>'}</section>
    <section class="section"><h2>Imported sales to fill in</h2>
      ${r.sales.length ? `<div class="list">${r.sales.map(s => row('sale', s, `${saleLabel(s)} · ${money(saleTotals(s).total)}`, fmtDate(s.date))).join('')}</div>` : '<p class="fine">All filled in.</p>'}</section>
    <section class="section"><h2>Expenses without a receipt photo (${esc(y)})</h2>
      ${missing.length ? `<div class="list">${missing.map(e => row('expense', e, `${e.vendor || CAT[e.category].label} · ${money(e.amount)}`, fmtDate(e.date))).join('')}</div>` : '<p class="fine">Every expense has a receipt.</p>'}</section>
  `);
}

function viewImport() {
  const d = ensureDraft('import', () => ({ source: null, rows: null, already: 0 }));
  if (!d.rows) {
    return shell(`
      ${subHead('Import', { backTo: 'money' })}
      <section class="card">
        <h2>Venmo statement</h2>
        <p class="sheet-body">On venmo.com, open Statements, pick the month, and download it as a CSV file. Payments in become sales, and if you already logged a sale the app matches it so nothing is counted twice. Transfers to the bank are left out.</p>
      </section>
      <section class="card">
        <h2>Business bank account</h2>
        <p class="sheet-body">On your bank's website, download transactions as a CSV file. Spending becomes expenses, sorted into categories where the app can tell. Deposits are left off by default because they're usually Venmo cash-outs or cash you already logged.</p>
      </section>
      <label class="btn primary block">${icon('upload', 20)}Choose a CSV file<input type="file" accept=".csv,text/csv,text/plain" data-file="import"></label>
      <p class="fine">You'll see everything before anything is added. The app remembers what it has imported, so bringing in the same month twice is safe.</p>
    `);
  }
  const onCount = d.rows.filter(r => r.on && r.as !== 'skip').length;
  const opts = r => {
    if (r.dir === 'in') {
      const o = [];
      if (r.as.startsWith('match:')) o.push([r.as, 'Already logged as a sale (match)']);
      o.push(['sale', 'New sale'], ['apprentice-rent', 'Apprentice rent'], ['other', 'Other income']);
      return o;
    }
    return EXPENSE_CATS.map(c => [c.id, c.label]);
  };
  const rows = d.rows.map((r, i) => `
    <div class="imp-row${r.on ? '' : ' off'}">
      <input type="checkbox" id="imp-${i}" data-bind="rows.${i}.on" data-rerender="1" ${r.on ? 'checked' : ''} aria-label="Include ${esc(r.who || 'this row')}">
      <label class="row-main" for="imp-${i}"><span class="row-title">${esc(r.who || (r.dir === 'in' ? 'Payment in' : 'Payment out'))}</span>
        <span class="row-sub">${esc(fmtDate(r.date))}${r.note && r.note !== r.who ? ' · ' + esc(r.note.slice(0, 60)) : ''}${r.fee ? ` · ${money(r.fee)} Venmo fee` : ''}</span>
        ${r.hint ? `<span class="row-hint">${esc(r.hint)}</span>` : ''}</label>
      <span class="amt${r.dir === 'in' ? ' in' : ''}">${r.dir === 'in' ? '+' : '−'}${money(r.amount)}</span>
      ${r.on ? `<select data-bind="rows.${i}.as" aria-label="How to record ${esc(r.who || 'this')}">${opts(r).map(([v, l]) => `<option value="${esc(v)}"${v === r.as ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}
    </div>`).join('');
  return shell(`
    ${subHead(d.source === 'venmo' ? 'Venmo import' : 'Bank import', { backTo: 'money', sub: `${plural(d.rows.length, 'new row')}${d.already ? `, ${d.already} already imported before` : ''}` })}
    ${d.rows.length ? `<p class="fine">Untick anything that isn't for the studio. You can fix details later by opening any item.</p><div class="list">${rows}</div>` :
      '<div class="empty">Nothing new in this file. Everything in it has been imported already.</div>'}
  `, { footer: `<button type="button" class="btn ghost" data-act="import-cancel">Cancel</button><button type="button" class="btn primary" data-act="import-commit" ${onCount ? '' : 'disabled'}>Import ${onCount}</button>` });
}

function viewSettings() {
  const d = ensureDraft('settings', () => clone(S.settings));
  const lastB = S.meta.lastBackup;
  const budgetCats = EXPENSE_CATS.filter(c => !['personal', 'uncategorized'].includes(c.id));
  return shell(`
    ${subHead('Settings', { backTo: 'today' })}
    <section class="section">
      <h2>Studio</h2>
      ${textField('Business name', 'businessName', d.businessName)}
      ${textField('Your first name', 'ownerName', d.ownerName)}
    </section>
    <section class="section">
      <h2>Services and prices</h2>
      <p class="fine">These show up as buttons when you log a sale. Leave the price blank for services you price each time, like tattoos.</p>
      ${d.services.map((sv, i) => `<div class="settings-row">
        <label class="field" for="sv-n-${i}"><span class="sr-only">Service name</span><input id="sv-n-${i}" data-bind="services.${i}.name" value="${esc(sv.name)}" placeholder="Service name"></label>
        <label class="field" for="sv-p-${i}"><span class="sr-only">Price</span><div class="money-in"><input id="sv-p-${i}" inputmode="decimal" data-bind="services.${i}.price" data-type="money" value="${esc(centsToInput(sv.price))}" placeholder="0.00"></div></label>
        <button type="button" class="icon-btn plain" data-act="settings-remove" data-list="services" data-i="${i}" aria-label="Remove ${esc(sv.name)}">${icon('trash', 18)}</button>
      </div>`).join('')}
      <div><button type="button" class="chip add" data-act="settings-add-service">${icon('plus', 16)}Add a service</button></div>
    </section>
    <section class="section">
      <h2>Apprentice</h2>
      <div class="toggle-row"><span class="row-main"><span class="row-title">Track apprentice rent</span><span class="row-sub">Your apprentice keeps her own client payments and pays you toward rent. The app reminds you each month and counts it as income.</span></span>
        <label class="switch"><input type="checkbox" data-bind="apprentice.enabled" data-rerender="1" ${d.apprentice.enabled ? 'checked' : ''} aria-label="Track apprentice rent"><span></span></label></div>
      ${d.apprentice.enabled ? `
        ${textField('Her name', 'apprentice.name', d.apprentice.name, { placeholder: 'Used to spot her Venmo payments' })}
        <div class="grid2">
          ${moneyField('Rent she pays each month', 'apprentice.rent', d.apprentice.rent)}
          <label class="field" for="f-dueday"><span>Due on day</span><input id="f-dueday" inputmode="numeric" data-bind="apprentice.dueDay" data-type="int" value="${d.apprentice.dueDay || 1}"></label>
        </div>` : ''}
    </section>
    <section class="section">
      <h2>Repeating expenses</h2>
      <p class="fine">Rent, insurance, booking software. Added to Money automatically on the day you pick each month.</p>
      ${d.recurring.map((r, i) => `<div class="rec-block">
        <div class="settings-row rec">
          <label class="field" for="rc-n-${i}"><span>What</span><input id="rc-n-${i}" data-bind="recurring.${i}.name" value="${esc(r.name)}" placeholder="e.g. Studio rent"></label>
          <label class="field" for="rc-a-${i}"><span>Amount</span><div class="money-in"><input id="rc-a-${i}" inputmode="decimal" data-bind="recurring.${i}.amount" data-type="money" value="${esc(centsToInput(r.amount))}" placeholder="0.00"></div></label>
        </div>
        <div class="grid2">
          <label class="field" for="rc-c-${i}"><span>Category</span><select id="rc-c-${i}" data-bind="recurring.${i}.category">${catOptions(r.category, { includeUncat: false })}</select></label>
          <label class="field" for="rc-d-${i}"><span>Day of month</span><input id="rc-d-${i}" inputmode="numeric" data-bind="recurring.${i}.day" data-type="int" value="${r.day || 1}"></label>
        </div>
        <button type="button" class="link" style="align-self:flex-start;color:var(--bad)" data-act="settings-remove" data-list="recurring" data-i="${i}">Stop repeating this</button>
      </div>`).join('')}
      <div><button type="button" class="chip add" data-act="settings-add-recurring">${icon('plus', 16)}Add a repeating expense</button></div>
    </section>
    <section class="section" id="budgets">
      <h2>Monthly budgets</h2>
      <p class="fine">Optional. Money shows how each month is tracking against these.</p>
      ${budgetCats.map(c => `<div class="settings-row rec"><span class="row-title" style="align-self:center">${esc(c.label)}</span>
        <label class="field" for="bg-${c.id}"><span class="sr-only">${esc(c.label)} budget</span><div class="money-in"><input id="bg-${c.id}" inputmode="decimal" data-bind="budgets.${c.id}" data-type="money" value="${esc(centsToInput(d.budgets[c.id]))}" placeholder="—"></div></label></div>`).join('')}
    </section>
    <section class="section" id="taxsettings">
      <h2>Taxes</h2>
      <label class="field" for="f-taxPct"><span>Set aside this % of profit for taxes</span><input id="f-taxPct" inputmode="numeric" data-bind="taxPct" data-type="int" value="${d.taxPct}"></label>
      <p class="fine">25–30% covers federal income and self-employment tax for many sole owners. Add a little if your state has an income tax.</p>
      <label class="field" for="f-mileageRate"><span>Mileage rate (cents per mile)</span><input id="f-mileageRate" inputmode="decimal" data-bind="mileageRate" data-type="num" value="${d.mileageRate}"></label>
      <p class="fine">The IRS business rate for 2026 is 72.5¢. It changes each January.</p>
      <div class="toggle-row"><span class="row-main"><span class="row-title">Charge sales tax on jewelry and aftercare</span><span class="row-sub">Added on top of product prices when you log a sale, and tracked separately. Services aren't taxed here.</span></span>
        <label class="switch"><input type="checkbox" data-bind="salesTax.enabled" data-rerender="1" ${d.salesTax.enabled ? 'checked' : ''} aria-label="Charge sales tax"><span></span></label></div>
      ${d.salesTax.enabled ? `<label class="field" for="f-strate"><span>Combined sales tax rate (%)</span><input id="f-strate" inputmode="decimal" data-bind="salesTax.rate" data-type="num" value="${d.salesTax.rate || ''}" placeholder="e.g. 8.81"></label>` : ''}
    </section>
    <section class="section">
      <h2>Security</h2>
      <div class="toggle-row"><span class="row-main"><span class="row-title">Lock with Face ID or fingerprint</span><span class="row-sub">${lockAvailable ? "Asks every time the app opens, and after it's been in the background a few minutes." : 'Available once the app is installed on the phone.'}</span></span>
        ${lockAvailable ? `<button type="button" class="btn small" data-act="${S.settings.lock.enabled ? 'lock-off' : 'lock-on'}">${S.settings.lock.enabled ? 'Turn off' : 'Turn on'}</button>` : ''}</div>
    </section>
    <section class="section" id="backup">
      <h2>Backup</h2>
      <p class="fine">${memoryOnly ? "Saving isn't working in this browser, so a backup is the only way to keep what you've entered." : `Your data lives only on this phone. A backup file includes everything, receipt photos too. Save it to iCloud Drive, Google Drive or email it to yourself.`}</p>
      <p class="row-sub">${lastB ? `Last backup: ${esc(fmtDateYear(lastB.slice(0, 10)))}` : 'No backup yet.'}</p>
      <div class="btn-row">
        <button type="button" class="btn primary" data-act="backup">Back up now</button>
        <label class="btn">Restore a backup<input type="file" accept=".json,application/json" data-file="restore"></label>
      </div>
    </section>
    <section class="section">
      <h2>Start over</h2>
      <div class="btn-row">
        ${S.meta.demo ? '<button type="button" class="btn" data-act="clear-demo">Clear sample numbers</button>' : '<button type="button" class="btn" data-act="load-demo">Add sample numbers</button>'}
        <button type="button" class="btn danger" data-act="erase">Erase everything</button>
      </div>
      <p class="fine">Studio Books ${VERSION}</p>
    </section>
  `, { footer: `<button type="button" class="btn primary" data-act="save-settings">Save settings</button>` });
}

const VIEWS = {
  today: viewToday, money: viewMoney, stock: viewStock, item: viewItem, sale: viewSale, expense: viewExpense,
  income: viewIncome, taxes: viewTaxes, trips: viewTrips, review: viewReview, import: viewImport, settings: viewSettings,
};
const FORM_VIEWS = new Set(['item', 'sale', 'expense', 'income', 'settings', 'import', 'trips']);

let receiptUrl = null;
function render() {
  hook = {};
  let html;
  const key = route.name + '/' + route.params.join('/');
  if (locked) html = viewLock();
  else if (!S.settings) html = viewWelcome();
  else {
    if (!FORM_VIEWS.has(route.name) && draftKey) resetDraft();
    const v = VIEWS[route.name] || viewToday;
    try { html = v(...route.params); }
    catch (e) { console.error(e); html = shell(`${subHead('Something went wrong')}<div class="empty">This screen hit a problem: ${esc(e.message)}. Your data is safe.</div>`); }
  }
  appEl.innerHTML = html;
  if (key !== lastRouteKey) {
    lastRouteKey = key;
    if (ui.scrollTo) { const t = document.getElementById(ui.scrollTo); ui.scrollTo = null; if (t) { t.scrollIntoView(); return afterRender(); } }
    window.scrollTo(0, 0);
    const af = appEl.querySelector('[autofocus]');
    if (af && !isTouch()) af.focus();
  }
  afterRender();
}
function afterRender() {
  const img = $('#receipt-img');
  if (img && draft) {
    if (draft._newReceipt) {
      if (receiptUrl) URL.revokeObjectURL(receiptUrl);
      receiptUrl = URL.createObjectURL(draft._newReceipt.blob);
      img.src = receiptUrl;
    } else if (draft.receiptId) {
      const want = draft.receiptId;
      getReceipt(want).then(r => {
        if (!r || !draft || draft.receiptId !== want || !img.isConnected) return;
        if (/pdf/.test(r.type)) { img.replaceWith(Object.assign(document.createElement('span'), { innerHTML: icon('file', 30) })); return; }
        if (receiptUrl) URL.revokeObjectURL(receiptUrl);
        receiptUrl = URL.createObjectURL(r.blob);
        img.src = receiptUrl;
      });
    } else img.replaceWith(Object.assign(document.createElement('span'), { innerHTML: icon('receipt', 30) }));
  }
}

/* =====================================================================
 * Actions
 * ===================================================================== */
const ACT = {};
ACT['go'] = el => go(el.dataset.to, { replace: !!el.dataset.replace });
ACT['tab'] = el => { resetDraft(); go(el.dataset.to, { replace: true }); };
ACT['back'] = el => back(el.dataset.to);
ACT['close-sheet'] = () => closeSheet();
ACT['confirm-ok'] = () => {
  if (sheetTyped) {
    const v = (($('#confirm-typed') || {}).value || '').trim().toUpperCase();
    if (v !== sheetTyped) { toast(`Type ${sheetTyped} to confirm`); return; }
  }
  const r = sheetResolve; sheetResolve = null; closeSheet(); if (r) r(true);
};
ACT['set-draft'] = el => { if (!draft) return; setBind(draft, el.dataset.bind, el.dataset.val); render(); };
ACT['step'] = el => {
  if (!draft) return;
  const v = Math.max(0, (parseInt(getBind(draft, el.dataset.bind), 10) || 0) + (+el.dataset.step));
  setBind(draft, el.dataset.bind, v);
  const input = $(`input[data-bind="${el.dataset.bind}"]`); if (input) input.value = v;
};
ACT['stock-filter'] = el => { ui.stockFilter = el.dataset.f; render(); };
ACT['stock-low'] = () => { ui.stockFilter = 'Low'; go('stock', { replace: false }); };
ACT['goto-backup'] = () => { ui.scrollTo = 'backup'; go('settings'); };
ACT['goto-budgets'] = () => { ui.scrollTo = 'budgets'; go('settings'); };
ACT['goto-taxsettings'] = () => { ui.scrollTo = 'taxsettings'; go('settings'); };

/* --- welcome & sample data --- */
ACT['start-fresh'] = async () => {
  await commit([kvPut('settings', defaultSettings()), kvPut('meta', { createdAt: new Date().toISOString() }), kvPut('rules', {})]);
  toast('Add your services and prices to get started');
  go('settings', { replace: true });
};
ACT['start-demo'] = async () => {
  await commit(buildDemo(true));
  go('today', { replace: true });
};
ACT['load-demo'] = async () => {
  const ok = await confirmSheet({ title: 'Add sample numbers?', body: 'Sample sales, expenses and stock are added alongside your own so you can see how things look. You can clear them later from here.', ok: 'Add samples' });
  if (!ok) return;
  await commit(buildDemo(false));
  resetDraft();
  go('today', { replace: true });
};
ACT['clear-demo'] = async () => {
  const ok = await confirmSheet({ title: 'Clear the sample numbers?', body: "All the sample sales, expenses, stock and drives are removed. Anything you entered yourself stays.", ok: 'Clear samples', danger: true });
  if (!ok) return;
  const ops = [];
  for (const s of LIST_STORES) for (const r of S[s]) if (r.demo) ops.push({ store: s, del: r.id });
  const meta = clone(S.meta); delete meta.demo;
  ops.push(kvPut('meta', meta));
  if (meta.demoSettings || S.meta.demoSettings) {
    const fresh = defaultSettings();
    fresh.lock = S.settings.lock;
    ops.push(kvPut('settings', fresh));
    delete meta.demoSettings;
  }
  await commit(ops);
  resetDraft();
  toast('Sample numbers cleared');
  go('today', { replace: true });
};
ACT['erase'] = async () => {
  const ok = await confirmSheet({ title: 'Erase everything?', body: 'Every sale, expense, stock item, receipt photo and setting on this phone is deleted. Make a backup first if you might want any of it.', ok: 'Erase everything', danger: true, typed: 'ERASE' });
  if (!ok) return;
  await wipeAll();
  resetDraft();
  locked = false;
  toast('Everything was erased');
  go('today', { replace: true });
};

/* --- sales --- */
ACT['sale-add-service'] = el => {
  const sv = S.settings.services.find(x => x.id === el.dataset.id);
  if (!sv || !draft) return;
  draft.lines.push({ kind: 'service', name: sv.name, price: sv.price || 0, qty: 1 });
  render();
  if (!sv.price) { const inputs = $$('.line-row input[data-type="money"]'); const last = inputs[inputs.length - 1]; if (last) last.focus(); }
};
ACT['sale-add-custom'] = () => {
  if (!draft) return;
  draft.lines.push({ kind: 'service', name: 'Service', price: 0, qty: 1 });
  render();
  const names = $$('.line-row input[aria-label="Service name"]'); const last = names[names.length - 1];
  if (last) { last.focus(); last.select(); }
};
ACT['sale-remove-line'] = el => { if (!draft) return; draft.lines.splice(+el.dataset.i, 1); render(); };
ACT['line-qty'] = el => {
  const l = draft && draft.lines[+el.dataset.i]; if (!l) return;
  l.qty = Math.max(1, (l.qty || 1) + (+el.dataset.step));
  render();
};
ACT['save-sale'] = async () => {
  const d = draft;
  if (!d) return;
  d.lines = d.lines.filter(l => l.kind === 'item' || (l.name || '').trim() || l.price);
  if (!d.lines.length && !d.tip) { toast('Add a service or an item first'); return; }
  if (d.lines.some(l => l.kind === 'service' && !(l.price > 0))) { toast('Enter a price for each service'); return; }
  if (!isValidISO(d.date)) { toast('Pick a date'); return; }
  const old = d.id ? S.sales.find(s => s.id === d.id) : null;
  d.salesTax = S.settings.salesTax.enabled ? computeSalesTax(d.lines) : (d.salesTax || 0);
  const rec = {
    id: d.id || uid(), date: d.date, client: (d.client || '').trim(), method: d.method, note: d.note || '',
    lines: d.lines.map(l => ({ kind: l.kind, name: (l.name || '').trim() || 'Service', price: l.price || 0, qty: l.qty || 1, ...(l.kind === 'item' ? { stockId: l.stockId, cat: l.cat, cost: l.cost || 0 } : {}) })),
    tip: d.tip || 0, salesTax: d.salesTax || 0,
    source: d.source || 'manual', extId: d.extId || null, demo: d.demo || false,
    created: d.created || Date.now(), updated: Date.now(),
  };
  const delta = {};
  if (old) for (const l of old.lines) if (l.kind === 'item' && l.stockId) delta[l.stockId] = (delta[l.stockId] || 0) + (l.qty || 1);
  for (const l of rec.lines) if (l.kind === 'item' && l.stockId) delta[l.stockId] = (delta[l.stockId] || 0) - (l.qty || 1);
  const ops = [{ store: 'sales', put: rec }];
  for (const [sid, dq] of Object.entries(delta)) {
    if (!dq) continue;
    const it = S.stock.find(x => x.id === sid);
    if (it) ops.push({ store: 'stock', put: Object.assign({}, it, { qty: (it.qty || 0) + dq }) });
  }
  if (S.settings.lastMethod !== rec.method) { const s = clone(S.settings); s.lastMethod = rec.method; ops.push(kvPut('settings', s)); }
  await commit(ops);
  toast(old ? 'Sale updated' : `Sale saved · ${money(saleTotals(rec).total)}`);
  back('today');
};
ACT['delete-sale'] = async () => {
  const s = S.sales.find(x => x.id === draft.id); if (!s) return;
  const ok = await confirmSheet({ title: 'Delete this sale?', body: 'Any jewelry on it goes back into stock.', ok: 'Delete', danger: true });
  if (!ok) return;
  const ops = [{ store: 'sales', del: s.id }];
  const delta = {};
  for (const l of s.lines) if (l.kind === 'item' && l.stockId) delta[l.stockId] = (delta[l.stockId] || 0) + (l.qty || 1);
  for (const [sid, dq] of Object.entries(delta)) { const it = S.stock.find(x => x.id === sid); if (it) ops.push({ store: 'stock', put: Object.assign({}, it, { qty: (it.qty || 0) + dq }) }); }
  await commit(ops);
  toast('Sale deleted');
  back('today');
};

/* --- stock picker (sales & expenses) --- */
let pickerMode = 'sale';
ACT['pick-stock'] = el => {
  pickerMode = el.dataset.mode;
  const items = S.stock.filter(i => pickerMode === 'expense' || i.cat !== 'Supplies' || i.price > 0).sort((a, b) => a.name.localeCompare(b.name));
  openSheet(`
    <div class="sheet-head"><h2 class="sheet-title">${pickerMode === 'sale' ? 'Add from stock' : 'Add to stock'}</h2><button type="button" class="icon-btn plain" data-act="close-sheet" aria-label="Close">${icon('close', 20)}</button></div>
    <label class="field" for="pick-search"><span class="sr-only">Search</span><input id="pick-search" type="search" placeholder="Search or type a new item" data-filter="#pick-list" autocomplete="off"></label>
    <div class="list" id="pick-list">
      ${items.map(i => `<button type="button" class="row-btn" data-act="pick-item" data-id="${esc(i.id)}" data-text="${esc(i.name.toLowerCase())}" style="background:var(--surface-2)">
        <span class="row-main"><span class="row-title">${esc(i.name)}</span><span class="row-sub">${esc(i.cat)} · ${i.qty || 0} on hand</span></span>
        <span class="amt">${pickerMode === 'sale' ? money(i.price) : money(i.cost)}</span></button>`).join('')}
    </div>
    <button type="button" class="chip add" data-act="pick-new" id="pick-new" hidden>${icon('plus', 16)}<span>Add new item</span></button>
    ${items.length ? '' : '<p class="fine">Nothing in stock yet. Type a name above to add one.</p>'}
  `, 'Pick an item');
};
ACT['pick-item'] = el => {
  const it = S.stock.find(i => i.id === el.dataset.id);
  if (!it || !draft) return;
  addPicked(it);
};
function addPicked(it) {
  if (pickerMode === 'sale') {
    const ex = draft.lines.find(l => l.kind === 'item' && l.stockId === it.id);
    if (ex) ex.qty = (ex.qty || 1) + 1;
    else draft.lines.push({ kind: 'item', stockId: it.id, name: it.name, cat: it.cat, price: it.price || 0, cost: it.cost || 0, qty: 1 });
  } else {
    draft.stockAdds = draft.stockAdds || [];
    const ex = draft.stockAdds.find(a => a.stockId === it.id);
    if (ex) ex.qty += 1; else draft.stockAdds.push({ stockId: it.id, name: it.name, qty: 1 });
  }
  closeSheet();
  render();
}
ACT['pick-new'] = async () => {
  const name = (($('#pick-search') || {}).value || '').trim();
  if (!name) return;
  const cat = draft && draft.category === 'supplies' ? 'Supplies' : /aftercare|saline|spray|soap/i.test(name) ? 'Aftercare' : 'Jewelry';
  const it = { id: uid(), name, cat, qty: 0, cost: 0, price: 0, lowAt: 2, created: Date.now() };
  await commit([{ store: 'stock', put: it }]);
  toast('Added to stock. Set its cost and price on the Stock tab.');
  addPicked(it);
};

/* --- stock items --- */
ACT['save-item'] = async () => {
  const d = draft; if (!d) return;
  if (!(d.name || '').trim()) { toast('Give the item a name'); return; }
  const rec = { id: d.id || uid(), name: d.name.trim(), cat: d.cat, qty: d.qty || 0, cost: d.cost || 0, price: d.price || 0, lowAt: d.lowAt || 0, demo: d.demo || false, created: d.created || Date.now(), updated: Date.now() };
  await commit([{ store: 'stock', put: rec }]);
  toast('Item saved');
  back('stock');
};
ACT['delete-item'] = async () => {
  const ok = await confirmSheet({ title: 'Delete this item?', body: 'Past sales keep their details. It just leaves your stock list.', ok: 'Delete', danger: true });
  if (!ok) return;
  await commit([{ store: 'stock', del: draft.id }]);
  toast('Item deleted');
  back('stock');
};
ACT['reorder-list'] = async () => {
  const sold = soldLast30();
  const lows = lowStock(sold);
  const text = lows.map(i => {
    const st = stockStatus(i, sold);
    const want = Math.max((i.lowAt || 0) * 2, Math.ceil(st.s30 * 2)) - (i.qty || 0);
    return `${i.name}: have ${i.qty || 0}, order about ${Math.max(1, want)}`;
  }).join('\n');
  openSheet(`
    <div class="sheet-head"><h2 class="sheet-title">Reorder list</h2><button type="button" class="icon-btn plain" data-act="close-sheet" aria-label="Close">${icon('close', 20)}</button></div>
    <p class="sheet-body">Suggested amounts cover about two months at your recent pace.</p>
    <pre id="reorder-text">${esc(text)}</pre>
    <button type="button" class="btn primary" data-act="copy-reorder">Copy list</button>`, 'Reorder list');
};
ACT['copy-reorder'] = async () => {
  const text = ($('#reorder-text') || {}).textContent || '';
  try { await navigator.clipboard.writeText(text); toast('Copied'); }
  catch (e) {
    const r = document.createRange(); r.selectNodeContents($('#reorder-text'));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    toast('Selected. Copy it from the menu.');
  }
};

/* --- expenses --- */
ACT['add-qty'] = el => { const a = draft.stockAdds[+el.dataset.i]; if (!a) return; a.qty = Math.max(1, a.qty + (+el.dataset.step)); render(); };
ACT['remove-add'] = el => { draft.stockAdds.splice(+el.dataset.i, 1); render(); };
ACT['remove-receipt'] = () => { draft._newReceipt = null; draft._removeReceipt = draft.receiptId || draft._removeReceipt || null; draft.receiptId = null; draft.receiptDemo = false; ui.ocr = null; render(); };
ACT['view-receipt'] = async () => {
  let blob = draft._newReceipt ? draft._newReceipt.blob : null, type = draft._newReceipt ? draft._newReceipt.type : '';
  if (!blob && draft.receiptId) { const r = await getReceipt(draft.receiptId); if (r) { blob = r.blob; type = r.type; } }
  if (!blob) { toast('This sample has no photo.'); return; }
  const url = URL.createObjectURL(blob);
  openSheet(`<div class="sheet-head"><h2 class="sheet-title">Receipt</h2><button type="button" class="icon-btn plain" data-act="close-sheet" aria-label="Close">${icon('close', 20)}</button></div>
    ${/pdf/.test(type) ? `<a class="btn primary" href="${url}" target="_blank" rel="noopener">Open the PDF</a>` : `<img class="full" src="${url}" alt="Receipt">`}`, 'Receipt');
};
ACT['save-expense'] = async () => {
  const d = draft; if (!d) return;
  if (!(d.amount > 0)) { toast('Enter the amount'); return; }
  if (!isValidISO(d.date)) { toast('Pick a date'); return; }
  const old = d.id ? S.expenses.find(e => e.id === d.id) : null;
  const ops = [];
  let receiptId = d.receiptId || null;
  if (d._newReceipt) {
    receiptId = uid();
    ops.push({ store: 'receipts', put: { id: receiptId, blob: d._newReceipt.blob, type: d._newReceipt.type, name: d._newReceipt.name || 'receipt', created: Date.now() } });
    if (old && old.receiptId) ops.push({ store: 'receipts', del: old.receiptId });
  } else if (d._removeReceipt) ops.push({ store: 'receipts', del: d._removeReceipt });
  const rec = {
    id: d.id || uid(), date: d.date, vendor: (d.vendor || '').trim(), amount: d.amount, category: d.category || 'uncategorized',
    note: d.note || '', receiptId, receiptDemo: !!(d.receiptDemo && !receiptId && !d._removeReceipt),
    stockAdds: (d.stockAdds || []).filter(a => a.qty > 0).map(a => ({ stockId: a.stockId, name: a.name, qty: a.qty })),
    source: d.source || 'manual', extId: d.extId || null, recurringId: d.recurringId || null, demo: d.demo || false,
    needsReview: false, created: d.created || Date.now(), updated: Date.now(),
  };
  ops.unshift({ store: 'expenses', put: rec });
  const delta = {};
  if (old) for (const a of old.stockAdds || []) delta[a.stockId] = (delta[a.stockId] || 0) - a.qty;
  for (const a of rec.stockAdds) delta[a.stockId] = (delta[a.stockId] || 0) + a.qty;
  for (const [sid, dq] of Object.entries(delta)) { if (!dq) continue; const it = S.stock.find(x => x.id === sid); if (it) ops.push({ store: 'stock', put: Object.assign({}, it, { qty: (it.qty || 0) + dq }) }); }
  const key = vendorKey(rec.vendor);
  if (key && rec.category !== 'uncategorized' && S.rules[key] !== rec.category) { const rules = Object.assign({}, S.rules, { [key]: rec.category }); ops.push(kvPut('rules', rules)); }
  await commit(ops);
  toast(old ? 'Expense updated' : `Expense saved · ${money(rec.amount)}`);
  back('money');
};
ACT['delete-expense'] = async () => {
  const e = S.expenses.find(x => x.id === draft.id); if (!e) return;
  const ok = await confirmSheet({ title: 'Delete this expense?', body: (e.stockAdds || []).length ? 'Items it added to stock are taken back out.' : 'Its receipt photo is deleted too.', ok: 'Delete', danger: true });
  if (!ok) return;
  const ops = [{ store: 'expenses', del: e.id }];
  if (e.receiptId) ops.push({ store: 'receipts', del: e.receiptId });
  for (const a of e.stockAdds || []) { const it = S.stock.find(x => x.id === a.stockId); if (it) ops.push({ store: 'stock', put: Object.assign({}, it, { qty: (it.qty || 0) - a.qty }) }); }
  await commit(ops);
  toast('Expense deleted');
  back('money');
};

/* --- income & apprentice --- */
ACT['appr-received'] = async () => {
  const a = S.settings.apprentice;
  const st = apprenticeStatus(monthKey(today()));
  const amt = st ? Math.max(0, st.rent - st.received) : a.rent;
  await commit([{ store: 'income', put: { id: uid(), date: today(), category: 'apprentice-rent', amount: amt, method: 'Venmo', note: `${monthName(monthKey(today()))} rent`, source: 'manual', created: Date.now() } }]);
  toast(`${money(amt)} rent logged`);
  render();
};
ACT['save-income'] = async () => {
  const d = draft; if (!d) return;
  if (!(d.amount > 0)) { toast('Enter the amount'); return; }
  if (!isValidISO(d.date)) { toast('Pick a date'); return; }
  const rec = { id: d.id || uid(), date: d.date, category: d.category, amount: d.amount, method: d.method, note: d.note || '', source: d.source || 'manual', extId: d.extId || null, demo: d.demo || false, created: d.created || Date.now(), updated: Date.now() };
  await commit([{ store: 'income', put: rec }]);
  toast('Saved');
  back('money');
};
ACT['delete-income'] = async () => {
  const ok = await confirmSheet({ title: 'Delete this income?', ok: 'Delete', danger: true });
  if (!ok) return;
  await commit([{ store: 'income', del: draft.id }]);
  toast('Deleted');
  back('money');
};

/* --- mileage --- */
ACT['save-trip'] = async () => {
  const d = draft; if (!d) return;
  const miles = Math.round((+d.miles || 0) * 10) / 10;
  if (!(miles > 0)) { toast('Enter the miles'); return; }
  if (!isValidISO(d.date)) { toast('Pick a date'); return; }
  await commit([{ store: 'trips', put: { id: uid(), date: d.date, miles, purpose: (d.purpose || '').trim(), created: Date.now() } }]);
  toast(`${miles} miles logged`);
  draft = { date: d.date, miles: '', purpose: '' };
  render();
};
ACT['delete-trip'] = async el => {
  const ok = await confirmSheet({ title: 'Delete this drive?', ok: 'Delete', danger: true });
  if (!ok) return;
  await commit([{ store: 'trips', del: el.dataset.id }]);
  render();
};

/* --- taxes --- */
ACT['log-tax-payment'] = el => {
  const y = el.dataset.year;
  const nd = nextDue(y);
  const t = taxSummary(y);
  const suggested = Math.max(0, t.setAside - t.paid);
  openSheet(`
    <div class="sheet-head"><h2 class="sheet-title">Log an estimated payment</h2><button type="button" class="icon-btn plain" data-act="close-sheet" aria-label="Close">${icon('close', 20)}</button></div>
    <div class="grid2">
      <label class="field" for="tp-q"><span>For</span><select id="tp-q">${[1, 2, 3, 4].map(q => `<option value="${q}"${nd && nd.q === q ? ' selected' : ''}>Q${q} ${esc(y)}</option>`).join('')}</select></label>
      <label class="field" for="tp-date"><span>Paid on</span><input id="tp-date" type="date" value="${today()}"></label>
    </div>
    <label class="field" for="tp-amt"><span>Amount</span><div class="money-in"><input id="tp-amt" inputmode="decimal" value="${esc(centsToInput(suggested))}" placeholder="0.00"></div></label>
    <p class="fine">Filled in with what's still to set aside. Change it to what you actually paid.</p>
    <button type="button" class="btn primary" data-act="save-tax-payment" data-year="${esc(y)}">Save payment</button>`, 'Log an estimated payment');
};
ACT['save-tax-payment'] = async el => {
  const amount = Math.abs(toCents($('#tp-amt').value));
  const date = $('#tp-date').value;
  if (!(amount > 0)) { toast('Enter the amount'); return; }
  if (!isValidISO(date)) { toast('Pick a date'); return; }
  await commit([{ store: 'taxPayments', put: { id: uid(), year: el.dataset.year, quarter: +$('#tp-q').value, date, amount, created: Date.now() } }]);
  closeSheet();
  toast('Payment logged');
  render();
};
ACT['delete-tax-payment'] = async el => {
  const ok = await confirmSheet({ title: 'Delete this payment?', ok: 'Delete', danger: true });
  if (!ok) return;
  await commit([{ store: 'taxPayments', del: el.dataset.id }]);
  render();
};
ACT['export-summary'] = el => exportSummary(el.dataset.year);
ACT['export-txns'] = el => exportTransactions(el.dataset.year);

/* --- import --- */
ACT['import-cancel'] = () => { resetDraft(); back('money'); };
ACT['import-commit'] = async () => {
  const d = draft; if (!d || !d.rows) return;
  const ops = [];
  const meta = clone(S.meta);
  meta.seenExt = meta.seenExt || {};
  meta.skippedExt = meta.skippedExt || {};
  const rules = Object.assign({}, S.rules);
  let n = 0;
  const now = Date.now();
  for (const r of d.rows) {
    if (!r.on || r.as === 'skip') { meta.skippedExt[r.extId] = 1; continue; }
    meta.seenExt[r.extId] = 1;
    delete meta.skippedExt[r.extId];
    n++;
    const src = d.source;
    if (r.dir === 'in') {
      if (r.as.startsWith('match:')) {
        const s = S.sales.find(x => x.id === r.as.slice(6));
        if (s) ops.push({ store: 'sales', put: Object.assign({}, s, { extId: r.extId }) });
      } else if (r.as === 'sale') {
        ops.push({ store: 'sales', put: { id: uid(), date: r.date, client: r.who, method: src === 'venmo' ? 'Venmo' : 'Other', note: r.note, lines: [{ kind: 'service', name: r.note ? r.note.slice(0, 40) : 'Venmo payment', price: r.amount, qty: 1 }], tip: 0, salesTax: 0, source: src, extId: r.extId, needsReview: true, created: now } });
      } else {
        ops.push({ store: 'income', put: { id: uid(), date: r.date, category: r.as === 'apprentice-rent' ? 'apprentice-rent' : 'other', amount: r.amount, method: src === 'venmo' ? 'Venmo' : 'Other', note: r.note || r.who, source: src, extId: r.extId, created: now } });
      }
    } else {
      ops.push({ store: 'expenses', put: { id: uid(), date: r.date, vendor: r.who, amount: r.amount, category: r.as, note: r.note && r.note !== r.who ? r.note : '', source: src, extId: r.extId, needsReview: r.as === 'uncategorized', created: now } });
      const key = vendorKey(r.who);
      if (key && r.as !== 'uncategorized') rules[key] = r.as;
    }
    if (r.fee) {
      ops.push({ store: 'expenses', put: { id: uid(), date: r.date, vendor: 'Venmo', amount: r.fee, category: 'fees', note: `Fee on ${r.who || 'payment'}`, source: src, extId: r.extId + ':fee', created: now } });
    }
  }
  ops.push(kvPut('meta', meta), kvPut('rules', rules));
  await commit(ops);
  toast(`Imported ${plural(n, 'item')}`);
  back('money');
};

/* --- settings --- */
ACT['settings-add-service'] = () => { draft.services.push({ id: uid(), name: '', price: 0 }); render(); const ins = $$('input[id^="sv-n-"]'); if (ins.length) ins[ins.length - 1].focus(); };
ACT['settings-add-recurring'] = () => { draft.recurring.push({ id: uid(), name: '', amount: 0, category: 'rent', day: 1, startMonth: monthKey(today()) }); render(); };
ACT['settings-remove'] = el => { draft[el.dataset.list].splice(+el.dataset.i, 1); render(); };
ACT['save-settings'] = async () => {
  const d = clone(draft);
  d.services = d.services.filter(s => (s.name || '').trim()).map(s => Object.assign(s, { name: s.name.trim() }));
  d.recurring = d.recurring.filter(r => (r.name || '').trim() && r.amount > 0).map(r => Object.assign(r, { name: r.name.trim(), day: Math.min(28, Math.max(1, r.day || 1)) }));
  d.apprentice.dueDay = Math.min(28, Math.max(1, d.apprentice.dueDay || 1));
  d.taxPct = Math.min(60, Math.max(0, d.taxPct || 0));
  d.salesTax.rate = Math.min(20, Math.max(0, d.salesTax.rate || 0));
  d.mileageRate = Math.max(0, d.mileageRate || 0);
  for (const k of Object.keys(d.budgets)) if (!d.budgets[k]) delete d.budgets[k];
  d.lock = S.settings.lock; // managed by its own buttons
  await commit([kvPut('settings', d)]);
  resetDraft();
  toast('Settings saved');
  await runRecurring();
  back('today');
};
ACT['lock-on'] = () => enableLock();
ACT['lock-off'] = () => disableLock();
ACT['unlock'] = () => tryUnlock();
ACT['lock-help'] = async () => {
  const ok = await confirmSheet({
    title: "Can't unlock?",
    body: "If Face ID or your fingerprint keeps failing, try your phone's passcode when it offers it. As a last resort you can erase the app's data on this phone and restore your latest backup file.",
    ok: 'Erase and start over', danger: true, typed: 'ERASE',
  });
  if (!ok) return;
  await wipeAll();
  locked = false;
  toast('Erased. Restore your backup from Settings.');
  go('today', { replace: true });
};
ACT['backup'] = () => exportBackup();

/* =====================================================================
 * Input, change and file handling
 * ===================================================================== */
/* A field's "change" fires when it loses focus, which happens the moment a
 * finger lands on a button. Redrawing the screen right then would remove that
 * button before its tap registers, so redraws wait until the finger lifts. */
let pointerIsDown = false;
let pendingRender = false;
document.addEventListener('pointerdown', () => { pointerIsDown = true; }, true);
document.addEventListener('pointerup', () => {
  pointerIsDown = false;
  if (pendingRender) setTimeout(() => { if (pendingRender) { pendingRender = false; render(); } }, 60);
}, true);
document.addEventListener('pointercancel', () => { pointerIsDown = false; }, true);
function safeRender() { if (pointerIsDown) pendingRender = true; else { pendingRender = false; render(); } }

document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (!fn) return;
  ev.preventDefault();
  try { await fn(el, ev); }
  catch (e) { console.error(e); if (!e || !e._toasted) toast('Something went wrong. Please try again.', 'error'); }
});
document.addEventListener('input', ev => {
  const el = ev.target;
  if (el.dataset && el.dataset.bind && draft && !el.closest('.sheet')) {
    setBind(draft, el.dataset.bind, readInput(el));
    if (hook.onInput) hook.onInput(el);
  }
  if (el.dataset && el.dataset.filter) {
    const q = el.value.trim().toLowerCase();
    $$(`${el.dataset.filter} [data-text]`).forEach(r => { r.hidden = q && !r.dataset.text.includes(q); });
    const pn = $('#pick-new');
    if (pn && el.id === 'pick-search') {
      const exact = S.stock.some(i => i.name.toLowerCase() === q);
      pn.hidden = !q || exact;
      pn.querySelector('span').textContent = `Add “${el.value.trim()}” as a new item`;
    }
  }
});
document.addEventListener('change', async ev => {
  const el = ev.target;
  if (el.dataset && el.dataset.rerender && draft) {
    if (el.dataset.bind) setBind(draft, el.dataset.bind, readInput(el));
    safeRender();
  }
  if (el.dataset && el.dataset.file) {
    const file = el.files && el.files[0];
    el.value = '';
    if (file) {
      try { await handleFile(el.dataset.file, file); }
      catch (e) { console.error(e); toast(e.message || "Couldn't open that file."); }
    }
  }
  if (el.dataset && el.dataset.saveSetting === 'beginInventory') {
    const s = clone(S.settings);
    s.beginInventory[el.dataset.year] = Math.abs(toCents(el.value));
    await commit([kvPut('settings', s)]);
    toast('Saved');
    safeRender();
  }
});
async function handleFile(kind, file) {
  if (kind === 'receipt') {
    if (!draft) return;
    const isImage = /^image\//.test(file.type) || /\.(jpe?g|png|heic|webp)$/i.test(file.name);
    const isPdf = /pdf/.test(file.type) || /\.pdf$/i.test(file.name);
    if (!isImage && !isPdf) { toast('Choose a photo or a PDF.'); return; }
    if (file.size > 25 * 1024 * 1024) { toast('That file is too big. Try a photo instead.'); return; }
    const blob = isImage ? await compressImage(file) : file;
    draft._newReceipt = { blob, type: isImage ? (blob.type || 'image/jpeg') : 'application/pdf', name: file.name };
    draft.receiptDemo = false;
    if (isImage) runOCR(draft, blob); else { ui.ocr = null; render(); }
    return;
  }
  if (kind === 'import') {
    if (file.size > 10 * 1024 * 1024) { toast('That file is too big to be a statement.'); return; }
    const text = await file.text();
    const res = buildImport(text);
    draft = res; draftKey = 'import';
    render();
    return;
  }
  if (kind === 'restore') { await restoreBackup(file); }
}
async function runOCR(d, blob) {
  ui.ocr = 'reading';
  render();
  const key = draftKey;
  try {
    const text = await readReceiptText(blob);
    if (draftKey !== key || draft !== d) return;
    const r = parseReceipt(text);
    let filled = false;
    if (r.total && !d.amount) { d.amount = r.total; filled = true; }
    if (r.vendor && !d.vendor) { d.vendor = r.vendor; filled = true; if (!d._catTouched) { const g = guessCategory(r.vendor + ' ' + text.slice(0, 400)); if (g) d.category = g; } }
    if (r.date && d.date === today() && r.date !== d.date) { d.date = r.date; filled = true; }
    ui.ocr = filled ? 'done' : 'failed';
  } catch (e) {
    console.warn('Receipt reading failed', e);
    if (draftKey !== key) return;
    ui.ocr = 'failed';
  }
  render();
}

/* =====================================================================
 * Sample data (clearly marked, removable)
 * ===================================================================== */
function buildDemo(withSettings) {
  let seed = 20261015;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const now = today(), y = now.slice(0, 4), cur = monthKey(now);
  const ops = [];
  const put = (store, rec) => ops.push({ store, put: Object.assign(rec, { demo: true, created: rec.created || Date.now() }) });

  const stock = [
    ['Titanium labret 16g · 6mm', 'Jewelry', 1400, 5500, 2, 3],
    ['Threadless top, CZ 3mm', 'Jewelry', 900, 3500, 14, 4],
    ['Clicker ring 16g · 8mm', 'Jewelry', 1800, 6000, 5, 2],
    ['Curved barbell 14g', 'Jewelry', 1100, 4000, 8, 3],
    ['14k gold flat-back top', 'Jewelry', 4200, 12000, 3, 1],
    ['Septum clicker 16g · 10mm', 'Jewelry', 2200, 7000, 4, 2],
    ['Saline aftercare spray', 'Aftercare', 400, 1500, 9, 4],
    ['14g piercing needles (box of 100)', 'Supplies', 3200, 0, 1, 1],
    ['Nitrile gloves, medium (box)', 'Supplies', 1400, 0, 1, 2],
    ['Sterilization pouches (box)', 'Supplies', 1800, 0, 3, 1],
  ].map(([name, cat, cost, price, qty, lowAt]) => ({ id: uid(), name, cat, cost, price, qty, lowAt }));
  stock.forEach(s => put('stock', s));
  const jewelry = stock.filter(s => s.cat === 'Jewelry');
  const aftercare = stock.find(s => s.cat === 'Aftercare');

  const svc = [['Lobe', 3500], ['Nostril', 4500], ['Helix', 4500], ['Septum', 5000], ['Navel', 5000], ['Tragus', 4500], ['Industrial', 6500], ['Downsize', 2000], ['Jewelry change', 1000]];
  const methods = ['Venmo', 'Venmo', 'Venmo', 'Venmo', 'Cash', 'Cash', 'Gift card'];
  const clients = ['Maya', 'Alex', 'Jordan', 'Priya', 'Sam', 'Riley', 'Dani', 'Chris', 'Lena', 'Taylor', 'Noor', 'Kai'];
  const months = [];
  for (let m = `${y}-01`; m <= cur; m = addMonths(m, 1)) months.push(m);
  for (const m of months) {
    const lastDay = m === cur ? +now.slice(8, 10) : daysInMonth(m);
    const nSales = Math.round(lastDay * (0.75 + rnd() * 0.35));
    for (let k = 0; k < nSales; k++) {
      const date = `${m}-${pad(1 + Math.floor(rnd() * lastDay))}`;
      const [name, price] = pick(svc);
      const lines = [{ kind: 'service', name, price, qty: 1 }];
      if (!['Downsize', 'Jewelry change'].includes(name) || rnd() < 0.5) {
        if (rnd() < 0.75) { const j = pick(jewelry); lines.push({ kind: 'item', stockId: j.id, name: j.name, cat: j.cat, price: j.price, cost: j.cost, qty: 1 }); }
      }
      if (rnd() < 0.25) lines.push({ kind: 'item', stockId: aftercare.id, name: aftercare.name, cat: 'Aftercare', price: aftercare.price, cost: aftercare.cost, qty: 1 });
      if (rnd() < 0.08) lines[0] = { kind: 'service', name: 'Tattoo', price: 15000 + Math.floor(rnd() * 20) * 1000, qty: 1 };
      put('sales', { id: uid(), date, client: pick(clients), method: pick(methods), note: '', lines, tip: rnd() < 0.55 ? (5 + Math.floor(rnd() * 4) * 5) * 100 : 0, salesTax: 0, source: 'manual' });
    }
    const md = d => `${m}-${pad(Math.min(d, lastDay))}`;
    const ok = d => m !== cur || d <= lastDay;
    if (ok(1)) put('expenses', { id: uid(), date: md(1), vendor: 'Studio rent', amount: 120000, category: 'rent', note: '', receiptDemo: true });
    if (ok(3)) put('income', { id: uid(), date: md(3), category: 'apprentice-rent', amount: 40000, method: 'Venmo', note: `${monthName(m)} rent` });
    if (ok(9)) put('expenses', { id: uid(), date: md(9), vendor: 'Body jewelry wholesale', amount: 18000 + Math.floor(rnd() * 14) * 1000, category: 'inventory', note: '', receiptDemo: true });
    if (ok(12)) put('expenses', { id: uid(), date: md(12), vendor: 'Medical supply order', amount: 6000 + Math.floor(rnd() * 8) * 700, category: 'supplies', note: '', receiptDemo: m !== cur });
    if (ok(14)) put('expenses', { id: uid(), date: md(14), vendor: 'Booking software', amount: 2900, category: 'software', note: '', receiptDemo: true });
    if (ok(20)) put('expenses', { id: uid(), date: md(20), vendor: 'Instagram ads', amount: 3000 + Math.floor(rnd() * 4) * 500, category: 'marketing', note: '', receiptDemo: m !== cur });
    if (ok(22)) put('expenses', { id: uid(), date: md(22), vendor: 'Xcel Energy', amount: 8500 + Math.floor(rnd() * 30) * 100, category: 'utilities', note: '', receiptDemo: true });
    if (ok(18) && rnd() < 0.5) put('trips', { id: uid(), date: md(18), miles: 14 + Math.floor(rnd() * 20), purpose: 'Supply run' });
  }
  put('expenses', { id: uid(), date: `${y}-02-06`, vendor: 'Liability insurance', amount: 64000, category: 'insurance', note: 'Yearly policy', receiptDemo: true });
  put('expenses', { id: uid(), date: `${y}-03-15`, vendor: 'Autoclave service', amount: 21000, category: 'repairs', note: '', receiptDemo: true });
  put('expenses', { id: uid(), date: `${y}-05-02`, vendor: 'Body art license renewal', amount: 15000, category: 'licenses', note: '', receiptDemo: true });
  put('expenses', { id: uid(), date: addDays(now, -2), vendor: 'AMZN Mktp US', amount: 4387, category: 'uncategorized', note: 'From a bank import', source: 'bank', needsReview: true });
  put('sales', { id: uid(), date: addDays(now, -1), client: 'Venmo: Casey L.', method: 'Venmo', note: 'nose', lines: [{ kind: 'service', name: 'nose', price: 9500, qty: 1 }], tip: 0, salesTax: 0, source: 'venmo', needsReview: true });
  // Estimated tax payments for the quarters already due
  const quarters = [[1, `${y}-04-15`, `${y}-01-01`, `${y}-03-31`], [2, `${y}-06-15`, `${y}-04-01`, `${y}-05-31`], [3, `${y}-09-15`, `${y}-06-01`, `${y}-08-31`]];
  for (const [q, due, from, to] of quarters) {
    if (due > now) continue;
    // a rough 25% of the period's money in minus money out, rounded to $10
    let inn = 0, out = 0;
    for (const o of ops) {
      const r = o.put; if (!r || !r.date || r.date < from || r.date > to) continue;
      if (o.store === 'sales') inn += saleTotals(r).income;
      else if (o.store === 'income') inn += r.amount;
      else if (o.store === 'expenses' && r.category !== 'uncategorized') out += r.amount;
    }
    const amt = Math.max(0, Math.round((inn - out) * 0.22 / 1000) * 1000);
    if (amt) put('taxPayments', { id: uid(), year: y, quarter: q, date: shiftWeekend(due), amount: amt });
  }
  const meta = clone(S.meta || {});
  meta.demo = true;
  if (withSettings) meta.demoSettings = true;
  if (!meta.createdAt) meta.createdAt = new Date().toISOString();
  ops.push(kvPut('meta', meta));
  if (withSettings || !S.settings) {
    const s = defaultSettings();
    s.services = svc.map(([name, price]) => ({ id: uid(), name, price })).concat([{ id: uid(), name: 'Tattoo', price: 0 }]);
    s.apprentice = { enabled: true, name: 'Jordan', rent: 40000, dueDay: 3 };
    s.budgets = { rent: 120000, inventory: 30000, supplies: 10000, marketing: 5000, software: 3000 };
    s.beginInventory = { [y]: 31000 };
    if (S.settings) s.lock = S.settings.lock;
    ops.push(kvPut('settings', s));
  }
  if (!S.rules) ops.push(kvPut('rules', {}));
  return ops;
}

/* =====================================================================
 * Startup
 * ===================================================================== */
let lockAvailable = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (S.settings && S.settings.lock.enabled && hiddenAt && Date.now() - hiddenAt > 3 * 60 * 1000) { locked = true; closeSheet(); render(); }
  // A new day may have started while the app sat in the background.
  if (S.settings && !locked) runRecurring();
});

async function start() {
  try { await loadAll(); }
  catch (e) { console.error(e); memoryOnly = true; idb = null; }
  lockAvailable = await lockSupported();
  if (S.settings && S.settings.lock.enabled && S.settings.lock.credId && lockAvailable) locked = true;
  const initial = location.hash && location.hash.startsWith('#/') ? location.hash : '#/today';
  navStack.push(initial);
  route = parseRoute(initial);
  try { history.replaceState(null, '', initial); } catch (e) { historyOK = false; }
  render();
  if (S.settings && !locked) await runRecurring();
  if (locked) tryUnlock(true);
  if ('serviceWorker' in navigator && window.top === window.self && /^https:|^http:\/\/localhost|^http:\/\/127\./.test(location.href) && !window.__STUDIO_PREVIEW__) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('Offline support unavailable', e));
  }
}

// Exposed for automated tests only.
window.__studio = { S, toCents, money, parseCSV, parseReceipt, parseVenmo, parseBank, taxSummary, saleTotals, periodSummary, dueDates, vendorKey };

start();
})();
