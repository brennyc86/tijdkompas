// Tijdkompas — adreszoeker: typ een postcode, straat of plaats en kies uit de suggesties (zoals in Google Agenda)
//
// Nederland: PDOK Locatieserver (open data van de overheid, BAG; gemaakt voor zoeken-tijdens-typen, geen sleutel).
// Niets gevonden (buitenland): Photon van Komoot (OpenStreetMap). Het gekozen adres komt met coördinaten in de
// route-cache, zodat de reistijd meteen klopt zonder het adres nog eens te hoeven opzoeken.
//
// Gebruik: <input data-adreszoek> — bij een keuze krijgt het veld de waarde en een "change"-event (zoals bij gewoon typen).

import { zetPlek } from "./route.js";

const PDOK = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";
let lijst = null, veld = null, items = [], actief = -1, timer = null, vraagNr = 0;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ICOON = { adres: "🏠", postcode: "📮", weg: "🛣️", woonplaats: "🏙️", gemeente: "🏙️", plaats: "📍" };

async function zoekPdok(q) {
  const r = await fetch(`${PDOK}/suggest?q=${encodeURIComponent(q)}&fq=${encodeURIComponent("type:(adres OR postcode OR weg OR woonplaats)")}&rows=7`);
  if (!r.ok) return [];
  const j = await r.json();
  return (j.response?.docs || []).map(x => ({ tekst: x.weergavenaam, soort: x.type, pdok: x.id }));
}
async function zoekPhoton(q) {
  const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6`);
  if (!r.ok) return [];
  const j = await r.json();
  return (j.features || []).map(f => {
    const p = f.properties || {}, straat = [p.street || (p.type === "house" ? p.name : ""), p.housenumber].filter(Boolean).join(" ");
    const tekst = [p.name && p.name !== p.street && p.type !== "house" ? p.name : "", straat, [p.postcode, p.city].filter(Boolean).join(" "), p.country].filter(Boolean).join(", ");
    return { tekst, soort: p.housenumber ? "adres" : "plaats", lon: f.geometry?.coordinates?.[0], lat: f.geometry?.coordinates?.[1] };
  }).filter(x => x.tekst);
}
async function coordinaten(x) {
  if (x.lat != null) return x;
  if (!x.pdok) return null;
  const r = await fetch(`${PDOK}/lookup?id=${encodeURIComponent(x.pdok)}&fl=centroide_ll,weergavenaam`);
  if (!r.ok) return null;
  const m = String((await r.json()).response?.docs?.[0]?.centroide_ll || "").match(/POINT\(([-\d.]+) ([-\d.]+)\)/);
  return m ? { ...x, lon: +m[1], lat: +m[2] } : null;
}

function plaats() {
  if (!lijst || !veld) return;
  const r = veld.getBoundingClientRect();
  Object.assign(lijst.style, { left: r.left + "px", top: r.bottom + 2 + "px", width: Math.max(r.width, 260) + "px" });
}
function teken() {
  if (!lijst) { lijst = document.createElement("div"); lijst.className = "adreslijst"; lijst.setAttribute("role", "listbox");
    lijst.addEventListener("mousedown", (e) => { e.preventDefault(); const i = e.target.closest("[data-i]"); if (i) kies(+i.dataset.i); }); }
  // in een open dialog moet de lijst ín de dialog staan (anders ligt hij eronder)
  const ouder = veld.closest("dialog[open]") || document.body;
  if (lijst.parentNode !== ouder) ouder.appendChild(lijst);
  lijst.innerHTML = items.length ? items.map((x, i) => `<div class="adresoptie${i === actief ? " actief" : ""}" data-i="${i}" role="option"><span>${ICOON[x.soort] || "📍"}</span><span>${esc(x.tekst)}</span></div>`).join("")
    + `<div class="adresbron">${items.some(x => x.pdok) ? "Adressen: PDOK (Kadaster)" : "Adressen: OpenStreetMap"}</div>` : "";
  lijst.hidden = !items.length;
  plaats();
}
function sluit() { items = []; actief = -1; if (lijst) lijst.hidden = true; }
async function kies(i) {
  const x = items[i]; if (!x || !veld) return;
  const v = veld; sluit();
  v.value = x.tekst;
  // een postcode of straat is nog geen adres: door laten typen (huisnummer)
  if (x.soort === "postcode" || x.soort === "weg") {
    const pc = x.tekst.match(/\b\d{4}\s?[A-Z]{2}\b/i), [straat, rest = ""] = x.tekst.split(/,\s*/);
    const stad = rest.replace(/\b\d{4}\s?[A-Z]{2}\b/i, "").trim();
    v.value = x.soort === "postcode" && pc ? pc[0].replace(/\s/, "") + " " : `${straat} ${stad}`;
    const pos = x.soort === "postcode" && pc ? v.value.length : straat.length + 1;
    if (x.soort !== "postcode") v.value = `${straat}  ${stad}`.replace(/\s+$/, "");
    v.focus(); try { v.setSelectionRange(pos, pos); } catch {}
    return;                                                   // nu je huisnummer typen
  }
  try { const c = await coordinaten(x); if (c?.lat != null) zetPlek(x.tekst, c.lat, c.lon); } catch {}
  v.dispatchEvent(new Event("change", { bubbles: true }));
}
function zoek(v) {
  clearTimeout(timer);
  const q = v.value.trim();
  if (q.length < 3) { sluit(); return; }
  timer = setTimeout(async () => {
    const nr = ++vraagNr;
    let r = [];
    try { r = await zoekPdok(q); } catch {}
    if (!r.length) try { r = await zoekPhoton(q); } catch {}
    if (nr !== vraagNr || veld !== v || document.activeElement !== v) return;
    items = r; actief = -1; teken();
  }, 220);
}

/** Eén keer aanroepen: werkt voor alle velden met data-adreszoek, ook die later getekend worden */
export function initAdresZoeker() {
  document.addEventListener("input", (e) => { const v = e.target.closest?.("input[data-adreszoek]"); if (!v) return; veld = v; zoek(v); }, true);
  document.addEventListener("keydown", (e) => {
    const v = e.target.closest?.("input[data-adreszoek]"); if (!v || !items.length || lijst?.hidden) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); actief = (actief + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; teken(); }
    else if (e.key === "Enter" && actief >= 0) { e.preventDefault(); e.stopPropagation(); kies(actief); }
    else if (e.key === "Escape") { e.stopPropagation(); sluit(); }
  }, true);
  document.addEventListener("focusout", (e) => { if (e.target.closest?.("input[data-adreszoek]")) setTimeout(() => { if (document.activeElement !== veld) sluit(); }, 150); }, true);
  window.addEventListener("scroll", plaats, true); window.addEventListener("resize", plaats);
}
