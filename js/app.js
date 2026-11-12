// Tijdkompas — gebruikersinterface
import { opslag, bewaar, KWADRANTEN, kwadrant, overzicht, project, taak, takenVan, projectVoortgang,
         nieuweTaak, nieuwProject, werkBij, verwijder, koppel, rondAf, heropen, linkInfo, kalibratie, uid, locatie, effectieveLocatie, sessie } from "./data.js";
import { planAutomatisch, doelDatum, harde, prioriteit, googleLink, outlookLink, maakIcs, leesIcs, dagStr, dagIndeling, eventSoort, SOORTEN } from "./plan.js";
import { ids, verbindingen as alleVerbindingen, heeft, isVerlopen, voorbereiden, koppelGoogle, koppelMs, vernieuw, ontkoppel, zonderDoel } from "./koppeling.js";
import { schijf, opSchijf, startSchijf, schijfVerbindingen, verplaats, synchroniseerAlles, naamVan, lijstWeg } from "./schijf.js";
import { verversAgendas, zetNaarAgendas } from "./sync.js";
import { cloud, cloudStart, cloudIngesteld, opCloud, login, koppelAccount, uitloggen, foutTekst, planSchrijven, accepteer, weiger, ingelogd } from "./cloud.js";

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const d = () => opslag.d;
const verbindingen = () => alleVerbindingen().filter(v => heeft(v, "agenda"));   // agenda-koppelingen
const main = $("#main"), dlg = $("#dlg"), dlg2 = $("#dlg2");

// ---------- voorkeuren per kijker (geen gedeelde staat) ----------
const voorkeur = {
  lees(k, std) { try { const v = localStorage.getItem("tk_" + k); return v == null ? std : JSON.parse(v); } catch { return std; } },
  zet(k, v) { try { localStorage.setItem("tk_" + k, JSON.stringify(v)); } catch {} },
};
let actief = voorkeur.lees("actief", null);
let weekVerschuiving = 0;
let laatsteWaarschuwingen = [];

function actieveOverzichten() {
  const ids = d().overzichten.map(o => o.id);
  if (!actief || !actief.length) return ids;
  const a = actief.filter(i => ids.includes(i));
  return a.length ? a : ids;
}
const zichtbaar = (it) => actieveOverzichten().includes(it.overzicht);

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
    const n = dagenTot(st), cls = it.status === "klaar" ? "" : n < 0 ? "bijna" : "";
    uit.push(`<span class="tag ${cls}" title="Eigen streefdatum">🎯 ${fmtDatum(st)}</span>`);
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

function itemRij(t, { toonProject = true, toonOv = true } = {}) {
  const p = t.project ? project(t.project) : null;
  const ov = overzicht(t.overzicht);
  return `<div class="item ${t.status === "klaar" ? "klaar" : ""}" data-id="${t.id}" data-type="taak" style="--ok:${ovKleur(t.overzicht)}">
    <button class="vink" type="button" aria-label="${t.status === "klaar" ? "Heropenen" : "Afronden"}">${t.status === "klaar" ? "✓" : ""}</button>
    <div class="ibody"><div class="ititel">${esc(t.titel)}</div>
      <div class="imeta">${qTag(t)}${toonProject && p ? `<span class="tag proj">◆ ${esc(p.titel)}</span>` : ""}${datumTags(t)}
      ${toonOv && actieveOverzichten().length > 1 && ov ? `<span>${ov.icoon} ${esc(ov.naam)}</span>` : ""}
      ${t.locatie && locatie(t.locatie) ? `<span title="Locatie">📍 ${esc(locatie(t.locatie).naam)}</span>` : ""}
      ${t.toegewezen && sessie.ik && t.toegewezen !== sessie.ik ? `<span title="Toegewezen">👤 ${esc(ov?.ledenInfo?.[t.toegewezen]?.naam || "iemand anders")}</span>` : ""}
</div></div>
    ${linkjes(t)}${duurTekst(t)}</div>`;
}

function toast(tekst) {
  const t = $("#toast"); t.textContent = tekst; t.classList.add("aan");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("aan"), 2600);
}

// ---------- kop: overzicht-chips ----------
function renderChips() {
  const ids = actieveOverzichten(), alle = ids.length === d().overzichten.length;
  $("#ovChips").innerHTML =
    `<button class="ovchip alles" type="button" data-ov="*" aria-pressed="${alle}">Alles</button>` +
    d().overzichten.map(o => `<button class="ovchip" type="button" data-ov="${o.id}" style="--k:${o.kleur}" aria-pressed="${!alle && ids.includes(o.id)}"
      title="Tonen/verbergen — combineer gerust meerdere"><span class="stip"></span>${o.icoon} ${esc(o.naam)}</button>`).join("");
}
$("#ovChips").addEventListener("click", (e) => {
  const b = e.target.closest(".ovchip"); if (!b) return;
  const id = b.dataset.ov;
  if (id === "*") actief = null;
  else {
    const huidig = actieveOverzichten(), alle = huidig.length === d().overzichten.length;
    if (alle) actief = [id];                       // vanuit "Alles": alleen dit overzicht
    else {                                          // anders: aan/uit zetten = combineren
      const s = huidig.includes(id) ? huidig.filter(x => x !== id) : [...huidig, id];
      actief = s.length && s.length < d().overzichten.length ? s : null;
    }
  }
  voorkeur.zet("actief", actief);
  render();
});

// ---------- weergaves ----------
const weergaves = { vandaag, matrix, projecten, taken, agenda, inzicht, instellingen };
function huidige() { const h = location.hash.slice(1); return weergaves[h] ? h : "vandaag"; }

