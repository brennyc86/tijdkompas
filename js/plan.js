// Tijdkompas — automatisch inroosteren + agenda import/export (.ics, Google/Outlook-links)
//
// Twee soorten lijsten:
//  • "vast"  — eigen tijdvakken (bv. werk ma/di/do op kantoor, wo/vr thuis). Taken alleen binnen die tijden.
//              Reistijd naar de locatie gaat vóór/na het tijdvak af van je vrije tijd.
//  • "vrij"  — alles wat overblijft binnen je beschikbaarheid, na aftrek van vaste tijden, reistijd en afspraken.
//              Staat de lijst (of taak) op een locatie met reistijd, dan krijgt elke sessie reis heen + terug;
//              taken op dezelfde locatie worden achter elkaar gezet zodat je maar één keer reist.
import { veiligeAfwijkingen, veiligGenegeerd } from "./veilig.js";
import { opslag, kwadrant, kalibratie, project, overzicht, locatie, effectieveLocatie, uid, linkInfo, isMijn, taak, sessie, blokTitel } from "./data.js";

// Agenda en planning van gelinkte accounts (privé ↔ werk): je bent één mens, dus daar plannen we omheen.
// De app vult dit (cloud.familieAgenda); zonder gelinkte accounts is het leeg.
export const familieHaak = { agenda: () => ({ bezet: [], planning: [] }),
  eigenaar: () => null,     // eigenaar(lijst) → { email, agenda } als de lijst van een gelinkt account is
  voorMij: () => ({ blokken: [], klaar: false }),
  instVan: () => null,      // instVan(lijst) → de instellingen (soort, tijden, plek) van het account van wie de lijst is
  instAlle: () => [],
  regels: () => ({ regels: [], verborgen: {} }),
  ruw: () => [] };          // afspraken van je gelinkte accounts zoals ze binnenkomen (om dubbele te herkennen)   // afspraakregels en verborgen afspraken van je gelinkte accounts     // instAlle(lijstId) → de instellingen van die lijst bij je gelinkte accounts (hun afwijkingen e.d.)   // blokken die een gelinkt account voor míjn lijsten plande (ik zet ze in mijn agenda)
// Lijsten van een gelinkt account plant dat account zelf in (in zijn eigen agenda); hier niet nog eens.
const vanGelinkt = (ovId) => { const o = overzicht(ovId), f = sessie.familie || []; return !!(o?.eigenaar && f.length > 1 && o.eigenaar !== sessie.ik && f.includes(o.eigenaar)); };

const MIN = 60000;
const rondOp = (d, stap = 15) => new Date(Math.ceil(d.getTime() / (stap * MIN)) * stap * MIN);
// Plannen gaat per half uur (instelbaar): na een afspraak begin je op het volgende hele of halve uur;
// wat er tot dan overblijft is je pauze. Een extra pauze (buffer) komt daar alleen bij als je die instelt.
export const raster = () => Math.max(5, +opslag.d.instellingen.raster || 30);
const opDag = (dag, hhmm) => { const [h, m] = hhmm.split(":").map(Number); return new Date(dag.getFullYear(), dag.getMonth(), dag.getDate(), h, m); };
const minuten = (a, b) => (b - a) / MIN;
export const dagStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Doeldatum: waar het inplannen op mikt.
//   - Je eigen streefdatum gaat voor: eerder dan de deadline (marge), of juist later als de deadline niet haalbaar is.
//   - Zonder streefdatum: de deadline (van de taak of van het project, de vroegste).
export function doelDatum(item) {
  const p = item.project ? project(item.project) : null;
  return item.streef || p?.streef || [item.deadline, p?.deadline].filter(Boolean).sort()[0] || null;
}
export function harde(item) {
  const p = item.project ? project(item.project) : null;
  return [item.deadline, p?.deadline].filter(Boolean).sort()[0] || null;
}

const GEWICHT = { doen: 40, plannen: 30, delegeren: 15, schrappen: 0 };
export function prioriteit(item, nu = new Date()) {
  let s = GEWICHT[kwadrant(item)];
  const doel = doelDatum(item);
  if (doel) {
    const dagen = (new Date(doel + "T23:59") - nu) / 864e5;
    s += Math.max(0, 21 - dagen) * 2;     // hoe dichterbij, hoe hoger
    if (dagen < 0) s += 50;              // te laat: bovenaan
  }
  return s;
}

// ---------- agenda-classificatie ----------
// d.agendas[bron] = { naam, kleur, soort: "bezet" | "negeer" | "rooster", lijst }
export const SOORTEN = {
  bezet:   { naam: "Bezet",            uitleg: "Afspraken blokkeren tijd; er wordt omheen gepland" },
  rooster: { naam: "Rooster van lijst", uitleg: "Afspraken bepalen de vaste tijden van een lijst (bv. wisselende diensten)" },
  negeer:  { naam: "Niet meetellen",   uitleg: "Alleen ter info (verjaardagen, feestdagen…)" },
};
export const eventSoort = (ev) => telt(ev) ? (opslag.d.agendas[ev.bron]?.soort || "bezet") : "negeer";
// ---------- afspraken die niet altijd meetellen ----------
// d.afspraakRegels: [{ bron, titel, lijst, soort: "werkdag" }] — alle afspraken met die naam uit die agenda tellen alleen op dagen
// dat de lijst (bijv. Werk) vaste tijden heeft (bijv. "Lunch" als reservering); d.verborgen: { "bron|start|hash": wanneer } — losse keer.
// Ook die van je gelinkte accounts gelden (familieHaak.regels).
const normT = (s) => String(s || "").trim().toLowerCase();
export const afspraakSleutel = (ev) => `${ev.bron}|${ev.start}|${hashT(ev.titel)}`;
const hashT = (s) => { let h = 5381; for (const c of String(s ?? "")) h = (h * 33 + c.codePointAt(0)) >>> 0; return h.toString(36); };
export function regelVoor(ev, soorten = ["werkdag"], lijst = null) {
  const f = familieHaak.regels();
  return [...(opslag.d.afspraakRegels || []), ...f.regels].find(r => soorten.includes(r.soort) && (!lijst || r.lijst === lijst)
    && r.bron === ev.bron && normT(r.titel) === normT(ev.titel)) || null;
}
/** Zelf aangegeven bij welke rol een afspraak hoort (voor de lijst `lijst`): "werk", "prive" of null (dan gewoon: account/agenda) */
export function rolKeuze(ev, lijst) {
  const k = afspraakSleutel(ev), los = opslag.d.rolKeuzes?.[k] || familieHaak.regels().rolKeuzes?.[k];
  if (los && los.lijst === lijst) return los.rol;
  const r = regelVoor(ev, ["rolwerk", "rolprive"], lijst);
  return r ? (r.soort === "rolwerk" ? "werk" : "prive") : null;
}
// ---------- dezelfde afspraak via meer kanalen (bijv. Outlook gekoppeld én als link, of via je werk-inlog én hier) ----------
// Telt één keer. Zelfde begin, eind en naam — of één van beide heet alleen „Bezet” (een link zonder details) — is dezelfde afspraak.
// Wie blijft: die van dit account boven die van een gelinkt account, een directe koppeling boven een link, een echte naam boven „Bezet”.
const ALGEMEEN = new Set(["bezet", "busy", "tentative", "voorlopig", "free", "vrij", "niet beschikbaar", "afwezig", "out of office", ""]);
const herkomst = (ev) => ev.vanUid || "eigen";
const evId = (ev) => herkomst(ev) + ":" + ev.id;
let dubbelCache = { t: 0, n: -1, weg: new Set() };
function dubbeleAfspraken() {
  const d = opslag.d, ruw = familieHaak.ruw();
  const n = (d.bezet || []).length + ruw.length;
  if (Date.now() - dubbelCache.t < 300 && dubbelCache.n === n) return dubbelCache.weg;
  const alle = [...(d.bezet || []).map(e => ({ ...e, viaLink: !!d.agendas?.[e.bron]?.link })), ...ruw].filter(e => !e.eigen && e.start && e.eind);
  const groepen = new Map();
  for (const e of alle) { const k = e.start + "|" + e.eind; if (!groepen.has(k)) groepen.set(k, []); groepen.get(k).push(e); }
  const score = (e) => (herkomst(e) === "eigen" ? 4 : 0) + (e.viaLink ? 0 : 2) + (ALGEMEEN.has(normT(e.titel)) ? 0 : 1);
  const weg = new Set();
  for (const g of groepen.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => score(b) - score(a));
    const gehouden = [];
    for (const e of g) {
      const t = normT(e.titel), zelfde = gehouden.find(h => normT(h.titel) === t || ALGEMEEN.has(t) || ALGEMEEN.has(normT(h.titel)));
      // verschillende agenda's van hetzelfde kanaal met dezelfde afspraak (bijv. gedeelde agenda) tellen ook als één
      if (zelfde) weg.add(evId(e)); else gehouden.push(e);
    }
  }
  dubbelCache = { t: Date.now(), n, weg };
  return weg;
}
export const isDubbel = (ev) => dubbeleAfspraken().has(evId(ev));
/** Een herinnering (bijv. "medicijnen" om 07:00): staat er wel, maar telt niet als bezet */
export function isHerinnering(ev) {
  const f = familieHaak.regels(), k = afspraakSleutel(ev);
  return !!(opslag.d.herinneringen?.[k] || f.herinneringen?.[k] || regelVoor(ev, ["herinnering"]));
}
export function telt(ev) {
  if (!ev.eigen && isDubbel(ev)) return false;
  if (isHerinnering(ev)) return false;
  const d = opslag.d, f = familieHaak.regels(), k = afspraakSleutel(ev);
  if (d.verborgen?.[k] || f.verborgen?.[k]) return false;
  const r = regelVoor(ev);
  if (r?.soort === "werkdag") { const o = overzicht(r.lijst); if (o && !dagTijden(o, dagStr(new Date(ev.start))).length) return false; }
  return true;
}
export const eventLijst = (ev) => opslag.d.agendas[ev.bron]?.lijst || "";

const reisVan = (locId) => locatie(locId)?.reistijd || 0;

// Locatie herkennen in de plaats-tekst van een afspraak ("Kantoor Utrecht" → kantoor)
export function herkenLocatie(tekst) {
  if (!tekst) return "";
  const t = tekst.toLowerCase();
  const l = opslag.d.locaties.find(l => l.id !== "thuis" && (t.includes(l.naam.toLowerCase()) || (l.adres && t.includes(l.adres.toLowerCase()))));
  return l?.id || "";
}

