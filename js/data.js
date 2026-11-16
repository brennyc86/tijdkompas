// Tijdkompas — datamodel en opslag
// Altijd lokaal in localStorage; met een Google-login wordt dezelfde blob ook in je eigen
// Google Drive (verborgen app-map) bewaard, zodat al je apparaten dezelfde planning zien.

const SLEUTEL = "tijdkompas_v1";

// Wie is er ingelogd (Firebase-uid), of null in lokale modus.
// ik = het Tijdkompas (hoofdaccount) waarvan je de gegevens ziet; familie = alle inlogs die daarbij horen
// (bijv. je privé-, werk- en hobby-account), zodat taken van elk van die inlogs als "van mij" tellen.
export const sessie = { ik: null, familie: [] };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const KWADRANTEN = {
  doen:      { naam: "Doen",       sub: "Urgent · Belangrijk",          urgent: true,  belangrijk: true  },
  plannen:   { naam: "Plannen",    sub: "Niet urgent · Belangrijk",     urgent: false, belangrijk: true  },
  delegeren: { naam: "Delegeren",  sub: "Urgent · Niet belangrijk",     urgent: true,  belangrijk: false },
  schrappen: { naam: "Schrappen",  sub: "Niet urgent · Niet belangrijk", urgent: false, belangrijk: false },
};

export function kwadrant(item) {
  if (item.urgent && item.belangrijk) return "doen";
  if (item.belangrijk) return "plannen";
  if (item.urgent) return "delegeren";
  return "schrappen";
}

const STANDAARD_INST = {
  blokMax: 90,          // langste aaneengesloten blok (min)
  blokMin: 15,          // kortste blok (min)
  buffer: 10,           // pauze tussen blokken (min)
  vulgraad: 70,         // max % van de beschikbare tijd per dag inplannen (ruimte voor onverwacht)
  horizon: 14,          // dagen vooruit inplannen
  kalibratie: true,     // schattingen corrigeren met je eigen historie
  schrappenInplannen: false,
};

function leeg() {
  return { versie: 2, mappen: [], koers: [], overzichten: [], projecten: [], taken: [], bezet: [], planning: [],
           locaties: basisLocaties(), beschikbaar: basisBeschikbaar(), agendas: {}, extern: {}, takenlijsten: {},
           instellingen: { ...STANDAARD_INST }, demo: false, gewijzigd: new Date().toISOString() };
}

// Locaties: reistijd = enkele reis vanaf huis, in minuten
function basisLocaties() {
  return [
    { id: "thuis",   naam: "Thuis",   icoon: "🏠", reistijd: 0 },
    { id: "kantoor", naam: "Kantoor", icoon: "🏢", reistijd: 30 },
  ];
}
// Wanneer ben je überhaupt beschikbaar (wakker, niet slapen/eten)? Vrije-tijd-lijsten plannen hierbinnen.
function basisBeschikbaar() {
  return [{ dagen: [1, 2, 3, 4, 5], van: "07:00", tot: "22:30" }, { dagen: [6, 0], van: "08:30", tot: "22:30" }];
}

