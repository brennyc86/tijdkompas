// Tijdkompas — afstemming met externe agenda's (ophalen + ingeplande blokken wegschrijven)
import { opslag, bewaar, overzicht, locatie } from "./data.js";
import { verbindingen, VerlopenFout, agendaLijst, haalAfspraken, zetAfspraak, verwijderAfspraak } from "./koppeling.js";
import { omschrijving } from "./plan.js";

const d = () => opslag.d;
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

/** Zet ingeplande blokken in de doelagenda van hun lijst; werkt gewijzigde bij en ruimt vervallen blokken op. */
export async function zetNaarAgendas() {
  const nu = new Date(), verlopen = new Map(), fouten = [];
  let nieuw = 0, bij = 0, weg = 0;
  d().extern ||= {};
  const doel = (b) => overzicht(b.overzicht)?.doelAgenda || null;
  const teZetten = d().planning.filter(b => new Date(b.eind) > nu && doel(b));
  const welkom = new Set(teZetten.map(b => b.id));

  // 0. na opnieuw inplannen hebben blokken nieuwe id's: hergebruik het bestaande agenda-item van dezelfde taak (verschuiven i.p.v. weg + nieuw)
  const wees = Object.entries(d().extern).filter(([id]) => !welkom.has(id));
  for (const b of teZetten.filter(b => !d().extern[b.id])) {
    const i = wees.findIndex(([, x]) => x.item === b.item && x.bron === doel(b) && new Date(x.eind) > nu);
    if (i < 0) continue;
    const [oudId, x] = wees.splice(i, 1)[0];
    d().extern[b.id] = { ...x, start: "", eind: "" };      // lege tijden: wordt hieronder bijgewerkt
    delete d().extern[oudId];
  }
  // 1. vervallen of verplaatste-naar-andere-agenda blokken verwijderen
  for (const [blokId, x] of Object.entries(d().extern)) {
    const b = d().planning.find(p => p.id === blokId);
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
    if (x && x.start === b.start && x.eind === b.eind && x.titel === b.titel) continue;
    try {
      const eventId = await zetAfspraak(v, agendaIdVan(bron), {
        titel: (b.soort === "reis" ? "🚗 " : "") + b.titel, omschrijving: omschrijving(b), start: b.start, eind: b.eind,
        plaats: b.locatie && b.locatie !== "thuis" ? locatie(b.locatie)?.adres || locatie(b.locatie)?.naam : "", tkId: b.id }, x?.eventId);
      d().extern[b.id] = { bron, eventId, item: b.item, start: b.start, eind: b.eind, titel: b.titel };
      x?.eventId === eventId ? bij++ : nieuw++;
    } catch (e) { e instanceof VerlopenFout ? verlopen.set(v.id, v) : fouten.push(e.message); }
  }
  // eigen blokken niet als "bezet" meetellen bij het volgende ophalen
  const eigen = new Set(Object.values(d().extern).map(x => x.eventId));
  d().bezet.forEach(e => { if (eigen.has(e.extId)) e.eigen = true; });
  bewaar();
  return { nieuw, bij, weg, verlopen: [...verlopen.values()], fouten: [...new Set(fouten)] };
}