// [a,b]-intervallen min andere intervallen
function aftrekken(vensters, weg) {
  let uit = vensters.map(([a, b]) => [a, b]);
  for (const [x, y] of weg) {
    const nieuw = [];
    for (const [a, b] of uit) {
      if (y <= a || x >= b) { nieuw.push([a, b]); continue; }
      if (x > a) nieuw.push([a, x]);
      if (y < b) nieuw.push([y, b]);
    }
    uit = nieuw;
  }
  return uit.filter(([a, b]) => b - a >= 5 * MIN);
}

// ---------- afwijkingen per dag ----------
// o.afwijkingen["2026-11-20"] = { soort, tijden: [{van, tot, locatie}], reden } op een lijst met vaste tijden:
//   vrij    — die dag geen vaste tijden (vrije dag, ruildag, vakantie thuis): de tijd wordt gewone vrije tijd
//   anders  — andere tijden en/of plek dan normaal (geruilde dag, dagdeel vrij, thuis i.p.v. kantoor)
//   bezet   — cursus, training of elders: die tijd is bezet, er wordt niets in ingepland (reistijd telt mee)
// d.afwezig["2026-11-20"] = { reden } — de hele dag weg (vakantie): niets inplannen, ook niet uit andere lijsten.
export const AFWIJKING = {
  vrij:   { naam: "Vrij",                 icoon: "🏖️", uitleg: "Geen vaste tijden; de tijd telt als vrije tijd" },
  anders: { naam: "Andere tijden of plek", icoon: "🕘", uitleg: "Bijv. geruilde dag, dagdeel vrij of thuis i.p.v. op kantoor" },
  bezet:  { naam: "Cursus of elders",     icoon: "🎓", uitleg: "Die tijd is bezet: er wordt niets in ingepland" },
};
/**
 * Een lijst zoals hij echt geldt: is hij van een gelinkt account (jij in een andere rol), dan zijn soort, tijden en plek
 * die van dát account — zo zie je de werktijden van je werk-inlog ook als je met privé bent ingelogd, en plant privé eromheen.
 */
export function effLijst(o) {
  const gi = o && familieHaak.instVan(o);
  if (!gi || !gi.modus) return o;
  return { ...o, modus: gi.modus, tijden: Array.isArray(gi.tijden) ? gi.tijden : [], locatie: gi.locatie ?? o.locatie };
}
/** Standaard tijdvakken van een lijst op een weekdag (zonder afwijkingen) */
export const standaardTijden = (o, weekdag) => (effLijst(o).tijden || []).filter(t => (t.dagen || []).includes(weekdag));
// Alle afwijkingen van een lijst: die van jezelf en die van je gelinkte accounts (ontsmet)
const afwBronnen = (o) => [o?.afwijkingen || {}, ...familieHaak.instAlle(o?.id).map(x => veiligeAfwijkingen(x?.afwijkingen))];
/** Afwijking van een lijst op een dag (of null) — de nieuwste, van welk van je accounts ook */
export function afwijkingOp(o, ds) {
  const x = afwBronnen(o).map(m => m?.[ds]).filter(Boolean).sort((p, q) => String(q.t || "").localeCompare(String(p.t || "")))[0];
  return x && x.soort !== "standaard" ? x : null;
}
/** Datums met een afwijking (eigen of van een gelinkt account) */
export const afwijkingDatums = (o) => [...new Set(afwBronnen(o).flatMap(m => Object.keys(m || {})))].filter(ds => afwijkingOp(o, ds)).sort();
/** Afwijking zetten (op de echte lijst, in jouw instellingen); null = weer zoals altijd */
export function zetAfwijking(o, ds, x) {
  o.afwijkingen = { ...(o.afwijkingen || {}) };
  const t = new Date().toISOString();
  if (x) o.afwijkingen[ds] = { ...x, t };
  else if (familieHaak.instAlle(o.id).some(i => i?.afwijkingen?.[ds])) o.afwijkingen[ds] = { soort: "standaard", tijden: [], reden: "", t };
  else delete o.afwijkingen[ds];
}
/** Tijdvakken van een lijst op een datum, met afwijkingen ([{van, tot, locatie}]) */
export function dagTijden(o, ds) {
  const x = afwijkingOp(o, ds);
  if (x) return x.soort === "anders" ? x.tijden.map(t => ({ ...t })) : [];
  const e = effLijst(o);
  return standaardTijden(o, new Date(ds + "T12:00").getDay()).map(t => ({ van: t.van, tot: t.tot, locatie: t.locatie ?? e.locatie ?? "" }));
}
const mv = (s) => { const [h, m] = String(s).split(":").map(Number); return h * 60 + (m || 0); };
const hm = (n) => String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
/** Tijdvakken min een stuk (van–tot, "HH:MM"); stukjes korter dan een kwartier vallen weg */
export function tijdenZonder(tijden, van, tot) {
  const a = mv(van), b = mv(tot), uit = [];
  for (const t of tijden) {
    const x = mv(t.van), y = mv(t.tot);
    if (b <= x || a >= y) { uit.push(t); continue; }
    if (a - x >= 15) uit.push({ ...t, tot: hm(a) });
    if (y - b >= 15) uit.push({ ...t, van: hm(b) });
  }
  return uit;
}
/** Tijdvakken plus een stuk (overlap wordt samengevoegd) */
export function tijdenMet(tijden, slot) {
  const l = [...tijden.map(t => ({ ...t })), { ...slot }].sort((p, q) => mv(p.van) - mv(q.van)), uit = [];
  for (const t of l) { const z = uit.at(-1); if (z && mv(t.van) <= mv(z.tot)) { if (mv(t.tot) > mv(z.tot)) z.tot = t.tot; } else uit.push(t); }
  return uit;
}

// ---------- buiten je beschikbaarheid ----------
/**
 * Wat de komende dagen (deels) buiten je beschikbaarheid valt:
 *   afspraak — een afspraak uit je agenda buiten je beschikbare uren (of werktijden), bijv. 06:30 of 23:00
 *   blok     — een ingepland blok buiten de tijden van zijn lijst (vrije tijd: beschikbaarheid; vaste lijst: de werktijden)
 * Wat je al "klopt zo" hebt genoemd (d.buitenOk) komt niet terug. Herinneringen tellen niet mee.
 */
export function buitenBeschikbaarheid({ dagen = 14 } = {}) {
  const d = opslag.d, nu = new Date(), tot = new Date(nu.getTime() + dagen * 864e5), ok = d.buitenOk || {}, uit = [], cache = new Map();
  const ind = (t) => { const dag = new Date(t.getFullYear(), t.getMonth(), t.getDate()), k = dagStr(dag); if (!cache.has(k)) cache.set(k, dagIndeling(dag)); return cache.get(k); };
  const buitenMin = (a, b, ramen) => minuten(a, b) - ramen.reduce((s, [x, y]) => s + Math.max(0, minuten(x > a ? x : a, y < b ? y : b)), 0);
  for (const ev of d.bezet || []) {
    if (ev.eigen || eventSoort(ev) !== "bezet") continue;
    const a = new Date(ev.start), b = new Date(ev.eind);
    if (b <= nu || a >= tot || b - a >= 864e5) continue;
    const k = afspraakSleutel(ev); if (ok[k]) continue;
    const I = ind(a), ramen = I.weg ? [] : [...I.beschikbaar, ...I.vast.map(v => [v.a, v.b])];
    const m = buitenMin(a, b, ramen);
    if (m >= 15) uit.push({ soort: "afspraak", ev, sleutel: k, ds: dagStr(a), min: m, weg: !!I.weg });
  }
  for (const bl of d.planning || []) {
    if (!bl.item || bl.soort === "reis" || bl.soort === "uitloop") continue;
    const a = new Date(bl.start), b = new Date(bl.eind);
    if (b <= nu || a >= tot) continue;
    const k = "blok:" + bl.id + "|" + bl.start; if (ok[k]) continue;
    const I = ind(a), o = effLijst(overzicht(bl.overzicht));
    const ramen = I.weg ? [] : o?.modus === "vast" ? I.vast.filter(v => v.lijst === bl.overzicht).map(v => [v.a, v.b]) : I.beschikbaar;
    const m = buitenMin(a, b, ramen);
    if (m >= 5) uit.push({ soort: "blok", blok: bl, sleutel: k, ds: dagStr(a), min: m, weg: !!I.weg });
  }
  return uit.sort((p, q) => (p.ev || p.blok).start.localeCompare((q.ev || q.blok).start));
}

// ---------- werk en privé door elkaar ----------
const hashje = (s) => { let h = 5381; for (const c of String(s ?? "")) h = (h * 33 + c.codePointAt(0)) >>> 0; return h.toString(36); };
/**
 * Afspraken die door je rollen heen lopen, voor een lijst met vaste tijden (zoals Werk):
 *   prive — een afspraak van een andere rol (bijv. je privé-agenda) valt in die vaste tijden
 *   werk  — een afspraak van die rol zelf (bijv. je werkagenda) valt erbuiten, in je eigen tijd
 * Welke afspraak bij welke rol hoort: bij gelinkte accounts het account; anders de agenda's die bij de lijst horen.
 * Wat je al hebt opgelost (een afwijking met deze botsing) of hebt laten zo, komt niet terug.
 */