// Oudere opslag bijwerken naar het huidige model
function normaliseer(d) {
  const n = { ...leeg(), ...d };
  n.instellingen = { ...STANDAARD_INST, ...(d.instellingen || {}) };
  for (const k of ["overzichten", "projecten", "taken", "bezet", "planning"]) n[k] ||= [];
  if (!Array.isArray(d.locaties) || !d.locaties.length) n.locaties = basisLocaties();
  if (!n.locaties.some(l => l.id === "thuis")) n.locaties.unshift({ id: "thuis", naam: "Thuis", icoon: "🏠", reistijd: 0 });
  if (!Array.isArray(d.beschikbaar) || !d.beschikbaar.length) n.beschikbaar = basisBeschikbaar();
  n.agendas ||= {}; n.extern ||= {}; n.takenlijsten ||= {}; n.agendaLinks ||= [];
  for (const o of n.overzichten) {
    o.modus ||= (o.id === "werk" || /werk|kantoor|baan/i.test(o.naam)) ? "vast" : "vrij";
    o.locatie ??= "";
    o.tijden ||= [];
    o.doelAgenda ??= null;
    o.mensen ||= [];                     // mensen zonder Tijdkompas aan wie je taken kunt toewijzen (alleen namen)
    if (o.verdeling !== "verdelen") o.verdeling = "samen";   // samen: alles wordt bij iedereen ingepland · verdelen: pas als het aan jou is toegewezen
  }
  // Mappen: een boom waarin lijsten staan (een lijst bevat nooit een lijst)
  n.mappen = Array.isArray(d.mappen) ? d.mappen : [];
  n.koers = Array.isArray(d.koers) ? d.koers : [];
  // v5 had "lijst onder lijst" (ouder): die groep wordt een map met dezelfde naam, met de lijst zelf erin
  for (const o of n.overzichten) {
    if (!o.ouder) continue;
    const g = n.overzichten.find(x => x.id === o.ouder);
    if (g) {
      const mid = "m_" + g.id;
      if (!n.mappen.some(m => m.id === mid)) n.mappen.push({ id: mid, naam: g.naam, icoon: "📁", kleur: g.kleur, ouder: g.map || "" });
      g.map = mid; o.map = mid;
    }
  }
  for (const o of n.overzichten) delete o.ouder;
  const mapIds = new Set(n.mappen.map(m => m.id));
  for (const m of n.mappen) {
    m.ouder ||= ""; m.icoon ||= "📁"; m.kleur ||= "#8a978e";
    if (!mapIds.has(m.ouder)) m.ouder = "";
  }
  for (const m of n.mappen) {                          // kringen breken (map in zijn eigen submap)
    const gezien = new Set([m.id]); let x = n.mappen.find(y => y.id === m.ouder);
    while (x) { if (gezien.has(x.id)) { m.ouder = ""; break; } gezien.add(x.id); x = n.mappen.find(y => y.id === x.ouder); }
  }
  for (const o of n.overzichten) if (!mapIds.has(o.map)) o.map = "";
  for (const a of n.koers) { a.taken ||= []; a.nee ||= []; a.doel ||= { soort: "", id: "" }; a.status ||= "loopt";
    if (a.doel.soort === "map" && !mapIds.has(a.doel.id) || a.doel.soort === "lijst" && !n.overzichten.some(o => o.id === a.doel.id)) a.doel = { soort: "", id: "" }; }
  for (const t of n.taken) {
    if (!Array.isArray(t.wie)) t.wie = t.toegewezen ? [t.toegewezen] : ["ik"];   // wie doet het (leeg = de hele groep)
    delete t.toegewezen;
    if (!Array.isArray(t.wachtOp)) t.wachtOp = [];
  }
  delete n.accounts;
  n.versie = 2;
  return n;
}

let data = laad();
const luisteraars = new Set();

function laad() {
  try {
    const ruw = localStorage.getItem(SLEUTEL);
    if (ruw) {
      const d = JSON.parse(ruw);
      if (d.demo && (d.versie || 1) < 2) return demoData();   // oude voorbeelddata: vervangen door nieuwe
      return normaliseer(d);
    }
  } catch (e) { /* privévenster of beschadigd: begin met demo */ }
  return demoData();
}

export function bewaar({ stil = false } = {}) {
  if (!stil) data.gewijzigd = new Date().toISOString();
  try { localStorage.setItem(SLEUTEL, JSON.stringify(data)); } catch (e) {}
  luisteraars.forEach(f => f({ stil }));
}

