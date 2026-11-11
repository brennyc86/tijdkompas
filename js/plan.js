// Tijdkompas — automatisch inroosteren + agenda import/export (.ics, Google/Outlook-links)
import { opslag, kwadrant, kalibratie, project, overzicht, uid, linkInfo } from "./data.js";

const MIN = 60000;
const rondOp = (d, stap = 15) => new Date(Math.ceil(d.getTime() / (stap * MIN)) * stap * MIN);
const hm = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
export const dagStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Doeldatum: de vroegste van eigen streefdatum en harde deadline (taak of bijbehorend project)
export function doelDatum(item) {
  const p = item.project ? project(item.project) : null;
  const kand = [item.streef, item.deadline, p?.streef, p?.deadline].filter(Boolean).sort();
  return kand[0] || null;
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

// Werkvensters van een overzicht op een dag (minuten sinds middernacht)
function vensters(ov, d) {
  return (ov?.tijden || []).filter(t => t.dagen.includes(d.getDay())).map(t => [hm(t.van), hm(t.tot)]);
}

/**
 * Plant alle open taken (en projecten zonder taken) in vrije tijd binnen de werktijden van hun overzicht.
 * Vastgezette blokken en geïmporteerde afspraken blijven staan.
 * @returns {{blokken:number, waarschuwingen:string[]}}
 */
export function planAutomatisch(actieveOverzichten) {
  const d = opslag.d, inst = d.instellingen, nu = new Date();
  const start = rondOp(nu);
  const eind = new Date(start.getTime() + inst.horizon * 864e5);

  // Toekomstige niet-vaste blokken van actieve overzichten vervallen; de rest blijft
  d.planning = d.planning.filter(b => b.vast || new Date(b.eind) <= nu || !actieveOverzichten.includes(b.overzicht));

  const bezet = [
    ...d.bezet.map(b => [new Date(b.start), new Date(b.eind)]),
    ...d.planning.map(b => [new Date(b.start), new Date(b.eind)]),
  ];

  // Kandidaten
  const items = [
    ...d.taken.filter(t => t.status !== "klaar"),
    ...d.projecten.filter(p => p.status !== "klaar" && p.schatting > 0 && !d.taken.some(t => t.project === p.id && t.status !== "klaar")),
  ].filter(i => actieveOverzichten.includes(i.overzicht))
   .filter(i => inst.schrappenInplannen || kwadrant(i) !== "schrappen");

  items.sort((a, b) => prioriteit(b, nu) - prioriteit(a, nu));

  const waarschuwingen = [];
  let blokken = 0;
  const factorCache = {}, ruimte = {};

  for (const it of items) {
    const al = d.planning.filter(b => b.item === it.id && b.vast).reduce((s, b) => s + (new Date(b.eind) - new Date(b.start)) / MIN, 0);
    let fac = 1;
    if (inst.kalibratie) {
      factorCache[it.overzicht] ??= kalibratie(it.overzicht).factor;
      fac = Math.min(2, Math.max(0.8, factorCache[it.overzicht]));
    }
    let rest = Math.round(((it.schatting || 30) * fac - (it.werkelijk || 0) - al) / 5) * 5;
    if (rest < inst.blokMin) rest = it.schatting ? Math.max(0, rest) : 30;
    if (rest <= 0) continue;

    const ov = overzicht(it.overzicht);
    const deadline = harde(it);
    let laatsteBlok = null;

    for (let dag = new Date(start.getFullYear(), start.getMonth(), start.getDate()); dag < eind && rest > 0; dag.setDate(dag.getDate() + 1)) {
      // Vulgraad: laat per dag ruimte voor het onverwachte (bv. max 70% van de werktijd inplannen)
      const sleutel = dagStr(dag) + "|" + it.overzicht;
      if (ruimte[sleutel] == null) {
        const totaal = vensters(ov, dag).reduce((s, [a, b]) => s + b - a, 0);
        const al = d.planning.filter(b => b.overzicht === it.overzicht && dagStr(new Date(b.start)) === dagStr(dag))
                             .reduce((s, b) => s + (new Date(b.eind) - new Date(b.start)) / MIN, 0);
        ruimte[sleutel] = totaal * (inst.vulgraad ?? 100) / 100 - al;
      }
      for (const [van, tot] of vensters(ov, dag)) {
        if (ruimte[sleutel] < Math.min(inst.blokMin, rest)) break;
        let cursor = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate(), 0, van);   // DST-veilig
        const vensterEind = new Date(dag.getFullYear(), dag.getMonth(), dag.getDate(), 0, tot);
        if (cursor < start) cursor = start;
        while (rest > 0 && cursor < vensterEind) {
          // eerstvolgende botsing
          const botsing = bezet.filter(([a, b]) => b > cursor && a < vensterEind).sort((x, y) => x[0] - y[0])[0];
          if (botsing && botsing[0] <= cursor) { cursor = rondOp(new Date(botsing[1].getTime() + inst.buffer * MIN), 5); continue; }
          const grens = botsing ? new Date(botsing[0].getTime() - inst.buffer * MIN) : vensterEind;
          const vrij = (grens - cursor) / MIN;
          if (vrij < Math.min(inst.blokMin, rest)) { if (!botsing) break; cursor = rondOp(new Date(botsing[1].getTime() + inst.buffer * MIN), 5); continue; }
          const duur = Math.min(rest, inst.blokMax, Math.floor(vrij / 5) * 5, Math.floor(ruimte[sleutel] / 5) * 5);
          if (duur < Math.min(inst.blokMin, rest)) break;
          const b = { id: uid(), item: it.id, type: it.type, overzicht: it.overzicht, titel: it.titel,
                      start: cursor.toISOString(), eind: new Date(cursor.getTime() + duur * MIN).toISOString(), vast: false };
          d.planning.push(b); bezet.push([new Date(b.start), new Date(b.eind)]);
          rest -= duur; ruimte[sleutel] -= duur; blokken++; laatsteBlok = b;
          cursor = new Date(cursor.getTime() + (duur + inst.buffer) * MIN);
        }
        if (rest <= 0) break;
      }
    }
    if (rest > 0) waarschuwingen.push(`„${it.titel}”: nog ${rest} min die niet binnen ${inst.horizon} dagen past.`);
    else if (deadline && laatsteBlok && dagStr(new Date(laatsteBlok.eind)) > deadline)
      waarschuwingen.push(`„${it.titel}”: past pas na de deadline (${deadline}).`);
  }
  return { blokken, waarschuwingen };
}

// ---------- links naar agenda's ----------
const icsTijd = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function omschrijving(b) {
  const it = opslag.d.taken.find(t => t.id === b.item) || opslag.d.projecten.find(p => p.id === b.item);
  const regels = ["Ingepland door Tijdkompas"];
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
        uit.push({ id: uid(), start: ev.start.toISOString(), eind: ev.eind.toISOString(), titel: ev.titel || "Bezet", bron, herhalend: !!ev.rrule });
      ev = null;
    } else if (ev) {
      const i = regel.indexOf(":"); if (i < 0) continue;
      const [naam, ...params] = regel.slice(0, i).split(";"); const waarde = regel.slice(i + 1);
      if (naam === "DTSTART") ev.start = leesIcsDatum(waarde, params);
      else if (naam === "DTEND") ev.eind = leesIcsDatum(waarde, params);
      else if (naam === "SUMMARY") ev.titel = waarde.replace(/\\([,;\\])/g, "$1").replace(/\\n/g, " ");
      else if (naam === "TRANSP") ev.transp = waarde;
      else if (naam === "RRULE") ev.rrule = waarde;
    }
  }
  return uit;
}
