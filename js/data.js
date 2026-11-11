// Tijdkompas — datamodel en opslag
// Altijd lokaal in localStorage; met een Google-login wordt dezelfde blob ook in je eigen
// Google Drive (verborgen app-map) bewaard, zodat al je apparaten dezelfde planning zien.

const SLEUTEL = "tijdkompas_v1";

// Wie is er ingelogd (Firebase-uid), of null in lokale modus
export const sessie = { ik: null };

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
  return { versie: 2, overzichten: [], projecten: [], taken: [], bezet: [], planning: [],
           locaties: basisLocaties(), beschikbaar: basisBeschikbaar(), agendas: {}, extern: {},
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
  n.agendas ||= {}; n.extern ||= {};
  for (const o of n.overzichten) {
    o.modus ||= (o.id === "werk" || /werk|kantoor|baan/i.test(o.naam)) ? "vast" : "vrij";
    o.locatie ??= "";
    o.tijden ||= [];
    o.doelAgenda ??= null;
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
  wis() { const ik = sessie.ik; const oud = data; data = leeg(); data.overzichten = basisOverzichten().map(o => ik ? { ...o, id: uid() + uid() } : o);
          if (ik) { // gedeelde lijsten van anderen blijven gewoon staan
            const anders = oud.overzichten.filter(o => o.eigenaar && o.eigenaar !== ik), ids = new Set(anders.map(o => o.id));
            data.overzichten.push(...anders);
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

export function startData() { const d = leeg(); d.overzichten = basisOverzichten(); return d; }

export function nieuweTaak(v = {}) {
  const t = { ...basis(), project: null, overzicht: data.overzichten[0]?.id, toegewezen: sessie.ik || undefined, ...v, type: "taak" };
  if (t.project && !v.overzicht) t.overzicht = project(t.project)?.overzicht || t.overzicht;
  data.taken.push(t); bewaar(); return t;
}
export function nieuwProject(v = {}) {
  const p = { ...basis(), overzicht: data.overzichten[0]?.id, ...v, type: "project" };
  data.projecten.push(p); bewaar(); return p;
}
export function werkBij(item, v) { Object.assign(item, v); bewaar(); }

export function verwijder(item) {
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

export function rondAf(item, minuten) {
  item.status = "klaar"; item.klaarOp = new Date().toISOString();
  if (minuten != null) item.werkelijk = minuten;
  data.planning = data.planning.filter(b => !(b.item === item.id && new Date(b.start) > new Date()));
  bewaar();
}
export function heropen(item) { item.status = "open"; delete item.klaarOp; bewaar(); }

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
  T({ overzicht: "werk", project: pres.id, titel: "Slides opzetten", urgent: true, belangrijk: true, schatting: 120, deadline: dagPlus(4) });
  T({ overzicht: "werk", project: pres.id, titel: "Testopstelling controleren", urgent: true, belangrijk: true, schatting: 90, deadline: dagPlus(5), locatie: "kantoor" });
  T({ overzicht: "werk", project: pres.id, titel: "Generale repetitie", urgent: false, belangrijk: true, schatting: 60, streef: dagPlus(5) });
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
  return d;
}