export const opslag = {
  get d() { return data; },
  luister(f) { luisteraars.add(f); },
  vervang(nieuw, opties) { data = normaliseer(nieuw); bewaar(opties); },
  wis() { const ik = sessie.ik; const oud = data; data = leeg(); data.overzichten = [];
          if (ik) { // gedeelde lijsten en mappen van anderen blijven gewoon staan
            data.koppelingen = [];   // ook de koppelingen weg, voor al je inlogs en apparaten
            const anders = oud.overzichten.filter(o => o.eigenaar && !isIk(o.eigenaar)), ids = new Set(anders.map(o => o.id));
            data.overzichten.push(...anders);
            data.mappen = (oud.mappen || []).filter(m => m.eigenaar && !isIk(m.eigenaar));
            data.taken = oud.taken.filter(t => ids.has(t.overzicht)); data.projecten = oud.projecten.filter(p => ids.has(p.overzicht));
          }
          bewaar(); },
  demo() { data = demoData(); bewaar(); },
};

// ---------- opvragen ----------
export const overzicht = id => data.overzichten.find(o => o.id === id);
export const locatie = id => data.locaties.find(l => l.id === id);
// Waar vindt dit plaats? taak → project → lijst ("" = geen vaste plek)
export function effectieveLocatie(item) {
  if (item.locatie) return item.locatie;
  const p = item.project ? data.projecten.find(x => x.id === item.project) : null;
  if (p?.locatie) return p.locatie;
  return overzicht(item.overzicht)?.locatie || "";
}
export const project = id => data.projecten.find(p => p.id === id);
export const taak = id => data.taken.find(t => t.id === id);
export const takenVan = pid => data.taken.filter(t => t.project === pid);

export function projectVoortgang(p) {
  const tk = takenVan(p.id);
  const klaar = tk.filter(t => t.status === "klaar").length;
  const schatTaken = tk.reduce((s, t) => s + (t.schatting || 0), 0);
  const werkelijk = tk.reduce((s, t) => s + (t.werkelijk || 0), 0) + (p.werkelijk || 0);
  return { totaal: tk.length, klaar, schatTaken, werkelijk, pct: tk.length ? Math.round(klaar / tk.length * 100) : (p.status === "klaar" ? 100 : 0) };
}

// ---------- wijzigen ----------
function basis() { return { id: uid(), titel: "", notitie: "", urgent: false, belangrijk: true, deadline: "", streef: "",
                       schatting: 0, werkelijk: 0, status: "open", links: [], gedeeldMet: [], gemaakt: new Date().toISOString() }; }

// Nieuw begin: zonder lijsten — je maakt ze zelf (of ze ontstaan door een takenlijst te koppelen)
export function startData() { return leeg(); }

export function nieuweTaak(v = {}) {
  const t = { ...basis(), project: null, overzicht: data.overzichten[0]?.id, wie: [mijnId()], wachtOp: [], ...v, type: "taak" };
  if (t.project && !v.overzicht) t.overzicht = project(t.project)?.overzicht || t.overzicht;
  data.taken.push(t); bewaar(); return t;
}
export function nieuwProject(v = {}) {
  const p = { ...basis(), overzicht: data.overzichten[0]?.id, ...v, type: "project" };
  data.projecten.push(p); bewaar(); return p;
}
export function werkBij(item, v) { Object.assign(item, v); bewaar(); }

export function verwijder(item) {
  data.koers.forEach(a => { a.taken = a.taken.filter(x => x !== item.id); });
  data.taken.forEach(t => { if (t.wachtOp?.includes(item.id)) t.wachtOp = t.wachtOp.filter(x => x !== item.id); });
  if (item.type === "project") {
    data.taken.forEach(t => { if (t.project === item.id) t.project = null; }); // taken blijven los bestaan
    data.projecten = data.projecten.filter(p => p !== item);
    data.planning = data.planning.filter(b => b.item !== item.id);
  } else {
    data.taken = data.taken.filter(t => t !== item);
    data.planning = data.planning.filter(b => b.item !== item.id);
  }
  bewaar();
}

export function koppel(t, pid) {
  t.project = pid || null;
  if (pid) t.overzicht = project(pid).overzicht;
  bewaar();
}

