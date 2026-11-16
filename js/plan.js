// Tijdkompas — automatisch inroosteren + agenda import/export (.ics, Google/Outlook-links)
//
// Twee soorten lijsten:
//  • "vast"  — eigen tijdvakken (bv. werk ma/di/do op kantoor, wo/vr thuis). Taken alleen binnen die tijden.
//              Reistijd naar de locatie gaat vóór/na het tijdvak af van je vrije tijd.
//  • "vrij"  — alles wat overblijft binnen je beschikbaarheid, na aftrek van vaste tijden, reistijd en afspraken.
//              Staat de lijst (of taak) op een locatie met reistijd, dan krijgt elke sessie reis heen + terug;
//              taken op dezelfde locatie worden achter elkaar gezet zodat je maar één keer reist.
import { opslag, kwadrant, kalibratie, project, overzicht, locatie, effectieveLocatie, uid, linkInfo, isMijn, taak, sessie } from "./data.js";

// Agenda en planning van gelinkte accounts (privé ↔ werk): je bent één mens, dus daar plannen we omheen.
// De app vult dit (cloud.familieAgenda); zonder gelinkte accounts is het leeg.
export const familieHaak = { agenda: () => ({ bezet: [], planning: [] }) };
// Lijsten van een gelinkt account plant dat account zelf in (in zijn eigen agenda); hier niet nog eens.
const vanGelinkt = (ovId) => { const o = overzicht(ovId), f = sessie.familie || []; return !!(o?.eigenaar && f.length > 1 && o.eigenaar !== sessie.ik && f.includes(o.eigenaar)); };

const MIN = 60000;
const rondOp = (d, stap = 15) => new Date(Math.ceil(d.getTime() / (stap * MIN)) * stap * MIN);
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
export const eventSoort = (ev) => opslag.d.agendas[ev.bron]?.soort || "bezet";
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

/**
 * Indeling van één dag: vaste tijdvakken (alle "vast"-lijsten), reistijd daaromheen,
 * pauzes ter plekke, en de vrije vensters die overblijven voor "vrij"-lijsten.
 */
export function dagIndeling(dag) {
  const d = opslag.d;
  const dagEind = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate() + 1);
  const opDezeDag = (ev) => new Date(ev.start) < dagEind && new Date(ev.eind) > dag;
  const vast = [];
  for (const o of d.overzichten.filter(o => o.modus === "vast")) {
    const rooster = d.bezet.filter(ev => eventSoort(ev) === "rooster" && eventLijst(ev) === o.id && opDezeDag(ev));
    if (rooster.length) rooster.forEach(ev => vast.push({ lijst: o.id, a: new Date(ev.start), b: new Date(ev.eind), locatie: (ev.loc ?? herkenLocatie(ev.plaats)) || o.locatie || "", bron: "rooster" }));
    else (o.tijden || []).filter(t => t.dagen.includes(dag.getDay()))
      .forEach(t => vast.push({ lijst: o.id, a: opDag(dag, t.van), b: opDag(dag, t.tot), locatie: t.locatie ?? o.locatie ?? "", bron: "lijst" }));
  }
  vast.sort((x, y) => x.a - y.a);

  const reis = [], terPlekke = [];
  vast.forEach((v, i) => {
    const r = reisVan(v.locatie); if (!r) return;
    // korte pauze tussen twee tijdvakken op dezelfde plek: je blijft ter plekke, geen reis
    const kort = (x, y) => x && y && x.locatie === y.locatie && minuten(x.b, y.a) >= 0 && minuten(x.b, y.a) < 2 * r + 60;
    if (!kort(vast[i - 1], v)) reis.push({ a: new Date(v.a - r * MIN), b: v.a, locatie: v.locatie, lijst: v.lijst, richting: "heen" });
    if (kort(v, vast[i + 1])) terPlekke.push({ a: v.b, b: vast[i + 1].a, locatie: v.locatie, lijst: v.lijst });
    else reis.push({ a: v.b, b: new Date(v.b.getTime() + r * MIN), locatie: v.locatie, lijst: v.lijst, richting: "terug" });
  });
  // Afspraken (soort bezet) op een bekende locatie met reistijd: reis eromheen
  for (const ev of d.bezet.filter(ev => eventSoort(ev) === "bezet" && !ev.eigen && opDezeDag(ev))) {
    const loc = ev.loc ?? herkenLocatie(ev.plaats), r = reisVan(loc);
    if (!r) continue;
    if (vast.some(v => v.locatie === loc && v.a <= new Date(ev.start) && v.b >= new Date(ev.eind))) continue; // al ter plekke
    reis.push({ a: new Date(new Date(ev.start) - r * MIN), b: new Date(ev.start), locatie: loc, richting: "heen", afspraak: ev.titel });
    reis.push({ a: new Date(ev.eind), b: new Date(new Date(ev.eind).getTime() + r * MIN), locatie: loc, richting: "terug", afspraak: ev.titel });
  }

  const beschikbaar = (d.beschikbaar || []).filter(t => t.dagen.includes(dag.getDay())).map(t => [opDag(dag, t.van), opDag(dag, t.tot)]);
  const vrij = aftrekken(beschikbaar, [...vast, ...reis, ...terPlekke].map(x => [x.a, x.b]));
  return { vast, reis, terPlekke, beschikbaar, vrij };
}