export function rolBotsingen({ dagen = 28 } = {}) {
  const d = opslag.d, nu = new Date(), tot = new Date(nu.getTime() + dagen * 864e5);
  const f = familieHaak.agenda(), metFamilie = (sessie.familie || []).length > 1;
  const evs = [
    ...d.bezet.filter(ev => eventSoort(ev) === "bezet" && !ev.eigen).map(ev => ({ ...ev, uid: sessie.ik })),
    ...f.bezet.filter(ev => ev.soortF === "bezet" && !ev.eigen).map(ev => ({ ...ev, uid: ev.vanUid || "" })),
  ].filter(ev => new Date(ev.eind) > nu && new Date(ev.start) < tot && new Date(ev.eind) - new Date(ev.start) < 864e5);
  const uit = [], cache = new Map();
  const ind = (dag) => { const k = dagStr(dag); if (!cache.has(k)) cache.set(k, dagIndeling(dag)); return cache.get(k); };
  for (const o of d.overzichten.filter(o => !o.slot && effLijst(o).modus === "vast")) {
    const eigenaar = o.eigenaar || sessie.ik;
    const gekoppeld = Object.entries(d.agendas || {}).filter(([, a]) => a.lijst === o.id).map(([k]) => k);
    const zelfGezegd = Object.values(d.rolKeuzes || {}).some(v => v.lijst === o.id) || (d.afspraakRegels || []).some(r => r.lijst === o.id && r.soort !== "werkdag");
    if (!metFamilie && !gekoppeld.length && !zelfGezegd) continue;   // niet te zeggen welke afspraak bij welke rol hoort
    const vanRol = (ev) => { const k = rolKeuze(ev, o.id); return k ? k === "werk" : gekoppeld.includes(ev.bron) || (metFamilie && ev.uid === eigenaar); };
    const bronnen = afwBronnen(o), opgelost = new Set(bronnen.flatMap(m => Object.values(m || {}).flatMap(x => x?.bij || [])));
    const gelaten = new Set([o.genegeerd || {}, ...familieHaak.instAlle(o.id).map(x => veiligGenegeerd(x?.genegeerd))].flatMap(m => Object.keys(m)));
    for (const ev of evs) {
      const a = new Date(ev.start), b = new Date(ev.eind), dag = new Date(a.getFullYear(), a.getMonth(), a.getDate());
      const I = ind(dag); if (I.weg) continue;
      const ramen = I.vast.filter(v => v.lijst === o.id);
      const overlap = ramen.reduce((s, v) => s + Math.max(0, minuten(v.a > a ? v.a : a, v.b < b ? v.b : b)), 0);
      const sleutel = `${o.id}|${ev.start}|${hashje(ev.titel)}`;
      if (opgelost.has(sleutel) || gelaten.has(sleutel)) continue;
      const rol = vanRol(ev), duur = minuten(a, b);
      if (!rol && overlap >= 15) uit.push({ soort: "prive", lijst: o.id, ev, sleutel, ds: dagStr(dag), min: overlap });
      else if (rol && duur - overlap >= 15) uit.push({ soort: "werk", lijst: o.id, ev, sleutel, ds: dagStr(dag), min: duur - overlap });
    }
  }
  return uit.sort((p, q) => p.ev.start.localeCompare(q.ev.start));
}
export const afwezigOp = (ds) => opslag.d.afwezig?.[ds] || null;

/**
 * Indeling van één dag: vaste tijdvakken (alle "vast"-lijsten), reistijd daaromheen,
 * pauzes ter plekke, en de vrije vensters die overblijven voor "vrij"-lijsten.
 * Afwijkingen voor die datum (vrij, andere tijden, cursus, hele dag weg) gaan vóór het weekrooster.
 */
export function dagIndeling(dag) {
  const d = opslag.d, ds = dagStr(dag);
  const weg = afwezigOp(ds);
  if (weg) return { vast: [], reis: [], terPlekke: [], elders: [], beschikbaar: [], vrij: [], weg, afwijkingen: [] };
  const dagEind = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate() + 1);
  const opDezeDag = (ev) => new Date(ev.start) < dagEind && new Date(ev.eind) > dag;
  const vast = [], elders = [], afwijkingen = [];
  const geldig = (t) => t && /^\d{2}:\d{2}$/.test(t.van) && /^\d{2}:\d{2}$/.test(t.tot) && t.tot > t.van;
  for (const o of d.overzichten.map(effLijst).filter(o => o.modus === "vast")) {
    const afw = afwijkingOp(o, ds);
    if (afw) {
      afwijkingen.push({ lijst: o.id, ...afw });
      if (afw.soort === "vrij") continue;
      for (const t of (afw.tijden || []).filter(geldig))
        (afw.soort === "bezet" ? elders : vast).push({ lijst: o.id, a: opDag(dag, t.van), b: opDag(dag, t.tot), locatie: t.locatie ?? o.locatie ?? "", bron: "afwijking", reden: afw.reden || "" });
      continue;
    }
    const rooster = d.bezet.filter(ev => eventSoort(ev) === "rooster" && eventLijst(ev) === o.id && opDezeDag(ev));
    if (rooster.length) rooster.forEach(ev => vast.push({ lijst: o.id, a: new Date(ev.start), b: new Date(ev.eind), locatie: (ev.loc ?? herkenLocatie(ev.plaats)) || o.locatie || "", bron: "rooster" }));
    else standaardTijden(o, dag.getDay()).filter(geldig)
      .forEach(t => vast.push({ lijst: o.id, a: opDag(dag, t.van), b: opDag(dag, t.tot), locatie: t.locatie ?? o.locatie ?? "", bron: "lijst" }));
  }
  vast.sort((x, y) => x.a - y.a);

  // reistijd rond vaste tijden én rond cursus/elders
  const metReis = [...vast, ...elders].sort((x, y) => x.a - y.a);
  const reis = [], terPlekke = [];
  metReis.forEach((v, i) => {
    const r = reisVan(v.locatie); if (!r) return;
    // korte pauze tussen twee tijdvakken op dezelfde plek: je blijft ter plekke, geen reis
    const kort = (x, y) => x && y && x.locatie === y.locatie && minuten(x.b, y.a) >= 0 && minuten(x.b, y.a) < 2 * r + 60;
    if (!kort(metReis[i - 1], v)) reis.push({ a: new Date(v.a - r * MIN), b: v.a, locatie: v.locatie, lijst: v.lijst, richting: "heen" });
    if (kort(v, metReis[i + 1])) terPlekke.push({ a: v.b, b: metReis[i + 1].a, locatie: v.locatie, lijst: v.lijst });
    else reis.push({ a: v.b, b: new Date(v.b.getTime() + r * MIN), locatie: v.locatie, lijst: v.lijst, richting: "terug" });
  });
  // Afspraken (soort bezet) op een bekende locatie met reistijd: reis eromheen
  for (const ev of d.bezet.filter(ev => eventSoort(ev) === "bezet" && !ev.eigen && opDezeDag(ev))) {
    const loc = ev.loc ?? herkenLocatie(ev.plaats), r = reisVan(loc);
    if (!r) continue;
    if (metReis.some(v => v.locatie === loc && v.a <= new Date(ev.start) && v.b >= new Date(ev.eind))) continue; // al ter plekke
    reis.push({ a: new Date(new Date(ev.start) - r * MIN), b: new Date(ev.start), locatie: loc, richting: "heen", afspraak: ev.titel });
    reis.push({ a: new Date(ev.eind), b: new Date(new Date(ev.eind).getTime() + r * MIN), locatie: loc, richting: "terug", afspraak: ev.titel });
  }

  const beschikbaar = (d.beschikbaar || []).filter(t => (t.dagen || []).includes(dag.getDay()) && geldig(t)).map(t => [opDag(dag, t.van), opDag(dag, t.tot)]);
  const vrij = aftrekken(beschikbaar, [...vast, ...elders, ...reis, ...terPlekke].map(x => [x.a, x.b]));
  return { vast, reis, terPlekke, elders, beschikbaar, vrij, weg: null, afwijkingen };
}

/**
 * Vrije gaten tussen `van` en `tot` om bezette tijden heen. Een gat begint op het eerstvolgende hele of halve uur
 * (raster) na het einde van wat ervoor zit (plus de eventuele extra pauze); het loopt door tot het volgende item begint.
 * Reistijd telt zonder pauze. Bezet: [{a, b, reis?}]
 */
export function vrijeGaten(van, tot, bezet, R = raster(), buf = 0) {
  const uit = []; let c = van;
  for (const x of bezet.filter(x => x.b > van && x.a < tot).sort((p, q) => p.a - q.a)) {
    const a = rondOp(c, R), eind = new Date(Math.min(tot, x.a - (x.reis ? 0 : buf)));
    if (eind > a) uit.push([a, eind]);
    const na = new Date(x.b.getTime() + (x.reis ? 0 : buf));
    if (na > c) c = na;
  }
  const a = rondOp(c, R);
  if (tot > a) uit.push([a, new Date(tot)]);
  return uit.filter(([a, b]) => b - a >= 5 * MIN);
}

/**
 * Plant alle open taken (en projecten zonder taken) in. Vastgezette blokken en afspraken blijven staan.
 * @returns {{blokken:number, waarschuwingen:string[]}}
 */
