// Tijdkompas — gebruikersinterface
import { opslag, bewaar, KWADRANTEN, kwadrant, overzicht, project, taak, takenVan, projectVoortgang,
         nieuweTaak, nieuwProject, werkBij, verwijder, koppel, rondAf, heropen, linkInfo, kalibratie, uid, locatie, effectieveLocatie, sessie,
         map, submappen, lijstenIn, lijstenOnder, mappenOnder, mapPad, boom, lijstVolgorde, idsVan,
         afspraak, koersVan, binnenDoel, koersScore, koersSuggesties, koppelKoers, mijnId, isIk, personen, naamVanPersoon, isMijn, isTeam, wie, wachtNogOp, wachtenOp, maaktKring, anderen as andereLeden } from "./data.js";
import { planAutomatisch, werkGeplandBij, doelDatum, harde, prioriteit, googleLink, outlookLink, maakIcs, leesIcs, dagStr, dagIndeling, eventSoort, SOORTEN } from "./plan.js";
import { ids, verbindingen as alleVerbindingen, heeft, isVerlopen, voorbereiden, koppelGoogle, koppelMs, vernieuw, ontkoppel, zonderDoel, koppelHaak, neemGedeeldeOver } from "./koppeling.js";
import { schijf, opSchijf, startSchijf, schijfVerbindingen, verplaats, synchroniseerAlles, naamVan, lijstWeg } from "./schijf.js";
import { verversAgendas, zetNaarAgendas } from "./sync.js";
import { syncTaken, takenVerbindingen, koppelTakenlijst, takenlijstVan, takenVerbindingVan } from "./takensync.js";
import { kiesEmoji, voorstellen } from "./emoji.js";
import { cloud, cloudStart, cloudIngesteld, opCloud, login, koppelAccount, uitloggen, foutTekst, planSchrijven, accepteer, weiger, ingelogd, isHoofd, voegInlogToe, verwijderInlog, cloudGeladen } from "./cloud.js";

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

// ---------- thema's en petten ("welke pet heb je op?") ----------
// Een pet = kleuren + welke lijsten opvallen. Wissel bovenin; per account onthoudt dit apparaat welke pet je ophad.
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
const FOCUS = { alles: "Alles even opvallend", deze: "Alleen deze opvallend", behalve: "Alles behalve deze" };
const WERKACHTIG = /werk|kantoor|team|baan|zakelijk|bedrijf|klant/i;
function standaardPetten() {
  const top = [...submappen("").map(m => ["m:" + m.id, m.naam]), ...lijstenIn("").map(o => [o.id, o.naam])];
  const werk = top.filter(([, n]) => WERKACHTIG.test(n)).map(([k]) => k);
  return [
    { id: "prive", naam: "Privé", icoon: "🏡", thema: voorkeur.lees("thema", "donker"), focusSoort: werk.length ? "behalve" : "alles", focus: werk, account: "" },
    { id: "werk",  naam: "Werk",  icoon: "💼", thema: "aubergine", focusSoort: werk.length ? "deze" : "alles", focus: werk, account: "" },
  ];
}
function petten() {
  const i = d().instellingen;
  if (!Array.isArray(i.petten) || !i.petten.length) i.petten = standaardPetten();
  return i.petten;
}
const pet = () => { const l = petten(); return l.find(p => p.id === voorkeur.lees("pet", "")) || l[0]; };
function zetPet(id) {
  voorkeur.zet("pet", id);
  const em = cloud.gebruiker?.email?.toLowerCase();
  if (em) { const m = voorkeur.lees("petPerAccount", {}); m[em] = id; voorkeur.zet("petPerAccount", m); }
  zetThema(); render();
}
// Bij inloggen (of wisselen van account) vanzelf de bijbehorende pet opzetten
let petEmail;
function petBijAccount() {
  const em = cloud.gebruiker?.email?.toLowerCase() || "";
  if (em === petEmail) return; petEmail = em;
  if (!em) return;
  const p = petten().find(p => (p.account || "").toLowerCase() === em) || petten().find(p => p.id === voorkeur.lees("petPerAccount", {})[em]);
  if (p && p.id !== voorkeur.lees("pet", "")) { voorkeur.zet("pet", p.id); zetThema(); }
}
/** Valt deze lijst op onder de huidige pet? */
function inFocus(ovId) {
  const p = pet();
  if (!p || p.focusSoort === "alles" || !p.focus?.length) return true;
  const ids = new Set(p.focus.flatMap(k => idsVan(k)));
  return p.focusSoort === "deze" ? ids.has(ovId) : !ids.has(ovId);
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
function renderPet() {
  const k = $("#petKnop"); if (!k) return;
  zetThema();
  const l = petten(), p = pet(), volgende = l[(l.indexOf(p) + 1) % l.length];
  k.innerHTML = `<span>${esc(p.icoon)}</span><span class="petnaam">${esc(p.naam)}</span>`;
  k.title = l.length > 1 ? `Je hebt je ${p.naam}-pet op. Klik voor ${volgende.naam}.` : `Pet: ${p.naam}`;
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
const ovKleur = (id) => overzicht(id)?.kleur || "#888";
const qKleur = (q) => `var(--q-${q})`;

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
    return `<a href="${esc(l.url)}" target="_blank" rel="noopener" title="${esc(l.label || i.label)}">${i.icoon}</a>`; }).join("")}</span>` : "";
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
  if (t.gepland && new Date(t.gepland.tot) > new Date()) uit.push(`<span title="Ingepland${isMijn(t) ? "" : " door " + esc(wieTekst(t))}">📅 ${fmtDatum(dagStr(new Date(t.gepland.van)))}</span>`);
  return uit.join("");
}

function itemRij(t, { toonProject = true, toonOv = true } = {}) {
  const p = t.project ? project(t.project) : null;
  const ov = overzicht(t.overzicht);
  return `<div class="item ${t.status === "klaar" ? "klaar" : ""} ${t.status !== "klaar" && wachtNogOp(t).length ? "geblokt" : ""}" data-id="${t.id}" data-type="taak" style="--ok:${ovKleur(t.overzicht)}">
    <button class="vink" type="button" aria-label="${t.status === "klaar" ? "Heropenen" : "Afronden"}">${t.status === "klaar" ? "✓" : ""}</button>
    <div class="ibody"><div class="ititel">${esc(t.titel)}</div>
      <div class="imeta">${qTag(t)}${toonProject && p ? `<span class="tag proj">◆ ${esc(p.titel)}</span>` : ""}${datumTags(t)}
      ${toonOv && actieveOverzichten().length > 1 && ov ? `<span>${ov.icoon} ${esc(ov.naam)}</span>` : ""}
      ${t.locatie && locatie(t.locatie) ? `<span title="Locatie">📍 ${esc(locatie(t.locatie).naam)}</span>` : ""}
      ${wieTag(t)}${afhTags(t)}