export function rondAf(item, minuten, op = new Date()) {
  item.status = "klaar"; item.klaarOp = new Date(op).toISOString(); item.klaarDoor = mijnId();
  if (minuten != null) item.werkelijk = minuten;
  delete item.gepland;
  data.planning = data.planning.filter(b => !(b.item === item.id && new Date(b.start) > new Date()));
  bewaar();
}
export function heropen(item) { item.status = "open"; delete item.klaarOp; delete item.klaarDoor; bewaar(); }

// ---------- mappen ----------
export const map = id => data.mappen.find(m => m.id === id);
export const submappen = (id = "") => data.mappen.filter(m => (m.ouder || "") === id);
export const lijstenIn = (id = "") => data.overzichten.filter(o => (o.map || "") === id);
/** Alle lijst-id's in deze map en alle mappen daaronder */
export function lijstenOnder(id) {
  const uit = lijstenIn(id).map(o => o.id);
  for (const m of submappen(id)) uit.push(...lijstenOnder(m.id));
  return uit;
}
export function mappenOnder(id) { return submappen(id).flatMap(m => [m.id, ...mappenOnder(m.id)]); }
/** Pad van de hoofdmap tot en met deze map */
export function mapPad(id) { const uit = []; let m = map(id); while (m && uit.length < 50) { uit.unshift(m); m = map(m.ouder); } return uit; }
export const diepteVan = (mapId) => mapPad(mapId).length;
/** Boom plat gemaakt: [{soort: "map"|"lijst", x, diepte}] — eerst mappen, dan lijsten */
export function boom(id = "", diepte = 0) {
  const uit = [];
  for (const m of submappen(id)) uit.push({ soort: "map", x: m, diepte }, ...boom(m.id, diepte + 1));
  for (const o of lijstenIn(id)) uit.push({ soort: "lijst", x: o, diepte });
  return uit;
}
/** Lijsten in boomvolgorde */
export const lijstVolgorde = () => boom().filter(r => r.soort === "lijst").map(r => r.x);
/** Lijst-id's voor een sleutel uit de lijstkeuze: "m:<map>" of een lijst-id */
export const idsVan = (sleutel) => sleutel.startsWith("m:") ? lijstenOnder(sleutel.slice(2)) : [sleutel];

// ---------- wie doet wat ----------
// Persoon-id's: Firebase-uid (lid van een gedeelde lijst), "ik" (zonder inloggen) of "~Naam" (iemand zonder Tijdkompas)
export const mijnId = () => sessie.ik || "ik";
export const isIk = id => id === "ik" || (!!sessie.ik && id === sessie.ik) || (!!id && (sessie.familie || []).includes(id));
/** Leden van een lijst of map behalve jij (en je eigen andere inlogs) */
export const anderen = x => (x?.leden || []).filter(u => !isIk(u));
export function personen(o) {
  if (!o) return [{ id: mijnId(), naam: "Ik", ik: true }];
  const uit = [{ id: mijnId(), naam: "Ik", ik: true }];
  for (const u of o.leden || []) if (!isIk(u)) uit.push({ id: u, naam: o.ledenInfo?.[u]?.naam || o.ledenInfo?.[u]?.email || "Lid", lid: true });
  for (const n of o.mensen || []) uit.push({ id: "~" + n, naam: n });
  return uit;
}
export function naamVanPersoon(id, o) {
  if (isIk(id)) return "ik";
  if (id?.startsWith("~")) return id.slice(1);
  for (const x of o ? [o] : data.overzichten) { const l = x.ledenInfo?.[id]; if (l) return l.naam || l.email; }
  return "iemand";
}
const wieVan = t => Array.isArray(t.wie) ? t.wie : (t.toegewezen ? [t.toegewezen] : [mijnId()]);
/** Is dit (ook) mijn taak? Een lijst zonder anderen is altijd van jou. */
// Samen: alles wat niet uitdrukkelijk van een ander is. Verdelen: alleen wat (ook) aan jou is toegewezen.
export function isMijn(t) {
  if (t.type === "project") return true;
  const w = wieVan(t);
  if (w.some(isIk)) return true;
  return !w.length && overzicht(t.overzicht)?.verdeling !== "verdelen";
}
export const isTeam = t => t.type !== "project" && !wieVan(t).length;
export const wie = wieVan;

