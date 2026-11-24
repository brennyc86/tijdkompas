// Tijdkompas — echte reistijden tussen adressen (afspraken met een locatie, kantoor, thuis)
//
// Met een Google Maps-sleutel (Routes API, instelling of CONFIG.mapsSleutel): Google, met verkeer in de spits.
// Zonder sleutel: OpenStreetMap (Nominatim om het adres te vinden, OSRM van openstreetmap.de voor de route) — gratis,
// zonder verkeersinformatie en zonder openbaar vervoer. Elke route wordt een maand bewaard (alleen op dit apparaat),
// zodat er per adrespaar maar één keer gevraagd wordt. Synchroon op te vragen (dagIndeling is synchroon): onbekend =
// null terug, de route wordt op de achtergrond gehaald en daarna wordt alles opnieuw getekend.

import { CONFIG } from "./config.js";
import { opslag } from "./data.js";

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
export function wisRoutes() { routes = {}; geo = {}; try { localStorage.removeItem(SLEUTEL_ROUTES); localStorage.removeItem(SLEUTEL_GEO); } catch {} }

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
const norm = (a) => String(a || "").toLowerCase().replace(/\s+/g, " ").replace(/[,;]\s*(nederland|netherlands|nl)$/, "").trim();
export const zelfdeAdres = (a, b) => !!a && !!b && norm(a) === norm(b);

// spits = ander verkeer (alleen Google rekent met verkeer)
function vak(t) { if (!t) return "x"; const d = new Date(t), h = d.getHours(), w = d.getDay(); return w === 0 || w === 6 ? "w" : h >= 7 && h < 9 ? "o" : h >= 16 && h < 19 ? "a" : "d"; }

/**
 * Reistijd in minuten van adres `van` naar adres `naar` (rond tijdstip `rond` voor het verkeer), of null als die (nog)
 * niet bekend is — dan wordt hij opgehaald en tekent de app straks opnieuw.
 * @returns {{min:number, km:number|null, bron:string}|null}
 */
export function reistijd(van, naar, rond = null) {
  const br = bron(); if (!br || !van || !naar) return null;
  if (zelfdeAdres(van, naar)) return { min: 0, km: 0, bron: br };
  const k = [br, vervoer(), br === "google" && vervoer() === "auto" ? vak(rond) : "", norm(van), norm(naar)].join("|");
  const r = routes[k];
  if (r && Date.now() - r.t < (r.mis ? MISLUKT_OPNIEUW : HOUDBAAR)) return r.mis ? null : { min: r.min, km: r.km ?? null, bron: br };
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
      const r = x.br === "google" ? await google(x.van, x.naar, x.rond) : await osm(x.van, x.naar);
      routes[x.k] = r ? { min: Math.max(1, Math.round(r.min)), km: r.km, t: Date.now() } : { mis: 1, t: Date.now() };
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

async function google(van, naar, rond) {
  const v = VERVOER[vervoer()];
  const body = { origin: { address: van }, destination: { address: naar }, travelMode: v.g, languageCode: "nl", regionCode: "nl", units: "METRIC" };
  // verkeer: een vertrektijd in de toekomst (zelfde weekdag en uur als de afspraak, de komende week)
  if (v.g === "DRIVE") {
    body.routingPreference = "TRAFFIC_AWARE";
    if (rond) { let t = new Date(rond); while (t < Date.now() + 6e4) t = new Date(t.getTime() + 7 * 864e5); body.departureTime = t.toISOString(); }
  }
  const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": mapsSleutel(), "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`Google Maps: HTTP ${r.status}`);
  const j = await r.json(), x = j.routes?.[0];
  if (!x?.duration) return null;
  return { min: parseInt(x.duration, 10) / 60, km: x.distanceMeters ? Math.round(x.distanceMeters / 100) / 10 : null };
}

let laatsteGeo = 0;
async function plek(adres) {
  const k = norm(adres), g = geo[k];
  if (g && (g.mis ? Date.now() - g.t < MISLUKT_OPNIEUW : Date.now() - g.t < 6 * HOUDBAAR)) return g.mis ? null : g;
  const pauze = 1100 - (Date.now() - laatsteGeo); if (pauze > 0) await wacht(pauze);
  laatsteGeo = Date.now();
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=nl&q=${encodeURIComponent(adres)}`);
  if (!r.ok) throw new Error(`OpenStreetMap (adres zoeken): HTTP ${r.status}`);
  const j = await r.json(), x = j[0];
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