</div></div>
    ${linkjes(t)}${duurTekst(t)}</div>`;
}

function toast(tekst, actie) {
  const t = $("#toast"); t.textContent = tekst; t.classList.add("aan");
  if (actie) {
    const b = document.createElement("button"); b.type = "button"; b.className = "knop klein"; b.textContent = actie.label;
    b.onclick = () => { t.classList.remove("aan"); actie.f(); }; t.append(" ", b);
  }
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("aan"), actie ? 7000 : 2600);
}

// ---------- kop: overzicht-chips ----------
const CHIPTIP = "Klik: alleen deze · Ctrl+klik (telefoon: lang indrukken): erbij of eraf";
// aan ("true"), deels ("mixed") of uit ("false") voor een groep lijsten
function staat(ids) {
  const a = actieveOverzichten(), n = ids.filter(i => a.includes(i)).length;
  return !ids.length || !n ? "false" : n === ids.length ? "true" : "mixed";
}
function renderChips() {
  const ids = actieveOverzichten(), alle = ids.length === d().overzichten.length;
  const lijstChip = (o) => `<button class="ovchip${inFocus(o.id) ? "" : " elders"}" type="button" data-ov="${o.id}" style="--k:${o.kleur}" aria-pressed="${ids.includes(o.id)}"
      title="${esc(o.naam)} — ${CHIPTIP}"><span class="stip"></span>${o.icoon} ${esc(o.naam)}</button>`;
  const mapChip = (m) => { const l = lijstenOnder(m.id);
    return `<span class="ovmap${l.some(inFocus) ? "" : " elders"}" style="--k:${m.kleur}"><button class="ovchip map" type="button" data-ov="m:${m.id}" aria-pressed="${staat(l)}"
      title="Map ${esc(m.naam)} (${l.length} ${l.length === 1 ? "lijst" : "lijsten"}) — ${CHIPTIP}"><span class="stip"></span>${m.icoon} ${esc(m.naam)}</button><button class="ovchip pijl" type="button" data-menu="${m.id}"
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
    return `<div class="mrij" style="padding-left:${6 + r.diepte * 18}px;--k:${r.x.kleur}">
      <button type="button" class="vinkje" data-wissel="${sl}" aria-pressed="${st}" title="Erbij of eraf">${st === "true" ? "✓" : st === "mixed" ? "–" : ""}</button>
      <button type="button" class="mnaam" data-solo="${sl}" title="Alleen ${r.soort === "map" ? "deze map" : "deze lijst"}">${r.x.icoon} ${esc(r.x.naam)}${r.soort === "map" ? ` <small class="hint">${ids.length}</small>` : ""}</button>
      <button type="button" class="x" data-inst="${sl}" title="Instellingen">⚙️</button></div>`;
  }).join("");
  const st = staat(lijstenOnder(mapId));
  el.innerHTML = `<div class="mrij mkop"><button type="button" class="vinkje" data-wissel="m:${mapId}" aria-pressed="${st}">${st === "true" ? "✓" : st === "mixed" ? "–" : ""}</button>
      <button type="button" class="mnaam" data-solo="m:${mapId}"><b>${m.icoon} ${esc(m.naam)}</b></button><button type="button" class="x" data-inst="m:${mapId}" title="Instellingen van de map">⚙️</button></div>
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
const weergaves = { vandaag, matrix, projecten, taken, agenda, inzicht, koers, instellingen };
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
  petBijAccount();
  main.innerHTML = sessieBanner() + weergaves[v]();
  markeerFocus(main);
  if (v === "matrix") activeerSlepen();
  if (v === "agenda" && verbindingen().length && !doeOphalen.bezig && Date.now() - new Date(d().agendaSync || 0) > 15 * 60e3) {
    doeOphalen.bezig = true; doeOphalen(true).finally(() => { doeOphalen.bezig = false; });
  }
  if (takenVerbindingen().length && !doeTakenSync.bezig && Object.values(d().takenlijsten || {}).some(x => x.lijst)
      && Date.now() - new Date(d().takenSync || 0) > 10 * 60e3) setTimeout(() => doeTakenSync(true), 50);
  window.scrollTo(0, scroll);
  renderAccount();
  renderPet();
  if (dlg3.open && instOpen) tekenInst();
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
opslag.luister(({ stil } = {}) => { if (!stil) planSchrijven(); render(); });
opCloud(() => render());
// schijfstatus: niet hertekenen terwijl iemand in een veld typt
opSchijf(() => { if (document.activeElement?.matches?.("input,select,textarea")) renderAccount(); else render(); });

function demoBanner() {
  return d().demo ? `<div class="banner">🧭 Je kijkt naar <b>voorbeelddata</b>. Speel ermee — en begin schoon zodra je zover bent.
    <button class="knop klein" data-actie="leeg">Begin met lege planner</button></div>` : "";
}
function snelInvoer(ph = "Nieuwe taak… bv. Offerte sturen ~45m !u ^vr #presentatie") {
  return `<form class="snel" data-actie="snel"><input type="text" name="t" placeholder="${esc(ph)}" autocomplete="off" aria-label="Snel een taak toevoegen">
    <button class="knop prim">Toevoegen</button></form>`;
}

// ===== Vandaag =====
// Afspraken: die van het account waarmee je nu inlogt vallen op (in hun eigen Google-/Outlook-kleur),
// die uit je andere gekoppelde accounts staan er ook, gedimd in één rustige kleur — zo heb je het complete overzicht.
function eigenAgendaEmail() {
  const em = cloud.gebruiker?.email?.toLowerCase();
  return em && verbindingen().some(v => v.email.toLowerCase() === em) ? em : "";
}
function afspraakStijl(ev) {
  const k = d().agendas[ev.bron];
  const kleur = ev.kleur || (k?.lijst ? ovKleur(k.lijst) : (k?.kleur || "var(--zacht)"));
  const em = eigenAgendaEmail(), acc = String(ev.bron || "").match(/^(?:google|ms):([^|]+)\|/)?.[1]?.toLowerCase();
  const ander = !!(em && acc && acc !== em);
  return { k, kleur: ander ? "var(--zacht)" : kleur, ander };
}
function vandaag() {
  const nu = new Date(), vd = vandaagStr();
  const open = d().taken.filter(t => t.status !== "klaar" && zichtbaar(t));
  const focus = [...open].filter(t => isMijn(t) && !wachtNogOp(t).length).sort((a, b) => prioriteit(b) - prioriteit(a)).filter(t => kwadrant(t) !== "schrappen").slice(0, 8);
  const opMij = open.filter(t => doorWie(t, "wachtmij"));
  const blokken = [
    ...d().planning.filter(b => dagStr(new Date(b.start)) === vd).filter(b => actieveOverzichten().includes(b.overzicht)),
    ...d().bezet.filter(b => dagStr(new Date(b.start)) === vd).map(b => ({ ...b, bezet: true })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  const geplandMin = blokken.filter(b => !b.bezet).reduce((s, b) => s + (new Date(b.eind) - new Date(b.start)) / 60000, 0);
  const binnenWeek = [...open, ...d().projecten.filter(p => p.status !== "klaar" && zichtbaar(p))]
    .filter(i => { const x = harde(i.type === "taak" ? i : { ...i, project: null }) || i.streef; return x && dagenTot(x) <= 7; })
    .sort((a, b) => (doelDatum(a) || "").localeCompare(doelDatum(b) || ""));
  const kal = kalibratie();
  const uur = nu.getHours(), groet = uur < 6 ? "Goedenacht" : uur < 12 ? "Goedemorgen" : uur < 18 ? "Goedemiddag" : "Goedenavond";

  return `${demoBanner()}
  <div class="titelbalk"><h1>${groet}</h1><span class="sub">${DAG[nu.getDay()]} ${nu.getDate()} ${MAAND[nu.getMonth()]}</span></div>
  ${d().overzichten.length ? "" : `<div class="paneel welkom"><b>Welkom bij Tijdkompas!</b> Begin met je eerste lijst, bijvoorbeeld <i>Werk</i>, <i>Thuis</i> of je hobby.
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="knop prim" data-actie="eersteLijst">＋ Lijst maken</button>
    ${ids().google || ids().microsoft ? `<a class="knop" href="#instellingen" data-tab="koppelingen">✅ Takenlijst van Google of Microsoft gebruiken</a>` : ""}</div></div>`}
  ${snelInvoer()}
  <div class="raster2">
    <section>
      <h3>Focus — eerst dit</h3>
      <div class="lijst">${focus.map(t => itemRij(t)).join("") || `<div class="leeg">Niets dringends. Tijd voor kwadrant „Plannen”.</div>`}</div>
      <h3>Vandaag in je agenda</h3>
      <div class="tijdlijn">${blokken.map(b => { const st = b.bezet ? afspraakStijl(b) : null;
          return `<div class="tblok ${b.bezet ? "bezet" : ""}${st?.ander ? " ander" : ""}" style="--ok:${st ? st.kleur : ovKleur(b.overzicht)}" ${b.bezet ? "" : `data-blok="${b.id}"`}>
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
      <h3>Deadlines komende 7 dagen</h3>
      <div class="lijst">${binnenWeek.map(i => i.type === "taak" ? itemRij(i) : projectRij(i)).join("") || `<div class="leeg">Geen deadlines deze week.</div>`}</div>
    </aside>
  </div>`;
}

function koersVandaag() {
  const vd = vandaagStr(), lopend = d().koers.filter(a => binnenPeriode(a, vd) && koersZichtbaar(a));
  if (!lopend.length) return `<h3>🎯 Koers</h3><div class="leeg">Leg je jaarplan / POP-afspraken vast en zie wat eraan bijdraagt: <a href="#koers">🎯 Koers</a></div>`;
  return `<h3>🎯 Koers <a href="#koers" class="hint" style="font-weight:400">alles →</a></h3><div class="lijst">${lopend.map(a => {
    const tk = koersTaken(a), k = tk.filter(t => t.status === "klaar").length, v = koersVoorstellen(a).length;
    return `<a class="item koersitem" href="#koers" style="--ok:${doelKleur(a)}"><span>🎯</span><div class="ibody"><div class="ititel">${esc(a.titel)}</div>
      <div class="imeta"><span>${esc(doelTekst(a))}</span><span>${k}/${tk.length} taken klaar</span>${v ? `<span class="tag hierop">💡 ${v} ${v === 1 ? "voorstel" : "voorstellen"}</span>` : ""}</div></div></a>`; }).join("")}</div>`;
}

function projectRij(p) {
  const v = projectVoortgang(p);
  return `<div class="item" data-id="${p.id}" data-type="project" style="--ok:${ovKleur(p.overzicht)}">
    <span style="color:var(--ok);font-size:18px">◆</span>
    <div class="ibody"><div class="ititel">${esc(p.titel)}</div><div class="imeta">${qTag(p)}${datumTags(p)}<span>${v.klaar}/${v.totaal} taken</span></div></div>
    ${linkjes(p)}${p.schatting ? `<span class="duur">${fmtDuur(p.schatting)}</span>` : ""}</div>`;
}

// ===== Matrix =====
function matrix() {
  const toon = voorkeur.lees("matrixToon", "beide");
  const items = [
    ...(toon !== "taken" ? d().projecten : []),
    ...(toon !== "projecten" ? d().taken : []),
  ].filter(i => i.status !== "klaar" && zichtbaar(i) && doorWie(i));
  const kaart = (i) => {
    const p = i.type === "taak" && i.project ? project(i.project) : null;
    const dl = doelDatum(i);
    return `<div class="kaartje ${i.type === "project" ? "proj" : ""}" data-id="${i.id}" data-type="${i.type}" style="--ok:${ovKleur(i.overzicht)}">
      ${i.type === "project" ? `<span style="color:var(--ok)">◆</span>` : ""}<span class="ktit">${esc(i.titel)}${p ? ` <small>· ${esc(p.titel)}</small>` : ""}</span>
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
          werkBij(it, { urgent: q.urgent, belangrijk: q.belangrijk });
          toast(`„${it.titel}” → ${q.naam}`);
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
  const lijst = d().projecten.filter(p => zichtbaar(p) && (toonKlaar || p.status !== "klaar"))
    .sort((a, b) => (a.status === "klaar") - (b.status === "klaar") || prioriteit(b) - prioriteit(a));
  return `<div class="titelbalk"><h1>Projecten</h1><span class="sub">${lijst.length} ${lijst.length === 1 ? "project" : "projecten"}</span>
    <div class="rechts"><label class="schakel"><input type="checkbox" data-actie="toonKlaarProj" ${toonKlaar ? "checked" : ""}> afgerond tonen</label>
    <button class="knop prim" data-actie="nieuwProject">＋ Project</button></div></div>
  <div class="kaarten">${lijst.map(p => {
    const v = projectVoortgang(p), ov = overzicht(p.overzicht);
    const open = takenVan(p.id).filter(t => t.status !== "klaar").sort((a, b) => prioriteit(b) - prioriteit(a));
    const schat = p.schatting || v.schatTaken;
    return `<article class="pkaart" data-id="${p.id}" data-type="project" style="--ok:${ovKleur(p.overzicht)}">
      <div class="imeta">${qTag(p)}${datumTags(p)}<span>${ov ? ov.icoon + " " + esc(ov.naam) : ""}</span>${andereLeden(ov).length ? `<span title="Gedeelde lijst">👥 ${andereLeden(ov).length + 1}</span>` : ""}</div>
      <h2>${esc(p.titel)}</h2>
      <div class="balk"><i style="width:${v.pct}%"></i></div>
      <div class="cijfers"><span>${v.klaar}/${v.totaal} taken klaar</span><span title="Bestede tijd / geschatte tijd">${fmtDuur(v.werkelijk) || "0"} / ${fmtDuur(schat) || "?"}</span></div>
      ${p.schatting && v.schatTaken && Math.abs(p.schatting - v.schatTaken) > 30 ? `<div class="vergelijk">Projectschatting ${fmtDuur(p.schatting)} · som van taken ${fmtDuur(v.schatTaken)}</div>` : ""}
      ${open.length ? `<div class="lijst subtaken">${open.slice(0, 3).map(t => `<div class="imeta">○ ${esc(t.titel)} ${t.schatting ? "· " + fmtDuur(t.schatting) : ""}</div>`).join("")}${open.length > 3 ? `<div class="imeta">+ ${open.length - 3} meer</div>` : ""}</div>` : ""}
      ${linkjes(p)}
    </article>`; }).join("") || `<div class="leeg">Nog geen projecten. Begin met „＋ Project” en deel het op in taken.</div>`}</div>`;
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
    const proj = d().projecten.filter(p => lijst.some(t => t.project === p.id));
    inhoud = proj.map(p => `<div class="groep"><div class="groepkop" data-id="${p.id}" data-type="project"><span style="color:${ovKleur(p.overzicht)}">◆</span><h2>${esc(p.titel)}</h2><span class="tel">${lijst.filter(t => t.project === p.id).length}</span></div>
      <div class="lijst">${lijst.filter(t => t.project === p.id).map(t => itemRij(t, { toonProject: false })).join("")}</div></div>`).join("")
      + (losse.length ? `<div class="groep"><div class="groepkop"><span>○</span><h2>Losse taken</h2><span class="tel">${losse.length}</span></div><div class="lijst">${losse.map(t => itemRij(t)).join("")}</div></div>` : "");
  } else if (f.groep === "kwadrant") {
    inhoud = Object.keys(KWADRANTEN).map(q => { const l = lijst.filter(t => kwadrant(t) === q); return l.length ? `<div class="groep"><div class="groepkop"><h2 style="color:${qKleur(q)}">${KWADRANTEN[q].naam}</h2><span class="tel">${KWADRANTEN[q].sub} · ${l.length}</span></div><div class="lijst">${l.map(t => itemRij(t)).join("")}</div></div>` : ""; }).join("");
  } else if (f.groep === "datum") {
    lijst.sort((a, b) => (doelDatum(a) || "9999").localeCompare(doelDatum(b) || "9999"));
    inhoud = `<div class="lijst">${lijst.map(t => itemRij(t)).join("")}</div>`;
  } else inhoud = `<div class="lijst">${lijst.map(t => itemRij(t)).join("")}</div>`;

  return `<div class="titelbalk"><h1>Taken</h1><span class="sub">${lijst.length} getoond · ${fmtDuur(lijst.filter(t => t.status !== "klaar").reduce((s, t) => s + (t.schatting || 0), 0)) || "0"} geschat werk</span></div>
  ${snelInvoer()}
  <div class="rij" style="margin-bottom:14px" data-actie="takenFilter">
    <input type="text" name="zoek" placeholder="Zoeken…" value="${esc(f.zoek)}">
    <select name="status">${[["open", "Openstaand"], ["klaar", "Afgerond"], ["alles", "Alles"]].map(([v, n]) => `<option value="${v}" ${f.status === v ? "selected" : ""}>${n}</option>`).join("")}</select>
    <select name="groep">${[["project", "Per project"], ["kwadrant", "Per kwadrant"], ["datum", "Op datum"], ["geen", "Op prioriteit"]].map(([v, n]) => `<option value="${v}" ${f.groep === v ? "selected" : ""}>${n}</option>`).join("")}</select>
    ${wieKeuze()}
  </div>
  ${inhoud || `<div class="leeg">Geen taken gevonden.</div>`}
  <p class="hint" style="margin-top:16px">Snelinvoer: <b>~1u30</b> duur · <b>!u</b> urgent · <b>!b</b> belangrijk · <b>!nb</b> niet belangrijk · <b>^vr</b> / <b>^15-11</b> / <b>^morgen</b> deadline · <b>#woord</b> project · <b>+werk</b> lijst · <b>@naam</b> wie (<b>@team</b> = hele groep)</p>`;
}

// ===== Agenda =====
const UUR_VAN = 6, UUR_TOT = 24, UUR_H = 44;
function agenda() {
  const mobiel = matchMedia("(max-width:860px)").matches;
  const nu = new Date();
  let start;
  if (mobiel) { start = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() + weekVerschuiving * 3); }
  else { const ma = (nu.getDay() + 6) % 7; start = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - ma + weekVerschuiving * 7); }
  const n = mobiel ? 3 : 7;
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
    const vast = I.vast.filter(v => act.includes(v.lijst)).map(v => {
      const o = overzicht(v.lijst), l = locatie(v.locatie);
      return band(v.a, v.b, "venster", `--vk:${o.kleur}`, `${o.naam}${l ? " · " + l.naam : ""}${v.bron === "rooster" ? " (rooster uit agenda)" : ""}`,
        `<span class="vlabel">${o.icoon}${l ? " " + l.icoon : ""}</span>`);
    }).join("");
    const reis = [...I.reis, ...I.terPlekke.map(x => ({ ...x, terPlekke: true }))].filter(r => !r.lijst || act.includes(r.lijst)).map(r =>
      band(r.a, r.b, r.terPlekke ? "reisband terplekke" : "reisband", "", r.terPlekke ? `Pauze ter plekke (${locatie(r.locatie)?.naam})` : `Reistijd ${r.richting} ${locatie(r.locatie)?.naam || ""}${r.afspraak ? " — " + r.afspraak : ""}`,
        r.terPlekke ? "" : `<span>🚗</span>`)).join("");
    const afspraken = d().bezet.filter(inDag).filter(ev => !ev.eigen && eventSoort(ev) === "bezet").map(ev => {
      const { k, kleur, ander } = afspraakStijl(ev);
      const t = Math.max(0, y(ev.start)), h = Math.max(16, Math.min(hoogte, y(ev.eind)) - t);
      return `<div class="wblok bezet${ander ? " ander" : ""}" style="--ak:${kleur};top:${t}px;height:${h - 2}px" title="${esc(ev.titel)} ${fmtTijd(ev.start)}–${fmtTijd(ev.eind)}${k ? " · " + esc(k.naam) : ""}${ev.plaats ? " · " + esc(ev.plaats) : ""}">
        <b>${esc(ev.titel)}</b>${h > 30 ? `${fmtTijd(ev.start)}–${fmtTijd(ev.eind)}` : ""}</div>`;
    }).join("");
    const blokken = d().planning.filter(b => act.includes(b.overzicht)).filter(inDag).map(b => {
      const t = Math.max(0, y(b.start)), h = Math.max(14, Math.min(hoogte, y(b.eind)) - t);
      const inAgenda = d().extern?.[b.id];
      return `<div class="wblok ${b.soort === "reis" ? "reis" : ""} ${b.vast ? "vast" : ""}" data-blok="${b.id}" style="--ok:${ovKleur(b.overzicht)};top:${t}px;height:${h - 2}px" title="${esc(b.titel)} ${fmtTijd(b.start)}–${fmtTijd(b.eind)}${inAgenda ? " · staat in je agenda" : ""}">
        <b>${b.soort === "reis" ? "🚗 " : ""}${esc(b.titel)}</b>${h > 30 ? `${fmtTijd(b.start)}–${fmtTijd(b.eind)}${inAgenda ? " ✓" : ""}` : ""}</div>`;
    }).join("");
    const nulijn = ds === dagStr(nu) && nu.getHours() >= UUR_VAN && nu.getHours() < UUR_TOT ? `<div class="nulijn" style="top:${y(nu)}px"></div>` : "";
    return `<div class="wdag ${ds === dagStr(nu) ? "vandaag" : ""}" style="height:${hoogte}px;--uurH:${UUR_H}px">${beschikb}${vast}${reis}${afspraken}${blokken}${nulijn}</div>`;
  }).join("");

  const toekomst = d().planning.filter(b => new Date(b.eind) > nu && act.includes(b.overzicht));
  const metDoel = d().overzichten.some(o => o.doelAgenda);
  const titel = `${dagen[0].getDate()} ${MAAND[dagen[0].getMonth()]} – ${dagen[n - 1].getDate()} ${MAAND[dagen[n - 1].getMonth()]}`;
  const gekoppeld = verbindingen().length > 0;
  return `<div class="titelbalk"><h1>Agenda</h1>
    <span class="chips"><button type="button" data-actie="week" data-w="-1">◀</button><button type="button" data-actie="week" data-w="0">Nu</button><button type="button" data-actie="week" data-w="1">▶</button></span>
    <span class="sub">${titel}</span>
    <div class="rechts">
      <button class="knop prim" data-actie="plan">⚡ Automatisch inplannen</button>
      ${gekoppeld ? `<button class="knop" data-actie="ophalen" title="${d().agendaSync ? "Laatst opgehaald " + new Date(d().agendaSync).toLocaleString("nl-NL", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : ""}">🔄 Agenda's ophalen</button>` : ""}
      ${gekoppeld && metDoel ? `<button class="knop" data-actie="naarAgenda" ${toekomst.length || Object.keys(d().extern || {}).length ? "" : "disabled"}>📤 In mijn agenda zetten</button>` : ""}
      ${gekoppeld ? "" : `<a class="knop" href="#instellingen" data-tab="koppelingen">🔗 Google/Outlook koppelen</a>`}
      <details class="meer"><summary class="knop">⋯</summary><div class="menu">
        <button class="knop" data-actie="importIcs">📥 .ics importeren</button>
        <button class="knop" data-actie="exportIcs" ${toekomst.length ? "" : "disabled"}>📤 .ics downloaden</button>
        <button class="knop gevaar" data-actie="wisPlanning" ${toekomst.length ? "" : "disabled"}>Planning wissen</button>
      </div></details>
    </div></div>
  ${laatsteWaarschuwingen.length ? `<div class="waarsch"><b>Let op:</b><ul>${laatsteWaarschuwingen.map(w => `<li>${esc(w)}</li>`).join("")}</ul></div>` : ""}
  <div class="week" style="--dagen:${n}" id="weekRaster">
    <div class="wkop"></div>${dagen.map(dag => `<div class="wkop ${dagStr(dag) === dagStr(nu) ? "vandaag" : ""}">${DAG[dag.getDay()]}<b>${dag.getDate()}</b></div>`).join("")}
    <div class="uren" style="height:${hoogte}px">${Array.from({ length: UUR_TOT - UUR_VAN }, (_, i) => i ? `<div style="top:${i * UUR_H}px">${UUR_VAN + i}:00</div>` : "").join("")}</div>
    ${kolommen}
  </div>
  <div class="legenda"><span><i class="lg venster"></i> vaste tijden van een lijst</span><span><i class="lg reisband"></i> reistijd</span><span><i class="lg beschikb"></i> beschikbaar (vrije tijd)</span>
    <span><i class="lg bezet"></i> afspraak uit je agenda${eigenAgendaEmail() ? ` · gedimd: andere accounts dan ${esc(eigenAgendaEmail())}` : ""}</span><span>📌 vastgezet · ✓ staat in je agenda</span>
    ${d().bezet.some(b => !verbindingVanBron(b.bron)) ? `<span>${d().bezet.filter(b => !verbindingVanBron(b.bron)).length} afspraken uit .ics · <a href="#" data-actie="wisBezet">wissen</a></span>` : ""}</div>
  <div class="paneel" style="margin-top:16px;font-size:13px;color:var(--meta)">
    <b style="color:var(--tekst)">Zo werkt inplannen</b> — Taken gaan op volgorde van kwadrant en deadline/streefdatum.
    Lijsten met <b>vaste tijden</b> (zoals werk) krijgen alleen hun eigen tijdvakken; de reistijd naar die locatie gaat af van je vrije tijd.
    Lijsten in de <b>vrije tijd</b> vullen wat er overblijft binnen je beschikbaarheid. Staat zo'n lijst of taak op een locatie met reistijd, dan plant Tijdkompas reis heen en terug en zet taken op dezelfde plek achter elkaar.
    Blokken zijn hooguit ${d().instellingen.blokMax} min met ${d().instellingen.buffer} min pauze, en een dag wordt voor maximaal ${d().instellingen.vulgraad}% gevuld.
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
        <div class="chips">${inhoud.map(r => `<button type="button" data-inst="${r.soort === "map" ? "m:" : ""}${r.x.id}">${r.x.icoon} ${esc(r.x.naam)} ⚙️</button>`).join("") || `<span class="hint">Nog leeg</span>`}</div></div>` : ""}
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
const doelKleur = (a) => (a.doel?.soort === "map" ? map(a.doel.id)?.kleur : overzicht(a.doel?.id)?.kleur) || "var(--accent)";
const binnenPeriode = (a, dag) => (!a.van || a.van <= dag) && (!a.tot || a.tot >= dag);
function koersTip(c, item) {
  if (c.koersId) return "";
  const s = koersSuggesties({ ...c, id: item?.id || "_nieuw", type: "taak" })[0];
  return s ? `💡 Lijkt te horen bij koersafspraak <b>„${esc(s.titel)}”</b> <button type="button" class="knop klein" data-koerstip="${s.id}">Koppel</button>${item ? ` <button type="button" class="x" data-koersnee="${s.id}" title="Nee, hoort er niet bij">✕</button>` : ""}` : "";
}
function koersBlok(c, item) {
  if (!d().koers.length) return "";
  const vd = vandaagStr(), kies = d().koers.filter(a => binnenPeriode(a, vd) || a.id === c.koersId);
  return `<div><label class="veld">🎯 Hoort bij koersafspraak<select name="koers"><option value="">— geen —</option>${kies.map(a => `<option value="${a.id}" ${a.id === c.koersId ? "selected" : ""}>${esc(a.titel)}</option>`).join("")}</select></label>
    <div class="hint" id="koersTip" style="margin-top:4px">${koersTip(c, item)}</div></div>`;
}
const koersTaken = (a) => a.taken.map(taak).filter(Boolean);
function koersVoorstellen(a) {
  return d().taken.filter(t => !koersVan(t) && !a.nee.includes(t.id) && binnenPeriode(a, (t.klaarOp || t.gemaakt || new Date().toISOString()).slice(0, 10)) && koersScore(t, a) >= 1.5)
    .sort((x, y) => koersScore(y, a) - koersScore(x, a));
}
function koersZichtbaar(a) {
  if (!a.doel?.id) return true;
  return (a.doel.soort === "map" ? lijstenOnder(a.doel.id) : [a.doel.id]).some(i => actieveOverzichten().includes(i));
}
function koersPerioden() { return [...new Set(d().koers.map(a => (a.van || "") + "|" + (a.tot || "")))].sort().reverse(); }
function koersSelectie() {
  const per = voorkeur.lees("koersPeriode", "nu"), vd = vandaagStr();
  return d().koers.filter(a => koersZichtbaar(a) && (per === "alle" || (per === "nu" ? binnenPeriode(a, vd) : (a.van || "") + "|" + (a.tot || "") === per)));
}
function koers() {
  const per = voorkeur.lees("koersPeriode", "nu"), lijst = koersSelectie();
  const kaart = (a) => {
    const tk = koersTaken(a), klaar = tk.filter(t => t.status === "klaar"), min = tk.reduce((s, t) => s + (t.werkelijk || 0), 0);
    const voorstel = koersVoorstellen(a).slice(0, 6), [ic, st] = KSTATUS[a.status] || KSTATUS.loopt;
    return `<article class="pkaart kkaart" style="--ok:${doelKleur(a)}">
      <div class="imeta"><span class="tag">${esc(doelTekst(a))}</span><span>${periodeTekst(a)}</span><span class="tag kstatus ${a.status}">${ic} ${st}</span></div>
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
    <div class="rechts"><select name="koersPeriode" aria-label="Periode"><option value="nu" ${per === "nu" ? "selected" : ""}>Lopend</option><option value="alle" ${per === "alle" ? "selected" : ""}>Alle perioden</option>
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
    return `<option value="${v}" ${c.doel?.soort + ":" + c.doel?.id === v ? "selected" : ""}>${" ".repeat(r.diepte)}${r.x.icoon} ${esc(r.x.naam)}${r.soort === "map" ? " (hele map)" : ""}</option>`; }).join("");
  dlg.innerHTML = `<form method="dialog" id="afspraakForm"><div class="dkop"><span class="soort">🎯 Koersafspraak</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <input class="grootTitel" type="text" name="titel" value="${esc(c.titel)}" placeholder="Wat wil je bereiken? bv. Zelfstandig klantdemo's geven" required autofocus>
      <label class="veld">Toelichting — waaraan merk je dat het gelukt is?<textarea name="toelichting" placeholder="Concreet en meetbaar, zoals afgesproken">${esc(c.toelichting)}</textarea></label>
      <label class="veld">Trefwoorden <small class="hint">(helpen bij het voorstellen van taken)</small><input type="text" name="trefwoorden" value="${esc(c.trefwoorden)}" placeholder="bv. presentatie demo klant"></label>
      <div class="rij"><label class="veld">Van<input type="date" name="van" value="${c.van || ""}"></label><label class="veld">Tot<input type="date" name="tot" value="${c.tot || ""}"></label>
        <label class="veld">Hoort bij<select name="doel">${doelOpties}</select></label></div>
      <div class="segment" role="group" aria-label="Status">${Object.entries(KSTATUS).map(([k, [i, n]]) => `<button type="button" data-status="${k}" aria-pressed="${c.status === k}">${i} ${n}</button>`).join("")}</div>
      <label class="veld">Terugblik <small class="hint">(voor het gesprek)</small><textarea name="evaluatie" placeholder="Wat ging goed, wat leerde je, wat neem je mee?">${esc(c.evaluatie)}</textarea></label>
    </div>
    <div class="dvoet">${nieuw ? "" : `<button type="button" class="knop gevaar" data-actie="afspraakWeg">Verwijderen</button>`}<div class="rechts"><button class="knop prim" value="ok">${nieuw ? "Toevoegen" : "Opslaan"}</button></div></div></form>`;
  dlg.onclick = (e) => {
    const st = e.target.closest("[data-status]");
    if (st) { c.status = st.dataset.status; $$("[data-status]", dlg).forEach(b => b.setAttribute("aria-pressed", b === st)); }
    if (e.target.closest("[data-actie=afspraakWeg]") && confirm(`Koersafspraak „${a.titel}” verwijderen? De taken blijven bestaan.`)) { d().koers = d().koers.filter(x => x !== a); bewaar(); dlg.close(); }
  };
  dlg.onchange = dlg.oninput = dlg.onkeydown = null;
  dlg.onsubmit = (e) => { const t = $("#afspraakForm [name=titel]"); if (t && e.submitter?.value === "ok" && !t.value.trim()) e.preventDefault(); };
  dlg.onclose = () => {
    dlg.onclose = dlg.onclick = null;
    if (dlg.returnValue !== "ok") return;
    const v = (n) => $(`[name=${n}]`, dlg).value, [soort, id] = (v("doel") || ":").split(":");
    const velden = { titel: v("titel").trim(), toelichting: v("toelichting").trim(), trefwoorden: v("trefwoorden").trim(), van: v("van"), tot: v("tot"),
                     doel: { soort: id ? soort : "", id: id || "" }, status: c.status, evaluatie: v("evaluatie").trim() };
    if (!velden.titel) return;
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
    ${delen.map(({ a, klaar, open, min, ic, st }) => `<section><h2>${esc(a.titel)}</h2>
      <p><b>${ic} ${st}</b> · ${esc(doelTekst(a))} · ${periodeTekst(a)}</p>
      ${a.toelichting ? `<p>${esc(a.toelichting)}</p>` : ""}
      <h3>Bijgedragen (${klaar.length} ${klaar.length === 1 ? "taak" : "taken"}${min ? ", " + fmtDuur(min) : ""})</h3>
      ${klaar.length ? `<ul>${klaar.map(t => `<li>${fmtDag(t.klaarOp)} — ${esc(t.titel)}${t.werkelijk ? ` (${fmtDuur(t.werkelijk)})` : ""}</li>`).join("")}</ul>` : "<p>—</p>"}
      ${open.length ? `<h3>Nog open</h3><ul>${open.map(t => `<li>${esc(t.titel)}${doelDatum(t) ? ` (doel ${fmtDag(doelDatum(t))})` : ""}</li>`).join("")}</ul>` : ""}
      ${a.evaluatie ? `<h3>Terugblik</h3><p>${esc(a.evaluatie)}</p>` : ""}</section>`).join("")}</div>`;
  const tekst = [`Koers — ${perT}${wieT ? " — " + wieT : ""}`, ""].concat(...delen.map(({ a, klaar, open, min, st }) => [
    `■ ${a.titel}  [${st} · ${doelTekst(a)} · ${periodeTekst(a)}]`, ...(a.toelichting ? [a.toelichting] : []),
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
      ${perOv.map(x => `<div class="hbar" style="--ok:${x.o.kleur}"><span>${x.o.icoon} ${esc(x.o.naam)}</span>
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
  d().locaties.map(l => `<option value="${l.id}" ${l.id === gekozen ? "selected" : ""}>${l.icoon} ${esc(l.naam)}${l.reistijd ? ` (${l.reistijd} min reizen)` : ""}</option>`).join("");
function tijdrij(t, attr, metLocatie) {
  return `<div class="tijdrij" ${attr}>
    ${DAGVOLGORDE.map(dg => `<button type="button" class="dagknop" data-dag="${dg}" aria-pressed="${t.dagen.includes(dg)}">${DAG[dg]}</button>`).join("")}
    <input type="time" value="${t.van}" data-veld="van" aria-label="Van"> tot <input type="time" value="${t.tot}" data-veld="tot" aria-label="Tot">
    ${metLocatie ? `<select data-veld="locatie" aria-label="Locatie" style="width:auto">${locOpties(t.locatie || "", "geen vaste plek")}</select>` : ""}
    <button type="button" class="x" data-actie="tijdWeg" title="Tijdvak verwijderen">✕</button></div>`;
}
function doelAgendaOpties(gekozen) {
  const schrijfbaar = Object.entries(d().agendas).filter(([k, a]) => a.schrijf && verbindingVanBron(k));
  return `<option value="">Niet in een agenda zetten</option>` + schrijfbaar.map(([k, a]) =>
    `<option value="${esc(k)}" ${k === gekozen ? "selected" : ""}>${a.accountSoort === "ms" ? "Outlook" : "Google"} · ${esc(a.account)} · ${esc(a.naam)}</option>`).join("") +
    (gekozen && !schrijfbaar.some(([k]) => k === gekozen) ? `<option value="${esc(gekozen)}" selected>(account niet gekoppeld op dit apparaat)</option>` : "");
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
    ${andereLeden(o).length || (o.uitgenodigd || []).length ? leden.map(([u, l]) => `<span class="lid" title="${esc(l.email)}">${l.foto ? `<img class="avatar" src="${esc(l.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((l.naam || "?")[0].toUpperCase())}</span>`}${esc(isIk(u) ? "jij" : l.naam)}${u === o.eigenaar || (isIk(u) && isIk(o.eigenaar)) ? " <small class='hint'>eigenaar</small>" : ""}${!isIk(u) && u !== o.eigenaar && isIk(o.eigenaar) ? ` <button type="button" class="x" data-actie="lidWeg" data-w="${esc(u)}" title="Eruit halen">✕</button>` : ""}</span>`).join("") : ""}
    ${(o.uitgenodigd || []).map(m => `<span class="lid uitgenodigd" title="Uitgenodigd, nog niet geaccepteerd"><span class="avatar">✉</span>${esc(m)} <button type="button" class="x" data-actie="uitnodigingWeg" data-w="${esc(m)}" title="Uitnodiging intrekken">✕</button></span>`).join("")}
    <button type="button" class="knop klein" data-actie="ovDelen">👥 ${isMap ? "Map delen…" : "Delen…"}</button></div>` + (isMap ? "" : mensenBlok(o));
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
    .map(r => `<option value="${r.x.id}" ${r.x.id === gekozen ? "selected" : ""}>${"\u2003".repeat(r.diepte + 1)}${r.x.icoon} ${esc(r.x.naam)}</option>`).join("")}</select>`;
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

// Instellingen van één lijst of map (in Instellingen én in het ⚙️-venster)
function instRij(r) {
  const ik = sessie.ik;
    const inspring = `style="margin-left:${Math.min(r.diepte, 6) * 22}px"`;
    if (r.soort === "map") {
      const m = r.x, n = lijstenOnder(m.id).length;
      return `<div class="ovrij maprij" data-map="${m.id}" ${inspring}>
    <button type="button" class="emojiknop" data-emoji="map" aria-label="Icoon kiezen" title="Icoon kiezen">${esc(m.icoon)}</button>
    <input type="color" value="${esc(m.kleur)}" data-mveld="kleur" aria-label="Kleur">
    <input type="text" value="${esc(m.naam)}" data-mveld="naam" aria-label="Naam van de map" style="font-weight:600">
    <button class="knop klein gevaar" data-actie="mapWeg">${m.eigenaar && ik && !isIk(m.eigenaar) ? "Verlaten" : "Verwijderen"}</button>
    <div class="lijstopties">
      <span class="hint" style="align-self:center">📁 Map · ${n} ${n === 1 ? "lijst" : "lijsten"}</span>
      <label class="veld">In map${mapKeuze(m.ouder, new Set([m.id, ...mappenOnder(m.id)]), `data-mveld="ouder"`)}</label>
      <div style="align-self:end"><button type="button" class="knop klein" data-actie="nieuwIn">＋ Lijst of map hierin</button></div>
    </div>
    <div class="tijden">${ledenBlok(m, true)}</div></div>`;
    }
    const o = r.x, l = locatie(o.locatie);
    if (o.slot) return `<div class="ovrij" data-ov="${o.id}" ${inspring}>
    <span style="text-align:center;font-size:20px">${esc(o.icoon)}</span><span></span>
    <b>${esc(o.naam)}</b>
    <span></span>
    <div class="hint" style="grid-column:1/-1">🔒 Deze lijst staat in je ${esc(naamVan(o.opslag))}, en die is op dit apparaat (nog) niet gekoppeld.
      ${o.opslag.startsWith("ms:") ? `<button type="button" class="knop klein" data-actie="koppelMs" data-w="schijf">${msLogo} OneDrive koppelen</button>`
        : `<button type="button" class="knop klein" data-actie="koppelGoogle" data-w="schijf">${googleLogo} Google Drive koppelen</button>`}</div>
  </div>`;
    return `<div class="ovrij" data-ov="${o.id}" ${inspring}>
    <button type="button" class="emojiknop" data-emoji="lijst" aria-label="Icoon kiezen" title="Icoon kiezen">${esc(o.icoon)}</button>
    <input type="color" value="${esc(o.kleur)}" data-veld="kleur" aria-label="Kleur">
    <input type="text" value="${esc(o.naam)}" data-veld="naam" aria-label="Naam" style="font-weight:600">
    <button class="knop klein gevaar" data-actie="ovWeg">${o.eigenaar && ik && !isIk(o.eigenaar) ? "Verlaten" : "Verwijderen"}</button>
    <div class="lijstopties">
      <div class="segment" role="group" aria-label="Soort lijst">
        <button type="button" data-actie="modus" data-w="vast" aria-pressed="${o.modus === "vast"}">🕘 Vaste tijden</button>
        <button type="button" data-actie="modus" data-w="vrij" aria-pressed="${o.modus === "vrij"}">🌿 Vrije tijd</button>
      </div>
      <label class="veld">In map${mapKeuze(o.map, new Set(), `data-veld="map"`)}</label>
      <label class="veld">Standaardlocatie<select data-veld="locatie">${locOpties(o.locatie, "Geen vaste plek")}</select></label>
      <label class="veld">Ingeplande blokken naar agenda<select data-veld="doelAgenda">${doelAgendaOpties(o.doelAgenda)}</select></label>
      ${takenVerbindingen().length ? `<label class="veld">Taken synchroniseren met<select data-tlijstvan="${o.id}">${takenlijstOpties(takenlijstVan(o.id))}</select></label>` : ""}
      ${opslagKeuze(o)}
      <div class="segment" role="group" aria-label="Verdeling">${Object.entries(VERDELING).map(([k, [n, uitleg]]) =>
        `<button type="button" data-actie="verdeling" data-w="${k}" aria-pressed="${(o.verdeling || "samen") === k}" title="${esc(uitleg)}">${n}</button>`).join("")}</div>
    </div>
    <div class="tijden">
      <div class="hint">${esc(VERDELING[o.verdeling || "samen"][1])}</div>
      ${o.modus === "vast" ? `${(o.tijden || []).map((t, i) => tijdrij(t, `data-i="${i}"`, true)).join("")}
        <div><button type="button" class="knop klein" data-actie="tijdBij">＋ tijdvak</button>
        <span class="hint">Bijv. ma/di/do op kantoor, wo/vr thuis. Reistijd naar de locatie gaat automatisch af van je vrije tijd.</span></div>`
      : `<div class="hint">Wordt ingepland in je vrije tijd (zie <a href="#" data-actie="instTab" data-w="locaties">beschikbaarheid</a>), na aftrek van vaste tijden, reistijd en afspraken.
         ${l?.reistijd ? `Elke sessie op ${esc(l.naam)} krijgt ${l.reistijd} min reistijd heen en terug; taken op dezelfde plek worden achter elkaar gezet.` : ""}</div>`}
      ${ledenBlok(o)}
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

function instLocaties() {
  const inst = d().instellingen;
  return `<h3 style="margin-top:0">Locaties</h3>
  <p class="hint">Reistijd = enkele reis vanaf huis, in minuten. Het adres (optioneel) gebruikt Tijdkompas om afspraken met die plaats te herkennen en er reistijd omheen te plannen.</p>
  <div class="lijst">${d().locaties.map(l => `<div class="locrij" data-loc="${l.id}">
    <button type="button" class="emojiknop" data-emoji="locatie" aria-label="Icoon kiezen" title="Icoon kiezen">${esc(l.icoon)}</button>
    <input type="text" value="${esc(l.naam)}" data-locveld="naam" aria-label="Naam">
    <label class="veld klein">${l.id === "thuis" ? "Startpunt" : "Reistijd (min)"}${l.id === "thuis" ? `<input type="text" value="—" disabled>` : `<input type="number" min="0" step="5" value="${l.reistijd || 0}" data-locveld="reistijd">`}</label>
    <input type="text" value="${esc(l.adres || "")}" data-locveld="adres" placeholder="adres of plaatsnaam (optioneel)" aria-label="Adres">
    ${l.id === "thuis" ? "<span></span>" : `<button type="button" class="x" data-actie="locWeg" title="Verwijderen">✕</button>`}
  </div>`).join("")}</div>
  <button class="knop" data-actie="locBij" style="margin-top:8px">＋ Locatie</button>

  <h3>Beschikbaarheid</h3>
  <p class="hint">Wanneer ben je op z'n vroegst en laatst beschikbaar? Lijsten in de vrije tijd worden alleen hierbinnen ingepland — na aftrek van werk, reistijd en afspraken.</p>
  <div class="paneel"><div class="tijden">${d().beschikbaar.map((t, i) => tijdrij(t, `data-besch="${i}"`, false)).join("")}
    <div><button type="button" class="knop klein" data-actie="beschBij">＋ tijdvak</button></div></div></div>

  <h3>Inplannen</h3>
  <div class="paneel"><div class="rij" data-actie="inst">
    <label class="veld">Langste blok (min)<input type="number" min="15" step="15" name="blokMax" value="${inst.blokMax}"></label>
    <label class="veld">Kortste blok (min)<input type="number" min="5" step="5" name="blokMin" value="${inst.blokMin}"></label>
    <label class="veld">Pauze tussen blokken (min)<input type="number" min="0" step="5" name="buffer" value="${inst.buffer}"></label>
    <label class="veld">Dagen vooruit<input type="number" min="1" max="60" name="horizon" value="${inst.horizon}"></label>
    <label class="veld">Max. dagvulling (%)<input type="number" min="10" max="100" step="5" name="vulgraad" value="${inst.vulgraad}"></label>
  </div>
  <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px" data-actie="inst">
    <label class="schakel"><input type="checkbox" name="kalibratie" ${inst.kalibratie ? "checked" : ""}> Schattingen corrigeren met mijn schatfactor</label>
    <label class="schakel"><input type="checkbox" name="schrappenInplannen" ${inst.schrappenInplannen ? "checked" : ""}> Ook kwadrant „Schrappen” inplannen</label>
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
      ? `<option value="">— kies lijst —</option>` + vasteLijsten.map(o => `<option value="${o.id}" ${a.lijst === o.id ? "selected" : ""}>${o.icoon} ${esc(o.naam)}</option>`).join("")
      : `<option value="">hoort bij: —</option>` + d().overzichten.map(o => `<option value="${o.id}" ${a.lijst === o.id ? "selected" : ""}>hoort bij: ${o.icoon} ${esc(o.naam)}</option>`).join("")}</select>`}
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

  ${kanAgenda ? takenBlok(id) : ""}

  ${kanAgenda ? `<h3>Opslag in je eigen Drive of OneDrive</h3>
  <p class="hint">Je kunt per lijst kiezen om hem in je eigen Google Drive of OneDrive te bewaren (Instellingen → Lijsten → Opslag), bijvoorbeeld je werklijst in je zakelijke OneDrive.
    Tijdkompas krijgt dan alleen toegang tot een eigen verborgen map, niet tot je andere bestanden. Zulke lijsten zijn persoonlijk: delen kan alleen vanuit de Tijdkompas-cloud.
    ${ingelogd() ? "De cloud weet dan alleen dát de lijst bestaat; de taken zelf staan er niet in." : ""}</p>
  ${schijven.length ? `<div class="lijst">${schijven.map(schijfRij).join("")}</div>` : ""}
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
    ${id.google ? `<button class="knop" data-actie="koppelGoogle" data-w="schijf">${googleLogo} Google Drive koppelen</button>` : ""}
    ${id.microsoft ? `<button class="knop" data-actie="koppelMs" data-w="schijf">${msLogo} OneDrive koppelen</button>` : ""}
  </div>` : ""}

  ${Object.keys(d().agendas).length ? `<h3>Agenda's — wat staat erin?</h3>
  <p class="hint"><b>Bezet</b>: Tijdkompas plant eromheen (kies optioneel bij welke lijst ze horen, voor de kleur). <b>Rooster van lijst</b>: de afspraken zíjn de vaste tijden van die lijst (handig bij wisselende diensten). <b>Niet meetellen</b>: alleen ter info.
  Afspraken met een plaats die overeenkomt met een van je locaties krijgen automatisch reistijd.</p>
  ${lijst.map(v => { const r = agendasVan(v.id + "|"); return r.length ? `<div class="paneel agendagroep"><div class="hint" style="margin-bottom:6px">${v.soort === "ms" ? "Outlook" : "Google"} · ${esc(v.email)}</div>${r.map(agendaRij).join("")}</div>` : ""; }).join("")}
  ${icsBronnen.length ? `<div class="paneel agendagroep"><div class="hint" style="margin-bottom:6px">Geïmporteerde .ics-bestanden</div>${icsBronnen.map(b => agendaRij([b, d().agendas[b]])).join("")}</div>` : ""}
  ${lijst.length ? `<div style="margin-top:8px"><button class="knop" data-actie="ophalen">🔄 Agenda's ophalen</button>
    <span class="hint">${d().agendaSync ? "Laatst: " + new Date(d().agendaSync).toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span></div>` : ""}` : ""}`;
}

// ---------- takenlijsten (Google Taken / Microsoft To Do) ----------
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
      ${d().overzichten.filter(o => !o.slot).map(o => `<option value="${o.id}" ${x.lijst === o.id ? "selected" : ""}>↔ ${o.icoon} ${esc(o.naam)}</option>`).join("")}
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

function petRij(p) {
  const top = [...submappen("").map(m => ["m:" + m.id, m.icoon, m.naam]), ...lijstenIn("").map(o => [o.id, o.icoon, o.naam])];
  const op = pet().id === p.id;
  return `<div class="paneel petrij ${op ? "op" : ""}" data-pet="${esc(p.id)}">
    <div class="petkop">
      <button type="button" class="emojiknop" data-emoji="pet" aria-label="Icoon kiezen">${esc(p.icoon)}</button>
      <input type="text" value="${esc(p.naam)}" data-petveld="naam" aria-label="Naam" style="font-weight:600">
      ${op ? `<span class="tag">opgezet</span>` : `<button type="button" class="knop klein prim" data-actie="petOp">Opzetten</button>`}
      ${petten().length > 1 ? `<button type="button" class="knop klein gevaar" data-actie="petWeg">Weg</button>` : ""}
    </div>
    <div class="themas" role="group" aria-label="Kleuren">${Object.entries(THEMAS).map(([k, t]) =>
      `<button type="button" class="themaknop" data-actie="petThema" data-w="${k}" aria-pressed="${p.thema === k}" title="${esc(t.naam)}"
        style="--a:${t.bg};--b:${t.accent};--c:${t.accent2}"><span class="staal"></span>${esc(t.naam)}</button>`).join("")}</div>
    <div class="segment" role="group" aria-label="Wat valt op">${Object.entries(FOCUS).map(([k, n]) =>
      `<button type="button" data-actie="petFocusSoort" data-w="${k}" aria-pressed="${(p.focusSoort || "alles") === k}">${n}</button>`).join("")}</div>
    ${(p.focusSoort || "alles") === "alles" ? "" : `<div class="chips">${top.map(([k, i, n]) =>
      `<button type="button" data-actie="petFocus" data-w="${esc(k)}" aria-pressed="${(p.focus || []).includes(k)}">${esc(i)} ${esc(n)}</button>`).join("")}</div>`}
    <label class="veld">Vanzelf opzetten bij inloggen met${familieEmails().length
      ? `<select data-petveld="account"><option value="">— geen vast account —</option>${[...new Set([...familieEmails(), p.account].filter(Boolean))].map(e => `<option value="${esc(e)}" ${p.account === e ? "selected" : ""}>${esc(e)}</option>`).join("")}</select>`
      : `<input type="email" value="${esc(p.account || "")}" data-petveld="account" placeholder="e-mailadres (mag leeg)">`}</label>
  </div>`;
}

function instOverig() {
  const bm = `javascript:(()=>{let t=document.title.replace(/ - [^-]*(Gmail|Outlook)[^-]*$/,'').replace(/^(Mail|E-mail) - /,'');window.open('${location.origin + location.pathname}?nieuw=1&titel='+encodeURIComponent(t)+'&url='+encodeURIComponent(location.href),'tijdkompas','width=720,height=820')})()`;
  return `<h3 style="margin-top:0">Mails koppelen</h3>
  <div class="paneel" style="display:flex;flex-direction:column;gap:10px;font-size:14px">
    <div>Sleep deze knop naar je bladwijzerbalk. Open een mail in Gmail of Outlook (web) en klik erop: er opent een nieuwe taak met de mail als link.</div>
    <div><a class="bookmarklet" href="${esc(bm)}" onclick="event.preventDefault();alert('Sleep deze knop naar je bladwijzerbalk.')">＋ Tijdkompas</a></div>
    <div class="hint">Op je telefoon: installeer Tijdkompas (menu → „Toevoegen aan startscherm”) en gebruik <b>Delen</b> vanuit je mail-app. Of plak gewoon de link van een mail in een taak.</div>
  </div>
  <h3>Petten en kleuren</h3>
  <p class="hint">Welke pet heb je op? Een pet bepaalt de kleuren en welke lijsten opvallen; de rest blijft zichtbaar maar valt minder op.
    Wissel bovenin met de knop naast het logo. Ben je ingelogd, dan zet Tijdkompas vanzelf de pet op die bij dat account hoort.</p>
  ${petten().map(petRij).join("")}
  <button type="button" class="knop klein" data-actie="petBij">＋ Nog een pet</button>
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
    ${cloudIngesteld() ? "" : `<p class="hint">Inloggen wordt binnenkort geactiveerd. Tot die tijd werkt alles gewoon in deze browser.</p>`}`;
  const heeft = (s) => g.aanbieders.some(a => a.soort === s);
  return `<div class="accrij">${g.foto ? `<img class="avatar" src="${esc(g.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc(g.naam[0].toUpperCase())}</span>`}
      <div class="ibody"><div class="ititel">${esc(g.naam)}</div><div class="imeta">${esc(g.email)} · ${cloud.fout ? `<span style="color:var(--rood)">${esc(cloud.fout)}</span>` : cloud.bezig ? "opslaan…" : "☁️ alles opgeslagen"}</div></div>
      <button type="button" class="knop klein" data-actie="uitloggen">Uitloggen</button></div>
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
  const rij = (x, uid, isH) => { const p = petten().find(p => p.account && p.account === x.email);
    return `<div class="accrij">${x.foto ? `<img class="avatar" src="${esc(x.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((x.naam || x.email || "?")[0].toUpperCase())}</span>`}
    <div class="ibody"><div class="ititel">${esc(x.email)}${x.email === g.email ? ` <span class="tag">nu ingelogd</span>` : ""}</div>
      <div class="imeta">${isH ? "hoofdaccount" : "toegevoegd account"}${p ? ` · ${esc(p.icoon)} ${esc(p.naam)}-pet` : ""}</div></div>
    ${!isH && isHoofd() ? `<button type="button" class="knop klein gevaar" data-actie="inlogWeg" data-w="${esc(uid)}">Loskoppelen</button>` : ""}</div>`; };
  return `<h3>Accounts in dit Tijdkompas</h3>
    <p class="hint">Log in met welk account je wilt: je komt steeds in hetzelfde Tijdkompas, met de pet (kleuren en focus) die bij dat account hoort.</p>
    <div class="lijst">${rij(hoofd, sessie.ik, true)}${Object.entries(cloud.aliasInfo || {}).map(([u, x]) => rij(x, u, false)).join("")}</div>
    ${isHoofd() ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
      <button type="button" class="knop klein" data-actie="inlogBij" data-w="google">${googleLogo} ＋ Google-account toevoegen</button>
      <button type="button" class="knop klein" data-actie="inlogBij" data-w="microsoft">${msLogo} ＋ Microsoft-account toevoegen</button></div>`
    : `<p class="hint">Accounts toevoegen of loskoppelen doe je als je inlogt met het hoofdaccount (${esc(hoofd.email)}).</p>`}`;
}
function renderAccount() {
  const k = $("#accountKnop"), g = cloud.gebruiker;
  k.querySelector(".accountTekst").textContent = g ? g.naam.split(" ")[0] + (cloud.fout ? " !" : cloud.bezig ? " ⟳" : "") : "Inloggen";
  k.querySelector(".avatar").innerHTML = g?.foto ? `<img src="${esc(g.foto)}" alt="" referrerpolicy="no-referrer">` : g ? esc(g.naam[0].toUpperCase()) : "⌂";
  k.title = g ? `${g.email}${cloud.fout ? " · " + cloud.fout : ""}` : "Inloggen";
}
$("#petKnop").addEventListener("click", () => { const l = petten(); if (l.length > 1) { zetPet(l[(l.indexOf(pet()) + 1) % l.length].id); toast(`${pet().icoon} ${pet().naam}-pet op`); } else { voorkeur.zet("instTab", "overig"); location.hash = "#instellingen"; } });
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
  dlg.showModal();
});

// Inlog-acties (zowel vanuit de dialoog als vanuit Instellingen). De popup opent direct binnen de klik.
function accountActie(a, w, klaar) {
  if (a === "login") {
    login(w).then(() => { klaar?.(); toast("Ingelogd"); }).catch(e => toast(foutTekst(e)));
  } else if (a === "inlogBij") {
    voegInlogToe(w).then(r => {
      const mee = [r.lijsten ? `${r.lijsten} lijsten` : "", r.extra ? "agenda's, takenlijsten en koppelingen" : ""].filter(Boolean).join(" en ");
      toast(`${r.email} hoort nu bij dit Tijdkompas${mee ? ` — ${mee} zijn meegekomen` : ""}. Kies bij Petten welke pet daarbij hoort.`);
      render(); if (dlg.open) $("#accountKnop").click();
    }).catch(e => toast(foutTekst(e)));
  } else if (a === "inlogWeg") {
    const x = cloud.aliasInfo?.[w];
    if (confirm(`${x?.email || "Dit account"} loskoppelen?\nInloggen met dat account geeft dan weer een eigen, apart Tijdkompas. Alle lijsten blijven gewoon hier staan.`))
      verwijderInlog(w).then(() => { toast("Losgekoppeld"); render(); if (dlg.open) $("#accountKnop").click(); }).catch(e => toast(foutTekst(e)));
  } else if (a === "koppelAccount") {
    koppelAccount(w).then(() => { toast("Gekoppeld — je kunt nu met beide accounts inloggen"); location.reload(); }).catch(e => toast(foutTekst(e)));
  } else if (a === "uitloggen") {
    if (confirm("Uitloggen? Je planning blijft veilig in je account staan.")) uitloggen().then(() => { klaar?.(); toast("Uitgelogd"); render(); });
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
  return (cloud.melding ? `<div class="banner">⚠️ <span>${esc(cloud.melding)}</span></div>` : "") + uitnodigingBanner() + lijst.map(v => `<div class="banner">🔑 ${v.token ? `De koppeling met <b>${esc(v.email)}</b> is verlopen.` : `<span>De koppeling met <b>${esc(v.email)}</b> is op dit apparaat (nog) niet verbonden.</span>`}<button class="knop klein" data-actie="vernieuw" data-verbid="${esc(v.id)}">${v.token ? "Opnieuw verbinden" : "Verbinden"}</button></div>`).join("")
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
  if (!verbindingen().length) return;
  const r = await verversAgendas();
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
  } finally { doeTakenSync.bezig = false; }
  render();
}
async function doeNaarAgenda() {
  const r = await zetNaarAgendas();
  r.verlopen.forEach(v => verlopenSessies.set(v.id, v));
  if (r.fouten.length) toast(r.fouten[0]);
  else toast(`Agenda bijgewerkt: ${r.nieuw} nieuw, ${r.bij} gewijzigd, ${r.weg} verwijderd${r.verlopen.length ? " — log opnieuw in voor de rest" : ""}`);
  render();
}

// ---------- editor ----------
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

  const teken = () => {
    const q = kwadrant(c);
    const v = isProj && !nieuw ? projectVoortgang(item) : null;
    const losse = isProj && !nieuw ? d().taken.filter(t => !t.project && t.status !== "klaar" && t.overzicht === c.overzicht) : [];
    dlg.innerHTML = `<form method="dialog" id="editForm">
    <div class="dkop"><span class="soort" style="color:${ovKleur(c.overzicht)}">${isProj ? "◆ Project" : "○ Taak"}</span>
      ${!nieuw && c.status === "klaar" ? `<span class="tag" style="color:var(--groen);border-color:var(--groen)">✓ afgerond</span>` : ""}
      <button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <input class="grootTitel" type="text" name="titel" value="${esc(c.titel)}" placeholder="${isProj ? "Naam van het project" : "Wat moet er gebeuren?"}" required autofocus>
      <div class="rij">
        <label class="veld">Lijst<select name="overzicht">${boom().filter(r => r.soort === "map" || !r.x.slot || r.x.id === c.overzicht).map(r => r.soort === "map"
          ? `<option disabled>${"\u2003".repeat(r.diepte)}${r.x.icoon} ${esc(r.x.naam)}</option>`
          : `<option value="${r.x.id}" ${r.x.id === c.overzicht ? "selected" : ""}>${"\u2003".repeat(r.diepte)}${r.x.icoon} ${esc(r.x.naam)}</option>`).join("")}</select></label>
        ${isProj ? "" : `<label class="veld">Project<select name="project"><option value="">— losse taak —</option>${d().projecten.filter(p => p.status !== "klaar" || p.id === c.project).map(p => `<option value="${p.id}" ${p.id === c.project ? "selected" : ""}>◆ ${esc(p.titel)}</option>`).join("")}</select></label>`}
        <label class="veld">📍 Locatie<select name="locatie">${(() => { const volg = locatie(effectieveLocatie({ ...c, locatie: "" }));
          return `<option value="">${volg ? "Zoals " + (c.project && !isProj ? "project/" : "") + "lijst: " + esc(volg.naam) : "Geen vaste plek"}</option>` +
            d().locaties.map(l => `<option value="${l.id}" ${l.id === c.locatie ? "selected" : ""}>${l.icoon} ${esc(l.naam)}${l.reistijd ? ` (${l.reistijd} min)` : ""}</option>`).join(""); })()}</select></label>
      </div>
      ${isProj ? "" : wieBlok(c)}
      <div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Urgent / belangrijk</div>
        <div class="minimatrix">${["doen", "plannen", "delegeren", "schrappen"].map(k => `<button type="button" data-q="${k}" style="--qk:${qKleur(k)}" aria-pressed="${k === q}"><b style="color:${qKleur(k)}">${KWADRANTEN[k].naam}</b><small>${KWADRANTEN[k].sub}</small></button>`).join("")}</div></div>
      <div class="rij">
        <label class="veld" title="Wanneer het absoluut af moet zijn">⏰ Deadline (moet echt af)<input type="date" name="deadline" value="${c.deadline || ""}"></label>
        <label class="veld" title="Wanneer jij het af wilt hebben: eerder voor marge, of later als de deadline niet haalbaar is. Het inplannen mikt hierop.">🎯 Streefdatum (wanneer jij het af wilt)<input type="date" name="streef" value="${c.streef || ""}"></label>
        <label class="veld">Geschatte tijd<input type="text" name="schatting" value="${fmtDuur(c.schatting)}" placeholder="bv. 1u30"></label>
        <label class="veld">Werkelijke tijd<input type="text" name="werkelijk" value="${fmtDuur(c.werkelijk)}" placeholder="achteraf"></label>
      </div>
      ${!nieuw && c.status === "klaar" ? `<div class="rij"><label class="veld">✓ Afgerond op<input type="datetime-local" name="klaarOp" value="${lokaalDT(c.klaarOp || new Date())}"></label>
        ${c.klaarDoor && !isIk(c.klaarDoor) ? `<span class="hint" style="align-self:end">door ${esc(naamVanPersoon(c.klaarDoor, overzicht(c.overzicht)))}</span>` : ""}</div>` : ""}
      ${isProj ? "" : afhBlok(c, item)}
      ${isProj ? "" : koersBlok(c, item)}
      ${v && v.schatTaken ? `<div class="vergelijk">Som van de taken: ${fmtDuur(v.schatTaken)} geschat · ${fmtDuur(v.werkelijk) || "0"} besteed · ${v.klaar}/${v.totaal} klaar</div>` : ""}
      <label class="veld">Notitie<textarea name="notitie" placeholder="Context, afspraken, volgende stap…">${esc(c.notitie)}</textarea></label>

      <div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Mails &amp; links</div>
        <div class="lijst" id="links">${(c.links || []).map((l, i) => { const inf = linkInfo(l.url); return `<div class="linkrij"><span>${inf.icoon}</span><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || inf.label)}</a><span class="hint">${esc(inf.label)}</span><button type="button" class="x" data-linkweg="${i}" aria-label="Verwijderen">✕</button></div>`; }).join("")}
        <div class="linkrij"><span>🔗</span><input type="url" id="nieuweLink" placeholder="Plak link van een mail (Gmail/Outlook), document…"><input type="text" id="nieuwLabel" placeholder="omschrijving (optioneel)" style="max-width:180px"><button type="button" class="knop klein" data-actie="linkBij">Koppel</button></div></div></div>

      ${isProj ? (nieuw ? `<label class="veld">Opdelen in taken — één per regel, optioneel met ~duur<textarea name="opdeling" placeholder="Slides opzetten ~2u&#10;Testopstelling controleren ~1u30&#10;Generale repetitie ~1u"></textarea></label>`
        : `<div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Taken in dit project</div>
          <div class="lijst subtaken">${takenVan(item.id).sort((a, b) => (a.status === "klaar") - (b.status === "klaar") || prioriteit(b) - prioriteit(a)).map(t => `<div class="item ${t.status === "klaar" ? "klaar" : ""}" data-sub="${t.id}" style="--ok:${ovKleur(t.overzicht)}">
            <button class="vink" type="button" data-subvink="${t.id}">${t.status === "klaar" ? "✓" : ""}</button><div class="ibody"><div class="ititel">${esc(t.titel)}</div><div class="imeta">${qTag(t)}${datumTags(t)}</div></div>${duurTekst(t)}
            <button type="button" class="x" data-loskoppel="${t.id}" title="Uit project halen (taak blijft bestaan)">⤴</button></div>`).join("")}
          <div class="linkrij"><span>＋</span><input type="text" id="subNieuw" placeholder="Nieuwe taak in dit project… (~duur mag)"><button type="button" class="knop klein" data-actie="subBij">Toevoegen</button></div>
          ${losse.length ? `<div class="linkrij"><span>⤵</span><select id="subKoppel"><option value="">Bestaande losse taak toevoegen…</option>${losse.map(t => `<option value="${t.id}">${esc(t.titel)}</option>`).join("")}</select><button type="button" class="knop klein" data-actie="subKoppel">Koppel</button></div>` : ""}
          </div></div>`) : ""}

      ${(() => { const o = overzicht(c.overzicht), n = andereLeden(o).length + 1;
        return `<div class="hint">👥 ${n > 1 ? `Gedeeld via de lijst „${esc(o.naam)}” met ${n - 1} ${n === 2 ? "ander" : "anderen"}.` : `Samenwerken? Deel de lijst „${esc(o?.naam || "")}” via Instellingen → Lijsten, of zet dit in een gedeelde lijst.`}</div>`; })()}
    </div>
    <div class="dvoet">
      ${nieuw ? "" : `<button type="button" class="knop gevaar" data-actie="weg">Verwijderen</button>`}
      ${!nieuw && !isProj && c.project ? `<button type="button" class="knop" data-actie="uitProject">⤴ Uit project</button>` : ""}
      <div class="rechts">
        ${nieuw ? "" : c.status === "klaar" ? `<button type="button" class="knop" data-actie="heropen">Heropenen</button>` : `<button type="button" class="knop" data-actie="klaar">✓ Afronden</button>`}
        <button class="knop prim" value="ok">${nieuw ? "Toevoegen" : "Opslaan"}</button></div>
    </div></form>`;
  };

  // concept bijwerken uit formuliervelden (zodat hertekenen niets kwijtraakt)
  const lees = () => {
    const f = $("#editForm"); if (!f) return;
    c.titel = f.titel.value.trim(); c.overzicht = f.overzicht.value; c.notitie = f.notitie.value;
    c.deadline = f.deadline.value; c.streef = f.streef.value; c.locatie = f.locatie.value;
    const ks = $("[name=koers]", f); if (ks) c.koersId = ks.value;
    if (f.klaarOp?.value) c.klaarOp = new Date(f.klaarOp.value).toISOString();
    if (!isProj) { const geldig = new Set(personen(overzicht(c.overzicht)).map(p => p.id)); c.wie = c.wie.filter(x => isIk(x) || geldig.has(x)); }
    c.schatting = leesDuur(f.schatting.value); c.werkelijk = leesDuur(f.werkelijk.value);
    if (f.project) c.project = f.project.value || null;
  };
  const opslaan = () => {
    lees();
    if (!c.titel) { $("#editForm").titel.focus(); return false; }
    const opdeling = $("#editForm").opdeling?.value || "";
    const velden = { titel: c.titel, overzicht: c.overzicht, notitie: c.notitie, deadline: c.deadline, streef: c.streef, schatting: c.schatting,
                     werkelijk: c.werkelijk, urgent: c.urgent, belangrijk: c.belangrijk, links: c.links, gedeeldMet: c.gedeeldMet, locatie: c.locatie || "" };
    if (!isProj) { velden.wie = c.wie; velden.wachtOp = c.wachtOp; }
    if (!nieuw && c.status === "klaar" && c.klaarOp) velden.klaarOp = c.klaarOp;
    if (nieuw) {
      if (isProj) {
        const p = nieuwProject(velden);
        opdeling.split("\n").map(s => s.trim()).filter(Boolean).forEach(r => {
          const m = r.match(/~\s*(\S+)/);
          nieuweTaak({ titel: r.replace(/~\s*\S+/, "").trim(), schatting: m ? leesDuur(m[1]) : 0, project: p.id, overzicht: p.overzicht, urgent: p.urgent, belangrijk: p.belangrijk });
        });
        toast(`Project „${p.titel}” aangemaakt`);
      } else { const t = nieuweTaak({ ...velden, project: c.project }); if (c.koersId) { koppelKoers(t, c.koersId); bewaar(); } toast("Taak toegevoegd"); }
    } else {
      if (!isProj) { velden.project = c.project; if (c.project) velden.overzicht = project(c.project)?.overzicht || c.overzicht; }
      if (isProj && velden.overzicht !== item.overzicht) takenVan(item.id).forEach(t => t.overzicht = velden.overzicht);
      if (!isProj && (koersVan(item)?.id || "") !== (c.koersId || "")) { if (c.koersId) koppelKoers(item, c.koersId); else d().koers.forEach(a => a.taken = a.taken.filter(x => x !== item.id)); }
      werkBij(item, velden);
    }
    return true;
  };

  teken();
  dlg.onclick = (e) => {
    const b = e.target.closest("button,[data-q]"); if (!b) return;
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
      lees(); c.links = [...(c.links || []), { url: /^[a-z]+:/i.test(url) ? url : "https://" + url, label: $("#nieuwLabel").value.trim() }]; teken();
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
    } else if (a === "subKoppel") { const id = $("#subKoppel").value; if (id) { lees(); koppel(taak(id), item.id); teken(); } }
    else if (b.dataset.loskoppel) { lees(); koppel(taak(b.dataset.loskoppel), null); toast("Taak uit project gehaald — staat nu los"); teken(); }
    else if (b.dataset.subvink) { lees(); const t = taak(b.dataset.subvink); t.status === "klaar" ? heropen(t) : vraagAfronden(t, teken); teken(); }
    else if (a === "uitProject") { lees(); c.project = null; if (opslaan()) { dlg.close(); toast("Taak staat nu los"); } }
    else if (a === "weg") {
      const extra = isProj && takenVan(item.id).length ? `\nDe ${takenVan(item.id).length} taken blijven bestaan als losse taken.` : "";
      if (confirm(`„${item.titel}” verwijderen?${extra}`)) { verwijder(item); dlg.close(); toast("Verwijderd"); }
    } else if (a === "klaar") { if (opslaan()) { dlg.close(); vraagAfronden(item); } }
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
  if (deel && ingelogd() && !x.opslag) {
    const nieuw = [...(deel.leden || []), ...(deel.uitgenodigd || [])].filter(u => !(x.leden || []).includes(u) && !(x.uitgenodigd || []).includes(u));
    if (nieuw.length && confirm(`Map „${deel.naam}” is gedeeld. „${x.naam}” ook delen met de mensen in die map?`))
      for (const y of isLijst ? [x] : [x, ...mappenOnder(x.id).map(map), ...lijstenOnder(x.id).map(overzicht)]) if (!y.opslag) erfDelen(y, deel);
  }
}