// ---------- afhankelijkheden: taak A wacht op taak B ----------
/** De open taken waar deze taak nog op wacht */
export const wachtNogOp = t => (t.wachtOp || []).map(taak).filter(x => x && x.status !== "klaar");
/** Open taken die op deze taak wachten */
export const wachtenOp = t => data.taken.filter(x => x.status !== "klaar" && (x.wachtOp || []).includes(t.id));
/** Zou "a wacht op b" een kringetje maken? */
export function maaktKring(a, b) {
  const gezien = new Set(), stapel = [b];
  while (stapel.length) {
    const x = stapel.pop(); if (x === a) return true;
    if (gezien.has(x)) continue; gezien.add(x);
    stapel.push(...(taak(x)?.wachtOp || []));
  }
  return false;
}

// ---------- links (mail e.d.) ----------
export function linkInfo(url) {
  let h = "";
  try { h = new URL(url).hostname; } catch { return { soort: "link", label: url, icoon: "🔗" }; }
  if (h === "mail.google.com") return { soort: "gmail", label: "Gmail", icoon: "✉️" };
  if (/outlook\.(office|office365|live)\.com$/.test(h) || h === "outlook.cloud.microsoft") return { soort: "outlook", label: "Outlook", icoon: "📧" };
  if (h === "docs.google.com" || h === "drive.google.com") return { soort: "drive", label: "Google Drive", icoon: "📄" };
  if (h.endsWith("sharepoint.com") || h.endsWith("onedrive.live.com")) return { soort: "ms", label: "SharePoint/OneDrive", icoon: "📄" };
  if (h === "github.com") return { soort: "github", label: "GitHub", icoon: "🐙" };
  return { soort: "link", label: h.replace(/^www\./, ""), icoon: "🔗" };
}

// ---------- kalibratie: hoe goed schat je? ----------
export function kalibratie(overzichtId) {
  const af = data.taken.filter(t => t.status === "klaar" && t.schatting > 0 && t.werkelijk > 0 && (!overzichtId || t.overzicht === overzichtId));
  if (af.length < 3) return { factor: 1, n: af.length };
  const s = af.reduce((a, t) => a + t.schatting, 0), w = af.reduce((a, t) => a + t.werkelijk, 0);
  return { factor: w / s, n: af.length };
}

// ---------- demo ----------
function basisOverzichten() {
  return [
    { id: "werk", naam: "Werk", kleur: "#d8a24e", icoon: "💼", modus: "vast", locatie: "kantoor", doelAgenda: null, tijden: [
        { dagen: [1, 2, 4], van: "09:00", tot: "17:00", locatie: "kantoor" },
        { dagen: [3, 5], van: "08:30", tot: "16:30", locatie: "thuis" } ] },
    { id: "prive", naam: "Privé", kleur: "#6fb38a", icoon: "🏠", modus: "vrij", locatie: "thuis", doelAgenda: null, tijden: [] },
  ];
}