export function planAutomatisch(actieveOverzichten) {
  const d = opslag.d, inst = d.instellingen, nu = new Date();
  const R = raster(), start = rondOp(nu, R);
  const eind = new Date(start.getTime() + inst.horizon * 864e5);
  const buf = (inst.buffer || 0) * MIN;

  // Toekomstige niet-vaste blokken van actieve lijsten vervallen; de rest blijft
  d.planning = d.planning.filter(b => b.vast || new Date(b.eind) <= nu || !actieveOverzichten.includes(b.overzicht));

  // Alles wat tijd bezet: {a, b, ref}
  const bezet = [
    ...d.bezet.filter(ev => eventSoort(ev) === "bezet" && !ev.eigen).map(ev => ({ a: new Date(ev.start), b: new Date(ev.eind), ref: "ev" })),
    ...d.planning.map(b => ({ a: new Date(b.start), b: new Date(b.eind), ref: b.id, reis: b.soort === "reis" })),
    ...(() => { const f = familieHaak.agenda(); return [
      ...f.bezet.filter(ev => ev.soortF === "bezet" && !ev.eigen).map(ev => ({ a: new Date(ev.start), b: new Date(ev.eind), ref: "fam" })),
      ...f.planning.map(b => ({ a: new Date(b.start), b: new Date(b.eind), ref: "fam", reis: b.soort === "reis" })),
    ]; })(),
  ];
  const indeling = {};
  const ind = (dag) => {
    const k = dagStr(dag);
    if (!indeling[k]) { indeling[k] = dagIndeling(dag); indeling[k].reis.forEach(r => bezet.push({ a: r.a, b: r.b, ref: "reis", reis: true }));
      indeling[k].elders.forEach(r => bezet.push({ a: r.a, b: r.b, ref: "elders" })); }
    return indeling[k];
  };

  // Vrije stukken binnen [wa, wb]: beginnen op het volgende hele/halve uur na wat er bezet is
  const gaten = (wa, wb, negeer) => vrijeGaten(wa < start ? start : wa, wb, bezet.filter(x => x.ref !== negeer), R, buf);

  const items = [
    ...d.taken.filter(t => t.status !== "klaar"),
    ...d.projecten.filter(p => p.status !== "klaar" && p.schatting > 0 && !d.taken.some(t => t.project === p.id && t.status !== "klaar")),
  ].filter(i => actieveOverzichten.includes(i.overzicht))
   .filter(i => !vanGelinkt(i.overzicht))
   .filter(isMijn)                                                   // gedeelde lijst: alleen wat (ook) aan jou is toegewezen
   .filter(i => inst.schrappenInplannen || kwadrant(i) !== "schrappen" || d.taken.some(x => x.status !== "klaar" && (x.wachtOp || []).includes(i.id)));
  // Waar een ander op wacht, krijgt minstens de prioriteit van die wachtende taak; en komt er vóór
  const pr = new Map(), bezig = new Set();
  const effPrio = (t) => {
    if (pr.has(t.id)) return pr.get(t.id);
    if (bezig.has(t.id)) return prioriteit(t, nu);
    bezig.add(t.id);
    let p = prioriteit(t, nu);
    for (const x of d.taken) if (x.status !== "klaar" && (x.wachtOp || []).includes(t.id)) p = Math.max(p, effPrio(x));
    bezig.delete(t.id); pr.set(t.id, p); return p;
  };
  items.sort((a, b) => effPrio(b) - effPrio(a));
  const volgorde = [], gedaan = new Set();
  const zet = (it, pad = new Set()) => {
    if (gedaan.has(it.id) || pad.has(it.id)) return; pad.add(it.id);
    for (const id of it.wachtOp || []) { const v = items.find(x => x.id === id); if (v) zet(v, pad); }
    gedaan.add(it.id); volgorde.push(it);
  };
  items.forEach(it => zet(it));
  const eindVan = {};                                                 // tot wanneer een taak in deze ronde is ingepland

  const waarschuwingen = [];
  let blokken = 0;
  const factorCache = {}, ruimte = {}, sessies = [];

  const nieuwBlok = (v) => {
    const b = { id: uid(), vast: false, ...v, start: v.a.toISOString(), eind: v.b.toISOString() };
    delete b.a; delete b.b;
    d.planning.push(b); bezet.push({ a: v.a, b: v.b, ref: b.id, reis: b.soort === "reis" });
    return b;
  };
  const weg = (b) => { d.planning = d.planning.filter(x => x !== b); const i = bezet.findIndex(x => x.ref === b.id); if (i >= 0) bezet.splice(i, 1); };

  for (const it of volgorde) {
    const ov = overzicht(it.overzicht); if (!ov) continue;
    // Wacht deze taak op een andere? Dan pas inplannen ná het einde daarvan
    let vanaf = start, wachtOpOnbekend = null;
    for (const id of it.wachtOp || []) {
      const v = taak(id); if (!v || v.status === "klaar") continue;
      const eigen = d.planning.filter(b => b.item === id && b.soort !== "reis").map(b => new Date(b.eind));
      const tot = eindVan[id] !== undefined ? eindVan[id] : eigen.length ? new Date(Math.max(...eigen)) : v.gepland?.tot ? new Date(v.gepland.tot) : null;
      if (!tot) { wachtOpOnbekend = v; break; }
      if (tot > vanaf) vanaf = rondOp(new Date(tot.getTime() + buf), R);
    }
    if (wachtOpOnbekend) { eindVan[it.id] = null; waarschuwingen.push(`„${it.titel}” wacht op „${wachtOpOnbekend.titel}”, en die is nog niet ingepland — daarom nog niet ingepland.`); continue; }
    const al = d.planning.filter(b => b.item === it.id && b.vast && b.soort !== "reis").reduce((s, b) => s + minuten(new Date(b.start), new Date(b.eind)), 0)
      + familieHaak.agenda().planning.filter(b => b.item === it.id && b.soort !== "reis" && new Date(b.eind) > nu).reduce((s, b) => s + minuten(new Date(b.start), new Date(b.eind)), 0);   // al ingepland door je gelinkte account
    factorCache[it.overzicht] ??= schatFactor(it.overzicht);
    let rest = Math.round(((it.schatting || 30) * factorCache[it.overzicht] - (it.werkelijk || 0) - al) / 5) * 5;
    if (rest < inst.blokMin) rest = it.schatting ? Math.max(0, rest) : 30;
    if (rest <= 0) continue;

    const p = it.project ? project(it.project) : null;
    const eigenLoc = it.locatie || p?.locatie || "";          // expliciet gekozen plek
    const loc = ov.modus === "vast" ? eigenLoc : effectieveLocatie(it);
    const reis = ov.modus === "vrij" ? reisVan(loc) : 0;      // bij vaste tijden zit reis al in het rooster
    const deadline = harde(it);
    let laatste = null;
    const basisBlok = { item: it.id, type: it.type, overzicht: it.overzicht, titel: blokTitel(it), locatie: loc };

    for (let dag = new Date(start.getFullYear(), start.getMonth(), start.getDate()); dag < eind && rest > 0; dag.setDate(dag.getDate() + 1)) {
      const I = ind(dag);
      const vensters = (ov.modus === "vast"
        ? I.vast.filter(v => v.lijst === ov.id && (!eigenLoc || v.locatie === eigenLoc)).map(v => [v.a, v.b])
        : I.vrij).map(([a, b]) => [a < vanaf ? vanaf : a, b]).filter(([a, b]) => b - a >= 5 * MIN);
      if (!vensters.length) continue;
      const sleutel = dagStr(dag) + "|" + (ov.modus === "vast" ? ov.id : "vrij");
      if (ruimte[sleutel] == null) {
        const totaal = vensters.reduce((s, [a, b]) => s + minuten(a, b), 0);
        const gepland = d.planning.filter(b => b.soort !== "reis" && dagStr(new Date(b.start)) === dagStr(dag) &&
          (ov.modus === "vast" ? b.overzicht === ov.id : overzicht(b.overzicht)?.modus === "vrij")).reduce((s, b) => s + minuten(new Date(b.start), new Date(b.eind)), 0);
        ruimte[sleutel] = totaal * (inst.vulgraad ?? 100) / 100 - gepland;
      }
      const maxDuur = () => Math.min(rest, inst.blokMax, Math.floor(ruimte[sleutel] / 5) * 5);
      const plaats = (a, duur) => {
        const b = nieuwBlok({ ...basisBlok, a, b: new Date(a.getTime() + duur * MIN) });
        rest -= duur; ruimte[sleutel] -= duur; blokken++; laatste = b; return b;
      };

      let gelukt = true;
      while (rest > 0 && gelukt && maxDuur() >= Math.min(inst.blokMin, rest)) {
        gelukt = false;
        // 1. Aanschuiven bij een sessie op dezelfde locatie (scheelt een reis)
        if (reis) {
          for (const s of sessies.filter(s => s.loc === loc && s.dag === dagStr(dag) && s.eindTaak >= vanaf)) {
            const venster = vensters.find(([a, b]) => s.eindTaak >= a && s.eindTaak <= b); if (!venster) continue;
            const a = rondOp(new Date(s.eindTaak.getTime() + buf), R);
            const g = gaten(s.eindTaak, venster[1], s.terug.id).find(([x, y]) => x <= a && y > a);
            if (!g) continue;
            const duur = Math.min(maxDuur(), Math.floor((minuten(a, g[1]) - reis) / 5) * 5);
            if (duur < Math.min(inst.blokMin, rest)) continue;
            weg(s.terug);
            const b = plaats(a, duur);
            s.terug = nieuwBlok({ ...basisBlok, soort: "reis", titel: `Reis terug van ${locatie(loc)?.naam || ""}`, a: new Date(b.eind), b: new Date(new Date(b.eind).getTime() + reis * MIN) });
            s.eindTaak = new Date(b.eind);
            gelukt = true; break;
          }
          if (gelukt) continue;
        }
        // 2. Vrij gat: eerst een gat waar het hele blok in past, anders een flink deel
        //    (op locatie: minstens zo lang blijven als je heen en terug reist)
        const heel = maxDuur();
        const deelMin = Math.min(rest, Math.max(inst.blokMin, 30, 2 * reis));
        // met reistijd: de taak zelf begint op een heel/half uur, de reis ervoor
        const begin = ([a]) => rondOp(new Date(a.getTime() + reis * MIN), R);
        const ruimteIn = (g) => minuten(begin(g), g[1]) - reis;
        const gatenDag = vensters.flatMap(([wa, wb]) => gaten(wa, wb));
        const g = gatenDag.find(x => ruimteIn(x) >= heel) || gatenDag.find(x => ruimteIn(x) >= deelMin);
        const duur = g ? Math.min(heel, Math.floor(ruimteIn(g) / 5) * 5) : 0;
        if (g && duur > 0 && duur >= Math.min(deelMin, heel)) {
          const aTaak = begin(g);
          if (reis) {
            const naam = locatie(loc)?.naam || "";
            nieuwBlok({ ...basisBlok, soort: "reis", titel: `Reis naar ${naam}`, a: new Date(aTaak.getTime() - reis * MIN), b: aTaak });
            const b = plaats(aTaak, duur);
            const terug = nieuwBlok({ ...basisBlok, soort: "reis", titel: `Reis terug van ${naam}`, a: new Date(b.eind), b: new Date(new Date(b.eind).getTime() + reis * MIN) });
            sessies.push({ loc, dag: dagStr(dag), eindTaak: new Date(b.eind), terug });
          } else plaats(aTaak, duur);
          gelukt = true;
        }
      }
    }
    eindVan[it.id] = rest > 0 ? null : laatste ? new Date(laatste.eind) : (d.planning.filter(b => b.item === it.id && b.soort !== "reis").map(b => new Date(b.eind)).sort((a, b) => b - a)[0] || start);
    if (rest > 0) waarschuwingen.push(`„${it.titel}”: nog ${rest} min die niet binnen ${inst.horizon} dagen past${ov.modus === "vast" ? ` in de vaste tijden van ${ov.naam}` : ""}.`);
    else if (deadline && laatste && dagStr(new Date(laatste.eind)) > deadline)
      waarschuwingen.push(it.streef && it.streef > deadline ? `„${it.titel}”: gepland na de deadline (${deadline}), zoals je streefdatum (${it.streef}) aangeeft.`
                                                            : `„${it.titel}”: past pas na de deadline (${deadline}).`);
  }
  werkGeplandBij(actieveOverzichten);
  return { blokken, waarschuwingen };
}

