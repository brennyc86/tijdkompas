// Tijdkompas — echte reistijden tussen adressen (afspraken met een locatie, kantoor, thuis)
//
// Met een Google Maps-sleutel (Routes API, instelling of CONFIG.mapsSleutel): Google. Zonder sleutel: OpenStreetMap
// (Nominatim om het adres te vinden, OSRM van openstreetmap.de voor de route) — gratis, zonder openbaar vervoer.
// Spits telt niet apart: daar is de marge om de reistijd voor (10%, minstens 15 min). Eén reistijd per adrespaar dus,
// bewaard in je Tijdkompas (d.reistijden, ook op je andere apparaten): eens berekend = klaar, en zelf aan te passen. Synchroon op te vragen (dagIndeling is synchroon): onbekend =
// null terug, de route wordt op de achtergrond gehaald en daarna wordt alles opnieuw getekend.

import { CONFIG } from "./config.js";
import { opslag, bewaar } from "./data.js";

const SLEUTEL_ROUTES = "tk_routes_v1", SLEUTEL_GEO = "tk_geo_v1", HOUDBAAR = 30 * 864e5, MISLUKT_OPNIEUW = 6 * 36e5;
export const VERVOER = { auto: { naam: "Auto", icoon: "🚗", g: "DRIVE", osm: "routed-car" }, fiets: { naam: "Fiets", icoon: "🚲", g: "BICYCLE", osm: "routed-bike" },
  ov: { naam: "Openbaar vervoer", icoon: "🚆", g: "TRANSIT", osm: null }, lopen: { naam: "Lopen", icoon: "🚶", g: "WALK", osm: "routed-foot" } };
export const routeStand = { bezig: 0, fout: "", bron: "" };

const lees = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch { return {}; } };
let routes = lees(SLEUTEL_ROUTES), geo = lees(SLEUTEL_GEO), bewaarTimer = null;
function bewaarCache() {
  clearTimeout(bewaarTimer);
  bewaarTimer = setTimeout(() => {
    const snoei = (o, max) => { const e = Object.entries(o); if (e.length > max) { e.sort((a, b) => (a[1].t || 0) - (b[1].t || 0)); for (const [k] of e.slice(0, e.length - max)) delete o[k]; } };
    snoei(routes, 1500); snoei(geo, 800);
    try { localStorage.setItem(SLEUTEL_ROUTES, JSON.stringify(routes)); localStorage.setItem(SLEUTEL_GEO, JSON.stringify(geo)); } catch {}
  }, 500);
}
/** Een adres met bekende coördinaten (gekozen in de adreszoeker): hoeft niet meer opgezocht te worden */
export function zetPlek(adres, lat, lon) {
  if (!adres || !isFinite(lat) || !isFinite(lon)) return;
  geo[norm(adres)] = { lat: +lat, lon: +lon, t: Date.now() };
  for (const k of Object.keys(routes)) if (routes[k].mis && k.includes(kaal(adres))) delete routes[k];   // eerder niet gevonden: opnieuw
  bewaarCache();
}
/** Opnieuw berekenen: berekende (niet zelf ingevulde) reistijden en de adrescache weg */
export function wisRoutes() {
  routes = {}; geo = {}; try { localStorage.removeItem(SLEUTEL_ROUTES); localStorage.removeItem(SLEUTEL_GEO); } catch {}
  for (const [k, x] of Object.entries(rt())) if (x.bron !== "zelf") delete rt()[k];
  bewaar();
}

let luisteraar = () => {};
export const opRoute = (f) => { luisteraar = f; };
let tekenTimer = null;
const later = () => { clearTimeout(tekenTimer); tekenTimer = setTimeout(() => luisteraar(), 400); };

export const mapsSleutel = () => { const s = opslag.d?.instellingen?.mapsSleutel || CONFIG.mapsSleutel || ""; return /^[A-Za-z0-9_-]{20,80}$/.test(s) ? s : ""; };
export const vervoer = () => VERVOER[opslag.d?.instellingen?.vervoer] ? opslag.d.instellingen.vervoer : "auto";
export const routesAan = () => opslag.d?.instellingen?.routes !== false;
/** Welke dienst rekent nu: google | osm | "" (uit, of ov zonder Google) */
export function bron() {
  if (!routesAan()) return "";
  if (mapsSleutel()) return "google";
  return VERVOER[vervoer()].osm ? "osm" : "";
}

/** Is dit een plek waar je heen moet (en niet Teams, Zoom, een link of "online")? */
export function isFysiek(plaats) {
  const t = String(plaats || "").trim();
  if (t.length < 3 || t.length > 200) return false;
  return !/(https?:\/\/|www\.|teams|zoom|meet\.google|google meet|webex|skype|whereby|jitsi|online|virtueel|virtual|telefo|bellen|n\.v\.t|nvt|^-+$)/i.test(t);
}
/**
 * Lijkt deze locatie op een kamer of zaal (in een gebouw) en niet op een adres? Bv. "B2.14", "Kamer 3.12", "Vergaderzaal Noord",
 * "Boardroom", "3e verdieping". Een adres (postcode, of straatnaam met huisnummer) is het nooit.
 */
