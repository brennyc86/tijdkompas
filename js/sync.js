// Tijdkompas — afstemming met externe agenda's (ophalen + ingeplande blokken wegschrijven)
import { opslag, bewaar, overzicht, locatie, sessie } from "./data.js";
import { verbindingen as alleVerbindingen, heeft, VerlopenFout, agendaLijst, haalAfspraken, zetAfspraak, verwijderAfspraak, verplaatsAfspraak } from "./koppeling.js";
import { omschrijving, leesIcs, familieHaak } from "./plan.js";
import { CONFIG } from "./config.js";

// ---------- agenda's via een link (.ics), bv. een gepubliceerde Outlook-agenda: alleen lezen ----------
// Gaat via het doorgeefluik (CONFIG.icsProxy), omdat de browser zo'n link niet zelf mag ophalen.
export const linkBron = (l) => "link:" + l.id;
export async function verversLinks() {
  const fouten = [];
  for (const l of d().agendaLinks || []) {
    try {
      const url = CONFIG.icsProxy ? `${CONFIG.icsProxy.replace(/\/$/, "")}/?url=${encodeURIComponent(l.url)}` : l.url.replace(/^webcals?:\/\//i, "https://");
      const r = await fetch(url, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
      const tekst = await r.text();
      if (!r.ok || !tekst.includes("BEGIN:VCALENDAR")) throw new Error(tekst.slice(0, 120) || "geen agenda (" + r.status + ")");
      const k = linkBron(l), ev = leesIcs(tekst, k);
      d().bezet = d().bezet.filter(e => e.bron !== k).concat(ev);
      d().agendas[k] = { soort: "bezet", lijst: "", ...d().agendas[k], naam: l.naam, kleur: l.kleur || d().agendas[k]?.kleur || "#4f8fd8", link: true };
      l.laatst = new Date().toISOString(); l.fout = ""; l.aantal = ev.length;
    } catch (e) {
      l.fout = CONFIG.icsProxy ? e.message : "Het doorgeefluik is nog niet ingesteld (SETUP.md stap D)";
      fouten.push(`${l.naam}: ${l.fout}`);
    }
  }
  bewaar();
  return fouten;
}

const d = () => opslag.d;
const verbindingen = () => alleVerbindingen().filter(v => heeft(v, "agenda"));
// Korte vingerafdruk van een titel: zo hoeft de titel zelf niet in de cloud te staan om wijzigingen te herkennen
export function vingerafdruk(s) { let h = 5381; for (const c of String(s ?? "")) h = (h * 33 + c.codePointAt(0)) >>> 0; return h.toString(36); }
export const agendaSleutel = (v, cal) => `${v.id}|${cal}`;
const verbindingVan = (sleutel) => verbindingen().find(v => sleutel.startsWith(v.id + "|"));
const agendaIdVan = (sleutel) => sleutel.slice(sleutel.indexOf("|") + 1);

/** Haalt van alle gekoppelde accounts de agenda's en afspraken op. Verlopen sessies worden teruggegeven. */
export async function verversAgendas() {
  const verlopen = [], fouten = [];
  const van = new Date(Date.now() - 864e5), tot = new Date(Date.now() + (d().instellingen.horizon + 7) * 864e5);
  const eigenIds = new Set(Object.values(d().extern || {}).map(x => x.eventId));
  for (const v of verbindingen()) {
    try {
      const lijst = await agendaLijst(v);
      for (const c of lijst) {
        const k = agendaSleutel(v, c.id), oud = d().agendas[k];
        d().agendas[k] = { soort: c.info ? "negeer" : "bezet", lijst: "", ...oud, naam: c.naam, kleur: c.kleur, schrijf: c.schrijf, primair: c.primair, account: v.email, accountSoort: v.soort };
      }
      // agenda's die niet meer bestaan opruimen
      for (const k of Object.keys(d().agendas)) if (k.startsWith(v.id + "|") && !lijst.some(c => agendaSleutel(v, c.id) === k)) delete d().agendas[k];
      for (const c of lijst) {
        const k = agendaSleutel(v, c.id);
        d().bezet = d().bezet.filter(e => e.bron !== k);
        if (d().agendas[k].soort === "negeer") continue;
        const ev = await haalAfspraken(v, c.id, van, tot);
        d().bezet.push(...ev.map(e => ({ id: k + "#" + e.extId, ...e, bron: k, eigen: e.eigen || eigenIds.has(e.extId) })));
      }
    } catch (e) {
      if (e instanceof VerlopenFout) verlopen.push(v); else fouten.push(`${v.email}: ${e.message}`);
    }
  }
  d().agendaSync = new Date().toISOString();
  bewaar();
  return { verlopen, fouten };
}

/** Kan Tijdkompas deze afspraak in Google/Outlook aanpassen? (agenda waarin je mag schrijven, hier gekoppeld, met een id) */
export const kanVerplaatsen = (ev) => !!(ev?.extId && d().agendas?.[ev.bron]?.schrijf && verbindingVan(ev.bron));
/** Een afspraak uit je agenda naar een ander moment zetten — in Google/Outlook zelf, en hier meteen */
export async function verplaatsAgendaAfspraak(ev, start, eind) {
  const v = verbindingVan(ev.bron); if (!v || !ev.extId) throw new Error("Deze agenda kan Tijdkompas niet aanpassen");
  await verplaatsAfspraak(v, agendaIdVan(ev.bron), ev.extId, start, eind);
  const x = d().bezet.find(e => e.id === ev.id); if (x) { x.start = start; x.eind = eind; }
  bewaar();
}

// ---------- in welke agenda komt een ingepland blok? ----------
// 1. wat je bij het inplannen zelf koos (b.agenda; "geen" = in geen enkele agenda)
// 2. de standaard (Instellingen → Agenda's & accounts):
//    taak  — de agenda van het account waar de taak in staat (Google Taken → die Google Agenda, To Do → die Outlook-agenda);
//            staat de taak niet in een gekoppelde takenlijst, dan de agenda die bij de lijst is ingesteld
//    lijst — de agenda die bij de lijst is ingesteld
//    vast  — altijd dezelfde agenda
export const AGENDA_STANDAARD = {
  taak:  "In de agenda van het account waar de taak in staat",
  lijst: "In de agenda die bij de lijst is ingesteld",
  vast:  "Altijd in dezelfde agenda",
};
const schrijfbaar = (k) => !!k && !!d().agendas?.[k]?.schrijf;
/** Hoofdagenda (waar je in kunt schrijven) van het account van een takenlijst, bijv. "google:jij@gmail.com|lijstId" */
function agendaVanTakenlijst(k) {
  const acc = String(k || "").split("|")[0]; if (!acc) return null;
  const al = Object.entries(d().agendas || {}).filter(([key, a]) => key.startsWith(acc + "|") && a.schrijf);
  return (al.find(([, a]) => a.primair) || al[0])?.[0] || null;
}
/** Hoofdagenda (schrijfbaar) van een account, op e-mailadres — als dat account op dit apparaat gekoppeld is */
function agendaVanAccount(email) {
  const m = String(email || "").toLowerCase(); if (!m) return null;
  const al = Object.entries(d().agendas || {}).filter(([, a]) => a.schrijf && String(a.account || "").toLowerCase() === m);
  return (al.find(([, a]) => a.primair) || al[0])?.[0] || null;
}
/** Hoofdagenda van het account waarmee je nu bent ingelogd (als dat op dit apparaat gekoppeld is) */
export function eigenAgenda() {
  const m = String(sessie.email || "").toLowerCase(); if (!m) return null;
  const al = Object.entries(d().agendas || {}).filter(([, a]) => a.schrijf && String(a.account || "").toLowerCase() === m);
  return (al.find(([, a]) => a.primair) || al[0])?.[0] || null;
}
/** De standaardagenda voor een blok (zonder eigen keuze) */
export function standaardAgenda(b) {
  const inst = d().instellingen || {}, ruw = overzicht(b.overzicht)?.doelAgenda || null;
  if (inst.agendaDoel === "vast") return schrijfbaar(inst.vasteAgenda) ? inst.vasteAgenda : null;
  if (ruw === "geen") return null;                                // bij de lijst uitdrukkelijk: niet in een agenda
  const lijstAgenda = ruw && d().agendas?.[ruw] ? ruw : null;
  if (inst.agendaDoel === "lijst") return lijstAgenda;
  const it = d().taken.find(t => t.id === b.item) || d().projecten.find(p => p.id === b.item);
  const k = it?.ext?.bron || Object.entries(d().takenlijsten || {}).find(([, x]) => x.lijst === b.overzicht)?.[0];
  // lijst van een gelinkt account (zelfde persoon, andere rol): de agenda die dát account voor de lijst gebruikt,
  // anders de hoofdagenda van dat account — als die hier gekoppeld is. Is hij hier niet gekoppeld, dan zet dat account
  // het blok zelf in zijn agenda (zie voorMij), en dus níet in de agenda van het account waarmee je nu bent ingelogd.
  const eig = familieHaak.eigenaar(overzicht(b.overzicht));
  const vanEigenaar = eig ? ((eig.agenda && eig.agenda !== "geen" && schrijfbaar(eig.agenda) ? eig.agenda : null) || agendaVanAccount(eig.email)) : null;
  if (eig) return (k && agendaVanTakenlijst(k)) || vanEigenaar || null;
  // waar de taak staat → de agenda van de lijst → die van het account waarmee je bent ingelogd
  return (k && agendaVanTakenlijst(k)) || lijstAgenda || eigenAgenda();
}
/** Wordt dit blok door het gelinkte account van de lijst in diens agenda gezet? Dan dat account ({email}), anders null */
export function viaEigenaar(b) {
  if (b.agenda) return null;
  const eig = familieHaak.eigenaar(overzicht(b.overzicht));
  return eig && !standaardAgenda(b) ? eig : null;
}
/** In welke agenda dit blok komt (null = in geen enkele) */
export function doelAgendaVan(b) {
  if (b.agenda === "geen") return null;
  if (b.agenda && d().agendas?.[b.agenda]) return b.agenda;
  return standaardAgenda(b);
}
export const agendaNaam = (k) => { const a = d().agendas?.[k]; return a ? `${a.accountSoort === "ms" ? "Outlook" : "Google"} · ${a.account || ""} · ${a.naam}` : ""; };

/** Zet ingeplande blokken in hun agenda (zie doelAgendaVan); werkt gewijzigde bij en ruimt vervallen blokken op. */
export async function zetNaarAgendas({ alleen = null } = {}) {   // alleen: Set met blok-id's (bijv. net zelf ingepland)
  const nu = new Date(), verlopen = new Map(), fouten = [];
  const hoort = (id) => !alleen || alleen.has(id);
  let nieuw = 0, bij = 0, weg = 0;
  d().extern ||= {};
  const doel = (b) => doelAgendaVan(b);
  const fam = familieHaak.voorMij() || { blokken: [], klaar: false };
  const alle = [...d().planning, ...fam.blokken];
  const teZetten = alle.filter(b => new Date(b.eind) > nu && doel(b) && hoort(b.id));
  const welkom = new Set(teZetten.map(b => b.id));

  // 0. na opnieuw inplannen hebben blokken nieuwe id's: hergebruik het bestaande agenda-item van dezelfde taak (verschuiven i.p.v. weg + nieuw)
  const wees = alleen ? [] : Object.entries(d().extern).filter(([id]) => !welkom.has(id));
  for (const b of teZetten.filter(b => !d().extern[b.id])) {
    const i = wees.findIndex(([, x]) => x.item === b.item && x.bron === doel(b) && new Date(x.eind) > nu);
    if (i < 0) continue;
    const [oudId, x] = wees.splice(i, 1)[0];
    d().extern[b.id] = { ...x, start: "", eind: "" };      // lege tijden: wordt hieronder bijgewerkt
    delete d().extern[oudId];
  }
  // 1. vervallen of verplaatste-naar-andere-agenda blokken verwijderen
  for (const [blokId, x] of Object.entries(d().extern)) {
    if (!hoort(blokId)) continue;
    if (x.fam && !fam.klaar) continue;                    // planning van gelinkte accounts nog niet (helemaal) binnen: niets weghalen
    const b = alle.find(p => p.id === blokId);
    if (b && welkom.has(blokId) && doel(b) === x.bron) continue;
    if (new Date(x.eind) <= nu && !b) { delete d().extern[blokId]; continue; }   // verleden: laten staan
    const v = verbindingVan(x.bron); if (!v) continue;
    try { await verwijderAfspraak(v, agendaIdVan(x.bron), x.eventId); delete d().extern[blokId]; weg++; }
    catch (e) { e instanceof VerlopenFout ? verlopen.set(v.id, v) : fouten.push(e.message); }
  }
  // 2. nieuwe en gewijzigde blokken
  for (const b of teZetten) {
    const bron = doel(b), v = verbindingVan(bron);
    if (!v) { fouten.push(`Doelagenda van „${overzicht(b.overzicht)?.naam}” hoort bij een account dat hier niet gekoppeld is`); continue; }
    if (verlopen.has(v.id)) continue;
    const x = d().extern[b.id];
    if (x && x.start === b.start && x.eind === b.eind && (x.th ? x.th === vingerafdruk(b.titel) : x.titel === b.titel)) continue;
    try {
      const eventId = await zetAfspraak(v, agendaIdVan(bron), {
        titel: (b.soort === "reis" ? "🚗 " : "") + b.titel, omschrijving: omschrijving(b), start: b.start, eind: b.eind,
        plaats: b.locatie && b.locatie !== "thuis" ? locatie(b.locatie)?.adres || locatie(b.locatie)?.naam : "", tkId: b.id }, x?.eventId);
      d().extern[b.id] = { bron, eventId, item: b.item, start: b.start, eind: b.eind, th: vingerafdruk(b.titel), ...(b.vanFamilie ? { fam: true } : {}) };
      x?.eventId === eventId ? bij++ : nieuw++;
    } catch (e) { e instanceof VerlopenFout ? verlopen.set(v.id, v) : fouten.push(e.message); }
  }
  // eigen blokken niet als "bezet" meetellen bij het volgende ophalen
  const eigen = new Set(Object.values(d().extern).map(x => x.eventId));
  d().bezet.forEach(e => { if (eigen.has(e.extId)) e.eigen = true; });
  bewaar();
  return { nieuw, bij, weg, verlopen: [...verlopen.values()], fouten: [...new Set(fouten)] };
}