/** Zet op je eigen open taken wanneer ze ingepland staan, zodat wie erop wacht dat kan zien (gaat mee met de gedeelde lijst) */
export function werkGeplandBij(actieveOverzichten) {
  const d = opslag.d, nu = new Date();
  for (const t of d.taken) {
    if (t.status === "klaar" || !actieveOverzichten.includes(t.overzicht) || !isMijn(t)) continue;
    const bl = d.planning.filter(b => b.item === t.id && b.soort !== "reis" && new Date(b.eind) > nu);
    const g = bl.length ? { van: bl.map(b => b.start).sort()[0], tot: bl.map(b => b.eind).sort().at(-1) } : null;
    if (JSON.stringify(g) === JSON.stringify(t.gepland || null)) continue;
    if (g) t.gepland = g; else delete t.gepland;
  }
}

// ---------- per taak: hoe staat het met inplannen, en zelf een plek kiezen ----------
/** Correctie op schattingen uit je eigen historie (zoals het automatisch inplannen die gebruikt) */
export function schatFactor(ovId) {
  if (!opslag.d.instellingen.kalibratie) return 1;
  return Math.min(2, Math.max(0.8, kalibratie(ovId).factor || 1));
}
/** Hoeveel minuten er voor dit item nog ingepland moeten worden in totaal (schatting × factor − al gewerkt) */
export function nogNodig(it) {
  return Math.max(0, Math.round(((it.schatting || 30) * schatFactor(it.overzicht) - (it.werkelijk || 0)) / 5) * 5);
}
// eigen blokken, plus wat een gelinkt account (bijv. werk ↔ privé) voor dezelfde taak heeft ingepland
const blokkenVan = (id, nu = new Date()) => [...opslag.d.planning, ...familieHaak.agenda().planning.map(b => ({ ...b, vanFamilie: b.vanFamilie || true }))]
  .filter(b => b.item === id && b.soort !== "reis" && new Date(b.eind) > nu)
  .filter((b, i, l) => l.findIndex(x => x.id === b.id) === i)
  .sort((a, b) => a.start.localeCompare(b.start));

/**
 * Staat dit item ingepland?
 *   ja     — alle nog benodigde tijd staat in de agenda (of een ander/gelinkt account heeft het ingepland)
 *   deels  — een deel staat erin
 *   niet   — nog niets in de toekomst
 *   klaar  — afgerond
 */
export function planStatus(it, nu = new Date()) {
  if (it.status === "klaar") return { soort: "klaar" };
  const bl = blokkenVan(it.id, nu);
  const nodig = nogNodig(it);
  if (!bl.length) {
    // door een ander (toegewezen) of door je gelinkte account ingepland: dat staat op de taak zelf
    if ((!isMijn(it) || vanGelinkt(it.overzicht)) && it.gepland?.tot && new Date(it.gepland.tot) > nu) return { soort: "ja", elders: true, van: it.gepland.van, nodig, min: nodig, rest: 0, blokken: [] };
    return { soort: "niet", nodig, min: 0, rest: nodig, blokken: [] };
  }
  const min = bl.reduce((s, b) => s + minuten(new Date(b.start), new Date(b.eind)), 0);
  const rest = Math.max(0, nodig - min);
  return { soort: rest <= 5 ? "ja" : "deels", van: bl[0].start, nodig, min, rest, blokken: bl };
}

// Alles wat tijd bezet rond een moment (afspraken, planning, gelinkte accounts), behalve de blokken van één item
function bezetBehalve(itemId, negeer = null) {
  const d = opslag.d, f = familieHaak.agenda();
  return [
    ...d.bezet.filter(ev => eventSoort(ev) === "bezet" && !ev.eigen).map(ev => ({ a: new Date(ev.start), b: new Date(ev.eind), titel: ev.titel || "Afspraak" })),
    ...d.planning.filter(b => (!itemId || b.item !== itemId) && !(negeer && negeer(b))).map(b => ({ a: new Date(b.start), b: new Date(b.eind), titel: b.titel || "Gepland", reis: b.soort === "reis" })),
    ...f.bezet.filter(ev => ev.soortF === "bezet" && !ev.eigen).map(ev => ({ a: new Date(ev.start), b: new Date(ev.eind), titel: ev.titel || "Afspraak (gelinkt account)" })),
    ...f.planning.map(b => ({ a: new Date(b.start), b: new Date(b.eind), titel: b.titel || "Gepland (gelinkt account)", reis: b.soort === "reis" })),
  ];
}
/** Waar en met hoeveel reistijd een item wordt gedaan */
export function plekVan(it) {
  const ov = effLijst(overzicht(it.overzicht)), p = it.project ? project(it.project) : null;
  const eigenLoc = it.locatie || p?.locatie || "";
  const loc = ov?.modus === "vast" ? eigenLoc : effectieveLocatie(it);
  return { ov, eigenLoc, loc, reis: ov?.modus === "vrij" ? reisVan(loc) : 0 };
}
/** Lijsten van een gelinkt account worden door dat account zelf ingepland */
export const doorGelinktIngepland = (it) => vanGelinkt(it.overzicht);

/**
 * Voorstellen: de vrije gaten van minstens `minDuur` minuten, binnen je beschikbaarheid (vrije tijd, of de vaste tijden
 * van de lijst), om afspraken (niet die op "vrij"), andere geplande blokken, reistijd en afwijkingen heen.
 * Elk voorstel beslaat het hele gat (begin op een heel of half uur tot het volgende item); inkorten kan bij het plaatsen.
 * @returns {{a:Date, b:Date, duur:number, reis:number, loc:string, naDeadline:boolean, dag:string}[]}
 */
export function voorstellen(it, minDuur, { aantal = 16, dagen = 28, vanaf = new Date(), negeer = null, hierAl = false } = {}) {
  const d = opslag.d, R = raster(), buf = (d.instellingen.buffer || 0) * MIN;
  let { ov, eigenLoc, loc, reis } = plekVan(it);
  if (hierAl) { eigenLoc = ""; reis = 0; }                   // "ik ben er toch al": geen plek-eis, geen reistijd
  if (!ov || !(minDuur > 0)) return [];
  const start = rondOp(new Date(Math.max(vanaf, Date.now())), R);
  const bezet = bezetBehalve(it.id, negeer);
  // waar dit item op wacht: pas daarna
  let na = start;
  for (const id of it.wachtOp || []) {
    const v = taak(id); if (!v || v.status === "klaar") continue;
    const eind = d.planning.filter(b => b.item === id && b.soort !== "reis").map(b => new Date(b.eind)).sort((a, b) => b - a)[0];
    if (eind && eind > na) na = rondOp(new Date(eind.getTime() + buf), R);
  }
  const deadline = harde(it);
  const uit = [];
  for (let i = 0; i < dagen && uit.length < aantal; i++) {
    const dag = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const I = dagIndeling(dag);
    const extra = [...I.reis.map(r => ({ a: r.a, b: r.b, reis: true })), ...I.elders.map(r => ({ a: r.a, b: r.b }))];
    const vensters = werkmomenten(I, ov, eigenLoc, hierAl).map(([a, b]) => [a < na ? na : a, b]).filter(([a, b]) => b - a >= 5 * MIN);
    for (const [wa, wb] of vensters) for (const [ga, gb] of vrijeGaten(wa, wb, [...bezet, ...extra], R, buf)) {
      const a = rondOp(new Date(ga.getTime() + reis * MIN), R), b = new Date(gb.getTime() - reis * MIN);
      const duur = Math.floor(minuten(a, b) / 5) * 5;
      if (duur < minDuur || uit.length >= aantal) continue;
      const eind = new Date(a.getTime() + duur * MIN);
      uit.push({ a, b: eind, duur, reis, loc, dag: dagStr(dag), naDeadline: !!deadline && dagStr(eind) > deadline });
    }
  }
  return uit;
}

/**
 * Het grootste echt beschikbare gat (in minuten) voor dit item tussen van en tot: binnen je beschikbaarheid of de vaste
 * tijden van de lijst, na aftrek van afspraken, wat al gepland staat, reistijd en afwijkingen. Telt pas vanaf nu.
 */
export function grootsteGat(it, van, tot) {
  const dagen = Math.ceil((tot - van) / 864e5) + 1;
  return voorstellen(it, 5, { vanaf: van, dagen, aantal: 500 }).filter(v => v.a < tot)
    .reduce((m, v) => Math.max(m, Math.floor(minuten(v.a, v.b < tot ? v.b : tot) / 5) * 5), 0);
}

/** Wat botst er met dit tijdvak (afspraken, andere blokken, en of het buiten je beschikbaarheid valt) */
export function botsingen(it, a, b, { blokkenMogenWijken = false } = {}) {
  const uit = bezetBehalve(it.id, blokkenMogenWijken ? (x) => !!x.item || x.soort === "uitloop" : null).filter(x => !x.reis && x.a < b && x.b > a).map(x => `${x.titel} ${tijdStr(x.a)}–${tijdStr(x.b)}`);
  const I = dagIndeling(new Date(a.getFullYear(), a.getMonth(), a.getDate()));
  const { ov } = plekVan(it);
  if (I.weg) uit.push(`je bent die dag weg${I.weg.reden ? " (" + I.weg.reden + ")" : ""}`);
  for (const e of I.elders) if (e.a < b && e.b > a) uit.push(`${e.reden || "cursus/elders"} ${tijdStr(e.a)}–${tijdStr(e.b)}`);
  const binnen = (ov?.modus === "vast" ? I.vast.filter(v => v.lijst === ov.id).map(v => [v.a, v.b]) : I.beschikbaar).some(([x, y]) => x <= a && y >= b);
  if (!binnen && !I.weg) uit.push(ov?.modus === "vast" ? `buiten de vaste tijden van ${ov.naam}` : "buiten je beschikbaarheid");
  return uit;
}
const tijdStr = (x) => String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0");

/**
 * Zet zelf een blok in de planning (vastgezet, dus automatisch inplannen laat het staan), met reistijd ervoor en erna.
 * Nog niet vastgezette (automatisch ingeplande) toekomstige blokken van dit item vervallen: jij kiest nu zelf.
 */