function dagPlus(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

function demoData() {
  const d = leeg(); d.demo = true; d.overzichten = basisOverzichten();
  d.locaties.push({ id: "haven", naam: "Jachthaven", icoon: "⚓", reistijd: 25 }, { id: "club", naam: "Clubhuis", icoon: "🏛️", reistijd: 15 });
  d.overzichten.push(
    { id: "boot", naam: "Boot", kleur: "#6f9fd8", icoon: "⛵", modus: "vrij", locatie: "haven", doelAgenda: null, tijden: [] },
    { id: "club", naam: "Zeilvereniging", kleur: "#c48ed8", icoon: "🏛️", modus: "vast", locatie: "club", doelAgenda: null,
      tijden: [{ dagen: [3], van: "19:30", tot: "22:00", locatie: "club" }] });
  const P = (v) => { const p = { ...basis(), type: "project", locatie: "", ...v }; d.projecten.push(p); return p; };
  const T = (v) => { const t = { ...basis(), type: "taak", project: null, locatie: "", ...v }; d.taken.push(t); return t; };

  const pres = P({ overzicht: "werk", titel: "Presentatie boordcomputer", urgent: true, belangrijk: true, deadline: dagPlus(6), streef: dagPlus(4), schatting: 480,
                   notitie: "Demo voor klant, inclusief testopstelling.", links: [{ url: "https://mail.google.com/mail/u/0/#inbox", label: "Uitnodiging klant" }] });
  d.overzichten[0].mensen = ["Sanne"];
  const slides = T({ overzicht: "werk", project: pres.id, titel: "Slides opzetten", urgent: true, belangrijk: true, schatting: 120, deadline: dagPlus(4) });
  const opst = T({ overzicht: "werk", project: pres.id, titel: "Testopstelling controleren", urgent: true, belangrijk: true, schatting: 90, deadline: dagPlus(5), locatie: "kantoor", wie: ["~Sanne"] });
  T({ overzicht: "werk", project: pres.id, titel: "Generale repetitie", urgent: false, belangrijk: true, schatting: 60, streef: dagPlus(5), wie: ["ik", "~Sanne"], wachtOp: [slides.id, opst.id] });
  T({ overzicht: "werk", project: pres.id, titel: "Offerte-concept", urgent: false, belangrijk: true, schatting: 45, werkelijk: 70, status: "klaar", klaarOp: new Date().toISOString() });

  const site = P({ overzicht: "werk", titel: "Website vernieuwen", urgent: false, belangrijk: true, streef: dagPlus(30), schatting: 900 });
  T({ overzicht: "werk", project: site.id, titel: "Teksten NL/EN nalopen", schatting: 120, belangrijk: true });
  T({ overzicht: "werk", project: site.id, titel: "Portfolio-foto's kiezen", schatting: 60, belangrijk: true, werkelijk: 50, status: "klaar" });

  T({ overzicht: "werk", titel: "Reageren op leveranciersmail", urgent: true, belangrijk: false, schatting: 15,
      links: [{ url: "https://outlook.office.com/mail/inbox", label: "Mail leverancier" }] });
  T({ overzicht: "werk", titel: "Reiskosten declareren", urgent: true, belangrijk: false, schatting: 20, deadline: dagPlus(2) });
  T({ overzicht: "werk", titel: "Tijdschrijven bijwerken", schatting: 15, werkelijk: 25, status: "klaar", urgent: true, belangrijk: false });

  const boot = P({ overzicht: "boot", titel: "Boot winterklaar", urgent: false, belangrijk: true, deadline: dagPlus(20), schatting: 600 });
  T({ overzicht: "boot", project: boot.id, titel: "Motor conserveren", schatting: 180, belangrijk: true });
  T({ overzicht: "boot", project: boot.id, titel: "Zeilen naar zeilmaker", schatting: 90, belangrijk: true, urgent: true, deadline: dagPlus(8) });
  T({ overzicht: "boot", project: boot.id, titel: "Winterzeil bestellen", schatting: 30, werkelijk: 30, status: "klaar", belangrijk: true, locatie: "thuis" });

  T({ overzicht: "club", titel: "Wedstrijdkalender bespreken", schatting: 60, belangrijk: true, deadline: dagPlus(9) });

  T({ overzicht: "prive", titel: "Verzekering vergelijken", schatting: 60, belangrijk: true, streef: dagPlus(10) });
  T({ overzicht: "prive", titel: "Verjaardagscadeau regelen", schatting: 30, urgent: true, belangrijk: true, deadline: dagPlus(3) });
  T({ overzicht: "prive", titel: "Oude kabels uitzoeken", schatting: 45, urgent: false, belangrijk: false });
  T({ overzicht: "prive", titel: "Belastingaangifte voorbereiden", schatting: 90, werkelijk: 150, status: "klaar", belangrijk: true });
  const jaar = new Date().getFullYear();
  d.koers.push({ id: "k1", titel: "Sterker presenteren voor klanten", toelichting: "Twee klantdemo's zelfstandig voorbereiden en geven.", trefwoorden: "presentatie demo klant slides",
                 van: jaar + "-01-01", tot: jaar + "-12-31", doel: { soort: "lijst", id: "werk" }, status: "loopt", evaluatie: "", taken: [], nee: [] },
               { id: "k2", titel: "Website op orde", toelichting: "Tweetalige site met actueel portfolio.", trefwoorden: "website portfolio teksten",
                 van: jaar + "-01-01", tot: jaar + "-12-31", doel: { soort: "lijst", id: "werk" }, status: "loopt", evaluatie: "", taken: [], nee: [] });
  return normaliseer(d);
}

// ---------- koers: afspraken voor een periode (POP/PAP), met de taken die eraan bijdragen ----------
export const afspraak = id => data.koers.find(a => a.id === id);
export const koersVan = t => data.koers.find(a => a.taken.includes(t.id));
/** Valt deze lijst onder het doel (lijst of map) van de afspraak? */
export function binnenDoel(a, lijstId) {
  if (!a.doel?.id) return true;
  return a.doel.soort === "map" ? lijstenOnder(a.doel.id).includes(lijstId) : a.doel.id === lijstId;
}
const STOP = new Set(("de het een en van voor met op in te aan bij naar om over uit tot door als dat die dit is zijn wordt worden ik je we wij mijn jouw onze ons ook nog niet wel " +
  "maar of dan meer meest veel nieuw nieuwe goed beter maken doen gaan komen hebben kunnen moet moeten willen per jaar the and for with").split(" "));
const stam = w => w.length > 5 ? w.replace(/(heden|heid|ingen|ing|en|es|s|e)$/, "") : w.replace(/(en|s)$/, "");
export function woorden(s) {
  return [...new Set(String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length >= 3 && !STOP.has(w)).map(stam).filter(w => w.length >= 3))];
}
const lijkt = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));
/** Hoe goed past een taak bij een afspraak? 0 = niet. Trefwoorden tellen dubbel, binnen de lijst/map van de afspraak telt mee. */
export function koersScore(t, a) {
  const p = t.project ? project(t.project) : null;
  const tw = woorden([t.titel, t.notitie, p?.titel].join(" "));
  const tref = woorden(a.trefwoorden), aw = woorden(a.titel + " " + (a.toelichting || ""));
  let s = 0;
  for (const w of tw) { if (tref.some(x => lijkt(w, x))) s += 2; else if (aw.some(x => lijkt(w, x))) s += 1; }
  if (!s) return 0;
  if (a.doel?.id) s += binnenDoel(a, t.overzicht) ? 0.5 : -0.5;
  return s;
}
/** Afspraken die bij deze taak lijken te horen (lopende periode, nog niet gekoppeld of afgewezen), beste eerst */
export function koersSuggesties(t, min = 1.5) {
  if (!t || t.type !== "taak" || koersVan(t)) return [];
  const dag = (t.klaarOp || new Date().toISOString()).slice(0, 10);
  return data.koers.filter(a => !a.nee.includes(t.id) && (!a.van || a.van <= dag) && (!a.tot || a.tot >= dag))
    .map(a => [a, koersScore(t, a)]).filter(([, s]) => s >= min).sort((x, y) => y[1] - x[1]).map(([a]) => a);
}
export function koppelKoers(t, aId) {
  for (const a of data.koers) a.taken = a.taken.filter(x => x !== t.id);
  const a = afspraak(aId); if (a) { a.taken.push(t.id); a.nee = a.nee.filter(x => x !== t.id); }
}