// Nieuwe lijst of map, ook vanuit ＋ bovenin en het mapmenu
const LIJSTKLEUREN = ["#d8a24e", "#6fb38a", "#6f9fd8", "#c48ed8", "#d87a6f", "#5fb8b0", "#b8b05f", "#8a978e"];
function nieuweLijst({ map: inMap = "", soort = "lijst" } = {}) {
  const vrijeKleur = LIJSTKLEUREN.find(k => !d().overzichten.some(o => o.kleur === k)) || LIJSTKLEUREN[d().overzichten.length % LIJSTKLEUREN.length];
  let icoon = "", zelfGekozen = false, naamTekst = "";
  const teken = () => {
    dlg2.innerHTML = `<form method="dialog" id="lijstForm"><div class="dkop"><h2>Nieuwe ${soort === "map" ? "map" : "lijst"}</h2><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf">
      <div class="segment" role="group" aria-label="Soort"><button type="button" data-soort="lijst" aria-pressed="${soort === "lijst"}">📋 Lijst</button><button type="button" data-soort="map" aria-pressed="${soort === "map"}">📁 Map</button></div>
      <div class="rij"><div class="veld" style="max-width:70px">Icoon<button type="button" class="emojiknop" data-emoji="nieuw" title="Icoon kiezen">${icoon || (soort === "map" ? "📁" : "📋")}</button><input type="hidden" name="icoon" value="${icoon || (soort === "map" ? "📁" : "📋")}"></div>
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

// ---------- blok in agenda ----------
function openBlok(id) {
  const b = d().planning.find(x => x.id === id); if (!b) return;
  const it = b.type === "project" ? project(b.item) : taak(b.item);
  dlg2.innerHTML = `<form method="dialog"><div class="dkop"><span class="soort" style="color:${ovKleur(b.overzicht)}">Ingepland blok</span><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf"><h2>${esc(b.titel)}</h2>
      <div class="hint">${DAG[new Date(b.start).getDay()]} ${new Date(b.start).getDate()} ${MAAND[new Date(b.start).getMonth()]} · ${fmtTijd(b.start)}–${fmtTijd(b.eind)}${b.locatie && locatie(b.locatie) ? " · 📍 " + esc(locatie(b.locatie).naam) : ""}</div>
      ${d().extern?.[b.id] ? `<div class="hint">✓ Staat in je agenda (${esc(d().agendas[d().extern[b.id].bron]?.naam || "")})</div>`
        : overzicht(b.overzicht)?.doelAgenda ? `<div class="hint">Komt in je agenda bij „📤 In mijn agenda zetten”.</div>` : ""}
      <div class="chips"><a class="knop" target="_blank" rel="noopener" href="${esc(googleLink(b))}">＋ Google Agenda</a>
        <a class="knop" target="_blank" rel="noopener" href="${esc(outlookLink(b, true))}">＋ Outlook (werk/school)</a>
        <a class="knop" target="_blank" rel="noopener" href="${esc(outlookLink(b, false))}">＋ Outlook.com</a></div>
      <label class="schakel"><input type="checkbox" id="blokVast" ${b.vast ? "checked" : ""}> 📌 Vastzetten (blijft staan bij opnieuw inplannen)</label>
    </div>
    <div class="dvoet"><button type="button" class="knop gevaar" data-actie="blokWeg">Blok verwijderen</button>
      <div class="rechts">${it ? `<button type="button" class="knop" data-actie="blokItem">Open ${b.type === "project" ? "project" : "taak"}</button>` : ""}<button class="knop prim" value="ok">Sluiten</button></div></div></form>`;
  dlg2.onclick = (e) => {
    const a = e.target.closest("button")?.dataset.actie;
    if (a === "blokWeg") { d().planning = d().planning.filter(x => x !== b); bewaar(); dlg2.close(); }
    if (a === "blokItem") { dlg2.close(); openEditor(it); }
  };
  dlg2.onchange = (e) => { if (e.target.id === "blokVast") { b.vast = e.target.checked; bewaar(); } };
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
  const ek = e.target.closest("[data-emoji]");
  if (ek) {
    const prij = ek.closest("[data-pet]");
    if (prij) { const p = petten().find(x => x.id === prij.dataset.pet); kiesEmoji(ek, { naam: p.naam, soort: "map", huidig: p.icoon }, (v) => { p.icoon = v; bewaar(); }); return; }
    const orij = ek.closest("[data-ov]"), mrij = ek.closest("[data-map]"), lrij = ek.closest("[data-loc]");
    const x = orij ? overzicht(orij.dataset.ov) : mrij ? map(mrij.dataset.map) : lrij ? locatie(lrij.dataset.loc) : null;
    if (x) kiesEmoji(ek, { naam: x.naam, soort: orij ? "lijst" : mrij ? "map" : "locatie", huidig: x.icoon }, (v) => { x.icoon = v; bewaar(); });
    return;
  }
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

Weg gaan: lijsten, mappen, taken, projecten, planning, koersafspraken, petten en koppelingen${ingelogd() ? " — voor al je gekoppelde accounts en apparaten" : ""}.
Blijven: gedeelde lijsten van anderen${ingelogd() ? ", en welke accounts bij dit Tijdkompas horen" : ""}. Wat in Google of Outlook staat blijft daar staan; alleen de blokken die Tijdkompas in je agenda had gezet worden weggehaald.`)) return;
      el.disabled = true; toast("Bezig met wissen…");
      try { if (verbindingen().length) { d().planning = []; await zetNaarAgendas(); } } catch {}   // ingeplande blokken uit je agenda halen
      for (const v of alleVerbindingen()) { try { await ontkoppel(v); } catch {} }
      d().overzichten.forEach(o => lijstWeg(o.id)); opslag.wis();
      actief = null; for (const k of ["actief", "pet", "petPerAccount", "instTab"]) voorkeur.zet(k, null);
      zetThema(); toast("Alles gewist — je begint opnieuw"); location.hash = "#vandaag"; render();
    }
    else if (a === "demo") { if (confirm("Huidige gegevens vervangen door voorbeelddata?")) opslag.demo(); }
    else if (a === "nieuwProject") openEditor(null, { type: "project" });
    else if (a === "nieuweAfspraak") openAfspraak();
    else if (a === "koersRapport") koersRapport();
    else if (a === "matrixToon" && w) { voorkeur.zet("matrixToon", w); render(); }
    else if (a === "thema" && w) { voorkeur.zet("thema", w); zetThema(); render(); }
    else if (a === "pet") { const l = petten(); zetPet(l[(l.indexOf(pet()) + 1) % l.length].id); }
    else if (a === "petBij") { const p = { id: uid(), naam: "Nieuwe pet", icoon: "🎩", thema: "grafiet", focusSoort: "alles", focus: [], account: "" }; petten().push(p); bewaar(); }
    else if (a?.startsWith("pet") && el.closest("[data-pet]")) {
      const p = petten().find(x => x.id === el.closest("[data-pet]").dataset.pet);
      if (a === "petOp") zetPet(p.id);
      else if (a === "petWeg") { if (confirm(`Pet „${p.naam}” weghalen?`)) { d().instellingen.petten = petten().filter(x => x !== p); bewaar(); zetThema(); } }
      else if (a === "petThema") { p.thema = w; bewaar(); if (pet() === p) zetThema(); }
      else if (a === "petFocusSoort") { p.focusSoort = w; bewaar(); }
      else if (a === "petFocus") { p.focus = (p.focus || []).includes(w) ? p.focus.filter(x => x !== w) : [...(p.focus || []), w]; bewaar(); }
    }
    else if (a === "week") { weekVerschuiving = w === "0" ? 0 : weekVerschuiving + +w; render(); }
    else if (a === "plan") {
      const r = planAutomatisch(actieveOverzichten()); laatsteWaarschuwingen = r.waarschuwingen; bewaar();
      toast(`${r.blokken} blokken ingepland${r.waarschuwingen.length ? " · " + r.waarschuwingen.length + " waarschuwing(en)" : ""}`);
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
    else if (a === "beschBij") { d().beschikbaar.push({ dagen: [6, 0], van: "09:00", tot: "22:00" }); bewaar(); }
    else if (["login", "koppelAccount", "uitloggen", "inlogBij", "inlogWeg"].includes(a)) accountActie(a, w);
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
      const n = d().taken.filter(t => t.overzicht === o.id).length + d().projecten.filter(p => p.overzicht === o.id).length;
      if (n) { toast(`Verplaats eerst de ${n} taken/projecten in „${o.naam}”`); return; }
      if (confirm(`Lijst „${o.naam}” verwijderen?`)) {
        lijstWeg(o.id);
        d().koers.forEach(k => { if (k.doel?.soort === "lijst" && k.doel.id === o.id) k.doel = o.map ? { soort: "map", id: o.map } : { soort: "", id: "" }; });
        d().overzichten = d().overzichten.filter(x => x !== o); bewaar();
      }
    }
    else if (a === "tijdBij") { const o = overzicht(el.closest("[data-ov]").dataset.ov); o.tijden.push({ dagen: [1, 2, 3, 4, 5], van: "09:00", tot: "17:00", locatie: o.locatie || "" }); bewaar(); }
    else if (a === "tijdWeg") {
      const b = el.closest("[data-besch]");
      if (b) { if (d().beschikbaar.length > 1) d().beschikbaar.splice(+b.dataset.besch, 1); else toast("Er moet minstens één tijdvak blijven"); }
      else overzicht(el.closest("[data-ov]").dataset.ov).tijden.splice(+el.closest("[data-i]").dataset.i, 1);
      bewaar();
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
  const dag = e.target.closest(".dagknop");
  if (dag) {
    const b = dag.closest("[data-besch]");
    const t = b ? d().beschikbaar[+b.dataset.besch] : overzicht(dag.closest("[data-ov]").dataset.ov).tijden[+dag.closest("[data-i]").dataset.i], x = +dag.dataset.dag;
    t.dagen = t.dagen.includes(x) ? t.dagen.filter(y => y !== x) : [...t.dagen, x]; bewaar(); return;
  }
  const blok = e.target.closest("[data-blok]");
  if (blok) { openBlok(blok.dataset.blok); return; }
  const rij = e.target.closest("[data-id]");
  if (rij) { const it = rij.dataset.type === "project" ? project(rij.dataset.id) : taak(rij.dataset.id); if (it) openEditor(it); }
}
main.addEventListener("submit", (e) => {
  if (e.target.dataset.actie !== "snel") return;
  e.preventDefault();
  const inv = e.target.t, t = verwerkSnel(inv.value);
  if (t) {
    const ks = koersSuggesties(t)[0];
    toast(`„${t.titel}” toegevoegd${t.project ? " aan " + project(t.project).titel : ""}${ks ? ` — hoort dit bij koersafspraak „${ks.titel}”?` : ""}`,
      ks ? { label: "🎯 Koppel", f: () => { koppelKoers(t, ks.id); bewaar(); toast("Gekoppeld aan „" + ks.titel + "”"); } } : undefined);
    setTimeout(() => $(".snel input")?.focus(), 0);
  }
});
function hoofdWijzig(e) {
  if (e.target.dataset?.petveld) {
    const p = petten().find(x => x.id === e.target.closest("[data-pet]").dataset.pet), k = e.target.dataset.petveld;
    p[k] = k === "account" ? e.target.value.trim().toLowerCase() : e.target.value.trim() || p[k];
    if (k === "account" && p[k]) for (const q of petten()) if (q !== p && q.account === p[k]) q.account = "";   // één pet per account
    bewaar(); renderPet(); return;
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
  const bes = e.target.closest("[data-besch]"), loc = e.target.closest("[data-loc]"), ag = e.target.closest("[data-agenda]");
  if (bes && e.target.dataset.veld) { d().beschikbaar[+bes.dataset.besch][e.target.dataset.veld] = e.target.value; bewaar(); return; }
  if (loc && e.target.dataset.locveld) {
    const l = locatie(loc.dataset.loc), k = e.target.dataset.locveld;
    l[k] = k === "reistijd" ? Math.max(0, +e.target.value || 0) : e.target.value; bewaar(); return;
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
    const o = overzicht(ov0.dataset.ov), veld = e.target.dataset.veld, rij = e.target.closest("[data-i]");
    if (veld === "opslag") {
      const w = e.target.value;
      if (w === "+google" || w === "+ms") { e.target.value = o.opslag || ""; doeKoppel(w === "+ms" ? "ms" : "google", "schijf", o.id); return; }
      if (w && !confirm(`„${o.naam}” in je ${naamVan(w)} bewaren?\n\nDe lijst wordt dan persoonlijk (niet te delen)${ingelogd() ? " en verdwijnt uit de Tijdkompas-cloud" : ""}.`)) { e.target.value = o.opslag || ""; return; }
      doeVerplaats(o.id, w); return;
    }
    const waarde = veld === "doelAgenda" ? (e.target.value || null) : e.target.value;
    if (veld === "map") { const oud = o.map; o.map = waarde; verhuisd(o, waarde, oud); bewaar(); return; }
    if (rij) o.tijden[+rij.dataset.i][veld] = waarde; else o[veld] = waarde;
    bewaar(); return;
  }
  if (e.target.name === "wie") { voorkeur.zet("wie", e.target.value); render(); return; }
  if (e.target.name === "koersPeriode") { voorkeur.zet("koersPeriode", e.target.value); render(); return; }
  const g = e.target.closest("[data-actie]"); if (!g) return;
  if (g.dataset.actie === "takenFilter" && e.target.name !== "zoek") {
    const f = voorkeur.lees("takenFilter", { status: "open", groep: "project", zoek: "" }); f[e.target.name] = e.target.value; voorkeur.zet("takenFilter", f); render();
  } else if (g.dataset.actie === "inst") {
    d().instellingen[e.target.name] = e.target.type === "checkbox" ? e.target.checked : Math.max(0, +e.target.value || 0); bewaar();
  } else if (g.dataset.actie === "toonKlaarProj") { voorkeur.zet("toonKlaarProj", e.target.checked); render(); }
}
main.addEventListener("click", hoofdKlik);
main.addEventListener("change", hoofdWijzig);
main.addEventListener("input", (e) => {
  if (e.target.name === "zoek") {
    const f = voorkeur.lees("takenFilter", { status: "open", groep: "project", zoek: "" }); f.zoek = e.target.value; voorkeur.zet("takenFilter", f);
    const pos = e.target.selectionStart; render(); const z = $('input[name="zoek"]'); z.focus(); z.setSelectionRange(pos, pos);
  }
});

$("#nieuwKnop").addEventListener("click", () => { if (!eersteLijst()) openEditor(null, huidige() === "projecten" ? { type: "project" } : {}); });
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

function zetThema() {
  let t = voorkeur.lees("thema", "donker");
  try { t = pet()?.thema || t; } catch {}            // vóór het laden van de data is er nog geen pet
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
  openEditor(null, { titel, links: url ? [{ url, label: titel ? "Mail: " + titel.slice(0, 50) : "" }] : [], notitie: tekst && tekst !== titel ? tekst : "" });
})();

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