function render() {
  renderChips();
  const v = huidige();
  $$("#nav a").forEach(a => a.classList.toggle("actief", a.dataset.v === v));
  const scroll = window.scrollY;
  main.innerHTML = sessieBanner() + weergaves[v]();
  if (v === "matrix") activeerSlepen();
  if (v === "agenda" && verbindingen().length && !doeOphalen.bezig && Date.now() - new Date(d().agendaSync || 0) > 15 * 60e3) {
    doeOphalen.bezig = true; doeOphalen(true).finally(() => { doeOphalen.bezig = false; });
  }
  window.scrollTo(0, scroll);
  renderAccount();
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
function vandaag() {
  const nu = new Date(), vd = vandaagStr();
  const open = d().taken.filter(t => t.status !== "klaar" && zichtbaar(t));
  const focus = [...open].sort((a, b) => prioriteit(b) - prioriteit(a)).filter(t => kwadrant(t) !== "schrappen").slice(0, 8);
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
  ${snelInvoer()}
  <div class="raster2">
    <section>
      <h3>Focus — eerst dit</h3>
      <div class="lijst">${focus.map(t => itemRij(t)).join("") || `<div class="leeg">Niets dringends. Tijd voor kwadrant „Plannen”.</div>`}</div>
      <h3>Vandaag in je agenda</h3>
      <div class="tijdlijn">${blokken.map(b => `<div class="tblok ${b.bezet ? "bezet" : ""}" style="--ok:${ovKleur(b.overzicht)}" ${b.bezet ? "" : `data-blok="${b.id}"`}>
          <span class="tijd">${fmtTijd(b.start)}–${fmtTijd(b.eind)}</span><span>${b.bezet ? "📅 " : ""}${esc(b.titel)}</span></div>`).join("")
        || `<div class="leeg">Nog niets ingepland. <a href="#agenda">Open de agenda</a> en laat Tijdkompas je dag vullen.</div>`}</div>
    </section>
    <aside>
      <div class="stats">
        <div class="stat"><b>${open.length}</b><span>open taken</span></div>
        <div class="stat"><b>${fmtDuur(geplandMin) || "0"}</b><span>vandaag ingepland</span></div>
        <div class="stat"><b>${open.filter(t => kwadrant(t) === "doen").length}</b><span>urgent &amp; belangrijk</span></div>
        <div class="stat" title="Werkelijke tijd gedeeld door geschatte tijd (afgeronde taken)"><b>${kal.n >= 3 ? "×" + kal.factor.toFixed(2) : "–"}</b><span>schatfactor${kal.n < 3 ? " (na 3 taken)" : ""}</span></div>
      </div>
      <h3>Deadlines komende 7 dagen</h3>
      <div class="lijst">${binnenWeek.map(i => i.type === "taak" ? itemRij(i) : projectRij(i)).join("") || `<div class="leeg">Geen deadlines deze week.</div>`}</div>
    </aside>
  </div>`;
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
  ].filter(i => i.status !== "klaar" && zichtbaar(i));
  const kaart = (i) => {
    const p = i.type === "taak" && i.project ? project(i.project) : null;
    const dl = doelDatum(i);
    return `<div class="kaartje ${i.type === "project" ? "proj" : ""}" data-id="${i.id}" data-type="${i.type}" style="--ok:${ovKleur(i.overzicht)}">
      ${i.type === "project" ? `<span style="color:var(--ok)">◆</span>` : ""}<span class="ktit">${esc(i.titel)}${p ? ` <small>· ${esc(p.titel)}</small>` : ""}</span>
      ${dl ? `<small>${fmtDatum(dl)}</small>` : ""}${i.schatting ? `<small>${fmtDuur(i.schatting)}</small>` : ""}</div>`;
  };
  const vak = (q) => {
    const lijst = items.filter(i => kwadrant(i) === q).sort((a, b) => prioriteit(b) - prioriteit(a));
    const min = lijst.reduce((s, i) => s + (i.schatting || 0), 0);
    return `<section class="kwadrant" data-q="${q}" style="--qk:${qKleur(q)}">
      <header><h2>${KWADRANTEN[q].naam}</h2><small>${KWADRANTEN[q].sub}</small><span class="tel">${lijst.length}${min ? " · " + fmtDuur(min) : ""}</span></header>
      ${lijst.map(kaart).join("") || `<span class="hint">Sleep iets hierheen</span>`}</section>`;
  };
  return `<div class="titelbalk"><h1>Eisenhower-matrix</h1><span class="sub">Sleep kaartjes om urgentie en belang te wijzigen</span>
    <div class="rechts chips" data-actie="matrixToon">${["beide", "projecten", "taken"].map(x => `<button type="button" data-w="${x}" style="${x === toon ? "border-color:var(--accent);color:var(--accent)" : ""}">${x[0].toUpperCase() + x.slice(1)}</button>`).join("")}</div></div>
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
      <div class="imeta">${qTag(p)}${datumTags(p)}<span>${ov ? ov.icoon + " " + esc(ov.naam) : ""}</span>${(ov?.leden || []).length > 1 ? `<span title="Gedeelde lijst">👥 ${ov.leden.length}</span>` : ""}</div>
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
  let lijst = d().taken.filter(zichtbaar)
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
  </div>
  ${inhoud || `<div class="leeg">Geen taken gevonden.</div>`}
  <p class="hint" style="margin-top:16px">Snelinvoer: <b>~1u30</b> duur · <b>!u</b> urgent · <b>!b</b> belangrijk · <b>!nb</b> niet belangrijk · <b>^vr</b> / <b>^15-11</b> / <b>^morgen</b> deadline · <b>#woord</b> project · <b>+werk</b> overzicht</p>`;
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
      const k = d().agendas[ev.bron], kleur = k?.lijst ? ovKleur(k.lijst) : (k?.kleur || "var(--zacht)");
      const t = Math.max(0, y(ev.start)), h = Math.max(16, Math.min(hoogte, y(ev.eind)) - t);
      return `<div class="wblok bezet" style="--ak:${kleur};top:${t}px;height:${h - 2}px" title="${esc(ev.titel)} ${fmtTijd(ev.start)}–${fmtTijd(ev.eind)}${k ? " · " + esc(k.naam) : ""}${ev.plaats ? " · " + esc(ev.plaats) : ""}">
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
    <span><i class="lg bezet"></i> afspraak uit je agenda</span><span>📌 vastgezet · ✓ staat in je agenda</span>
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
  const tabs = [["lijsten", "📋 Lijsten"], ["locaties", "📍 Locaties & tijden"], ["koppelingen", "🔗 Agenda's & accounts"], ["overig", "⚙️ Overig"]];
  const inhoud = { lijsten: instLijsten, locaties: instLocaties, koppelingen: instKoppelingen, overig: instOverig }[tab] || instLijsten;
  return `<div class="titelbalk"><h1>Instellingen</h1></div>
  <div class="tabs" data-actie="instTab">${tabs.map(([k, n]) => `<button type="button" data-w="${k}" aria-pressed="${k === tab}">${n}</button>`).join("")}</div>
  ${inhoud()}`;
}

function ledenBlok(o) {
  if (o.opslag) return `<div class="hint">📁 Persoonlijke lijst in je ${esc(naamVan(o.opslag))}. Delen kan alleen met lijsten in de Tijdkompas-cloud.</div>`;
  const leden = Object.entries(o.ledenInfo || {}).filter(([u]) => (o.leden || []).includes(u));
  return `<div class="leden">
    ${leden.length > 1 || (o.uitgenodigd || []).length ? leden.map(([u, l]) => `<span class="lid" title="${esc(l.email)}">${l.foto ? `<img class="avatar" src="${esc(l.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((l.naam || "?")[0].toUpperCase())}</span>`}${esc(u === sessie.ik ? "jij" : l.naam)}${u === o.eigenaar ? " <small class='hint'>eigenaar</small>" : ""}${u !== sessie.ik && u !== o.eigenaar && o.eigenaar === sessie.ik ? ` <button type="button" class="x" data-actie="lidWeg" data-w="${esc(u)}" title="Uit lijst halen">✕</button>` : ""}</span>`).join("") : ""}
    ${(o.uitgenodigd || []).map(m => `<span class="lid uitgenodigd" title="Uitgenodigd, nog niet geaccepteerd"><span class="avatar">✉</span>${esc(m)} <button type="button" class="x" data-actie="uitnodigingWeg" data-w="${esc(m)}" title="Uitnodiging intrekken">✕</button></span>`).join("")}
    <button type="button" class="knop klein" data-actie="ovDelen">👥 Delen…</button></div>`;
}

// Waar staat deze lijst? Tijdkompas-cloud (of alleen deze browser) of je eigen Drive/OneDrive
function opslagKeuze(o) {
  if (!ids().google && !ids().microsoft) return "";
  const gedeeld = (o.leden || []).length > 1 || (o.uitgenodigd || []).length;
  const basis = ingelogd() ? "☁️ Tijdkompas-cloud (deelbaar)" : "💻 Alleen deze browser";
  return `<label class="veld">Opslag<select data-veld="opslag" ${gedeeld ? "disabled title='Gedeelde lijsten staan altijd in de Tijdkompas-cloud'" : ""}>
    <option value="">${basis}</option>
    ${schijfVerbindingen().map(v => `<option value="${esc(v.id)}" ${o.opslag === v.id ? "selected" : ""}>📁 ${v.soort === "ms" ? "OneDrive" : "Google Drive"} · ${esc(v.email)}</option>`).join("")}
    ${o.opslag && !schijfVerbindingen().some(v => v.id === o.opslag) ? `<option value="${esc(o.opslag)}" selected>📁 ${esc(naamVan(o.opslag))} (niet gekoppeld)</option>` : ""}
    ${ids().google ? `<option value="+google">＋ Google Drive koppelen…</option>` : ""}
    ${ids().microsoft ? `<option value="+ms">＋ OneDrive koppelen…</option>` : ""}
  </select></label>`;
}

function instLijsten() {
  return `<p class="hint">Elke lijst heeft een eigen naam, kleur en standaardlocatie. Kies per lijst of hij <b>vaste tijden</b> heeft (zoals werk of een clubavond)
    of in je <b>vrije tijd</b> wordt ingepland. Bovenin de app kies je welke lijsten je ziet: één, een combinatie, of alles.</p>
  ${d().overzichten.map(o => {
    const l = locatie(o.locatie);
    if (o.slot) return `<div class="ovrij" data-ov="${o.id}">
    <span style="text-align:center;font-size:20px">${esc(o.icoon)}</span><span></span>
    <b>${esc(o.naam)}</b>
    <span></span>
    <div class="hint" style="grid-column:1/-1">🔒 Deze lijst staat in je ${esc(naamVan(o.opslag))}, en die is op dit apparaat (nog) niet gekoppeld.
      ${o.opslag.startsWith("ms:") ? `<button type="button" class="knop klein" data-actie="koppelMs" data-w="schijf">${msLogo} OneDrive koppelen</button>`
        : `<button type="button" class="knop klein" data-actie="koppelGoogle" data-w="schijf">${googleLogo} Google Drive koppelen</button>`}</div>
  </div>`;
    return `<div class="ovrij" data-ov="${o.id}">
    <input type="text" value="${esc(o.icoon)}" data-veld="icoon" aria-label="Icoon" style="text-align:center;padding:6px">
    <input type="color" value="${esc(o.kleur)}" data-veld="kleur" aria-label="Kleur">
    <input type="text" value="${esc(o.naam)}" data-veld="naam" aria-label="Naam" style="font-weight:600">
    <button class="knop klein gevaar" data-actie="ovWeg">${o.eigenaar && sessie.ik && o.eigenaar !== sessie.ik ? "Verlaten" : "Verwijderen"}</button>
    <div class="lijstopties">
      <div class="segment" role="group" aria-label="Soort lijst">
        <button type="button" data-actie="modus" data-w="vast" aria-pressed="${o.modus === "vast"}">🕘 Vaste tijden</button>
        <button type="button" data-actie="modus" data-w="vrij" aria-pressed="${o.modus === "vrij"}">🌿 Vrije tijd</button>
      </div>
      <label class="veld">Standaardlocatie<select data-veld="locatie">${locOpties(o.locatie, "Geen vaste plek")}</select></label>
      <label class="veld">Ingeplande blokken naar agenda<select data-veld="doelAgenda">${doelAgendaOpties(o.doelAgenda)}</select></label>
      ${opslagKeuze(o)}
    </div>
    <div class="tijden">
      ${o.modus === "vast" ? `${(o.tijden || []).map((t, i) => tijdrij(t, `data-i="${i}"`, true)).join("")}
        <div><button type="button" class="knop klein" data-actie="tijdBij">＋ tijdvak</button>
        <span class="hint">Bijv. ma/di/do op kantoor, wo/vr thuis. Reistijd naar de locatie gaat automatisch af van je vrije tijd.</span></div>`
      : `<div class="hint">Wordt ingepland in je vrije tijd (zie <a href="#" data-actie="instTab" data-w="locaties">beschikbaarheid</a>), na aftrek van vaste tijden, reistijd en afspraken.
         ${l?.reistijd ? `Elke sessie op ${esc(l.naam)} krijgt ${l.reistijd} min reistijd heen en terug; taken op dezelfde plek worden achter elkaar gezet.` : ""}</div>`}
      ${ledenBlok(o)}
    </div>
  </div>`; }).join("")}
  <button class="knop" data-actie="ovBij">＋ Lijst toevoegen</button>`;
}

function instLocaties() {
  const inst = d().instellingen;
  return `<h3 style="margin-top:0">Locaties</h3>
  <p class="hint">Reistijd = enkele reis vanaf huis, in minuten. Het adres (optioneel) gebruikt Tijdkompas om afspraken met die plaats te herkennen en er reistijd omheen te plannen.</p>
  <div class="lijst">${d().locaties.map(l => `<div class="locrij" data-loc="${l.id}">
    <input type="text" value="${esc(l.icoon)}" data-locveld="icoon" aria-label="Icoon" style="text-align:center;padding:6px">
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

  <h3>Agenda's koppelen</h3>
  <p class="hint">Koppel je Google- en/of Outlook-agenda's: Tijdkompas plant om je afspraken heen en kan ingeplande blokken er direct in zetten. Je kunt meerdere accounts koppelen (bijv. zakelijk Outlook én privé Google).</p>
  ${kanAgenda ? `<div class="lijst">${lijst.map(v => `<div class="accrij" data-verb="${esc(v.id)}">
    ${v.foto ? `<img class="avatar" src="${esc(v.foto)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((v.naam || v.email)[0].toUpperCase())}</span>`}
    <div class="ibody"><div class="ititel">${esc(v.naam)} <span class="tag">${v.soort === "ms" ? "Outlook" : "Google Agenda"}</span></div>
      <div class="imeta">${esc(v.email)}${isVerlopen(v) ? ` · <span style="color:var(--oranje)">sessie verlopen</span>` : ""}</div></div>
    ${isVerlopen(v) ? `<button class="knop klein" data-actie="vernieuw">Opnieuw verbinden</button>` : ""}
    <button class="knop klein gevaar" data-actie="ontkoppel">Ontkoppelen</button>
  </div>`).join("")}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
    ${id.google ? `<button class="knop" data-actie="koppelGoogle">${googleLogo} Google Agenda koppelen</button>` : ""}
    ${id.microsoft ? `<button class="knop" data-actie="koppelMs">${msLogo} Outlook-agenda koppelen</button>` : ""}
  </div>` : `<div class="leeg">Rechtstreeks koppelen met Google Agenda en Outlook komt eraan. Tot die tijd: importeer je agenda als .ics-bestand via Agenda → ⋯.</div>`}

  ${kanAgenda ? `<h3>Opslag in je eigen Drive of OneDrive</h3>
  <p class="hint">Je kunt per lijst kiezen om hem in je eigen Google Drive of OneDrive te bewaren (Instellingen → Lijsten → Opslag), bijvoorbeeld je werklijst in je zakelijke OneDrive.
    Tijdkompas krijgt dan alleen toegang tot een eigen verborgen map, niet tot je andere bestanden. Zulke lijsten zijn persoonlijk: delen kan alleen vanuit de Tijdkompas-cloud.
    ${ingelogd() ? "De cloud weet dan alleen dát de lijst bestaat; de taken zelf, en titels van afspraken, staan er niet in." : ""}</p>
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

function instOverig() {
  const thema = voorkeur.lees("thema", "donker");
  const bm = `javascript:(()=>{let t=document.title.replace(/ - [^-]*(Gmail|Outlook)[^-]*$/,'').replace(/^(Mail|E-mail) - /,'');window.open('${location.origin + location.pathname}?nieuw=1&titel='+encodeURIComponent(t)+'&url='+encodeURIComponent(location.href),'tijdkompas','width=720,height=820')})()`;
  return `<h3 style="margin-top:0">Mails koppelen</h3>
  <div class="paneel" style="display:flex;flex-direction:column;gap:10px;font-size:14px">
    <div>Sleep deze knop naar je bladwijzerbalk. Open een mail in Gmail of Outlook (web) en klik erop: er opent een nieuwe taak met de mail als link.</div>
    <div><a class="bookmarklet" href="${esc(bm)}" onclick="event.preventDefault();alert('Sleep deze knop naar je bladwijzerbalk.')">＋ Tijdkompas</a></div>
    <div class="hint">Op je telefoon: installeer Tijdkompas (menu → „Toevoegen aan startscherm”) en gebruik <b>Delen</b> vanuit je mail-app. Of plak gewoon de link van een mail in een taak.</div>
  </div>
  <h3>Weergave</h3>
  <div class="chips" data-actie="thema">${[["donker", "🌙 Donker"], ["licht", "☀️ Licht"]].map(([v, n]) => `<button type="button" data-w="${v}" style="${thema === v ? "border-color:var(--accent);color:var(--accent)" : ""}">${n}</button>`).join("")}</div>
  <h3>Gegevens</h3>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="knop" data-actie="exportJson">⬇ Back-up downloaden</button>
    <button class="knop" data-actie="importJson">⬆ Back-up terugzetten</button>
    ${ingelogd() ? "" : `<button class="knop" data-actie="demo">Voorbeelddata laden</button>`}
    <button class="knop gevaar" data-actie="leeg">Alles wissen</button>
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
    <div class="hint" style="margin:8px 0 4px">Inloggen kan met: ${g.aanbieders.map(a => `${a.soort === "google" ? googleLogo + " Google" : msLogo + " Microsoft"}${a.email ? " (" + esc(a.email) + ")" : ""}`).join(" · ")}</div>
    ${!heeft("microsoft") ? `<button type="button" class="knop klein" data-actie="koppelAccount" data-w="microsoft">${msLogo} Ook met Microsoft-account kunnen inloggen</button>` : ""}
    ${!heeft("google") ? `<button type="button" class="knop klein" data-actie="koppelAccount" data-w="google">${googleLogo} Ook met Google-account kunnen inloggen</button>` : ""}`;
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
  dlg.showModal();
});

// Inlog-acties (zowel vanuit de dialoog als vanuit Instellingen). De popup opent direct binnen de klik.
function accountActie(a, w, klaar) {
  if (a === "login") {
    login(w).then(() => { klaar?.(); toast("Ingelogd"); }).catch(e => toast(foutTekst(e)));
  } else if (a === "koppelAccount") {
    koppelAccount(w).then(() => { toast("Gekoppeld — je kunt nu met beide accounts inloggen"); location.reload(); }).catch(e => toast(foutTekst(e)));
  } else if (a === "uitloggen") {
    if (confirm("Uitloggen? Je planning blijft veilig in je account staan.")) uitloggen().then(() => { klaar?.(); toast("Uitgelogd"); render(); });
  } else return false;
  return true;
}

// ---------- uitnodigingen ----------
function uitnodigingBanner() {
  return cloud.uitnodigingen.map(u => `<div class="banner">👥 <span><b>${esc(u.van)}</b> nodigt je uit voor de lijst <b>${esc(u.icoon || "")} ${esc(u.naam)}</b>.</span>
    <button class="knop klein prim" data-actie="accepteer" data-w="${esc(u.id)}">Doe mee</button><button class="knop klein" data-actie="weiger" data-w="${esc(u.id)}" style="margin-left:0">Nee, dank je</button></div>`).join("");
}

// ---------- agenda-koppel-acties ----------
const verlopenSessies = new Map();
function sessieBanner() {
  const lijst = [...verlopenSessies.values()].filter(v => verbindingen().some(x => x.id === v.id));
  const schijfVerl = [...schijf.verlopen.values()].filter(v => !lijst.some(x => x.id === v.id));
  return uitnodigingBanner() + lijst.map(v => `<div class="banner">🔑 De agenda-koppeling met <b>${esc(v.email)}</b> is verlopen.<button class="knop klein" data-actie="vernieuw" data-verbid="${esc(v.id)}">Opnieuw verbinden</button></div>`).join("")
    + schijfVerl.map(v => `<div class="banner">🔑 De verbinding met je ${esc(naamVan(v.id))} is verlopen — wijzigingen staan veilig op dit apparaat en gaan mee zodra je opnieuw verbindt.<button class="knop klein" data-actie="vernieuw" data-verbid="${esc(v.id)}">Opnieuw verbinden</button></div>`).join("");
}
// doel: "agenda" of "schijf"; lijstId: na het koppelen van een schijf deze lijst er meteen naartoe verplaatsen
async function doeKoppel(soort, doel = "agenda", lijstId = null) {
  try {
    const v = await (soort === "ms" ? koppelMs([doel]) : koppelGoogle([doel]));
    if (doel === "agenda") { toast(`Agenda van ${v.email} gekoppeld`); await doeOphalen(true); }
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
    status: "open", links: [], gedeeldMet: [], project: null, overzicht: actieveOverzichten()[0], ...standaard,
  });
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
        <label class="veld">Overzicht<select name="overzicht">${d().overzichten.map(o => `<option value="${o.id}" ${o.id === c.overzicht ? "selected" : ""}>${o.icoon} ${esc(o.naam)}</option>`).join("")}</select></label>
        ${isProj ? "" : `<label class="veld">Project<select name="project"><option value="">— losse taak —</option>${d().projecten.filter(p => p.status !== "klaar" || p.id === c.project).map(p => `<option value="${p.id}" ${p.id === c.project ? "selected" : ""}>◆ ${esc(p.titel)}</option>`).join("")}</select></label>`}
        ${!isProj && (overzicht(c.overzicht)?.leden || []).length > 1 ? `<label class="veld">👤 Wie doet het?<select name="toegewezen">${overzicht(c.overzicht).leden.map(u =>
          `<option value="${esc(u)}" ${u === (c.toegewezen || sessie.ik) ? "selected" : ""}>${u === sessie.ik ? "Ik" : esc(overzicht(c.overzicht).ledenInfo?.[u]?.naam || u)}</option>`).join("")}</select></label>` : ""}
        <label class="veld">📍 Locatie<select name="locatie">${(() => { const volg = locatie(effectieveLocatie({ ...c, locatie: "" }));
          return `<option value="">${volg ? "Zoals " + (c.project && !isProj ? "project/" : "") + "lijst: " + esc(volg.naam) : "Geen vaste plek"}</option>` +
            d().locaties.map(l => `<option value="${l.id}" ${l.id === c.locatie ? "selected" : ""}>${l.icoon} ${esc(l.naam)}${l.reistijd ? ` (${l.reistijd} min)` : ""}</option>`).join(""); })()}</select></label>
      </div>
      <div><div class="veld" style="font-size:13px;color:var(--meta);margin-bottom:6px">Urgent / belangrijk</div>
        <div class="minimatrix">${["doen", "plannen", "delegeren", "schrappen"].map(k => `<button type="button" data-q="${k}" style="--qk:${qKleur(k)}" aria-pressed="${k === q}"><b style="color:${qKleur(k)}">${KWADRANTEN[k].naam}</b><small>${KWADRANTEN[k].sub}</small></button>`).join("")}</div></div>
      <div class="rij">
        <label class="veld">⏰ Deadline<input type="date" name="deadline" value="${c.deadline || ""}"></label>
        <label class="veld">🎯 Eigen streefdatum<input type="date" name="streef" value="${c.streef || ""}"></label>
        <label class="veld">Geschatte tijd<input type="text" name="schatting" value="${fmtDuur(c.schatting)}" placeholder="bv. 1u30"></label>
        <label class="veld">Werkelijke tijd<input type="text" name="werkelijk" value="${fmtDuur(c.werkelijk)}" placeholder="achteraf"></label>
      </div>
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

      ${(() => { const o = overzicht(c.overzicht), n = (o?.leden || []).length;
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
    if (f.toegewezen) c.toegewezen = f.toegewezen.value;
    c.schatting = leesDuur(f.schatting.value); c.werkelijk = leesDuur(f.werkelijk.value);
    if (f.project) c.project = f.project.value || null;
  };
  const opslaan = () => {
    lees();
    if (!c.titel) { $("#editForm").titel.focus(); return false; }
    const opdeling = $("#editForm").opdeling?.value || "";
    const velden = { titel: c.titel, overzicht: c.overzicht, notitie: c.notitie, deadline: c.deadline, streef: c.streef, schatting: c.schatting,
                     werkelijk: c.werkelijk, urgent: c.urgent, belangrijk: c.belangrijk, links: c.links, gedeeldMet: c.gedeeldMet, locatie: c.locatie || "" };
    if (!isProj && (c.toegewezen || sessie.ik)) velden.toegewezen = c.toegewezen || sessie.ik;
    if (nieuw) {
      if (isProj) {
        const p = nieuwProject(velden);
        opdeling.split("\n").map(s => s.trim()).filter(Boolean).forEach(r => {
          const m = r.match(/~\s*(\S+)/);
          nieuweTaak({ titel: r.replace(/~\s*\S+/, "").trim(), schatting: m ? leesDuur(m[1]) : 0, project: p.id, overzicht: p.overzicht, urgent: p.urgent, belangrijk: p.belangrijk });
        });
        toast(`Project „${p.titel}” aangemaakt`);
      } else { nieuweTaak({ ...velden, project: c.project }); toast("Taak toegevoegd"); }
    } else {
      if (!isProj) { velden.project = c.project; if (c.project) velden.overzicht = project(c.project)?.overzicht || c.overzicht; }
      if (isProj && velden.overzicht !== item.overzicht) takenVan(item.id).forEach(t => t.overzicht = velden.overzicht);
      werkBij(item, velden);
    }
    return true;
  };

  teken();
  dlg.onclick = (e) => {
    const b = e.target.closest("button,[data-q]"); if (!b) return;
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
    else if (b.dataset.subvink) { lees(); const t = taak(b.dataset.subvink); t.status === "klaar" ? heropen(t) : vraagWerkelijk(t, teken); teken(); }
    else if (a === "uitProject") { lees(); c.project = null; if (opslaan()) { dlg.close(); toast("Taak staat nu los"); } }
    else if (a === "weg") {
      const extra = isProj && takenVan(item.id).length ? `\nDe ${takenVan(item.id).length} taken blijven bestaan als losse taken.` : "";
      if (confirm(`„${item.titel}” verwijderen?${extra}`)) { verwijder(item); dlg.close(); toast("Verwijderd"); }
    } else if (a === "klaar") { if (opslaan()) { dlg.close(); vraagWerkelijk(item); } }
    else if (a === "heropen") { if (opslaan()) { heropen(item); dlg.close(); } }
  };
  dlg.onkeydown = (e) => {
    if (e.key !== "Enter" || e.target.tagName === "TEXTAREA") return;
    const id = e.target.id;
    if (id === "nieuweLink" || id === "nieuwLabel") { e.preventDefault(); $('[data-actie="linkBij"]', dlg).click(); }
    else if (id === "deelMail") { e.preventDefault(); $('[data-actie="deelBij"]', dlg).click(); }
    else if (id === "subNieuw") { e.preventDefault(); $('[data-actie="subBij"]', dlg).click(); }
  };
  dlg.onclose = () => { if (dlg.returnValue === "ok") opslaan(); dlg.onclose = null; dlg.onclick = null; };
  dlg.onsubmit = (e) => { if (e.submitter?.value === "ok") { lees(); if (!c.titel) { e.preventDefault(); return; } } };
  dlg.returnValue = "";
  dlg.showModal();
}

// "Klaar! Hoe lang duurde het?"
function vraagWerkelijk(item, na) {
  const s = item.schatting || 0;
  const opties = s ? [[s, "zoals geschat"], [Math.round(s * 1.5 / 5) * 5, "×1,5"], [s * 2, "×2"], [Math.round(s * 0.5 / 5) * 5, "de helft"]] : [[15, ""], [30, ""], [60, ""], [120, ""]];
  dlg2.innerHTML = `<form method="dialog"><div class="dkop"><h2>✓ Klaar: ${esc(item.titel)}</h2><button type="button" class="sluit" data-sluit aria-label="Sluiten">×</button></div>
    <div class="dlijf"><div>Hoe lang heeft het werkelijk geduurd?${s ? ` <span class="hint">Geschat: ${fmtDuur(s)}</span>` : ""}</div>
      <div class="chips">${opties.map(([m, n]) => `<button type="button" data-m="${m}">${fmtDuur(m)}${n ? ` <small class="hint">${n}</small>` : ""}</button>`).join("")}</div>
      <label class="veld">Werkelijke tijd<input type="text" id="werkInv" value="${fmtDuur(item.werkelijk || s)}" placeholder="bv. 1u15"></label>
      <p class="hint" style="margin:0">Hiermee leert Tijdkompas hoe goed je schat, en plant het voortaan realistischer.</p></div>
    <div class="dvoet"><button type="button" class="knop" data-skip>Weet ik niet</button><div class="rechts"><button class="knop prim" value="ok">Opslaan</button></div></div></form>`;
  dlg2.onclick = (e) => { const b = e.target.closest("[data-m]"); if (b) $("#werkInv").value = fmtDuur(+b.dataset.m); if (e.target.closest("[data-skip]")) dlg2.close("skip"); };
  dlg2.onclose = () => {
    if (dlg2.returnValue === "ok") rondAf(item, leesDuur($("#werkInv").value) || null);
    else if (dlg2.returnValue === "skip") rondAf(item, null);
    dlg2.onclose = null; na?.();
    if (dlg2.returnValue === "ok" || dlg2.returnValue === "skip") toast("Mooi! Afgerond ✓");
  };
  dlg2.returnValue = "";
  dlg2.showModal();
  setTimeout(() => $("#werkInv")?.select(), 50);
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
  v.titel = t.replace(/\s+/g, " ").trim();
  if (!v.overzicht) v.overzicht = actieveOverzichten()[0];
  if (!v.titel) return null;
  if (!v.deadline) delete v.deadline;
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
main.addEventListener("click", async (e) => {
  if (e.target.closest("a[href^='http']")) return;
  const tabLink = e.target.closest("[data-tab]");
  if (tabLink) { voorkeur.zet("instTab", tabLink.dataset.tab); }
  const vink = e.target.closest(".vink");
  const el = e.target.closest("[data-actie]");
  if (vink) {
    const rij = vink.closest("[data-id]"); const t = rij.dataset.type === "project" ? project(rij.dataset.id) : taak(rij.dataset.id);
    if (t.status === "klaar") { heropen(t); toast("Heropend"); } else vraagWerkelijk(t);
    return;
  }
  if (el && el.tagName !== "FORM" && el.tagName !== "DIV" || (el?.tagName === "DIV" && e.target.closest("button[data-w]"))) {
    const a = el.dataset.actie, w = e.target.closest("[data-w]")?.dataset.w;
    if (a === "leeg") { if (confirm("Alle taken, projecten en planning wissen en met een lege planner beginnen?")) { d().overzichten.forEach(o => lijstWeg(o.id)); opslag.wis(); actief = null; voorkeur.zet("actief", null); toast("Lege planner — succes!"); } }
    else if (a === "demo") { if (confirm("Huidige gegevens vervangen door voorbeelddata?")) opslag.demo(); }
    else if (a === "nieuwProject") openEditor(null, { type: "project" });
    else if (a === "matrixToon" && w) { voorkeur.zet("matrixToon", w); render(); }
    else if (a === "thema" && w) { voorkeur.zet("thema", w); zetThema(); render(); }
    else if (a === "week") { weekVerschuiving = w === "0" ? 0 : weekVerschuiving + +w; render(); }
    else if (a === "plan") {
      const r = planAutomatisch(actieveOverzichten()); laatsteWaarschuwingen = r.waarschuwingen; bewaar();
      toast(`${r.blokken} blokken ingepland${r.waarschuwingen.length ? " · " + r.waarschuwingen.length + " waarschuwing(en)" : ""}`);
    }
    else if (a === "wisPlanning") { if (confirm("Alle toekomstige, niet-vastgezette blokken wissen?")) { const nu = new Date(); d().planning = d().planning.filter(b => b.vast || new Date(b.eind) <= nu); laatsteWaarschuwingen = []; bewaar(); } }
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
    else if (a === "ovBij") { d().overzichten.push({ id: uid() + (sessie.ik ? uid() : ""), naam: "Nieuwe lijst", kleur: "#c48ed8", icoon: "📁", modus: "vrij", locatie: "", doelAgenda: null, tijden: [] }); bewaar(); }
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
    else if (["login", "koppelAccount", "uitloggen"].includes(a)) accountActie(a, w);
    else if (a === "accepteer") { accepteer(w).then(() => toast("Je doet nu mee met deze lijst")).catch(e => toast(e.message)); }
    else if (a === "weiger") { weiger(w).catch(e => toast(e.message)); }
    else if (a === "lidWeg") { const o = overzicht(el.closest("[data-ov]").dataset.ov); if (confirm(`${o.ledenInfo?.[w]?.naam || "Dit lid"} uit „${o.naam}” halen?`)) { o.leden = o.leden.filter(x => x !== w); delete o.ledenInfo[w]; bewaar(); } }
    else if (a === "uitnodigingWeg") { const o = overzicht(el.closest("[data-ov]").dataset.ov); o.uitgenodigd = (o.uitgenodigd || []).filter(x => x !== w); bewaar(); }
    else if (a === "koppelGoogle") doeKoppel("google", w || "agenda");
    else if (a === "koppelMs") doeKoppel("ms", w || "agenda");
    else if (a === "vernieuw") { const id = el.dataset.verbid || el.closest("[data-verb]")?.dataset.verb; doeVernieuw(alleVerbindingen().find(v => v.id === id)); }
    else if (a === "ontkoppel") {
      const v = verbindingen().find(x => x.id === el.closest("[data-verb]").dataset.verb);
      if (confirm(`Agenda's van ${v.email} ontkoppelen? Afspraken uit dit account worden niet meer meegenomen.`)) {
        await zonderDoel(v, "agenda"); d().bezet = d().bezet.filter(b => !String(b.bron).startsWith(v.id + "|")); bewaar(); toast("Ontkoppeld");
      }
    }
    else if (a === "schijfWeg") {
      const v = schijfVerbindingen().find(x => x.id === el.closest("[data-verb]").dataset.verb);
      const n = d().overzichten.filter(o => o.opslag === v.id);
      if (n.length) { toast(`Zet eerst ${n.map(o => "„" + o.naam + "”").join(", ")} op een andere opslag (Instellingen → Lijsten)`); return; }
      if (confirm(`${naamVan(v.id)} ontkoppelen?`)) { await zonderDoel(v, "schijf"); toast("Ontkoppeld"); render(); }
    }
    else if (a === "ophalen") { el.disabled = true; await doeOphalen(); render(); }
    else if (a === "naarAgenda") { el.disabled = true; await doeNaarAgenda(); }
    else if (a === "ovWeg") {
      const o = overzicht(el.closest("[data-ov]").dataset.ov);
      if (o.eigenaar && sessie.ik && o.eigenaar !== sessie.ik) {      // andermans lijst: verlaten (taken blijven voor de anderen)
        if (confirm(`De gedeelde lijst „${o.naam}” verlaten? De taken blijven bestaan voor de andere leden.`)) {
          d().overzichten = d().overzichten.filter(x => x !== o);
          d().taken = d().taken.filter(t => t.overzicht !== o.id); d().projecten = d().projecten.filter(p => p.overzicht !== o.id);
          d().planning = d().planning.filter(b => b.overzicht !== o.id); bewaar(); toast("Lijst verlaten");
        }
        return;
      }
      const n = d().taken.filter(t => t.overzicht === o.id).length + d().projecten.filter(p => p.overzicht === o.id).length;
      if (d().overzichten.length === 1) { toast("Er moet minstens één overzicht blijven"); return; }
      if (n) { toast(`Verplaats eerst de ${n} taken/projecten in „${o.naam}”`); return; }
      if (confirm(`Overzicht „${o.naam}” verwijderen?`)) { lijstWeg(o.id); d().overzichten = d().overzichten.filter(x => x !== o); bewaar(); }
    }
    else if (a === "tijdBij") { const o = overzicht(el.closest("[data-ov]").dataset.ov); o.tijden.push({ dagen: [1, 2, 3, 4, 5], van: "09:00", tot: "17:00", locatie: o.locatie || "" }); bewaar(); }
    else if (a === "tijdWeg") {
      const b = el.closest("[data-besch]");
      if (b) { if (d().beschikbaar.length > 1) d().beschikbaar.splice(+b.dataset.besch, 1); else toast("Er moet minstens één tijdvak blijven"); }
      else overzicht(el.closest("[data-ov]").dataset.ov).tijden.splice(+el.closest("[data-i]").dataset.i, 1);
      bewaar();
    }
    else if (a === "ovDelen") {
      const o = overzicht(el.closest("[data-ov]").dataset.ov);
      if (!ingelogd()) { toast("Log eerst in om lijsten te delen"); $("#accountKnop").click(); return; }
      if (o.opslag) { toast("Deze lijst staat in je eigen schijf. Zet hem eerst op „Tijdkompas-cloud” om te delen."); return; }
      const m = prompt(`Lijst „${o.naam}” delen met (e-mailadres van hun Google- of Microsoft-account):`, "");
      if (m && /^\S+@\S+\.\S+$/.test(m.trim())) {
        o.uitgenodigd = [...new Set([...(o.uitgenodigd || []), m.trim().toLowerCase()])]; bewaar();
        toast(`Uitgenodigd — ${m.trim()} ziet de uitnodiging zodra die inlogt op ${location.host + location.pathname}`);
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
});
main.addEventListener("submit", (e) => {
  if (e.target.dataset.actie !== "snel") return;
  e.preventDefault();
  const inv = e.target.t, t = verwerkSnel(inv.value);
  if (t) { toast(`„${t.titel}” toegevoegd${t.project ? " aan " + project(t.project).titel : ""}`); setTimeout(() => $(".snel input")?.focus(), 0); }
});
main.addEventListener("change", (e) => {
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
    if (rij) o.tijden[+rij.dataset.i][veld] = waarde; else o[veld] = waarde;
    bewaar(); return;
  }
  const g = e.target.closest("[data-actie]"); if (!g) return;
  if (g.dataset.actie === "takenFilter" && e.target.name !== "zoek") {
    const f = voorkeur.lees("takenFilter", { status: "open", groep: "project", zoek: "" }); f[e.target.name] = e.target.value; voorkeur.zet("takenFilter", f); render();
  } else if (g.dataset.actie === "inst") {
    d().instellingen[e.target.name] = e.target.type === "checkbox" ? e.target.checked : Math.max(0, +e.target.value || 0); bewaar();
  } else if (g.dataset.actie === "toonKlaarProj") { voorkeur.zet("toonKlaarProj", e.target.checked); render(); }
});
main.addEventListener("input", (e) => {
  if (e.target.name === "zoek") {
    const f = voorkeur.lees("takenFilter", { status: "open", groep: "project", zoek: "" }); f.zoek = e.target.value; voorkeur.zet("takenFilter", f);
    const pos = e.target.selectionStart; render(); const z = $('input[name="zoek"]'); z.focus(); z.setSelectionRange(pos, pos);
  }
});

$("#nieuwKnop").addEventListener("click", () => openEditor(null, huidige() === "projecten" ? { type: "project" } : {}));
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input,textarea,select,dialog")) return;
  if (e.key === "n") { e.preventDefault(); openEditor(); }
  if (e.key === "p") { e.preventDefault(); openEditor(null, { type: "project" }); }
});

$$("dialog").forEach(dl => dl.addEventListener("click", (e) => { if (e.target.closest("[data-sluit]")) dl.close(); }));

function zetThema() { document.documentElement.dataset.theme = voorkeur.lees("thema", "donker"); }

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