export function isKamer(plaats) {
  const t = String(plaats || "").trim(); if (!t) return false;
  if (/\b\d{4}\s?[a-z]{2}\b/i.test(t)) return false;                                              // postcode
  if (/(straat|weg|laan|plein|singel|gracht|kade|dijk|dreef|hof|steeg|pad|markt|park|boulevard|allee|baan|rade|veld|wal)\s*\d+/i.test(t)) return false;   // straat + huisnummer
  if (t.split(",").length >= 3) return false;                                                     // "naam, straat, plaats"
  if (/\b(kamer|zaal|ruimte|room|lokaal|verdieping|etage|floor|vleugel|spreekkamer|vergader\w*|meeting|boardroom|kantine|aula|lab|werkplek|flexplek|stiltecentrum|teamruimte|cel|unit|toren|hal)\b/i.test(t)) return true;
  if (/^[a-z]{0,3}[ .-]?\d{1,2}[.\-]\d{1,3}[a-z]?$/i.test(t) || /^[a-z]{1,3}[ .-]?\d{1,4}[a-z]?$/i.test(t)) return true;   // B2.14, 3.12, K12, C-201
  return false;
}
const norm = (a) => String(a || "").toLowerCase().replace(/\s+/g, " ").replace(/[,;]\s*(nederland|netherlands|nl)$/, "").trim();
// voor vergelijken: zonder leestekens en spaties ("Klantlaan 2, 8601 AB Sneek" = "klantlaan 2 8601ab sneek")
const kaal = (a) => norm(a).replace(/[^a-z0-9\u00c0-\u017f]+/g, "");
/** Zelfde plek? Zelfde adres (los van schrijfwijze), of minder dan 150 m uit elkaar als we van beide de plek kennen */
export function zelfdeAdres(a, b) {
  if (!a || !b) return false;
  if (kaal(a) === kaal(b)) return true;
  const p = geo[norm(a)], q = geo[norm(b)];
  if (p && q && !p.mis && !q.mis) { const dx = (p.lon - q.lon) * 111 * Math.cos(p.lat * Math.PI / 180), dy = (p.lat - q.lat) * 111; return Math.hypot(dx, dy) < 0.15; }
  return false;
}
// ---------- bewaarde reistijden: van adres → naar adres (per vervoer) ----------
const rtSleutel = (van, naar) => vervoer() + "|" + kaal(van) + "|" + kaal(naar);
const rt = () => (opslag.d ? (opslag.d.reistijden ||= {}) : {});
let bewaarRt = null;
function zetReistijd(van, naar, x) {
  rt()[rtSleutel(van, naar)] = { van: String(van).slice(0, 300), naar: String(naar).slice(0, 300), vervoer: vervoer(), ...x, t: new Date().toISOString().slice(0, 10) };
  clearTimeout(bewaarRt); bewaarRt = setTimeout(() => bewaar(), 1500);
}
/** Alle bewaarde reistijden (nieuwste eerst) */
export const reistijdenLijst = () => Object.entries(rt()).map(([k, v]) => ({ k, ...v })).sort((a, b) => String(b.t).localeCompare(String(a.t)));
export function reistijdWeg(k) { delete rt()[k]; for (const x of Object.keys(routes)) delete routes[x]; bewaar(); }
export function reistijdZelf(k, min) { const x = rt()[k]; if (!x) return; x.min = Math.max(1, Math.min(600, Math.round(min))); x.bron = "zelf"; x.t = new Date().toISOString().slice(0, 10); bewaar(); }

/**
 * Reistijd in minuten van adres `van` naar adres `naar` (rond tijdstip `rond` voor het verkeer), of null als die (nog)
 * niet bekend is — dan wordt hij opgehaald en tekent de app straks opnieuw.
 * @returns {{min:number, km:number|null, bron:string}|null}
 */
export function reistijd(van, naar, rond = null) {
  if (!routesAan() || !van || !naar) return null;
  if (zelfdeAdres(van, naar)) return { min: 0, km: 0, bron: "zelfde" };
  // al eens berekend (of zelf ingevuld)? Dan die — de andere kant op is bijna altijd even lang
  const al = rt()[rtSleutel(van, naar)] || rt()[rtSleutel(naar, van)];
  if (al && al.min > 0) return { min: al.min, km: al.km ?? null, bron: al.bron || "" };
  const br = bron(); if (!br) return null;
  const k = [br, vervoer(), kaal(van), kaal(naar)].join("|");
  const r = routes[k];
  if (r?.mis && Date.now() - r.t < MISLUKT_OPNIEUW) return null;
  if (inRij.has([br, vervoer(), kaal(naar), kaal(van)].join("|"))) return null;   // de andere kant op wordt al berekend
  vraag(k, br, van, naar, rond);
  return null;
}