/**
 * Plant alle open taken (en projecten zonder taken) in. Vastgezette blokken en afspraken blijven staan.
 * @returns {{blokken:number, waarschuwingen:string[]}}
 */
export function planAutomatisch(actieveOverzichten) {
  const d = opslag.d, inst = d.instellingen, nu = new Date();
  const start = rondOp(nu);
  const eind = new Date(start.getTime() + inst.horizon * 864e5);
  const buf = inst.buffer * MIN;

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
    if (!indeling[k]) { indeling[k] = dagIndeling(dag); indeling[k].reis.forEach(r => bezet.push({ a: r.a, b: r.b, ref: "reis", reis: true })); }
    return indeling[k];
  };

  // Vrije stukken binnen [wa, wb], met pauze rond bezette tijd
  const gaten = (wa, wb, negeer) => {
    const uit = []; let c = wa < start ? start : wa;
    for (const x of bezet.filter(x => x.ref !== negeer && x.b > c && x.a < wb).sort((p, q) => p.a - q.a)) {
      const tot = new Date(Math.min(wb, x.a - (x.reis ? 0 : buf)));
      if (tot > c) uit.push([rondOp(c, 5), tot]);
      const na = new Date(x.b.getTime() + (x.reis ? 0 : buf));
      if (na > c) c = na;
    }
    if (wb > c) uit.push([rondOp(c, 5), wb]);
    return uit.filter(([a, b]) => b - a >= 5 * MIN);
  };

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
      if (tot > vanaf) vanaf = rondOp(new Date(tot.getTime() + buf), 5);
    }
    if (wachtOpOnbekend) { eindVan[it.id] = null; waarschuwingen.push(`„${it.titel}” wacht op „${wachtOpOnbekend.titel}”, en die is nog niet ingepland — daarom nog niet ingepland.`); continue; }
    const al = d.planning.filter(b => b.item === it.id && b.vast && b.soort !== "reis").reduce((s, b) => s + minuten(new Date(b.start), new Date(b.eind)), 0);
    let fac = 1;
    if (inst.kalibratie) { factorCache[it.overzicht] ??= kalibratie(it.overzicht).factor; fac = Math.min(2, Math.max(0.8, factorCache[it.overzicht])); }
    let rest = Math.round(((it.schatting || 30) * fac - (it.werkelijk || 0) - al) / 5) * 5;
    if (rest < inst.blokMin) rest = it.schatting ? Math.max(0, rest) : 30;
    if (rest <= 0) continue;

    const p = it.project ? project(it.project) : null;
    const eigenLoc = it.locatie || p?.locatie || "";          // expliciet gekozen plek
    const loc = ov.modus === "vast" ? eigenLoc : effectieveLocatie(it);
    const reis = ov.modus === "vrij" ? reisVan(loc) : 0;      // bij vaste tijden zit reis al in het rooster
    const deadline = harde(it);
    let laatste = null;
    const basisBlok = { item: it.id, type: it.type, overzicht: it.overzicht, titel: it.titel, locatie: loc };

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
            const g = gaten(s.eindTaak, venster[1], s.terug.id).find(([a]) => a <= new Date(s.eindTaak.getTime() + buf + 5 * MIN));
            if (!g) continue;
            const a = rondOp(new Date(s.eindTaak.getTime() + buf), 5);
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
        const gatenDag = vensters.flatMap(([wa, wb]) => gaten(wa, wb));
        const g = gatenDag.find(([a, b]) => minuten(a, b) - 2 * reis >= heel)
               || gatenDag.find(([a, b]) => minuten(a, b) - 2 * reis >= deelMin);
        if (g && heel >= Math.min(deelMin, heel)) {
          const duur = Math.min(heel, Math.floor((minuten(g[0], g[1]) - 2 * reis) / 5) * 5);
          if (reis) {
            const naam = locatie(loc)?.naam || "";
            nieuwBlok({ ...basisBlok, soort: "reis", titel: `Reis naar ${naam}`, a: g[0], b: new Date(g[0].getTime() + reis * MIN) });
            const b = plaats(new Date(g[0].getTime() + reis * MIN), duur);
            const terug = nieuwBlok({ ...basisBlok, soort: "reis", titel: `Reis terug van ${naam}`, a: new Date(b.eind), b: new Date(new Date(b.eind).getTime() + reis * MIN) });
            sessies.push({ loc, dag: dagStr(dag), eindTaak: new Date(b.eind), terug });
          } else plaats(g[0], duur);
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

// ---------- .ics import (bezette tijden) ----------
function leesIcsDatum(waarde, params) {
  const m = waarde.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, j, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { datum: true };
  if (z) return new Date(Date.UTC(+j, mo - 1, +d, +h, +mi, +s));
  return new Date(+j, mo - 1, +d, +h, +mi, +s); // TZID/zwevend: als lokale tijd lezen
}

export function leesIcs(tekst, bron = "agenda") {
  const regels = tekst.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const uit = []; let ev = null;
  const nu = new Date(), grens = new Date(Date.now() + 60 * 864e5);
  for (const regel of regels) {
    if (regel === "BEGIN:VEVENT") ev = {};
    else if (regel === "END:VEVENT") {
      if (ev?.start instanceof Date && ev.eind instanceof Date && ev.eind > nu && ev.start < grens && ev.transp !== "TRANSPARENT")
        uit.push({ id: uid(), start: ev.start.toISOString(), eind: ev.eind.toISOString(), titel: ev.titel || "Bezet", plaats: ev.plaats || "", bron, herhalend: !!ev.rrule });
      ev = null;
    } else if (ev) {
      const i = regel.indexOf(":"); if (i < 0) continue;
      const [naam, ...params] = regel.slice(0, i).split(";"); const waarde = regel.slice(i + 1);
      if (naam === "DTSTART") ev.start = leesIcsDatum(waarde, params);
      else if (naam === "DTEND") ev.eind = leesIcsDatum(waarde, params);
      else if (naam === "SUMMARY") ev.titel = waarde.replace(/\\([,;\\])/g, "$1").replace(/\\n/g, " ");
      else if (naam === "TRANSP") ev.transp = waarde;
      else if (naam === "LOCATION") ev.plaats = waarde.replace(/\\([,;\\])/g, "$1");
      else if (naam === "RRULE") ev.rrule = waarde;
    }
  }
  return uit;
}
