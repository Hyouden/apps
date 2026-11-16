// Deck Diff: pull Riftbound tournament decklists from TopDeck.gg (https://topdeck.gg/api/docs)
// into deck-diff/topdeck.json, which the app loads next to decks.json.
// Runs in GitHub Actions. The key comes from the TOPDECK_API_KEY repository secret
// and is never printed or saved. TopDeck.gg asks for a visible credit; the app shows one.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const OUT = "deck-diff/topdeck.json", STATUS = "deck-diff/topdeck-status.json";
const WINDOW_DAYS = 45;      // how far back each run asks for
const KEEP_DAYS = 150;       // events older than this are dropped from the file
const MIN_DECKS = 8;         // skip events with fewer public lists than this
const key = (process.env.TOPDECK_API_KEY || "").trim();
const status = { ran: new Date().toISOString(), ok: false };
const finish = code => { writeFileSync(STATUS, JSON.stringify(status, null, 1) + "\n"); process.exit(code || 0); };

export function convert(tournaments, prev, now = Date.now()) {
  const cards = [], cardIx = new Map();
  const ix = name => { let i = cardIx.get(name); if (i === undefined) { i = cards.length; cards.push(name); cardIx.set(name, i); } return i; };
  const slug = s => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "player";
  const zone = z => { const out = []; if (z && typeof z === "object") for (const [name, v] of Object.entries(z)) { const n = v && Number(v.count); if (name && n > 0 && n < 100) out.push(ix(name.trim()), n); } return out; };
  const first = z => (z && typeof z === "object" && Object.keys(z)[0]) || "";
  const total = a => { let s = 0; for (let i = 1; i < a.length; i += 2) s += a[i]; return s; };
  const events = [], decks = [];
  for (const t of tournaments) {
    if (!t || !t.TID || !Array.isArray(t.standings)) continue;
    const eid = "td-" + t.TID, seen = new Set(), mine = [];
    t.standings.forEach((p, i) => {
      const o = p && p.deckObj; if (!o || typeof o !== "object") return;
      const m = zone(o.Mainboard), champion = first(o.Champion), legend = first(o.Legend);
      if (!legend || total(m) + (champion ? 1 : 0) < 30) return;
      let id = eid + "-" + slug(p.name || "player"); if (seen.has(id)) id += "-" + (i + 1); seen.add(id);
      mine.push({ id, event: eid, player: String(p.name || "Unknown").slice(0, 40), overall: i + 1, rec: [p.wins | 0, p.losses | 0, p.draws | 0],
        legend, champion, m, s: zone(o.Sideboard), b: zone(o.Battlefields), r: zone(o.Runes) });
    });
    if (mine.length < MIN_DECKS) continue;
    const ed = t.eventData || {};
    events.push({ id: eid, name: String(t.tournamentName || t.TID).slice(0, 90), city: ed.city || "", country: ed.country || "", date: new Date((t.startDate || 0) * 1000).toISOString().slice(0, 10),
      players: t.standings.length, topCut: t.topCut | 0, from: "topdeck" });
    decks.push(...mine);
  }
  // keep earlier events that have aged out of the request window, until KEEP_DAYS
  if (prev && Array.isArray(prev.events) && Array.isArray(prev.decks) && Array.isArray(prev.cards)) {
    const have = new Set(events.map(e => e.id)), cutoff = new Date(now - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
    for (const e of prev.events) {
      if (have.has(e.id) || !(e.date >= cutoff)) continue;
      events.push(e);
      const re = a => { const out = []; for (let i = 0; i + 1 < a.length; i += 2) out.push(ix(prev.cards[a[i]]), a[i + 1]); return out; };
      for (const d of prev.decks) if (d.event === e.id) decks.push({ ...d, m: re(d.m), s: re(d.s), b: re(d.b), r: re(d.r) });
    }
  }
  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { version: 1, updated: new Date(now).toISOString().slice(0, 10), credit: "TopDeck.gg", creditUrl: "https://topdeck.gg", cards, events, decks };
}

if (process.argv[1] && process.argv[1].endsWith("topdeck.mjs")) {
  if (!key) { status.note = "No TOPDECK_API_KEY secret is set on the repository yet."; console.log(status.note); finish(0); }
  const body = { game: "Riftbound", format: "Constructed", last: WINDOW_DAYS, participantMin: 16, columns: ["name", "decklist", "wins", "draws", "losses"] };
  let res, text;
  try {
    res = await fetch("https://topdeck.gg/api/v2/tournaments", { method: "POST", headers: { Authorization: key, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
    text = await res.text();
  } catch (e) { status.note = "Request failed: " + String(e.message || e); finish(1); }
  status.http = res.status;
  let data = null; try { data = JSON.parse(text); } catch (e) {}
  if (!res.ok || !Array.isArray(data)) { status.note = "Unexpected answer"; status.body = String(text).slice(0, 300); finish(1); }
  let prev = null; if (existsSync(OUT)) { try { prev = JSON.parse(readFileSync(OUT, "utf8")); } catch (e) {} }
  const out = convert(data, prev);
  if (!out.decks.length && prev && prev.decks && prev.decks.length) { status.note = "No decks came back, so the existing file was kept."; finish(1); }
  writeFileSync(OUT, JSON.stringify(out) + "\n");
  Object.assign(status, { ok: true, tournaments: data.length, events: out.events.length, decks: out.decks.length, cards: out.cards.length });
  console.log(`TopDeck: ${out.events.length} events, ${out.decks.length} decks`);
  finish(0);
}
