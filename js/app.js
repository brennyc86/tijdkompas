// Tijdkompas — gebruikersinterface
import { opslag, bewaar, KWADRANTEN, kwadrant, overzicht, project, taak, takenVan, projectVoortgang, isLang, deelprojecten, ouderVan, projectIcoon, zelfInTePlannen, allesVan,
         nieuweTaak, nieuwProject, werkBij, verwijder, koppel, rondAf, heropen, linkInfo, kalibratie, uid, locatie, effectieveLocatie, sessie,
         map, submappen, lijstenIn, lijstenOnder, mappenOnder, mapPad, boom, lijstVolgorde, idsVan,
         afspraak, koersVan, binnenDoel, koersScore, koersSuggesties, koppelKoers, mijnId, isIk, personen, naamVanPersoon, isMijn, isTeam, wie, wachtNogOp, wachtenOp, maaktKring, anderen as andereLeden } from "./data.js";
import { familieHaak, planAutomatisch, werkGeplandBij, doelDatum, harde, prioriteit, googleLink, outlookLink, maakIcs, leesIcs, dagStr, dagIndeling, eventSoort, SOORTEN,
  AFWIJKING, maakRuimte, magWijkenVoor, wijkbaar, plekGebonden, plaatsMetWijken, telt, isHerinnering, buitenBeschikbaarheid, regelVoor, rolKeuze, afspraakSleutel, standaardTijden, afwijkingOp, afwijkingDatums, zetAfwijking, dagTijden, tijdenZonder, tijdenMet, effLijst, rolBotsingen, planStatus, grootsteGat, voorstellen as planVoorstellen, botsingen, raster, metVoorrang, plaatsVanaf, vrijkomend, vrijeTijd, trekAllesNaarVoren, nogNodig, plaatsBlok, haalBlokWeg, plekVan, doorGelinktIngepland } from "./plan.js";
import { ids, verbindingen as alleVerbindingen, heeft, isVerlopen, voorbereiden, koppelGoogle, koppelMs, vernieuw, ontkoppel, zonderDoel, koppelHaak, neemGedeeldeOver } from "./koppeling.js";
import { schijf, opSchijf, startSchijf, schijfVerbindingen, verplaats, synchroniseerAlles, naamVan, lijstWeg } from "./schijf.js";
import { verversAgendas, zetNaarAgendas, verversLinks, linkBron, doelAgendaVan, standaardAgenda, agendaNaam, AGENDA_STANDAARD, eigenAgenda, viaEigenaar, vingerafdruk, kanVerplaatsen, verplaatsAgendaAfspraak } from "./sync.js";
import { syncTaken, takenVerbindingen, koppelTakenlijst, takenlijstVan, takenVerbindingVan } from "./takensync.js";
import { kiesEmoji, voorstellen } from "./emoji.js";
import { boodschappenWeergave, initBoodschappen, focusInvoer, winkelVelden, winkelOpen, boodschappenVandaag } from "./boodschappen.js";
import { veiligeUrl, veiligeFoto } from "./veilig.js";
import { VERVOER, vervoer, bron as routeBron, routeStand, mapsSleutel, routesAan, opRoute, wisRoutes } from "./route.js";
import { familieBezetRuw, familieRegels, familieLijstInst, familieVoorMij, emailVan, feedsLater, feedsBijwerken, feedStand, feedUrl, feedWeg, nieuweFeedSleutel, feedBlokken, cloud, cloudStart, cloudIngesteld, opCloud, login, koppelAccount, uitloggen, foutTekst, planSchrijven, accepteer, weiger, ingelogd, isHoofd, voegInlogToe, verwijderInlog, cloudGeladen, familieAgenda, gelinkteInfo, stuurInlogLink,
         koppel as koppelStaat, vraagKoppelcode, gebruikKoppelcode, beantwoordKoppel, stopKoppelcode, stuurBevestiging, controleerBevestiging } from "./cloud.js";
familieHaak.agenda = familieAgenda;
familieHaak.instVan = (o) => (ingelogd() && gelinkteInfo(o)?.inst) || null;
// (kort onthouden: dit wordt per afspraak per dag gevraagd)
let regelsCache = { t: 0, v: null };
familieHaak.regels = () => {
  if (!ingelogd()) return { regels: [], verborgen: {} };
  if (Date.now() - regelsCache.t > 300 || !regelsCache.v) regelsCache = { t: Date.now(), v: familieRegels() };
  return regelsCache.v;
};
familieHaak.ruw = () => ingelogd() ? familieBezetRuw() : [];
familieHaak.instAlle = (id) => ingelogd() && id ? familieLijstInst(id) : [];
familieHaak.voorMij = () => ingelogd() ? familieVoorMij() : { blokken: [], klaar: false };
familieHaak.eigenaar = (o) => { const gl = o && gelinkteInfo(o); return gl ? { email: gl.email, agenda: gl.inst?.doelAgenda || "" } : null; };

// Niet in een frame van een andere site laten draaien (tegen "clickjacking": je onzichtbaar laten klikken op bijv. Koppelen)
if (window.top !== window.self) { document.body.textContent = "Tijdkompas opent alleen in een eigen venster."; throw new Error("Tijdkompas in een frame geweigerd"); }
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const d = () => opslag.d;
const verbindingen = () => alleVerbindingen().filter(v => heeft(v, "agenda"));   // agenda-koppelingen
const main = $("#main"), dlg = $("#dlg"), dlg2 = $("#dlg2"), dlg3 = $("#dlg3");

// ---------- voorkeuren per kijker (geen gedeelde staat) ----------
const voorkeur = {
  lees(k, std) { try { const v = localStorage.getItem("tk_" + k); return v == null ? std : JSON.parse(v); } catch { return std; } },
  zet(k, v) { try { localStorage.setItem("tk_" + k, JSON.stringify(v)); } catch {} },
};
let actief = voorkeur.lees("actief", null);

// ---------- kleuren ----------
// Elk account heeft zijn eigen kleuren (in zijn eigen instellingen), zodat je meteen ziet met welk account je kijkt.
const THEMAS = {
  donker:         { naam: "Bos",               bg: "#0f2419", accent: "#d8c48e", accent2: "#7cc495" },
  licht:          { naam: "Perkament",         bg: "#f4efe2", accent: "#2f5e45", accent2: "#b8861f" },
  aubergine:      { naam: "Aubergine & cyaan", bg: "#24122b", accent: "#3fd0d8", accent2: "#c77dd8" },
  aubergineLicht: { naam: "Aubergine licht",   bg: "#f6f1f7", accent: "#5b2a6e", accent2: "#0e9aa7" },
  zee:            { naam: "Nachtzee",          bg: "#0b1826", accent: "#e8b04a", accent2: "#5fb3d9" },
  herfst:         { naam: "Herfst",            bg: "#24170f", accent: "#e39b4a", accent2: "#c9604a" },
  grafiet:        { naam: "Grafiet",           bg: "#17191d", accent: "#7aa2f7", accent2: "#9ece6a" },
  lente:          { naam: "Lente (licht)",     bg: "#f3f7f0", accent: "#3f7d4f", accent2: "#d9668a" },
};
/** Lijsten van een gelinkt account (privé ↔ werk) blijven zichtbaar maar vallen minder op; die van jou vallen op. */
function inFocus(ovId) {
  const o = overzicht(ovId), fam = sessie.familie || [];
  return !(o?.eigenaar && fam.length > 1 && o.eigenaar !== sessie.ik && fam.includes(o.eigenaar));
}
function markeerFocus(root) {
  for (const el of root.querySelectorAll("[data-id][data-type], [data-sub]")) {
    const x = el.dataset.sub ? taak(el.dataset.sub) : el.dataset.type === "project" ? project(el.dataset.id) : taak(el.dataset.id);
    if (x) el.classList.toggle("elders", !inFocus(x.overzicht));
  }
  for (const el of root.querySelectorAll("[data-blok]")) {
    const b = d().planning.find(b => b.id === el.dataset.blok);
    if (b) el.classList.toggle("elders", !inFocus(b.overzicht));
  }
}
let weekVerschuiving = 0;
let laatsteWaarschuwingen = [];

function actieveOverzichten() {
  const ids = d().overzichten.map(o => o.id);
  if (!actief || !actief.length) return ids;
  const a = actief.filter(i => ids.includes(i));
  return a.length ? a : ids;
}
const zichtbaar = (it) => actieveOverzichten().includes(it.overzicht);

// ---------- wie: mijn taken / het team / een collega / afhankelijkheden ----------
const zichtbareLijsten = () => actieveOverzichten().map(overzicht).filter(Boolean);
/** Anderen in de zichtbare lijsten (leden en mensen zonder Tijdkompas) */
function anderen() {
  const m = new Map();
  for (const o of zichtbareLijsten()) for (const p of personen(o)) if (!p.ik && !m.has(p.id)) m.set(p.id, p.naam);
  return [...m];
}
const heeftTeam = () => anderen().length > 0 || d().taken.some(t => zichtbaar(t) && (t.wachtOp || []).length);
function doorWie(t, f = voorkeur.lees("wie", "alle")) {
  if (t.type === "project" || f === "alle") return true;
  if (f === "mijn") return isMijn(t);
  if (f === "team") return isTeam(t);
  if (f === "wachtmij") return isMijn(t) && wachtenOp(t).some(x => !isMijn(x) || wie(x).some(y => !isIk(y)));
  if (f === "geblokt") return wachtNogOp(t).length > 0;
  if (f.startsWith("p:")) return wie(t).includes(f.slice(2));
  if (f.startsWith("w:")) return wachtenOp(t).some(x => wie(x).includes(f.slice(2)));
  return true;
}
function wieKeuze() {
  if (!heeftTeam()) return "";
  const f = voorkeur.lees("wie", "alle"), a = anderen();
  const opt = (v, n) => `<option value="${esc(v)}" ${f === v ? "selected" : ""}>${esc(n)}</option>`;
  return `<select name="wie" aria-label="Wiens taken" title="Wiens taken">${opt("alle", "👥 Iedereen")}${opt("mijn", "🙋 Mijn taken")}${opt("team", "👥 Nog niet verdeeld")}
    ${a.length ? `<optgroup label="Taken van">${a.map(([id, n]) => opt("p:" + id, n)).join("")}</optgroup>` : ""}
    <optgroup label="Afhankelijkheden">${opt("wachtmij", "⏳ Waar anderen op mij wachten")}${a.map(([id, n]) => opt("w:" + id, "⏳ Waar " + n + " op wacht")).join("")}${opt("geblokt", "⛓ Wacht op een andere taak")}</optgroup></select>`;
}

// ---------- opmaak ----------
const DAG = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const DAGLANG = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const MAAND = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function fmtDuur(min) {
  min = Math.round(min || 0);
  if (!min) return "";
  if (min < 60) return min + "m";
  const u = Math.floor(min / 60), m = min % 60;
  return m ? `${u}u${String(m).padStart(2, "0")}` : `${u}u`;
}
export function leesDuur(s) {
  s = String(s || "").trim().toLowerCase().replace(",", ".");
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s));            // kaal getal = minuten
  let tot = 0, m;
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(u|h|uur)/))) tot += parseFloat(m[1]) * 60;
  if ((m = s.match(/(?:u|h|uur)\s*(\d+)\s*$/))) tot += parseInt(m[1]);     // 1u30
  if ((m = s.match(/(\d+)\s*(m|min)/))) tot += parseInt(m[1]);
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(d|dag)/))) tot += parseFloat(m[1]) * 480;
  return Math.round(tot);
}
const vandaagStr = () => dagStr(new Date());
function dagenTot(datum) { return Math.round((new Date(datum + "T00:00") - new Date(vandaagStr() + "T00:00")) / 864e5); }
function fmtDatum(datum) {
  if (!datum) return "";
  const n = dagenTot(datum), x = new Date(datum + "T12:00");
  if (n === 0) return "vandaag";
  if (n === 1) return "morgen";
  if (n === -1) return "gisteren";
  if (n > 1 && n < 7) return DAG[x.getDay()] + " " + x.getDate() + " " + MAAND[x.getMonth()];
  return x.getDate() + " " + MAAND[x.getMonth()] + (x.getFullYear() !== new Date().getFullYear() ? " " + x.getFullYear() : "");
}
const fmtTijd = (iso) => { const x = new Date(iso); return String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0"); };
const ovKleur = (id) => esc(overzicht(id)?.kleur || "#888");
const qKleur = (q) => `var(--q-${q})`;
// Icoon van een project (eigen emoji, anders de ruit)
const pIcoon = (p) => projectIcoon(p) ? esc(projectIcoon(p)) : isLang(p) ? "♾️" : "◆";

function datumTags(it) {
  const uit = [];
  const dl = it.deadline, st = it.streef;
  if (dl) {
    const n = dagenTot(dl), cls = it.status === "klaar" ? "" : n < 0 ? "laat" : n <= 2 ? "bijna" : "";
    uit.push(`<span class="tag ${cls}" title="Deadline">⏰ ${fmtDatum(dl)}</span>`);
  }
  if (st && st !== dl) {
    const n = dagenTot(st), na = dl && st > dl, cls = it.status === "klaar" ? "" : na ? "laat" : n < 0 ? "bijna" : "";
    uit.push(`<span class="tag ${cls}" title="${na ? "Eigen streefdatum ligt ná de deadline: je verwacht later klaar te zijn" : "Eigen streefdatum"}">🎯 ${fmtDatum(st)}${na ? " (na deadline)" : ""}</span>`);
  }
  return uit.join("");
}
function qTag(it) { const q = kwadrant(it); return `<span class="tag q" style="--qk:${qKleur(q)}" title="${KWADRANTEN[q].sub}">${KWADRANTEN[q].naam}</span>`; }
function linkjes(it) {
  return (it.links || []).length ? `<span class="linkjes">${it.links.map(l => { const i = linkInfo(l.url);
    return `<a href="${esc(veiligeUrl(l.url) || "#")}" target="_blank" rel="noopener noreferrer" title="${esc(l.label || i.label)}">${esc(i.icoon)}</a>`; }).join("")}</span>` : "";
}
function duurTekst(it) {
  if (it.status === "klaar" && it.werkelijk) return `<span class="duur" title="Geschat ${fmtDuur(it.schatting) || "–"} · werkelijk ${fmtDuur(it.werkelijk)}">${fmtDuur(it.schatting) || "–"} → ${fmtDuur(it.werkelijk)}</span>`;
  return it.schatting ? `<span class="duur" title="Geschatte tijd">${fmtDuur(it.schatting)}</span>` : "";
}

const kortTitel = (s) => s.length > 32 ? s.slice(0, 30) + "…" : s;
function wieTekst(t) {
  const o = overzicht(t.overzicht), w = wie(t);
  if (!w.length) return "de hele groep";
  return w.map(x => naamVanPersoon(x, o)).join(", ");
}
function wieTag(t) {
  if (t.type !== "taak") return "";
  const o = overzicht(t.overzicht), w = wie(t);
  if (personen(o).length < 2 && w.every(isIk)) return "";
  if (!w.length) return `<span class="tag team" title="Nog niet verdeeld: de hele groep">👥 team</span>`;
  return `<span class="tag wie" title="Wie doet het">👤 ${esc(wieTekst(t))}</span>`;
}
function afhTags(t) {
  if (t.type !== "taak") return "";
  const uit = [];
  if (t.status === "klaar") {
    if (t.klaarDoor && !isIk(t.klaarDoor)) uit.push(`<span title="Afgevinkt door">✓ ${esc(naamVanPersoon(t.klaarDoor, overzicht(t.overzicht)))}</span>`);
    return uit.join("");
  }
  const wacht = wachtNogOp(t);
  if (wacht.length) uit.push(`<span class="tag wacht" title="Kan pas verder als dit klaar is:
${esc(wacht.map(x => "• " + x.titel + " (" + wieTekst(x) + ")").join("\n"))}">⛓ wacht op ${wacht.length === 1 ? "„" + esc(kortTitel(wacht[0].titel)) + "”" + (wie(wacht[0]).every(isIk) ? "" : " · " + esc(wieTekst(wacht[0]))) : wacht.length + " taken"}</span>`);
  const op = wachtenOp(t);
  if (op.length) {
    const namen = [...new Set(op.flatMap(x => wie(x).filter(y => !isIk(y)).map(y => naamVanPersoon(y, overzicht(x.overzicht)))))];
    uit.push(`<span class="tag hierop" title="Wacht hierop:
${esc(op.map(x => "• " + x.titel + " (" + wieTekst(x) + ")").join("\n"))}">⏳ ${namen.length ? esc(namen.join(", ")) + " wacht" + (namen.length > 1 ? "en" : "") : op.length === 1 ? "1 taak wacht" : op.length + " taken wachten"} hierop</span>`);
  }
  return uit.join("");
}

// Ingepland of niet: altijd op dezelfde plek (eerste label), in kleur, en klikbaar om zelf in te plannen
const wanneer = (iso) => `${fmtDatum(dagStr(new Date(iso)))} ${fmtTijd(iso)}`;
function planTag(t) {
  if (t.status === "klaar" || (t.type === "project" && d().taken.some(x => x.project === t.id && x.status !== "klaar"))) return "";
  const s = planStatus(t);
  const door = isMijn(t) && !doorGelinktIngepland(t) ? "" : " door " + wieTekst(t);
  if (s.soort === "ja") return `<button type="button" class="plantag ja" data-plan="${t.id}" data-ptype="${t.type}" title="Ingepland${esc(door)}${s.blokken.length > 1 ? ` in ${s.blokken.length} blokken` : ""} — klik om te verplaatsen of bij te plannen">📅 ${wanneer(s.van)}${s.blokken.length > 1 ? ` <small>+${s.blokken.length - 1}</small>` : ""}</button>`;
  if (s.soort === "deels") return `<button type="button" class="plantag deels" data-plan="${t.id}" data-ptype="${t.type}" title="Deels ingepland: ${fmtDuur(s.min)} van ${fmtDuur(s.nodig)} — klik om de rest in te plannen">◐ ${wanneer(s.van)} · nog ${fmtDuur(s.rest)}</button>`;
  return `<button type="button" class="plantag niet" data-plan="${t.id}" data-ptype="${t.type}" title="${isMijn(t) ? "Nog niet ingepland — klik voor voorstellen op basis van je beschikbaarheid" : "Toegewezen aan " + esc(wieTekst(t)) + " en nog niet ingepland"}">○ Nog niet ingepland</button>`;
}
const planKlasse = (t) => t.status === "klaar" ? "" : " pl-" + planStatus(t).soort;

function itemRij(t, { toonProject = true, toonOv = true } = {}) {
  const p = t.project ? project(t.project) : null;
  const ov = overzicht(t.overzicht);
  return `<div class="item ${t.status === "klaar" ? "klaar" : ""} ${t.status !== "klaar" && wachtNogOp(t).length ? "geblokt" : ""}${planKlasse(t)}" data-id="${t.id}" data-type="taak" style="--ok:${ovKleur(t.overzicht)}">
    <button class="vink" type="button" aria-label="${t.status === "klaar" ? "Heropenen" : "Afronden"}">${t.status === "klaar" ? "✓" : ""}</button>
    <div class="ibody"><div class="ititel">${esc(t.titel)}</div>
      <div class="imeta">${planTag(t)}${qTag(t)}${toonProject && p ? `<span class="tag proj">${pIcoon(p)} ${esc(p.titel)}</span>` : ""}${datumTags(t)}
      ${toonOv && actieveOverzichten().length > 1 && ov ? `<span>${esc(ov.icoon)} ${esc(ov.naam)}</span>` : ""}
      ${t.locatie && locatie(t.locatie) ? `<span title="Locatie">📍 ${esc(locatie(t.locatie).naam)}</span>` : ""}
      ${wieTag(t)}${afhTags(t)}
</div></div>
    ${linkjes(t)}${duurTekst(t)}</div>`;
}

function toast(tekst, actie) {
  const acties = Array.isArray(actie) ? actie.filter(Boolean) : actie ? [actie] : [];
  const t = $("#toast"); t.textContent = tekst; t.classList.add("aan");
  // staat er een venster open, dan de melding daarin tonen (anders valt hij erachter, wazig en onklikbaar)
  const open = [...document.querySelectorAll("dialog[open]")].pop() || document.body;
  if (t.parentNode !== open) open.appendChild(t);
  for (const a of acties) {
    const b = document.createElement("button"); b.type = "button"; b.className = "knop klein"; b.textContent = a.label;
    b.onclick = () => { t.classList.remove("aan"); a.f(); }; t.append(" ", b);
  }
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("aan"), acties.length ? 8000 : 2600);
}

// gaat het venster met de melding erin dicht, dan de melding terug naar de pagina
document.querySelectorAll("dialog").forEach(dl => dl.addEventListener("close", () => { const t = $("#toast"); if (t.parentNode === dl) document.body.appendChild(t); }));

// ---------- kop: overzicht-chips ----------
const CHIPTIP = "Klik: alleen deze · Ctrl+klik (telefoon: lang indrukken): erbij of eraf";
// aan ("true"), deels ("mixed") of uit ("false") voor een groep lijsten
function staat(ids) {
  const a = actieveOverzichten(), n = ids.filter(i => a.includes(i)).length;
  return !ids.length || !n ? "false" : n === ids.length ? "true" : "mixed";
}
function renderChips() {
  const ids = actieveOverzichten(), alle = ids.length === d().overzichten.length;
  const lijstChip = (o) => `<button class="ovchip${inFocus(o.id) ? "" : " elders"}" type="button" data-ov="${o.id}" style="--k:${esc(o.kleur)}" aria-pressed="${ids.includes(o.id)}"
      title="${esc(o.naam)} — ${CHIPTIP}"><span class="stip"></span>${esc(o.icoon)} ${esc(o.naam)}</button>`;
  const mapChip = (m) => { const l = lijstenOnder(m.id);
    return `<span class="ovmap${l.some(inFocus) ? "" : " elders"}" style="--k:${esc(m.kleur)}"><button class="ovchip map" type="button" data-ov="m:${m.id}" aria-pressed="${staat(l)}"
      title="Map ${esc(m.naam)} (${l.length} ${l.length === 1 ? "lijst" : "lijsten"}) — ${CHIPTIP}"><span class="stip"></span>${esc(m.icoon)} ${esc(m.naam)}</button><button class="ovchip pijl" type="button" data-menu="${m.id}"
      aria-label="Lijsten in ${esc(m.naam)} los kiezen" title="Lijsten in deze map los kiezen">▾</button></span>`; };
  const ks = keuzeSleutel(), kx = ks && (ks.startsWith("m:") ? map(ks.slice(2)) : overzicht(ks));
  $("#ovChips").innerHTML =
    `<button class="ovchip alles" type="button" data-ov="*" aria-pressed="${alle}" title="Alle lijsten tonen — daarna kun je er met Ctrl+klik losse uit halen">Alles</button>` +
    (kx ? `<button class="ovchip inst" type="button" data-inst="${ks}" title="Instellingen van ${esc(kx.naam)}: soort, tijden, verdeling, delen, koers">⚙️ ${esc(kx.naam)}</button>` : "") +
    submappen("").map(mapChip).join("") + lijstenIn("").map(lijstChip).join("") +
    `<button class="ovchip nieuw" type="button" data-ov="+" title="Nieuwe lijst of map" aria-label="Nieuwe lijst of map">＋</button>`;
  if ($("#ovMenu")) toonMenu($("#ovMenu").dataset.map);
}
// Kijk je naar precies één lijst of één map? Dan is dat de sleutel voor ⚙️
let laatsteKeuze = null;
const zelfdeSet = (x, y) => x.length === y.length && x.every(i => y.includes(i));
function keuzeSleutel() {
  const a = actieveOverzichten();
  if (a.length === d().overzichten.length && d().overzichten.length > 1) return null;
  if (laatsteKeuze && (laatsteKeuze.startsWith("m:") ? map(laatsteKeuze.slice(2)) : overzicht(laatsteKeuze)) && zelfdeSet(idsVan(laatsteKeuze), a)) return laatsteKeuze;
  if (a.length === 1) return a[0];
  const m = d().mappen.find(m => { const l = lijstenOnder(m.id); return l.length === a.length && l.every(i => a.includes(i)); });
  return m ? "m:" + m.id : null;
}
// Klik = alleen deze lijst (of alles in de map); nog eens klikken = weer alles. Ctrl/⌘-klik of lang indrukken = erbij of eraf.
function kiesLijst(sleutel, wissel) {
  const alleIds = d().overzichten.map(o => o.id), huidig = actieveOverzichten();
  if (sleutel === "*") actief = null;
  else {
    const groep = idsVan(sleutel);
    if (!groep.length) { toast("Deze map is nog leeg — maak er een lijst in met ＋"); return; }
    if (wissel) {
      const s = groep.every(x => huidig.includes(x)) ? huidig.filter(x => !groep.includes(x)) : [...new Set([...huidig, ...groep])];
      if (!s.length) { toast("Er blijft minstens één lijst zichtbaar"); return; }
      actief = s.length === alleIds.length ? null : s;
    } else {
      laatsteKeuze = sleutel;
      const zelfde = huidig.length === groep.length && groep.every(x => huidig.includes(x));
      actief = zelfde || groep.length === alleIds.length ? null : groep;
      const n = voorkeur.lees("chipTip", 0);
      if (actief && n < 2) { voorkeur.zet("chipTip", n + 1); setTimeout(() => toast("Tip: Ctrl+klik (telefoon: lang indrukken) zet een lijst erbij of eraf"), 300); }
    }
  }
  voorkeur.zet("actief", actief);
  render();
}
// Uitklapmenu van een map: alle mappen en lijsten eronder, met vinkje (erbij/eraf) en naam (alleen die)
function toonMenu(mapId) {
  const knop = $(`[data-menu="${mapId}"]`), m = map(mapId);
  if (!knop || !m) { sluitMenu(); return; }
  let el = $("#ovMenu");
  if (!el) { el = document.createElement("div"); el.id = "ovMenu"; el.className = "ovmenu"; document.body.appendChild(el); el.onclick = menuKlik; }
  el.dataset.map = mapId;
  const rijen = boom(mapId).map(r => {
    const ids = r.soort === "map" ? lijstenOnder(r.x.id) : [r.x.id], st = staat(ids), sl = r.soort === "map" ? "m:" + r.x.id : r.x.id;
    return `<div class="mrij" style="padding-left:${6 + r.diepte * 18}px;--k:${esc(r.x.kleur)}">
      <button type="button" class="vinkje" data-wissel="${sl}" aria-pressed="${st}" title="Erbij of eraf">${st === "true" ? "✓" : st === "mixed" ? "–" : ""}</button>
      <button type="button" class="mnaam" data-solo="${sl}" title="Alleen ${r.soort === "map" ? "deze map" : "deze lijst"}">${esc(r.x.icoon)} ${esc(r.x.naam)}${r.soort === "map" ? ` <small class="hint">${ids.length}</small>` : ""}</button>
      <button type="button" class="x" data-inst="${sl}" title="Instellingen">⚙️</button></div>`;
  }).join("");
  const st = staat(lijstenOnder(mapId));
  el.innerHTML = `<div class="mrij mkop"><button type="button" class="vinkje" data-wissel="m:${mapId}" aria-pressed="${st}">${st === "true" ? "✓" : st === "mixed" ? "–" : ""}</button>
      <button type="button" class="mnaam" data-solo="m:${mapId}"><b>${esc(m.icoon)} ${esc(m.naam)}</b></button><button type="button" class="x" data-inst="m:${mapId}" title="Instellingen van de map">⚙️</button></div>
    ${rijen || `<div class="hint" style="padding:6px 10px">Nog leeg</div>`}
    <div class="mvoet"><button type="button" class="knop klein" data-nieuw="${mapId}">＋ Lijst of map hierin</button><span class="hint">vinkje = erbij/eraf · naam = alleen die</span></div>`;
  const r = knop.getBoundingClientRect(), br = window.innerWidth || 1000;
  el.style.top = r.bottom + 6 + "px"; el.style.left = Math.max(8, Math.min(r.left - 40, br - 310)) + "px";
}
function sluitMenu() { $("#ovMenu")?.remove(); }
function menuKlik(e) {
  const w = e.target.closest("[data-wissel]"), so = e.target.closest("[data-solo]"), n = e.target.closest("[data-nieuw]"), ins = e.target.closest("[data-inst]");
  if (ins) { sluitMenu(); openInst(ins.dataset.inst); }
  else if (w) kiesLijst(w.dataset.wissel, true);                 // render() tekent het menu opnieuw
  else if (so) { sluitMenu(); kiesLijst(so.dataset.solo, false); }
  else if (n) { sluitMenu(); nieuweLijst({ map: n.dataset.nieuw }); }
}
document.addEventListener("pointerdown", (e) => { if (!e.target.closest?.("#ovMenu,[data-menu]")) sluitMenu(); });
let langDruk = null, langGedaan = false;
$("#ovChips").addEventListener("pointerdown", (e) => {
  const b = e.target.closest(".ovchip[data-ov]"); if (!b || e.pointerType === "mouse" || b.dataset.ov === "+") return;
  langGedaan = false; clearTimeout(langDruk);
  langDruk = setTimeout(() => { langGedaan = true; navigator.vibrate?.(15); kiesLijst(b.dataset.ov, true); }, 500);
});
["pointerup", "pointercancel"].forEach(t => $("#ovChips").addEventListener(t, () => clearTimeout(langDruk)));
$("#ovChips").addEventListener("contextmenu", (e) => { if (e.target.closest(".ovchip")) e.preventDefault(); });
$("#ovChips").addEventListener("click", (e) => {
  const ik = e.target.closest("[data-inst]");
  if (ik) { openInst(ik.dataset.inst); return; }
  const mk = e.target.closest("[data-menu]");
  if (mk) { $("#ovMenu")?.dataset.map === mk.dataset.menu ? sluitMenu() : toonMenu(mk.dataset.menu); return; }
  const b = e.target.closest(".ovchip"); if (!b) return;
  if (langGedaan) { langGedaan = false; return; }
  if (b.dataset.ov === "+") { nieuweLijst(); return; }
  kiesLijst(b.dataset.ov, e.ctrlKey || e.metaKey || e.shiftKey);
});

// ---------- weergaves ----------
// Boodschappen: eigen module; de invoer (wat je aan het typen bent) blijft staan als de pagina opnieuw getekend wordt
const boodschappen = () => `<div class="bspagina">${boodschappenWeergave()}</div>`;
const weergaves = { vandaag, matrix, projecten, taken, agenda, boodschappen, inzicht, koers, instellingen };
function huidige() { const h = location.hash.slice(1); return weergaves[h] ? h : "vandaag"; }

// Koppelingen (agenda's, takenlijsten, schijf) horen bij het hele Tijdkompas: via de cloud gedeeld met al je inlogs
koppelHaak.wijzig = (metas) => { if (cloudGeladen()) { d().koppelingen = metas; bewaar(); } };
function deelKoppelingen() {
  if (!cloudGeladen()) return;
  const naar = neemGedeeldeOver(d().koppelingen, sessie.ik);
  if (naar) setTimeout(() => { d().koppelingen = naar; bewaar(); }, 0);
}
function render() {
  deelKoppelingen();
  renderChips();
  const v = huidige();
  $$("#nav a").forEach(a => a.classList.toggle("actief", a.dataset.v === v));
  const scroll = window.scrollY;
  const inv = $("#bsInvoer"), bsTekst = inv?.value, bsFocus = inv && document.activeElement === inv, bsPos = inv?.selectionStart;
  main.innerHTML = sessieBanner() + weergaves[v]();
  if (v === "boodschappen" && inv) { const n = $("#bsInvoer"); if (n) { n.value = bsTekst; if (bsFocus) { n.focus(); try { n.setSelectionRange(bsPos, bsPos); } catch {} } } }
  markeerFocus(main);
  if (v === "matrix") activeerSlepen();
  if ((v === "agenda" || v === "vandaag") && (verbindingen().length || (d().agendaLinks || []).length) && !doeOphalen.bezig && Date.now() - new Date(d().agendaSync || 0) > 15 * 60e3) {
    doeOphalen.bezig = true; doeOphalen(true).finally(() => { doeOphalen.bezig = false; });
  }
  if (takenVerbindingen().length && !doeTakenSync.bezig && Object.values(d().takenlijsten || {}).some(x => x.lijst)
      && Date.now() - new Date(d().takenSync || 0) > 2 * 60e3) setTimeout(() => doeTakenSync(true), 50);
  window.scrollTo(0, scroll);
  renderAccount();
  zetThema();
  if (dlg3.open && instOpen) tekenInst();
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
opslag.luister(({ stil } = {}) => { if (!stil) planSchrijven(); feedsLater(); famAgendaLater(); render(); });
// Een gelinkt account (jij in een andere rol) plande iets uit één van mijn lijsten: dat zet ik in mijn eigen agenda,
// en ik werk het bij of haal het weg als dat account het verschuift of verwijdert.
let famTimer = null;
function famAgendaLater() {
  clearTimeout(famTimer);
  famTimer = setTimeout(() => {
    if (!ingelogd() || !verbindingen().length) return;
    const { blokken, klaar } = familieVoorMij(); if (!klaar) return;
    const ids = new Set(), ext = d().extern || {};
    for (const b of blokken) { const x = ext[b.id]; if (doelAgendaVan(b) && (!x || x.start !== b.start || x.eind !== b.eind || x.th !== vingerafdruk(b.titel))) ids.add(b.id); }
    for (const [id, x] of Object.entries(ext)) if (x.fam && new Date(x.eind) > new Date() && !blokken.some(b => b.id === id)) ids.add(id);
    if (ids.size) doeNaarAgenda(ids, { stil: true }).catch(() => {});
  }, 4000);
}
// Enter in het e-mailveld: inloglink sturen (niet het venster sluiten)
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "inlogMail") { e.preventDefault(); e.target.closest("div").parentElement.querySelector("[data-actie=mailLink]")?.click(); } }, true);
opCloud(() => {
  if (cloud.koppelResultaat) { const r = cloud.koppelResultaat; cloud.koppelResultaat = null;
    setTimeout(() => toast(r.geweigerd ? `${r.email} heeft het linken geweigerd` : `${r.email} is nu gelinkt`), 300); }
  // niet hertekenen terwijl je een koppelcode intypt
  if (document.activeElement?.closest?.("[data-koppelform]")) { renderAccount(); return; }
  render();
  if (dlg.open && dlg.querySelector("[data-familie]")) $("#accountKnop").click();   // accountvenster bijwerken
});
// schijfstatus: niet hertekenen terwijl iemand in een veld typt
opSchijf(() => { if (document.activeElement?.matches?.("input,select,textarea")) renderAccount(); else render(); });

function demoBanner() {
  return d().demo ? `<div class="banner"><span>🧭 Je kijkt naar <b>voorbeelddata</b>. Speel ermee — en begin schoon zodra je zover bent.</span>
    <button class="knop klein" data-actie="leeg">Begin met lege planner</button></div>` : "";
}
function snelInvoer(ph = "Nieuwe taak… bv. Offerte sturen ~45m !u ^vr #presentatie") {
  return `<form class="snel" data-actie="snel"><input type="text" name="t" placeholder="${esc(ph)}" autocomplete="off" aria-label="Snel een taak toevoegen">
    <button class="knop prim">Toevoegen</button></form>`;
}

// ===== Vandaag =====
// Afspraken: die van dit account vallen op (in hun eigen Google-/Outlook-kleur); die van je gelinkte account(s)
// staan er ook, gedimd in één rustige kleur — zo heb je het complete overzicht.
function afspraakStijl(ev) {
  if (ev.vanFamilie) return { k: { naam: ev.vanFamilie }, kleur: "var(--zacht)", ander: true };
  const k = d().agendas[ev.bron];
  return { k, kleur: ev.kleur || (k?.lijst ? ovKleur(k.lijst) : (k?.kleur || "var(--zacht)")), ander: false };
}
// Agenda en planning van je andere inlogs: licht en onopvallend, per inlog aan/uit (en hun blokken volgen ook de lijsten die aan staan)
const famUit = () => voorkeur.lees("famUit", []);
const famAgenda = () => {
  if (!ingelogd()) return { bezet: [], planning: [] };
  const f = familieAgenda(), uit = new Set(famUit()), act = new Set(actieveOverzichten());
  return { bezet: f.bezet.filter(e => !uit.has(e.vanUid)), planning: f.planning.filter(b => !uit.has(b.vanUid) && (!b.overzicht || act.has(b.overzicht))) };
};
// Afspraken uit een agenda die bij een lijst hoort: weg als die lijst uit staat
const afspraakZichtbaar = (ev) => { const l = d().agendas?.[ev.bron]?.lijst; return !l || !overzicht(l) || actieveOverzichten().includes(l); };
function vandaag() {
  const nu = new Date(), vd = vandaagStr();
  const open = d().taken.filter(t => t.status !== "klaar" && zichtbaar(t));
  // Alleen wat vandaag speelt: wat vandaag gepland staat, Doen dat nog niet is ingepland, en de rest alleen als er vandaag
  // nog een echt vrij gat voor is. Wat op een andere dag gepland staat, hoort hier niet.
  const eindVandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + 1);
  const rel = maakRelevant(new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()), eindVandaag);
  const openItems = [...open, ...d().projecten.filter(p => p.status !== "klaar" && zichtbaar(p) && zelfInTePlannen(p))];
  const eersteVandaag = (t) => d().planning.filter(b => b.item === t.id && b.soort !== "reis" && dagStr(new Date(b.start)) === vd).map(b => b.start).sort()[0] || "";
  const vandaagGepland = openItems.filter(t => rel(t) === "gepland").sort((a, b) => eersteVandaag(a).localeCompare(eersteVandaag(b)));
  const doenOpen = openItems.filter(t => rel(t) === "doen").sort((a, b) => prioriteit(b) - prioriteit(a));
  const metGat = openItems.filter(t => rel(t) === "gat").sort((a, b) => prioriteit(b) - prioriteit(a));
  const opMij = open.filter(t => doorWie(t, "wachtmij")).filter(t => rel(t));
  const rij = (i) => { const h = i.type === "taak" ? itemRij(i) : projectRijPlan(i); return doorGelinktIngepland(i) ? h.replace('class="item', 'class="item vangelinkt') : h; };
  const blokken = [
    ...d().planning.filter(b => dagStr(new Date(b.start)) === vd).filter(b => actieveOverzichten().includes(b.overzicht)),
    ...d().bezet.filter(b => dagStr(new Date(b.start)) === vd && afspraakZichtbaar(b) && telt(b)).map(b => ({ ...b, bezet: true })),
    ...(() => { const f = famAgenda(); return [...f.bezet.filter(b => !b.eigen && b.soortF !== "negeer"), ...f.planning.filter(b => b.soort !== "reis")]
      .filter(b => dagStr(new Date(b.start)) === vd).map(b => ({ ...b, bezet: true, fam: true })); })(),
  ].sort((a, b) => a.start.localeCompare(b.start));
  const geplandMin = blokken.filter(b => !b.bezet && !b.fam).reduce((s, b) => s + (new Date(b.eind) - new Date(b.start)) / 60000, 0);
  const projectRelevant = (p) => rel(p) || d().taken.some(t => t.project === p.id && t.status !== "klaar" && rel(t));
  const binnenWeek = [...open, ...d().projecten.filter(p => p.status !== "klaar" && zichtbaar(p) && !isLang(p))]
    .filter(i => { const x = harde(i.type === "taak" ? i : { ...i, project: null }) || i.streef; return x && dagenTot(x) <= 7; })
    .filter(i => i.type === "taak" ? rel(i) : projectRelevant(i))
    .sort((a, b) => (doelDatum(a) || "").localeCompare(doelDatum(b) || ""));
  const kal = kalibratie();
  const uur = nu.getHours(), groet = uur < 6 ? "Goedenacht" : uur < 12 ? "Goedemorgen" : uur < 18 ? "Goedemiddag" : "Goedenavond";

  return `${demoBanner()}
  <div class="titelbalk"><h1>${groet}</h1><span class="sub">${DAG[nu.getDay()]} ${nu.getDate()} ${MAAND[nu.getMonth()]}</span></div>
  ${boodschappenVandaag()}
  ${d().overzichten.length ? "" : `<div class="paneel welkom"><b>Welkom bij Tijdkompas!</b> Begin met je eerste lijst, bijvoorbeeld <i>Werk</i>, <i>Thuis</i> of je hobby.
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="knop prim" data-actie="eersteLijst">＋ Lijst maken</button>
    ${ids().google || ids().microsoft ? `<a class="knop" href="#instellingen" data-tab="koppelingen">✅ Takenlijst van Google of Microsoft gebruiken</a>` : ""}</div></div>`}
  ${herplanBlok()}
  ${botsingBlok()}
  ${buitenBlok()}
  ${snelInvoer()}
  <div class="raster2">
    <section>
      <h3>Vandaag gepland</h3>
      <div class="lijst">${vandaagGepland.map(rij).join("") || `<div class="leeg">Voor vandaag staat er niets (meer) gepland.</div>`}</div>
      ${doenOpen.length ? `<h3 style="color:var(--q-doen)">⚡ Doen — nog niet ingepland</h3><div class="lijst">${doenOpen.map(rij).join("")}</div>` : ""}
      ${metGat.length ? `<h3>Als je vandaag tijd over hebt</h3>
        <p class="hint" style="margin:-4px 0 8px">Er is vandaag nog een echt vrij gat voor: minstens een uur, of lang genoeg voor de geschatte tijd.</p>
        <div class="lijst">${metGat.slice(0, 8).map(rij).join("")}${metGat.length > 8 ? `<div class="hint">+ ${metGat.length - 8} meer bij Taken</div>` : ""}</div>` : ""}
      <h3>Vandaag in je agenda</h3>
      <div class="tijdlijn">${blokken.map(b => { const st = b.bezet ? afspraakStijl(b) : null;
          const gel = !b.bezet && doorGelinktIngepland({ overzicht: b.overzicht });
          return `<div class="tblok ${b.bezet || gel ? "bezet" : ""}${st?.ander || gel ? " ander" : ""}" style="--ok:${st ? esc(st.kleur) : gel ? "var(--zacht)" : ovKleur(b.overzicht)}" ${b.bezet ? `data-ev="${esc(b.id)}" data-evfam="${b.fam ? 1 : ""}"` : `data-blok="${b.id}"`}>
          <span class="tijd">${fmtTijd(b.start)}–${fmtTijd(b.eind)}</span><span>${b.bezet ? "📅 " : ""}${esc(b.titel)}</span></div>`; }).join("")
        || `<div class="leeg">Nog niets ingepland. <a href="#agenda">Open de agenda</a> en laat Tijdkompas je dag vullen.</div>`}</div>
    </section>
    <aside>
      <div class="stats">
        <div class="stat"><b>${open.length}</b><span>open taken</span></div>
        <div class="stat"><b>${fmtDuur(geplandMin) || "0"}</b><span>vandaag ingepland</span></div>
        <div class="stat"><b>${open.filter(t => kwadrant(t) === "doen").length}</b><span>urgent &amp; belangrijk</span></div>
        <div class="stat" title="Werkelijke tijd gedeeld door geschatte tijd (afgeronde taken)"><b>${kal.n >= 3 ? "×" + kal.factor.toFixed(2) : "–"}</b><span>schatfactor${kal.n < 3 ? " (na 3 taken)" : ""}</span></div>
      </div>
      ${opMij.length ? `<h3>⏳ Anderen wachten op jou</h3><div class="lijst">${opMij.map(t => itemRij(t)).join("")}</div>` : ""}
      ${koersVandaag()}
      ${binnenWeek.length ? `<h3>Deadlines komende 7 dagen</h3>
      <div class="lijst">${binnenWeek.map(i => i.type === "taak" ? itemRij(i) : projectRij(i)).join("")}</div>` : ""}
    </aside>
  </div>`;
}

function koersVandaag() {
  const vd = vandaagStr(), lopend = d().koers.filter(a => binnenPeriode(a, vd) && koersZichtbaar(a) && koersVoorMij(a));
  if (!lopend.length) return `<h3>🎯 Koers</h3><div class="leeg">Leg je jaarplan / POP-afspraken vast en zie wat eraan bijdraagt: <a href="#koers">🎯 Koers</a></div>`;
  return `<h3>🎯 Koers <a href="#koers" class="hint" style="font-weight:400">alles →</a></h3><div class="lijst">${lopend.map(a => {
    const tk = koersTaken(a), k = tk.filter(t => t.status === "klaar").length, v = koersVoorstellen(a).length;
    return `<a class="item koersitem" href="#koers" style="--ok:${doelKleur(a)}" title="${esc(koersZichtTekst(a).lang)}"><span>${a.gedeeld ? "👥" : "🔒"}</span><div class="ibody"><div class="ititel">${esc(a.titel)}</div>
      <div class="imeta"><span>${esc(doelTekst(a))}</span><span>${k}/${tk.length} taken klaar</span>${v ? `<span class="tag hierop">💡 ${v} ${v === 1 ? "voorstel" : "voorstellen"}</span>` : ""}</div></div></a>`; }).join("")}</div>`;
}

function projectRij(p) {
  const v = projectVoortgang(p);
  return `<div class="item" data-id="${p.id}" data-type="project" style="--ok:${ovKleur(p.overzicht)}">
    <span class="picoon" style="color:var(--ok);font-size:18px">${pIcoon(p)}</span>
    <div class="ibody"><div class="ititel">${esc(p.titel)}</div><div class="imeta">${qTag(p)}${datumTags(p)}<span>${v.klaar}/${v.totaal} taken</span></div></div>
    ${linkjes(p)}${p.schatting ? `<span class="duur">${fmtDuur(p.schatting)}</span>` : ""}</div>`;
}

// ===== Matrix =====
function matrix() {
  const toon = voorkeur.lees("matrixToon", "beide");
  const items = [
    ...(toon !== "taken" ? d().projecten.filter(p => !isLang(p)) : []),
    ...(toon !== "projecten" ? d().taken : []),
  ].filter(i => i.status !== "klaar" && zichtbaar(i) && doorWie(i));
  const kaart = (i) => {
    const p = i.type === "taak" && i.project ? project(i.project) : null;
    const dl = doelDatum(i);
    const ps = i.type === "project" && d().taken.some(x => x.project === i.id && x.status !== "klaar") ? null : planStatus(i);
    return `<div class="kaartje ${i.type === "project" ? "proj" : ""}${ps ? " pl-" + ps.soort : ""}" data-id="${i.id}" data-type="${i.type}" style="--ok:${ovKleur(i.overzicht)}">
      ${ps ? `<small class="plicoon" title="${ps.soort === "ja" ? "Ingepland: " + wanneer(ps.van) : ps.soort === "deels" ? "Deels ingepland, nog " + fmtDuur(ps.rest) : "Nog niet ingepland"}">${ps.soort === "ja" ? "📅" : ps.soort === "deels" ? "◐" : "○"}</small>` : ""}
      ${i.type === "project" ? `<span class="picoon" style="color:var(--ok)">${pIcoon(i)}</span>` : ""}<span class="ktit">${esc(i.titel)}${p ? ` <small>· ${p.icoon ? esc(p.icoon) + " " : ""}${esc(p.titel)}</small>` : ""}</span>
      ${dl ? `<small>${fmtDatum(dl)}</small>` : ""}${i.schatting ? `<small>${fmtDuur(i.schatting)}</small>` : ""}${i.type === "taak" && wachtNogOp(i).length ? `<small title="Wacht op een andere taak">⛓</small>` : ""}${i.type === "taak" && !isMijn(i) ? `<small>👤 ${esc(wieTekst(i))}</small>` : ""}</div>`;
  };
  const vak = (q) => {
    const lijst = items.filter(i => kwadrant(i) === q).sort((a, b) => prioriteit(b) - prioriteit(a));
    const min = lijst.reduce((s, i) => s + (i.schatting || 0), 0);
    return `<section class="kwadrant" data-q="${q}" style="--qk:${qKleur(q)}">
      <header><h2>${KWADRANTEN[q].naam}</h2><small>${KWADRANTEN[q].sub}</small><span class="tel">${lijst.length}${min ? " · " + fmtDuur(min) : ""}</span></header>
      ${lijst.map(kaart).join("") || `<span class="hint">Sleep iets hierheen</span>`}</section>`;
  };
  return `<div class="titelbalk"><h1>Eisenhower-matrix</h1><span class="sub">Sleep kaartjes om urgentie en belang te wijzigen</span>
    <div class="rechts" data-actie="wieKeuze">${wieKeuze()}</div>
    <div class="rechts chips" data-actie="matrixToon" style="margin-left:0">${["beide", "projecten", "taken"].map(x => `<button type="button" data-w="${x}" style="${x === toon ? "border-color:var(--accent);color:var(--accent)" : ""}">${x[0].toUpperCase() + x.slice(1)}</button>`).join("")}</div></div>
  <div class="matrix">
    <div></div><div class="as">Urgent</div><div class="as">Niet urgent</div>
    <div class="as v">Belangrijk</div>${vak("doen")}${vak("plannen")}
    <div class="as v">Niet belangrijk</div>${vak("delegeren")}${vak("schrappen")}
  </div>
  <p class="hint matrixtips">Doen = vandaag/morgen zelf oppakken · Plannen = bewust tijd voor reserveren (hier zit de echte winst) · Delegeren = kan iemand anders dit? · Schrappen = wordt niet automatisch ingepland.</p>`;
}

function activeerSlepen() {
  let sleep = null;
  $$(".kaartje", main).forEach(k => {
    k.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const st = { x: e.clientX, y: e.clientY, k, actief: false, ghost: null };
      sleep = st;
      k.setPointerCapture(e.pointerId);
    });
    k.addEventListener("pointermove", (e) => {
      if (!sleep || sleep.k !== k) return;
      if (!sleep.actief && Math.hypot(e.clientX - sleep.x, e.clientY - sleep.y) > 6) {
        sleep.actief = true;
        const r = k.getBoundingClientRect();
        sleep.ghost = k.cloneNode(true); sleep.ghost.classList.add("sleep");
        sleep.ghost.style.width = r.width + "px"; sleep.dx = e.clientX - r.left; sleep.dy = e.clientY - r.top;
        document.body.appendChild(sleep.ghost); k.style.opacity = .3;
      }
      if (sleep.actief) {
        sleep.ghost.style.left = e.clientX - sleep.dx + "px"; sleep.ghost.style.top = e.clientY - sleep.dy + "px";
        const doel = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.classList?.contains("kwadrant"));
        $$(".kwadrant", main).forEach(q => q.classList.toggle("doel", q === doel));
      }
    });
    const stop = (e) => {
      if (!sleep || sleep.k !== k) return;
      const st = sleep; sleep = null;
      if (!st.actief) return;                       // gewone klik: main-klikhandler opent de editor
      st.ghost.remove(); k.style.opacity = "";
      const stopper = (ev) => ev.stopPropagation();
      window.addEventListener("click", stopper, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", stopper, { capture: true }), 0);
      const doel = document.elementsFromPoint(e.clientX, e.clientY).find(el => el.classList?.contains("kwadrant"));
      $$(".kwadrant", main).forEach(q => q.classList.remove("doel"));
      if (doel) {
        const it = k.dataset.type === "project" ? project(k.dataset.id) : taak(k.dataset.id);
        const q = KWADRANTEN[doel.dataset.q];
        if (it && (it.urgent !== q.urgent || it.belangrijk !== q.belangrijk)) {
          const wasDoen = kwadrant(it) === "doen";
          werkBij(it, { urgent: q.urgent, belangrijk: q.belangrijk });
          toast(`„${it.titel}” → ${q.naam}`);
          naDoen(it, wasDoen);
        }
      }
    };
    k.addEventListener("pointerup", stop);
    k.addEventListener("pointercancel", (e) => { if (sleep?.ghost) sleep.ghost.remove(); k.style.opacity = ""; sleep = null; });
  });
}

// ===== Projecten =====
function projecten() {
  const toonKlaar = voorkeur.lees("toonKlaarProj", false);
  const lijst = d().projecten.filter(p => zichtbaar(p) && (toonKlaar || p.status !== "klaar") && !ouderVan(p))
    .sort((a, b) => (a.status === "klaar") - (b.status === "klaar") || prioriteit(b) - prioriteit(a));
  const lang = lijst.filter(isLang), kort = lijst.filter(p => !isLang(p));
  const sectie = (kop, uitleg, items, kaart) => items.length ? `${lang.length && kort.length ? `<h3 class="projsectie">${kop} <small class="hint">${uitleg}</small></h3>` : ""}<div class="kaarten">${items.map(kaart).join("")}</div>` : "";
  return `<div class="titelbalk"><h1>Projecten</h1><span class="sub">${lijst.length} ${lijst.length === 1 ? "project" : "projecten"}</span>
    <div class="rechts"><label class="schakel"><input type="checkbox" data-actie="toonKlaarProj" ${toonKlaar ? "checked" : ""}> afgerond tonen</label>
    <button class="knop prim" data-actie="nieuwProject">＋ Project</button></div></div>
  ${sectie("♾️ Langlopend", "doorlopend, met tussendoelen", lang, langKaart)}
  ${sectie("🏁 Kortlopend", "met een duidelijk eind", kort, kortKaart)}
  ${lijst.length ? (lang.length ? "" : `<p class="hint">Tip: heeft een project geen duidelijk eind (of is het nog niet in zicht)? Maak het <b>♾️ langlopend</b> en knip het op in tussendoelen: kortlopende deelprojecten met een concreet resultaat.</p>`)
    : `<div class="leeg">Nog geen projecten. Begin met „＋ Project” en deel het op in taken.</div>`}`;
}
function kortKaart(p) {
  const v = projectVoortgang(p), ov = overzicht(p.overzicht);
  const open = takenVan(p.id).filter(t => t.status !== "klaar").sort((a, b) => prioriteit(b) - prioriteit(a));
  const schat = p.schatting || v.schatTaken;
  return `<article class="pkaart" data-id="${p.id}" data-type="project" style="--ok:${ovKleur(p.overzicht)}">
      <div class="imeta">${qTag(p)}${datumTags(p)}<span>${ov ? esc(ov.icoon) + " " + esc(ov.naam) : ""}</span>${andereLeden(ov).length ? `<span title="Gedeelde lijst">👥 ${andereLeden(ov).length + 1}</span>` : ""}</div>
      <h2>${projectIcoon(p) ? `<span class="picoon">${esc(projectIcoon(p))}</span> ` : ""}${esc(p.titel)}</h2>
      ${p.doel ? `<div class="pdoel">🏁 ${esc(p.doel)}</div>` : ""}
      <div class="balk"><i style="width:${v.pct}%"></i></div>
      <div class="cijfers"><span>${v.klaar}/${v.totaal} taken klaar</span><span title="Bestede tijd / geschatte tijd">${fmtDuur(v.werkelijk) || "0"} / ${fmtDuur(schat) || "?"}</span></div>
      ${p.schatting && v.schatTaken && Math.abs(p.schatting - v.schatTaken) > 30 ? `<div class="vergelijk">Projectschatting ${fmtDuur(p.schatting)} · som van taken ${fmtDuur(v.schatTaken)}</div>` : ""}
      ${open.length ? `<div class="lijst subtaken">${open.slice(0, 3).map(t => `<div class="imeta">○ ${esc(t.titel)} ${t.schatting ? "· " + fmtDuur(t.schatting) : ""}</div>`).join("")}${open.length > 3 ? `<div class="imeta">+ ${open.length - 3} meer</div>` : ""}</div>` : ""}
      ${linkjes(p)}
    </article>`;
}
function langKaart(p) {
  const v = projectVoortgang(p), ov = overzicht(p.overzicht);
  const deel = deelprojecten(p.id), open = deel.filter(x => x.status !== "klaar").sort((a, b) => (doelDatum(a) || "9999").localeCompare(doelDatum(b) || "9999") || prioriteit(b) - prioriteit(a));
  const gehaald = deel.filter(x => x.status === "klaar").sort((a, b) => (b.klaarOp || "").localeCompare(a.klaarOp || ""));
  const los = takenVan(p.id).filter(t => t.status !== "klaar");
  return `<article class="pkaart lang" data-id="${p.id}" data-type="project" style="--ok:${ovKleur(p.overzicht)}">
      <div class="imeta"><span class="tag">♾️ doorlopend</span><span>${ov ? esc(ov.icoon) + " " + esc(ov.naam) : ""}</span>${andereLeden(ov).length ? `<span title="Gedeelde lijst">👥 ${andereLeden(ov).length + 1}</span>` : ""}</div>
      <h2>${projectIcoon(p) ? `<span class="picoon">${esc(projectIcoon(p))}</span> ` : ""}${esc(p.titel)}</h2>
      <div class="pdoel">${p.doel ? `🧭 ${esc(p.doel)}` : `<span class="hint">🧭 Stip op de horizon nog niet geformuleerd</span>`}</div>
      ${open.length ? `<div class="tussendoelen">${open.map((x, i) => { const w = projectVoortgang(x), dl = doelDatum(x);
        return `<div class="tussendoel${i ? "" : " nu"}" data-id="${x.id}" data-type="project">
          <div class="tdkop"><span>🏁</span><b>${esc(x.titel)}</b>${i ? "" : `<span class="tag">nu</span>`}${dl ? `<small>${fmtDatum(dl)}</small>` : ""}</div>
          ${x.doel ? `<div class="hint">${esc(x.doel)}</div>` : ""}
          ${w.totaal ? `<div class="balk"><i style="width:${w.pct}%"></i></div><small class="hint">${w.klaar}/${w.totaal} taken</small>` : `<small class="hint">nog geen taken</small>`}</div>`; }).join("")}</div>`
        : `<div class="hint">Nog geen tussendoel. Wat is een mooi, haalbaar eerste resultaat?</div>`}
      <div class="cijfers"><span>${gehaald.length ? `✓ ${gehaald.length} ${gehaald.length === 1 ? "tussendoel" : "tussendoelen"} gehaald${gehaald[0] ? ` (laatst: ${esc(gehaald[0].titel)})` : ""}` : "Nog geen tussendoel gehaald"}</span>
        <span title="Bestede tijd, alles bij elkaar">${fmtDuur(v.werkelijk) || "0"} besteed</span></div>
      ${los.length ? `<div class="hint">${los.length} ${los.length === 1 ? "losse taak" : "losse taken"} (doorlopend werk)</div>` : ""}
      <div><button type="button" class="knop klein" data-actie="tussendoel" data-w="${p.id}">＋ Tussendoel</button></div>
      ${linkjes(p)}
    </article>`;
}

// ===== Taken =====
function taken() {
  const f = voorkeur.lees("takenFilter", { status: "open", groep: "project", zoek: "" });
  let lijst = d().taken.filter(zichtbaar).filter(t => doorWie(t))
    .filter(t => f.status === "alles" || (f.status === "open" ? t.status !== "klaar" : t.status === "klaar"))
    .filter(t => !f.zoek || (t.titel + " " + t.notitie).toLowerCase().includes(f.zoek.toLowerCase()))
    .sort((a, b) => prioriteit(b) - prioriteit(a));
  let inhoud = "";
  if (f.groep === "project") {
    const losse = lijst.filter(t => !t.project);
    const volg = (p) => { const o = ouderVan(p); return o ? d().projecten.indexOf(o) + 0.5 + d().projecten.indexOf(p) / 1e6 : d().projecten.indexOf(p); };
    const proj = d().projecten.filter(p => lijst.some(t => t.project === p.id)).sort((a, b) => volg(a) - volg(b));
    inhoud = proj.map(p => `<div class="groep${ouderVan(p) ? " deelgroep" : ""}"><div class="groepkop" data-id="${p.id}" data-type="project"><span class="picoon" style="color:${ovKleur(p.overzicht)}">${pIcoon(p)}</span><h2>${ouderVan(p) ? `<small class="hint">${esc(ouderVan(p).titel)} › </small>` : ""}${esc(p.titel)}${isLang(p) ? ` <small class="hint">♾️</small>` : ""}</h2><span class="tel">${lijst.filter(t => t.project === p.id).length}</span></div>
      <div class="lijst">${lijst.filter(t => t.project === p.id).map(t => itemRij(t, { toonProject: false })).join("")}</div></div>`).join("")
      + (losse.length ? `<div class="groep"><div class="groepkop"><span>○</span><h2>Losse taken</h2><span class="tel">${losse.length}</span></div><div class="lijst">${losse.map(t => itemRij(t)).join("")}</div></div>` : "");
  } else if (f.groep === "kwadrant") {
    inhoud = Object.keys(KWADRANTEN).map(q => { const l = lijst.filter(t => kwadrant(t) === q); return l.length ? `<div class="groep"><div class="groepkop"><h2 style="color:${qKleur(q)}">${KWADRANTEN[q].naam}</h2><span class="tel">${KWADRANTEN[q].sub} · ${l.length}</span></div><div class="lijst">${l.map(t => itemRij(t)).join("")}</div></div>` : ""; }).join("");
  } else if (f.groep === "planning") {
    const st = new Map(lijst.map(t => [t.id, t.status === "klaar" ? "klaar" : planStatus(t).soort]));
    const van = (t) => planStatus(t).van || "";
    const groepen = [["niet", "○ Nog niet ingepland", "Klik op „Nog niet ingepland” voor voorstellen, of laat ⚡ Automatisch inplannen alles verdelen."],
                     ["deels", "◐ Deels ingepland", "Een deel staat in je agenda; de rest nog niet."],
                     ["ja", "📅 Ingepland", "Op volgorde van wanneer."], ["klaar", "✓ Afgerond", ""]];
    inhoud = groepen.map(([k, kop, uitleg]) => { const l = lijst.filter(t => st.get(t.id) === k); if (k === "ja") l.sort((a, b) => van(a).localeCompare(van(b)));
      return l.length ? `<div class="groep plgroep-${k}"><div class="groepkop"><h2>${kop}</h2><span class="tel">${l.length}</span></div>${uitleg ? `<p class="hint" style="margin:-4px 0 8px">${uitleg}</p>` : ""}<div class="lijst">${l.map(t => itemRij(t)).join("")}</div></div>` : ""; }).join("");
  } else if (f.groep === "datum") {
    lijst.sort((a, b) => (doelDatum(a) || "9999").localeCompare(doelDatum(b) || "9999"));
    inhoud = `<div class="lijst">${lijst.map(t => itemRij(t)).join("")}</div>`;
  } else inhoud = `<div class="lijst">${lijst.map(t => itemRij(t)).join("")}</div>`;

  return `<div class="titelbalk"><h1>Taken</h1><span class="sub">${lijst.length} getoond · ${fmtDuur(lijst.filter(t => t.status !== "klaar").reduce((s, t) => s + (t.schatting || 0), 0)) || "0"} geschat werk</span></div>
  ${snelInvoer()}
  <div class="rij" style="margin-bottom:14px" data-actie="takenFilter">
    <input type="text" name="zoek" placeholder="Zoeken…" value="${esc(f.zoek)}">
    <select name="status">${[["open", "Openstaand"], ["klaar", "Afgerond"], ["alles", "Alles"]].map(([v, n]) => `<option value="${v}" ${f.status === v ? "selected" : ""}>${n}</option>`).join("")}</select>
    <select name="groep">${[["project", "Per project"], ["planning", "Ingepland of niet"], ["kwadrant", "Per kwadrant"], ["datum", "Op datum"], ["geen", "Op prioriteit"]].map(([v, n]) => `<option value="${v}" ${f.groep === v ? "selected" : ""}>${n}</option>`).join("")}</select>
    ${wieKeuze()}
  </div>
  ${inhoud || `<div class="leeg">Geen taken gevonden.</div>`}
  <p class="hint" style="margin-top:16px">Snelinvoer: <b>~1u30</b> duur · <b>!u</b> urgent · <b>!b</b> belangrijk · <b>!nb</b> niet belangrijk · <b>^vr</b> / <b>^15-11</b> / <b>^morgen</b> deadline · <b>#woord</b> project · <b>+werk</b> lijst · <b>@naam</b> wie (<b>@team</b> = hele groep)</p>`;
}

// ===== Agenda =====
const UUR_VAN = 6, UUR_TOT = 24, UUR_H = 44;
function agenda() {
  const nu = new Date();
  // altijd een hele week (ma–zo), ook op een telefoon
  const ma = (nu.getDay() + 6) % 7, start = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - ma + weekVerschuiving * 7);
  const n = 7;
  const dagen = Array.from({ length: n }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  const act = actieveOverzichten();
  const hoogte = (UUR_TOT - UUR_VAN) * UUR_H;

  const kolommen = dagen.map(dag => {
    const ds = dagStr(dag), eindDag = new Date(dag.getTime() + 864e5);
    const I = dagIndeling(dag);
    const y = (t) => ((new Date(t) - dag) / 36e5 - UUR_VAN) * UUR_H;
    const band = (a, b, cls, stijl, titel, inhoud = "", extra = "") => {
      const t = Math.max(0, y(a)), h = Math.min(hoogte, y(b)) - t;
      return h > 0 ? `<div class="${cls}" style="top:${t}px;height:${h}px;${stijl}" title="${esc(titel)}" ${extra}>${inhoud}</div>` : "";
    };
    const inDag = (b) => new Date(b.start) < eindDag && new Date(b.eind) > dag;
    const beschikb = I.beschikbaar.map(([a, b]) => band(a, b, "beschikb", "", "Beschikbaar")).join("");
    const vast = I.vast.map(v => {
      const o = overzicht(v.lijst), l = locatie(v.locatie), licht = !act.includes(v.lijst) || doorGelinktIngepland({ overzicht: v.lijst });
      return band(v.a, v.b, licht ? "venster licht" : "venster", `--vk:${licht ? "var(--zacht)" : esc(o.kleur)}`, `${o.naam}${l ? " · " + l.naam : ""}${v.bron === "rooster" ? " (rooster uit agenda)" : ""}`,
        `<span class="vlabel">${esc(o.icoon)}${l ? " " + esc(l.icoon) : ""}</span>`);
    }).join("");
    const elders = I.elders.map(v => { const o = overzicht(v.lijst), l = locatie(v.locatie);
      return band(v.a, v.b, "eldersband", "", `${v.reden || "Cursus / elders"}${l ? " · " + l.naam : ""} (${o?.naam || ""}) — hier wordt niets ingepland`, `<span class="vlabel">🎓 ${esc(v.reden || "")}</span>`); }).join("")
      + (I.weg ? `<div class="wegband" title="Hele dag weg${esc(I.weg.reden ? " — " + I.weg.reden : "")}: hier wordt niets ingepland"><span>✈️ ${esc(I.weg.reden || "Weg")}</span></div>` : "");
    const reis = [...I.reis, ...I.terPlekke.map(x => ({ ...x, terPlekke: true }))].map(r =>
      band(r.a, r.b, r.terPlekke ? "reisband terplekke" : `reisband${r.status && r.status !== "ok" ? " " + r.status : ""}${r.route ? " route" : ""}`, "",
        r.terPlekke ? `Pauze ter plekke (${r.naam || locatie(r.locatie)?.naam || ""})` : reisTitel(r),
        r.terPlekke ? "" : `<span>${r.status === "rood" ? "⛔" : r.status === "geel" ? "⚠️" : VERVOER[vervoer()].icoon}</span>${y(r.b) - y(r.a) >= 30 && r.min ? `<small>${Math.round(r.min)}′${r.marge ? `+${r.marge}` : ""}</small>` : ""}`)).join("");
    const fam = famAgenda();
    const famBlokken = fam.planning.filter(b => b.soort !== "reis").filter(inDag).map(b => {
      const t = Math.max(0, y(b.start)), h = Math.max(14, Math.min(hoogte, y(b.eind)) - t);
      return `<div class="wblok ander famblok" style="--ok:var(--zacht);top:${t}px;height:${h - 2}px" title="${esc(b.titel)} ${fmtTijd(b.start)}–${fmtTijd(b.eind)} · planning van ${esc(b.vanFamilie)}">
        <b>${esc(b.titel)}</b>${h > 30 ? `<span class="btijd">${fmtTijd(b.start)}–${fmtTijd(b.eind)}</span>` : ""}</div>`;
    }).join("");
    const afspraken = [...d().bezet.filter(ev => eventSoort(ev) === "bezet" && afspraakZichtbaar(ev)), ...fam.bezet.filter(ev => ev.soortF === "bezet")].filter(inDag).filter(ev => !ev.eigen).map(ev => {
      const { k, kleur, ander } = afspraakStijl(ev);
      const t = Math.max(0, y(ev.start)), h = Math.max(16, Math.min(hoogte, y(ev.eind)) - t);
      return `<div class="wblok bezet${ander ? " ander" : ""}" data-ev="${esc(ev.id)}" data-evfam="${ev.vanFamilie ? 1 : ""}" style="--ak:${esc(kleur)};top:${t}px;height:${h - 2}px" title="${esc(ev.titel)} ${fmtTijd(ev.start)}–${fmtTijd(ev.eind)}${k ? " · " + esc(k.naam) : ""}${ev.plaats ? " · " + esc(ev.plaats) : ""}">
        <b>${esc(ev.titel)}</b>${h > 30 ? `<span class="btijd">${fmtTijd(ev.start)}–${fmtTijd(ev.eind)}</span>` : ""}</div>`;
    }).join("");
    const herinn = d().bezet.filter(ev => !ev.eigen && inDag(ev) && afspraakZichtbaar(ev) && isHerinnering(ev)).map(ev => {
      const t = Math.max(0, y(ev.start));
      return `<div class="wblok herinnering" data-ev="${esc(ev.id)}" style="top:${t}px" title="🔔 ${esc(ev.titel)} ${fmtTijd(ev.start)} · herinnering (telt niet als bezet)">🔔 ${esc(ev.titel)}</div>`;
    }).join("");
    const blokken = d().planning.filter(b => act.includes(b.overzicht)).filter(inDag).map(b => {
      const t = Math.max(0, y(b.start)), h = Math.max(14, Math.min(hoogte, y(b.eind)) - t);
      const inAgenda = d().extern?.[b.id];
      // uit een lijst van je andere account: net als de rest van dat account licht en onopvallend (maar wel aan te klikken)
      const gel = doorGelinktIngepland({ overzicht: b.overzicht });
      return `<div class="wblok ${b.soort === "reis" ? "reis" : b.soort === "uitloop" ? "uitloop" : ""} ${b.vast ? "vast" : ""}${gel ? " ander famblok mijnfam" : ""}" data-blok="${b.id}" style="--ok:${gel ? "var(--zacht)" : ovKleur(b.overzicht)};top:${t}px;height:${h - 2}px" title="${esc(b.titel)} ${fmtTijd(b.start)}–${fmtTijd(b.eind)}${gel ? " · lijst van je andere account" : ""}${inAgenda ? " · staat in je agenda" : ""}">
        <b>${b.soort === "reis" ? "🚗 " : ""}${esc(b.titel)}</b>${h > 30 ? `<span class="btijd">${fmtTijd(b.start)}–${fmtTijd(b.eind)}${inAgenda ? " ✓" : ""}</span>` : ""}</div>`;
    }).join("");
    const nulijn = ds === dagStr(nu) && nu.getHours() >= UUR_VAN && nu.getHours() < UUR_TOT ? `<div class="nulijn" style="top:${y(nu)}px"></div>` : "";
    return `<div class="wdag ${ds === dagStr(nu) ? "vandaag" : ""}" style="height:${hoogte}px;--uurH:${UUR_H}px">${beschikb}${vast}${elders}${reis}${herinn}${afspraken}${famBlokken}${blokken}${nulijn}</div>`;
  }).join("");

  const toekomst = d().planning.filter(b => new Date(b.eind) > nu && act.includes(b.overzicht));
  const metDoel = d().overzichten.some(o => o.doelAgenda) || d().planning.some(b => new Date(b.eind) > nu && doelAgendaVan(b)) || Object.keys(d().extern || {}).length > 0;
  const titel = `${dagen[0].getDate()} ${MAAND[dagen[0].getMonth()]} – ${dagen[n - 1].getDate()} ${MAAND[dagen[n - 1].getMonth()]}`;
  const gekoppeld = verbindingen().length > 0;
  return `<div class="titelbalk"><h1>Agenda</h1>
    <span class="chips"><button type="button" data-actie="week" data-w="-1">◀</button><button type="button" data-actie="week" data-w="0">Nu</button><button type="button" data-actie="week" data-w="1">▶</button></span>
    <span class="sub">${titel}</span>
    <div class="rechts">
      <button class="knop prim" data-actie="plan" title="Automatisch inplannen">⚡ <span><span class="breed">Automatisch i</span><span class="smal">I</span>nplannen</span></button>
      <button class="knop" data-actie="werkweek" data-w="${dagStr(dagen[0])}" title="Vakantie, cursus, geruilde dag of dagdeel vrij voor deze week">🗓️ Week aanpassen</button>
      ${gekoppeld ? `<button class="knop" data-actie="ophalen" title="${d().agendaSync ? "Laatst opgehaald " + new Date(d().agendaSync).toLocaleString("nl-NL", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : ""}">🔄 Agenda's ophalen</button>` : ""}
      ${gekoppeld && metDoel ? `<button class="knop" data-actie="naarAgenda" ${toekomst.length || Object.keys(d().extern || {}).length ? "" : "disabled"}>📤 In mijn agenda zetten</button>` : ""}
      ${gekoppeld ? "" : `<a class="knop" href="#instellingen" data-tab="koppelingen">🔗 Google/Outlook koppelen</a>`}
      <details class="meer"><summary class="knop">⋯</summary><div class="menu">
        <button class="knop" data-actie="naarVoren" ${toekomst.length ? "" : "disabled"} title="Al het ingeplande werk in je vaste werktijden schuift (in dezelfde volgorde) naar de eerste lege werktijd, bijv. na een afgezegde afspraak">⏪ Werk naar voren halen</button>
        <button class="knop" data-actie="importIcs">📥 .ics importeren</button>
        <button class="knop" data-actie="exportIcs" ${toekomst.length ? "" : "disabled"}>📤 .ics downloaden</button>
        <button class="knop gevaar" data-actie="wisPlanning" ${toekomst.length ? "" : "disabled"}>Planning wissen</button>
      </div></details>
    </div></div>
  ${herplanBlok()}
  ${botsingBlok()}
  ${buitenBlok()}
  ${ingelogd() && cloud.familieFout?.size ? `<div class="waarsch"><b>De planning van ${esc([...cloud.familieFout.keys()].map(u => emailVan(u) || "een gelinkt account").join(", "))} is niet te zien.</b>
    ${esc([...cloud.familieFout.values()][0] || "")} Na het bijwerken: log opnieuw in of ververs de pagina.</div>` : ""}
  ${laatsteWaarschuwingen.length ? `<div class="waarsch"><b>Let op:</b><ul>${laatsteWaarschuwingen.map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>` : ""}
  <div class="week" style="--dagen:${n}" id="weekRaster">
    <div class="wkop"></div>${dagen.map(dag => { const I = dagIndeling(dag), lab = dagLabel(I);
      return `<div class="wkop ${dagStr(dag) === dagStr(nu) ? "vandaag" : ""}">${DAG[dag.getDay()]}<b>${dag.getDate()}</b>${lab ? `<button type="button" class="afwlabel" data-actie="werkweek" data-w="${dagStr(dag)}" title="${esc(lab.titel)}">${esc(lab.kort)}</button>` : ""}</div>`; }).join("")}
    <div class="uren" style="height:${hoogte}px">${Array.from({ length: UUR_TOT - UUR_VAN }, (_, i) => i ? `<div style="top:${i * UUR_H}px">${UUR_VAN + i}:00</div>` : "").join("")}</div>
    ${kolommen}
  </div>
  ${(() => { const rel = maakRelevant(dagen[0], new Date(dagen[n - 1].getTime() + 864e5));
    const open = [...d().taken, ...d().projecten.filter(zelfInTePlannen)]
      .filter(t => t.status !== "klaar" && act.includes(t.overzicht) && isMijn(t) && !doorGelinktIngepland(t))
      .map(t => [t, planStatus(t)]).filter(([t, st]) => st.soort !== "ja" && rel(t)).sort(([a], [b]) => prioriteit(b) - prioriteit(a));
    return open.length ? `<details class="nietgepland" open><summary><h3>○ Nog in te plannen ${n === 7 ? "deze week" : "deze dagen"} <span class="tel">${open.length}</span></h3></summary>
      <p class="hint">Doen-taken die nog niet zijn ingepland, taken die hier al deels gepland staan, en andere taken als er ${n === 7 ? "deze week" : "deze dagen"} een echt vrij gat voor is (minstens een uur, of lang genoeg voor de geschatte tijd). Klik op „Nog niet ingepland” voor voorstellen.</p>
      <div class="lijst">${open.slice(0, 30).map(([t]) => t.type === "taak" ? itemRij(t) : projectRijPlan(t)).join("")}${open.length > 30 ? `<div class="hint">+ ${open.length - 30} meer — zie Taken → „Ingepland of niet”</div>` : ""}</div></details>` : ""; })()}
  <div class="legenda"><span><i class="lg venster"></i> vaste tijden van een lijst</span><span><i class="lg reisband"></i> reistijd (+ marge)</span><span><i class="lg lgrood"></i> reis past niet</span><span><i class="lg lggeel"></i> krap: opschieten</span><span><i class="lg beschikb"></i> beschikbaar (vrije tijd)</span><span><i class="lg eldersband"></i> cursus / elders</span>
    <span><i class="lg bezet"></i> afspraak uit je agenda</span>${(sessie.familie || []).length > 1 ? `<span><i class="lg famblok"></i> licht: je andere inlogs ${sessie.familie.filter(u => u !== sessie.ik).map(u =>
      `<button type="button" class="faminlog" data-actie="famToggle" data-w="${esc(u)}" aria-pressed="${!famUit().includes(u)}" title="Agenda en planning van deze inlog tonen of verbergen (de werktijden blijven altijd zichtbaar)">${famUit().includes(u) ? "🙈" : "👁"} ${esc(emailVan(u) || "gelinkt account")}</button>`).join(" ")}</span>` : ""}<span>📌 vastgezet · ✓ staat in je agenda</span>
    ${d().bezet.some(b => !verbindingVanBron(b.bron)) ? `<span>${d().bezet.filter(b => !verbindingVanBron(b.bron)).length} afspraken uit .ics · <a href="#" data-actie="wisBezet">wissen</a></span>` : ""}</div>
  <div class="paneel" style="margin-top:16px;font-size:13px;color:var(--meta)">
    <b style="color:var(--tekst)">Zo werkt inplannen</b> — Taken gaan op volgorde van kwadrant en deadline/streefdatum.
    Lijsten met <b>vaste tijden</b> (zoals werk) krijgen alleen hun eigen tijdvakken; de reistijd naar die locatie gaat af van je vrije tijd.
    Lijsten in de <b>vrije tijd</b> vullen wat er overblijft binnen je beschikbaarheid. Staat zo'n lijst of taak op een locatie met reistijd, dan plant Tijdkompas reis heen en terug en zet taken op dezelfde plek achter elkaar.
    Blokken beginnen op een ${({ 15: "heel kwartier", 60: "heel uur" })[d().instellingen.raster] || "heel of half uur"} (eindigt een afspraak eerder, dan is de rest pauze${d().instellingen.buffer ? `, plus ${d().instellingen.buffer} min extra` : ""}), duren hooguit ${d().instellingen.blokMax} min, en een dag wordt voor maximaal ${d().instellingen.vulgraad}% gevuld. Afspraken op „vrij” tellen niet mee.
    ${d().instellingen.kalibratie && kalibratie().n >= 3 ? `Schattingen worden gecorrigeerd met je schatfactor (×${kalibratie().factor.toFixed(2)}).` : ""}
  </div>`;
}
const verbindingVanBron = (bron) => verbindingen().some(v => String(bron).startsWith(v.id + "|"));

// ===== Inzicht =====
// ===== ⚙️ Instellingen van één lijst of map, overal te openen =====
let instOpen = null;
function openInst(sleutel) { instOpen = sleutel; tekenInst(); if (instOpen && !dlg3.open) dlg3.showModal(); }
function tekenInst() {
  const isMap = instOpen.startsWith("m:"), x = isMap ? map(instOpen.slice(2)) : overzicht(instOpen);
  if (!x) { instOpen = null; if (dlg3.open) dlg3.close(); return; }
  const koersHier = d().koers.filter(a => a.doel?.soort === (isMap ? "map" : "lijst") && a.doel.id === x.id);
  const viaMap = d().koers.filter(a => a.doel?.soort === "map" && a.doel.id !== x.id && (isMap ? mappenOnder(a.doel.id).includes(x.id) : lijstenOnder(a.doel.id).includes(x.id)));
  const pad = mapPad(isMap ? x.ouder : x.map).map(m => m.icoon + " " + m.naam).join(" › ");
  const inhoud = isMap ? boom(x.id).filter(r => r.diepte === 0) : [];
  dlg3.innerHTML = `<div class="dkop"><span class="soort">⚙️ ${isMap ? "Map" : "Lijst"} instellen${pad ? ` <small class="hint">· in ${esc(pad)}</small>` : ""}</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      ${instRij({ soort: isMap ? "map" : "lijst", x, diepte: 0 })}
      ${isMap ? `<div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">In deze map</div>
        <div class="chips">${inhoud.map(r => `<button type="button" data-inst="${r.soort === "map" ? "m:" : ""}${r.x.id}">${esc(r.x.icoon)} ${esc(r.x.naam)} ⚙️</button>`).join("") || `<span class="hint">Nog leeg</span>`}</div></div>` : ""}
      <div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">🎯 Koersafspraken (jaarplan · POP/PAP)</div>
        <div class="lijst">${[...koersHier, ...viaMap].map(a => `<div class="linkrij"><span>🎯</span><span>${esc(a.titel)}</span><span class="hint">${periodeTekst(a)}${viaMap.includes(a) ? " · via map " + esc(doelTekst(a)) : ""}</span>
          <button type="button" class="knop klein" data-afspraak="${a.id}">Open</button></div>`).join("") || `<div class="hint">Nog geen afspraken voor deze ${isMap ? "map" : "lijst"}.</div>`}</div>
        <div style="margin-top:6px"><button type="button" class="knop klein" data-koershier>＋ Koersafspraak voor deze ${isMap ? "map" : "lijst"}</button> <a href="#koers" class="hint" data-naarkoers>alles in 🎯 Koers</a></div></div>
    </div>`;
}
dlg3.addEventListener("click", (e) => {
  if (e.target.closest("[data-koershier]")) { const isMap = instOpen.startsWith("m:"); openAfspraak(null, { soort: isMap ? "map" : "lijst", id: isMap ? instOpen.slice(2) : instOpen }); return; }
  if (e.target.closest("[data-naarkoers]")) { dlg3.close(); return; }
  if (e.target.closest("[data-sluit]")) return;
  hoofdKlik(e);
});
dlg3.addEventListener("change", hoofdWijzig);
dlg3.addEventListener("close", () => { instOpen = null; });

// ===== Koers: afspraken voor een periode (POP/PAP) =====
const KSTATUS = { loopt: ["⏳", "Loopt"], gehaald: ["✅", "Gehaald"], deels: ["◐", "Deels"], niet: ["✕", "Niet gehaald"] };
const fmtDag = (iso) => { if (!iso) return ""; const x = new Date(iso.length === 10 ? iso + "T12:00" : iso); return x.getDate() + " " + MAAND[x.getMonth()] + " " + x.getFullYear(); };
const periodeTekst = (a) => a.van || a.tot ? `${fmtDag(a.van) || "…"} – ${fmtDag(a.tot) || "…"}` : "geen periode";
function doelTekst(a) {
  if (a.doel?.soort === "map" && map(a.doel.id)) { const m = map(a.doel.id); return `${m.icoon} ${m.naam}`; }
  if (a.doel?.soort === "lijst" && overzicht(a.doel.id)) { const o = overzicht(a.doel.id); return `${o.icoon} ${o.naam}`; }
  return "Algemeen";
}
const doelKleur = (a) => esc((a.doel?.soort === "map" ? map(a.doel.id)?.kleur : overzicht(a.doel?.id)?.kleur) || "var(--accent)");
const binnenPeriode = (a, dag) => (!a.van || a.van <= dag) && (!a.tot || a.tot >= dag);
function koersTip(c, item) {
  if (c.koersId) return "";
  const s = koersSuggesties({ ...c, id: item?.id || "_nieuw", type: "taak" })[0];
  return s ? `💡 Lijkt te horen bij koersafspraak <b>„${esc(s.titel)}”</b> <button type="button" class="knop klein" data-koerstip="${s.id}">Koppel</button>${item ? ` <button type="button" class="x" data-koersnee="${s.id}" title="Nee, hoort er niet bij">✕</button>` : ""}` : "";
}
function koersBlok(c, item) {
  if (!d().koers.length) return "";
  const vd = vandaagStr(), kies = d().koers.filter(a => (binnenPeriode(a, vd) && (!a.gedeeld || binnenDoel(a, c.overzicht))) || a.id === c.koersId);
  return `<div><label class="veld">🎯 Hoort bij koersafspraak<select name="koers"><option value="">— geen —</option>${kies.map(a => `<option value="${a.id}" ${a.id === c.koersId ? "selected" : ""}>${a.gedeeld ? "👥" : "🔒"} ${esc(a.titel)}</option>`).join("")}</select></label>
    <div class="hint" id="koersTip" style="margin-top:4px">${koersTip(c, item)}</div></div>`;
}
const koersTaken = (a) => a.taken.map(taak).filter(Boolean);
// Gedeelde koers: de lijst of map waar de afspraak bij hoort, wie erin zitten, en voor wie de afspraak is
const koersHouder = (a) => a?.doel?.soort === "map" ? map(a.doel.id) : a?.doel?.soort === "lijst" ? overzicht(a.doel.id) : null;
const kanDelen = (a) => { const h = koersHouder(a); return ingelogd() && !!h && !h.opslag && !h.slot; };
// Wie kan deze afspraak zien? Altijd zichtbaar, zodat je nooit per ongeluk iets persoonlijks deelt.
function koersZichtTekst(a) {
  if (!a.gedeeld) return { cls: "prive", kort: "🔒 Privé", lang: "🔒 Privé — alleen jij ziet deze afspraak" };
  const h = koersHouder(a), wie = (h?.leden || []).filter(u => !isIk(u)).map(u => h.ledenInfo?.[u]?.naam || h.ledenInfo?.[u]?.email || "lid");
  const waar = h ? `${h.icoon} ${h.naam}` : "de lijst";
  return { cls: "gedeeld", kort: "👥 Gedeeld", lang: `👥 Gedeeld — zichtbaar voor iedereen in ${waar}${wie.length ? `: jij, ${wie.join(", ")}` : " (nu alleen jij en je gelinkte accounts)"}` };
}
function koersVoorMij(a) { return !a.gedeeld || a.groep || !(a.wie || []).length || a.wie.some(isIk); }
function koersWieTekst(a) {
  if (!a.gedeeld) return "";
  const h = koersHouder(a), namen = (a.wie || []).map(x => naamVanPersoon(x, h));
  return [a.groep || !namen.length ? "hele groep" : "", ...namen].filter(Boolean).join(" + ");
}
function koersDeelBlok(c) {
  if (!kanDelen(c)) return `<div class="hint">🔒 Alleen voor jou.${ingelogd() ? " Kies bij „Hoort bij” een lijst of map in de Tijdkompas-cloud om de afspraak met iedereen daarin te delen." : ""}</div>`;
  const h = koersHouder(c), soort = c.doel.soort === "map" ? "map" : "lijst", pers = personen(h), w = c.wie || [];
  const aan = (p) => p.ik ? w.some(isIk) : w.includes(p.id);
  return `<div class="segment" role="group" aria-label="Voor wie zichtbaar">
      <button type="button" data-kdeel="0" aria-pressed="${!c.gedeeld}">🔒 Alleen voor mij</button>
      <button type="button" data-kdeel="1" aria-pressed="${!!c.gedeeld}">👥 Voor iedereen in deze ${soort}</button></div>
    ${c.gedeeld ? `<div><div class="veld" style="font-size:13px;color:var(--meta);margin:6px 0">Voor wie is deze afspraak?</div>
      <div class="chips kwie">
        <button type="button" data-kwie="*" aria-pressed="${!!c.groep || !w.length}" title="De hele groep (iedereen in deze ${soort})">👥 Hele groep</button>
        ${pers.map(p => `<button type="button" data-kwie="${esc(p.ik ? mijnId() : p.id)}" aria-pressed="${aan(p)}">${p.ik ? "🙋 Ik" : esc(p.naam)}</button>`).join("")}</div>
      <div class="hint" style="margin-top:4px">De hele groep, één of meer personen, of de groep mét een paar trekkers.</div>
      <div class="kzicht gedeeld" style="margin-top:6px">${esc(koersZichtTekst({ ...c, gedeeld: true }).lang)} — zij kunnen titel, toelichting en terugblik lezen en bijwerken.</div></div>`
    : `<div class="kzicht prive" style="margin-top:6px">🔒 Privé — alleen jij ziet deze afspraak, ook al hoort hij bij een gedeelde ${soort}.</div>`}`;
}
function koersVoorstellen(a) {
  return d().taken.filter(t => !koersVan(t) && !a.nee.includes(t.id) && (!a.gedeeld || binnenDoel(a, t.overzicht)) && binnenPeriode(a, (t.klaarOp || t.gemaakt || new Date().toISOString()).slice(0, 10)) && koersScore(t, a) >= 1.5)
    .sort((x, y) => koersScore(y, a) - koersScore(x, a));
}
function koersZichtbaar(a) {
  if (!a.doel?.id) return true;
  return (a.doel.soort === "map" ? lijstenOnder(a.doel.id) : [a.doel.id]).some(i => actieveOverzichten().includes(i));
}
function koersPerioden() { return [...new Set(d().koers.map(a => (a.van || "") + "|" + (a.tot || "")))].sort().reverse(); }
function koersSelectie() {
  const per = voorkeur.lees("koersPeriode", "nu"), vd = vandaagStr();
  const alleenMij = voorkeur.lees("koersWie", "alle") === "mij";
  return d().koers.filter(a => koersZichtbaar(a) && (!alleenMij || koersVoorMij(a)) && (per === "alle" || (per === "nu" ? binnenPeriode(a, vd) : (a.van || "") + "|" + (a.tot || "") === per)));
}
function koers() {
  const per = voorkeur.lees("koersPeriode", "nu"), lijst = koersSelectie();
  const kaart = (a) => {
    const tk = koersTaken(a), klaar = tk.filter(t => t.status === "klaar"), min = tk.reduce((s, t) => s + (t.werkelijk || 0), 0);
    const voorstel = koersVoorstellen(a).slice(0, 6), [ic, st] = KSTATUS[a.status] || KSTATUS.loopt;
    const zicht = koersZichtTekst(a);
    return `<article class="pkaart kkaart k${zicht.cls}" style="--ok:${doelKleur(a)}">
      <div class="kzicht ${zicht.cls}">${esc(zicht.lang)}</div>
      <div class="imeta"><span class="tag">${esc(doelTekst(a))}</span><span>${periodeTekst(a)}</span><span class="tag kstatus ${esc(a.status)}">${ic} ${st}</span>
        ${a.gedeeld ? `<span class="tag" title="Voor wie deze afspraak is">🎯 voor: ${esc(koersWieTekst(a))}</span>` : ""}</div>
      <h2>${esc(a.titel)}</h2>
      ${a.toelichting ? `<p class="hint" style="margin:0">${esc(a.toelichting)}</p>` : ""}
      <div class="balk"><i style="width:${tk.length ? Math.round(klaar.length / tk.length * 100) : 0}%"></i></div>
      <div class="cijfers"><span>${klaar.length}/${tk.length} taken klaar</span><span title="Opgegeven gewerkte tijd">${fmtDuur(min) || "0"} besteed</span></div>
      <div class="lijst subtaken">${tk.sort((x, y) => (x.status === "klaar") - (y.status === "klaar") || (y.klaarOp || "").localeCompare(x.klaarOp || "")).map(t => `<div class="item ${t.status === "klaar" ? "klaar" : ""}" data-id="${t.id}" data-type="taak" style="--ok:${ovKleur(t.overzicht)}">
        <span>${t.status === "klaar" ? "✓" : "○"}</span><div class="ibody"><div class="ititel">${esc(t.titel)}</div><div class="imeta">${t.status === "klaar" && t.klaarOp ? `<span>${fmtDag(t.klaarOp)}</span>` : datumTags(t)}${t.werkelijk ? `<span>${fmtDuur(t.werkelijk)}</span>` : ""}</div></div>
        <button type="button" class="x" data-ontkoppel="${a.id}|${t.id}" title="Loskoppelen van deze afspraak">✕</button></div>`).join("") || `<div class="hint">Nog geen taken gekoppeld.</div>`}</div>
      ${voorstel.length ? `<div class="voorstel"><div class="hint">💡 Lijkt erbij te horen</div>${voorstel.map(t => `<div class="linkrij"><span>${t.status === "klaar" ? "✓" : "○"}</span><span>${esc(t.titel)}</span>
          <button type="button" class="knop klein" data-koppel="${a.id}|${t.id}">Koppel</button><button type="button" class="x" data-nee="${a.id}|${t.id}" title="Hoort er niet bij">✕</button></div>`).join("")}</div>` : ""}
      ${a.evaluatie ? `<div class="vergelijk"><b>Terugblik:</b> ${esc(a.evaluatie)}</div>` : ""}
      <div><button type="button" class="knop klein" data-afspraak="${a.id}">Bewerken</button></div>
    </article>`;
  };
  return `<div class="titelbalk"><h1>🎯 Koers</h1><span class="sub">Jaarplan · POP/PAP: wat je deze periode wilt bereiken, en wat eraan bijdroeg — voor het beoordelingsgesprek</span>
    <div class="rechts">${d().koers.some(a => a.gedeeld) ? `<select name="koersWie" aria-label="Welke afspraken"><option value="alle">Alle afspraken</option><option value="mij" ${voorkeur.lees("koersWie", "alle") === "mij" ? "selected" : ""}>Voor mij</option></select>` : ""}
    <select name="koersPeriode" aria-label="Periode"><option value="nu" ${per === "nu" ? "selected" : ""}>Lopend</option><option value="alle" ${per === "alle" ? "selected" : ""}>Alle perioden</option>
      ${koersPerioden().map(p => { const [van, tot] = p.split("|"); return `<option value="${esc(p)}" ${per === p ? "selected" : ""}>${periodeTekst({ van, tot })}</option>`; }).join("")}</select>
    <button class="knop" data-actie="koersRapport" ${lijst.length ? "" : "disabled"}>📄 Overzicht voor gesprek</button>
    <button class="knop prim" data-actie="nieuweAfspraak">＋ Afspraak</button></div></div>
  <div class="kaarten">${lijst.map(kaart).join("") || `<div class="leeg">Nog geen koersafspraken${per === "nu" ? " voor nu" : ""}. Leg aan het begin van een periode (bv. een jaar) vast wat je wilt bereiken — per lijst, per map of algemeen. Taken die erop lijken stelt Tijdkompas daarna vanzelf voor.</div>`}</div>`;
}
function openAfspraak(a, voorDoel) {
  const nieuw = !a, jaar = new Date().getFullYear();
  const c = structuredClone(a || { titel: "", toelichting: "", trefwoorden: "", van: jaar + "-01-01", tot: jaar + "-12-31", status: "loopt", evaluatie: "", taken: [], nee: [],
    doel: voorDoel || (() => { const ids = actieveOverzichten(); return ids.length === 1 ? { soort: "lijst", id: ids[0] } : { soort: "", id: "" }; })() });
  const doelOpties = `<option value="">Algemeen (alle lijsten)</option>` + boom().map(r => {
    const v = (r.soort === "map" ? "map:" : "lijst:") + r.x.id;
    return `<option value="${v}" ${c.doel?.soort + ":" + c.doel?.id === v ? "selected" : ""}>${" ".repeat(r.diepte)}${esc(r.x.icoon)} ${esc(r.x.naam)}${r.soort === "map" ? " (hele map)" : ""}</option>`; }).join("");
  dlg.innerHTML = `<form method="dialog" id="afspraakForm"><div class="dkop"><span class="soort">🎯 Koersafspraak <span class="kzicht ${c.gedeeld ? "gedeeld" : "prive"}" id="kzichtKop">${c.gedeeld ? "👥 Gedeeld" : "🔒 Privé"}</span></span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <input class="grootTitel" type="text" name="titel" value="${esc(c.titel)}" placeholder="Wat wil je bereiken? bv. Zelfstandig klantdemo's geven" required autofocus>
      <label class="veld">Toelichting — waaraan merk je dat het gelukt is?<textarea name="toelichting" placeholder="Concreet en meetbaar, zoals afgesproken">${esc(c.toelichting)}</textarea></label>
      <label class="veld">Trefwoorden <small class="hint">(helpen bij het voorstellen van taken)</small><input type="text" name="trefwoorden" value="${esc(c.trefwoorden)}" placeholder="bv. presentatie demo klant"></label>
      <div class="rij"><label class="veld">Van<input type="date" name="van" value="${c.van || ""}"></label><label class="veld">Tot<input type="date" name="tot" value="${c.tot || ""}"></label>
        <label class="veld">Hoort bij<select name="doel">${doelOpties}</select></label></div>
      <div id="koersDeel">${koersDeelBlok(c)}</div>
      <div class="segment" role="group" aria-label="Status">${Object.entries(KSTATUS).map(([k, [i, n]]) => `<button type="button" data-status="${k}" aria-pressed="${c.status === k}">${i} ${n}</button>`).join("")}</div>
      <label class="veld">Terugblik <small class="hint">(voor het gesprek)</small><textarea name="evaluatie" placeholder="Wat ging goed, wat leerde je, wat neem je mee?">${esc(c.evaluatie)}</textarea></label>
    </div>
    <div class="dvoet">${nieuw ? "" : `<button type="button" class="knop gevaar" data-actie="afspraakWeg">Verwijderen</button>`}<div class="rechts"><button class="knop prim" value="ok">${nieuw ? "Toevoegen" : "Opslaan"}</button></div></div></form>`;
  const tekenDeel = () => {
    const el = $("#koersDeel", dlg); if (el) el.innerHTML = koersDeelBlok(c);
    const kop = $("#kzichtKop", dlg); if (kop) { kop.className = "kzicht " + (c.gedeeld ? "gedeeld" : "prive"); kop.textContent = c.gedeeld ? "👥 Gedeeld" : "🔒 Privé"; }
  };
  dlg.onchange = (e) => {
    if (e.target.name !== "doel") return;
    const [soort, id] = (e.target.value || ":").split(":");
    c.doel = { soort: id ? soort : "", id: id || "" };
    if (!kanDelen(c)) c.gedeeld = false;
    c.wie = (c.wie || []).filter(x => isIk(x) || personen(koersHouder(c)).some(p => p.id === x));
    tekenDeel();
  };
  dlg.onclick = (e) => {
    const kd = e.target.closest("[data-kdeel]");
    if (kd) { c.gedeeld = kd.dataset.kdeel === "1"; if (c.gedeeld && !c.wie?.length && c.groep == null) c.groep = true; tekenDeel(); return; }
    const kw = e.target.closest("[data-kwie]");
    if (kw) {
      const x = kw.dataset.kwie;
      if (x === "*") c.groep = !(c.groep || !(c.wie || []).length);
      else { const w = new Set(c.wie || []); const mij = isIk(x); if (mij ? [...w].some(isIk) : w.has(x)) { for (const y of [...w]) if (mij ? isIk(y) : y === x) w.delete(y); } else w.add(x); c.wie = [...w]; }
      if (!c.groep && !(c.wie || []).length) c.groep = true;   // niemand gekozen = de hele groep
      tekenDeel(); return;
    }
    const st = e.target.closest("[data-status]");
    if (st) { c.status = st.dataset.status; $$("[data-status]", dlg).forEach(b => b.setAttribute("aria-pressed", b === st)); }
    if (e.target.closest("[data-actie=afspraakWeg]") && confirm(`Koersafspraak „${a.titel}” verwijderen? De taken blijven bestaan.`)) { d().koers = d().koers.filter(x => x !== a); bewaar(); dlg.close(); }
  };
  dlg.oninput = dlg.onkeydown = null;
  dlg.onsubmit = (e) => { const t = $("#afspraakForm [name=titel]"); if (t && e.submitter?.value === "ok" && !t.value.trim()) e.preventDefault(); };
  dlg.onclose = () => {
    dlg.onclose = dlg.onclick = null;
    if (dlg.returnValue !== "ok") return;
    const v = (n) => $(`[name=${n}]`, dlg).value, [soort, id] = (v("doel") || ":").split(":");
    const velden = { titel: v("titel").trim(), toelichting: v("toelichting").trim(), trefwoorden: v("trefwoorden").trim(), van: v("van"), tot: v("tot"),
                     doel: { soort: id ? soort : "", id: id || "" }, status: c.status, evaluatie: v("evaluatie").trim() };
    if (!velden.titel) return;
    // Voor iedereen in de lijst/map (alleen in de cloud), of persoonlijk
    velden.gedeeld = !!c.gedeeld && kanDelen(velden);
    if (velden.gedeeld && (nieuw || !a.gedeeld) && !confirm(`${koersZichtTekst({ ...velden, gedeeld: true }).lang}.\n\nDeze afspraak (met toelichting en terugblik) delen?`)) velden.gedeeld = false;
    if (velden.gedeeld) { velden.wie = c.wie || []; velden.groep = !!c.groep || !velden.wie.length; if (nieuw || !a.door) velden.door = sessie.ik; }
    else { velden.wie = []; velden.groep = false; }
    if (nieuw) { d().koers.push({ id: uid(), taken: [], nee: [], gemaakt: new Date().toISOString(), ...velden }); toast("Afspraak toegevoegd — passende taken worden voorgesteld"); }
    else Object.assign(a, velden);
    bewaar();
  };
  dlg.returnValue = "";
  dlg.showModal();
}
// Overzicht om mee te nemen naar het gesprek: afdrukken (of als PDF bewaren) of kopiëren
function koersRapport() {
  const lijst = koersSelectie(), per = voorkeur.lees("koersPeriode", "nu");
  const perT = per === "nu" ? "lopende periode" : per === "alle" ? "alle perioden" : periodeTekst({ van: per.split("|")[0], tot: per.split("|")[1] });
  const wieT = cloud.gebruiker?.naam || "";
  const deel = (a) => {
    const tk = koersTaken(a), klaar = tk.filter(t => t.status === "klaar").sort((x, y) => (x.klaarOp || "").localeCompare(y.klaarOp || "")), open = tk.filter(t => t.status !== "klaar");
    const min = klaar.reduce((s, t) => s + (t.werkelijk || 0), 0), [ic, st] = KSTATUS[a.status] || KSTATUS.loopt;
    return { a, klaar, open, min, ic, st };
  };
  const delen = lijst.map(deel);
  const html = `<div class="rapport"><h1>Koers — ${esc(perT)}</h1><p class="hint">${esc(wieT)}${wieT ? " · " : ""}gemaakt op ${fmtDag(new Date().toISOString())}</p>
    ${delen.map(({ a, klaar, open, min, ic, st }) => `<section><h2>${esc(a.titel)} <small>${a.gedeeld ? `(gedeeld, voor: ${esc(koersWieTekst(a))})` : "(persoonlijk)"}</small></h2>
      <p><b>${ic} ${st}</b> · ${esc(doelTekst(a))} · ${periodeTekst(a)}</p>
      ${a.toelichting ? `<p>${esc(a.toelichting)}</p>` : ""}
      <h3>Bijgedragen (${klaar.length} ${klaar.length === 1 ? "taak" : "taken"}${min ? ", " + fmtDuur(min) : ""})</h3>
      ${klaar.length ? `<ul>${klaar.map(t => `<li>${fmtDag(t.klaarOp)} — ${esc(t.titel)}${t.werkelijk ? ` (${fmtDuur(t.werkelijk)})` : ""}</li>`).join("")}</ul>` : "<p>—</p>"}
      ${open.length ? `<h3>Nog open</h3><ul>${open.map(t => `<li>${esc(t.titel)}${doelDatum(t) ? ` (doel ${fmtDag(doelDatum(t))})` : ""}</li>`).join("")}</ul>` : ""}
      ${a.evaluatie ? `<h3>Terugblik</h3><p>${esc(a.evaluatie)}</p>` : ""}</section>`).join("")}</div>`;
  const tekst = [`Koers — ${perT}${wieT ? " — " + wieT : ""}`, ""].concat(...delen.map(({ a, klaar, open, min, st }) => [
    `■ ${a.titel}  [${st} · ${doelTekst(a)} · ${periodeTekst(a)} · ${a.gedeeld ? "gedeeld, voor: " + koersWieTekst(a) : "persoonlijk"}]`, ...(a.toelichting ? [a.toelichting] : []),
    `Bijgedragen (${klaar.length}${min ? ", " + fmtDuur(min) : ""}):`, ...klaar.map(t => `  • ${fmtDag(t.klaarOp)} — ${t.titel}${t.werkelijk ? " (" + fmtDuur(t.werkelijk) + ")" : ""}`),
    ...(open.length ? ["Nog open:", ...open.map(t => "  • " + t.titel)] : []), ...(a.evaluatie ? ["Terugblik: " + a.evaluatie] : []), ""])).join("\n");
  dlg.innerHTML = `<form method="dialog"><div class="dkop"><span class="soort">📄 Overzicht voor het gesprek</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">${html}</div>
    <div class="dvoet"><button type="button" class="knop" data-r="kopie">📋 Kopiëren als tekst</button><div class="rechts"><button type="button" class="knop prim" data-r="print">🖨 Afdrukken / PDF</button></div></div></form>`;
  dlg.onclick = async (e) => {
    const r = e.target.closest("[data-r]")?.dataset.r;
    if (r === "kopie") { try { await navigator.clipboard.writeText(tekst); toast("Gekopieerd — plak het in je mail of POP-formulier"); } catch { toast("Kopiëren lukte niet in deze browser"); } }
    if (r === "print") {
      const doel = $("#afdruk"); doel.innerHTML = html; dlg.close();
      document.body.classList.add("afdrukken"); setTimeout(() => { window.print(); document.body.classList.remove("afdrukken"); }, 50);
    }
  };
  dlg.onclose = dlg.onchange = dlg.oninput = null;
  dlg.showModal();
}

function inzicht() {
  const af = d().taken.filter(t => t.status === "klaar" && zichtbaar(t));
  const metBeide = af.filter(t => t.schatting && t.werkelijk);
  const perOv = d().overzichten.filter(o => actieveOverzichten().includes(o.id)).map(o => {
    const l = metBeide.filter(t => t.overzicht === o.id);
    return { o, s: l.reduce((a, t) => a + t.schatting, 0), w: l.reduce((a, t) => a + t.werkelijk, 0), n: l.length };
  });
  const max = Math.max(1, ...perOv.flatMap(x => [x.s, x.w]));
  const kal = kalibratie();
  const missers = [...metBeide].sort((a, b) => Math.abs(b.werkelijk - b.schatting) - Math.abs(a.werkelijk - a.schatting)).slice(0, 8);
  // Tijdsbesteding per kwadrant (afgerond + ingepland)
  const perQ = Object.keys(KWADRANTEN).map(q => ({ q, min: af.filter(t => kwadrant(t) === q).reduce((s, t) => s + (t.werkelijk || t.schatting || 0), 0) }));
  const totQ = Math.max(1, perQ.reduce((s, x) => s + x.min, 0));
  const plannenPct = Math.round(perQ.find(x => x.q === "plannen").min / totQ * 100);

  return `<div class="titelbalk"><h1>Inzicht</h1><span class="sub">Leer van je eigen schattingen</span></div>
  <div class="stats">
    <div class="stat"><b>${af.length}</b><span>taken afgerond</span></div>
    <div class="stat"><b>${kal.n >= 3 ? "×" + kal.factor.toFixed(2) : "–"}</b><span>schatfactor (werkelijk ÷ geschat)</span></div>
    <div class="stat"><b>${fmtDuur(metBeide.reduce((s, t) => s + t.werkelijk, 0)) || "0"}</b><span>gemeten tijd</span></div>
    <div class="stat"><b>${plannenPct}%</b><span>tijd in kwadrant „Plannen”</span></div>
  </div>
  <p class="hint">${kal.n < 3 ? "Rond minstens 3 taken af met een schatting én werkelijke tijd om je schatfactor te zien." :
    kal.factor > 1.1 ? `Je schat gemiddeld ${Math.round((kal.factor - 1) * 100)}% te laag. Tijdkompas rekent dat mee bij het inplannen.` :
    kal.factor < 0.9 ? `Je schat gemiddeld ${Math.round((1 - kal.factor) * 100)}% te ruim.` : "Je schattingen kloppen opvallend goed."}</p>
  <div class="raster2" style="margin-top:10px">
    <section class="paneel"><h3 style="margin-top:0">Geschat vs. werkelijk per overzicht</h3>
      ${perOv.map(x => `<div class="hbar" style="--ok:${esc(x.o.kleur)}"><span>${esc(x.o.icoon)} ${esc(x.o.naam)}</span>
        <span class="spoor"><i class="s" style="width:${x.s / max * 100}%"></i><i class="w" style="width:${x.w / max * 100}%"></i></span>
        <span class="duur">${x.n ? "×" + (x.w / x.s).toFixed(2) : "–"}</span></div>`).join("")}
      <div class="legenda"><span><i style="display:inline-block;width:12px;height:6px;background:var(--zacht);border-radius:3px"></i> geschat</span><span><i style="display:inline-block;width:12px;height:6px;background:var(--accent);border-radius:3px"></i> werkelijk (kleur overzicht)</span></div>
      <h3>Waar ging je tijd heen?</h3>
      ${perQ.map(x => `<div class="hbar" style="--ok:${qKleur(x.q)}"><span style="color:${qKleur(x.q)}">${KWADRANTEN[x.q].naam}</span>
        <span class="spoor"><i class="w" style="top:5px;width:${x.min / totQ * 100}%"></i></span><span class="duur">${Math.round(x.min / totQ * 100)}%</span></div>`).join("")}
    </section>
    <section class="paneel"><h3 style="margin-top:0">Grootste verschillen</h3>
      ${missers.length ? `<table class="tabel"><tr><th>Taak</th><th class="n">Geschat</th><th class="n">Werkelijk</th></tr>
        ${missers.map(t => `<tr data-id="${t.id}" data-type="taak" style="cursor:pointer"><td>${esc(t.titel)}</td><td class="n">${fmtDuur(t.schatting)}</td><td class="n" style="color:${t.werkelijk > t.schatting ? "var(--rood)" : "var(--groen)"}">${fmtDuur(t.werkelijk)}</td></tr>`).join("")}</table>`
        : `<div class="leeg">Nog geen afgeronde taken met tijden.</div>`}
    </section>
  </div>`;
}

// ===== Instellingen =====
const DAGVOLGORDE = [1, 2, 3, 4, 5, 6, 0];
const locOpties = (gekozen, leegTekst) => `<option value="">${esc(leegTekst)}</option>` +
  d().locaties.map(l => `<option value="${l.id}" ${l.id === gekozen ? "selected" : ""}>${esc(l.icoon)} ${esc(l.naam)}${l.reistijd ? ` (${l.reistijd} min reizen)` : ""}</option>`).join("");
// Keuze voor één blok: standaard (met wat dat nu is), een agenda, of geen
function blokAgendaOpties(gekozen, standaard, via = null) {
  const schrijfbaar = Object.entries(d().agendas).filter(([k, a]) => a.schrijf && verbindingVanBron(k));
  return `<option value="" ${!gekozen ? "selected" : ""}>Standaard${standaard ? " → " + esc(agendaNaam(standaard)) : via ? " → de agenda van " + esc(via.email || "je andere account") : " (nu: in geen agenda)"}</option>` +
    schrijfbaar.map(([k]) => `<option value="${esc(k)}" ${k === gekozen ? "selected" : ""}>${esc(agendaNaam(k))}</option>`).join("") +
    `<option value="geen" ${gekozen === "geen" ? "selected" : ""}>Niet in een agenda zetten</option>`;
}
function doelAgendaOpties(gekozen, { lijst = false } = {}) {
  const schrijfbaar = Object.entries(d().agendas).filter(([k, a]) => a.schrijf && verbindingVanBron(k));
  const eigen = eigenAgenda();
  return (lijst ? `<option value="" ${!gekozen ? "selected" : ""}>Standaard${eigen ? " (" + esc(agendaNaam(eigen)) + ")" : " (de agenda van het account waarmee je inlogt)"}</option>
    <option value="geen" ${gekozen === "geen" ? "selected" : ""}>Niet in een agenda zetten</option>` : `<option value="">Niet in een agenda zetten</option>`) + schrijfbaar.map(([k, a]) =>
    `<option value="${esc(k)}" ${k === gekozen ? "selected" : ""}>${a.accountSoort === "ms" ? "Outlook" : "Google"} · ${esc(a.account)} · ${esc(a.naam)}</option>`).join("") +
    (gekozen && gekozen !== "geen" && !schrijfbaar.some(([k]) => k === gekozen) ? `<option value="${esc(gekozen)}" selected>(account niet gekoppeld op dit apparaat)</option>` : "");
}

function instellingen() {
  const tab = voorkeur.lees("instTab", "lijsten");
  const tabs = [["lijsten", "📋 Mappen & lijsten"], ["locaties", "📍 Locaties & tijden"], ["koppelingen", "🔗 Agenda's & accounts"], ["overig", "⚙️ Overig"]];
  const inhoud = { lijsten: instLijsten, locaties: instLocaties, koppelingen: instKoppelingen, overig: instOverig }[tab] || instLijsten;
  return `<div class="titelbalk"><h1>Instellingen</h1></div>
  <div class="tabs" data-actie="instTab">${tabs.map(([k, n]) => `<button type="button" data-w="${k}" aria-pressed="${k === tab}">${n}</button>`).join("")}</div>
  ${inhoud()}`;
}

function mensenBlok(o) {
  return `<div class="leden"><span class="hint">Zonder Tijdkompas:</span>
    ${(o.mensen || []).map(n => `<span class="lid"><span class="avatar">${esc(n[0].toUpperCase())}</span>${esc(n)} <button type="button" class="x" data-actie="mensWeg" data-w="${esc(n)}" title="Weghalen">✕</button></span>`).join("")}
    <button type="button" class="knop klein" data-actie="mensBij" title="Collega die Tijdkompas niet gebruikt: je kunt taken aan hem/haar toewijzen en erop wachten">＋ persoon</button></div>`;
}
function ledenBlok(o, isMap = false) {
  if (o.opslag) return `<div class="hint">📁 Persoonlijke lijst in je ${esc(naamVan(o.opslag))}. Delen kan alleen met lijsten in de Tijdkompas-cloud.</div>` + mensenBlok(o);
  // jij (met al je inlogs) één keer, daarna de anderen
  const alle = Object.entries(o.ledenInfo || {}).filter(([u]) => (o.leden || []).includes(u));
  const zelf = alle.find(([u]) => u === sessie.ik) || alle.find(([u]) => isIk(u));
  const leden = [...(zelf ? [zelf] : []), ...alle.filter(([u]) => !isIk(u))];
  return `<div class="leden">
    ${andereLeden(o).length || (o.uitgenodigd || []).length ? leden.map(([u, l]) => `<span class="lid" title="${esc(l.email)}">${l.foto ? `<img class="avatar" src="${esc(veiligeFoto(l.foto))}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((l.naam || "?")[0].toUpperCase())}</span>`}${esc(isIk(u) ? "jij" : l.naam)}${u === o.eigenaar || (isIk(u) && isIk(o.eigenaar)) ? " <small class='hint'>eigenaar</small>" : ""}${!isIk(u) && u !== o.eigenaar && isIk(o.eigenaar) ? ` <button type="button" class="x" data-actie="lidWeg" data-w="${esc(u)}" title="Eruit halen">✕</button>` : ""}</span>`).join("") : ""}
    ${(o.uitgenodigd || []).map(m => `<span class="lid uitgenodigd" title="Uitgenodigd, nog niet geaccepteerd"><span class="avatar">✉</span>${esc(m)}${vanAnder(o) ? "" : ` <button type="button" class="x" data-actie="uitnodigingWeg" data-w="${esc(m)}" title="Uitnodiging intrekken">✕</button>`}</span>`).join("")}
    ${vanAnder(o) ? `<span class="hint">Alleen ${esc(eigenaarNaam(o))} kan anderen uitnodigen.</span>` : `<button type="button" class="knop klein" data-actie="ovDelen">👥 ${isMap ? "Map delen…" : "Delen…"}</button>`}</div>` + (isMap ? "" : mensenBlok(o));
}
// Waar hoort deze deel-knop bij: een lijst of een map (met mapId)
function deelDoel(el) {
  const mr = el.closest("[data-map]");
  if (mr && !el.closest("[data-ov]")) return { x: map(mr.dataset.map), isMap: true };
  return { x: overzicht(el.closest("[data-ov]").dataset.ov), isMap: false };
}
// Een map delen = de map, alle mappen eronder en alle lijsten erin
const deelBereik = ({ x, isMap }) => isMap ? [x, ...mappenOnder(x.id).map(map), ...lijstenOnder(x.id).map(overzicht)] : [x];
// Keuzelijst van mappen ("" = hoofdmap), met inspringing; 'zonder' = mappen die niet mogen (de map zelf en alles eronder)
function mapKeuze(gekozen, zonder = new Set(), attr = "") {
  return `<select ${attr}><option value="">🏠 Hoofdmap</option>${boom().filter(r => r.soort === "map" && !zonder.has(r.x.id))
    .map(r => `<option value="${r.x.id}" ${r.x.id === gekozen ? "selected" : ""}>${"\u2003".repeat(r.diepte + 1)}${esc(r.x.icoon)} ${esc(r.x.naam)}</option>`).join("")}</select>`;
}
// Dichtstbijzijnde gedeelde map (deze of erboven): wie zitten daarin?
function deelVan(mapId) {
  for (const m of [...mapPad(mapId)].reverse()) if (andereLeden(m).length || (m.uitgenodigd || []).length) return m;
  return null;
}
function erfDelen(x, m) {
  x.leden = [...new Set([...(x.leden?.length ? x.leden : [sessie.ik]), ...(m.leden || [])])];
  x.ledenInfo = { ...(m.ledenInfo || {}), ...(x.ledenInfo || {}) };
  x.uitgenodigd = [...new Set([...(x.uitgenodigd || []), ...(m.uitgenodigd || [])])];
}
const VERDELING = {
  samen: ["🙌 Samen", "Alles wordt bij iedereen ingepland, behalve wat uitdrukkelijk van een ander is. Handig voor privé of in het begin."],
  verdelen: ["🧩 Verdelen", "Een taak wordt pas ingepland bij wie hij is toegewezen; „hele groep” blijft liggen tot iemand hem oppakt. Voor een team dat werk verdeelt."],
};

// Waar staat deze lijst? Tijdkompas-cloud (of alleen deze browser) of je eigen Drive/OneDrive
function opslagKeuze(o) {
  if (!ids().google && !ids().microsoft) return "";
  const gedeeld = andereLeden(o).length || (o.uitgenodigd || []).length;
  const basis = ingelogd() ? "☁️ Tijdkompas-cloud (deelbaar)" : "💻 Alleen deze browser";
  return `<label class="veld">Opslag<select data-veld="opslag" ${gedeeld ? "disabled title='Gedeelde lijsten staan altijd in de Tijdkompas-cloud'" : ""}>
    <option value="">${basis}</option>
    ${schijfVerbindingen().map(v => `<option value="${esc(v.id)}" ${o.opslag === v.id ? "selected" : ""}>📁 ${v.soort === "ms" ? "OneDrive" : "Google Drive"} · ${esc(v.email)}</option>`).join("")}
    ${o.opslag && !schijfVerbindingen().some(v => v.id === o.opslag) ? `<option value="${esc(o.opslag)}" selected>📁 ${esc(naamVan(o.opslag))} (niet gekoppeld)</option>` : ""}
    ${ids().google ? `<option value="+google">＋ Google Drive koppelen…</option>` : ""}
    ${ids().microsoft ? `<option value="+ms">＋ OneDrive koppelen…</option>` : ""}
  </select></label>`;
}

// Lijst of map van iemand anders (niet van jou of je gelinkte accounts): naam, kleur, icoon, verdeling en delen
// zijn van de eigenaar; jij kiest alleen je eigen manier van inplannen en waar hij bij jou staat.
const vanAnder = (x) => ingelogd() && !!x?.eigenaar && !isIk(x.eigenaar);
const eigenaarNaam = (x) => x?.ledenInfo?.[x.eigenaar]?.naam || x?.ledenInfo?.[x.eigenaar]?.email || "de eigenaar";
function koptekstAnder(x, kleurAttr = "") {
  return `<span style="text-align:center;font-size:20px">${esc(x.icoon)}</span><span class="kleurstip" style="background:${esc(x.kleur)}" ${kleurAttr}></span>
    <b>${esc(x.naam)}</b><span class="tag" title="Naam, kleur en delen regelt de eigenaar">👤 van ${esc(eigenaarNaam(x))}</span>`;
}
// Instellingen van één lijst of map (in Instellingen én in het ⚙️-venster)
function instRij(r) {
  const ik = sessie.ik;
    const inspring = `style="margin-left:${Math.min(r.diepte, 6) * 22}px"`;
    if (r.soort === "map") {
      const m = r.x, n = lijstenOnder(m.id).length, glm = ingelogd() ? gelinkteInfo(m) : null;
      if (glm) return `<div class="ovrij maprij gelinkt" data-map="${m.id}" ${inspring}>
    <span style="text-align:center;font-size:20px">${esc(m.icoon)}</span><span class="kleurstip" style="background:${esc(m.kleur)}"></span>
    <b>${esc(m.naam)}</b><span class="tag" title="Deze map hoort bij je gelinkte account">🔗 ${esc(glm.email)}</span>
    <div class="lijstopties">
      <span class="hint" style="align-self:center">📁 Map · ${n} ${n === 1 ? "lijst" : "lijsten"}</span>
      <label class="veld">In map (jouw eigen indeling)${mapKeuze(m.ouder, new Set([m.id, ...mappenOnder(m.id)]), `data-mveld="ouder"`)}</label>
    </div>
    <div class="tijden"><div class="hint">🔒 Deze map hoort bij <b>${esc(glm.email)}</b>. Naam, kleur en delen pas je aan als je met dat account inlogt.</div></div></div>`;
      return `<div class="ovrij maprij" data-map="${m.id}" ${inspring}>
    ${vanAnder(m) ? koptekstAnder(m) : `<button type="button" class="emojiknop" data-emoji="map" aria-label="Icoon kiezen" title="Icoon kiezen">${esc(m.icoon)}</button>
    <input type="color" value="${esc(m.kleur)}" data-mveld="kleur" aria-label="Kleur">
    <input type="text" value="${esc(m.naam)}" data-mveld="naam" aria-label="Naam van de map" style="font-weight:600">`}
    <button class="knop klein gevaar" data-actie="mapWeg">${m.eigenaar && ik && !isIk(m.eigenaar) ? "Verlaten" : "Verwijderen"}</button>
    <div class="lijstopties">
      <span class="hint" style="align-self:center">📁 Map · ${n} ${n === 1 ? "lijst" : "lijsten"}</span>
      <label class="veld">In map${mapKeuze(m.ouder, new Set([m.id, ...mappenOnder(m.id)]), `data-mveld="ouder"`)}</label>
      <div style="align-self:end"><button type="button" class="knop klein" data-actie="nieuwIn">＋ Lijst of map hierin</button></div>
    </div>
    <div class="tijden">${ledenBlok(m, true)}</div></div>`;
    }
    const o = r.x, l = locatie(o.locatie), gl = ingelogd() ? gelinkteInfo(o) : null;
    if (gl) return alleenLezenRij(o, gl, inspring);
    if (o.slot) return `<div class="ovrij" data-ov="${o.id}" ${inspring}>
    <span style="text-align:center;font-size:20px">${esc(o.icoon)}</span><span></span>
    <b>${esc(o.naam)}</b>
    <span></span>
    <div class="hint" style="grid-column:1/-1">🔒 Deze lijst staat in je ${esc(naamVan(o.opslag))}, en die is op dit apparaat (nog) niet gekoppeld.
      ${o.opslag.startsWith("ms:") ? `<button type="button" class="knop klein" data-actie="koppelMs" data-w="schijf">${msLogo} OneDrive koppelen</button>`
        : `<button type="button" class="knop klein" data-actie="koppelGoogle" data-w="schijf">${googleLogo} Google Drive koppelen</button>`}</div>
  </div>`;
    const ander = vanAnder(o);
    return `<div class="ovrij" data-ov="${o.id}" ${inspring}>
    ${ander ? koptekstAnder(o) : `<button type="button" class="emojiknop" data-emoji="lijst" aria-label="Icoon kiezen" title="Icoon kiezen">${esc(o.icoon)}</button>
    <input type="color" value="${esc(o.kleur)}" data-veld="kleur" aria-label="Kleur">
    <input type="text" value="${esc(o.naam)}" data-veld="naam" aria-label="Naam" style="font-weight:600">`}
    <button class="knop klein gevaar" data-actie="ovWeg">${o.eigenaar && ik && !isIk(o.eigenaar) ? "Verlaten" : "Verwijderen"}</button>
    <div class="lijstopties">
      <div class="segment" role="group" aria-label="Soort lijst">
        <button type="button" data-actie="modus" data-w="vast" aria-pressed="${o.modus === "vast"}">🕘 Vaste tijden</button>
        <button type="button" data-actie="modus" data-w="vrij" aria-pressed="${o.modus === "vrij"}">🌿 Vrije tijd</button>
      </div>
      <label class="veld">In map${mapKeuze(o.map, new Set(), `data-veld="map"`)}</label>
      <label class="veld">Standaardlocatie<select data-veld="locatie">${locOpties(o.locatie, "Geen vaste plek")}</select></label>
      <label class="veld" title="${esc(d().instellingen.agendaDoel === "vast" ? "Staat nu niet aan: alles gaat naar één vaste agenda (Instellingen → Agenda's & accounts)" : d().instellingen.agendaDoel === "taak" ? "Voor taken die niet in een gekoppelde takenlijst staan; taken uit Google Taken of To Do gaan naar de agenda van dat account" : "Hier komen de ingeplande blokken van deze lijst")}">Agenda van deze lijst<select data-veld="doelAgenda">${doelAgendaOpties(o.doelAgenda, { lijst: true })}</select></label>
      ${takenVerbindingen().length ? `<label class="veld">Taken synchroniseren met<select data-tlijstvan="${o.id}">${takenlijstOpties(takenlijstVan(o.id))}</select></label>` : ""}
      ${opslagKeuze(o)}
      ${ander ? `<span class="hint" style="align-self:center">Verdeling: ${VERDELING[o.verdeling || "samen"][0]} (ingesteld door ${esc(eigenaarNaam(o))})</span>`
        : `<div class="segment" role="group" aria-label="Verdeling">${Object.entries(VERDELING).map(([k, [n, uitleg]]) =>
        `<button type="button" data-actie="verdeling" data-w="${k}" aria-pressed="${(o.verdeling || "samen") === k}" title="${esc(uitleg)}">${n}</button>`).join("")}</div>`}
    </div>
    <div class="tijden">
      <div class="hint">${esc(VERDELING[o.verdeling || "samen"][1])}</div>
      ${o.modus === "vast" ? `<div class="hint"><b>Weekrooster</b> — per dag hoe lang en waar (bijv. ma/di/do op kantoor, wo thuis, vr vrij). Reistijd naar de plek gaat automatisch af van je vrije tijd.</div>
        ${weekRooster(o.tijden || [], "ov:" + o.id, { metLocatie: true, leeg: "vrij" })}
        <div class="rij" style="align-items:center"><button type="button" class="knop klein" data-actie="werkweek">🗓️ Afwijkende week (vakantie, cursus, ruildag, dagdeel vrij)</button>
        ${(() => { const n = Object.keys(o.afwijkingen || {}).filter(k => k >= vandaagStr()).length; return n ? `<span class="hint">${n} ${n === 1 ? "dag" : "dagen"} met een afwijking gepland</span>` : ""; })()}</div>`
      : `<div class="hint">Wordt ingepland in je vrije tijd (zie <a href="#" data-actie="instTab" data-w="locaties">beschikbaarheid</a>), na aftrek van vaste tijden, reistijd en afspraken.
         ${l?.reistijd ? `Elke sessie op ${esc(l.naam)} krijgt ${l.reistijd} min reistijd heen en terug; taken op dezelfde plek worden achter elkaar gezet.` : ""}</div>`}
      ${ledenBlok(o)}
    </div>
  </div>`;
  }

// Lijst van een gelinkt account: alles zien, alleen je eigen indeling (map) kiezen. Taken kun je gewoon bewerken.
const KORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];
function alleenLezenRij(o, gl, inspring) {
  const i = gl.inst, modus = i.modus || "vrij", tl = gl.takenlijst;
  const tijden = (i.tijden || []).map(t => `${[...(t.dagen || [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(x => KORT[x]).join(" ")} ${t.van}–${t.tot}${t.locatie && gl.locNaam(t.locatie) ? " · " + esc(gl.locNaam(t.locatie)) : ""}`);
  const anderen = Object.entries(o.ledenInfo || {}).filter(([u]) => (o.leden || []).includes(u) && !isIk(u)).map(([, x]) => x.naam || x.email);
  const rij = (k, v) => `<div class="ar"><span class="hint">${k}</span><span>${v}</span></div>`;
  return `<div class="ovrij gelinkt" data-ov="${o.id}" ${inspring}>
    <span style="text-align:center;font-size:20px">${esc(o.icoon)}</span><span class="kleurstip" style="background:${esc(o.kleur)}"></span>
    <b>${esc(o.naam)}</b><span class="tag" title="Deze lijst hoort bij je gelinkte account">🔗 ${esc(gl.email)}</span>
    <div class="lijstopties"><label class="veld">In map (jouw eigen indeling)${mapKeuze(o.map, new Set(), `data-veld="map"`)}</label></div>
    <div class="tijden">
      <div class="hint">🔒 Deze lijst hoort bij <b>${esc(gl.email)}</b>. Taken toevoegen, wijzigen en afvinken kan gewoon; de instellingen pas je aan als je met dat account inlogt.</div>
      <div class="alleenlezen">
        ${rij("Soort", modus === "vast" ? "🕘 Vaste tijden" : "🌿 Vrije tijd")}
        ${modus === "vast" ? rij("Tijden", tijden.join("<br>") || "nog geen") : ""}
        ${rij("Verdeling", VERDELING[o.verdeling || "samen"][0])}
        ${rij("Standaardlocatie", esc(gl.locatie) || "geen vaste plek")}
        ${rij("Blokken naar agenda", esc(gl.agenda) || "niet")}
        ${rij("Takenlijst", tl ? `${tl.accountSoort === "ms" ? "Microsoft To Do" : "Google Taken"} · „${esc(tl.naam)}”${tl.account ? ` (${esc(tl.account)})` : ""}` : "niet gekoppeld")}
        ${rij("Opslag", o.opslag ? "eigen schijf" : "☁️ Tijdkompas-cloud")}
        ${anderen.length ? rij("Gedeeld met", esc(anderen.join(", "))) : ""}
        ${(o.mensen || []).length ? rij("Zonder Tijdkompas", esc(o.mensen.join(", "))) : ""}
      </div>
    </div>
  </div>`;
}

function instLijsten() {
  const rij = instRij;
  return `<p class="hint">Zet je lijsten in <b>mappen</b>, zo diep als je wilt (bv. 📁 Werk → 💼 Team en 🌱 Werkgroep). Een lijst verplaats je met „In map”; hernoemen doe je gewoon in het naamveld.
    Je kunt een hele map delen (alles erin gaat mee, ook lijsten die je er later in zet) of één lijst.
    Bovenin: klik = alleen die lijst of map, <b>Ctrl+klik</b> (telefoon: lang indrukken) = erbij of eraf, <b>▾</b> naast een map = de lijsten erin los kiezen.</p>
  ${boom().map(rij).join("")}
  <div class="rij"><button class="knop" data-actie="ovBij">＋ Lijst of map</button></div>`;
}

function routeInstellingen() {
  const inst = d().instellingen, br = routeBron(), thuisAdres = locatie("thuis")?.adres;
  return `<h3>Reistijd naar afspraken</h3>
  <p class="hint">Heeft een afspraak in je agenda een locatie, dan rekent Tijdkompas de reistijd erheen uit, en zet die met marge (10%, minstens 15 minuten) in je agenda.
    Twee afspraken (of je werk en een afspraak) vlak na elkaar: dan de reis van de een naar de ander — <b style="color:var(--rood,#d9534f)">rood</b> = past niet, <b style="color:#d9a400">geel</b> = past alleen zonder marge.
    Na je laatste afspraak reken je naar huis.</p>
  ${thuisAdres ? "" : `<div class="hint" style="color:var(--q-doen,#d9534f)">📍 Vul hierboven bij <b>Thuis</b> je adres in: zonder startpunt kan alleen de reis tússen afspraken berekend worden. Doe dat ook bij Kantoor.</div>`}
  <div class="paneel"><div class="rij">
    <label class="schakel"><input type="checkbox" data-route="routes" ${inst.routes !== false ? "checked" : ""}> Reistijd berekenen</label>
    <label class="veld">Hoe reis je?<select data-route="vervoer">${Object.entries(VERVOER).map(([k, v]) => `<option value="${k}" ${vervoer() === k ? "selected" : ""}>${v.icoon} ${v.naam}</option>`).join("")}</select></label>
    <label class="veld" style="flex:2;min-width:240px">Google Maps-sleutel (Routes API)<input type="text" data-route="mapsSleutel" value="${esc(inst.mapsSleutel || "")}" placeholder="${mapsSleutel() ? "ingebouwde sleutel" : "AIza… (optioneel)"}" autocomplete="off" spellcheck="false"></label>
  </div>
  <div class="hint" style="margin-top:6px">${!routesAan() ? "Staat uit." : br === "google" ? "✓ Rekent met Google Maps, met verkeer in de spits." : br === "osm" ? "Rekent nu met OpenStreetMap (gratis, zonder file-informatie). Met een Google Maps-sleutel rekent hij met het echte verkeer." : "Openbaar vervoer kan alleen met een Google Maps-sleutel."}
    ${routeStand.bezig ? ` · ⏳ nog ${routeStand.bezig} route${routeStand.bezig === 1 ? "" : "s"} berekenen…` : ""}${routeStand.fout ? ` · ⚠️ ${esc(routeStand.fout)}` : ""}
    · Adressen gaan naar ${br === "google" ? "Google" : "OpenStreetMap"}; de uitkomsten blijven op dit apparaat. <button type="button" class="knop klein" data-actie="routesWis">Opnieuw berekenen</button></div></div>`;
}
function instLocaties() {
  const inst = d().instellingen;
  return `<h3 style="margin-top:0">Locaties</h3>
  <p class="hint">Reistijd = enkele reis vanaf huis, in minuten. Het adres (optioneel) gebruikt Tijdkompas om afspraken met die plaats te herkennen en er reistijd omheen te plannen.
    Een winkel of winkelcentrum (om even langs te gaan, of op je terugweg van je werk) gebruikt de boodschappenlijst voor advies: waar en wanneer je het beste kunt gaan.</p>
  <div class="lijst">${d().locaties.map(l => `<div class="locrij" data-loc="${l.id}">
    <button type="button" class="emojiknop" data-emoji="locatie" aria-label="Icoon kiezen" title="Icoon kiezen">${esc(l.icoon)}</button>
    <input type="text" value="${esc(l.naam)}" data-locveld="naam" aria-label="Naam">
    <label class="veld klein">${l.id === "thuis" ? "Startpunt" : "Reistijd (min)"}${l.id === "thuis" ? `<input type="text" value="—" disabled>` : `<input type="number" min="0" step="5" value="${l.reistijd || 0}" data-locveld="reistijd">`}</label>
    <input type="text" value="${esc(l.adres || "")}" data-locveld="adres" placeholder="adres of plaatsnaam (optioneel)" aria-label="Adres">
    ${l.id === "thuis" ? "<span></span>" : `<button type="button" class="x" data-actie="locWeg" title="Verwijderen">✕</button>`}
    ${l.id === "thuis" ? "" : winkelVelden(l)}
  </div>`).join("")}</div>
  <button class="knop" data-actie="locBij" style="margin-top:8px">＋ Locatie</button>
  ${routeInstellingen()}

  <h3>Beschikbaarheid</h3>
  <p class="hint">Wanneer ben je op z'n vroegst en laatst beschikbaar? Lijsten in de vrije tijd worden alleen hierbinnen ingepland — na aftrek van werk, reistijd en afspraken.</p>
  <div class="paneel">${weekRooster(d().beschikbaar, "besch", { leeg: "niet beschikbaar" })}
    <div style="margin-top:8px"><button type="button" class="knop klein" data-actie="werkweek">🗓️ Dagen weg (vakantie)</button></div></div>

  <h3>Inplannen</h3>
  <div class="paneel"><div class="rij" data-actie="inst">
    <label class="veld">Langste blok (min)<input type="number" min="15" step="15" name="blokMax" value="${inst.blokMax}"></label>
    <label class="veld">Kortste blok (min)<input type="number" min="5" step="5" name="blokMin" value="${inst.blokMin}"></label>
    <label class="veld" title="Blokken beginnen op het volgende hele/halve uur na een afspraak; wat er tot dan overblijft is je pauze">Plannen per<select name="raster">${[[15, "kwartier"], [30, "half uur"], [60, "heel uur"]].map(([v, n]) => `<option value="${v}" ${+(inst.raster || 30) === v ? "selected" : ""}>${n}</option>`).join("")}</select></label>
    <label class="veld" title="Bovenop het afronden naar het hele/halve uur. Meestal 0.">Extra pauze na een afspraak (min)<input type="number" min="0" step="5" name="buffer" value="${inst.buffer || 0}"></label>
    <label class="veld">Dagen vooruit<input type="number" min="1" max="60" name="horizon" value="${inst.horizon}"></label>
    <label class="veld">Max. dagvulling (%)<input type="number" min="10" max="100" step="5" name="vulgraad" value="${inst.vulgraad}"></label>
  </div>
  <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px" data-actie="inst">
    <label class="schakel"><input type="checkbox" name="kalibratie" ${inst.kalibratie ? "checked" : ""}> Schattingen corrigeren met mijn schatfactor</label>
    <label class="schakel"><input type="checkbox" name="schrappenInplannen" ${inst.schrappenInplannen ? "checked" : ""}> Ook kwadrant „Schrappen” inplannen</label>
  </div>
  <div style="margin-top:12px">
    <label class="veld">Eerder klaar dan gepland?<select name="klaarModus">
      <option value="vragen" ${!["voren", "vorenUitloop"].includes(inst.klaarModus) ? "selected" : ""}>Vragen wat ik met de tijd wil</option>
      <option value="voren" ${inst.klaarModus === "voren" ? "selected" : ""}>Meteen alles naar voren halen</option>
      <option value="vorenUitloop" ${inst.klaarModus === "vorenUitloop" ? "selected" : ""}>Meteen alles naar voren halen, met de vrijgekomen tijd als uitloop</option></select></label>
    <label class="veld">Komt er iets in <b>Doen</b>?<select name="doenModus">
      <option value="vragen" ${inst.doenModus === "vragen" || !inst.doenModus ? "selected" : ""}>Vragen wat ik wil (met voorstel)</option>
      <option value="weg" ${inst.doenModus === "weg" ? "selected" : ""}>Meteen vooraan inplannen; wat in de weg zit gaat eruit (en komt op de lijst om opnieuw in te plannen)</option>
      <option value="schuif" ${inst.doenModus === "schuif" ? "selected" : ""}>Meteen vooraan inplannen tot hij genoeg tijd heeft; de rest schuift door</option>
    </select></label>
  </div></div>`;
}

function instKoppelingen() {
  const id = ids(), lijst = verbindingen();
  const agendasVan = (prefix) => Object.entries(d().agendas).filter(([k]) => k.startsWith(prefix));
  const vasteLijsten = d().overzichten.filter(o => o.modus === "vast");
  const agendaRij = ([k, a]) => `<div class="agendarij" data-agenda="${esc(k)}">
    <span class="stip" style="background:${esc(a.kleur || "#888")}"></span>
    <span class="anaam">${esc(a.naam)}${a.primair ? ` <small class="hint">hoofdagenda</small>` : ""}</span>
    <select data-aveld="soort" aria-label="Wat staat erin">${Object.entries(SOORTEN).map(([s, x]) => `<option value="${s}" ${a.soort === s ? "selected" : ""} title="${esc(x.uitleg)}">${x.naam}</option>`).join("")}</select>
    ${a.soort === "negeer" ? "<span></span>" : `<select data-aveld="lijst" aria-label="Lijst">${a.soort === "rooster"
      ? `<option value="">— kies lijst —</option>` + vasteLijsten.map(o => `<option value="${o.id}" ${a.lijst === o.id ? "selected" : ""}>${esc(o.icoon)} ${esc(o.naam)}</option>`).join("")
      : `<option value="">hoort bij: —</option>` + d().overzichten.map(o => `<option value="${o.id}" ${a.lijst === o.id ? "selected" : ""}>hoort bij: ${esc(o.icoon)} ${esc(o.naam)}</option>`).join("")}</select>`}
    <span class="hint">${d().bezet.filter(e => e.bron === k).length || ""}</span>
  </div>`;
  const schijven = schijfVerbindingen();
  const schijfRij = (v) => { const n = d().overzichten.filter(o => o.opslag === v.id).length, f = schijf.fouten[v.id], verl = schijf.verlopen.has(v.id) || isVerlopen(v);
    return `<div class="accrij" data-verb="${esc(v.id)}">
    ${v.foto ? `<img class="avatar" src="${esc(v.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((v.naam || v.email)[0].toUpperCase())}</span>`}
    <div class="ibody"><div class="ititel">${esc(v.email)} <span class="tag">${v.soort === "ms" ? "OneDrive" : "Google Drive"}</span></div>
      <div class="imeta">${n} ${n === 1 ? "lijst" : "lijsten"} · ${verl ? `<span style="color:var(--oranje)">verbinding verlopen</span>` : f ? `<span style="color:var(--rood)">${esc(f)}</span>`
        : schijf.laatst[v.id] ? "bijgewerkt " + new Date(schijf.laatst[v.id]).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }) : schijf.bezig ? "bezig…" : "nog niet gesynchroniseerd"}</div></div>
    ${verl ? `<button class="knop klein" data-actie="vernieuw">Opnieuw verbinden</button>` : ""}
    <button class="knop klein gevaar" data-actie="schijfWeg">Ontkoppelen</button>
  </div>`; };
  const icsBronnen = [...new Set(d().bezet.filter(e => !verbindingVanBron(e.bron)).map(e => e.bron))];
  icsBronnen.forEach(b => { d().agendas[b] ||= { naam: b, kleur: "#8a978e", soort: "bezet", lijst: "", ics: true }; });
  const kanAgenda = id.google || id.microsoft;

  return `<h3 style="margin-top:0">Je account</h3>
  ${accountBlok()}

  <h3>Agenda's en takenlijsten koppelen</h3>
  <p class="hint">Koppel je Google- en Microsoft-accounts: Tijdkompas plant om je afspraken heen, zet ingeplande blokken in je agenda en werkt met je takenlijsten. Je kunt meerdere accounts koppelen (bijv. zakelijk Outlook én privé Google).
    ${ingelogd() ? "Wat je koppelt geldt voor je hele Tijdkompas: met elk van je accounts en op elk apparaat zie je dezelfde agenda's. Bijwerken kan op een apparaat waar de koppeling verbonden is; elders vraagt de app één keer om te verbinden." : ""}</p>
  ${kanAgenda ? `<div class="lijst">${alleVerbindingen().filter(v => heeft(v, "agenda") || heeft(v, "taken")).map(v => {
    const ms = v.soort === "ms", act = ms ? "koppelMs" : "koppelGoogle";
    const doel = (x, naam) => heeft(v, x) ? `<span class="tag">✓ ${naam}</span>`
      : `<button type="button" class="knop klein" data-actie="${act}" data-w="${x}" data-email="${esc(v.email)}" title="Ook ${naam.toLowerCase()} van dit account koppelen">＋ ${naam}</button>`;
    return `<div class="accrij" data-verb="${esc(v.id)}">
    ${v.foto ? `<img class="avatar" src="${esc(v.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((v.naam || v.email)[0].toUpperCase())}</span>`}
    <div class="ibody"><div class="ititel">${esc(v.email)} <span class="hint">${ms ? "Microsoft" : "Google"}</span></div>
      <div class="imeta" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${doel("agenda", "Agenda")}${doel("taken", "Taken")}${isVerlopen(v) ? `<span style="color:var(--oranje)">${v.token ? "sessie verlopen" : "op dit apparaat nog niet verbonden"}</span>` : ""}</div></div>
    ${isVerlopen(v) ? `<button class="knop klein" data-actie="vernieuw">${v.token ? "Opnieuw verbinden" : "Verbinden"}</button>` : ""}
    <button class="knop klein gevaar" data-actie="ontkoppel">Ontkoppelen</button>
  </div>`; }).join("")}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
    ${id.google ? `<button class="knop" data-actie="koppelGoogle" data-w="agenda+taken">${googleLogo} Google-account koppelen</button>` : ""}
    ${id.microsoft ? `<button class="knop" data-actie="koppelMs" data-w="agenda+taken">${msLogo} Microsoft-account koppelen</button>` : ""}
  </div>
  <p class="hint">Koppelen vraagt toegang tot agenda én takenlijsten. Wil je er maar één, vink de andere dan uit in het venster van Google of Microsoft.</p>` : `<div class="leeg">Rechtstreeks koppelen met Google Agenda en Outlook komt eraan. Tot die tijd: importeer je agenda als .ics-bestand via Agenda → ⋯.</div>`}

  ${kanAgenda && Object.values(d().agendas).some(a => a.schrijf) ? agendaDoelBlok() : ""}

  ${kanAgenda ? takenBlok(id) : ""}

  ${linkBlok()}

  ${feedBlok()}

  ${kanAgenda ? `<h3>Opslag in je eigen Drive of OneDrive</h3>
  <p class="hint">Je kunt per lijst kiezen om hem in je eigen Google Drive of OneDrive te bewaren (Instellingen → Lijsten → Opslag), bijvoorbeeld je werklijst in je zakelijke OneDrive.
    Tijdkompas krijgt dan alleen toegang tot een eigen verborgen map, niet tot je andere bestanden. Zulke lijsten zijn persoonlijk: delen kan alleen vanuit de Tijdkompas-cloud.
    ${ingelogd() ? "De cloud weet dan alleen dát de lijst bestaat; de taken zelf staan er niet in." : ""}</p>
  ${schijven.length ? `<div class="lijst">${schijven.map(schijfRij).join("")}</div>` : ""}
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
    ${id.google ? `<button class="knop" data-actie="koppelGoogle" data-w="schijf">${googleLogo} Google Drive koppelen</button>` : ""}
    ${id.microsoft ? `<button class="knop" data-actie="koppelMs" data-w="schijf">${msLogo} OneDrive koppelen</button>` : ""}
  </div>` : ""}

  ${regelsBlok()}
  ${Object.keys(d().agendas).length ? `<h3>Agenda's — wat staat erin?</h3>
  <p class="hint"><b>Bezet</b>: Tijdkompas plant eromheen (kies optioneel bij welke lijst ze horen, voor de kleur). <b>Rooster van lijst</b>: de afspraken zíjn de vaste tijden van die lijst (handig bij wisselende diensten). <b>Niet meetellen</b>: alleen ter info.
  Afspraken met een plaats die overeenkomt met een van je locaties krijgen automatisch reistijd.</p>
  ${lijst.map(v => { const r = agendasVan(v.id + "|"); return r.length ? `<div class="paneel agendagroep"><div class="hint" style="margin-bottom:6px">${v.soort === "ms" ? "Outlook" : "Google"} · ${esc(v.email)}</div>${r.map(agendaRij).join("")}</div>` : ""; }).join("")}
  ${icsBronnen.length ? `<div class="paneel agendagroep"><div class="hint" style="margin-bottom:6px">Agenda's via link en .ics-bestanden</div>${icsBronnen.map(b => agendaRij([b, d().agendas[b]])).join("")}</div>` : ""}
  ${lijst.length ? `<div style="margin-top:8px"><button class="knop" data-actie="ophalen">🔄 Agenda's ophalen</button>
    <span class="hint">${d().agendaSync ? "Laatst: " + new Date(d().agendaSync).toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span></div>` : ""}` : ""}`;
}

// ---------- waar ingeplande blokken standaard komen ----------
function agendaDoelBlok() {
  const inst = d().instellingen, w = inst.agendaDoel || "taak";
  return `<h3>Ingeplande blokken in je agenda</h3>
  <div class="paneel" style="display:flex;flex-direction:column;gap:8px">
    ${Object.entries(AGENDA_STANDAARD).map(([k, n]) => `<label class="schakel"><input type="radio" name="agendaDoel" value="${k}" ${w === k ? "checked" : ""}> ${n}</label>
      ${k === "taak" ? `<span class="hint" style="margin:-4px 0 0 26px">Een taak uit Google Taken komt in de Google Agenda van dat account, een taak uit Microsoft To Do in de Outlook-agenda van dat account. Andere taken: de agenda die bij de lijst staat.</span>` : ""}
      ${k === "vast" ? `<select name="vasteAgenda" style="margin-left:26px;max-width:calc(100% - 26px)" ${w === "vast" ? "" : "disabled"}>${doelAgendaOpties(inst.vasteAgenda || "")}</select>` : ""}`).join("")}
    <span class="hint">Bij het zelf inplannen van een taak (📅) en bij een blok in de agenda kun je per keer een andere agenda kiezen.</span>
  </div>`;
}

// ---------- abonneer-link (.ics) voor je werkagenda ----------
function feedBlok() {
  const feeds = d().feeds || [];
  const keuze = d().overzichten.filter(o => !o.opslag && !o.slot);
  const wanneer = (iso) => iso ? new Date(iso).toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const rij = (f) => {
    const st = feedStand.get(f.id) || {}, n = feedBlokken(f).length;
    return `<div class="paneel feedrij" data-feed="${esc(f.id)}">
      <label class="veld">Naam van de agenda<input type="text" data-feedveld="naam" value="${esc(f.naam)}" maxlength="100"></label>
      <div class="feedurl"><input type="text" readonly value="${esc(feedUrl(f.id))}" aria-label="Abonneer-link" data-feedurl>
        <button type="button" class="knop klein prim" data-actie="feedKopie">📋 Kopiëren</button></div>
      <div><div class="hint" style="margin-bottom:4px">Welke lijsten erin staan</div><div class="chips feedlijsten">${keuze.map(o =>
        `<label class="schakel"><input type="checkbox" data-feedlijst="${o.id}" ${(f.lijsten || []).includes(o.id) ? "checked" : ""}> ${esc(o.icoon)} ${esc(o.naam)}</label>`).join("")}</div></div>
      <label class="schakel"><input type="checkbox" data-feedopt="titels" ${f.titels !== false ? "checked" : ""}> Namen van de taken meesturen (anders staat er alleen „Werkblok”)</label>
      <label class="schakel"><input type="checkbox" data-feedopt="reis" ${f.reis ? "checked" : ""}> Reistijd meesturen</label>
      <div class="hint">${n} ${n === 1 ? "blok" : "blokken"} (vanaf twee weken terug)${st.fout ? "" : st.bijgewerkt ? ` · ✓ link bijgewerkt ${esc(wanneer(st.bijgewerkt))}` : " · nog niet gevuld"}</div>
      ${st.fout ? `<div class="waarsch" style="margin:0"><b>Deze link werkt nog niet.</b> ${esc(st.fout)}</div>` : ""}
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="knop klein" data-actie="feedNieuw" title="Maak een nieuwe link; de oude werkt daarna niet meer">🔄 Nieuwe link</button>
        <button type="button" class="knop klein gevaar" data-actie="feedIntrekken">Link intrekken</button></div>
    </div>`;
  };
  return `<h3>📡 Abonneer-link voor je werkagenda</h3>
  <p class="hint">Een link (.ics, alleen lezen) met je ingeplande blokken. Geef hem aan Copilot om de blokken in je werkagenda te zetten, of voeg hem in Outlook toe via <i>Agenda toevoegen → Abonneren vanaf het web</i>.
    Alle blokken staan op <b>vrij</b>, zodat ze collega's niet blokkeren en Tijdkompas ze bij het ophalen niet als bezet ziet. De link wordt bijgewerkt zodra je iets wijzigt (op een apparaat waar je bent ingelogd).
    Wie de link heeft, kan hem lezen: deel hem alleen met je eigen agenda of Copilot. Uitgelekt? Maak een nieuwe link.
    Werkt de link in de browser niet? Dan moeten de nieuwste beveiligingsregels in Firebase staan en het doorgeefluik bijgewerkt zijn (SETUP.md D4).</p>
  ${!ingelogd() ? `<div class="hint">Log in om een link te maken: de link haalt je planning uit de Tijdkompas-cloud.</div>`
    : `${feeds.map(rij).join("")}<div style="margin-top:8px"><button type="button" class="knop" data-actie="feedBij">＋ Link maken</button></div>`}`;
}
const feedVan = (el) => (d().feeds || []).find(f => f.id === el.closest("[data-feed]")?.dataset.feed);
async function feedActie(a, el) {
  if (a === "feedBij") {
    const werk = d().overzichten.filter(o => o.modus === "vast" && !o.opslag && !o.slot);
    const lijsten = (werk.length ? werk : d().overzichten.filter(o => !o.opslag && !o.slot).slice(0, 1)).map(o => o.id);
    d().feeds = [...(d().feeds || []), { id: nieuweFeedSleutel(), naam: "Tijdkompas – " + (werk[0]?.naam || "planning"), lijsten, titels: true, reis: false, aangemaakt: new Date().toISOString() }];
    bewaar(); await feedsBijwerken(); render();
    const st = feedStand.get(d().feeds.at(-1).id);
    toast(st?.fout ? "Link gemaakt, maar nog niet gevuld: " + st.fout : "Link gemaakt — kopieer hem en geef hem aan Copilot of Outlook");
    return;
  }
  const f = feedVan(el); if (!f) return;
  if (a === "feedKopie") {
    const url = feedUrl(f.id);
    try { await navigator.clipboard.writeText(url); toast("Link gekopieerd"); }
    catch { const i = el.closest("[data-feed]").querySelector("[data-feedurl]"); i?.select?.(); toast("Selecteer de link en kopieer hem"); }
  } else if (a === "feedNieuw") {
    if (!confirm("Een nieuwe link maken? De oude link werkt daarna niet meer; geef de nieuwe opnieuw aan Copilot of Outlook.")) return;
    try { await feedWeg(f.id); } catch (e) { toast("De oude link intrekken mislukte: " + foutTekst(e)); return; }
    f.id = nieuweFeedSleutel(); bewaar();
    await feedsBijwerken(); render();
    const st = feedStand.get(f.id);
    toast(st?.fout ? "Nieuwe link gemaakt, maar nog niet gevuld: " + st.fout : "Nieuwe link gemaakt; de oude werkt niet meer");
  } else if (a === "feedIntrekken") {
    if (!confirm("Deze link intrekken? Agenda's die hem gebruiken krijgen dan niets meer binnen.")) return;
    try { await feedWeg(f.id); } catch (e) { toast("Intrekken mislukt: " + foutTekst(e)); return; }
    d().feeds = d().feeds.filter(x => x !== f); bewaar(); render(); toast("Link ingetrokken");
  }
}

// ---------- takenlijsten (Google Taken / Microsoft To Do) ----------
// Agenda via een link (alleen lezen): bv. een gepubliceerde Outlook-agenda, zonder Microsoft-koppeling
function linkBlok() {
  const links = d().agendaLinks || [];
  return `<h3>Agenda via een link (alleen lezen)</h3>
  <p class="hint">Voor een agenda die je niet rechtstreeks kunt koppelen, zoals je Outlook-agenda: publiceer hem in Outlook als link en plak die hier.
    Tijdkompas toont de afspraken en plant eromheen (elk kwartier bijgewerkt). Blokken in die agenda zetten kan zo niet.
    <a href="https://github.com/brennyc86/tijdkompas/blob/main/SETUP.md#d-outlook-agenda-via-een-link-alleen-lezen" target="_blank" rel="noopener">Hoe publiceer ik mijn Outlook-agenda?</a></p>
  ${links.length ? `<div class="lijst">${links.map(l => `<div class="accrij" data-link="${esc(l.id)}">
    <span class="avatar" style="background:${esc(l.kleur || "#4f8fd8")}">📅</span>
    <div class="ibody"><div class="ititel">${esc(l.naam)}</div>
      <div class="imeta">${l.fout ? `<span style="color:var(--rood)">${esc(l.fout)}</span>` : l.laatst ? `${l.aantal ?? 0} afspraken · bijgewerkt ${new Date(l.laatst).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}` : "nog niet opgehaald"}</div></div>
    <input type="color" value="${esc(l.kleur || "#4f8fd8")}" data-linkkleur aria-label="Kleur">
    <button type="button" class="knop klein gevaar" data-actie="linkWeg">Weghalen</button></div>`).join("")}</div>` : ""}
  <form class="rij linkform" data-actie="linkBij" style="margin-top:8px;align-items:end">
    <label class="veld">Naam<input name="naam" placeholder="bv. Outlook werk" required></label>
    <label class="veld" style="flex:2">Agendalink (.ics)<input name="url" type="url" placeholder="https://outlook.office365.com/owa/calendar/…/calendar.ics" required></label>
    <button class="knop">＋ Toevoegen</button>
  </form>`;
}

// Een Tijdkompas-lijst voor een takenlijst uit Google/Microsoft (naam is daarna vrij te wijzigen)
function maakTakenLijst(naam, soort, email = "") {
  naam ||= "Taken";
  if (d().overzichten.some(o => o.naam.toLowerCase() === naam.toLowerCase())) naam += email ? ` (${email})` : ` (${soort === "ms" ? "Microsoft" : "Google"})`;   // geen twee met dezelfde naam
  const o = { id: uid() + (sessie.ik ? uid() : ""), naam, kleur: soort === "ms" ? "#4f8fd8" : "#6fb38a", icoon: soort === "ms" ? "☑️" : "✅",
              map: "", mensen: [], verdeling: "samen", modus: "vrij", locatie: "", doelAgenda: null, tijden: [] };
  d().overzichten.push(o);
  if (actief) { actief = [...actief, o.id]; voorkeur.zet("actief", actief); }
  bewaar();
  return o.id;
}
function takenlijstOpties(gekozen) {
  return `<option value="">— niet koppelen —</option>` + Object.entries(d().takenlijsten || {}).filter(([k]) => takenVerbindingVan(k))
    .map(([k, x]) => `<option value="${esc(k)}" ${k === gekozen ? "selected" : ""}>${x.accountSoort === "ms" ? "To Do" : "Google Taken"} · ${esc(x.naam)} (${esc(x.account)})</option>`).join("");
}
function takenBlok(id) {
  const lijst = takenVerbindingen();
  const tl = Object.entries(d().takenlijsten || {}).filter(([k]) => takenVerbindingVan(k));
  const rij = ([k, x]) => `<div class="agendarij" data-tl="${esc(k)}">
    <span class="anaam">${esc(x.naam)}${x.standaard ? ` <small class="hint">standaardlijst</small>` : ""}</span>
    <select data-tlijst aria-label="Koppelen aan lijst"><option value="">— niet koppelen —</option>
      ${d().overzichten.filter(o => !o.slot && !(ingelogd() && gelinkteInfo(o))).map(o => `<option value="${o.id}" ${x.lijst === o.id ? "selected" : ""}>↔ ${esc(o.icoon)} ${esc(o.naam)}</option>`).join("")}
      <option value="+nieuw">＋ nieuwe lijst „${esc(x.naam)}”</option></select>
    <span class="hint">${x.lijst ? d().taken.filter(t => t.ext?.bron === k).length || "" : ""}</span>
  </div>`;
  return `<h3>Takenlijsten: welke hoort waarbij?</h3>
  <p class="hint">Koppel Google Taken (ook de taken uit Gmail en Google Agenda) of Microsoft To Do (de taken uit Outlook) aan een lijst in Tijdkompas.
    Taken gaan dan twee kanten op: wat je daar toevoegt komt hier binnen en wordt ingepland, en wat je hier toevoegt of afvinkt zie je daar ook.</p>
  ${lijst.length ? "" : `<p class="hint">Koppel hierboven een Google- of Microsoft-account; de takenlijsten verschijnen dan hier.</p>`}
  ${tl.length ? `<div class="paneel agendagroep" style="margin-top:10px"><div class="hint" style="margin-bottom:6px">Welke takenlijst hoort bij welke lijst?</div>${tl.map(rij).join("")}</div>
  <div style="margin-top:8px"><button class="knop" data-actie="takenOphalen">🔄 Taken synchroniseren</button>
    <span class="hint">${d().takenSync ? "Laatst: " + new Date(d().takenSync).toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span></div>` : ""}`;
}

function instOverig() {
  const bm = `javascript:(()=>{let t=document.title.replace(/ - [^-]*(Gmail|Outlook)[^-]*$/,'').replace(/^(Mail|E-mail) - /,'');window.open('${location.origin + location.pathname}?nieuw=1&titel='+encodeURIComponent(t)+'&url='+encodeURIComponent(location.href),'tijdkompas','width=720,height=820')})()`;
  return `<h3 style="margin-top:0">Mails koppelen</h3>
  <div class="paneel" style="display:flex;flex-direction:column;gap:10px;font-size:14px">
    <div>Sleep deze knop naar je bladwijzerbalk. Open een mail in Gmail of Outlook (web) en klik erop: er opent een nieuwe taak met de mail als link.</div>
    <div><a class="bookmarklet" href="${esc(bm)}" data-bookmarklet>＋ Tijdkompas</a></div>
    <div class="hint">Op je telefoon: installeer Tijdkompas (menu → „Toevoegen aan startscherm”) en gebruik <b>Delen</b> vanuit je mail-app. Of plak gewoon de link van een mail in een taak.</div>
  </div>
  <h3>Kleuren</h3>
  <p class="hint">${ingelogd() ? `Deze kleuren horen bij ${esc(cloud.gebruiker.email)}. Kies voor je gelinkte account(s) andere kleuren, dan zie je meteen met welk account je kijkt.` : "Kies de kleuren van Tijdkompas."}</p>
  <div class="themas" role="group" aria-label="Kleuren">${Object.entries(THEMAS).map(([k, t]) =>
    `<button type="button" class="themaknop" data-actie="themaKies" data-w="${k}" aria-pressed="${huidigThema() === k}" title="${esc(t.naam)}"
      style="--a:${t.bg};--b:${t.accent};--c:${t.accent2}"><span class="staal"></span>${esc(t.naam)}</button>`).join("")}</div>
  <h3>Gegevens</h3>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="knop" data-actie="exportJson">⬇ Back-up downloaden</button>
    <button class="knop" data-actie="importJson">⬆ Back-up terugzetten</button>
    ${ingelogd() ? "" : `<button class="knop" data-actie="demo">Voorbeelddata laden</button>`}
    <button class="knop gevaar" data-actie="leeg">Alles wissen en opnieuw beginnen</button>
  </div>
  <p class="hint">${ingelogd() ? `Je planning staat online in je account (${esc(cloud.gebruiker.email)}) en is op elk apparaat hetzelfde, ook offline bruikbaar.` : "Je planning staat nu alleen in deze browser. Log in om hem op al je apparaten te hebben en lijsten te delen."}</p>`;
}

const googleLogo = `<svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
const msLogo = `<svg width="16" height="16" viewBox="0 0 23 23" aria-hidden="true"><path fill="#f35325" d="M1 1h10v10H1z"/><path fill="#81bc06" d="M12 1h10v10H12z"/><path fill="#05a6f0" d="M1 12h10v10H1z"/><path fill="#ffba08" d="M12 12h10v10H12z"/></svg>`;

// ---------- account ----------
function accountBlok() {
  const g = cloud.gebruiker;
  if (!g) return `<div class="inlogknoppen">
      <button type="button" class="knop inlog" data-actie="login" data-w="google" ${cloudIngesteld() ? "" : "disabled"}>${googleLogo} Inloggen met Google</button>
      <button type="button" class="knop inlog" data-actie="login" data-w="microsoft" ${cloudIngesteld() ? "" : "disabled"}>${msLogo} Inloggen met Microsoft</button>
    </div>
    <div class="mailinlog">
      <div class="hint">Geen Google-account? Log in met elk e-mailadres (Outlook, Hotmail, werk…): je krijgt een inloglink per mail, zonder wachtwoord.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        <input type="email" id="inlogMail" placeholder="jij@voorbeeld.nl" autocomplete="email" style="flex:1;min-width:200px" ${cloudIngesteld() ? "" : "disabled"}>
        <button type="button" class="knop" data-actie="mailLink" ${cloudIngesteld() ? "" : "disabled"}>✉️ Stuur inloglink</button>
      </div>
      <div class="hint" id="mailStatus"></div>
    </div>
    ${cloudIngesteld() ? "" : `<p class="hint">Inloggen wordt binnenkort geactiveerd. Tot die tijd werkt alles gewoon in deze browser.</p>`}`;
  const heeft = (s) => g.aanbieders.some(a => a.soort === s);
  return `<div class="accrij">${g.foto ? `<img class="avatar" src="${esc(g.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc(g.naam[0].toUpperCase())}</span>`}
      <div class="ibody"><div class="ititel">${esc(g.naam)}</div><div class="imeta">${esc(g.email)} · ${cloud.fout ? `<span style="color:var(--rood)">${esc(cloud.fout)}</span>` : cloud.bezig ? "opslaan…" : "☁️ alles opgeslagen"}</div></div>
      <button type="button" class="knop klein" data-actie="uitloggen">Uitloggen</button></div>
    ${g.geverifieerd ? "" : `<div class="paneel" data-familie style="margin-top:10px">✉️ Je e-mailadres <b>${esc(g.email)}</b> is nog niet bevestigd.
      Dat is nodig om uitnodigingen te zien en accounts te linken (zo kan niemand zich als jou voordoen).
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="knop klein prim" data-actie="mailBevestig">Bevestigingsmail sturen</button>
      <button type="button" class="knop klein" data-actie="mailBevestigd">Ik heb op de link geklikt</button></div></div>`}
    ${familieBlok()}`;
}
// Alle accounts waarmee je in dit Tijdkompas komt (privé, werk, hobby…)
function familieEmails() {
  const hoofd = isHoofd() ? cloud.gebruiker?.email : cloud.hoofdInfo?.email;
  return [...new Set([hoofd, ...Object.values(cloud.aliasInfo || {}).map(x => x.email)].filter(Boolean))];
}
function familieBlok() {
  const g = cloud.gebruiker; if (!g) return "";
  const hoofd = isHoofd() ? { email: g.email, naam: g.naam, foto: g.foto } : (cloud.hoofdInfo || { email: "hoofdaccount", naam: "Hoofdaccount" });
  const rij = (x, uid, isH) => {
    return `<div class="accrij">${x.foto ? `<img class="avatar" src="${esc(veiligeFoto(x.foto))}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((x.naam || x.email || "?")[0].toUpperCase())}</span>`}
    <div class="ibody"><div class="ititel">${esc(x.email)}${x.email === g.email ? ` <span class="tag">nu ingelogd</span>` : ""}</div>
      <div class="imeta">${isH ? "hoofdaccount" : "gelinkt account"}</div></div>
    ${!isH && isHoofd() ? `<button type="button" class="knop klein gevaar" data-actie="inlogWeg" data-w="${esc(uid)}">Loskoppelen</button>` : ""}</div>`; };
  return `<h3>Gelinkte accounts</h3>
    <p class="hint">Elk account houdt zijn eigen agenda's, takenlijsten, koppelingen en kleuren. Gelinkt zie je met elk account ook de lijsten, agenda en planning van de andere (rustig, in de achtergrond).</p>
    <div class="lijst">${rij(hoofd, cloud.hoofdUid || sessie.ik, true)}${Object.entries(cloud.aliasInfo || {}).map(([u, x]) => rij(x, u, false)).join("")}</div>
    ${isHoofd() ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button type="button" class="knop klein" data-actie="inlogBij" data-w="google">${googleLogo} ＋ Google-account toevoegen</button>
      <button type="button" class="knop klein" data-actie="inlogBij" data-w="microsoft">${msLogo} ＋ Microsoft-account toevoegen</button>
      <button type="button" class="knop klein" data-actie="mailKoppel">✉️ ＋ E-mailadres toevoegen</button></div>
      <div class="hint" style="margin-top:4px">Deze knoppen werken als je het andere account <i>op dit apparaat</i> kunt inloggen. Anders: gebruik een koppelcode.</div>`
    : `<p class="hint">Accounts toevoegen of loskoppelen doe je als je inlogt met het hoofdaccount (${esc(hoofd.email)}).</p>`}
    ${koppelBlok()}`;
}
// Linken met een koppelcode: B vraagt een code aan, A (het hoofd) vult e-mail + code in, B bevestigt
function koppelBlok() {
  const g = cloud.gebruiker; if (!g) return "";
  const kb = koppelStaat.b, ka = koppelStaat.a, uur = (ms) => fmtTijd(new Date(ms).toISOString());
  const magAanvragen = isHoofd() && !Object.keys(cloud.aliasInfo || {}).length;
  let b = "";
  if (kb?.status === "verzocht") b = `<div class="paneel koppelverzoek">🔗 <b>${esc(kb.van?.email || "")}</b> wil dit account linken. Ken je dit adres niet, of heb je zelf niets ingevuld? Klik dan op Weigeren.
      Na bevestigen zien beide accounts elkaars lijsten, agenda en planning.
      <div style="display:flex;gap:8px;margin-top:8px"><button type="button" class="knop klein prim" data-actie="koppelJa">Bevestigen</button>
      <button type="button" class="knop klein gevaar" data-actie="koppelNee">Weigeren</button></div></div>`;
  else if (kb) b = `<div class="paneel koppelcode"><div class="hint">Jouw koppelcode, geldig tot ${uur(kb.verloopt)}:</div>
      <div class="code" aria-label="Koppelcode">${esc(kb.code.slice(0, 3))} ${esc(kb.code.slice(3))}</div>
      <div class="hint">Log op je <b>hoofdaccount</b> in (mag op een ander apparaat), ga naar <b>Agenda's &amp; accounts → Gelinkte accounts</b> en vul daar
        <b>${esc(g.email)}</b> en deze code in. Daarna vraagt Tijdkompas hier om te bevestigen.</div>
      <button type="button" class="knop klein" data-actie="koppelStop">Code intrekken</button></div>`;
  else if (magAanvragen) b = `<div style="margin-top:8px"><button type="button" class="knop klein" data-actie="koppelVraag">🔢 Koppelcode aanvragen</button>
      <span class="hint">om dít account aan een ander (hoofd)account te linken</span></div>`;
  const a = !isHoofd() ? "" : ka ? `<div class="paneel">⏳ Verzoek verstuurd naar <b>${esc(ka.email || "het andere account")}</b>. Bevestig het daar; dit venster werkt zich vanzelf bij.</div>`
    : `<div class="koppelform" data-koppelform><div class="hint">Code van een ander account invoeren (ook als dat op een ander apparaat is ingelogd):</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        <input type="email" id="koppelMail" placeholder="e-mailadres van het andere account" autocomplete="off" style="flex:2;min-width:200px">
        <input type="text" id="koppelCode" placeholder="code" maxlength="7" autocomplete="off" autocapitalize="characters" style="flex:1;min-width:90px;text-transform:uppercase;letter-spacing:2px">
        <button type="button" class="knop klein prim" data-actie="koppelGebruik">Linken</button></div></div>`;
  return `<div class="koppelblok" data-familie>${a}${b}</div>`;
}
// Banner op account B zolang er een verzoek klaarstaat
function koppelBanner() {
  const kb = koppelStaat.b; if (kb?.status !== "verzocht") return "";
  return `<div class="banner">🔗 <span><b>${esc(kb.van?.email || "")}</b> wil dit account linken aan het Tijdkompas van dat account. Herken je dat adres niet? Weiger dan.</span>
    <button class="knop klein prim" data-actie="koppelJa">Bevestigen</button><button class="knop klein" data-actie="koppelNee" style="margin-left:0">Weigeren</button></div>`;
}
function renderAccount() {
  const k = $("#accountKnop"), g = cloud.gebruiker;
  k.querySelector(".accountTekst").textContent = g ? g.naam.split(" ")[0] + (cloud.fout ? " !" : cloud.bezig ? " ⟳" : "") : "Inloggen";
  k.querySelector(".avatar").innerHTML = g?.foto ? `<img src="${esc(g.foto)}" alt="" referrerpolicy="no-referrer">` : g ? esc(g.naam[0].toUpperCase()) : "⌂";
  k.title = g ? `${g.email}${cloud.fout ? " · " + cloud.fout : ""}` : "Inloggen";
}
$("#accountKnop").addEventListener("click", () => {
  const g = cloud.gebruiker;
  dlg.innerHTML = `<form method="dialog"><div class="dkop"><h2>${g ? "Je account" : "Inloggen bij Tijdkompas"}</h2><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
  <div class="dlijf">
    ${accountBlok()}
    ${g ? "" : `<div class="paneel" style="font-size:14px;line-height:1.55">
      <b>Waarom inloggen?</b>
      <ul style="margin:6px 0 0;padding-left:18px">
        <li>Je planning staat veilig online en is op al je apparaten hetzelfde.</li>
        <li>Lijsten delen met anderen en er samen aan werken.</li>
        <li>Zakelijk én privé: log in met Google of Microsoft, en koppel het andere account er later bij.</li>
      </ul>
      ${d().taken.length && !d().demo ? `<p class="hint" style="margin-bottom:0">Wat je nu op dit apparaat hebt, kun je bij de eerste keer inloggen meenemen.</p>` : ""}
    </div>`}
    <a class="knop" href="#instellingen" data-dactie="naarKoppelingen" style="justify-content:center">🔗 Agenda's &amp; accounts</a>
  </div></form>`;
  dlg.onclick = (e) => {
    const b = e.target.closest("[data-actie],[data-dactie]"); if (!b) return;
    if (b.dataset.dactie === "naarKoppelingen") { voorkeur.zet("instTab", "koppelingen"); dlg.close(); if (location.hash === "#instellingen") render(); return; }
    accountActie(b.dataset.actie, b.dataset.w, () => dlg.close());
  };
  dlg.onclose = () => { dlg.onclick = null; dlg.onclose = null; };
  if (!dlg.open) dlg.showModal();
});

// Inlog-acties (zowel vanuit de dialoog als vanuit Instellingen). De popup opent direct binnen de klik.
function accountActie(a, w, klaar) {
  if (a === "login") {
    login(w).then(() => { klaar?.(); toast("Ingelogd"); }).catch(e => toast(foutTekst(e)));
  } else if (a === "mailLink") {
    const inp = $("#inlogMail"), st = $("#mailStatus");
    stuurInlogLink(inp?.value).then(email => {
      if (st) st.innerHTML = `✉️ Er is een inloglink gestuurd naar <b>${esc(email)}</b>. Open de mail en klik op de link (kijk ook in je spam). Je mag dit venster sluiten.`;
      toast(`Inloglink gestuurd naar ${email}`);
    }).catch(e => toast(foutTekst(e)));
  } else if (a === "mailKoppel") {
    const email = prompt("Welk e-mailadres wil je als gelinkt account toevoegen?\nJe krijgt een mail op dat adres; open de link daarin in déze browser.");
    if (email) stuurInlogLink(email, { koppelen: true })
      .then(m => toast(`Link gestuurd naar ${m}. Open die mail in deze browser, dan wordt het account gekoppeld.`)).catch(e => toast(foutTekst(e)));
  } else if (a === "inlogBij") {
    voegInlogToe(w).then(r => {
      const mee = [r.lijsten ? `${r.lijsten} lijsten` : "", r.extra ? "agenda's, takenlijsten en koppelingen" : ""].filter(Boolean).join(" en ");
      toast(`${r.email} is nu gelinkt${mee ? ` — ${mee} zijn meegekomen` : ""}. Geef dat account bij Instellingen → Overig eigen kleuren.`);
      render(); if (dlg.open) $("#accountKnop").click();
    }).catch(e => toast(foutTekst(e)));
  } else if (a === "inlogWeg") {
    const x = cloud.aliasInfo?.[w];
    if (confirm(`${x?.email || "Dit account"} loskoppelen?\nInloggen met dat account geeft dan weer een eigen, apart Tijdkompas. Alle lijsten blijven gewoon hier staan.`))
      verwijderInlog(w).then(() => { toast("Losgekoppeld"); render(); if (dlg.open) $("#accountKnop").click(); }).catch(e => toast(foutTekst(e)));
  } else if (a === "koppelAccount") {
    koppelAccount(w).then(() => { toast("Gekoppeld — je kunt nu met beide accounts inloggen"); location.reload(); }).catch(e => toast(foutTekst(e)));
  } else if (a === "mailBevestig") {
    stuurBevestiging().then(m => toast(`Bevestigingsmail gestuurd naar ${m} — klik op de link en kom daarna hier terug`)).catch(e => toast(foutTekst(e)));
  } else if (a === "mailBevestigd") {
    controleerBevestiging().then(ok => { toast(ok ? "E-mailadres bevestigd ✓" : "Nog niet bevestigd — klik eerst op de link in de mail (kijk ook in je spam)"); if (dlg.open) $("#accountKnop").click(); render(); })
      .catch(e => toast(foutTekst(e)));
  } else if (a === "koppelVraag") {
    vraagKoppelcode().then(() => { render(); if (dlg.open) $("#accountKnop").click(); }).catch(e => toast(foutTekst(e)));
  } else if (a === "koppelGebruik") {
    const f = document.querySelector("dialog[open] [data-koppelform]") || document.querySelector("[data-koppelform]");
    gebruikKoppelcode(f?.querySelector("#koppelMail")?.value, f?.querySelector("#koppelCode")?.value)
      .then(r => { toast(`Verzoek verstuurd — bevestig het op ${r.email}`); document.activeElement?.blur?.(); render(); if (dlg.open) $("#accountKnop").click(); })
      .catch(e => toast(foutTekst(e)));
  } else if (a === "koppelJa" || a === "koppelNee") {
    const van = koppelStaat.b?.van;
    if (a === "koppelJa" && !confirm(`Dit account linken aan ${van?.email || "het andere account"}?\nBeide accounts zien daarna elkaars lijsten, agenda en planning.`)) return true;
    beantwoordKoppel(a === "koppelJa").then(r => { toast(r ? `Gelinkt met ${r.email}` : "Geweigerd"); render(); if (dlg.open) $("#accountKnop").click(); })
      .catch(e => toast(foutTekst(e)));
  } else if (a === "koppelStop") {
    stopKoppelcode(); render(); if (dlg.open) $("#accountKnop").click();
  } else if (a === "uitloggen") {
    if (confirm("Uitloggen? Je planning blijft veilig in je account staan.\nOp dit apparaat worden je gegevens en de toegang tot je agenda's en takenlijsten gewist.")) uitloggen().then(() => { klaar?.(); toast("Uitgelogd"); setTimeout(() => location.reload(), 700); });   // schoon beginnen: niets van het account blijft in het geheugen
  } else return false;
  return true;
}

// ---------- uitnodigingen ----------
function uitnodigingBanner() {
  return cloud.uitnodigingen.map(u => `<div class="banner">👥 <span><b>${esc(u.van)}</b> nodigt je uit voor ${u.map ? "de map" : "de lijst"} <b>${esc(u.icoon || "")} ${esc(u.naam)}</b>${u.map && u.aantal ? ` (${u.aantal} ${u.aantal === 1 ? "lijst" : "lijsten"})` : ""}.</span>
    <button class="knop klein prim" data-actie="accepteer" data-w="${esc(u.id)}">Doe mee</button><button class="knop klein" data-actie="weiger" data-w="${esc(u.id)}" style="margin-left:0">Nee, dank je</button></div>`).join("");
}

// ---------- agenda-koppel-acties ----------
const verlopenSessies = new Map();
function sessieBanner() {
  const lijst = [...verlopenSessies.values()].filter(v => verbindingen().some(x => x.id === v.id));
  const schijfVerl = [...schijf.verlopen.values()].filter(v => !lijst.some(x => x.id === v.id));
  return (cloud.melding ? `<div class="banner">⚠️ <span>${esc(cloud.melding)}</span></div>` : "") + koppelBanner() + uitnodigingBanner() + lijst.map(v => `<div class="banner">🔑 ${v.token ? `De koppeling met <b>${esc(v.email)}</b> is verlopen.` : `<span>De koppeling met <b>${esc(v.email)}</b> is op dit apparaat (nog) niet verbonden.</span>`}<button class="knop klein" data-actie="vernieuw" data-verbid="${esc(v.id)}">${v.token ? "Opnieuw verbinden" : "Verbinden"}</button></div>`).join("")
    + schijfVerl.map(v => `<div class="banner">🔑 De verbinding met je ${esc(naamVan(v.id))} is verlopen — wijzigingen staan veilig op dit apparaat en gaan mee zodra je opnieuw verbindt.<button class="knop klein" data-actie="vernieuw" data-verbid="${esc(v.id)}">Opnieuw verbinden</button></div>`).join("");
}
// doel: "agenda" of "schijf"; lijstId: na het koppelen van een schijf deze lijst er meteen naartoe verplaatsen
// doel: "agenda", "taken", "agenda+taken" of "schijf"; email: een bestaand account uitbreiden
async function doeKoppel(soort, doel = "agenda+taken", lijstId = null, email = "") {
  try {
    const doelen = doel.split("+");
    const v = await (soort === "ms" ? koppelMs(doelen, email) : koppelGoogle(doelen, email));
    if (doelen.includes("agenda") || doelen.includes("taken")) {
      if (doelen.includes("agenda")) await doeOphalen(true);
      if (doelen.includes("taken")) await doeTakenSync(true);
      const wel = doelen.filter(x => heeft(v, x)), niet = doelen.filter(x => !heeft(v, x)), nm = (x) => x === "agenda" ? "agenda" : "takenlijsten";
      toast(`${wel.map(nm).join(" en ").replace(/^./, c => c.toUpperCase())} van ${v.email} gekoppeld${niet.length ? ` (zonder ${niet.map(nm).join(" en ")}; dat kan later met ＋)` : ""}`);
    }
    else {
      toast(`${soort === "ms" ? "OneDrive" : "Google Drive"} van ${v.email} gekoppeld`);
      startSchijf(); await synchroniseerAlles();
      if (lijstId) await doeVerplaats(lijstId, v.id);
    }
  } catch (e) { toast(e.message || String(e)); }
  render();
}
async function doeVerplaats(lijstId, vId) {
  const o = overzicht(lijstId); if (!o) return;
  try {
    await verplaats(lijstId, vId || null);
    toast(vId ? `„${o.naam}” staat nu in je ${naamVan(vId)}` : `„${o.naam}” staat nu ${ingelogd() ? "in de Tijdkompas-cloud" : "in deze browser"}`);
  } catch (e) { toast(e.message || String(e)); }
  render();
}
async function doeVernieuw(v) {
  if (!v) return;
  try {
    await vernieuw(v); verlopenSessies.delete(v.id); schijf.verlopen.delete(v.id); toast("Opnieuw verbonden");
    if (heeft(v, "agenda")) await doeOphalen(true);
    if (heeft(v, "schijf")) await synchroniseerAlles();
    if (heeft(v, "taken")) await doeTakenSync(true);
  } catch (e) { toast(e.message); }
  render();
}
async function doeOphalen(stil = false) {
  const links = d().agendaLinks || [];
  if (!verbindingen().length && !links.length) return;
  const r = verbindingen().length ? await verversAgendas() : { verlopen: [], fouten: [] };
  if (links.length) { r.fouten.push(...await verversLinks()); d().agendaSync = new Date().toISOString(); bewaar(); }
  r.verlopen.forEach(v => verlopenSessies.set(v.id, v));
  if (r.fouten.length) toast(r.fouten[0]);
  else if (!stil) toast(`Agenda's opgehaald (${d().bezet.filter(b => verbindingVanBron(b.bron)).length} afspraken)`);
}
async function doeTakenSync(stil = true) {
  if (!takenVerbindingen().length || doeTakenSync.bezig) return;
  doeTakenSync.bezig = true;
  try {
    const r = await syncTaken({ maakLijst: maakTakenLijst });
    r.verlopen.forEach(v => verlopenSessies.set(v.id, v));
    if (r.fouten.length) toast(r.fouten[0]);
    else if (!stil || r.binnen || r.weg) toast(`Taken bijgewerkt: ${r.binnen} binnengehaald, ${r.naar + r.bij} gewijzigd, ${r.weg} weg`);
  } finally { doeTakenSync.bezig = false; takenLaatst = takenAfdruk(); }
  render();
}
// ---------- Google Taken / Microsoft To Do automatisch bijhouden ----------
// Wijzig je hier iets in een gekoppelde lijst (ook vanaf een gelinkt account of ander apparaat), dan gaat het binnen
// een paar seconden naar Google/Microsoft. Zolang de app open staat, wordt elke 1,5 minuut opgehaald wat daar veranderde.
function takenAfdruk() {
  const l = new Set(Object.values(d().takenlijsten || {}).map(x => x.lijst).filter(Boolean));
  if (!l.size) return "";
  return JSON.stringify([...d().taken, ...d().projecten].filter(x => l.has(x.overzicht))
    .map(x => [x.id, x.titel, x.status, x.notitie, x.deadline, x.streef, x.project, x.urgent, x.belangrijk, x.overzicht, x.wie, x.schatting]));
}
let takenLaatst = "", takenTimer = null;
function takenStraks(ms = 2500) {
  clearTimeout(takenTimer);
  takenTimer = setTimeout(() => { if (doeTakenSync.bezig) takenStraks(3000); else doeTakenSync(true); }, ms);
}
const takenGekoppeld = () => takenVerbindingen().length && Object.values(d().takenlijsten || {}).some(x => x.lijst);
opslag.luister(() => {
  if (doeTakenSync.bezig || !takenGekoppeld()) return;
  const a = takenAfdruk();
  if (a !== takenLaatst) { takenLaatst = a; takenStraks(); }
});
takenLaatst = takenAfdruk();
setInterval(() => { if (document.visibilityState !== "hidden" && takenGekoppeld()) doeTakenSync(true); }, 90e3);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && takenGekoppeld() && Date.now() - new Date(d().takenSync || 0) > 30e3) doeTakenSync(true);
});
async function doeNaarAgenda(alleen = null, { stil = false } = {}) {
  const r = await zetNaarAgendas({ alleen });
  r.verlopen.forEach(v => verlopenSessies.set(v.id, v));
  if (r.fouten.length) toast(r.fouten[0]);
  else if (stil) { if (r.nieuw || r.weg) toast(`In je agenda gezet wat je vanuit een ander account inplande (${r.nieuw} nieuw${r.weg ? `, ${r.weg} weg` : ""})`); }
  else toast(`Agenda bijgewerkt: ${r.nieuw} nieuw, ${r.bij} gewijzigd, ${r.weg} verwijderd${r.verlopen.length ? " — log opnieuw in voor de rest" : ""}`);
  render();
}

// ---------- editor ----------
let inplannenNa = false;
// Projecten om een taak in te zetten: deelprojecten (tussendoelen) ingesprongen onder hun langlopende project
function projectOpties(gekozen) {
  const mag = (p) => p.status !== "klaar" || p.id === gekozen;
  const opt = (p, diep) => `<option value="${p.id}" ${p.id === gekozen ? "selected" : ""}>${diep ? "\u2003🏁 " : pIcoon(p) + " "}${esc(p.titel)}</option>`;
  return d().projecten.filter(p => mag(p) && !ouderVan(p)).map(p => opt(p, false) + (isLang(p) ? deelprojecten(p.id).filter(mag).map(x => opt(x, true)).join("") : "")).join("");
}
// Kort- of langlopend, en wat het doel is; bij een langlopend project de tussendoelen (deelprojecten)
function looptijdBlok(c, item) {
  const lang = c.looptijd === "lang";
  const ouders = d().projecten.filter(p => isLang(p) && p.id !== item?.id && (p.status !== "klaar" || p.id === c.ouder));
  const deel = item ? deelprojecten(item.id).sort((a, b) => (a.status === "klaar") - (b.status === "klaar") || (doelDatum(a) || "9999").localeCompare(doelDatum(b) || "9999")) : [];
  return `<div class="looptijd">
    <div class="chips looptijdkeuze">
      <button type="button" data-looptijd="kort" aria-pressed="${!lang}" title="Met een duidelijk eind: iets wat je oplevert">🏁 Kortlopend</button>
      <button type="button" data-looptijd="lang" aria-pressed="${lang}" title="Doorlopend: geen eind in zicht, of nog niet geformuleerd">♾️ Langlopend</button></div>
    <div class="hint">${lang ? "Doorlopend, zonder (zicht op een) eind. Knip het op in kortlopende deelprojecten: tussendoelen met een duidelijk resultaat, en eventueel een deadline."
      : "Een duidelijk eind: iets wat je oplevert. Hoort het bij iets groters wat doorloopt, kies dat dan bij „Onderdeel van”."}</div>
    <label class="veld">${lang ? "🧭 Stip op de horizon <small class=\"hint\">(mag vaag, of nog leeg)</small>" : "🏁 Wat lever je op? <small class=\"hint\">(het eindresultaat)</small>"}
      <input type="text" name="doel" value="${esc(c.doel || "")}" maxlength="300" placeholder="${lang ? "bv. Een camper waarmee we maanden kunnen rondreizen" : "bv. Auto genoeg omgebouwd om deze zomer als camper naar Spanje te gaan"}"></label>
    ${!lang && ouders.length ? `<label class="veld">Onderdeel van <small class="hint">(tussendoel van een langlopend project)</small><select name="ouder"><option value="">— staat op zichzelf —</option>${ouders.map(p => `<option value="${p.id}" ${p.id === c.ouder ? "selected" : ""}>${pIcoon(p)} ${esc(p.titel)}</option>`).join("")}</select></label>` : ""}
    ${lang ? `<div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">🏁 Tussendoelen (deelprojecten)</div>
      <div class="lijst">${deel.map(dp => { const v = projectVoortgang(dp), dl = doelDatum(dp);
        return `<button type="button" class="linkrij deelrij${dp.status === "klaar" ? " klaar" : ""}" data-deelopen="${dp.id}"><span>${dp.status === "klaar" ? "✓" : "🏁"}</span><span><b>${esc(dp.titel)}</b>${dp.doel ? `<small class="hint"> · ${esc(dp.doel)}</small>` : ""}</span>
          <span class="hint">${v.totaal ? `${v.klaar}/${v.totaal} taken` : "nog geen taken"}${dl ? ` · ${fmtDatum(dl)}` : ""}</span></button>`; }).join("") || `<div class="hint">Nog geen tussendoelen. Wat is een mooi, haalbaar eerste resultaat?</div>`}</div>
      <button type="button" class="knop klein" data-actie="tussendoel" style="margin-top:6px">＋ Tussendoel</button></div>` : ""}
  </div>`;
}
function openEditor(item, standaard = {}) {
  const nieuw = !item;
  const type = item?.type || standaard.type || "taak";
  const c = structuredClone(item || {
    type, titel: "", notitie: "", urgent: false, belangrijk: true, deadline: "", streef: "", schatting: 0, werkelijk: 0,
    status: "open", links: [], gedeeldMet: [], project: null, overzicht: actieveOverzichten().find(id => !overzicht(id)?.slot) || actieveOverzichten()[0],
    wie: [mijnId()], wachtOp: [], ...standaard,
  });
  if (type === "taak") { c.wie = [...wie(c)]; c.wachtOp ||= []; c.koersId = item ? koersVan(item)?.id || "" : standaard.koersId || ""; }
  if (c.project && !standaard.overzicht && nieuw) c.overzicht = project(c.project)?.overzicht || c.overzicht;
  const isProj = type === "project";
  if (isProj) { c.looptijd = c.looptijd === "lang" ? "lang" : "kort"; c.doel ||= ""; c.ouder ||= ""; }

  const teken = () => {
    const q = kwadrant(c);
    const v = isProj && !nieuw ? projectVoortgang(item) : null;
    const losse = isProj && !nieuw ? d().taken.filter(t => !t.project && t.status !== "klaar" && t.overzicht === c.overzicht) : [];
    dlg.innerHTML = `<form method="dialog" id="editForm">
    <div class="dkop"><span class="soort" style="color:${ovKleur(c.overzicht)}">${isProj ? pIcoon(c) + " Project" : "○ Taak"}</span>
      ${!nieuw && c.status === "klaar" ? `<span class="tag" style="color:var(--groen);border-color:var(--groen)">✓ afgerond</span>` : ""}
      <button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      ${isProj ? `<div class="titelrij"><button type="button" class="emojiknop" data-emoji="project" data-pemoji title="Icoon van het project (komt ook in je agenda)" aria-label="Icoon kiezen">${pIcoon(c)}</button>` : ""}
      <input class="grootTitel" type="text" name="titel" value="${esc(c.titel)}" placeholder="${isProj ? "Naam van het project" : "Wat moet er gebeuren?"}" required autofocus>
      ${isProj ? `${c.icoon ? `<button type="button" class="x" data-pemojiweg title="Terug naar de ruit">✕</button>` : ""}</div>
      <label class="veld">Korte naam voor in de agenda <small class="hint">(mag leeg; dan de hele naam)</small><input type="text" name="kort" value="${esc(c.kort || "")}" maxlength="40" placeholder="bv. Camper"></label>
      ${looptijdBlok(c, item)}` : ""}
      <div class="rij">
        <label class="veld">Lijst<select name="overzicht">${boom().filter(r => r.soort === "map" || !r.x.slot || r.x.id === c.overzicht).map(r => r.soort === "map"
          ? `<option disabled>${"\u2003".repeat(r.diepte)}${esc(r.x.icoon)} ${esc(r.x.naam)}</option>`
          : `<option value="${r.x.id}" ${r.x.id === c.overzicht ? "selected" : ""}>${"\u2003".repeat(r.diepte)}${esc(r.x.icoon)} ${esc(r.x.naam)}</option>`).join("")}</select></label>
        ${isProj ? "" : `<label class="veld">Project<select name="project"><option value="">— losse taak —</option>${projectOpties(c.project)}</select></label>`}
        <label class="veld">📍 Locatie<select name="locatie">${(() => { const volg = locatie(effectieveLocatie({ ...c, locatie: "" }));
          return `<option value="">${volg ? "Zoals " + (c.project && !isProj ? "project/" : "") + "lijst: " + esc(volg.naam) : "Geen vaste plek"}</option>` +
            d().locaties.map(l => `<option value="${l.id}" ${l.id === c.locatie ? "selected" : ""}>${esc(l.icoon)} ${esc(l.naam)}${l.reistijd ? ` (${l.reistijd} min)` : ""}</option>`).join(""); })()}</select></label>
      </div>
      ${isProj ? "" : wieBlok(c)}
      ${isProj && c.looptijd === "lang" ? "" : `<div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Urgent / belangrijk</div>
        <div class="minimatrix">${["doen", "plannen", "delegeren", "schrappen"].map(k => `<button type="button" data-q="${k}" style="--qk:${qKleur(k)}" aria-pressed="${k === q}"><b style="color:${qKleur(k)}">${KWADRANTEN[k].naam}</b><small>${KWADRANTEN[k].sub}</small></button>`).join("")}</div></div>`}
      ${isProj && c.looptijd === "lang" ? "" : `<div class="rij">
        <label class="veld" title="Wanneer het absoluut af moet zijn">⏰ Deadline (moet echt af)<input type="date" name="deadline" value="${c.deadline || ""}"></label>
        <label class="veld" title="Wanneer jij het af wilt hebben: eerder voor marge, of later als de deadline niet haalbaar is. Het inplannen mikt hierop.">🎯 Streefdatum (wanneer jij het af wilt)<input type="date" name="streef" value="${c.streef || ""}"></label>
        <label class="veld">Geschatte tijd<input type="text" name="schatting" value="${fmtDuur(c.schatting)}" placeholder="bv. 1u30"></label>
        <label class="veld">Werkelijke tijd<input type="text" name="werkelijk" value="${fmtDuur(c.werkelijk)}" placeholder="achteraf"></label>
      </div>`}
      ${!nieuw && c.status === "klaar" ? `<div class="rij"><label class="veld">✓ Afgerond op<input type="datetime-local" name="klaarOp" value="${lokaalDT(c.klaarOp || new Date())}"></label>
        ${c.klaarDoor && !isIk(c.klaarDoor) ? `<span class="hint" style="align-self:end">door ${esc(naamVanPersoon(c.klaarDoor, overzicht(c.overzicht)))}</span>` : ""}</div>` : ""}
      ${isProj ? "" : afhBlok(c, item)}
      ${isProj ? "" : koersBlok(c, item)}
      ${v && v.schatTaken ? `<div class="vergelijk">Som van de taken: ${fmtDuur(v.schatTaken)} geschat · ${fmtDuur(v.werkelijk) || "0"} besteed · ${v.klaar}/${v.totaal} klaar</div>` : ""}
      <label class="veld">Notitie<textarea name="notitie" placeholder="Context, afspraken, volgende stap…">${esc(c.notitie)}</textarea></label>

      <div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Mails &amp; links</div>
        <div class="lijst" id="links">${(c.links || []).map((l, i) => { const inf = linkInfo(l.url); return `<div class="linkrij"><span>${esc(inf.icoon)}</span><a href="${esc(veiligeUrl(l.url) || "#")}" target="_blank" rel="noopener noreferrer">${esc(l.label || inf.label)}</a><span class="hint">${esc(inf.label)}</span><button type="button" class="x" data-linkweg="${i}" aria-label="Verwijderen">✕</button></div>`; }).join("")}
        <div class="linkrij"><span>🔗</span><input type="url" id="nieuweLink" placeholder="Plak link van een mail (Gmail/Outlook), document…"><input type="text" id="nieuwLabel" placeholder="omschrijving (optioneel)" style="max-width:180px"><button type="button" class="knop klein" data-actie="linkBij">Koppel</button></div></div></div>

      ${isProj ? (nieuw ? `<label class="veld">Opdelen in taken — één per regel, optioneel met ~duur<textarea name="opdeling" placeholder="Slides opzetten ~2u&#10;Testopstelling controleren ~1u30&#10;Generale repetitie ~1u"></textarea></label>`
        : `<div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">${c.looptijd === "lang" ? "Losse taken in dit project <small class=\"hint\">(doorlopend werk; wat bij een tussendoel hoort, zet je in dat deelproject)</small>" : "Taken in dit project"}</div>
          <div class="lijst subtaken">${takenVan(item.id).sort((a, b) => (a.status === "klaar") - (b.status === "klaar") || prioriteit(b) - prioriteit(a)).map(t => `<div class="item ${t.status === "klaar" ? "klaar" : ""}" data-sub="${t.id}" style="--ok:${ovKleur(t.overzicht)}">
            <button class="vink" type="button" data-subvink="${t.id}">${t.status === "klaar" ? "✓" : ""}</button><div class="ibody"><div class="ititel">${esc(t.titel)}</div><div class="imeta">${qTag(t)}${datumTags(t)}</div></div>${duurTekst(t)}
            ${t.status === "klaar" ? "" : `<button type="button" class="x" data-subplan="${t.id}" title="Inplannen">📅</button>`}
            <button type="button" class="x" data-loskoppel="${t.id}" title="Uit project halen (taak blijft bestaan)">⤴</button></div>`).join("")}
          <div class="linkrij"><span>＋</span><input type="text" id="subNieuw" placeholder="Nieuwe taak in dit project… (~duur mag)"><button type="button" class="knop klein" data-actie="subBij">Toevoegen</button><button type="button" class="knop klein" data-actie="subBijPlan" title="Toevoegen en meteen inplannen">📅</button></div>
          ${losse.length ? `<div class="linkrij"><span>⤵</span><select id="subKoppel"><option value="">Bestaande losse taak toevoegen…</option>${losse.map(t => `<option value="${t.id}">${esc(t.titel)}</option>`).join("")}</select><button type="button" class="knop klein" data-actie="subKoppel">Koppel</button></div>` : ""}
          </div></div>`) : ""}

      ${(() => { const o = overzicht(c.overzicht), n = andereLeden(o).length + 1;
        return `<div class="hint">👥 ${n > 1 ? `Gedeeld via de lijst „${esc(o.naam)}” met ${n - 1} ${n === 2 ? "ander" : "anderen"}.` : `Samenwerken? Deel de lijst „${esc(o?.naam || "")}” via Instellingen → Lijsten, of zet dit in een gedeelde lijst.`}</div>`; })()}
    </div>
    <div class="dvoet">
      ${nieuw ? "" : `<button type="button" class="knop gevaar" data-actie="weg">Verwijderen</button>`}
      ${!nieuw && !isProj && c.project ? `<button type="button" class="knop" data-actie="uitProject">⤴ Uit project</button>` : ""}
      <div class="rechts">
        ${c.status === "klaar" || (!nieuw && isProj && takenVan(item.id).some(t => t.status !== "klaar")) || (nieuw && isProj) || (isProj && c.looptijd === "lang") ? "" : `<button type="button" class="knop" data-actie="inplannen" title="${nieuw ? "Toevoegen en meteen een moment kiezen" : "Zelf een moment kiezen"}, met voorstellen op basis van je beschikbaarheid">📅 ${nieuw ? "Toevoegen en inplannen" : "Inplannen"}</button>`}
        ${nieuw ? "" : c.status === "klaar" ? `<button type="button" class="knop" data-actie="heropen">Heropenen</button>` : `<button type="button" class="knop" data-actie="klaar">✓ Afronden</button>`}
        <button class="knop prim" value="ok">${nieuw ? "Toevoegen" : "Opslaan"}</button></div>
    </div></form>`;
  };

  // concept bijwerken uit formuliervelden (zodat hertekenen niets kwijtraakt)
  const lees = () => {
    const f = $("#editForm"); if (!f) return;
    c.titel = f.titel.value.trim(); c.overzicht = f.overzicht.value; c.notitie = f.notitie.value;
    if (f.deadline) { c.deadline = f.deadline.value; c.streef = f.streef.value; } c.locatie = f.locatie.value;
    const ks = $("[name=koers]", f); if (ks) c.koersId = ks.value;
    if (f.klaarOp?.value) c.klaarOp = new Date(f.klaarOp.value).toISOString();
    if (!isProj) { const geldig = new Set(personen(overzicht(c.overzicht)).map(p => p.id)); c.wie = c.wie.filter(x => isIk(x) || geldig.has(x)); }
    if (f.schatting) { c.schatting = leesDuur(f.schatting.value); c.werkelijk = leesDuur(f.werkelijk.value); }
    if (f.project) c.project = f.project.value || null;
    const kf = $("[name=kort]", f); if (kf) c.kort = kf.value.trim().slice(0, 40);
    const df = $("[name=doel]", f); if (df) c.doel = df.value.trim().slice(0, 300);
    const of = $("[name=ouder]", f); if (of) c.ouder = of.value;
  };
  let gemaakt = null;                                          // bij een nieuwe taak: wat er net is aangemaakt
  const opslaan = () => {
    lees();
    if (!c.titel) { $("#editForm").titel.focus(); return false; }
    const opdeling = $("#editForm").opdeling?.value || "";
    const velden = { titel: c.titel, overzicht: c.overzicht, notitie: c.notitie, deadline: c.deadline, streef: c.streef, schatting: c.schatting,
                     werkelijk: c.werkelijk, urgent: c.urgent, belangrijk: c.belangrijk, links: c.links, gedeeldMet: c.gedeeldMet, locatie: c.locatie || "" };
    if (!isProj) { velden.wie = c.wie; velden.wachtOp = c.wachtOp; }
    else {
      velden.icoon = c.icoon || ""; velden.kort = c.kort || ""; velden.looptijd = c.looptijd; velden.doel = c.doel || "";
      const o = c.looptijd === "kort" && c.ouder ? project(c.ouder) : null;
      velden.ouder = isLang(o) && o.id !== item?.id ? o.id : "";
      if (velden.ouder) velden.overzicht = o.overzicht;                // een tussendoel hoort in dezelfde lijst als het grote project
      if (c.looptijd === "lang") { velden.deadline = ""; velden.streef = ""; }
    }
    if (!nieuw && c.status === "klaar" && c.klaarOp) velden.klaarOp = c.klaarOp;
    if (nieuw) {
      if (isProj) {
        const p = nieuwProject(velden); gemaakt = p;
        opdeling.split("\n").map(s => s.trim()).filter(Boolean).forEach(r => {
          const m = r.match(/~\s*(\S+)/);
          nieuweTaak({ titel: r.replace(/~\s*\S+/, "").trim(), schatting: m ? leesDuur(m[1]) : 0, project: p.id, overzicht: p.overzicht, urgent: p.urgent, belangrijk: p.belangrijk });
        });
        toast(`Project „${p.titel}” aangemaakt`);
      } else { const t = nieuweTaak({ ...velden, project: c.project }); gemaakt = t; if (c.koersId) { koppelKoers(t, c.koersId); bewaar(); } toast("Taak toegevoegd"); if (!inplannenNa) naDoen(t, false); }
    } else {
      if (!isProj) { velden.project = c.project; if (c.project) velden.overzicht = project(c.project)?.overzicht || c.overzicht; }
      if (isProj && velden.overzicht !== item.overzicht) {
        takenVan(item.id).forEach(t => t.overzicht = velden.overzicht);
        deelprojecten(item.id).forEach(dp => { dp.overzicht = velden.overzicht; takenVan(dp.id).forEach(t => t.overzicht = velden.overzicht); });
      }
      if (isProj && velden.looptijd === "kort" && deelprojecten(item.id).length) {
        const n = deelprojecten(item.id).length; deelprojecten(item.id).forEach(dp => dp.ouder = "");
        toast(`${n} ${n === 1 ? "deelproject staat" : "deelprojecten staan"} nu los (alleen een langlopend project heeft deelprojecten)`);
      }
      if (!isProj && (koersVan(item)?.id || "") !== (c.koersId || "")) { if (c.koersId) koppelKoers(item, c.koersId); else d().koers.forEach(a => a.taken = a.taken.filter(x => x !== item.id)); }
      const wasDoen = kwadrant(item) === "doen";
      const oudeTitels = new Map(d().planning.map(b => [b.id, b.titel]));
      werkBij(item, velden);
      naDoen(item, wasDoen);
      // nieuwe naam of icoon: blokken die al in je agenda staan meteen bijwerken
      const anders = d().planning.filter(b => d().extern?.[b.id] && oudeTitels.has(b.id) && oudeTitels.get(b.id) !== b.titel).map(b => b.id);
      if (anders.length) agendaBij(anders);
    }
    return true;
  };

  teken();
  dlg.onclick = (e) => {
    const b = e.target.closest("button,[data-q]"); if (!b) return;
    if (b.dataset.pemoji !== undefined) { lees(); kiesEmoji(b, { naam: c.titel, soort: "project", huidig: c.icoon || "" }, (v) => { c.icoon = v; teken(); }); return; }
    if (b.dataset.pemojiweg !== undefined) { lees(); c.icoon = ""; teken(); return; }
    if (b.dataset.looptijd) { lees(); c.looptijd = b.dataset.looptijd; if (c.looptijd === "lang") c.ouder = ""; teken(); return; }
    if (b.dataset.deelopen || b.dataset.actie === "tussendoel") {
      if (!opslaan()) return;
      const ouder = item || gemaakt, dp = b.dataset.deelopen ? project(b.dataset.deelopen) : null;
      dlg.returnValue = "";
      naSluiten(dlg, () => dp ? openEditor(dp) : openEditor(null, { type: "project", looptijd: "kort", ouder: ouder.id, overzicht: ouder.overzicht, urgent: false, belangrijk: true }));
      return;
    }
    if (b.dataset.koerstip) { lees(); c.koersId = b.dataset.koerstip; teken(); return; }
    if (b.dataset.koersnee) { lees(); afspraak(b.dataset.koersnee)?.nee.push(item.id); bewaar(); $("#koersTip").innerHTML = koersTip(c, item); return; }
    if (b.dataset.wie !== undefined) {
      lees(); const id = b.dataset.wie;
      if (!id) c.wie = [];
      else if (isIk(id)) c.wie = c.wie.some(isIk) ? c.wie.filter(x => !isIk(x)) : [mijnId(), ...c.wie];
      else c.wie = c.wie.includes(id) ? c.wie.filter(x => x !== id) : [...c.wie, id];
      teken(); return;
    }
    if (b.dataset.depweg) { lees(); c.wachtOp = c.wachtOp.filter(x => x !== b.dataset.depweg); teken(); return; }
    if (b.dataset.actie === "persoonBij") {
      const o = overzicht($("#editForm").overzicht.value), n = prompt(`Naam van iemand zonder Tijdkompas, toe te voegen aan „${o.naam}”:`, "")?.trim();
      if (!n) return; lees();
      if (!(o.mensen || []).includes(n)) { o.mensen = [...(o.mensen || []), n]; bewaar(); }
      c.wie = [...c.wie.filter(x => x !== "~" + n), "~" + n]; teken(); return;
    }
    const q = b.dataset.q;
    if (q) { lees(); Object.assign(c, { urgent: KWADRANTEN[q].urgent, belangrijk: KWADRANTEN[q].belangrijk }); teken(); return; }
    const a = b.dataset.actie;
    if (a === "linkBij") {
      const url = $("#nieuweLink").value.trim(); if (!url) return;
      const veilig = veiligeUrl(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : "https://" + url);
      if (!veilig) { toast("Alleen gewone webadressen (https://…) of mailto:-links"); return; }
      lees(); c.links = [...(c.links || []), { url: veilig, label: $("#nieuwLabel").value.trim() }]; teken();
    } else if (b.dataset.linkweg != null) { lees(); c.links.splice(+b.dataset.linkweg, 1); teken(); }
    else if (a === "deelBij") {
      const m = $("#deelMail").value.trim(); if (!/^\S+@\S+\.\S+$/.test(m)) { toast("Vul een geldig e-mailadres in"); return; }
      lees(); c.gedeeldMet = [...new Set([...(c.gedeeldMet || []), m.toLowerCase()])]; teken();
    } else if (b.dataset.deelweg != null) { lees(); c.gedeeldMet.splice(+b.dataset.deelweg, 1); teken(); }
    else if (a === "subBij") {
      const r = $("#subNieuw").value.trim(); if (!r) return; lees();
      const m = r.match(/~\s*(\S+)/);
      nieuweTaak({ titel: r.replace(/~\s*\S+/, "").trim(), schatting: m ? leesDuur(m[1]) : 0, project: item.id, overzicht: item.overzicht, urgent: c.urgent, belangrijk: c.belangrijk });
      teken(); $("#subNieuw").focus();
    } else if (a === "subBijPlan") {
      const r = $("#subNieuw").value.trim(); if (!r) return; lees();
      const m = r.match(/~\s*(\S+)/);
      const t = nieuweTaak({ titel: r.replace(/~\s*\S+/, "").trim(), schatting: m ? leesDuur(m[1]) : 0, project: item.id, overzicht: item.overzicht, urgent: c.urgent, belangrijk: c.belangrijk });
      teken(); planTaak(taak(t.id));
    } else if (b.dataset.subplan) { lees(); planTaak(taak(b.dataset.subplan)); }
    else if (a === "subKoppel") { const id = $("#subKoppel").value; if (id) { lees(); koppel(taak(id), item.id); teken(); } }
    else if (b.dataset.loskoppel) { lees(); koppel(taak(b.dataset.loskoppel), null); toast("Taak uit project gehaald — staat nu los"); teken(); }
    else if (b.dataset.subvink) { lees(); const t = taak(b.dataset.subvink); t.status === "klaar" ? heropen(t) : vraagAfronden(t, teken); teken(); }
    else if (a === "uitProject") { lees(); c.project = null; if (opslaan()) { dlg.close(); toast("Taak staat nu los"); } }
    else if (a === "weg") {
      const extra = isProj && takenVan(item.id).length ? `\nDe ${takenVan(item.id).length} taken blijven bestaan als losse taken.` : "";
      if (confirm(`„${item.titel}” verwijderen?${extra}`)) { verwijder(item); dlg.close(); toast("Verwijderd"); }
    } else if (a === "klaar") { if (opslaan()) { dlg.close(); vraagAfronden(item); } }
    else if (a === "inplannen") { inplannenNa = true; if (opslaan()) { const x = item || gemaakt; dlg.close(); if (x) planTaak(x.type === "project" ? project(x.id) : taak(x.id)); } inplannenNa = false; }
    else if (a === "heropen") { if (opslaan()) { heropen(item); dlg.close(); } }
  };
  dlg.oninput = (e) => { if ((e.target.name === "titel" || e.target.name === "notitie") && $("#koersTip")) { lees(); $("#koersTip").innerHTML = koersTip(c, item); } };
  dlg.onchange = (e) => {
    if (e.target.name === "koers") { lees(); $("#koersTip").innerHTML = koersTip(c, item); }
    else if (e.target.name === "overzicht") { lees(); teken(); }
    else if (e.target.id === "depKies" && e.target.value) { lees(); c.wachtOp = [...c.wachtOp, e.target.value]; teken(); }
  };
  dlg.onkeydown = (e) => {
    if (e.key !== "Enter" || e.target.tagName === "TEXTAREA") return;
    const id = e.target.id;
    if (id === "nieuweLink" || id === "nieuwLabel") { e.preventDefault(); $('[data-actie="linkBij"]', dlg).click(); }
    else if (id === "deelMail") { e.preventDefault(); $('[data-actie="deelBij"]', dlg).click(); }
    else if (id === "subNieuw") { e.preventDefault(); $('[data-actie="subBij"]', dlg).click(); }
  };
  dlg.onclose = () => { if (dlg.returnValue === "ok") opslaan(); dlg.onclose = null; dlg.onclick = null; dlg.onchange = null; dlg.oninput = null; };
  dlg.onsubmit = (e) => { if (e.submitter?.value === "ok") { lees(); if (!c.titel) { e.preventDefault(); return; } } };
  dlg.returnValue = "";
  dlg.showModal();
}

// datetime-local wil lokale tijd zonder zone: 2026-11-16T14:05
const lokaalDT = (x) => { const t = new Date(x); return `${dagStr(t)}T${fmtTijd(t.toISOString())}`; };
// Gewerkte tijd: een kaal getal is hier uren ("1,5" = 1u30), anders zoals overal ("45m", "1u15")
const leesUren = (s) => /^\s*\d+([.,]\d+)?\s*$/.test(String(s || "")) ? Math.round(parseFloat(String(s).replace(",", ".")) * 60) : leesDuur(s);

// Wie doet het? Meerdere mag; niemand gekozen = de hele groep. Iedereen in de lijst kan altijd meedoen of afvinken.
function wieBlok(c) {
  const o = overzicht(c.overzicht), pers = personen(o), w = c.wie || [];
  const aan = (p) => p.ik ? w.some(isIk) : w.includes(p.id);
  return `<div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">👤 Wie doet het?</div>
    <div class="chips wiechips">
      ${pers.length > 1 ? `<button type="button" data-wie="" aria-pressed="${!w.length}" title="Niet verdeeld: iemand uit de groep pakt het op">👥 Hele groep</button>` : ""}
      ${pers.map(p => `<button type="button" data-wie="${esc(p.id)}" aria-pressed="${aan(p)}" ${p.lid || p.ik ? "" : `title="Gebruikt geen Tijdkompas"`}>${p.ik ? "🙋 Ik" : esc(p.naam)}</button>`).join("")}
      <button type="button" class="plus" data-actie="persoonBij" title="Iemand zonder Tijdkompas toevoegen aan deze lijst">＋ persoon</button>
    </div>
    ${pers.length > 1 ? `<div class="hint" style="margin-top:4px">Meerdere mag. Ook als het van een ander is, blijft de groep verantwoordelijk: iedereen kan meedoen (🙋 Ik) of het afvinken. De planner plant alleen wat (ook) van jou is.</div>` : ""}</div>`;
}
// Afhankelijkheden: waar wacht deze taak op, en wie wacht erop?
function afhBlok(c, item) {
  const deps = (c.wachtOp || []).map(taak).filter(Boolean);
  const kan = d().taken.filter(t => t.status !== "klaar" && t.id !== item?.id && !c.wachtOp.includes(t.id) && !(item && maaktKring(item.id, t.id)));
  const groepen = [overzicht(c.overzicht), ...lijstVolgorde().filter(o => o.id !== c.overzicht)].filter(Boolean)
    .map(o => [o, kan.filter(t => t.overzicht === o.id)]).filter(([, l]) => l.length);
  const info = (t) => [wie(t).every(isIk) ? "" : "👤 " + wieTekst(t), t.status === "klaar" ? "✅ klaar" : t.gepland ? "📅 " + fmtDatum(dagStr(new Date(t.gepland.van))) : "nog niet ingepland",
                       t.deadline ? "⏰ " + fmtDatum(t.deadline) : ""].filter(Boolean).join(" · ");
  const wachters = item ? wachtenOp(item) : [];
  return `<div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">⛓ Wacht op</div>
    <div class="lijst">${deps.map(t => `<div class="linkrij"><span>${t.status === "klaar" ? "✅" : "⛓"}</span><span>${esc(t.titel)}</span><span class="hint">${esc(info(t))}</span>
        <button type="button" class="x" data-depweg="${t.id}" aria-label="Niet meer op wachten">✕</button></div>`).join("")}
      ${groepen.length ? `<div class="linkrij"><span>＋</span><select id="depKies"><option value="">Kan pas als een andere taak klaar is…</option>
        ${groepen.map(([o, l]) => `<optgroup label="${esc(o.icoon + " " + o.naam)}">${l.sort((a, b) => a.titel.localeCompare(b.titel)).map(t => `<option value="${t.id}">${esc(t.titel)}${wie(t).every(isIk) ? "" : " — " + esc(wieTekst(t))}</option>`).join("")}</optgroup>`).join("")}</select></div>` : ""}</div>
    ${wachters.length ? `<div class="hint" style="margin-top:6px">⏳ Hierop wacht: ${wachters.map(t => `„${esc(t.titel)}” (${esc(wieTekst(t))})`).join(", ")}</div>` : ""}</div>`;
}

// "Klaar!" — wanneer, en (als je wilt) hoeveel tijd het kostte
function vraagAfronden(item, na) {
  const s = item.schatting || 0;
  const opties = s ? [[s, "zoals geschat"], [Math.round(s * 1.5 / 5) * 5, "×1,5"], [s * 2, "×2"], [Math.round(s * 0.5 / 5) * 5, "de helft"]] : [[15, ""], [30, ""], [60, ""], [120, ""]];
  const verder = wachtenOp(item).filter(x => wachtNogOp(x).every(y => y.id === item.id));
  const ks = item.type === "taak" ? koersSuggesties(item)[0] : null;
  const vk = isMijn(item) ? vrijkomend(item) : null;            // eerder klaar dan gepland? dan komt er tijd vrij
  dlg2.innerHTML = `<form method="dialog"><div class="dkop"><h2>✓ Afronden: ${esc(item.titel)}</h2><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <div class="rij"><label class="veld">Afgerond op<input type="datetime-local" id="klaarOp" value="${lokaalDT(new Date())}"></label>
        <label class="veld">Gewerkte tijd <small class="hint">(mag leeg)</small><input type="text" id="werkInv" value="${item.werkelijk ? fmtDuur(item.werkelijk) : ""}" placeholder="bv. 1,5 (uur) of 45m"></label></div>
      <div class="chips">${opties.map(([m, n]) => `<button type="button" data-m="${m}">${fmtDuur(m)}${n ? ` <small class="hint">${n}</small>` : ""}</button>`).join("")}</div>
      <p class="hint" style="margin:0">Hoeft niet. Vul je het in, dan leert Tijdkompas hoe goed je schat en plant het een volgende keer realistischer.${s ? ` Geschat was ${fmtDuur(s)}.` : ""}</p>
      ${ks ? `<label class="schakel"><input type="checkbox" id="koersMee"> 🎯 Meetellen voor koersafspraak „${esc(ks.titel)}”</label>` : ""}
      ${verder.length ? `<p class="hint" style="margin:0">🔓 Hierna kan verder: ${verder.map(t => `„${esc(t.titel)}” (${esc(wieTekst(t))})`).join(", ")}</p>` : ""}</div>
    <div class="dvoet"><div class="rechts"><button class="knop prim" value="ok">✓ Afronden</button></div></div></form>`;
  dlg2.onclick = (e) => { const b = e.target.closest("[data-m]"); if (b) $("#werkInv").value = fmtDuur(+b.dataset.m); };
  dlg2.onclose = () => {
    if (dlg2.returnValue === "ok") {
      const op = $("#klaarOp").value ? new Date($("#klaarOp").value) : new Date();
      if (ks && $("#koersMee")?.checked) koppelKoers(item, ks.id);
      rondAf(item, leesUren($("#werkInv").value) || null, isNaN(op) ? new Date() : op);
      toast(verder.length ? `Afgerond ✓ — „${verder[0].titel}” kan nu verder` : "Mooi! Afgerond ✓");
      if (vk) { dlg2.onclose = null; dlg2.onclick = null; setTimeout(() => vrijeTijdVenster(item, vk, na), 0); return; }
    }
    dlg2.onclose = null; na?.();
  };
  dlg2.returnValue = "";
  dlg2.showModal();
}

// Na verplaatsen van een lijst of map: koersafspraken meenemen naar de map, en delen zoals de nieuwe map
function verhuisd(x, naar, van) {
  if (!naar || naar === van) return;
  const doel = map(naar), isLijst = !!overzicht(x.id) && overzicht(x.id) === x;
  if (isLijst) {
    const ks = d().koers.filter(k => k.doel?.soort === "lijst" && k.doel.id === x.id);
    if (ks.length && confirm(`${ks.length === 1 ? "De koersafspraak" : ks.length + " koersafspraken"} van „${x.naam}” ${ks.length === 1 ? "hoort" : "horen"} nu bij deze lijst.\n\nVoortaan koppelen aan de hele map „${doel.naam}”?\n(OK = hele map, Annuleren = alleen deze lijst)`))
      ks.forEach(k => k.doel = { soort: "map", id: naar });
    if (actief && lijstenOnder(naar).some(i => i !== x.id && actief.includes(i)) && !actief.includes(x.id)) { actief.push(x.id); voorkeur.zet("actief", actief); }
  }
  const deel = deelVan(naar);
  if (deel && ingelogd() && !x.opslag && !gelinkteInfo(x)) {          // delen van andermans (gelinkte) lijst: alleen vanuit dat account
    const nieuw = [...(deel.leden || []), ...(deel.uitgenodigd || [])].filter(u => !(x.leden || []).includes(u) && !(x.uitgenodigd || []).includes(u));
    if (nieuw.length && confirm(`Map „${deel.naam}” is gedeeld. „${x.naam}” ook delen met de mensen in die map?`))
      for (const y of isLijst ? [x] : [x, ...mappenOnder(x.id).map(map), ...lijstenOnder(x.id).map(overzicht)]) if (!y.opslag) erfDelen(y, deel);
  }
}

// Nieuwe lijst of map, ook vanuit ＋ bovenin en het mapmenu
const LIJSTKLEUREN = ["#d8a24e", "#6fb38a", "#6f9fd8", "#c48ed8", "#d87a6f", "#5fb8b0", "#b8b05f", "#8a978e"];
// Een lijst verwijderen: eerst kiezen wat er met de inhoud gebeurt (naar een andere lijst, naar een nieuwe lijst, of weg).
// In de cloud gaan daarna ook alle taken en gedeelde koersafspraken van die lijst echt weg (niets blijft zweven).
function lijstVerwijderen(o) {
  const items = [...d().taken, ...d().projecten].filter(x => x.overzicht === o.id);
  const koersHier = d().koers.filter(k => k.doel?.soort === "lijst" && k.doel.id === o.id);
  const gedeeldK = koersHier.filter(k => k.gedeeld), eigenK = koersHier.filter(k => !k.gedeeld);
  const tl = takenlijstVan(o.id), tlx = tl && d().takenlijsten[tl], anderen = andereLeden(o).length;
  const doelen = d().overzichten.filter(x => x !== o && !x.slot && !(ingelogd() && gelinkteInfo(x)));
  const tlTekst = tlx ? `<p class="hint">De takenlijst „${esc(tlx.naam)}” in ${tlx.accountSoort === "ms" ? "Microsoft To Do" : "Google Taken"} blijft bestaan; hij wordt alleen losgekoppeld.</p>` : "";
  const deelTekst = anderen ? `<p class="hint">⚠️ Deze lijst is gedeeld: ook ${anderen === 1 ? "het andere lid ziet" : `de ${anderen} andere leden zien`} hem en de taken erin daarna niet meer.</p>` : "";
  const wegHalen = (naar) => {
    if (tl) koppelTakenlijst(tl, "");          // eerst loskoppelen, zodat de taken in Google/Microsoft blijven staan
    if (naar) {
      for (const x of items) { x.overzicht = naar.id; delete x.ext; }
      for (const b of d().planning) if (b.overzicht === o.id) b.overzicht = naar.id;
      for (const k of koersHier) { k.doel = { soort: "lijst", id: naar.id }; if (k.gedeeld && naar.opslag) k.gedeeld = false; }
    } else {
      d().taken = d().taken.filter(t => t.overzicht !== o.id); d().projecten = d().projecten.filter(p => p.overzicht !== o.id);
      d().planning = d().planning.filter(b => b.overzicht !== o.id);
      d().koers = d().koers.filter(k => !gedeeldK.includes(k));      // afspraken van de groep gaan mee weg
      for (const k of eigenK) k.doel = o.map ? { soort: "map", id: o.map } : { soort: "", id: "" };   // je eigen afspraken blijven
    }
    lijstWeg(o.id);
    d().overzichten = d().overzichten.filter(x => x !== o);
    if (actief) { actief = actief.filter(x => x !== o.id); voorkeur.zet("actief", actief.length ? actief : null); if (!actief.length) actief = null; }
    bewaar();
    toast(naar ? `Lijst „${o.naam}” verwijderd — de inhoud staat nu in „${naar.naam}”` : `Lijst „${o.naam}” en alles erin verwijderd`);
    if (instOpen && instOpen === o.id) dlg3.close();
  };
  if (!items.length && !koersHier.length) {
    if (confirm(`Lijst „${o.naam}” verwijderen? Hij is leeg.${tlx ? `\nDe takenlijst „${tlx.naam}” blijft gewoon bestaan; hij wordt alleen losgekoppeld.` : ""}${anderen ? "\nDe andere leden zien hem daarna ook niet meer." : ""}`)) wegHalen(null);
    return;
  }
  const inhoud = [items.length ? `${items.length} ${items.length === 1 ? "taak/project" : "taken en projecten"}` : "", koersHier.length ? `${koersHier.length} ${koersHier.length === 1 ? "koersafspraak" : "koersafspraken"}` : ""].filter(Boolean).join(" en ");
  dlg2.innerHTML = `<form method="dialog" id="wegForm"><div class="dkop"><h2>🗑 Lijst „${esc(o.naam)}” verwijderen</h2><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <p>Er ${items.length + koersHier.length === 1 ? "staat" : "staan"} <b>${inhoud}</b> in deze lijst. Wat moet daarmee gebeuren?</p>
      ${doelen.length ? `<label class="keuzeregel"><input type="radio" name="wat" value="naar" checked> Verplaatsen naar
        <select name="naar">${doelen.map(x => `<option value="${esc(x.id)}">${esc(x.icoon)} ${esc(x.naam)}</option>`).join("")}</select></label>` : ""}
      <label class="keuzeregel"><input type="radio" name="wat" value="nieuw" ${doelen.length ? "" : "checked"}> Verplaatsen naar een nieuwe lijst:
        <input type="text" name="nieuwNaam" value="${esc(o.naam)} (bewaard)" maxlength="80"></label>
      <label class="keuzeregel gevaar"><input type="radio" name="wat" value="weg"> Alles definitief verwijderen
        <span class="hint">${gedeeldK.length ? `(ook ${gedeeldK.length} gedeelde koersafspraak${gedeeldK.length === 1 ? "" : "en"}; ` : "("}${eigenK.length ? `je ${eigenK.length} eigen koersafspraak${eigenK.length === 1 ? "" : "en"} blijven bestaan, zonder lijst)` : "kan niet ongedaan worden)"}</span></label>
      ${tlTekst}${deelTekst}
    </div>
    <div class="dvoet"><button class="knop" value="annuleer">Annuleren</button><div class="rechts"><button class="knop gevaar" value="ok">Lijst verwijderen</button></div></div></form>`;
  dlg2.onclose = () => {
    dlg2.onclose = null;
    if (dlg2.returnValue !== "ok") return;
    const f = $("#wegForm"), wat = $("input[name=wat]:checked", f)?.value || "weg";
    if (wat === "weg") { if (confirm(`Echt alles in „${o.naam}” verwijderen? Dit kan niet ongedaan worden.`)) wegHalen(null); return; }
    let naar = null;
    if (wat === "naar") { const sel = $("select[name=naar]", f); naar = overzicht(sel?.value || sel?.querySelector("option")?.getAttribute("value")); }
    if (wat === "nieuw" || !naar) {
      const naam = ($("input[name=nieuwNaam]", f)?.value || "").trim() || o.naam + " (bewaard)";
      naar = { id: uid() + (sessie.ik ? uid() : ""), naam, kleur: o.kleur, icoon: o.icoon, map: isIk(o.eigenaar) || !o.eigenaar ? o.map || "" : "", mensen: [], verdeling: "samen",
               modus: o.modus || "vrij", locatie: o.locatie || "", doelAgenda: o.doelAgenda ?? null, tijden: structuredClone(o.tijden || []) };
      const deel = ingelogd() && naar.map ? deelVan(naar.map) : null; if (deel) erfDelen(naar, deel);
      d().overzichten.push(naar);
      if (actief) { actief = [...actief, naar.id]; voorkeur.zet("actief", actief); }
    }
    wegHalen(naar);
  };
  dlg2.returnValue = ""; dlg2.showModal();
}
function nieuweLijst({ map: inMap = "", soort = "lijst" } = {}) {
  const vrijeKleur = LIJSTKLEUREN.find(k => !d().overzichten.some(o => o.kleur === k)) || LIJSTKLEUREN[d().overzichten.length % LIJSTKLEUREN.length];
  let icoon = "", zelfGekozen = false, naamTekst = "";
  const teken = () => {
    dlg2.innerHTML = `<form method="dialog" id="lijstForm"><div class="dkop"><h2>Nieuwe ${soort === "map" ? "map" : "lijst"}</h2><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <div class="segment" role="group" aria-label="Soort"><button type="button" data-soort="lijst" aria-pressed="${soort === "lijst"}">📋 Lijst</button><button type="button" data-soort="map" aria-pressed="${soort === "map"}">📁 Map</button></div>
      <div class="rij"><div class="veld" style="max-width:70px">Icoon<button type="button" class="emojiknop" data-emoji="nieuw" title="Icoon kiezen">${esc(icoon || (soort === "map" ? "📁" : "📋"))}</button><input type="hidden" name="icoon" value="${esc(icoon || (soort === "map" ? "📁" : "📋"))}"></div>
        <label class="veld" style="max-width:70px">Kleur<input type="color" name="kleur" value="${vrijeKleur}"></label>
        <label class="veld">Naam<input type="text" name="naam" value="${esc(naamTekst)}" placeholder="${soort === "map" ? "bv. Werk" : "bv. Werkgroep duurzaamheid"}" required autofocus></label></div>
      <label class="veld">In map${mapKeuze(inMap, new Set(), `name="map"`)}</label>
      ${soort === "lijst" ? `<div class="segment" role="group" aria-label="Verdeling">${Object.entries(VERDELING).map(([k, [n]]) => `<button type="button" data-verd="${k}" aria-pressed="${k === "samen"}">${n}</button>`).join("")}</div>
      <p class="hint" style="margin:0" id="verdUitleg">${VERDELING.samen[1]}</p>
      <p class="hint" style="margin:0">In een map neemt de lijst de tijden, locatie en doelagenda over van een andere lijst in die map; is de map gedeeld, dan wordt de lijst ook gedeeld. Alles is daarna aan te passen bij Instellingen → Mappen &amp; lijsten.</p>`
      : `<p class="hint" style="margin:0">Een map bevat lijsten en andere mappen. Deel je de map, dan gaat alles erin mee.</p>`}
    </div>
    <div class="dvoet"><div class="rechts"><button class="knop prim" value="ok">Maken</button></div></div></form>`;
  };
  teken();
  let verdeling = "samen";
  dlg2.onclick = (e) => {
    const so = e.target.closest("[data-soort]"), vd = e.target.closest("[data-verd]");
    const ek = e.target.closest("[data-emoji]");
    if (ek) { kiesEmoji(ek, { naam: $("[name=naam]", dlg2).value, soort, huidig: $("[name=icoon]", dlg2).value }, (v) => { icoon = v; zelfGekozen = true; ek.textContent = v; $("[name=icoon]", dlg2).value = v; }); return; }
    if (so && so.dataset.soort !== soort) { inMap = $("[name=map]", dlg2).value; naamTekst = $("[name=naam]", dlg2).value; if (!zelfGekozen) icoon = ""; soort = so.dataset.soort; teken(); }
    if (vd) { verdeling = vd.dataset.verd; $$("[data-verd]", dlg2).forEach(b => b.setAttribute("aria-pressed", b === vd)); $("#verdUitleg").textContent = VERDELING[verdeling][1]; }
  };
  dlg2.onclose = () => {
    dlg2.onclose = null;
    if (dlg2.returnValue !== "ok") return;
    const f = $("#lijstForm"), v = (n) => $(`[name=${n}]`, f).value, naam = v("naam").trim(); if (!naam) return;
    const inm = v("map"), id = uid() + (sessie.ik ? uid() : ""), deel = ingelogd() ? deelVan(inm) : null;
    if (soort === "map") {
      const m = { id, naam, icoon: v("icoon").trim() || "📁", kleur: v("kleur"), ouder: inm };
      if (deel) erfDelen(m, deel);
      d().mappen.push(m); bewaar(); toast(`Map „${naam}” gemaakt`); return;
    }
    const buur = lijstenOnder(inm).map(overzicht).find(o => o && !o.slot);
    const o = { id, naam, kleur: v("kleur"), icoon: v("icoon").trim() || "📋", map: inm, mensen: [], verdeling,
                modus: buur?.modus || "vrij", locatie: buur?.locatie || "", doelAgenda: buur?.doelAgenda ?? null, tijden: structuredClone(buur?.tijden || []) };
    if (deel) erfDelen(o, deel);
    d().overzichten.push(o);
    if (actief) { actief = [...actief, o.id]; voorkeur.zet("actief", actief); }
    bewaar(); toast(`Lijst „${naam}” gemaakt${deel ? ` en gedeeld zoals map „${deel.naam}”` : ""}`);
  };
  dlg2.onsubmit = (e) => { const f = $("#lijstForm"); if (f && e.submitter?.value === "ok" && !$("[name=naam]", f).value.trim()) e.preventDefault(); };
  // icoon volgt de naam zolang je zelf nog niets koos (Werk → 💼, Boot → ⛵ …)
  dlg2.oninput = (e) => {
    if (e.target.name !== "naam" || zelfGekozen || !$("#lijstForm")) return;
    const v = voorstellen(e.target.value, soort)[0], k = $("[data-emoji=nieuw]", dlg2);
    if (v && k) { k.textContent = v; $("[name=icoon]", dlg2).value = v; icoon = v; }
  };
  dlg2.returnValue = "";
  dlg2.showModal();
}

// ---------- wat speelt er in een periode? ----------
// "gepland" — er staat in de periode een blok voor
// "doen"    — Doen, en nog niet (helemaal) ingepland
// "gat"     — nog niet ingepland, en er is in de periode een echt vrij gat voor: minstens een uur, of (met een geschatte tijd)
//             minstens zo lang als die schatting. Zonder schatting geldt alleen het uur.
// null      — speelt niet (bijv. gepland op een andere dag, of geen ruimte)
function maakRelevant(van, tot) {
  const gatVan = new Date(Math.max(van, Date.now())), cache = new Map();
  const gat = (t) => {
    if (gatVan >= tot) return 0;
    const p = plekVan(t), k = `${t.overzicht}|${p.eigenLoc}|${p.loc}`;
    if (!cache.has(k)) cache.set(k, grootsteGat(t, gatVan, tot));
    return cache.get(k);
  };
  return (t) => {
    if (!t || t.status === "klaar") return null;
    if (d().planning.some(b => b.item === t.id && b.soort !== "reis" && new Date(b.start) < tot && new Date(b.eind) > van)) return "gepland";
    if (!isMijn(t) || doorGelinktIngepland(t)) return null;
    const st = planStatus(t);
    if (kwadrant(t) === "doen") return st.soort === "ja" ? null : "doen";
    if (st.soort !== "niet" || kwadrant(t) === "schrappen" || (t.type === "taak" && wachtNogOp(t).length)) return null;
    const drempel = t.schatting > 0 ? Math.min(60, t.schatting) : 60;
    return gat(t) >= drempel ? "gat" : null;
  };
}

// ---------- zelf inplannen: voorstellen op basis van je beschikbaarheid ----------
function projectRijPlan(p) {
  return `<div class="item${planKlasse(p)}" data-id="${p.id}" data-type="project" style="--ok:${ovKleur(p.overzicht)}"><span class="picoon" style="color:var(--ok)">${pIcoon(p)}</span>
    <div class="ibody"><div class="ititel">${esc(p.titel)}</div><div class="imeta">${planTag(p)}${qTag(p)}${datumTags(p)}</div></div>${duurTekst(p)}</div>`;
}
const dagKort = (x) => `${DAG[x.getDay()]} ${x.getDate()} ${MAAND[x.getMonth()]}`;
function planTaak(it) {
  if (!it) return;
  let minDuur = null, aantal = 16, melding = "", aanpas = null;   // aanpas: {dag, van, tot} van een voorstel dat je bijstelt
  let agendaKeuze = "";                                            // "" = standaard, een agenda, of "geen"
  let kijk = null, schuifMee = true, vsLaatst = [];
  const heeftDeadline = !!harde(it);
  let deadlineVoor = heeftDeadline;                                // deadline gaat voor: taken zonder (of met latere) deadline schuiven op
  let keuze = null;                                                // { start, duur, probleem } — wachten op jouw keuze bij een deadlineprobleem
  const isDoen = () => kwadrant(it) === "doen";                    // Doen gaat zonder pardon over lagere kwadranten heen (die schuiven op)
  // welke (wijkende) blokken staan er nu in een voorstel — om te laten zien wat er opschuift
  const staatEr = (v) => { const f = negeer(); return f ? d().planning.filter(b => b.item && b.item !== it.id && b.soort !== "reis" && b.soort !== "uitloop" && new Date(b.start) < v.b && new Date(b.eind) > v.a && f(b)) : []; };
  const negeer = () => isDoen() ? (b) => (b.item !== it.id && wijkbaar(b, it)) || (deadlineVoor && magWijkenVoor(it, b))
    : deadlineVoor ? (b) => magWijkenVoor(it, b) : null;                               // kijk: { dag, van, tot } voor het dagbeeld; schuifMee: andere taken wijken
  const kanAgenda = () => Object.entries(d().agendas || {}).some(([k, a]) => a.schrijf && verbindingVanBron(k));
  const R = raster();
  const opRaster = (m) => Math.ceil(m / R) * R;
  // opnieuw tekenen zonder dat het venster naar boven springt
  let eersteKeer = true;
  const teken = () => {
    const y = eersteKeer ? 0 : ($(".dlijf", dlg2)?.scrollTop || 0);
    tekenInhoud(); eersteKeer = false;
    const lijf = $(".dlijf", dlg2); if (lijf) lijf.scrollTop = y;
  };
  const tekenInhoud = () => {
    const s = planStatus(it), { ov, loc, reis } = plekVan(it), l = locatie(loc);
    if (!ov) { dlg2.close(); return; }
    if (minDuur == null) minDuur = Math.max(R, Math.min(voorkeur.lees("planMin", 60), opRaster(s.rest || s.nodig || 30)));
    const gelinkt = doorGelinktIngepland(it);
    const vs = it.status === "klaar" ? [] : planVoorstellen(it, minDuur, { aantal, negeer: negeer() }); vsLaatst = vs;
    const perDag = [];
    for (const v of vs) { const g = perDag.find(x => x.dag === v.dag); if (g) g.v.push(v); else perDag.push({ dag: v.dag, v: [v] }); }
    const dl = harde(it), doel = doelDatum(it);
    const waar = ov.modus === "vast" ? `binnen de vaste tijden van ${esc(ov.icoon)} ${esc(ov.naam)}` : "in je vrije tijd (beschikbaarheid min werk, reistijd en afspraken)";
    const morgen = new Date(Date.now() + 864e5);
    if (!kijk) { const v0 = vs[0]; kijk = v0 ? { dag: v0.dag, van: fmtTijd(v0.a.toISOString()), tot: fmtTijd(new Date(v0.a.getTime() + Math.min(v0.duur, opRaster(s.rest || 60)) * 60000).toISOString()) }
                          : { dag: dagStr(morgen), van: "09:00", tot: hhmm(9 * 60 + opRaster(Math.min(s.rest || 60, 240))) }; }
    const tijdIn = (naam, w) => `<input type="time" name="${naam}" value="${esc(w)}" step="300">`;
    dlg2.innerHTML = `<form method="dialog" id="planForm"><div class="dkop"><span class="soort" style="color:${ovKleur(it.overzicht)}">📅 Inplannen</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <h2 style="margin:0">${esc(it.titel)}</h2>
      <div class="hint">Vrije gaten ${waar}${l && l.id !== "thuis" ? ` · 📍 ${esc(l.naam)}${reis ? ` (${reis} min reizen heen en terug)` : ""}` : ""}${dl ? ` · ⏰ deadline ${fmtDatum(dl)}` : doel ? ` · 🎯 ${fmtDatum(doel)}` : ""}</div>
      <div class="planstand plvast pl-${s.soort}">${s.soort === "klaar" ? "✓ Afgerond" : `<div>Ingepland: <b>${fmtDuur(s.min) || "0"}</b> van <b>${fmtDuur(s.nodig) || "–"}</b>${s.rest ? ` · nog <b>${fmtDuur(s.rest)}</b>` : " ✓"}${it.schatting ? "" : ` <small class="hint">(geen schatting: 30 min aangenomen)</small>`}</div>
        <div class="balk"><i style="width:${Math.min(100, Math.round(100 * (s.min || 0) / Math.max(1, s.nodig || 1)))}%"></i></div>
        ${s.rest ? `<button type="button" class="knop klein prim" data-actie="pvul" title="De eerstvolgende vrije gaten (van minstens de lengte hieronder) vullen tot de geschatte tijd is ingepland">⚡ Vul automatisch tot ${fmtDuur(s.nodig)}</button>` : ""}`}</div>
      ${melding ? `<div class="hint" style="color:var(--groen)">${melding}</div>` : ""}
      ${s.blokken.length ? `<div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Staat ingepland</div><div class="lijst">${s.blokken.map(b =>
        `<div class="linkrij"><span>${b.vanFamilie ? "🔗" : b.vast ? "📌" : "⚡"}</span><span>${dagKort(new Date(b.start))} ${fmtTijd(b.start)}–${fmtTijd(b.eind)}</span><span class="hint">${b.vanFamilie ? "door je gelinkte account" : b.vast ? "vastgezet" : "automatisch"}</span>
          ${b.vanFamilie ? "" : `<button type="button" class="x" data-blokweg="${b.id}" title="Uit de planning halen">✕</button>`}</div>`).join("")}</div></div>` : ""}
      ${gelinkt ? `<div class="hint">🔗 Deze lijst hoort bij je gelinkte account. Wat je hier inplant, staat in de agenda die je hieronder kiest; je gelinkte account plant het dan niet nog eens.</div>` : ""}
      ${it.status === "klaar" ? "" : `
      ${isMijn(it) ? "" : `<div class="hint">👤 Toegewezen aan ${esc(wieTekst(it))}. Plan je hem zelf in, dan staat hij in jóuw agenda.</div>`}
      ${kwadrant(it) === "doen" ? `<div><button type="button" class="knop" data-actie="pvoorrang">⚡ Met voorrang: zo snel mogelijk (andere taken wijken)</button></div>` : ""}
      ${aanpas ? `<div class="aanpas paneel"><b>Blok aanpassen — ${dagKort(new Date(aanpas.dag + "T12:00"))}</b>
        <div class="rij" style="align-items:end"><label class="veld">Van${tijdIn("avan", aanpas.van)}</label><label class="veld">Tot${tijdIn("atot", aanpas.tot)}</label>
          <button type="button" class="knop prim" data-actie="aZet">Plaatsen</button><button type="button" class="knop" data-actie="aWeg">Annuleren</button></div>
        <span class="hint">Het vrije gat loopt van ${aanpas.gatVan} tot ${aanpas.gatTot}.</span></div>` : ""}
      ${kanAgenda() ? `<label class="veld">In welke agenda<select name="pagenda">${blokAgendaOpties(agendaKeuze, standaardAgenda({ item: it.id, overzicht: it.overzicht }), viaEigenaar({ item: it.id, overzicht: it.overzicht }))}</select></label>` : ""}
      ${!agendaKeuze && viaEigenaar({ item: it.id, overzicht: it.overzicht }) ? `<div class="hint">🔗 Deze lijst hoort bij ${esc(viaEigenaar({ item: it.id, overzicht: it.overzicht }).email || "je andere account")}: dat account zet het blok in zijn eigen agenda zodra Tijdkompas daar open is (op welk apparaat dan ook).</div>` : ""}
      ${keuze ? `<div class="paneel deadlinekeuze"><b>⚠️ Let op: dit gaat ten koste van een deadline</b>
        <div class="lijst" style="margin:6px 0">${keuze.probleem.map(p => `<div class="linkrij"><span>⏰</span><span>„${esc(p.item.titel)}” <span class="hint">— deadline ${fmtDatum(p.deadline)}, ${p.tot ? "zou pas klaar zijn " + fmtDatum(p.tot) : "past dan nergens meer"}</span></span></div>`).join("")}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="knop prim" data-actie="pkeuzeToch">Toch zo plannen</button><button type="button" class="knop" data-actie="pkeuzeNiet">Niet doen</button></div></div>` : ""}
      ${heeftDeadline ? `<label class="schakel"><input type="checkbox" id="pdeadline" ${deadlineVoor ? "checked" : ""}> ⏰ Deadline gaat voor: taken zonder deadline (of met een latere) schuiven op naar het volgende lege moment</label>` : ""}
      <div class="rij" style="align-items:end">
        <label class="veld" title="Alleen vrije gaten van minstens deze lengte worden voorgesteld">Gaten van minstens<input type="text" name="pmin" value="${fmtDuur(minDuur)}" style="max-width:110px"></label>
        <button type="button" class="knop klein" data-actie="pmin">Zoeken</button>
      </div>
      ${isDoen() ? `<div class="hint">⚡ Doen gaat voor: hieronder staan ook de momenten waar nu een taak uit een lager kwadrant staat (⏩). Die schuift door naar het volgende lege moment${plekGebonden(it) ? "; omdat deze taak op een vaste plek moet, wijken daar ook Doen-taken die overal kunnen" : ""}.</div>` : ""}
      <div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">${isDoen() ? "Momenten" : "Vrije gaten"} — klik om het hele gat te plannen; <b>rechtsklik of lang drukken</b> om het blok in te korten of te verschuiven</div>
        ${perDag.length ? `<div class="voorstellen">${perDag.map(g => `<div class="vdag"><button type="button" class="vdagknop" data-kijk="${g.dag}" title="Laat de agenda van deze dag zien">${fmtDatum(g.dag)} 👁</button>${g.v.map(v =>
          `<button type="button" class="voorstel${v.naDeadline ? " laat" : ""}" data-zet="${v.a.toISOString()}" data-tot="${v.b.toISOString()}" title="${v.naDeadline ? "Ná de deadline · " : ""}Klik: hele gat plannen · rechtsklik of lang drukken: aanpassen">${fmtTijd(v.a.toISOString())}–${fmtTijd(v.b.toISOString())}<small>${fmtDuur(v.duur)}${v.reis ? ` · 🚗 ${v.reis}m heen/terug` : ""}</small>${v.naDeadline ? "<small>na deadline</small>" : ""}${staatEr(v).length ? `<small class="vwijkt" title="Staat er nu; schuift door naar het volgende lege moment">⏩ ${staatEr(v).map(b => esc(String(b.titel || "").slice(0, 28))).join(", ")}</small>` : ""}</button>`).join("")}</div>`).join("")}</div>
          ${vs.length >= aantal ? `<button type="button" class="knop klein" data-actie="pmeer" style="margin-top:8px">Meer gaten tonen</button>` : ""}`
          : `<div class="leeg" style="padding:14px">Geen vrij gat van ${fmtDuur(minDuur)} of langer in de komende 4 weken ${waar}. Kies een kortere lengte, of kies hieronder zelf een moment.</div>`}
      </div>
      <div id="kieszelf"><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Of kies zelf — tik in de dag op een tijd, of vul hem in</div>
        <div class="rij" style="align-items:end"><label class="veld">Dag<input type="date" name="pdag" value="${kijk.dag}"></label>
          <label class="veld">Van${tijdIn("pvan", kijk.van)}</label><label class="veld">Tot${tijdIn("ptot", kijk.tot)}</label>
          <button type="button" class="knop" data-actie="pzelf">Hier plaatsen</button></div>
        <label class="schakel" style="margin-top:6px"><input type="checkbox" id="pschuif" ${schuifMee ? "checked" : ""}> Staan er andere taken? Die schuiven automatisch door naar het volgende lege moment</label>
        <div id="dagbeeld">${dagBeeld(kijk, it, schuifMee || isDoen())}</div></div>`}
      <p class="hint" style="margin:0">Blokken beginnen op een heel of half uur: eindigt een afspraak om kwart over, dan begin je om half (de rest is pauze). Afspraken die in je agenda op „vrij” staan tellen niet mee.
        Wat je hier plaatst wordt 📌 vastgezet: ⚡ Automatisch inplannen laat het staan en plant alleen de rest; het komt meteen in de gekozen agenda.</p>
    </div>
    <div class="dvoet"><div class="rechts"><button type="button" class="knop" data-actie="popen">Open ${it.type === "project" ? "project" : "taak"}</button><button class="knop prim" value="ok">Klaar</button></div></div></form>`;
  };
  // Plaats [start, eind); met een waarschuwing als het ergens mee botst
  const zet = (start, eind, controleer = true, forceer = false) => {
    const duur = Math.round((eind - start) / 60000);
    if (!(duur > 0)) { toast("De eindtijd moet na de begintijd liggen"); return; }
    if (eind <= new Date()) { toast("Dat moment is al voorbij"); return; }
    const bots = controleer && !forceer ? botsingen(it, start, eind, { blokkenMogenWijken: schuifMee || deadlineVoor || isDoen() }) : [];
    if (bots.length && !confirm(`Let op:\n• ${bots.join("\n• ")}\n\nToch hier plaatsen?`)) return;
    const rr = plaatsMetWijken(it, start, duur, agendaKeuze || undefined, { wijken: schuifMee || deadlineVoor || isDoen(), forceer: forceer || isDoen() });
    if (!rr.ok) { keuze = { start, duur, probleem: rr.probleem }; melding = ""; teken(); $(".deadlinekeuze", dlg2)?.scrollIntoView?.({ block: "nearest" }); return; }
    keuze = null;
    const r = rr, wijk = [...rr.geschoven, ...rr.niet], nietGepast = rr.niet;
    if (nietGepast.length) zetHerplan([...herplanIds(), ...nietGepast.map(e => e.blok.item).filter(Boolean)]);
    kijk = { dag: dagStr(start), van: fmtTijd(start.toISOString()), tot: fmtTijd(r.blok.eind) };
    const geschoven = wijk.filter(e => !nietGepast.includes(e));
    const doel = doelAgendaVan(r.blok), via = viaEigenaar(r.blok);
    melding = `✓ Ingepland: ${dagKort(start)} ${fmtTijd(start.toISOString())}–${fmtTijd(r.blok.eind)}${doel ? " · komt in " + esc(agendaNaam(doel)) : via ? " · komt in de agenda van " + esc(via.email || "je andere account") : ""}${r.vervallen ? ` · ${r.vervallen} automatisch ingepland${r.vervallen === 1 ? " blok" : "e blokken"} van deze taak vervangen` : ""}${geschoven.length ? ` · doorgeschoven: ${geschoven.map(e => `„${esc(e.blok.titel)}” → ${dagKort(new Date(e.blok.start))} ${fmtTijd(e.blok.start)}`).join(", ")}` : ""}${nietGepast.length ? ` · ${nietGepast.length} paste nergens (bij „Opnieuw in te plannen”)` : ""}${rr.probleem?.length ? ` · ⚠️ ${rr.probleem.map(p => `„${esc(p.item.titel)}” haalt zijn deadline (${fmtDatum(p.deadline)}) niet`).join(", ")}` : ""}`;
    aanpas = null; minDuur = null; bewaar(); teken();
    if (wijk.length) agendaBij(wijk.flatMap(e => [e.blok, e.heen, e.terug].filter(Boolean).map(b => b.id)));
    if (doel) doeNaarAgenda(new Set(d().planning.filter(x => x.item === it.id && new Date(x.eind) > new Date()).map(x => x.id))).catch(() => {});   // meteen in die agenda (alleen dit blok en de reistijd)
  };
  const openAanpas = (b) => {
    const a = new Date(b.dataset.zet), e = new Date(b.dataset.tot);
    aanpas = { dag: dagStr(a), van: fmtTijd(a.toISOString()), tot: fmtTijd(e.toISOString()), gatVan: fmtTijd(a.toISOString()), gatTot: fmtTijd(e.toISOString()) };
    teken(); $("[name=atot]", dlg2)?.focus?.();
  };
  let lang = null, langGedaan = false;   // lang drukken (telefoon) = rechtsklik
  dlg2.oncontextmenu = (e) => { const b = e.target.closest(".voorstel"); if (!b) return; e.preventDefault(); clearTimeout(lang); langGedaan = true; openAanpas(b); };
  dlg2.onpointerdown = (e) => { const b = e.target.closest(".voorstel"); if (!b || e.button > 0) return; langGedaan = false; clearTimeout(lang); lang = setTimeout(() => { langGedaan = true; openAanpas(b); }, 550); };
  dlg2.onpointerup = dlg2.onpointercancel = dlg2.onpointerleave = () => clearTimeout(lang);
  dlg2.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.zet) {
      if (langGedaan) { langGedaan = false; return; }
      const va = new Date(b.dataset.zet); let vb = new Date(b.dataset.tot);
      // gaat het gat over andere taken heen (deadline gaat voor), neem dan alleen de tijd die nog nodig is
      const st = planStatus(it), over = d().planning.some(x => x.item && x.item !== it.id && x.soort !== "reis" && new Date(x.start) < vb && new Date(x.eind) > va);
      if (over) vb = new Date(Math.min(vb, va.getTime() + opRaster(st.rest || st.nodig || 30) * 60000));
      zet(va, vb, false); return;
    }
    if (b.dataset.kijk) {                                           // laat de agenda van die dag zien (bij "kies zelf")
      const duur = minVan(kijk.tot) - minVan(kijk.van) > 0 ? minVan(kijk.tot) - minVan(kijk.van) : 60, v1 = vsLaatst.find(v => v.dag === b.dataset.kijk);
      kijk = v1 ? { dag: v1.dag, van: fmtTijd(v1.a.toISOString()), tot: hhmm(Math.min(minVan(fmtTijd(v1.a.toISOString())) + duur, 23 * 60 + 45)) } : { ...kijk, dag: b.dataset.kijk };
      teken(); $("#kieszelf", dlg2)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }); return;
    }
    if (b.dataset.blokweg) { const x = d().planning.find(y => y.id === b.dataset.blokweg); if (x) { haalBlokWeg(x); melding = "Blok uit de planning gehaald"; minDuur = null; bewaar(); teken(); } return; }
    const a = b.dataset.actie;
    const tijd = (n) => $(`[name=${n}]`, dlg2)?.value || "";
    if (a === "pmin") { const v = leesDuur(tijd("pmin")); if (v > 0) { minDuur = Math.max(5, Math.round(v / 5) * 5); voorkeur.zet("planMin", minDuur); aantal = 16; melding = ""; teken(); } else toast("Vul een lengte in, bv. 1u30 of 45m"); }
    else if (a === "pmeer") { aantal += 16; teken(); }
    else if (a === "pkeuzeToch" && keuze) { const k = keuze; keuze = null; zet(k.start, new Date(k.start.getTime() + k.duur * 60000), false, true); }
    else if (a === "pkeuzeNiet") { keuze = null; melding = "Niets veranderd"; teken(); }
    else if (a === "pvul") {
      // de eerstvolgende vrije gaten vullen tot de rest is ingepland (gaten van minstens de gekozen lengte, of korter als er minder over is)
      const v0 = leesDuur($("[name=pmin]", dlg2)?.value || "");
      if (v0 > 0) minDuur = Math.max(5, Math.round(v0 / 5) * 5);
      const min = minDuur || 30, gezet = [];
      for (let n = 0, st = planStatus(it); st.rest > 0 && n < 30; n++, st = planStatus(it)) {
        const v = planVoorstellen(it, Math.min(st.rest, min), { aantal: 1, negeer: negeer() })[0]; if (!v) break;
        const dur = Math.min(st.rest, v.duur), r = plaatsMetWijken(it, v.a, dur, agendaKeuze || undefined, { wijken: schuifMee || deadlineVoor || isDoen(), forceer: isDoen() });
        if (!r.ok) { keuze = { start: v.a, duur: dur, probleem: r.probleem }; break; }
        gezet.push(r.blok);
      }
      const st = planStatus(it);
      melding = gezet.length ? `✓ ${gezet.length} ${gezet.length === 1 ? "blok" : "blokken"} ingepland: ${gezet.map(b => `${dagKort(new Date(b.start))} ${fmtTijd(b.start)}–${fmtTijd(b.eind)}`).join(", ")}${st.rest ? ` — nog ${fmtDuur(st.rest)} paste niet binnen 4 weken` : ""}` : "Geen vrij gat gevonden binnen 4 weken";
      bewaar(); teken();
      if (gezet.some(b => doelAgendaVan(b))) doeNaarAgenda(new Set(d().planning.filter(x => x.item === it.id && new Date(x.eind) > new Date()).map(x => x.id))).catch(() => {});
    }
    else if (a === "pvoorrang") naSluiten(dlg2, () => doenVenster(it));
    else if (a === "aWeg") { aanpas = null; teken(); }
    else if (a === "aZet" || a === "pzelf") {
      const dag = a === "aZet" ? aanpas.dag : tijd("pdag"), van = tijd(a === "aZet" ? "avan" : "pvan"), tot = tijd(a === "aZet" ? "atot" : "ptot");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dag) || !/^\d{2}:\d{2}$/.test(van) || !/^\d{2}:\d{2}$/.test(tot)) { toast("Kies een dag, begin- en eindtijd"); return; }
      zet(new Date(dag + "T" + van), new Date(dag + "T" + tot));
    }

    else if (a === "popen") { dlg2.close(); openEditor(it); }
  };
  dlg2.onkeydown = (e) => { if (e.key === "Enter" && e.target.name === "pmin") { e.preventDefault(); $('[data-actie="pmin"]', dlg2).click(); } };
  // dagbeeld bijwerken zonder het hele venster opnieuw te tekenen
  const kijkBij = () => { const db = $("#dagbeeld", dlg2); if (db) db.innerHTML = dagBeeld(kijk, it, schuifMee || isDoen()); };
  const leesKijk = () => { const v = (n) => $(`[name=${n}]`, dlg2)?.value || ""; kijk = { dag: v("pdag") || kijk.dag, van: v("pvan") || kijk.van, tot: v("ptot") || kijk.tot }; };
  dlg2.onchange = (e) => {
    if (e.target.name === "pagenda") agendaKeuze = e.target.value;
    if (["pdag", "pvan", "ptot"].includes(e.target.name)) { leesKijk(); kijkBij(); }
    if (e.target.id === "pschuif") { schuifMee = e.target.checked; kijkBij(); }
    if (e.target.id === "pdeadline") { deadlineVoor = e.target.checked; teken(); }
  };
  dlg2.oninput = (e) => { if (["pdag", "pvan", "ptot"].includes(e.target.name)) { leesKijk(); kijkBij(); } };
  // tik in het dagbeeld = begintijd (op het halve uur), de duur blijft gelijk
  dlg2.dagTik = (min) => { if (!$("#planForm", dlg2)) return; kijk = { ...kijk }; dagTikInvullen(min, "pvan", "ptot", kijk); kijkBij(); };
  dlg2.onclose = () => { clearTimeout(lang); for (const k of ["onkeydown", "oncontextmenu", "onpointerdown", "onpointerup", "onpointercancel", "onpointerleave", "oninput", "dagTik", "onclose"]) dlg2[k] = null; };
  teken();
  if (!dlg2.open) dlg2.showModal();
}

// Een venster vervangen door een ander in hetzelfde dialoogvenster: pas verder als het oude écht dicht is.
// (De browser meldt "dicht" iets later; zou het nieuwe venster al open staan, dan ruimt de afsluiting van het oude
// de knoppen van het nieuwe op — en kun je nergens meer op klikken.)
function naSluiten(dl, verder) {
  if (!dl.open) { verder(); return; }
  let gedaan = false;
  const door = () => { if (gedaan) return; gedaan = true; setTimeout(verder, 0); };
  dl.addEventListener("close", door, { once: true });
  dl.close();
  setTimeout(door, 60);                                         // vangnet
}

// ---------- Doen: meteen, met voorrang ----------
// Taken die voor een Doen-taak uit de agenda zijn gehaald: blijven zichtbaar tot ze weer ingepland (of klaar) zijn
const herplanIds = () => voorkeur.lees("herplan", []);
function zetHerplan(ids) { voorkeur.zet("herplan", [...new Set(ids)]); }
function herplanBlok() {
  const items = herplanIds().map(id => taak(id) || project(id)).filter(t => t && t.status !== "klaar" && planStatus(t).soort !== "ja");
  if (items.length !== herplanIds().length) zetHerplan(items.map(t => t.id));
  if (!items.length) return "";
  return `<div class="paneel herplan"><div class="rij" style="align-items:center;justify-content:space-between">
      <b>🔁 Opnieuw in te plannen (${items.length})</b>
      <span style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="knop klein prim" data-actie="herplanAlles">⚡ Nu opnieuw inplannen</button>
        <button type="button" class="knop klein" data-actie="herplanWis" title="Lijst wissen (de taken blijven gewoon bestaan)">Lijst wissen</button></span></div>
    <p class="hint" style="margin:4px 0 8px">Deze zijn uit je agenda gehaald om ruimte te maken voor iets uit Doen. Plan ze opnieuw in, alles tegelijk of per taak.</p>
    <div class="lijst">${items.map(t => t.type === "taak" ? itemRij(t) : projectRijPlan(t)).join("")}</div></div>`;
}
// Na een wijziging: blokken die in een agenda staan of moeten komen, meteen bijwerken (alleen die)
function agendaBij(ids) {
  const set = new Set([...ids].filter(Boolean));
  if (!set.size || !verbindingen().length) return;
  if (![...set].some(id => d().extern?.[id] || (d().planning.find(b => b.id === id) && doelAgendaVan(d().planning.find(b => b.id === id))))) return;
  doeNaarAgenda(set).catch(() => {});
}
/** Komt een taak (net) in Doen? Dan meteen op het eerste moment dat kan, volgens de instelling. */
function naDoen(it, wasDoen) {
  if (!it || wasDoen || kwadrant(it) !== "doen" || it.status === "klaar" || !isMijn(it) || doorGelinktIngepland(it)) return;
  if (it.type === "project" && !zelfInTePlannen(it)) return;
  if (planStatus(it).soort === "ja") {
    const k = metVoorrang(it, { modus: "kijk" });
    if (!k.gevonden || !k.eerder) return;   // staat al zo vroeg als kan
  }
  const m = d().instellingen.doenModus || "vragen";
  if (m === "vragen") setTimeout(() => doenVenster(it), 0);
  else voerVoorrangUit(it, m, false);
}
const blokMoment = (b) => `${fmtDatum(dagStr(new Date(b.start)))} ${fmtTijd(b.start)}–${fmtTijd(b.eind)}`;
const voorrangMoment = (r) => r.blokken.length === 1 ? blokMoment(r.blokken[0]) : `in ${r.blokken.length} blokken, vanaf ${fmtDatum(dagStr(r.a))} ${fmtTijd(r.a.toISOString())}`;
const aantalTaken = (n) => `${n} ${n === 1 ? "taak" : "taken"}`;
function voerVoorrangUit(it, modus, hierAl) {
  const voor = d().planning.map(b => ({ ...b })), herplanVoor = herplanIds();
  const r = metVoorrang(it, { modus, hierAl });
  if (!r.gevonden) { toast(r.alGenoeg ? `„${it.titel}” heeft al genoeg tijd ingepland` : `Geen plek gevonden voor „${it.titel}” in de komende 4 weken`); return; }
  const terugLijst = [...new Set([...r.weg, ...r.niet].map(b => b.item).filter(Boolean))];
  if (terugLijst.length) zetHerplan([...herplanIds(), ...terugLijst]);
  bewaar();
  const delen = [`⚡ „${it.titel}” staat ${voorrangMoment(r)}`];
  if (r.verschoven.length) delen.push(`${aantalTaken(new Set(r.verschoven.map(v => v.blok.item)).size)} doorgeschoven`);
  if (r.weg.length) delen.push(`${aantalTaken(r.weg.length)} eruit gehaald (bij „Opnieuw in te plannen”)`);
  if (r.niet.length) delen.push(`${aantalTaken(r.niet.length)} paste${r.niet.length === 1 ? "" : "n"} nergens meer (bij „Opnieuw in te plannen”)`);
  if (r.rest) delen.push(`nog ${fmtDuur(r.rest)} tekort in de komende 4 weken`);
  if (r.probleem.length) delen.push(`⚠️ ${r.probleem.map(p => `„${p.item.titel}”`).join(", ")} haalt de deadline niet meer`);
  toast(delen.join(" — "), { label: "Ongedaan maken", f: () => {
    d().planning = voor; werkGeplandBij(d().overzichten.map(o => o.id)); zetHerplan(herplanVoor); bewaar(); agendaBij(r.gewijzigd); toast("Teruggezet zoals het was");
  } });
  agendaBij(r.gewijzigd);
}
function doenVenster(it, hierAl = false) {
  const k = metVoorrang(it, { modus: "kijk", hierAl });
  const p = plekVan(it), l = locatie(p.eigenLoc || p.loc);
  const plekGebonden = !!l && l.id !== "thuis" && (p.reis > 0 || (p.ov?.modus === "vast" && p.eigenLoc));
  const vandaag = vandaagStr();
  const perTaak = new Map();
  for (const v of k.verschoven || []) { const x = perTaak.get(v.blok.item); if (!x) perTaak.set(v.blok.item, { ...v }); }
  dlg2.innerHTML = `<form method="dialog"><div class="dkop"><span class="soort" style="color:var(--q-doen)">⚡ Doen — zo snel mogelijk</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <h2 style="margin:0">${esc(it.titel)}</h2>
      ${k.gevonden ? `<div class="planstand">Komt vooraan: <b>${fmtDuur(k.duur)}</b>${hierAl ? ` · je bent er al (geen reistijd)` : l && l.id !== "thuis" ? ` · 📍 ${esc(l.naam)}` : ""}
          <div class="lijst" style="margin-top:6px">${k.blokken.map(b => `<div class="linkrij"><span>⚡</span><span>${blokMoment(b)}</span><span class="hint">${fmtDuur(minutenTussen(b))}</span></div>`).join("")}</div>
          ${k.rest ? `<div class="hint">⚠️ Nog ${fmtDuur(k.rest)} tekort: daar is in de komende ${hierAl ? "uren" : "4 weken"} geen werktijd meer voor.</div>` : ""}
          ${k.eigenDeadline ? `<div class="hint">⚠️ Dat is niet op tijd voor de deadline (${fmtDatum(k.eigenDeadline)}).</div>` : ""}</div>`
        : k.alGenoeg ? `<div class="leeg" style="padding:14px">Er staat al genoeg tijd voor ingepland.</div>`
        : `<div class="leeg" style="padding:14px">Geen plek gevonden in de komende 4 weken${plekGebonden ? ` op ${esc(l.naam)}` : ""}.</div>`}
      ${plekGebonden && !hierAl && (!k.gevonden || dagStr(k.a) !== vandaag) ? `<div class="hint">📍 Deze taak moet op ${esc(l.naam)}${k.gevonden ? `; daar ben je pas weer ${fmtDatum(dagStr(k.a))}` : ""}.</div>
        <div><button type="button" class="knop" data-actie="hierAl">📍 Ik ben vandaag (toch) op ${esc(l.naam)}</button></div>` : ""}
      ${k.gevonden && perTaak.size ? `<div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Schuift door naar achteren (in dezelfde volgorde)</div><div class="lijst">${[...perTaak.values()].map(v =>
        `<div class="linkrij"><span>⏩</span><span>${esc(v.blok.titel)}</span><span class="hint">${fmtDatum(dagStr(new Date(v.van)))} ${fmtTijd(v.van)} → ${fmtDatum(dagStr(new Date(v.naar)))} ${fmtTijd(v.naar)}${v.stukken > 1 ? ` (in ${v.stukken} stukken)` : ""}</span></div>`).join("")}</div></div>`
        : k.gevonden ? `<div class="hint">Er hoeft niets te wijken.</div>` : ""}
      ${k.gevonden && k.niet?.length ? `<div class="hint">Past daarna nergens meer (komt bij „Opnieuw in te plannen”): ${k.niet.map(b => `„${esc(b.titel)}”`).join(", ")}</div>` : ""}
      ${k.gevonden && k.probleem?.length ? `<div class="deadlinekeuze"><b>⚠️ Let op: dit gaat ten koste van een deadline</b>${k.probleem.map(x => `<div>„${esc(x.item.titel)}” (deadline ${fmtDatum(x.deadline)}) ${x.tot ? `is dan pas ${fmtDatum(x.tot)} klaar` : "past dan niet meer"}</div>`).join("")}</div>` : ""}
      <label class="schakel"><input type="checkbox" id="doenOnthoud"> Voortaan niet meer vragen, maar meteen zo doen</label>
    </div>
    <div class="dvoet"><button type="button" class="knop" data-actie="nietNu">Niet nu</button>
      <div class="rechts"><button type="button" class="knop" data-actie="zelf">📅 Zelf kiezen</button>
        ${k.gevonden ? `${k.inDeWeg.length ? `<button type="button" class="knop" data-actie="weg" title="Wat in de weg zit gaat eruit en komt op de lijst om opnieuw in te plannen">Anderen eruit</button>` : ""}
        <button type="button" class="knop prim" data-actie="schuif" title="Deze taak vooraan; wat er stond schuift in dezelfde volgorde door naar de volgende lege werktijd">⚡ ${perTaak.size ? "Vooraan, rest schuift door" : "Inplannen"}</button>` : ""}</div></div></form>`;
  dlg2.onclick = (e) => {
    const a = e.target.closest("button")?.dataset.actie; if (!a) return;
    if (a === "hierAl") { doenVenster(it, true); return; }
    if (a === "nietNu") { dlg2.close(); return; }
    if (a === "zelf") { naSluiten(dlg2, () => planTaak(it)); return; }
    if (a === "weg" || a === "schuif") {
      if ($("#doenOnthoud", dlg2)?.checked) { d().instellingen.doenModus = a; }
      naSluiten(dlg2, () => voerVoorrangUit(it, a, hierAl));
    }
  };
  dlg2.onchange = null; dlg2.onclose = () => { dlg2.onclick = null; dlg2.onclose = null; };
  if (!dlg2.open) dlg2.showModal();
}
const minutenTussen = (b) => Math.round((new Date(b.eind) - new Date(b.start)) / 60000);
// ---------- eerder klaar: wat doe je met de vrijgekomen tijd? ----------
function naarVorenTekst(r) {
  const n = new Set(r.details.map(x => x.blok.item)).size, eerste = r.details[0];
  return `${n ? `⏪ ${n} ${n === 1 ? "taak" : "taken"} naar voren gehaald${eerste ? ` („${eerste.blok.titel}” nu ${fmtDatum(dagStr(new Date(eerste.naar)))} ${fmtTijd(eerste.naar)})` : ""}` : "Er stond niets meer om naar voren te halen"}${r.uitloop ? ` · uitloop ${fmtTijd(r.uitloop.start)}–${fmtTijd(r.uitloop.eind)} gereserveerd` : ""}`;
}
function vrijeTijdVenster(it, v, na) {
  // ingesteld op meteen naar voren halen: niet vragen
  const km = d().instellingen.klaarModus;
  if (km === "voren" || km === "vorenUitloop") {
    const voor = d().planning.map(b => ({ ...b }));
    const r = vrijeTijd(it, v, "schuif", { uitloopAchteraan: km === "vorenUitloop" }); bewaar();
    const ids = [v.blok.id, ...v.overig.map(b => b.id), ...r.gewijzigd, r.uitloop?.id];
    toast(naarVorenTekst(r), { label: "Ongedaan maken", f: () => { d().planning = voor; werkGeplandBij(d().overzichten.map(o => o.id)); bewaar(); agendaBij(ids); toast("Teruggezet zoals het was"); } });
    agendaBij(ids); na?.(); return;
  }
  const tekst = `${fmtDatum(dagStr(v.a))} ${fmtTijd(v.a.toISOString())}–${fmtTijd(v.b.toISOString())}`;
  const kandidaten = [...d().taken, ...d().projecten.filter(zelfInTePlannen)]
    .filter(t => t.id !== it.id && t.status !== "klaar" && isMijn(t) && !doorGelinktIngepland(t) && actieveOverzichten().includes(t.overzicht) && !wachtNogOp(t).length && planStatus(t).soort !== "ja")
    .sort((a, b) => prioriteit(b) - prioriteit(a)).slice(0, 6);
  dlg2.innerHTML = `<form method="dialog"><div class="dkop"><span class="soort">⏱ Tijd over</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <h2 style="margin:0">${fmtDuur(v.min)} vrij: ${tekst}</h2>
      <p class="hint" style="margin:0">„${esc(it.titel)}” is eerder klaar dan gepland. Wat wil je met de vrijgekomen tijd?</p>
      <div class="keuzes">
        <button type="button" class="keuzeknop" data-actie="schuif"><b>⏪ Alles naar voren halen</b><small>Al het werk hierna schuift in dezelfde volgorde naar voren, ook van latere dagen: de hele planning loopt op.</small></button>
        <label class="schakel" style="margin:-4px 0 4px 10px"><input type="checkbox" id="uitloopAchter" ${d().instellingen.klaarModus === "voren" ? "" : "checked"}> ${fmtDuur(v.min)} reserve houden als uitloop (aan het eind van dit werkmoment)</label>
        <button type="button" class="keuzeknop" data-actie="uitloop"><b>⏳ Reserveren als uitloop</b><small>Blijft in je agenda staan, voor als iets uitloopt.</small></button>
        <button type="button" class="keuzeknop" data-actie="vrij"><b>☕ Vrijlaten</b><small>De tijd komt vrij; je agenda wordt bijgewerkt.</small></button>
      </div>
      ${kandidaten.length ? `<div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Of meteen iets anders oppakken</div><div class="lijst">${kandidaten.map(t =>
        `<button type="button" class="keuzeknop" data-pak="${t.id}" data-ptype="${t.type}"><b>${esc(t.titel)}</b><small>${KWADRANTEN[kwadrant(t)].naam} · nog ${fmtDuur(nogNodig(t))}${nogNodig(t) > v.min ? ` (past ${fmtDuur(v.min)})` : ""}</small></button>`).join("")}</div></div>` : ""}
    </div></form>`;
  let gekozen = false;
  const voor = d().planning.map(b => ({ ...b }));
  const klaar = (r, msg) => {
    gekozen = true; bewaar(); dlg2.close();
    const ids = [v.blok.id, ...v.overig.map(b => b.id), ...(r?.verschoven || []).map(b => b.id), ...(r?.gewijzigd || []), r?.uitloop?.id, r?.nieuw];
    toast(msg, { label: "Ongedaan maken", f: () => { d().planning = voor; werkGeplandBij(d().overzichten.map(o => o.id)); bewaar(); agendaBij(ids); toast("Teruggezet zoals het was"); } });
    agendaBij(ids);
  };
  dlg2.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.pak) {
      const t = b.dataset.ptype === "project" ? project(b.dataset.pak) : taak(b.dataset.pak);
      vrijeTijd(it, v, "vrij");
      const duur = Math.min(v.min, Math.max(15, nogNodig(t)));
      const r = plaatsBlok(t, v.a, duur);
      klaar({ nieuw: r.blok.id }, `„${t.titel}” staat nu ${fmtTijd(v.a.toISOString())}–${fmtTijd(r.blok.eind)}`); return;
    }
    const a = b.dataset.actie; if (!["schuif", "uitloop", "vrij"].includes(a)) return;
    const r = vrijeTijd(it, v, a, { uitloopAchteraan: !!$("#uitloopAchter", dlg2)?.checked });
    klaar(r, a === "schuif" ? naarVorenTekst(r)
      : a === "uitloop" ? "Gereserveerd als uitloop" : "Tijd vrijgelaten");
  };
  // dicht zonder keuze = vrijlaten
  dlg2.onclose = () => { if (!gekozen) { vrijeTijd(it, v, "vrij"); bewaar(); agendaBij([v.blok.id, ...v.overig.map(b => b.id)]); } dlg2.onclick = null; dlg2.onclose = null; na?.(); };
  if (!dlg2.open) dlg2.showModal();
}

// ---------- een afspraak uit je agenda: altijd, alleen op werkdagen, of deze keer niet ----------
function afspraakRegel(ev, soort, lijst, alles = false) {
  if (soort === "verberg") { d().verborgen = { ...(d().verborgen || {}), [afspraakSleutel(ev)]: new Date().toISOString() }; return; }
  if (soort === "werkdag") {
    d().afspraakRegels = [...(d().afspraakRegels || []).filter(r => !(r.bron === ev.bron && r.titel.trim().toLowerCase() === String(ev.titel || "").trim().toLowerCase())),
      { id: uid(), bron: ev.bron, titel: String(ev.titel || "").slice(0, 200), lijst, soort: "werkdag" }];
  }
  // bij welke rol hoort hij: alleen deze keer, of alle afspraken met die naam uit die agenda
  if (soort === "werk" || soort === "prive") {
    if (alles) {
      const t = String(ev.titel || "").trim().toLowerCase();
      d().afspraakRegels = [...(d().afspraakRegels || []).filter(r => !(r.bron === ev.bron && r.lijst === lijst && r.soort !== "werkdag" && r.titel.trim().toLowerCase() === t)),
        { id: uid(), bron: ev.bron, titel: String(ev.titel || "").slice(0, 200), lijst, soort: soort === "werk" ? "rolwerk" : "rolprive" }];
    } else d().rolKeuzes = { ...(d().rolKeuzes || {}), [afspraakSleutel(ev)]: { rol: soort, lijst } };
    return;
  }
  if (soort === "herinnering") {
    if (alles) d().afspraakRegels = [...(d().afspraakRegels || []).filter(r => !(r.bron === ev.bron && r.soort === "herinnering" && r.titel.trim().toLowerCase() === String(ev.titel || "").trim().toLowerCase())),
      { id: uid(), bron: ev.bron, titel: String(ev.titel || "").slice(0, 200), lijst: "", soort: "herinnering" }];
    else d().herinneringen = { ...(d().herinneringen || {}), [afspraakSleutel(ev)]: new Date().toISOString() };
    return;
  }
  if (soort === "geenherinnering") {
    const t = String(ev.titel || "").trim().toLowerCase(), h = { ...(d().herinneringen || {}) }; delete h[afspraakSleutel(ev)]; d().herinneringen = h;
    d().afspraakRegels = (d().afspraakRegels || []).filter(r => !(r.bron === ev.bron && r.soort === "herinnering" && r.titel.trim().toLowerCase() === t));
    return;
  }
  if (soort === "altijd") {
    const t = String(ev.titel || "").trim().toLowerCase();
    d().afspraakRegels = (d().afspraakRegels || []).filter(r => !(r.bron === ev.bron && r.soort === "werkdag" && r.titel.trim().toLowerCase() === t));
  }
}
function afspraakVenster(ev) {
  const a = new Date(ev.start), titel = ev.titel || "Afspraak", r = regelVoor(ev);
  const vast = vasteLijsten();
  const bron = ev.vanFamilie ? `agenda van ${ev.vanFamilie}` : (d().agendas?.[ev.bron] ? agendaNaam(ev.bron) || d().agendas[ev.bron].naam : "agenda");
  const standaardLijst = r?.lijst || d().agendas?.[ev.bron]?.lijst || (vast.find(o => (o.eigenaar || sessie.ik) === (ev.vanUid || sessie.ik)) || vast[0])?.id || "";
  dlg2.innerHTML = `<form method="dialog"><div class="dkop"><span class="soort">📅 Afspraak</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <h2 style="margin:0">${esc(titel)}</h2>
      <div class="hint">${DAGLANG[a.getDay()]} ${a.getDate()} ${MAAND[a.getMonth()]} · ${fmtTijd(ev.start)}–${fmtTijd(ev.eind)}${ev.plaats ? " · " + esc(ev.plaats) : ""} · ${esc(bron)}</div>
      ${r ? `<div class="planstand">🗓 Alle „${esc(r.titel)}” uit deze agenda tellen alleen op werkdagen van ${esc(overzicht(r.lijst)?.naam || "je werk")}.</div>` : ""}
      <p class="hint" style="margin:0">Tijdkompas plant om je afspraken heen. Is dit een reservering (zoals lunch) die niet op elk moment hoort, kies dan hier:</p>
      <div class="keuzes">
        ${vast.length ? `<button type="button" class="keuzeknop" data-akeuze="werkdag"><b>🗓 Alleen meetellen op werkdagen</b><small>Geldt voor alle „${esc(titel)}” uit deze agenda. Op dagen zonder werk staan ze er niet en zitten ze niet in de weg.</small></button>
        ${vast.length > 1 ? `<label class="veld" style="margin-left:10px">Werkdagen van<select name="alijst">${vast.map(o => `<option value="${o.id}" ${o.id === standaardLijst ? "selected" : ""}>${esc(o.icoon)} ${esc(o.naam)}</option>`).join("")}</select></label>` : ""}` : `<div class="hint">„Alleen op werkdagen” kan zodra je een lijst met vaste tijden hebt (zoals Werk).</div>`}
        ${vast.length ? (() => { const huidig = rolKeuze(ev, standaardLijst), naam = overzicht(standaardLijst)?.naam || "werk";
          return `<div class="rij" style="gap:6px"><button type="button" class="keuzeknop" style="flex:1" data-akeuze="werk" aria-pressed="${huidig === "werk"}"><b>💼 Hoort bij ${esc(naam)}</b><small>Telt als werktijd</small></button>
          <button type="button" class="keuzeknop" style="flex:1" data-akeuze="prive" aria-pressed="${huidig === "prive"}"><b>🏠 Is privé</b><small>Telt als eigen tijd</small></button></div>
`; })() : ""}
        <label class="schakel" style="margin:-2px 0 4px 10px"><input type="checkbox" id="arolAlles"> Werk/privé en herinnering: voor alle „${esc(titel)}” uit deze agenda</label>
        ${isHerinnering(ev) ? `<button type="button" class="keuzeknop" data-akeuze="geenherinnering"><b>↩ Geen herinnering meer</b><small>Telt weer als bezet.</small></button>`
          : `<button type="button" class="keuzeknop" data-akeuze="herinnering"><b>🔔 Is een herinnering</b><small>Blijft als belletje staan, maar telt niet als bezet (er mag doorheen gepland worden).</small></button>`}
        <button type="button" class="keuzeknop" data-akeuze="verberg"><b>🙈 Deze keer niet meetellen</b><small>Alleen deze afspraak; hij verdwijnt hier en er mag doorheen gepland worden.</small></button>
        ${r ? `<button type="button" class="keuzeknop" data-akeuze="altijd"><b>↩ Weer altijd meetellen</b><small>De regel voor „${esc(r.titel)}” vervalt.</small></button>` : ""}
      </div>
      <p class="hint" style="margin:0">In je ${esc(ev.vanFamilie ? "andere inlog" : "agenda")} zelf verandert niets. Terugdraaien kan bij Instellingen → Agenda's &amp; accounts.</p>
    </div></form>`;
  dlg2.onclick = (e) => {
    const k = e.target.closest("[data-akeuze]")?.dataset.akeuze; if (!k) return;
    if (k === "altijd" && r && !(d().afspraakRegels || []).some(x => x.bron === r.bron && x.titel === r.titel)) { toast("Deze regel is gezet in je andere inlog; haal hem daar weg"); return; }
    const lijst = $("[name=alijst]", dlg2)?.value || standaardLijst;
    afspraakRegel(ev, k, lijst, !!$("#arolAlles", dlg2)?.checked); bewaar(); dlg2.close();
    toast(k === "herinnering" ? `„${titel}” is ${$("#arolAlles", dlg2)?.checked ? "voortaan " : ""}een herinnering` : k === "geenherinnering" ? `„${titel}” telt weer als bezet` : k === "werk" || k === "prive" ? `„${titel}” telt als ${k === "werk" ? "werk" : "privé"}` : k === "werkdag" ? `„${titel}” telt voortaan alleen op werkdagen` : k === "verberg" ? "Deze afspraak telt niet meer mee" : `„${titel}” telt weer altijd`);
  };
  dlg2.onchange = null; dlg2.onclose = () => { dlg2.onclick = null; dlg2.onclose = null; };
  if (!dlg2.open) dlg2.showModal();
}
function regelsBlok() {
  const regels = d().afspraakRegels || [], n = Object.keys(d().verborgen || {}).length + Object.keys(d().rolKeuzes || {}).length + Object.keys(d().herinneringen || {}).length;
  if (!regels.length && !n) return "";
  return `<h3>Afspraken die niet altijd meetellen</h3>
  <div class="lijst">${regels.map(r => `<div class="linkrij"><span>${r.soort === "rolwerk" ? "💼" : r.soort === "rolprive" ? "🏠" : r.soort === "herinnering" ? "🔔" : "🗓"}</span><span>„${esc(r.titel)}” <span class="hint">· ${esc(d().agendas?.[r.bron]?.naam || "agenda van je andere inlog")} · ${r.soort === "herinnering" ? "herinnering (telt niet als bezet)" : r.soort === "rolwerk" ? "telt als " + esc(overzicht(r.lijst)?.naam || "werk") : r.soort === "rolprive" ? "telt als privé (niet " + esc(overzicht(r.lijst)?.naam || "werk") + ")" : "alleen op werkdagen van " + esc(overzicht(r.lijst)?.naam || "?")}</span></span>
    <button type="button" class="x" data-regelweg="${esc(r.id)}" title="Weer altijd meetellen">✕</button></div>`).join("")}
  ${n ? `<div class="linkrij"><span>🙈</span><span>${n} losse ${n === 1 ? "afspraak" : "afspraken"} niet meegeteld of zelf als werk/privé aangeduid</span><button type="button" class="knop klein" data-actie="verborgenWeg">Weer meetellen</button></div>` : ""}</div>`;
}

// ---------- buiten je beschikbaarheid: verplaatsen, herinnering, of klopt zo ----------
let laatsteBuiten = [];
function buitenBlok() {
  const bots = new Set(laatsteBotsingen.map(c => c.ev.start + "|" + c.ev.titel));   // al gemeld als botsing werk/privé
  laatsteBuiten = buitenBeschikbaarheid().filter(c => c.soort === "blok" || !bots.has(c.ev.start + "|" + c.ev.titel));
  if (!laatsteBuiten.length) return "";
  const regel = (c, i) => { const x = c.ev || c.blok, a = new Date(x.start);
    return `<div class="linkrij"><span>${c.soort === "blok" ? "📅" : "📌"}</span>
      <span><b>${dagKort(a)} ${fmtTijd(x.start)}–${fmtTijd(x.eind)}</b> ${esc(x.titel || "Afspraak")}<br><small class="hint">${c.weg ? "op een dag dat je weg bent" : `${fmtDuur(c.min)} buiten je ${c.soort === "blok" && effLijst(overzicht(c.blok.overzicht))?.modus === "vast" ? "werktijden" : "beschikbaarheid"}`}${c.soort === "blok" ? " · ingepland blok" : ""}</small></span>
      <button type="button" class="knop klein" data-actie="buiten" data-w="${i}">Kiezen…</button></div>`; };
  return `<div class="paneel botsingen buiten"><b>🌙 Buiten je beschikbaarheid (${laatsteBuiten.length})</b>
    <p class="hint" style="margin:4px 0 8px">Verplaats het, geef aan dat het een herinnering is (telt dan niet als bezet), of laat het zo.</p>
    <div class="lijst">${laatsteBuiten.slice(0, 6).map(regel).join("")}${laatsteBuiten.length > 6 ? `<div class="hint">+ ${laatsteBuiten.length - 6} meer</div>` : ""}</div></div>`;
}
function buitenVenster(c) {
  const x = c.ev || c.blok, a = new Date(x.start), b = new Date(x.eind), titel = x.titel || "Afspraak", duur = Math.round((b - a) / 60000);
  const it = c.blok ? (taak(c.blok.item) || project(c.blok.item)) : null, kan = c.ev ? kanVerplaatsen(c.ev) : false;
  // voorstel: hetzelfde tijdstip binnen je beschikbaarheid van die dag (begin of eind ervan)
  const besch = dagIndeling(new Date(a.getFullYear(), a.getMonth(), a.getDate())).beschikbaar;
  const eerste = besch[0], laatste = besch.at(-1);
  const voor = !eerste ? a : a < eerste[0] ? eerste[0] : laatste && b > laatste[1] ? new Date(laatste[1].getTime() - duur * 60000) : a;
  const bkijk = { dag: dagStr(voor), van: fmtTijd(voor.toISOString()), tot: fmtTijd(new Date(voor.getTime() + duur * 60000).toISOString()) };
  const bBij = () => { const el = $("#bdagbeeld", dlg2); if (el && c.ev) el.innerHTML = dagBeeld(bkijk, { id: "__afspraak", titel }, false, { zonderEv: c.ev.id, label: "📅 " + titel }); };
  const bLees = () => { const v = (n) => $(`[name=${n}]`, dlg2)?.value || ""; bkijk.dag = v("vdag") || bkijk.dag; bkijk.van = v("vvan") || bkijk.van; bkijk.tot = v("vtot") || bkijk.tot; bBij(); };
  dlg2.innerHTML = `<form method="dialog"><div class="dkop"><span class="soort">🌙 Buiten je beschikbaarheid</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <h2 style="margin:0">${esc(titel)}</h2>
      <div class="planstand">${DAGLANG[a.getDay()]} ${a.getDate()} ${MAAND[a.getMonth()]} · ${fmtTijd(x.start)}–${fmtTijd(x.eind)} · ${c.weg ? "je bent die dag weg" : fmtDuur(c.min) + " buiten je " + (c.blok ? "tijden voor deze lijst" : "beschikbare uren")}</div>
      <div class="keuzes">
        ${c.blok ? `<button type="button" class="keuzeknop" data-bkeuze="blokverplaats"><b>🕘 Verplaatsen</b><small>Kies een ander moment binnen je beschikbaarheid.</small></button>`
        : `<button type="button" class="keuzeknop" data-bkeuze="herinnering"><b>🔔 Het is een herinnering</b><small>Blijft als belletje in je agenda, maar telt niet als bezet en wordt hier niet meer gemeld.</small></button>
        <label class="schakel" style="margin:-2px 0 4px 10px"><input type="checkbox" id="bAlles"> Voor alle „${esc(titel)}” uit deze agenda</label>
        ${kan ? `<div class="paneel"><b>🕘 Verplaatsen</b> <small class="hint">— in je ${esc(d().agendas?.[c.ev.bron]?.accountSoort === "ms" ? "Outlook" : "Google")}-agenda zelf</small>
          <div class="rij" style="align-items:end;margin-top:6px"><label class="veld">Dag<input type="date" name="vdag" value="${dagStr(voor)}"></label>
          <label class="veld">Van<input type="time" name="vvan" value="${fmtTijd(voor.toISOString())}" step="300"></label>
          <label class="veld">Tot<input type="time" name="vtot" value="${fmtTijd(new Date(voor.getTime() + duur * 60000).toISOString())}" step="300"></label>
          <button type="button" class="knop" data-bkeuze="verplaats">Verplaatsen</button></div>
          ${c.ev.herhalend ? `<div class="hint">Dit is één keer uit een herhalende reeks: alleen deze keer wordt verplaatst.</div>` : ""}
          <div id="bdagbeeld">${dagBeeld(bkijk, { id: "__afspraak", titel }, false, { zonderEv: c.ev.id, label: "📅 " + titel })}</div></div>`
        : `<div class="hint">🕘 Verplaatsen kan Tijdkompas hier niet: ${c.ev.extId ? "deze agenda is alleen-lezen of niet op dit apparaat gekoppeld" : "deze afspraak komt via een link (alleen lezen)"}. Verplaats hem in je agenda zelf.</div>`}`}
        <button type="button" class="keuzeknop" data-bkeuze="klopt"><b>✓ Klopt zo</b><small>Niet meer melden.</small></button>
      </div>
    </div></form>`;
  dlg2.dagTik = (min) => { if (!$("#bdagbeeld", dlg2)) return; dagTikInvullen(min, "vvan", "vtot", bkijk); bBij(); };
  dlg2.oninput = (e) => { if (["vdag", "vvan", "vtot"].includes(e.target.name)) bLees(); };
  dlg2.onclick = async (e) => {
    const k = e.target.closest("[data-bkeuze]")?.dataset.bkeuze; if (!k) return;
    if (k === "klopt") { d().buitenOk = { ...(d().buitenOk || {}), [c.sleutel]: new Date().toISOString() }; bewaar(); dlg2.close(); toast("Wordt niet meer gemeld"); return; }
    if (k === "herinnering") { const alles = !!$("#bAlles", dlg2)?.checked; afspraakRegel(c.ev, "herinnering", "", alles); bewaar(); dlg2.close(); toast(`„${titel}” is ${alles ? "voortaan " : ""}een herinnering`); return; }
    if (k === "blokverplaats") { const bl = d().planning.find(y => y.id === c.blok.id); if (bl) haalBlokWeg(bl); bewaar(); if (it) naSluiten(dlg2, () => planTaak(it)); else dlg2.close(); return; }
    if (k === "verplaats") {
      const v = (n) => $(`[name=${n}]`, dlg2)?.value || "";
      const dag = v("vdag"), van = v("vvan"), tot = v("vtot");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dag) || !/^\d{2}:\d{2}$/.test(van) || !/^\d{2}:\d{2}$/.test(tot) || tot <= van) { toast("Kies een dag en van–tot"); return; }
      const knop = e.target.closest("button"); knop.disabled = true;
      try { await verplaatsAgendaAfspraak(c.ev, new Date(dag + "T" + van).toISOString(), new Date(dag + "T" + tot).toISOString()); dlg2.close(); toast(`„${titel}” verplaatst naar ${fmtDatum(dag)} ${van}`); }
      catch (err) { knop.disabled = false; toast("Verplaatsen lukte niet: " + (err?.message || err)); }
    }
  };
  dlg2.onchange = (e) => { if (["vdag", "vvan", "vtot"].includes(e.target.name)) bLees(); };
  dlg2.onclose = () => { dlg2.onclick = null; dlg2.oninput = null; dlg2.onchange = null; dlg2.dagTik = null; dlg2.onclose = null; };
  if (!dlg2.open) dlg2.showModal();
}

// ---------- werk en privé door elkaar: melden en zelf kiezen ----------
let laatsteBotsingen = [];
function botsingBlok() {
  laatsteBotsingen = rolBotsingen();
  if (!laatsteBotsingen.length) return "";
  const regel = (c, i) => { const o = overzicht(c.lijst), a = new Date(c.ev.start), b = new Date(c.ev.eind);
    return `<div class="linkrij"><span>${c.soort === "prive" ? "🏠" : "💼"}</span>
      <span><b>${dagKort(a)} ${fmtTijd(c.ev.start)}–${fmtTijd(c.ev.eind)}</b> ${esc(c.ev.titel || "Afspraak")}<br><small class="hint">${c.soort === "prive"
        ? `valt ${fmtDuur(c.min)} in je vaste tijden van ${esc(o?.icoon || "")} ${esc(o?.naam || "")}` : `${esc(o?.naam || "")}-afspraak, ${fmtDuur(c.min)} buiten je vaste tijden`}</small></span>
      <button type="button" class="knop klein" data-actie="botsing" data-w="${i}">Kiezen…</button></div>`; };
  return `<div class="paneel botsingen"><b>⚖️ Werk en privé lopen door elkaar (${laatsteBotsingen.length})</b>
    <p class="hint" style="margin:4px 0 8px">Tijd is tijd: kies per afspraak of je extra vrij neemt, het inhaalt, een dag ruilt, of het zo laat. Het geldt voor al je inlogs.</p>
    <div class="lijst">${laatsteBotsingen.slice(0, 6).map(regel).join("")}${laatsteBotsingen.length > 6 ? `<div class="hint">+ ${laatsteBotsingen.length - 6} meer</div>` : ""}</div></div>`;
}
// Eerstvolgende dag (na `vanaf`) met (of juist zonder) vaste tijden voor deze lijst
function volgendeDag(o, vanaf, metTijden) {
  for (let i = 1; i <= 28; i++) {
    const x = new Date(vanaf.getFullYear(), vanaf.getMonth(), vanaf.getDate() + i), ds = dagStr(x), wd = x.getDay();
    if (ds < vandaagStr()) continue;
    const t = dagTijden(o, ds);
    if (metTijden ? t.length : !t.length && wd >= 1 && wd <= 5) return ds;
  }
  return dagStr(new Date(vanaf.getTime() + 864e5));
}
function botsingVenster(c) {
  const o = overzicht(c.lijst); if (!o) return;
  const a = new Date(c.ev.start), b = new Date(c.ev.eind), ea = fmtTijd(c.ev.start), eb = fmtTijd(c.ev.eind);
  const titel = c.ev.titel || "Afspraak", r = raster();
  const opRaster = (m) => Math.ceil(m / r) * r;
  // voorstel voor het "andere moment"
  const dagW = volgendeDag(o, a, true), dagVrij = volgendeDag(o, a, false);
  const eindVan = (ds) => { const t = dagTijden(o, ds); return t.length ? t.at(-1).tot : "17:00"; };
  const duur = opRaster(c.min);
  const inhaalVan = eindVan(dagW), inhaalTot = hhmm(Math.min(minVan(inhaalVan) + duur, 23 * 60 + 45));
  const minderTot = eindVan(dagW), minderVan = hhmm(Math.max(0, minVan(minderTot) - duur));
  const prive = c.soort === "prive";
  const okijk = { dag: dagW, van: prive ? inhaalVan : minderVan, tot: prive ? inhaalTot : minderTot };
  const oBij = () => { const el = $("#bodagbeeld", dlg2); if (el) el.innerHTML = dagBeeld(okijk, { id: "__werk", titel: "" }, false, { label: prive ? "＋ inhalen" : "− minder werken" }); };
  const oLees = () => { const v = (n) => $(`[name=${n}]`, dlg2)?.value || ""; okijk.dag = v("bdag") || okijk.dag; okijk.van = v("bvan") || okijk.van; okijk.tot = v("btot") || okijk.tot; oBij(); };
  dlg2.dagTik = (min) => { if (!$("#bodagbeeld", dlg2)) return; dagTikInvullen(min, "bvan", "btot", okijk); oBij(); };
  dlg2.oninput = (e) => { if (["bdag", "bvan", "btot"].includes(e.target.name)) oLees(); };
  dlg2.onchange = (e) => { if (["bdag", "bvan", "btot"].includes(e.target.name)) oLees(); };
  dlg2.innerHTML = `<form method="dialog"><div class="dkop"><span class="soort">⚖️ ${prive ? "Privé in je werktijd" : "Werk in je eigen tijd"}</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <h2 style="margin:0">${esc(titel)}</h2>
      <div class="planstand">${DAGLANG[a.getDay()]} ${a.getDate()} ${MAAND[a.getMonth()]} · ${ea}–${eb} · ${prive ? `${fmtDuur(c.min)} binnen je vaste tijden van ${esc(o.icoon)} ${esc(o.naam)} (${esc(tijdenTekst(dagTijden(o, c.ds), null) || "—")})` : `${fmtDuur(c.min)} buiten je vaste tijden van ${esc(o.icoon)} ${esc(o.naam)}`}</div>
      <div class="keuzes">
        ${prive ? `<button type="button" class="keuzeknop" data-keuze="inkorten"><b>⏱ Werktijd die dag inkorten</b><small>Je neemt die ${fmtDuur(c.min)} extra vrij.</small></button>
        <button type="button" class="keuzeknop" data-keuze="inhalen"><b>🔁 Inkorten en inhalen op een ander moment</b><small>Kies hieronder wanneer je de ${fmtDuur(c.min)} inhaalt.</small></button>
        <button type="button" class="keuzeknop" data-keuze="ruilen"><b>🔀 De hele dag ruilen</b><small>Die dag vrij, en op een andere dag (hieronder) de werktijden van die dag.</small></button>`
        : `<button type="button" class="keuzeknop" data-keuze="compenseren"><b>⏱ Elders minder werken</b><small>De ${fmtDuur(c.min)} gaan op een ander moment (hieronder) van je werktijd af.</small></button>
        <button type="button" class="keuzeknop" data-keuze="dagvrij"><b>🔀 Een hele werkdag vrij in ruil</b><small>Kies hieronder welke dag.</small></button>`}
        <button type="button" class="keuzeknop" data-keuze="${prive ? "rolwerk" : "rolprive"}"><b>${prive ? "💼 Dit is eigenlijk een werkafspraak" : "🏠 Dit is eigenlijk een privé-afspraak"}</b><small>${prive ? "Staat in je privé-agenda, maar hoort bij werk: dan valt hij gewoon in je werktijd." : `Staat in je ${esc(o.naam.toLowerCase())}-agenda, maar is privé: dan telt hij als privé-tijd.`}</small></button>
        <label class="schakel" style="margin:-2px 0 4px 10px"><input type="checkbox" id="rolAlles"> Voor alle „${esc(titel)}” uit deze agenda (werk/privé en herinnering)</label>
        <button type="button" class="keuzeknop" data-keuze="laten"><b>✓ Zo laten — de werktijd van die dag eromheen leggen</b><small>${prive ? "Je werktijd die dag wordt zonder deze afspraak" : "Je werktijd die dag rekt op tot alle werkafspraken erin vallen"}, zonder iets elders te compenseren. Alle botsingen van die dag gaan zo mee, zodat duidelijk is wat werk en wat privé is.</small></button>
        ${prive ? "" : `<button type="button" class="keuzeknop" data-keuze="werkdag"><b>🗓 „${esc(titel)}” telt alleen op werkdagen</b><small>Bijv. een lunch-reservering: op dagen zonder werk staat hij er niet en zit hij niet in de weg (alle „${esc(titel)}” uit deze agenda).</small></button>`}
        <button type="button" class="keuzeknop" data-keuze="herinnering"><b>🔔 Het is een herinnering</b><small>Blijft gewoon staan (als belletje), maar telt niet als bezet en geeft geen botsing. Met het vinkje hierboven: voor alle „${esc(titel)}” uit deze agenda.</small></button>
        <button type="button" class="keuzeknop" data-keuze="verberg"><b>🙈 Deze afspraak niet meetellen</b><small>Alleen deze keer; hij staat er dan niet meer en er wordt doorheen gepland.</small></button>
      </div>
      <div class="paneel"><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Ander moment</div>
        <div class="rij" style="align-items:end">
          <label class="veld">Dag<input type="date" name="bdag" value="${prive ? dagW : dagW}"></label>
          <label class="veld">Van<input type="time" name="bvan" value="${prive ? inhaalVan : minderVan}" step="300"></label>
          <label class="veld">Tot<input type="time" name="btot" value="${prive ? inhaalTot : minderTot}" step="300"></label>
        </div>
        <div class="hint">Bij een hele dag ruilen telt alleen de dag${prive ? ` (voorstel: ${fmtDatum(dagVrij)}, een werkdag zonder vaste tijden)` : ""}.</div>
        <div id="bodagbeeld">${dagBeeld(okijk, { id: "__werk", titel: "" }, false, { label: prive ? "＋ inhalen" : "− minder werken" })}</div>
        ${prive ? `<button type="button" class="knop klein" data-actie="bdagvrij" style="margin-top:6px">Dag zonder werk voorstellen: ${fmtDatum(dagVrij)}</button>` : ""}</div>
    </div></form>`;
  dlg2.onclick = (e) => {
    const k = e.target.closest("button"); if (!k) return;
    if (k.dataset.actie === "bdagvrij") { const i = $("[name=bdag]", dlg2); i.value = dagVrij; i.setAttribute("value", dagVrij); oLees(); return; }
    const keuze = k.dataset.keuze; if (!keuze) return;
    const v = (n) => $(`[name=${n}]`, dlg2)?.value || "";
    const dag2 = v("bdag"), van2 = v("bvan"), tot2 = v("btot");
    const nodigAnder = ["inhalen", "ruilen", "compenseren", "dagvrij"].includes(keuze);
    if (nodigAnder && (!/^\d{4}-\d{2}-\d{2}$/.test(dag2) || (["inhalen", "compenseren"].includes(keuze) && (!/^\d{2}:\d{2}$/.test(van2) || !/^\d{2}:\d{2}$/.test(tot2) || tot2 <= van2)))) { toast("Kies een dag (en van–tot)"); return; }
    if (nodigAnder && dag2 === c.ds) { toast("Kies een andere dag dan die van de afspraak"); return; }
    const bij = [c.sleutel], kort = `${titel} (${fmtDatum(c.ds)})`;
    const zet = (ds, tijden, reden) => zetAfwijking(o, ds, tijden.length ? { soort: "anders", tijden, reden, bij } : { soort: "vrij", tijden: [], reden, bij });
    if (keuze === "rolwerk" || keuze === "rolprive") {
      const alles = !!$("#rolAlles", dlg2)?.checked;
      afspraakRegel(c.ev, keuze === "rolwerk" ? "werk" : "prive", o.id, alles); bewaar(); dlg2.close();
      const nog = rolBotsingen().find(x => x.ev.start === c.ev.start && x.ev.titel === c.ev.titel && x.lijst === c.lijst);
      toast(`„${titel}” telt${alles ? " voortaan" : ""} als ${keuze === "rolwerk" ? "werk" : "privé"}${nog ? ` — en valt nu ${nog.soort === "prive" ? "in je werktijd" : "buiten je werktijd"}: kies hoe` : ""}`,
        nog ? { label: "Kiezen…", f: () => botsingVenster(nog) } : undefined);
      return;
    }
    if (keuze === "herinnering") {
      const alles = !!$("#rolAlles", dlg2)?.checked;
      afspraakRegel(c.ev, "herinnering", "", alles); bewaar(); dlg2.close(); toast(`„${titel}” is ${alles ? "voortaan " : ""}een herinnering — blijft staan, telt niet`); return;
    }
    if (keuze === "werkdag" || keuze === "verberg") { afspraakRegel(c.ev, keuze, o.id); bewaar(); dlg2.close(); toast(keuze === "werkdag" ? `„${titel}” telt voortaan alleen op werkdagen` : "Deze afspraak telt niet meer mee"); return; }
    if (keuze === "laten") {
      // de grens tussen werk en privé die dag precies leggen: werkafspraken erbinnen, privé-afspraken erbuiten
      const dezeDag = rolBotsingen().filter(x => x.lijst === c.lijst && x.ds === c.ds);
      if (!dezeDag.some(x => x.sleutel === c.sleutel)) dezeDag.push(c);
      const tijdVan = (x) => fmtTijd(x.ev.start), tijdTot = (x) => dagStr(new Date(x.ev.eind)) === x.ds ? fmtTijd(x.ev.eind) : "23:59";
      let t = dagTijden(o, c.ds);
      for (const x of dezeDag.filter(x => x.soort === "werk")) t = tijdenMet(t, { van: tijdVan(x), tot: tijdTot(x), locatie: "" });
      for (const x of dezeDag.filter(x => x.soort === "prive")) t = tijdenZonder(t, tijdVan(x), tijdTot(x));
      zetAfwijking(o, c.ds, t.length ? { soort: "anders", tijden: t, reden: "Werk en privé zo gelaten", bij: dezeDag.map(x => x.sleutel) }
                                      : { soort: "vrij", tijden: [], reden: "Werk en privé zo gelaten", bij: dezeDag.map(x => x.sleutel) });
    }
    else if (keuze === "inkorten" || keuze === "inhalen") {
      zet(c.ds, tijdenZonder(dagTijden(o, c.ds), ea, eb), `Vrij voor ${titel}`);
      if (keuze === "inhalen") zet(dag2, tijdenMet(dagTijden(o, dag2), { van: van2, tot: tot2, locatie: effLijst(o).locatie || "" }), `Inhalen voor ${kort}`);
    } else if (keuze === "ruilen") {
      const oud = dagTijden(o, c.ds);
      zet(c.ds, [], `Geruild met ${fmtDatum(dag2)} (${titel})`);
      zet(dag2, oud.length ? oud : [{ van: "09:00", tot: "17:00", locatie: effLijst(o).locatie || "" }], `Geruild met ${fmtDatum(c.ds)}`);
    } else if (keuze === "compenseren" || keuze === "dagvrij") {
      // de werkafspraak zelf telt als werktijd die dag
      zet(c.ds, tijdenMet(dagTijden(o, c.ds), { van: ea, tot: eb, locatie: "" }), `Werkafspraak: ${titel}`);
      if (keuze === "compenseren") zet(dag2, tijdenZonder(dagTijden(o, dag2), van2, tot2), `Minder werken voor ${kort}`);
      else zet(dag2, [], `Vrij in ruil voor ${kort}`);
    }
    bewaar(); dlg2.close();
    toast(keuze === "laten" ? `Werktijd ${fmtDatum(c.ds)}: ${tijdenTekst(dagTijden(o, c.ds), null) || "vrij"}` : "Aangepast — geldt voor al je inlogs. Laat ⚡ Inplannen de planning erop aanpassen.",
      { label: "⚡ Inplannen", f: () => { const r2 = planAutomatisch(actieveOverzichten()); laatsteWaarschuwingen = r2.waarschuwingen; bewaar(); toast(`${r2.blokken} blokken ingepland`); } });
  };
  dlg2.onclose = () => { dlg2.onclick = null; dlg2.oninput = null; dlg2.onchange = null; dlg2.dagTik = null; dlg2.onclose = null; };
  if (!dlg2.open) dlg2.showModal();
}

// ---------- dagbeeld: zo ziet die dag eruit, met het nieuwe blok erin ----------
// Tik in een dagbeeld: het venster dat het dagbeeld toont zet dlg2.dagTik(minuten) om de begintijd te kiezen
dlg2.addEventListener("click", (e) => {
  const db = e.target.closest?.(".dagbeeld"); if (!db || !dlg2.dagTik || e.target.closest(".dbblok")) return;
  const r = db.getBoundingClientRect?.(); if (!r || !r.height) return;
  const vanU = +db.dataset.van, totU = +db.dataset.tot;
  dlg2.dagTik(vanU * 60 + (e.clientY - r.top) / r.height * (totU - vanU) * 60);
});
// Een tijd uit een dagbeeld in de van/tot-velden zetten (duur blijft gelijk, begin op het raster)
function dagTikInvullen(min, vanNaam, totNaam, kijkObj) {
  const R = raster(), duur = Math.max(R, minVan(kijkObj.tot) - minVan(kijkObj.van)), begin = Math.max(0, Math.min(Math.round(min / R) * R, 24 * 60 - duur));
  kijkObj.van = hhmm(begin); kijkObj.tot = hhmm(begin + duur);
  for (const [n, w] of [[vanNaam, kijkObj.van], [totNaam, kijkObj.tot]]) { const i = $(`[name=${n}]`, dlg2); if (i) { i.value = w; i.setAttribute("value", w); } }
}
/** Uitleg bij een reisband: van waar naar waar, hoe lang, marge, en of het past */
function reisTitel(r) {
  const naar = r.naar || locatie(r.locatie)?.naam || "", van = r.van || "";
  let t = `${VERVOER[vervoer()].icoon} ${r.richting === "terug" ? "Terug" : "Reis"}${van ? " van " + van : ""}${naar ? " naar " + naar : ""}${r.afspraak && r.richting !== "terug" ? " (" + r.afspraak + ")" : ""}: ${Math.round(r.min || minutenTussen({ start: r.a, eind: r.b }))} min`;
  if (r.km) t += ` · ${String(r.km).replace(".", ",")} km`;
  if (r.marge) t += ` + ${r.marge} min marge`;
  t += r.route ? (routeBron() === "google" ? " (Google Maps)" : " (OpenStreetMap, zonder verkeer)") : " (vaste reistijd van de locatie)";
  if (r.status === "rood") t += ` — ⛔ PAST NIET: maar ${Math.max(0, Math.round(r.beschikbaar))} min tussen de twee afspraken`;
  else if (r.status === "geel") t += ` — ⚠️ krap: ${Math.round(r.beschikbaar)} min ertussen, past alleen zonder marge — opschieten`;
  else if (r.flex) t += " — eerder weg / later terug op je werk";
  return t;
}
function dagBeeld(kijk, it, schuifMee, { zonderEv = null, label = null, wijkt: wijktFn = null } = {}) {
  if (!kijk?.dag || !/^\d{4}-\d{2}-\d{2}$/.test(kijk.dag)) return "";
  const dag = new Date(kijk.dag + "T00:00"), eindDag = new Date(dag.getTime() + 864e5), I = dagIndeling(dag), nu = new Date();
  const inDag = (x) => new Date(x.start) < eindDag && new Date(x.eind) > dag;
  const kA = /^\d{2}:\d{2}$/.test(kijk.van) ? new Date(kijk.dag + "T" + kijk.van) : null, kB = /^\d{2}:\d{2}$/.test(kijk.tot) ? new Date(kijk.dag + "T" + kijk.tot) : null;
  const eigen = d().planning.filter(b => inDag(b) && b.soort !== "reis");
  const afspr = d().bezet.filter(ev => ev.id !== zonderEv && inDag(ev) && !ev.eigen && afspraakZichtbaar(ev) && (eventSoort(ev) === "bezet" || isHerinnering(ev)));
  const fam = famAgenda(), famB = [...fam.planning.filter(b => b.soort !== "reis" && inDag(b)), ...fam.bezet.filter(ev => ev.soortF === "bezet" && !ev.eigen && inDag(ev))];
  // bereik: van de vroegste tot de laatste activiteit, minstens 7–22
  const uren = [...I.beschikbaar.flat(), ...I.vast.flatMap(v => [v.a, v.b]), ...eigen.flatMap(b => [new Date(b.start), new Date(b.eind)]), ...afspr.flatMap(e => [new Date(e.start), new Date(e.eind)]), ...(kA && kB ? [kA, kB] : [])]
    .map(t => (t - dag) / 36e5).filter(h => h >= 0 && h <= 24);
  const van = Math.max(0, Math.min(7, Math.floor(Math.min(...uren, 7)))), tot = Math.min(24, Math.max(22, Math.ceil(Math.max(...uren, 22))));
  const H = 26, hoogte = (tot - van) * H, y = (t) => ((new Date(t) - dag) / 36e5 - van) * H;
  const band = (a, b, cls, inh = "", titel = "", extra = "") => { const t = Math.max(0, y(a)), h = Math.min(hoogte, y(b)) - t; return h > 0 ? `<div class="${cls}" style="top:${t}px;height:${Math.max(h, 3)}px" title="${esc(titel)}" ${extra}>${inh}</div>` : ""; };
  const wijkt = (b) => schuifMee && kA && kB && b.item && b.item !== it.id && new Date(b.start) < kB && new Date(b.eind) > kA && (!wijktFn || wijktFn(b));
  const kort = (s) => esc(String(s || "").slice(0, 40));
  return `<div class="dbkop"><b>${DAGLANG[dag.getDay()]} ${dag.getDate()} ${MAAND[dag.getMonth()]}</b>${I.weg ? " · ✈️ weg" : ""}<span class="hint"> · zo ziet die dag eruit${kA && kB ? " met het nieuwe blok" : ""}</span></div>
  <div class="dagbeeld" data-van="${van}" data-tot="${tot}" style="height:${hoogte}px">
    ${Array.from({ length: tot - van + 1 }, (_, i) => `<div class="dbuur" style="top:${i * H}px">${String(van + i).padStart(2, "0")}:00</div>`).join("")}
    ${I.beschikbaar.map(([a, b]) => band(a, b, "dbbeschikb", "", "Beschikbaar")).join("")}
    ${I.vast.map(v => band(v.a, v.b, "dbvenster", `<span>${esc(overzicht(v.lijst)?.icoon || "")}</span>`, `${overzicht(v.lijst)?.naam || ""} (vaste tijden)`)).join("")}
    ${I.reis.map(r => band(r.a, r.b, `dbreis${r.status && r.status !== "ok" ? " " + r.status : ""}`, r.status === "rood" ? "⛔" : r.status === "geel" ? "⚠️" : VERVOER[vervoer()].icoon, reisTitel(r))).join("")}
    ${famB.map(b => band(b.start, b.eind, "dbblok dbfam", kort(b.titel), `${b.titel} · ${b.vanFamilie || "andere inlog"}`)).join("")}
    ${afspr.map(ev => isHerinnering(ev) ? band(ev.start, new Date(new Date(ev.start).getTime() + 15 * 60000), "dbblok dbherinn", "🔔 " + kort(ev.titel), ev.titel + " (herinnering)")
      : band(ev.start, ev.eind, "dbblok dbafspraak", "📅 " + kort(ev.titel), `${ev.titel} ${fmtTijd(ev.start)}–${fmtTijd(ev.eind)}`)).join("")}
    ${eigen.map(b => band(b.start, b.eind, `dbblok dbeigen${b.item === it.id ? " dbzelf" : ""}${wijkt(b) ? " dbwijkt" : ""}`, (wijkt(b) ? "⏩ " : "") + kort(b.titel), `${b.titel} ${fmtTijd(b.start)}–${fmtTijd(b.eind)}${wijkt(b) ? " — schuift door naar het volgende lege moment" : ""}`, `style="--ok:${ovKleur(b.overzicht)}"`).replace('style="top', `style="--ok:${ovKleur(b.overzicht)};top`).replace(` style="--ok:${ovKleur(b.overzicht)}"`, "")).join("")}
    ${kA && kB && kB > kA ? band(kA, kB, "dbblok dbnieuw", (label ? "" : "＋ ") + kort(label || it.titel), `Nieuw: ${kijk.van}–${kijk.tot}`) : ""}
    ${dagStr(nu) === kijk.dag ? `<div class="dbnu" style="top:${y(nu)}px"></div>` : ""}
  </div>
  ${eigen.some(wijkt) ? `<div class="hint">⏩ ${eigen.filter(wijkt).map(b => "„" + esc(b.titel) + "”").join(", ")} ${eigen.filter(wijkt).length === 1 ? "schuift" : "schuiven"} door naar het volgende lege moment.</div>` : ""}`;
}

// ---------- weekrooster: per dag hoe lang en waar ----------
const minVan = (hhmm) => { const [h, m] = String(hhmm || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const hhmm = (min) => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
const duurVak = (t) => Math.max(0, minVan(t.tot) - minVan(t.van));
function roosterLijst(sleutel) {
  if (sleutel === "besch") return d().beschikbaar;
  const o = overzicht(sleutel.slice(3)); if (!o) return null;
  o.tijden ||= []; return o.tijden;
}
// Een tijdvak dat voor meerdere dagen geldt, splitsen zodat je één dag apart kunt aanpassen
function losMaken(lijst, i, dg) {
  const t = lijst[i]; if (!t) return null;
  if ((t.dagen || []).length <= 1) return t;
  t.dagen = t.dagen.filter(x => x !== dg);
  const n = { ...structuredClone(t), dagen: [dg] }; lijst.push(n); return n;
}
function weekRooster(lijst, sleutel, { metLocatie = false, leeg = "vrij" } = {}) {
  let week = 0;
  const rijen = DAGVOLGORDE.map(dg => {
    const slots = lijst.map((t, i) => ({ t, i })).filter(({ t }) => (t.dagen || []).includes(dg)).sort((a, b) => a.t.van.localeCompare(b.t.van));
    const totaal = slots.reduce((s, { t }) => s + duurVak(t), 0); week += totaal;
    return `<div class="rdag${slots.length ? "" : " leeg"}"><b class="rdnaam" title="${DAGLANG[dg]}">${DAG[dg]}</b>
      <div class="rdslots">${slots.map(({ t, i }) => `<div class="rslot" data-ri="${i}" data-dg="${dg}">
        <input type="time" value="${esc(t.van)}" data-rveld="van" aria-label="${DAGLANG[dg]} van"><span>–</span><input type="time" value="${esc(t.tot)}" data-rveld="tot" aria-label="${DAGLANG[dg]} tot">
        ${metLocatie ? `<select data-rveld="locatie" aria-label="Waar op ${DAGLANG[dg]}">${locOpties(t.locatie || "", "geen vaste plek")}</select>` : ""}
        <button type="button" class="x" data-actie="roosterWeg" title="Dit tijdvak op ${DAGLANG[dg]} weghalen">✕</button></div>`).join("") || `<span class="hint">${leeg}</span>`}</div>
      <span class="rdduur">${totaal ? fmtDuur(totaal) : ""}</span>
      <button type="button" class="knop klein" data-actie="roosterBij" data-w="${dg}" title="Tijdvak toevoegen op ${DAGLANG[dg]}">＋</button></div>`;
  }).join("");
  return `<div class="rooster" data-rooster="${esc(sleutel)}">${rijen}<div class="rtotaal">Per week: <b>${fmtDuur(week) || "0"}</b></div></div>`;
}
function roosterKlik(el, a) {
  const r = el.closest("[data-rooster]"), lijst = r && roosterLijst(r.dataset.rooster); if (!lijst) return;
  const besch = r.dataset.rooster === "besch";
  if (a === "roosterBij") {
    const dg = +el.dataset.w;
    const zelfde = lijst.filter(t => t.dagen.includes(dg)).sort((x, y) => y.tot.localeCompare(x.tot))[0];
    // tweede tijdvak op dezelfde dag (bijv. gesplitste dienst) of de tijden van de dag ervoor overnemen
    const vorige = DAGVOLGORDE.slice(0, DAGVOLGORDE.indexOf(dg)).reverse().map(x => lijst.find(t => t.dagen.includes(x))).find(Boolean) || lijst[0];
    const nieuw = zelfde ? { van: hhmm(Math.min(minVan(zelfde.tot) + 60, 22 * 60)), tot: hhmm(Math.min(minVan(zelfde.tot) + 240, 23 * 60 + 45)), locatie: zelfde.locatie || "" }
      : vorige ? { van: vorige.van, tot: vorige.tot, locatie: vorige.locatie || "" } : besch ? { van: "07:00", tot: "22:30" } : { van: "09:00", tot: "17:00", locatie: "" };
    if (besch) delete nieuw.locatie;
    lijst.push({ dagen: [dg], ...nieuw });
  } else if (a === "roosterWeg") {
    const s = el.closest("[data-ri]"), i = +s.dataset.ri, dg = +s.dataset.dg, t = lijst[i]; if (!t) return;
    if (besch && lijst.length === 1 && t.dagen.length === 1) { toast("Er moet minstens één tijdvak blijven"); return; }
    if (t.dagen.length > 1) t.dagen = t.dagen.filter(x => x !== dg); else lijst.splice(i, 1);
  }
  bewaar();
}
function roosterWijzig(e) {
  const s = e.target.closest("[data-ri]"), r = e.target.closest("[data-rooster]"), lijst = r && roosterLijst(r.dataset.rooster);
  if (!s || !lijst) return false;
  const t = losMaken(lijst, +s.dataset.ri, +s.dataset.dg); if (!t) return true;
  const veld = e.target.dataset.rveld, w = e.target.value;
  if ((veld === "van" || veld === "tot") && !/^\d{2}:\d{2}$/.test(w)) { render(); return true; }
  t[veld] = w;
  if (minVan(t.tot) <= minVan(t.van)) toast("Let op: de eindtijd ligt vóór de begintijd; dit tijdvak telt zo niet mee");
  bewaar(); return true;
}

// ---------- afwijkende weken: vakantie, cursus, geruilde dag, dagdeel vrij ----------
function weekNr(x) {
  const t = new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())), dn = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dn + 3);
  const j = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t - j) / 864e5 - 3 + ((j.getUTCDay() + 6) % 7)) / 7);
}
const maandagVan = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate() - ((x.getDay() + 6) % 7));
const vasteLijsten = () => d().overzichten.filter(o => !o.slot && effLijst(o).modus === "vast");
function dagLabel(I) {
  if (I.weg) return { kort: "✈️", titel: "Hele dag weg" + (I.weg.reden ? ": " + I.weg.reden : "") };
  if (!I.afwijkingen.length) return null;
  return { kort: [...new Set(I.afwijkingen.map(a => AFWIJKING[a.soort]?.icoon || ""))].join(""),
           titel: I.afwijkingen.map(a => `${overzicht(a.lijst)?.naam || ""}: ${AFWIJKING[a.soort]?.naam || ""}${a.reden ? " — " + a.reden : ""}`).join("\n") + "\n(klik om aan te passen)" };
}
const tijdenTekst = (tijden, o) => (tijden || []).map(t => `${t.van}–${t.tot}${t.locatie && locatie(t.locatie) && t.locatie !== o?.locatie ? " " + locatie(t.locatie).icoon + " " + locatie(t.locatie).naam : ""}`).join(", ");
// Tijden waarmee een afwijking begint: die van die dag, anders de meest gebruikte van de lijst
function beginTijden(o, weekdag) {
  const st = standaardTijden(o, weekdag);
  o = effLijst(o);
  if (st.length) return st.map(t => ({ van: t.van, tot: t.tot, locatie: t.locatie ?? o.locatie ?? "" }));
  const t = (o.tijden || [])[0];
  return [t ? { van: t.van, tot: t.tot, locatie: t.locatie ?? o.locatie ?? "" } : { van: "09:00", tot: "17:00", locatie: o.locatie || "" }];
}
// Dagdeel vrij: de dag in tweeën knippen (midden afgerond op een half uur)
function dagdeel(o, weekdag, welk) {
  const st = beginTijden(o, weekdag), a = Math.min(...st.map(t => minVan(t.van))), b = Math.max(...st.map(t => minVan(t.tot)));
  const mid = Math.round((a + b) / 2 / 30) * 30;
  const [x, y] = welk === "ochtend" ? [mid, b] : [a, mid];
  return st.map(t => ({ ...t, van: hhmm(Math.max(minVan(t.van), x)), tot: hhmm(Math.min(minVan(t.tot), y)) })).filter(t => minVan(t.tot) > minVan(t.van));
}
function openWeek(begin) {
  let ma = maandagVan(begin ? new Date(begin + "T12:00") : new Date());
  let periode = { van: "", tot: "", soort: "vrij", reden: "" };
  const teken = () => {
    const dagen = Array.from({ length: 7 }, (_, i) => new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i));
    const lijsten = vasteLijsten(), zo = dagen[6];
    const vandaag = vandaagStr();
    const dagRij = (dag) => {
      const ds = dagStr(dag), wd = dag.getDay(), weg = d().afwezig?.[ds];
      return `<div class="wdagrij${weg ? " weg" : ""}${ds === vandaag ? " vandaag" : ""}${ds < vandaag ? " voorbij" : ""}" data-ds="${ds}">
        <div class="wdkop"><b>${DAGLANG[wd][0].toUpperCase() + DAGLANG[wd].slice(1)} ${dag.getDate()} ${MAAND[dag.getMonth()]}</b>
          <label class="schakel" title="Vakantie of anders weg: die dag wordt niets ingepland, ook niet uit andere lijsten"><input type="checkbox" data-weg ${weg ? "checked" : ""}> ✈️ Hele dag weg</label>
          ${weg ? `<input type="text" data-wegreden value="${esc(weg.reden || "")}" placeholder="Reden, bijv. vakantie" maxlength="100" aria-label="Reden">` : ""}</div>
        ${weg ? "" : lijsten.map(o => {
          const afw = afwijkingOp(o, ds), st = standaardTijden(o, wd);
          const stTekst = st.length ? tijdenTekst(st, null) : "geen vaste tijden";
          return `<div class="wdlijst" data-wl="${o.id}" style="--ok:${esc(o.kleur)}">
            <span class="wdnaam">${esc(o.icoon)} ${esc(o.naam)}</span>
            <select data-wsoort aria-label="${esc(o.naam)} op ${DAGLANG[wd]}">
              <option value="" ${afw ? "" : "selected"}>Zoals altijd (${esc(stTekst)})</option>
              ${Object.entries(AFWIJKING).map(([k, x]) => `<option value="${k}" ${afw?.soort === k ? "selected" : ""}>${x.icoon} ${x.naam}</option>`).join("")}
            </select>
            ${!afw && st.length ? `<span class="chips"><button type="button" data-actie="halfVrij" data-w="ochtend" title="Alleen 's middags werken">🌅 Ochtend vrij</button><button type="button" data-actie="halfVrij" data-w="middag" title="Alleen 's ochtends werken">🌇 Middag vrij</button></span>` : ""}
            ${afw ? `<div class="wddetail">
              ${afw.soort === "vrij" ? "" : (afw.tijden || []).map((t, i) => `<div class="rslot" data-wi="${i}">
                <input type="time" value="${esc(t.van)}" data-wveld="van" aria-label="Van"><span>–</span><input type="time" value="${esc(t.tot)}" data-wveld="tot" aria-label="Tot">
                <select data-wveld="locatie" aria-label="Waar">${locOpties(t.locatie || "", "geen vaste plek")}</select>
                <button type="button" class="x" data-actie="wTijdWeg" title="Weghalen">✕</button></div>`).join("")}
              ${afw.soort === "vrij" ? "" : `<button type="button" class="knop klein" data-actie="wTijdBij">＋ tijdvak</button>`}
              <input type="text" data-wreden value="${esc(afw.reden || "")}" maxlength="100" placeholder="${afw.soort === "vrij" ? "Reden, bijv. vakantie of geruild met woensdag" : afw.soort === "bezet" ? "Wat, bijv. cursus projectleiden" : "Reden, bijv. geruild met vrijdag"}" aria-label="Reden">
              <span class="hint">${esc(AFWIJKING[afw.soort].uitleg)}</span></div>` : ""}
          </div>`; }).join("")}
      </div>`;
    };
    // komende afwijkingen (overzicht)
    const komend = [];
    for (const [ds, x] of Object.entries(d().afwezig || {})) if (ds >= vandaag) komend.push({ ds, tekst: `✈️ Hele dag weg${x.reden ? " — " + x.reden : ""}`, weg: true });
    for (const o of lijsten) for (const ds of afwijkingDatums(o).filter(x => x >= vandaag)) { const x = afwijkingOp(o, ds);
      komend.push({ ds, lijst: o.id, tekst: `${o.icoon} ${o.naam}: ${AFWIJKING[x.soort].icoon} ${AFWIJKING[x.soort].naam}${x.tijden?.length ? " " + tijdenTekst(x.tijden, o) : ""}${x.reden ? " — " + x.reden : ""}` }); }
    komend.sort((a, b) => a.ds.localeCompare(b.ds));
    dlg2.innerHTML = `<form method="dialog" id="weekForm"><div class="dkop"><span class="soort">🗓️ Week aanpassen</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <div class="weeknav"><button type="button" class="knop klein" data-wnav="-1" aria-label="Vorige week">◀</button>
        <b>Week ${weekNr(ma)} · ${ma.getDate()} ${MAAND[ma.getMonth()]} – ${zo.getDate()} ${MAAND[zo.getMonth()]} ${zo.getFullYear()}</b>
        <button type="button" class="knop klein" data-wnav="1" aria-label="Volgende week">▶</button>
        ${maandagVan(new Date()).getTime() === ma.getTime() ? "" : `<button type="button" class="knop klein" data-wnav="0">Deze week</button>`}</div>
      <p class="hint" style="margin:0">Alleen voor deze datums; je gewone weekrooster blijft zoals het is${lijsten.length ? ` (aan te passen bij ⚙️ ${lijsten.map(o => esc(o.naam)).join(", ")})` : ""}.
        Geruilde dag? Zet de oude dag op 🏖️ Vrij en de nieuwe op 🕘 Andere tijden.</p>
      ${lijsten.length ? "" : `<div class="hint">Je hebt nog geen lijst met 🕘 vaste tijden (zoals Werk). Die stel je in bij een lijst → Soort: Vaste tijden. „Hele dag weg” werkt altijd.</div>`}
      <div class="weekdagen">${dagen.map(dagRij).join("")}</div>
      <details class="paneel"><summary><b>Langere periode in één keer</b> <span class="hint">— bijv. twee weken vakantie</span></summary>
        <div class="rij" style="align-items:end;margin-top:8px">
          <label class="veld">Van<input type="date" name="pvan" value="${esc(periode.van)}"></label>
          <label class="veld">Tot en met<input type="date" name="ptot" value="${esc(periode.tot)}"></label>
          <label class="veld">Wat<select name="psoort"><option value="vrij" ${periode.soort === "vrij" ? "selected" : ""}>🏖️ Vrij van ${lijsten.length === 1 ? esc(lijsten[0].naam) : "vaste tijden"} (vrije tijd blijft)</option><option value="weg" ${periode.soort === "weg" ? "selected" : ""}>✈️ Helemaal weg: niets inplannen</option></select></label>
          <label class="veld">Reden<input type="text" name="preden" value="${esc(periode.reden)}" placeholder="bijv. zomervakantie" maxlength="100"></label>
          <button type="button" class="knop" data-actie="periode">Toepassen</button></div></details>
      ${komend.length ? `<div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Komende afwijkingen</div><div class="lijst">${komend.slice(0, 40).map(k =>
        `<div class="linkrij"><button type="button" class="knop klein" data-naarweek="${k.ds}">${dagKort(new Date(k.ds + "T12:00"))}</button><span>${esc(k.tekst)}</span>
          <button type="button" class="x" data-afwweg="${k.ds}" data-afwlijst="${k.lijst || ""}" title="Weghalen (weer zoals altijd)">✕</button></div>`).join("")}${komend.length > 40 ? `<div class="hint">+ ${komend.length - 40} meer</div>` : ""}</div></div>` : ""}
    </div>
    <div class="dvoet"><span class="hint">Klaar? Laat ⚡ Automatisch inplannen de planning hierop aanpassen.</span><div class="rechts"><button type="button" class="knop" data-actie="wPlan">⚡ Opnieuw inplannen</button><button class="knop prim" value="ok">Klaar</button></div></div></form>`;
  };
  const rij = (el) => { const r = el.closest("[data-ds]"); return r ? { ds: r.dataset.ds, wd: new Date(r.dataset.ds + "T12:00").getDay() } : null; };
  const lijstVan = (el) => overzicht(el.closest("[data-wl]")?.dataset.wl);
  const zetAfw = (o, ds, x) => zetAfwijking(o, ds, x);
  const leesPeriode = () => { const v = (n) => $(`[name=${n}]`, dlg2)?.value ?? ""; if ($("#weekForm")) periode = { van: v("pvan"), tot: v("ptot"), soort: v("psoort") || "vrij", reden: v("preden").trim() }; };
  dlg2.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.wnav !== undefined) { leesPeriode(); ma = b.dataset.wnav === "0" ? maandagVan(new Date()) : new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + 7 * +b.dataset.wnav); teken(); return; }
    if (b.dataset.naarweek) { leesPeriode(); ma = maandagVan(new Date(b.dataset.naarweek + "T12:00")); teken(); return; }
    if (b.dataset.afwweg) {
      const ds = b.dataset.afwweg;
      if (b.dataset.afwlijst) { const o = overzicht(b.dataset.afwlijst); if (o) zetAfw(o, ds, null); }
      else { d().afwezig = { ...(d().afwezig || {}) }; delete d().afwezig[ds]; }
      leesPeriode(); bewaar(); teken(); return;
    }
    const a = b.dataset.actie;
    if (a === "halfVrij") {
      const r = rij(b), o = lijstVan(b); if (!r || !o) return;
      zetAfw(o, r.ds, { soort: "anders", tijden: dagdeel(o, r.wd, b.dataset.w), reden: b.dataset.w === "ochtend" ? "Ochtend vrij" : "Middag vrij" });
    } else if (a === "wTijdBij") {
      const r = rij(b), o = lijstVan(b), x = afwijkingOp(o, r.ds); if (!x) return;
      const laatste = x.tijden.at(-1);
      zetAfw(o, r.ds, { ...x, tijden: [...x.tijden, laatste ? { van: laatste.tot, tot: hhmm(Math.min(minVan(laatste.tot) + 120, 23 * 60 + 45)), locatie: laatste.locatie } : beginTijden(o, r.wd)[0]] });
    } else if (a === "wTijdWeg") {
      const r = rij(b), o = lijstVan(b), x = afwijkingOp(o, r.ds), i = +b.closest("[data-wi]").dataset.wi; if (!x) return;
      const tijden = x.tijden.filter((_, j) => j !== i);
      zetAfw(o, r.ds, tijden.length ? { ...x, tijden } : { ...x, soort: "vrij", tijden: [] });
    } else if (a === "periode") {
      leesPeriode();
      const { van, tot, soort, reden } = periode;
      if (!van || !tot || tot < van) { toast("Kies een begin- en einddatum"); return; }
      const lijsten = vasteLijsten(); let n = 0;
      for (let x = new Date(van + "T12:00"), i = 0; dagStr(x) <= tot && i < 400; x.setDate(x.getDate() + 1), i++) {
        const ds = dagStr(x);
        if (soort === "weg") { d().afwezig = { ...(d().afwezig || {}), [ds]: { reden } }; n++; }
        else for (const o of lijsten) if (standaardTijden(o, x.getDay()).length) { zetAfw(o, ds, { soort: "vrij", tijden: [], reden }); n++; }
      }
      if (!n) { toast(soort === "weg" ? "Geen dagen in die periode" : "In die periode zijn geen dagen met vaste tijden"); return; }
      ma = maandagVan(new Date(van + "T12:00")); periode = { van: "", tot: "", soort, reden: "" };
      toast(soort === "weg" ? `${n} ${n === 1 ? "dag" : "dagen"} op „weg” gezet` : `${n} ${n === 1 ? "dag" : "dagen"} vrij gezet`);
    } else if (a === "wPlan") {
      const r = planAutomatisch(actieveOverzichten()); laatsteWaarschuwingen = r.waarschuwingen; bewaar(); dlg2.close();
      toast(`${r.blokken} blokken ingepland${r.waarschuwingen.length ? " · " + r.waarschuwingen.length + " waarschuwing(en)" : ""}`); return;
    } else return;
    leesPeriode(); bewaar(); teken();
  };
  dlg2.onchange = (e) => {
    const t = e.target, r = rij(t);
    if (t.name?.startsWith("p")) return;                       // periodevelden: pas bij Toepassen
    if (!r) return;
    if (t.matches("[data-weg]")) { d().afwezig = { ...(d().afwezig || {}) }; if (t.checked) d().afwezig[r.ds] = { reden: "" }; else delete d().afwezig[r.ds]; }
    else if (t.matches("[data-wegreden]")) { d().afwezig = { ...(d().afwezig || {}), [r.ds]: { reden: t.value.trim().slice(0, 100) } }; }
    else {
      const o = lijstVan(t); if (!o) return;
      const x = afwijkingOp(o, r.ds);
      if (t.matches("[data-wsoort]")) {
        const soort = t.value;
        zetAfw(o, r.ds, !soort ? null : { soort, reden: x?.reden || "", tijden: soort === "vrij" ? [] : (x?.tijden?.length ? x.tijden : beginTijden(o, r.wd)) });
      } else if (t.matches("[data-wreden]") && x) zetAfw(o, r.ds, { ...x, reden: t.value.trim().slice(0, 100) });
      else if (t.dataset.wveld && x) {
        const i = +t.closest("[data-wi]").dataset.wi, veld = t.dataset.wveld;
        if ((veld === "van" || veld === "tot") && !/^\d{2}:\d{2}$/.test(t.value)) { teken(); return; }
        zetAfw(o, r.ds, { ...x, tijden: x.tijden.map((y, j) => j === i ? { ...y, [veld]: t.value } : y) });
      } else return;
    }
    leesPeriode(); bewaar(); teken();
  };
  dlg2.onkeydown = (e) => { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type === "text") { e.preventDefault(); e.target.blur(); } };
  dlg2.onclose = () => { dlg2.onkeydown = null; dlg2.onclose = null; };
  teken();
  if (!dlg2.open) dlg2.showModal();
}

// ---------- blok in agenda ----------
function openBlok(id) {
  const b = d().planning.find(x => x.id === id); if (!b) return;
  const it = b.type === "project" ? project(b.item) : taak(b.item);
  dlg2.innerHTML = `<form method="dialog"><div class="dkop"><span class="soort" style="color:${ovKleur(b.overzicht)}">Ingepland blok</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf"><h2>${esc(b.titel)}</h2>
      <div class="hint">${DAG[new Date(b.start).getDay()]} ${new Date(b.start).getDate()} ${MAAND[new Date(b.start).getMonth()]} · ${fmtTijd(b.start)}–${fmtTijd(b.eind)}${b.locatie && locatie(b.locatie) ? " · 📍 " + esc(locatie(b.locatie).naam) : ""}</div>
      ${d().extern?.[b.id] ? `<div class="hint">✓ Staat in je agenda (${esc(agendaNaam(d().extern[b.id].bron) || d().agendas[d().extern[b.id].bron]?.naam || "")})</div>`
        : doelAgendaVan(b) ? `<div class="hint">Komt in ${esc(agendaNaam(doelAgendaVan(b)))} bij „📤 In mijn agenda zetten”.</div>`
        : viaEigenaar(b) ? `<div class="hint">🔗 Komt in de agenda van ${esc(viaEigenaar(b).email || "je andere account")}: dat account zet het erin zodra Tijdkompas daar open is.</div>` : ""}
      ${b.soort !== "reis" && Object.entries(d().agendas || {}).some(([k, a]) => a.schrijf && verbindingVanBron(k)) ? `<label class="veld">In welke agenda<select id="blokAgenda">${blokAgendaOpties(b.agenda || "", standaardAgenda(b), viaEigenaar(b))}</select></label>` : ""}
      <div class="chips"><a class="knop" target="_blank" rel="noopener" href="${esc(googleLink(b))}">＋ Google Agenda</a>
        <a class="knop" target="_blank" rel="noopener" href="${esc(outlookLink(b, true))}">＋ Outlook (werk/school)</a>
        <a class="knop" target="_blank" rel="noopener" href="${esc(outlookLink(b, false))}">＋ Outlook.com</a></div>
      <label class="schakel"><input type="checkbox" id="blokVast" ${b.vast ? "checked" : ""}> 📌 Vastzetten (blijft staan bij opnieuw inplannen)</label>
    </div>
    <div class="dvoet"><button type="button" class="knop gevaar" data-actie="blokWeg">Blok verwijderen</button>
      <div class="rechts">${it && b.soort !== "reis" ? `<button type="button" class="knop" data-actie="blokPlan" title="Ander moment kiezen">📅 Verplaatsen</button>` : ""}${it ? `<button type="button" class="knop" data-actie="blokItem">Open ${b.type === "project" ? "project" : "taak"}</button>` : ""}<button class="knop prim" value="ok">Sluiten</button></div></div></form>`;
  dlg2.onclick = (e) => {
    const a = e.target.closest("button")?.dataset.actie;
    if (a === "blokWeg") { if (b.soort === "reis") d().planning = d().planning.filter(x => x !== b); else haalBlokWeg(b); bewaar(); dlg2.close(); }
    if (a === "blokItem") { dlg2.close(); openEditor(it); }
    if (a === "blokPlan") { haalBlokWeg(b); bewaar(); dlg2.onclick = null; dlg2.onchange = null; planTaak(it); }
  };
  dlg2.onchange = (e) => {
    if (e.target.id === "blokVast") { b.vast = e.target.checked; bewaar(); }
    if (e.target.id === "blokAgenda") {
      if (e.target.value) b.agenda = e.target.value; else delete b.agenda;
      b.vast = true; bewaar();                                    // eigen keuze: blok vastzetten zodat het niet vervalt
      const box = $("#blokVast", dlg2); if (box) box.checked = true;
      doeNaarAgenda(new Set([b.id])).catch(() => {});             // verplaatsen naar de nieuwe agenda (of eruit halen)
    }
  };
  dlg2.onclose = null;
  dlg2.showModal();
}

// ---------- snelinvoer ----------
function verwerkSnel(tekst) {
  let t = " " + tekst + " ", v = { urgent: false, belangrijk: true };
  const neem = (re, f) => { t = t.replace(re, (...m) => { f(...m); return " "; }); };
  neem(/\s~\s*(\S+)/g, (_, x) => v.schatting = leesDuur(x));
  neem(/\s!(u|urgent)(?=\s)/gi, () => v.urgent = true);
  neem(/\s!(nb|niet-belangrijk)(?=\s)/gi, () => v.belangrijk = false);
  neem(/\s!(b|belangrijk)(?=\s)/gi, () => v.belangrijk = true);
  neem(/\s\^(\S+)/g, (_, x) => v.deadline = leesDatum(x));
  neem(/\s\+(\S+)/g, (_, x) => { const o = d().overzichten.find(o => o.naam.toLowerCase().startsWith(x.toLowerCase())); if (o) v.overzicht = o.id; });
  neem(/\s#(\S+)/g, (_, x) => { const p = d().projecten.find(p => p.status !== "klaar" && p.titel.toLowerCase().includes(x.toLowerCase())); if (p) { v.project = p.id; v.overzicht = p.overzicht; } });
  const namen = [];
  neem(/\s@(\S+)/g, (_, x) => namen.push(x.toLowerCase()));
  v.titel = t.replace(/\s+/g, " ").trim();
  if (!v.overzicht) v.overzicht = actieveOverzichten()[0];
  if (namen.length) {
    const o = overzicht(v.overzicht), pers = personen(o), nieuw = [];
    if (namen.includes("team") || namen.includes("iedereen")) v.wie = [];
    else v.wie = [...new Set(namen.map(n => {
      if (n === "ik" || n === "mij") return mijnId();
      const p = pers.find(p => !p.ik && p.naam.toLowerCase().startsWith(n));
      if (p) return p.id;
      // onbekend in deze lijst: iemand zonder Tijdkompas erbij zetten (bekende naam uit een andere lijst, anders zoals getypt)
      const elders = d().overzichten.flatMap(x => x.mensen || []).find(m => m.toLowerCase().startsWith(n));
      const naam = elders || n[0].toUpperCase() + n.slice(1);
      o.mensen = [...(o.mensen || []), naam]; nieuw.push(naam); return "~" + naam;
    }))];
    if (nieuw.length) setTimeout(() => toast(`${nieuw.join(", ")} toegevoegd aan „${o.naam}”`), 2700);
  }
  if (!v.titel) return null;
  if (!v.deadline) delete v.deadline;
  if (!v.overzicht) { eersteLijst(); return null; }
  return nieuweTaak(v);
}
function leesDatum(x) {
  x = x.toLowerCase(); const n = new Date();
  if (x === "vandaag") return vandaagStr();
  if (x === "morgen") { n.setDate(n.getDate() + 1); return dagStr(n); }
  if (x === "overmorgen") { n.setDate(n.getDate() + 2); return dagStr(n); }
  const di = DAG.findIndex(dg => x.startsWith(dg));
  if (di >= 0 && x.length <= 9) { let s = (di - n.getDay() + 7) % 7 || 7; n.setDate(n.getDate() + s); return dagStr(n); }
  const m = x.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (m) { let j = m[3] ? +m[3] : n.getFullYear(); if (j < 100) j += 2000; const dt = new Date(j, m[2] - 1, +m[1]); if (!m[3] && dt < new Date(n.toDateString())) dt.setFullYear(j + 1); return dagStr(dt); }
  return "";
}

// ---------- bestanden ----------
function download(naam, inhoud, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([inhoud], { type })); a.download = naam; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function kiesBestand(accept) {
  return new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.multiple = true;
    i.onchange = async () => res(await Promise.all([...i.files].map(f => f.text().then(t => ({ naam: f.name, tekst: t }))))); i.click(); });
}

// ---------- event-delegatie in hoofdvenster ----------
async function hoofdKlik(e) {
  if (e.target.closest(".bspagina")) return;            // boodschappen: eigen afhandeling (boodschappen.js)
  const wk = e.target.closest("[data-wketen],[data-wsoort]");
  if (wk) {                                             // winkel bij een locatie: welke supermarkten en soorten winkels er zitten
    const l = locatie(wk.closest("[data-loc]")?.dataset.loc); if (!l) return;
    const veld = wk.dataset.wketen ? "ketens" : "soorten", w = wk.dataset.wketen || wk.dataset.wsoort, set = new Set(l[veld] || []);
    set.has(w) ? set.delete(w) : set.add(w); l[veld] = [...set]; winkelOpen.add(l.id); bewaar(); return;
  }
  const ek = e.target.closest("[data-emoji]");
  if (ek) {
    const orij = ek.closest("[data-ov]"), mrij = ek.closest("[data-map]"), lrij = ek.closest("[data-loc]");
    const x = orij ? overzicht(orij.dataset.ov) : mrij ? map(mrij.dataset.map) : lrij ? locatie(lrij.dataset.loc) : null;
    if (x) kiesEmoji(ek, { naam: x.naam, soort: orij ? "lijst" : mrij ? "map" : "locatie", huidig: x.icoon }, (v) => { x.icoon = v; bewaar(); });
    return;
  }
  if (e.target.closest("[data-bookmarklet]")) { e.preventDefault(); alert("Sleep deze knop naar je bladwijzerbalk."); return; }
  const ins = e.target.closest("[data-inst]");
  if (ins) { openInst(ins.dataset.inst); return; }
  if (e.target.closest("a[href^='http']")) return;
  const tabLink = e.target.closest("[data-tab]");
  if (tabLink) { voorkeur.zet("instTab", tabLink.dataset.tab); }
  const kk = e.target.closest("[data-koppel],[data-nee],[data-ontkoppel],[data-afspraak]");
  if (kk) {
    const [aid, tid] = (kk.dataset.koppel || kk.dataset.nee || kk.dataset.ontkoppel || "").split("|"), a = afspraak(aid || kk.dataset.afspraak);
    if (kk.dataset.afspraak) openAfspraak(a);
    else if (kk.dataset.koppel) { koppelKoers(taak(tid), aid); bewaar(); }
    else if (kk.dataset.nee) { a.nee.push(tid); bewaar(); }
    else { a.taken = a.taken.filter(x => x !== tid); bewaar(); }
    return;
  }
  const vink = e.target.closest(".vink");
  const pl = e.target.closest("[data-plan]");
  if (pl) { planTaak(pl.dataset.ptype === "project" ? project(pl.dataset.plan) : taak(pl.dataset.plan)); return; }
  const el = e.target.closest("[data-actie]");
  if (vink) {
    const rij = vink.closest("[data-id]"); const t = rij.dataset.type === "project" ? project(rij.dataset.id) : taak(rij.dataset.id);
    if (t.status === "klaar") { heropen(t); toast("Heropend"); } else vraagAfronden(t);
    return;
  }
  if (el && el.tagName !== "FORM" && el.tagName !== "DIV" || (el?.tagName === "DIV" && e.target.closest("button[data-w]"))) {
    const a = el.dataset.actie, w = e.target.closest("[data-w]")?.dataset.w;
    if (a === "leeg") {
      if (!confirm(`Alles wissen en opnieuw beginnen, alsof je nieuw bent?

Weg gaan: lijsten, mappen, taken, projecten, planning, koersafspraken, kleuren en koppelingen${ingelogd() ? " — voor al je gekoppelde accounts en apparaten" : ""}.
Blijven: gedeelde lijsten van anderen${ingelogd() ? ", en welke accounts bij dit Tijdkompas horen" : ""}. Wat in Google of Outlook staat blijft daar staan; alleen de blokken die Tijdkompas in je agenda had gezet worden weggehaald.`)) return;
      el.disabled = true; toast("Bezig met wissen…");
      try { if (verbindingen().length) { d().planning = []; await zetNaarAgendas(); } } catch {}   // ingeplande blokken uit je agenda halen
      for (const v of alleVerbindingen()) { try { await ontkoppel(v); } catch {} }
      d().overzichten.forEach(o => lijstWeg(o.id)); opslag.wis();
      actief = null; for (const k of ["actief", "instTab"]) voorkeur.zet(k, null);
      zetThema(); toast("Alles gewist — je begint opnieuw"); location.hash = "#vandaag"; render();
    }
    else if (a === "demo") { if (confirm("Huidige gegevens vervangen door voorbeelddata?")) opslag.demo(); }
    else if (a === "nieuwProject") openEditor(null, { type: "project" });
    else if (a === "nieuweAfspraak") openAfspraak();
    else if (a === "koersRapport") koersRapport();
    else if (a === "matrixToon" && w) { voorkeur.zet("matrixToon", w); render(); }
    else if (a === "thema" && w) { voorkeur.zet("thema", w); zetThema(); render(); }
    else if (a === "themaKies" && w) { d().instellingen.thema = w; voorkeur.zet("thema", w); bewaar(); zetThema(); }
    else if (a === "roosterBij" || a === "roosterWeg") roosterKlik(el, a);
    else if (a?.startsWith("feed")) feedActie(a, el);
    else if (a === "herplanAlles") { const r = planAutomatisch(actieveOverzichten()); laatsteWaarschuwingen = r.waarschuwingen; bewaar(); toast(`${r.blokken} blokken ingepland`); }
    else if (a === "herplanWis") { zetHerplan([]); render(); }
    else if (a === "verborgenWeg") { d().verborgen = {}; d().rolKeuzes = {}; d().herinneringen = {}; bewaar(); toast("Alles telt weer zoals de agenda zegt"); }
    else if (a === "famToggle" && w) { const l = famUit(); voorkeur.zet("famUit", l.includes(w) ? l.filter(x => x !== w) : [...l, w]); render(); }
    else if (a === "buiten") { const c = laatsteBuiten[+w]; if (c) buitenVenster(c); }
    else if (a === "botsing") { const c = laatsteBotsingen[+w]; if (c) botsingVenster(c); }
    else if (a === "werkweek") openWeek(w || "");
    else if (a === "week") { weekVerschuiving = w === "0" ? 0 : weekVerschuiving + +w; render(); }
    else if (a === "plan") {
      const r = planAutomatisch(actieveOverzichten()); laatsteWaarschuwingen = r.waarschuwingen; bewaar();
      toast(`${r.blokken} blokken ingepland${r.waarschuwingen.length ? " · " + r.waarschuwingen.length + " waarschuwing(en)" : ""}`);
    }
    else if (a === "tussendoel") { const o = project(w); if (o) openEditor(null, { type: "project", looptijd: "kort", ouder: o.id, overzicht: o.overzicht, urgent: false, belangrijk: true }); }
    else if (a === "naarVoren") {
      const voor = d().planning.map(b => ({ ...b }));
      const r = trekAllesNaarVoren(actieveOverzichten());
      bewaar(); agendaBij(r.gewijzigd);
      const n = new Set(r.verschoven.map(v => v.blok.item)).size;
      toast(n ? `⏪ ${n} ${n === 1 ? "taak" : "taken"} naar voren gehaald` : "Alles staat al zo vroeg als kan", n ? { label: "Ongedaan maken", f: () => {
        d().planning = voor; werkGeplandBij(d().overzichten.map(o => o.id)); bewaar(); agendaBij(r.gewijzigd); toast("Teruggezet zoals het was"); } } : undefined);
    }
    else if (a === "wisPlanning") { if (confirm("Alle toekomstige, niet-vastgezette blokken wissen?")) { const nu = new Date(); d().planning = d().planning.filter(b => b.vast || new Date(b.eind) <= nu); werkGeplandBij(d().overzichten.map(o => o.id)); laatsteWaarschuwingen = []; bewaar(); } }
    else if (a === "exportIcs") {
      const bl = d().planning.filter(b => new Date(b.eind) > new Date() && actieveOverzichten().includes(b.overzicht));
      download("tijdkompas-planning.ics", maakIcs(bl), "text/calendar");
      toast("Open het .ics-bestand of importeer het in Google Agenda / Outlook");
    }
    else if (a === "importIcs") {
      const bestanden = await kiesBestand(".ics,text/calendar"); if (!bestanden.length) return;
      let n = 0, herh = 0;
      for (const b of bestanden) {
        d().bezet = d().bezet.filter(x => x.bron !== b.naam);
        const ev = leesIcs(b.tekst, b.naam); n += ev.length; herh += ev.filter(x => x.herhalend).length;
        d().bezet.push(...ev);
      }
      bewaar(); toast(`${n} afspraken geïmporteerd${herh ? ` (${herh} herhalende: alleen eerste keer)` : ""}`);
    }
    else if (a === "wisBezet") { e.preventDefault(); d().bezet = d().bezet.filter(b => verbindingVanBron(b.bron)); bewaar(); }
    else if (a === "exportJson") download(`tijdkompas-backup-${vandaagStr()}.json`, JSON.stringify(d(), null, 1), "application/json");
    else if (a === "importJson") {
      const [b] = await kiesBestand(".json,application/json"); if (!b) return;
      try { const x = JSON.parse(b.tekst); if (!Array.isArray(x.taken)) throw 0; if (confirm("Huidige gegevens vervangen door deze back-up?")) { opslag.vervang(x); toast("Back-up teruggezet"); } }
      catch { toast("Dit is geen geldige Tijdkompas-back-up"); }
    }
    else if (a === "ovBij") nieuweLijst();
    else if (a === "mensBij") {
      const o = overzicht(el.closest("[data-ov]").dataset.ov), n = prompt(`Naam van iemand zonder Tijdkompas (bv. een collega) voor „${o.naam}”:`, "")?.trim();
      if (n && !(o.mensen || []).includes(n)) { o.mensen = [...(o.mensen || []), n]; bewaar(); }
    }
    else if (a === "mensWeg") {
      const o = overzicht(el.closest("[data-ov]").dataset.ov), n = d().taken.filter(t => t.overzicht === o.id && wie(t).includes("~" + w)).length;
      if (confirm(`${w} weghalen uit „${o.naam}”?${n ? `\n${n} taken van ${w} gaan dan naar de hele groep.` : ""}`)) {
        o.mensen = (o.mensen || []).filter(x => x !== w);
        d().taken.forEach(t => { if (t.overzicht === o.id && wie(t).includes("~" + w)) t.wie = wie(t).filter(x => x !== "~" + w); });
        bewaar();
      }
    }
    else if (a === "instTab" && w) { e.preventDefault(); voorkeur.zet("instTab", w); render(); window.scrollTo(0, 0); }
    else if (a === "modus" && w) {
      const o = overzicht(el.closest("[data-ov]").dataset.ov); o.modus = w;
      if (w === "vast" && !o.tijden?.length) o.tijden = [{ dagen: [1, 2, 3, 4, 5], van: "09:00", tot: "17:00", locatie: o.locatie || "" }];
      bewaar();
    }
    else if (a === "routesWis") { wisRoutes(); toast("Reistijden worden opnieuw berekend"); render(); }
    else if (a === "locBij") { d().locaties.push({ id: uid(), naam: "Nieuwe locatie", icoon: "📍", reistijd: 15, adres: "" }); bewaar(); }
    else if (a === "locWeg") {
      const id = el.closest("[data-loc]").dataset.loc, l = locatie(id);
      const n = [...d().taken, ...d().projecten, ...d().overzichten].filter(x => x.locatie === id).length + d().overzichten.reduce((s, o) => s + (o.tijden || []).filter(t => t.locatie === id).length, 0);
      if (confirm(`Locatie „${l.naam}” verwijderen?${n ? `\nDie wordt nog ${n}× gebruikt; daar wordt het „geen vaste plek”.` : ""}`)) {
        [...d().taken, ...d().projecten, ...d().overzichten].forEach(x => { if (x.locatie === id) x.locatie = ""; });
        d().overzichten.forEach(o => (o.tijden || []).forEach(t => { if (t.locatie === id) t.locatie = ""; }));
        d().locaties = d().locaties.filter(x => x !== l); bewaar();
      }
    }
    else if (["login", "koppelAccount", "uitloggen", "inlogBij", "inlogWeg", "mailLink", "mailKoppel", "koppelVraag", "koppelGebruik", "koppelJa", "koppelNee", "koppelStop", "mailBevestig", "mailBevestigd"].includes(a)) accountActie(a, w);
    else if (a === "accepteer") { accepteer(w).then(() => toast("Je doet nu mee met deze lijst")).catch(e => toast(e.message)); }
    else if (a === "weiger") { weiger(w).catch(e => toast(e.message)); }
    else if (a === "lidWeg") {
      const dd = deelDoel(el), o = dd.x;
      if (confirm(`${o.ledenInfo?.[w]?.naam || "Dit lid"} uit „${o.naam}” halen?${dd.isMap ? "\nOok uit alles in deze map." : ""}`)) {
        for (const x of deelBereik(dd)) { x.leden = (x.leden || []).filter(y => y !== w); if (x.ledenInfo) delete x.ledenInfo[w]; }
        bewaar();
      }
    }
    else if (a === "uitnodigingWeg") { for (const x of deelBereik(deelDoel(el))) x.uitgenodigd = (x.uitgenodigd || []).filter(y => y !== w); bewaar(); }
    else if (a === "nieuwIn") nieuweLijst({ map: el.closest("[data-map]").dataset.map });
    else if (a === "verdeling" && w) { overzicht(el.closest("[data-ov]").dataset.ov).verdeling = w; bewaar(); }
    else if (a === "mapWeg") {
      const m = map(el.closest("[data-map]").dataset.map), ouder = m.ouder || "", n = lijstenIn(m.id).length + submappen(m.id).length;
      const waar = ouder ? `de map „${map(ouder).naam}”` : "de hoofdmap";
      const anders = m.eigenaar && sessie.ik && !isIk(m.eigenaar);
      if (!confirm(`${anders ? "Gedeelde map" : "Map"} „${m.naam}” ${anders ? "verlaten" : "verwijderen"}?${n ? `\nWat erin staat (${n}) gaat naar ${waar}; er gaat niets verloren.` : ""}`)) return;
      lijstenIn(m.id).forEach(o => o.map = ouder); submappen(m.id).forEach(x => x.ouder = ouder);
      d().koers.forEach(k => { if (k.doel?.soort === "map" && k.doel.id === m.id) k.doel = ouder ? { soort: "map", id: ouder } : { soort: "", id: "" }; });
      d().mappen = d().mappen.filter(x => x !== m); bewaar();
    }
    else if (a === "koppelGoogle") doeKoppel("google", w || "agenda+taken", null, el.dataset.email || "");
    else if (a === "koppelMs") doeKoppel("ms", w || "agenda+taken", null, el.dataset.email || "");
    else if (a === "vernieuw") { const id = el.dataset.verbid || el.closest("[data-verb]")?.dataset.verb; doeVernieuw(alleVerbindingen().find(v => v.id === id)); }
    else if (a === "ontkoppel") {
      const v = alleVerbindingen().find(x => x.id === el.closest("[data-verb]").dataset.verb);
      if (confirm(`Agenda en takenlijsten van ${v.email} ontkoppelen?\nAfspraken uit dit account worden niet meer meegenomen. Taken blijven aan beide kanten staan, ze worden alleen niet meer bijgewerkt.`)) {
        for (const k of Object.keys(d().takenlijsten || {})) if (k.startsWith(v.id + "|")) { koppelTakenlijst(k, ""); delete d().takenlijsten[k]; }
        if (heeft(v, "agenda")) await zonderDoel(v, "agenda");
        const nu = alleVerbindingen().find(x => x.id === v.id); if (nu && heeft(nu, "taken")) await zonderDoel(nu, "taken");
        d().bezet = d().bezet.filter(b => !String(b.bron).startsWith(v.id + "|")); bewaar(); toast("Ontkoppeld"); render();
      }
    }
    else if (a === "schijfWeg") {
      const v = schijfVerbindingen().find(x => x.id === el.closest("[data-verb]").dataset.verb);
      const n = d().overzichten.filter(o => o.opslag === v.id);
      if (n.length) { toast(`Zet eerst ${n.map(o => "„" + o.naam + "”").join(", ")} op een andere opslag (Instellingen → Lijsten)`); return; }
      if (confirm(`${naamVan(v.id)} ontkoppelen?`)) { await zonderDoel(v, "schijf"); toast("Ontkoppeld"); render(); }
    }
    else if (a === "ophalen") { el.disabled = true; await doeOphalen(); render(); }
    else if (a === "eersteLijst") nieuweLijst();
    else if (a === "linkWeg") {
      const id = el.closest("[data-link]").dataset.link, l = d().agendaLinks.find(x => x.id === id);
      if (confirm(`Agenda „${l.naam}” weghalen uit Tijdkompas? In Outlook verandert niets.`)) {
        d().agendaLinks = d().agendaLinks.filter(x => x !== l); d().bezet = d().bezet.filter(e => e.bron !== linkBron(l)); delete d().agendas[linkBron(l)]; bewaar();
      }
    }
    else if (a === "takenOphalen") { el.disabled = true; await doeTakenSync(false); }
    else if (a === "takenWeg") {
      const v = takenVerbindingen().find(x => x.id === el.closest("[data-verb]").dataset.verb);
      if (confirm(`Takenlijsten van ${v.email} ontkoppelen?\nDe taken blijven aan beide kanten staan, ze worden alleen niet meer bijgewerkt.`)) {
        for (const k of Object.keys(d().takenlijsten || {})) if (k.startsWith(v.id + "|")) { koppelTakenlijst(k, ""); delete d().takenlijsten[k]; }
        await zonderDoel(v, "taken"); bewaar(); toast("Ontkoppeld"); render();
      }
    }
    else if (a === "naarAgenda") { el.disabled = true; await doeNaarAgenda(); }
    else if (a === "ovWeg") {
      const o = overzicht(el.closest("[data-ov]").dataset.ov);
      if (o.eigenaar && sessie.ik && !isIk(o.eigenaar)) {      // andermans lijst: verlaten (taken blijven voor de anderen)
        if (confirm(`De gedeelde lijst „${o.naam}” verlaten? De taken blijven bestaan voor de andere leden.`)) {
          d().overzichten = d().overzichten.filter(x => x !== o);
          d().taken = d().taken.filter(t => t.overzicht !== o.id); d().projecten = d().projecten.filter(p => p.overzicht !== o.id);
          d().planning = d().planning.filter(b => b.overzicht !== o.id); bewaar(); toast("Lijst verlaten");
        }
        return;
      }
      lijstVerwijderen(o);
    }
    else if (a === "ovDelen") {
      const dd = deelDoel(el), o = dd.x;
      if (!ingelogd()) { toast("Log eerst in om te delen"); $("#accountKnop").click(); return; }
      if (o.opslag) { toast("Deze lijst staat in je eigen schijf. Zet hem eerst op „Tijdkompas-cloud” om te delen."); return; }
      const m = prompt(`${dd.isMap ? "Map" : "Lijst"} „${o.naam}” delen met (e-mailadres van hun Google- of Microsoft-account):${dd.isMap ? "\nAlles in deze map gaat mee, ook wat je er later in zet." : ""}`, "");
      if (m && /^\S+@\S+\.\S+$/.test(m.trim())) {
        const mail = m.trim().toLowerCase(), overgeslagen = [];
        for (const x of deelBereik(dd)) { if (x.opslag) { overgeslagen.push(x.naam); continue; } x.uitgenodigd = [...new Set([...(x.uitgenodigd || []), mail])]; }
        bewaar();
        toast(`Uitgenodigd — ${m.trim()} ziet de uitnodiging zodra die inlogt op ${location.host + location.pathname}${overgeslagen.length ? `. Niet gedeeld (staat in je eigen schijf): ${overgeslagen.join(", ")}` : ""}`);
      } else if (m) toast("Dat lijkt geen e-mailadres");
    }
    return;
  }
  const rw = e.target.closest("[data-regelweg]");
  if (rw) { d().afspraakRegels = (d().afspraakRegels || []).filter(r => r.id !== rw.dataset.regelweg); bewaar(); return; }
  const evk = e.target.closest("[data-ev]");
  if (evk) { const ev = (evk.dataset.evfam ? familieAgenda().bezet : d().bezet).find(x => x.id === evk.dataset.ev); if (ev) afspraakVenster(ev); return; }
  const blok = e.target.closest("[data-blok]");
  if (blok) { openBlok(blok.dataset.blok); return; }
  const rij = e.target.closest("[data-id]");
  if (rij) { const it = rij.dataset.type === "project" ? project(rij.dataset.id) : taak(rij.dataset.id); if (it) openEditor(it); }
}
main.addEventListener("submit", async (e) => {
  if (e.target.dataset.actie === "linkBij") {
    e.preventDefault();
    const f = e.target, naam = f.querySelector("[name=naam]").value.trim(), url = f.querySelector("[name=url]").value.trim();
    if (!naam || !url) return;
    d().agendaLinks = [...(d().agendaLinks || []), { id: uid(), naam, url, kleur: "#4f8fd8" }]; bewaar();
    toast("Agenda ophalen…");
    const fouten = await verversLinks(); render();
    toast(fouten.length ? fouten[0] : `„${naam}” toegevoegd`);
    return;
  }
  if (e.target.dataset.actie !== "snel") return;
  e.preventDefault();
  const inv = e.target.t, t = verwerkSnel(inv.value);
  if (t) {
    const ks = koersSuggesties(t)[0];
    toast(`„${t.titel}” toegevoegd${t.project ? " aan " + project(t.project).titel : ""}${ks ? ` — hoort dit bij koersafspraak „${ks.titel}”?` : ""}`,
      [kwadrant(t) === "doen" ? null : { label: "📅 Inplannen", f: () => planTaak(taak(t.id)) },
       ks ? { label: "🎯 Koppel", f: () => { koppelKoers(t, ks.id); bewaar(); toast("Gekoppeld aan „" + ks.titel + "”"); } } : null]);
    if (kwadrant(t) === "doen") naDoen(t, false); else setTimeout(() => $(".snel input")?.focus(), 0);
  }
});
function hoofdWijzig(e) {
  if (e.target.closest?.(".bspagina")) return;
  const fd = e.target.closest?.("[data-feed]");
  if (fd && (e.target.dataset.feedlijst || e.target.dataset.feedopt || e.target.dataset.feedveld)) {
    const f = feedVan(e.target); if (!f) return;
    if (e.target.dataset.feedlijst) { const id = e.target.dataset.feedlijst; f.lijsten = e.target.checked ? [...new Set([...(f.lijsten || []), id])] : (f.lijsten || []).filter(x => x !== id); }
    else if (e.target.dataset.feedopt) f[e.target.dataset.feedopt] = e.target.checked;
    else f.naam = e.target.value.trim().slice(0, 100) || "Tijdkompas";
    bewaar(); feedsBijwerken().then(render).catch(() => {}); return;
  }
  if (e.target.dataset?.rveld && roosterWijzig(e)) return;
  if (e.target.matches?.("[data-linkkleur]")) {
    const l = d().agendaLinks.find(x => x.id === e.target.closest("[data-link]").dataset.link);
    l.kleur = e.target.value; if (d().agendas[linkBron(l)]) d().agendas[linkBron(l)].kleur = l.kleur; bewaar(); return;
  }
  if (e.target.matches?.("[data-tlijst],[data-tlijstvan]")) {
    let k, lijstId;
    if (e.target.dataset.tlijstvan !== undefined) {           // vanuit de lijst: kies de takenlijst
      lijstId = e.target.dataset.tlijstvan; k = e.target.value;
      if (!k) { const oud = takenlijstVan(lijstId); if (oud) koppelTakenlijst(oud, ""); render(); return; }
    } else {                                                  // vanuit de takenlijst: kies de lijst
      k = e.target.closest("[data-tl]").dataset.tl; lijstId = e.target.value;
      if (lijstId === "+nieuw") {
        const x = d().takenlijsten[k];
        lijstId = maakTakenLijst(x.naam, x.accountSoort);
      }
    }
    koppelTakenlijst(k, lijstId);
    if (lijstId) doeTakenSync(false); else render();
    return;
  }
  const loc = e.target.closest("[data-loc]"), ag = e.target.closest("[data-agenda]");
  if (loc && e.target.dataset.locveld) {
    const l = locatie(loc.dataset.loc), k = e.target.dataset.locveld;
    if (k === "soort") { l.soort = e.target.checked ? "winkel" : ""; if (l.soort) { l.ketens ||= []; l.soorten ||= []; l.bereik ||= "langs"; if (l.icoon === "📍") l.icoon = "🏪"; } }
    else l[k] = k === "reistijd" || k === "omweg" ? Math.max(0, Math.min(k === "omweg" ? 120 : 1e4, +e.target.value || 0)) : e.target.value;
    bewaar(); return;
  }
  if (ag && e.target.dataset.aveld) {
    const a = d().agendas[ag.dataset.agenda]; a[e.target.dataset.aveld] = e.target.value;
    if (e.target.dataset.aveld === "soort") a.lijst = "";
    bewaar();
    if (e.target.dataset.aveld === "soort" && verbindingVanBron(ag.dataset.agenda)) doeOphalen(true).then(render);
    return;
  }
  const mr = e.target.closest("[data-map]");
  if (mr && e.target.dataset.mveld) {
    const m = map(mr.dataset.map), veld = e.target.dataset.mveld, oud = m.ouder;
    m[veld] = e.target.value;
    if (veld === "ouder") verhuisd(m, e.target.value, oud);
    bewaar(); return;
  }
  const ov0 = e.target.closest("[data-ov]");
  if (ov0 && e.target.dataset.veld) {
    const o = overzicht(ov0.dataset.ov), veld = e.target.dataset.veld;
    if (veld === "opslag") {
      const w = e.target.value;
      if (w === "+google" || w === "+ms") { e.target.value = o.opslag || ""; doeKoppel(w === "+ms" ? "ms" : "google", "schijf", o.id); return; }
      if (w && !confirm(`„${o.naam}” in je ${naamVan(w)} bewaren?\n\nDe lijst wordt dan persoonlijk (niet te delen)${ingelogd() ? " en verdwijnt uit de Tijdkompas-cloud" : ""}.`)) { e.target.value = o.opslag || ""; return; }
      doeVerplaats(o.id, w); return;
    }
    const waarde = veld === "doelAgenda" ? (e.target.value || null) : e.target.value;
    if (veld === "map") { const oud = o.map; o.map = waarde; verhuisd(o, waarde, oud); bewaar(); return; }
    o[veld] = waarde;
    bewaar(); return;
  }
  if (e.target.dataset.route) {
    const k = e.target.dataset.route, inst = d().instellingen;
    if (k === "routes") inst.routes = e.target.checked;
    else if (k === "vervoer") inst.vervoer = e.target.value;
    else if (k === "mapsSleutel") { const v = e.target.value.trim(); if (v && !/^[A-Za-z0-9_-]{20,80}$/.test(v)) { toast("Dat lijkt geen Google Maps-sleutel"); return; } inst.mapsSleutel = v; }
    bewaar(); render(); return;
  }
  if (e.target.name === "klaarModus") { d().instellingen.klaarModus = e.target.value; bewaar(); return; }
  if (e.target.name === "doenModus") { d().instellingen.doenModus = e.target.value; bewaar(); return; }
  if (e.target.name === "agendaDoel" || e.target.name === "vasteAgenda") {
    d().instellingen[e.target.name] = e.target.value; bewaar(); render(); return;
  }
  if (e.target.name === "wie") { voorkeur.zet("wie", e.target.value); render(); return; }
  if (e.target.name === "koersPeriode") { voorkeur.zet("koersPeriode", e.target.value); render(); return; }
  if (e.target.name === "koersWie") { voorkeur.zet("koersWie", e.target.value); render(); return; }
  const g = e.target.closest("[data-actie]"); if (!g) return;
  if (g.dataset.actie === "takenFilter" && e.target.name !== "zoek") {
    const f = voorkeur.lees("takenFilter", { status: "open", groep: "project", zoek: "" }); f[e.target.name] = e.target.value; voorkeur.zet("takenFilter", f); render();
  } else if (g.dataset.actie === "inst") {
    d().instellingen[e.target.name] = e.target.type === "checkbox" ? e.target.checked : Math.max(0, +e.target.value || 0); bewaar();
  } else if (g.dataset.actie === "toonKlaarProj") { voorkeur.zet("toonKlaarProj", e.target.checked); render(); }
}
main.addEventListener("click", hoofdKlik);
main.addEventListener("toggle", (e) => { const id = e.target.dataset?.wopen; if (id) e.target.open ? winkelOpen.add(id) : winkelOpen.delete(id); }, true);
main.addEventListener("change", hoofdWijzig);
main.addEventListener("input", (e) => {
  if (e.target.name === "zoek") {
    const f = voorkeur.lees("takenFilter", { status: "open", groep: "project", zoek: "" }); f.zoek = e.target.value; voorkeur.zet("takenFilter", f);
    const pos = e.target.selectionStart; render(); const z = $('input[name="zoek"]'); z.focus(); z.setSelectionRange(pos, pos);
  }
});

initBoodschappen({ main, toast, render, planTaak, agendaBij });
// nieuwe reistijden binnen: opnieuw tekenen, maar niet terwijl je in een venster of veld bezig bent
let routeTimer = null;
const naRoute = () => { clearTimeout(routeTimer); const el = document.activeElement;
  if (document.querySelector("dialog[open]") || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) { routeTimer = setTimeout(naRoute, 3000); return; } render(); };
opRoute(naRoute);
$("#nieuwKnop").addEventListener("click", () => { if (huidige() === "boodschappen") { focusInvoer(); return; } if (!eersteLijst()) openEditor(null, huidige() === "projecten" ? { type: "project" } : {}); });
// Nog geen lijsten? Eerst er een maken (geeft true als dat venster nu opent)
function eersteLijst() {
  if (d().overzichten.some(o => !o.slot)) return false;
  toast("Maak eerst een lijst, bijvoorbeeld Werk of Thuis"); nieuweLijst(); return true;
}
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input,textarea,select,dialog")) return;
  if (e.key === "n") { e.preventDefault(); openEditor(); }
  if (e.key === "p") { e.preventDefault(); openEditor(null, { type: "project" }); }
});

$$("dialog").forEach(dl => dl.addEventListener("click", (e) => { if (e.target.closest("[data-sluit]")) dl.close(); }));

// Kleuren van dit account; een gelinkt account zonder eigen keuze krijgt aubergine, zodat het verschil meteen opvalt
function huidigThema() {
  let t = voorkeur.lees("thema", "donker");
  try { if (ingelogd()) t = d().instellingen?.thema || (cloud.hoofdUid ? "aubergine" : t); } catch {}
  return THEMAS[t] ? t : "donker";
}
function zetThema() {
  let t = voorkeur.lees("thema", "donker");
  t = huidigThema();
  document.documentElement.dataset.theme = THEMAS[t] ? t : "donker";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMAS[t]?.bg || "#0f2419");
}

// ---------- start ----------
zetThema();
render();
voorbereiden();
cloudStart();
startSchijf();
verbindingen().filter(isVerlopen).forEach(v => verlopenSessies.set(v.id, v));

// Gedeelde link / bookmarklet / Android-delen: ?nieuw=1&titel=…&url=…&tekst=…
(() => {
  const q = new URLSearchParams(location.search);
  if (!q.has("nieuw") && !q.has("url") && !q.has("tekst")) return;
  let url = q.get("url") || "", tekst = q.get("tekst") || "";
  if (!url) { const m = tekst.match(/https?:\/\/\S+/); if (m) { url = m[0]; tekst = tekst.replace(m[0], "").trim(); } }
  const titel = (q.get("titel") || tekst || "").slice(0, 140);
  history.replaceState(null, "", location.pathname + location.hash);
  url = veiligeUrl(url);   // alleen http(s)/mailto, nooit javascript: e.d.
  openEditor(null, { titel, links: url ? [{ url, label: titel ? "Mail: " + titel.slice(0, 50) : "" }] : [], notitie: tekst && tekst !== titel ? tekst : "" });
})();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