export function plaatsBlok(it, a, duur, agenda, { hierAl = false } = {}) {
  const d = opslag.d, nu = new Date();
  const p = plekVan(it), loc = p.loc, reis = hierAl ? 0 : p.reis;
  const vervallen = d.planning.filter(b => b.item === it.id && !b.vast && new Date(b.eind) > nu);
  d.planning = d.planning.filter(b => !vervallen.includes(b));
  const basis = { item: it.id, type: it.type, overzicht: it.overzicht, titel: blokTitel(it), locatie: loc, vast: true, handmatig: true, ...(agenda ? { agenda } : {}) };
  const b = { id: uid(), ...basis, start: a.toISOString(), eind: new Date(a.getTime() + duur * MIN).toISOString() };
  if (reis) {
    const naam = locatie(loc)?.naam || "";
    d.planning.push({ id: uid(), ...basis, soort: "reis", titel: `Reis naar ${naam}`, start: new Date(a.getTime() - reis * MIN).toISOString(), eind: b.start });
  }
  d.planning.push(b);
  if (reis) d.planning.push({ id: uid(), ...basis, soort: "reis", titel: `Reis terug van ${locatie(loc)?.naam || ""}`, start: b.eind, eind: new Date(new Date(b.eind).getTime() + reis * MIN).toISOString() });
  werkGeplandBij(d.overzichten.map(o => o.id));
  return { blok: b, vervallen: vervallen.filter(x => x.soort !== "reis").length };
}
// ---------- voorrang voor Doen, en schuiven ----------
/** Werkmomenten van een lijst op een dag: de vaste tijden (op de juiste plek), of de vrije tijd */
function werkmomenten(I, ov, eigenLoc = "", hierAl = false) {
  if (ov.modus !== "vast") return I.vrij;
  const v = I.vast.filter(x => x.lijst === ov.id && (!eigenLoc || hierAl || x.locatie === eigenLoc)).map(x => [x.a, x.b]);
  return v.length || !hierAl ? v : aftrekken(I.beschikbaar, [...I.vast, ...I.elders].map(x => [x.a, x.b]));
}
/** Het werkmoment waar een tijdstip in valt (voor dit item), of de rest van die dag */
function werkmomentRond(it, t, hierAl = false) {
  const dag = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  const { ov, eigenLoc } = plekVan(it);
  const w = ov ? werkmomenten(dagIndeling(dag), ov, eigenLoc, hierAl).find(([a, b]) => a <= t && b > t) : null;
  return w || [t, new Date(dag.getTime() + 864e5)];
}
const itemVan = (b) => taak(b.item) || project(b.item);
/** Mag dit blok wijken voor een Doen-taak? Alles behalve andere Doen-taken (en reserve voor uitloop mag altijd). */
export function wijkbaar(b) {
  if (b.soort === "uitloop") return true;
  const it = itemVan(b);
  return !!it && kwadrant(it) !== "doen";
}
// Een blok met de reistijd die er direct aan vast zit, als één geheel om te verschuiven
function eenheden(blokken) {
  const d = opslag.d;
  return blokken.filter(b => b.soort !== "reis").sort((x, y) => x.start.localeCompare(y.start)).map(b => {
    const heen = d.planning.find(x => x.soort === "reis" && x.item === b.item && x.eind === b.start) || null;
    const terug = d.planning.find(x => x.soort === "reis" && x.item === b.item && x.start === b.eind) || null;
    const min = (x) => x ? minuten(new Date(x.start), new Date(x.eind)) : 0;
    return { blok: b, heen, terug, duur: minuten(new Date(b.start), new Date(b.eind)), rh: min(heen), rt: min(terug) };
  });
}
const zetTijd = (e, a) => {          // eenheid naar begintijd a (van het blok zelf) verplaatsen
  const b = new Date(a.getTime() + e.duur * MIN);
  e.blok.start = a.toISOString(); e.blok.eind = b.toISOString();
  if (e.heen) { e.heen.start = new Date(a - e.rh * MIN).toISOString(); e.heen.eind = e.blok.start; }
  if (e.terug) { e.terug.start = e.blok.eind; e.terug.eind = new Date(b.getTime() + e.rt * MIN).toISOString(); }
};
const delenVan = (e) => [e.blok, e.heen, e.terug].filter(Boolean);
/**
 * Eenheden achter elkaar zetten vanaf `van`, binnen [van, tot), om alles heen wat vast ligt. Geeft terug wat niet meer past.
 * Wordt gebruikt om op te schuiven (naar achteren of naar voren).
 */
function pak(eenhedenLijst, van, tot) {
  const d = opslag.d, R = raster(), buf = (d.instellingen.buffer || 0) * MIN;
  const bewegend = new Set(eenhedenLijst.flatMap(delenVan).map(x => x.id));
  const dag = new Date(van.getFullYear(), van.getMonth(), van.getDate());
  const I = dagIndeling(dag);
  const vast = [...bezetBehalve(null, (b) => bewegend.has(b.id)), ...I.reis.map(r => ({ a: r.a, b: r.b, reis: true })), ...I.elders.map(r => ({ a: r.a, b: r.b }))];
  const over = []; let c = van;
  for (const e of eenhedenLijst) {
    const g = vrijeGaten(c, tot, vast, R, buf).find(([ga, gb]) => { const a = rondOp(new Date(ga.getTime() + e.rh * MIN), R); return a.getTime() + (e.duur + e.rt) * MIN <= gb.getTime(); });
    if (!g) { over.push(e); continue; }
    const a = rondOp(new Date(g[0].getTime() + e.rh * MIN), R);
    zetTijd(e, a);
    vast.push({ a: new Date(e.heen ? e.heen.start : e.blok.start), b: new Date(e.terug ? e.terug.eind : e.blok.eind) });
    c = new Date(e.terug ? e.terug.eind : e.blok.eind);
  }
  for (const e of over) d.planning = d.planning.filter(x => !delenVan(e).includes(x));
  return over;
}

/**
 * Een Doen-taak met voorrang inplannen: op het eerste moment dat kan, waarbij andere (niet-Doen) blokken wijken.
 *   modus "weg"    — wat in de weg zit gaat uit de planning (komt terug in `weg`, om later opnieuw in te plannen)
 *   modus "schuif" — wat in de weg zit en wat erna komt in hetzelfde werkmoment schuift op; wat niet meer past staat in `over`
 *   modus "kijk"   — niets veranderen, alleen laten zien wat er zou gebeuren
 * hierAl: je bent (toch) al op de plek van de taak — dan kan het vandaag, zonder reistijd.
 */
export function metVoorrang(it, { modus = "kijk", hierAl = false } = {}) {
  const d = opslag.d, inst = d.instellingen;
  const st = planStatus(it), nodig = Math.max(raster(), st.rest || nogNodig(it) || 30);
  const v = voorstellen(it, Math.min(nodig, Math.max(inst.blokMin || 15, 30)), { negeer: wijkbaar, hierAl, aantal: 1, dagen: hierAl ? 1 : 28 })[0];
  if (!v) return { gevonden: false };
  const duur = Math.min(nodig, v.duur, Math.max(inst.blokMax || 90, nodig));   // Doen: liefst in één keer
  const a = v.a, b = new Date(a.getTime() + duur * MIN);
  const reis = hierAl ? 0 : plekVan(it).reis;
  const bezetVan = new Date(a - reis * MIN), bezetTot = new Date(b.getTime() + reis * MIN);
  const raak = (x) => new Date(x.start) < bezetTot && new Date(x.eind) > bezetVan;
  const inDeWeg = d.planning.filter(x => x.item !== it.id && wijkbaar(x) && x.soort !== "reis" && raak(x));
  const uit = { gevonden: true, a, b, duur, rest: Math.max(0, nodig - duur), inDeWeg, weg: [], over: [], verschoven: [], blok: null };
  if (modus === "kijk") return uit;
  const [wa, wb] = werkmomentRond(it, a, hierAl);
  // na: wat in hetzelfde werkmoment op of na het nieuwe blok komt (alleen wat mag wijken)
  const erna = modus === "schuif" ? d.planning.filter(x => x.item !== it.id && wijkbaar(x) && x.soort !== "reis" && x.soort !== "uitloop"
    && new Date(x.eind) > bezetVan && new Date(x.start) < wb && new Date(x.start) >= wa) : [];
  // reserve voor uitloop in de weg: die tijd is precies hiervoor
  for (const x of d.planning.filter(x => x.soort === "uitloop" && raak(x))) d.planning = d.planning.filter(y => y !== x);
  if (modus === "weg") for (const x of inDeWeg.filter(x => x.soort !== "uitloop")) { uit.weg.push(x); haalBlokWeg(x); }
  const e = eenheden(erna);
  // eerst uit de weg (zodat het nieuwe blok vrij ligt), dan het nieuwe blok, dan alles erachter aan
  for (const x of e) for (const y of delenVan(x)) y._oud = y.start;
  const tijdelijk = e.flatMap(delenVan);
  d.planning = d.planning.filter(x => !tijdelijk.includes(x));
  uit.blok = plaatsBlok(it, a, duur, undefined, { hierAl }).blok;
  d.planning.push(...tijdelijk);
  if (e.length) {
    uit.over = pak(e, new Date(uit.blok.eind), wb).map(x => x);
    uit.verschoven = e.filter(x => !uit.over.includes(x) && x.blok._oud !== x.blok.start).map(x => x.blok);
  }
  for (const x of tijdelijk) delete x._oud;
  werkGeplandBij(d.overzichten.map(o => o.id));
  return uit;
}
/**
 * Ruimte maken op [a, b) voor een item: eigen blokken van andere taken die daar staan gaan eruit (met hun reistijd) en
 * komen terug als eenheden, om daarna met plaatsVanaf() naar het volgende vrije moment te schuiven. Reserve (uitloop) vervalt.
 */
