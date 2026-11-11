// Tijdkompas — datamodel en opslag
// Lokale modus: alles in localStorage. De opslaglaag is zo opgezet dat er later
// een cloud-adapter (Firebase / Cloudflare) onder kan zonder de UI te wijzigen.

const SLEUTEL = "tijdkompas_v1";

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
  return { versie: 1, overzichten: [], projecten: [], taken: [], bezet: [], planning: [],
           accounts: [], instellingen: { ...STANDAARD_INST }, demo: false };
}

let data = laad();
const luisteraars = new Set();

function laad() {
  try {
    const ruw = localStorage.getItem(SLEUTEL);
    if (ruw) {
      const d = JSON.parse(ruw);
      d.instellingen = { ...STANDAARD_INST, ...(d.instellingen || {}) };
      for (const k of ["overzichten", "projecten", "taken", "bezet", "planning", "accounts"]) d[k] ||= [];
      return d;
    }
  } catch (e) { /* privévenster of beschadigd: begin met demo */ }
  return demoData();
}

export function bewaar() {
  try { localStorage.setItem(SLEUTEL, JSON.stringify(data)); } catch (e) {}
  luisteraars.forEach(f => f());
}

export const opslag = {
  get d() { return data; },
  luister(f) { luisteraars.add(f); },
  vervang(nieuw) { data = { ...leeg(), ...nieuw }; data.instellingen = { ...STANDAARD_INST, ...(nieuw.instellingen || {}) }; bewaar(); },
  wis() { data = leeg(); data.overzichten = basisOverzichten(); bewaar(); },
  demo() { data = demoData(); bewaar(); },
};

// ---------- opvragen ----------
export const overzicht = id => data.overzichten.find(o => o.id === id);
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

export function nieuweTaak(v = {}) {
  const t = { ...basis(), project: null, overzicht: data.overzichten[0]?.id, ...v, type: "taak" };
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
  const werkdag = { dagen: [1, 2, 3, 4, 5], van: "09:00", tot: "17:00" };
  return [
    { id: "werk",  naam: "Werk",   kleur: "#d8a24e", icoon: "💼", tijden: [werkdag] },
    { id: "prive", naam: "Privé",  kleur: "#6fb38a", icoon: "🏠", tijden: [{ dagen: [1, 2, 3, 4, 5], van: "19:30", tot: "21:30" }, { dagen: [6, 0], van: "10:00", tot: "16:00" }] },
    { id: "hobby", naam: "Hobby",  kleur: "#6f9fd8", icoon: "⛵", tijden: [{ dagen: [3], van: "19:30", tot: "22:00" }, { dagen: [6], van: "13:00", tot: "18:00" }] },
  ];
}

function dagPlus(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

function demoData() {
  const d = leeg(); d.demo = true; d.overzichten = basisOverzichten();
  const P = (v) => { const p = { ...basis(), type: "project", ...v }; d.projecten.push(p); return p; };
  const T = (v) => { const t = { ...basis(), type: "taak", project: null, ...v }; d.taken.push(t); return t; };

  const pres = P({ overzicht: "werk", titel: "Presentatie boordcomputer", urgent: true, belangrijk: true, deadline: dagPlus(6), streef: dagPlus(4), schatting: 480,
                   notitie: "Demo voor klant, inclusief testopstelling.", links: [{ url: "https://mail.google.com/mail/u/0/#inbox", label: "Uitnodiging klant" }] });
  T({ overzicht: "werk", project: pres.id, titel: "Slides opzetten", urgent: true, belangrijk: true, schatting: 120, deadline: dagPlus(4) });
  T({ overzicht: "werk", project: pres.id, titel: "Testopstelling controleren", urgent: true, belangrijk: true, schatting: 90, deadline: dagPlus(5) });
  T({ overzicht: "werk", project: pres.id, titel: "Generale repetitie", urgent: false, belangrijk: true, schatting: 60, streef: dagPlus(5) });
  T({ overzicht: "werk", project: pres.id, titel: "Offerte-concept", urgent: false, belangrijk: true, schatting: 45, werkelijk: 70, status: "klaar", klaarOp: new Date().toISOString() });

  const site = P({ overzicht: "werk", titel: "Website vernieuwen", urgent: false, belangrijk: true, streef: dagPlus(30), schatting: 900 });
  T({ overzicht: "werk", project: site.id, titel: "Teksten NL/EN nalopen", schatting: 120, belangrijk: true });
  T({ overzicht: "werk", project: site.id, titel: "Portfolio-foto's kiezen", schatting: 60, belangrijk: true, werkelijk: 50, status: "klaar" });

  T({ overzicht: "werk", titel: "Reageren op leveranciersmail", urgent: true, belangrijk: false, schatting: 15,
      links: [{ url: "https://outlook.office.com/mail/inbox", label: "Mail leverancier" }] });
  T({ overzicht: "werk", titel: "Reiskosten declareren", urgent: true, belangrijk: false, schatting: 20, deadline: dagPlus(2) });
  T({ overzicht: "werk", titel: "Tijdschrijven bijwerken", schatting: 15, werkelijk: 25, status: "klaar", urgent: true, belangrijk: false });

  const boot = P({ overzicht: "hobby", titel: "Boot winterklaar", urgent: false, belangrijk: true, deadline: dagPlus(20), schatting: 600 });
  T({ overzicht: "hobby", project: boot.id, titel: "Motor conserveren", schatting: 180, belangrijk: true });
  T({ overzicht: "hobby", project: boot.id, titel: "Zeilen naar zeilmaker", schatting: 90, belangrijk: true, urgent: true, deadline: dagPlus(8) });
  T({ overzicht: "hobby", project: boot.id, titel: "Winterzeil bestellen", schatting: 30, werkelijk: 30, status: "klaar", belangrijk: true });

  T({ overzicht: "prive", titel: "Verzekering vergelijken", schatting: 60, belangrijk: true, streef: dagPlus(10) });
  T({ overzicht: "prive", titel: "Verjaardagscadeau regelen", schatting: 30, urgent: true, belangrijk: true, deadline: dagPlus(3) });
  T({ overzicht: "prive", titel: "Oude kabels uitzoeken", schatting: 45, urgent: false, belangrijk: false });
  T({ overzicht: "prive", titel: "Belastingaangifte voorbereiden", schatting: 90, werkelijk: 150, status: "klaar", belangrijk: true });
  return d;
}
