// Deck Diff: fetch Riftbound tournaments from TopDeck.gg (https://topdeck.gg/api/docs).
// Step 1 of the hookup: save a small sample of what the API returns so the
// converter into decks.json can be written against real data.
// The key comes from the TOPDECK_API_KEY repository secret and is never printed or saved.
import { writeFileSync } from "node:fs";

const OUT = "deck-diff/";
const key = (process.env.TOPDECK_API_KEY || "").trim();
const status = { ran: new Date().toISOString(), ok: false };
const done = () => { writeFileSync(OUT + "topdeck-status.json", JSON.stringify(status, null, 1) + "\n"); };

if (!key) { status.note = "No TOPDECK_API_KEY secret is set on the repository yet."; done(); console.log(status.note); process.exit(0); }

const body = { game: "Riftbound", format: "Constructed", last: 45, participantMin: 16, columns: ["name", "decklist", "wins", "draws", "losses"] };
let res, text;
try {
  res = await fetch("https://topdeck.gg/api/v2/tournaments", { method: "POST", headers: { Authorization: key, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) });
  text = await res.text();
} catch (e) { status.note = "Request failed: " + String(e.message || e); done(); process.exit(0); }

status.http = res.status;
let data = null; try { data = JSON.parse(text); } catch (e) {}
if (!res.ok || !Array.isArray(data)) { status.note = "Unexpected answer"; status.body = text.slice(0, 400); done(); console.log("HTTP", res.status); process.exit(0); }

const clip = (s, n) => typeof s === "string" && s.length > n ? s.slice(0, n) + " …" : s;
const events = data.map(t => {
  const st = Array.isArray(t.standings) ? t.standings : [];
  return { TID: t.TID, name: t.tournamentName, startDate: t.startDate, format: t.format, topCut: t.topCut, swissNum: t.swissNum,
    city: t.eventData && t.eventData.city, country: t.eventData && t.eventData.country,
    players: st.length, withDecklist: st.filter(p => p && p.decklist).length, withDeckObj: st.filter(p => p && p.deckObj).length };
}).sort((a, b) => b.withDecklist - a.withDecklist);

const best = data.find(t => events[0] && t.TID === events[0].TID);
const sample = best ? (best.standings || []).filter(p => p && (p.decklist || p.deckObj)).slice(0, 3).map((p, i) => ({
  keys: Object.keys(p), standing: i + 1, wins: p.wins, draws: p.draws, losses: p.losses, decklist: clip(p.decklist, 4000), deckObj: p.deckObj })) : [];

status.ok = true; status.tournaments = events.length; status.withAnyDecklist = events.filter(e => e.withDecklist > 0).length;
status.decklistsTotal = events.reduce((s, e) => s + e.withDecklist, 0);
writeFileSync(OUT + "topdeck-sample.json", JSON.stringify({ request: body, tournamentKeys: best ? Object.keys(best) : [], events: events.slice(0, 60), sample }, null, 1) + "\n");
done();
console.log(`TopDeck: ${status.tournaments} tournaments, ${status.decklistsTotal} decklists`);