export function maakRuimte(itemId, a, b) {
  const d = opslag.d;
  const raak = d.planning.filter(x => x.item !== itemId && x.soort !== "reis" && new Date(x.start) < b && new Date(x.eind) > a);
  d.planning = d.planning.filter(x => !(x.soort === "uitloop" && raak.includes(x)));
  const e = eenheden(raak.filter(x => x.item && x.soort !== "uitloop"));
  const delen = e.flatMap(delenVan);
  d.planning = d.planning.filter(x => !delen.includes(x));
  return e;
}
/** Mag het blok `b` opzij voor item `it` met een deadline? Alleen taken zonder deadline of met een latere (Doen zonder deadline niet). */
export function magWijkenVoor(it, b) {
  if (b.soort === "uitloop") return true;
  const x = itemVan(b); if (!x || x.id === it.id || x.status === "klaar") return false;
  const mijn = harde(it), hun = harde(x);
  if (!mijn || (hun && hun <= mijn)) return false;
  if (kwadrant(x) === "doen" && !hun) return false;
  return true;
}
/**
 * Plaatsen op [a, a+duur); wat er staat (eigen blokken van andere taken) schuift door naar het volgende lege moment.
 * Haalt een doorgeschoven taak daardoor zijn deadline niet meer, dan wordt alles teruggedraaid en komt dat in `probleem`
 * (tenzij forceer: dan blijft het zo, met het probleem erbij gemeld).
 * @returns {{ok:boolean, blok?:object, vervallen?:number, geschoven:object[], niet:object[], probleem:{item:object, deadline:string, tot:string|null}[]}}
 */
export function plaatsMetWijken(it, a, duur, agenda, { wijken = true, forceer = false } = {}) {
  const d = opslag.d, b = new Date(a.getTime() + duur * MIN);
  const terug = d.planning.map(x => ({ ...x }));
  const e = wijken ? maakRuimte(it.id, a, b) : [];
  const r = plaatsBlok(it, a, duur, agenda);
  const niet = e.length ? plaatsVanaf(e, b) : [];
  const probleem = [];
  for (const u of e) {
    const x = itemVan(u.blok), dl = x && harde(x); if (!dl || probleem.some(p => p.item === x)) continue;
    const laatste = d.planning.filter(p => p.item === x.id && p.soort !== "reis").map(p => dagStr(new Date(p.eind))).sort().at(-1) || null;
    if (niet.includes(u) || (laatste && laatste > dl)) probleem.push({ item: x, deadline: dl, tot: niet.includes(u) ? null : laatste });
  }
  if (probleem.length && !forceer) { d.planning = terug; werkGeplandBij(d.overzichten.map(o => o.id)); return { ok: false, probleem, geschoven: [], niet: [] }; }
  return { ok: true, blok: r.blok, vervallen: r.vervallen, geschoven: e.filter(u => !niet.includes(u)), niet, probleem };
}
/** Volgende werkmomenten (vrije stukken) voor dit item vanaf een tijdstip — om aan te wijzen waar opgeschoven werk heen gaat */
export function volgendeMomenten(it, vanaf, minDuur = 15, aantal = 8) {
  return voorstellen(it, minDuur, { vanaf, aantal, dagen: 28 });
}
/** Eenheden (uit metVoorrang().over) vanaf een gekozen moment achter elkaar zetten, steeds op de eerstvolgende plek die past */
export function plaatsVanaf(over, vanaf) {
  const d = opslag.d; let c = vanaf; const niet = [];
  for (const e of over) {
    const it = itemVan(e.blok) || null;
    const v = it ? voorstellen(it, e.duur, { vanaf: c, aantal: 1, dagen: 60 })[0] : null;
    if (!v) { niet.push(e); continue; }
    zetTijd(e, v.a); d.planning.push(...delenVan(e));
    c = new Date(e.terug ? e.terug.eind : e.blok.eind);
  }
  werkGeplandBij(d.overzichten.map(o => o.id));
  return niet;
}

/**
 * Tijd die vrijkomt als je een taak eerder afrondt (vóór afronden opvragen): wat er nog over is van het lopende blok,
 * of anders het eerstvolgende blok. Plus de overige toekomstige blokken van die taak.
 */
export function vrijkomend(it, nu = new Date()) {
  const R = raster();
  const bl = opslag.d.planning.filter(b => b.item === it.id && b.soort !== "reis" && new Date(b.eind) > nu).sort((a, b) => a.start.localeCompare(b.start));
  if (!bl.length) return null;
  const eerste = bl[0], a = new Date(Math.max(new Date(eerste.start), rondOp(nu, R))), b = new Date(eerste.eind);
  if (minuten(a, b) < 15) return null;
  return { a, b, min: minuten(a, b), blok: eerste, lopend: new Date(eerste.start) < nu, overig: bl.slice(1) };
}
/**
 * Na eerder afronden: wat te doen met [a, b)?
 *   vrij     — tijd vrijlaten
 *   uitloop  — reserveren als uitloop (blijft in je agenda staan)
 *   schuif   — alles erna in hetzelfde werkmoment naar voren; aan het eind (optioneel) uitloop reserveren
 * @returns {{verschoven: object[], uitloop: object|null}}
 */
export function vrijeTijd(it, v, keuze, { uitloopAchteraan = true } = {}) {
  const d = opslag.d;
  const blok = d.planning.find(x => x.id === v.blok.id);
  // het blok zelf inkorten tot nu (lopend) of weghalen (nog niet begonnen)
  if (blok) {
    if (v.lopend) { blok.eind = v.a.toISOString(); const t = d.planning.find(x => x.soort === "reis" && x.item === it.id && x.start === v.b.toISOString()); if (t) { const dur = new Date(t.eind) - new Date(t.start); t.start = blok.eind; t.eind = new Date(new Date(blok.eind).getTime() + dur).toISOString(); } }
    else haalBlokWeg(blok);
  }
  for (const x of v.overig) { const y = d.planning.find(z => z.id === x.id); if (y) haalBlokWeg(y); }
  const reserve = (a, b) => {
    if (minuten(a, b) < 15) return null;
    const r = { id: uid(), soort: "uitloop", titel: "Uitloop (gereserveerd)", overzicht: it.overzicht, start: a.toISOString(), eind: b.toISOString(), vast: true };
    d.planning.push(r); return r;
  };
  let uitloop = null, verschoven = [];
  if (keuze === "uitloop") uitloop = reserve(v.a, v.b);
  if (keuze === "schuif") {
    const [wa, wb] = werkmomentRond(it, v.a);
    const erna = d.planning.filter(x => x.soort !== "reis" && x.soort !== "uitloop" && wijkbaarOfEigen(x) && new Date(x.start) >= v.a && new Date(x.start) < wb && new Date(x.start) >= wa);
    const e = eenheden(erna);
    const oud = new Map(e.map(x => [x.blok.id, x.blok.start]));
    const laatsteEind = e.length ? new Date(Math.max(...e.map(x => new Date(x.terug ? x.terug.eind : x.blok.eind)))) : v.b;
    const over = pak(e, v.a, wb);
    for (const x of over) d.planning.push(...delenVan(x));             // past altijd (het schuift alleen naar voren); voor de zekerheid terug
    verschoven = e.filter(x => oud.get(x.blok.id) !== x.blok.start).map(x => x.blok);
    const nieuwEind = e.length ? new Date(Math.max(...e.map(x => new Date(x.terug ? x.terug.eind : x.blok.eind)))) : v.a;
    if (uitloopAchteraan) uitloop = reserve(nieuwEind, laatsteEind > nieuwEind ? laatsteEind : v.b);
  }
  werkGeplandBij(d.overzichten.map(o => o.id));
  return { verschoven, uitloop };
}
// Naar voren schuiven mag met alle eigen blokken (ook Doen): ze komen alleen eerder, nooit later
const wijkbaarOfEigen = (b) => !!itemVan(b);

/** Een blok (met de reistijd die erbij hoort) weer uit de planning halen */
export function haalBlokWeg(b) {
  const d = opslag.d;
  const reisErbij = d.planning.filter(x => x.item === b.item && x.soort === "reis" && (x.eind === b.start || x.start === b.eind));
  d.planning = d.planning.filter(x => x !== b && !reisErbij.includes(x));
  werkGeplandBij(d.overzichten.map(o => o.id));
}

// ---------- links naar agenda's ----------
const icsTijd = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function omschrijving(b) {
  const it = opslag.d.taken.find(t => t.id === b.item) || opslag.d.projecten.find(p => p.id === b.item);
  const regels = [b.soort === "reis" ? "Reistijd (Tijdkompas)" : "Ingepland door Tijdkompas"];
  if (b.locatie && locatie(b.locatie)) regels.push("Locatie: " + locatie(b.locatie).naam);
  if (it?.project) regels.push("Project: " + (project(it.project)?.titel || ""));
  if (it?.notitie) regels.push(it.notitie);
  (it?.links || []).forEach(l => regels.push(`${l.label || linkInfo(l.url).label}: ${l.url}`));
  return regels.join("\n");
}

export function googleLink(b) {
  const q = new URLSearchParams({ action: "TEMPLATE", text: b.titel, dates: `${icsTijd(b.start)}/${icsTijd(b.eind)}`, details: omschrijving(b) });
  return "https://calendar.google.com/calendar/render?" + q;
}
export function outlookLink(b, zakelijk = true) {
  const q = new URLSearchParams({ subject: b.titel, startdt: new Date(b.start).toISOString(), enddt: new Date(b.eind).toISOString(), body: omschrijving(b), path: "/calendar/action/compose", rru: "addevent" });
  return (zakelijk ? "https://outlook.office.com" : "https://outlook.live.com") + "/calendar/0/deeplink/compose?" + q;
}

// ---------- .ics export ----------
const icsTekst = (s) => String(s).replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, m => "\\" + m);
export function maakIcs(blokken) {
  const r = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tijdkompas//NL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  const nu = icsTijd(new Date().toISOString());
  for (const b of blokken) {
    r.push("BEGIN:VEVENT", `UID:${b.id}@tijdkompas`, `DTSTAMP:${nu}`, `DTSTART:${icsTijd(b.start)}`, `DTEND:${icsTijd(b.eind)}`,
           `SUMMARY:${icsTekst(b.titel)}`, `DESCRIPTION:${icsTekst(omschrijving(b))}`, "TRANSP:OPAQUE", "END:VEVENT");
  }
  r.push("END:VCALENDAR");
  return r.join("\r\n");
}