// ---------- ophalen (één tegelijk; Nominatim wil hooguit 1 verzoek per seconde) ----------
const rij = [], inRij = new Set();
let loopt = false;
function vraag(k, br, van, naar, rond) {
  if (inRij.has(k) || rij.length > 200) return;
  inRij.add(k); rij.push({ k, br, van, naar, rond }); routeStand.bezig = rij.length;
  if (!loopt) verwerk();
}
const wacht = (ms) => new Promise(z => setTimeout(z, ms));
async function verwerk() {
  loopt = true;
  while (rij.length) {
    const x = rij.shift(); routeStand.bezig = rij.length + 1;
    try {
      const r = x.br === "google" ? await google(x.van, x.naar) : await osm(x.van, x.naar);
      if (r) { zetReistijd(x.van, x.naar, { min: Math.max(1, Math.round(r.min)), km: r.km, bron: x.br }); delete routes[x.k]; }
      else routes[x.k] = { mis: 1, t: Date.now() };
      routeStand.fout = r ? "" : `Geen route gevonden: ${x.van} → ${x.naar}`; routeStand.bron = x.br;
    } catch (e) {
      routeStand.fout = String(e?.message || e).slice(0, 200);
      if (/HTTP 4(01|03)/.test(routeStand.fout)) { rij.length = 0; inRij.clear(); break; }   // sleutel klopt niet: niet blijven proberen
      routes[x.k] = { mis: 1, t: Date.now() };
    }
    inRij.delete(x.k); bewaarCache(); later();
  }
  routeStand.bezig = 0; loopt = false;
}

async function google(van, naar) {
  const v = VERVOER[vervoer()];
  const body = { origin: { address: van }, destination: { address: naar }, travelMode: v.g, languageCode: "nl", regionCode: "nl", units: "METRIC" };
  const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": mapsSleutel(), "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Google Maps: HTTP ${r.status}`);
  const j = await r.json(), x = j.routes?.[0];
  if (!x?.duration) return null;
  return { min: parseInt(x.duration, 10) / 60, km: x.distanceMeters ? Math.round(x.distanceMeters / 100) / 10 : null };
}

let laatsteGeo = 0;
export function varianten(adres) {
  const t = String(adres).replace(/\s+/g, " ").trim(), delen = t.split(/\s*,\s*/).filter(Boolean), uit = [t];
  for (let i = 1; i < delen.length - 1; i++) uit.push(delen.slice(i).join(", "));
  const pc = t.match(/\b(\d{4})\s?([A-Za-z]{2})\b/), nr = t.match(/\b[A-Za-z\u00C0-\u017F.'-]+(?:\s[A-Za-z\u00C0-\u017F.'-]+)*\s(\d+[a-zA-Z]?)\b/);
  if (pc) uit.push(`${pc[1]} ${pc[2].toUpperCase()}${nr ? " " + nr[1] : ""}`, `${pc[1]} ${pc[2].toUpperCase()}`);
  return [...new Set(uit)].slice(0, 5);
}
/** Waarom is er (nog) geen route? "" (wel), "bezig", "niet gevonden" (adres onbekend), "uit" */
export function routeUitleg(van, naar) {
  if (!van || !naar) return "geen adres";
  if (rt()[rtSleutel(van, naar)] || rt()[rtSleutel(naar, van)]) return "";
  const br = bron(); if (!br) return "uit";
  return routes[[br, vervoer(), kaal(van), kaal(naar)].join("|")]?.mis ? "niet gevonden" : "bezig";
}
async function plek(adres) {
  const k = norm(adres), g = geo[k];
  if (g && (g.mis ? Date.now() - g.t < MISLUKT_OPNIEUW : Date.now() - g.t < 6 * HOUDBAAR)) return g.mis ? null : g;
  // Google-locaties zijn vaak "Naam van de praktijk, Straat 1, 1234 AB Plaats, Nederland": OpenStreetMap kent de naam meestal niet.
  // Dan proberen we het zonder de eerste delen, en anders op postcode + huisnummer.
  let x = null;
  for (const q of varianten(adres)) {
    const pauze = 1100 - (Date.now() - laatsteGeo); if (pauze > 0) await wacht(pauze);
    laatsteGeo = Date.now();
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=nl&q=${encodeURIComponent(q)}`);
    if (!r.ok) throw new Error(`OpenStreetMap (adres zoeken): HTTP ${r.status}`);
    x = (await r.json())[0]; if (x) break;
  }
  geo[k] = x ? { lat: +x.lat, lon: +x.lon, t: Date.now() } : { mis: 1, t: Date.now() };
  return x ? geo[k] : null;
}
async function osm(van, naar) {
  const a = await plek(van), b = await plek(naar);
  if (!a || !b) return null;
  const p = VERVOER[vervoer()].osm;
  const r = await fetch(`https://routing.openstreetmap.de/${p}/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`);
  if (!r.ok) throw new Error(`OpenStreetMap (route): HTTP ${r.status}`);
  const j = await r.json(), x = j.routes?.[0];
  return x ? { min: x.duration / 60, km: Math.round(x.distance / 100) / 10 } : null;
}

/** Marge bovenop de reistijd: minstens 10% en minstens 15 minuten */
export const marge = (min) => Math.max(15, Math.ceil(min * 0.1));