// ---------- .ics voor een abonneer-link (bijv. je werkagenda in Outlook of via Copilot) ----------
// Alle blokken staan op "vrij" (TRANSP:TRANSPARENT én de Outlook-variant), zodat ze je agenda niet blokkeren
// en Tijdkompas ze bij het ophalen ook niet als bezet ziet. Vaste UID per blok: een wijziging wordt een update, geen dubbele.
const vouw = (regel) => {                      // regels van hooguit 75 bytes (RFC 5545), vervolg met een spatie
  const uit = []; let rest = regel, eerste = true;
  const enc = new TextEncoder();
  while (enc.encode(rest).length > (eerste ? 75 : 74)) {
    let n = Math.min(rest.length, eerste ? 75 : 74);
    while (enc.encode(rest.slice(0, n)).length > (eerste ? 75 : 74) || /[\uD800-\uDBFF]/.test(rest[n - 1])) n--;
    uit.push((eerste ? "" : " ") + rest.slice(0, n)); rest = rest.slice(n); eerste = false;
  }
  uit.push((eerste ? "" : " ") + rest);
  return uit.join("\r\n");
};
const icsVeilig = (s) => icsTekst(String(s ?? "").replace(/\r/g, "").slice(0, 300));
/** @returns {{ics:string, kern:string}} kern = zonder tijdstempel, om te zien of er echt iets veranderd is */
export function maakFeedIcs(blokken, { naam = "Tijdkompas", titels = true } = {}) {
  const nu = icsTijd(new Date().toISOString());
  const kop = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tijdkompas//NL", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
               `X-WR-CALNAME:${icsVeilig(naam)}`, "X-PUBLISHED-TTL:PT1H", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"];
  const evs = [...blokken].sort((a, b) => String(a.start).localeCompare(String(b.start)) || String(a.id).localeCompare(String(b.id))).map(b => {
    const loc = titels && b.locatie && b.locatie !== "thuis" ? locatie(b.locatie)?.naam || "" : "";
    const titel = !titels ? (b.soort === "reis" ? "Reistijd" : "Werkblok") : (b.soort === "reis" ? "🚗 " : "") + (b.titel || "Werkblok");
    return ["BEGIN:VEVENT", `UID:${String(b.id).replace(/[^A-Za-z0-9_-]/g, "")}@tijdkompas`, "DTSTAMP:@@NU@@", `DTSTART:${icsTijd(b.start)}`, `DTEND:${icsTijd(b.eind)}`,
            `SUMMARY:${icsVeilig(titel)}`, ...(loc ? [`LOCATION:${icsVeilig(loc)}`] : []),
            `DESCRIPTION:${icsVeilig(b.soort === "reis" ? "Reistijd, ingepland door Tijdkompas" : "Ingepland door Tijdkompas (staat op vrij)")}`,
            "CATEGORIES:Tijdkompas", "TRANSP:TRANSPARENT", "X-MICROSOFT-CDO-BUSYSTATUS:FREE", "X-MICROSOFT-CDO-INTENDEDSTATUS:FREE", "END:VEVENT"];
  }).flat();
  const regels = [...kop, ...evs, "END:VCALENDAR"].map(vouw);
  const kern = regels.join("\r\n");
  return { ics: kern.replaceAll("@@NU@@", nu) + "\r\n", kern };
}

// ---------- .ics import (bezette tijden) ----------
function leesIcsDatum(waarde, params) {
  const m = waarde.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, j, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { datum: true };
  if (z) return new Date(Date.UTC(+j, mo - 1, +d, +h, +mi, +s));
  return new Date(+j, mo - 1, +d, +h, +mi, +s); // TZID/zwevend: als lokale tijd lezen
}

// .ics lezen, met herhalende afspraken (RRULE: dagelijks/wekelijks/maandelijks/jaarlijks, INTERVAL, COUNT, UNTIL, BYDAY,
// BYMONTHDAY), uitzonderingen (EXDATE), verplaatste losse keren (RECURRENCE-ID) en afgezegde afspraken.
// Alleen afspraken met een tijd (geen hele dagen), van gisteren tot 60 dagen vooruit.
const ICS_DAG = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
export function leesIcs(tekst, bron = "agenda", { van = new Date(Date.now() - 864e5), tot = new Date(Date.now() + 60 * 864e5) } = {}) {
  const regels = tekst.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const evs = []; let ev = null;
  const ontsnap = (w) => w.replace(/\\([,;\\])/g, "$1").replace(/\\n/gi, " ");
  for (const regel of regels) {
    if (regel === "BEGIN:VEVENT") ev = { ex: [] };
    else if (regel === "END:VEVENT") { if (ev) evs.push(ev); ev = null; }
    else if (ev) {
      const i = regel.indexOf(":"); if (i < 0) continue;
      const [naam, ...params] = regel.slice(0, i).split(";"); const waarde = regel.slice(i + 1);
      if (naam === "DTSTART") ev.start = leesIcsDatum(waarde, params);
      else if (naam === "DTEND") ev.eind = leesIcsDatum(waarde, params);
      else if (naam === "DURATION") ev.duur = waarde;
      else if (naam === "SUMMARY") ev.titel = ontsnap(waarde);
      else if (naam === "TRANSP") ev.transp = waarde;
      else if (naam === "X-MICROSOFT-CDO-BUSYSTATUS" || naam === "X-MICROSOFT-CDO-INTENDEDSTATUS") ev.ms = waarde.toUpperCase();   // Outlook: vrij/bezet
      else if (naam === "STATUS") ev.status = waarde;
      else if (naam === "LOCATION") ev.plaats = ontsnap(waarde);
      else if (naam === "RRULE") ev.rrule = waarde;
      else if (naam === "UID") ev.uid = waarde;
      else if (naam === "RECURRENCE-ID") ev.rid = leesIcsDatum(waarde, params);
      else if (naam === "EXDATE") for (const w of waarde.split(",")) { const x = leesIcsDatum(w, params); if (x instanceof Date) ev.ex.push(x.getTime()); }
    }
  }
  const uit = [];
  const neem = (e, start, eind, herhalend) => {
    if (e.transp === "TRANSPARENT" || e.ms === "FREE" || e.status === "CANCELLED") return;   // op "vrij" gezet: die tijd is te gebruiken
    if (eind <= van || start >= tot) return;
    uit.push({ id: uid(), start: start.toISOString(), eind: eind.toISOString(), titel: e.titel || "Bezet", plaats: e.plaats || "", bron, herhalend });
  };
  // verplaatste of aangepaste losse keren van een herhaling
  const vervangen = new Set(evs.filter(e => e.rid instanceof Date && e.uid).map(e => e.uid + "|" + e.rid.getTime()));
  for (const e of evs) {
    if (!(e.start instanceof Date)) continue;                       // hele dag of onleesbaar
    let duur = e.eind instanceof Date ? e.eind - e.start : leesDuurIcs(e.duur);
    if (!(duur > 0)) duur = 30 * 60000;
    if (e.rid instanceof Date || !e.rrule) { neem(e, e.start, new Date(e.start.getTime() + duur), !!e.rid); continue; }
    for (const t of herhalingen(e.start, e.rrule, tot)) {
      if (e.ex.includes(t.getTime()) || vervangen.has(e.uid + "|" + t.getTime())) continue;
      neem(e, t, new Date(t.getTime() + duur), true);
    }
  }
  return uit;
}
function leesDuurIcs(w) {
  const m = String(w || "").match(/^-?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const [, wk, d, h, mi, s] = m.map(x => +x || 0);
  return ((((wk * 7 + d) * 24 + h) * 60 + mi) * 60 + s) * 1000;
}
// Alle begintijden van een herhaling, vanaf start tot 'tot' (lokale kloktijd blijft gelijk, ook over zomer-/wintertijd)
function herhalingen(start, rrule, tot) {
  const r = Object.fromEntries(rrule.split(";").map(x => x.split("=")));
  const freq = r.FREQ, iv = Math.max(1, +r.INTERVAL || 1), max = r.COUNT ? +r.COUNT : Infinity;
  let eindT = tot;
  if (r.UNTIL) { const u = leesIcsDatum(r.UNTIL, []); if (u instanceof Date && u < eindT) eindT = u; else if (u?.datum) { const m = r.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/); const x = new Date(+m[1], m[2] - 1, +m[3], 23, 59, 59); if (x < eindT) eindT = x; } }
  const byday = (r.BYDAY || "").split(",").filter(Boolean).map(x => { const m = x.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/); return m ? { n: m[1] ? +m[1] : 0, dag: ICS_DAG[m[2]] } : null; }).filter(Boolean);
  const bymd = (r.BYMONTHDAY || "").split(",").filter(Boolean).map(Number);
  const uit = []; let n = 0;
  const op = (j, mo, d) => new Date(j, mo, d, start.getHours(), start.getMinutes(), start.getSeconds());
  const voeg = (t) => { if (t < start || t > eindT || n >= max) return; n++; uit.push(t); };
  for (let k = 0; k < 5000 && n < max; k++) {
    let kandidaten = [];
    if (freq === "DAILY") kandidaten = [op(start.getFullYear(), start.getMonth(), start.getDate() + k * iv)];
    else if (freq === "WEEKLY") {
      const ma = op(start.getFullYear(), start.getMonth(), start.getDate() - ((start.getDay() + 6) % 7) + k * 7 * iv);   // maandag van die week
      const dagen = byday.length ? byday.map(b => b.dag) : [start.getDay()];
      kandidaten = dagen.map(dg => op(ma.getFullYear(), ma.getMonth(), ma.getDate() + ((dg + 6) % 7)));
    } else if (freq === "MONTHLY" || freq === "YEARLY") {
      const j = freq === "YEARLY" ? start.getFullYear() + k * iv : start.getFullYear(), mo = freq === "YEARLY" ? start.getMonth() : start.getMonth() + k * iv;
      const eerste = new Date(j, mo, 1), jj = eerste.getFullYear(), mm = eerste.getMonth(), lengte = new Date(jj, mm + 1, 0).getDate();
      if (byday.length) for (const b of byday) {
        const dagen = []; for (let d = 1; d <= lengte; d++) if (new Date(jj, mm, d).getDay() === b.dag) dagen.push(d);
        const d = b.n > 0 ? dagen[b.n - 1] : b.n < 0 ? dagen[dagen.length + b.n] : null;
        if (d) kandidaten.push(op(jj, mm, d)); else if (!b.n) dagen.forEach(x => kandidaten.push(op(jj, mm, x)));
      }
      else for (const d of bymd.length ? bymd : [start.getDate()]) { const dd = d < 0 ? lengte + d + 1 : d; if (dd >= 1 && dd <= lengte) kandidaten.push(op(jj, mm, dd)); }
    } else break;
    kandidaten.sort((a, b) => a - b);
    if (kandidaten.length && kandidaten[0] > eindT) break;
    kandidaten.forEach(voeg);
  }
  return uit;
}
