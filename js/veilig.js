// Tijdkompas — alles wat van buiten komt (gedeelde lijsten van anderen, agenda's, takenlijsten, bestanden) ontsmetten
// voordat het in de app komt. Tekst wordt bij het tonen altijd ge-escaped (esc in app.js); dit is de tweede laag:
// velden die in HTML-attributen of CSS belanden (id's, kleuren, iconen, links) mogen alleen veilige waarden hebben.

/** Id's van lijsten, mappen, taken en koersafspraken: alleen letters, cijfers, _ en - */
export const veiligId = (x) => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x);
/** Kleur: alleen #rgb / #rrggbb / #rrggbbaa */
export const veiligeKleur = (x, standaard = "#8a978e") => typeof x === "string" && /^#[0-9a-fA-F]{3,8}$/.test(x.trim()) ? x.trim() : standaard;
/** Icoon (emoji): geen tekens die HTML kunnen openbreken, hooguit 16 tekens */
export function veiligIcoon(x, standaard = "📋") {
  const s = [...String(x ?? "").replace(/[<>"'&`\\=\u0000-\u001f]/g, "").trim()].slice(0, 16).join("");
  return s || standaard;
}
/** Link: alleen http(s) en mailto; de rest (javascript:, data:, …) wordt leeg */
export function veiligeUrl(u) {
  try { const p = new URL(String(u ?? "")); return ["http:", "https:", "mailto:"].includes(p.protocol) ? p.href : ""; } catch { return ""; }
}
/** Profielfoto: alleen van Google (lh3.googleusercontent.com e.d.), zodat een ander geen eigen server kan laten meekijken */
export const veiligeFoto = (u) => { const v = veiligeUrl(u); try { return v.startsWith("https:") && new URL(v).hostname.endsWith(".googleusercontent.com") ? v : ""; } catch { return ""; } };
const tekst = (x, max = 2000) => (typeof x === "string" ? x : x == null ? "" : String(x)).slice(0, max);

// Boodschappenlijst: tekst blijft tekst (wordt bij tonen ge-escaped); soorten en supermarkten alleen als korte id
const kortId = (x) => typeof x === "string" && /^[a-z0-9_-]{1,40}$/.test(x);
const obj = (x) => x && typeof x === "object" && !Array.isArray(x) ? x : {};
/** Verzoeken aan je andere inlog: een afspraak in diens agenda maken of eruit halen */
export function veiligeVerzoeken(l) {
  const iso = (x) => typeof x === "string" && !isNaN(Date.parse(x)) && x.length <= 40;
  const agendaK = (x) => typeof x === "string" && x.length <= 400 && /^(google|ms):/.test(x);
  return (Array.isArray(l) ? l : []).filter(v => v && veiligId(v.id) && veiligId(v.voor) && ["maak", "wis", "wijzig"].includes(v.soort) && agendaK(v.k)).slice(-100).map(v => v.soort === "wijzig"
    ? { id: v.id, voor: v.voor, soort: "wijzig", k: v.k, extId: tekst(v.extId, 400), titel: tekst(v.titel, 200), plaats: tekst(v.plaats, 300), start: iso(v.start) ? v.start : "", eind: iso(v.eind) ? v.eind : "", gemaakt: tekst(v.gemaakt, 40) }
    : v.soort === "wis"
    ? { id: v.id, voor: v.voor, soort: "wis", k: v.k, extId: tekst(v.extId, 400), titel: tekst(v.titel, 200), gemaakt: tekst(v.gemaakt, 40) }
    : { id: v.id, voor: v.voor, soort: "maak", k: v.k, titel: tekst(v.titel, 200), plaats: tekst(v.plaats, 300), omschrijving: tekst(v.omschrijving, 500),
        start: iso(v.start) ? v.start : "", eind: iso(v.eind) ? v.eind : "", gemaakt: tekst(v.gemaakt, 40),
        extra: (Array.isArray(v.extra) ? v.extra : []).filter(x => x && iso(x.start) && iso(x.eind)).slice(0, 4).map(x => ({ titel: tekst(x.titel, 200), start: x.start, eind: x.eind })) }
  ).filter(v => v.soort === "maak" ? v.start && v.eind : !!v.extId);
}
export function veiligeBoodschappen(b) {
  b = obj(b);
  const items = (Array.isArray(b.items) ? b.items : []).filter(i => i && veiligId(i.id) && typeof i.tekst === "string" && i.tekst.trim()).slice(0, 500).map(i => ({
    id: i.id, tekst: tekst(i.tekst, 120), aantal: Math.max(1, Math.min(99, Math.round(Number(i.aantal) || 1))), klaar: !!i.klaar,
    gemaakt: tekst(i.gemaakt, 40), ...(i.klaarOp ? { klaarOp: tekst(i.klaarOp, 40) } : {}), ...(kortId(i.soort) ? { soort: i.soort } : {}),
    ...(kortId(i.keten) ? { keten: i.keten } : {}), ...(i.geenFav ? { geenFav: true } : {}), ...(i.notitie ? { notitie: tekst(i.notitie, 300) } : {}), ...(veiligId(i.door) ? { door: i.door } : {}),
  }));
  const geleerd = Object.fromEntries(Object.entries(obj(b.geleerd)).filter(([k, v]) => k.length <= 200 && kortId(v)).slice(-600));
  const historie = Object.fromEntries(Object.entries(obj(b.historie)).filter(([k, v]) => k.length <= 200 && v && typeof v.tekst === "string").slice(-400)
    .map(([k, v]) => [k, { tekst: tekst(v.tekst, 120), n: Math.max(0, Math.min(1e5, Math.round(Number(v.n) || 0))), laatst: tekst(v.laatst, 10) }]));
  const ketens = (Array.isArray(b.ketens) ? b.ketens : []).filter(kortId).slice(0, 30);
  const voorkeur = Object.fromEntries(Object.entries(obj(b.voorkeur)).filter(([k, v]) => kortId(k) && typeof v === "string").map(([k, v]) => [k, tekst(v, 40)]));
  const favorieten = (Array.isArray(b.favorieten) ? b.favorieten : []).filter(f => f && veiligId(f.id) && typeof f.tekst === "string" && f.tekst.trim()).slice(0, 200).map(f => ({
    id: f.id, tekst: tekst(f.tekst, 120), ...(f.bron && kortId(f.bron.k) ? { bron: { k: f.bron.k } } : {}), gemaakt: tekst(f.gemaakt, 10),
  }));
  return { items, geleerd, historie, ketens, voorkeur, favorieten };
}

/** Ledeninfo ({uid: {naam, email, foto}}) van een gedeelde lijst of map */
export function veiligeLeden(info) {
  const uit = {};
  for (const [u, x] of Object.entries(info && typeof info === "object" ? info : {}))
    if (veiligId(u)) uit[u] = { naam: tekst(x?.naam, 200), email: tekst(x?.email, 200), foto: veiligeFoto(x?.foto) };
  return uit;
}
const idLijst = (l) => (Array.isArray(l) ? l : []).filter(veiligId);
const KSTATUS = ["loopt", "gehaald", "deels", "niet"];

// Afwijkingen per datum (vakantie, cursus, geruilde dag…) van een lijst — ook die van je gelinkte accounts gaan hierdoor.
// soort "standaard" = uitdrukkelijk weer zoals altijd (gaat boven een oudere afwijking van een ander account); t = wanneer gezet;
// bij = welke botsing(en) hiermee zijn opgelost.
const AFW_SOORT = ["vrij", "anders", "bezet", "standaard"];
const tijdOk = (t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t);
export function veiligeAfwijkingen(m) {
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  const grens = new Date(Date.now() - 366 * 864e5).toISOString().slice(0, 10), uit = {};
  for (const [k, x] of Object.entries(m)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || k < grens || !x || typeof x !== "object" || !AFW_SOORT.includes(x.soort)) continue;
    uit[k] = { soort: x.soort, reden: tekst(x.reden, 100),
      tijden: ["vrij", "standaard"].includes(x.soort) ? [] : (Array.isArray(x.tijden) ? x.tijden : []).filter(t => t && tijdOk(t.van) && tijdOk(t.tot))
        .map(t => ({ van: t.van, tot: t.tot, locatie: veiligId(t.locatie) ? t.locatie : "" })),
      ...(typeof x.t === "string" && x.t.length <= 40 ? { t: x.t } : {}),
      ...(Array.isArray(x.bij) ? { bij: x.bij.filter(b => typeof b === "string" && b.length <= 200).slice(0, 20) } : {}) };
  }
  return uit;
}
export function veiligGenegeerd(m) {
  if (!m || typeof m !== "object" || Array.isArray(m)) return {};
  return Object.fromEntries(Object.entries(m).filter(([k, v]) => k.length <= 200 && typeof v === "string" && v.length <= 40).slice(-300));
}

/** AI-gegevens bij een taak (status, deeltaken en logboek van de AI): alleen tekst, begrensd */
export function veiligeAi(a) {
  if (!a || typeof a !== "object" || Array.isArray(a)) return null;
  const deel = (Array.isArray(a.deeltaken) ? a.deeltaken : []).filter(x => x && typeof x.titel === "string" && x.titel.trim()).slice(0, 50)
    .map((x, i) => ({ id: veiligId(x.id) ? x.id : "d" + i, titel: tekst(x.titel, 200).trim(), klaar: !!x.klaar }));
  const log = (Array.isArray(a.log) ? a.log : []).filter(x => x && typeof x.tekst === "string").slice(-30)
    .map(x => ({ id: veiligId(x.id) ? x.id : "", t: tekst(x.t, 40), door: tekst(x.door, 60), tekst: tekst(x.tekst, 4000) }));
  return { aan: !!a.aan, agent: veiligId(a.agent) ? a.agent : "", status: ["open", "bezig", "beoordelen"].includes(a.status) ? a.status : "open", deeltaken: deel, log, opmerking: tekst(a.opmerking, 2000) };
}

/**
 * Maakt een volledig data-object veilig (in place). Lijsten, mappen, taken en koersafspraken met een onveilige id
 * vallen weg; kleuren, iconen en links worden vervangen door veilige waarden.
 */
export function ontsmet(n) {
  n.overzichten = (n.overzichten || []).filter(o => o && veiligId(o.id));
  for (const o of n.overzichten) {
    o.kleur = veiligeKleur(o.kleur); o.icoon = veiligIcoon(o.icoon, "📋"); o.naam = tekst(o.naam, 200) || "Lijst";
    if (o.ledenInfo) o.ledenInfo = veiligeLeden(o.ledenInfo);
    if (o.leden) o.leden = idLijst(o.leden);
    if (o.map && !veiligId(o.map)) o.map = "";
    if (o.eigenaar && !veiligId(o.eigenaar)) o.eigenaar = "";
    if (o.verdeling && !["samen", "verdelen"].includes(o.verdeling)) o.verdeling = "samen";
    if (o.modus && !["vast", "vrij"].includes(o.modus)) o.modus = "vrij";
    if (Array.isArray(o.mensen)) o.mensen = o.mensen.map(m => tekst(m, 100)).filter(Boolean);
    if (Array.isArray(o.uitgenodigd)) o.uitgenodigd = o.uitgenodigd.map(m => tekst(m, 200).toLowerCase()).filter(Boolean);
  }
  n.mappen = (n.mappen || []).filter(m => m && veiligId(m.id));
  for (const m of n.mappen) {
    m.kleur = veiligeKleur(m.kleur); m.icoon = veiligIcoon(m.icoon, "📁"); m.naam = tekst(m.naam, 200) || "Map";
    if (m.ledenInfo) m.ledenInfo = veiligeLeden(m.ledenInfo);
    if (m.leden) m.leden = idLijst(m.leden);
    if (m.ouder && !veiligId(m.ouder)) m.ouder = "";
    if (m.eigenaar && !veiligId(m.eigenaar)) m.eigenaar = "";
  }
  for (const soort of ["taken", "projecten"]) {
    n[soort] = (n[soort] || []).filter(x => x && veiligId(x.id) && veiligId(x.overzicht || "x"));
    for (const x of n[soort]) {
      x.titel = tekst(x.titel, 500);
      if (x.icoon != null) x.icoon = x.icoon ? veiligIcoon(x.icoon, "") : "";
      if (x.kort != null) x.kort = tekst(x.kort, 40).trim();
      if (x.looptijd != null && !["kort", "lang"].includes(x.looptijd)) x.looptijd = "kort";
      if (x.doel != null) x.doel = tekst(x.doel, 300).trim();
      if (x.ouder != null && x.ouder !== "" && (!veiligId(x.ouder) || x.ouder === x.id)) x.ouder = "";
      if (x.project && !veiligId(x.project)) x.project = "";
      if (Array.isArray(x.wachtOp)) x.wachtOp = idLijst(x.wachtOp);
      for (const k of ["impact", "inspanning"]) if (x[k] != null && typeof x[k] !== "boolean") delete x[k];
      if (x.ai != null) x.ai = veiligeAi(x.ai);
      if (Array.isArray(x.wie)) x.wie = x.wie.filter(w => typeof w === "string" && (veiligId(w) || w === "ik" || /^~[^<>"'&`]{1,100}$/.test(w)));
      for (const k of ["deadline", "streef"]) if (x[k] && !/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(String(x[k]))) delete x[k];
      for (const k of ["schatting", "werkelijk"]) if (x[k] != null && !Number.isFinite(+x[k])) delete x[k]; else if (x[k] != null) x[k] = +x[k];
      if (Array.isArray(x.links)) x.links = x.links.map(l => ({ url: veiligeUrl(l?.url), label: tekst(l?.label, 200) })).filter(l => l.url);
    }
  }
  n.koers = (n.koers || []).filter(a => a && veiligId(a.id));
  for (const a of n.koers) {
    a.titel = tekst(a.titel, 300); a.taken = idLijst(a.taken); a.nee = idLijst(a.nee);
    if (!KSTATUS.includes(a.status)) a.status = "loopt";
    if (a.doel && (!["lijst", "map", ""].includes(a.doel.soort) || (a.doel.id && !veiligId(a.doel.id)))) a.doel = { soort: "", id: "" };
    if (Array.isArray(a.wie)) a.wie = a.wie.filter(w => typeof w === "string" && (veiligId(w) || /^~[^<>"'&`]{1,100}$/.test(w)));
    for (const k of ["van", "tot"]) if (a[k] && !/^\d{4}-\d{2}-\d{2}$/.test(a[k])) a[k] = "";
  }
  n.locaties = (n.locaties || []).filter(l => l && veiligId(l.id));
  for (const l of n.locaties) { l.icoon = veiligIcoon(l.icoon, "📍"); l.naam = tekst(l.naam, 200); }
  // winkels en winkelcentra (voor de boodschappenlijst)
  for (const l of n.locaties) {
    l.reistijd = Math.max(0, Math.min(1e4, Number(l.reistijd) || 0));
    if (l.soort !== "winkel") { delete l.soort; continue; }
    l.ketens = (Array.isArray(l.ketens) ? l.ketens : []).filter(kortId).slice(0, 30);
    l.soorten = (Array.isArray(l.soorten) ? l.soorten : []).filter(kortId).slice(0, 30);
    l.bereik = l.bereik === "route" ? "route" : "langs";
    l.route = veiligId(l.route) ? l.route : "";
    l.omweg = Math.max(0, Math.min(120, Number(l.omweg) || 0));
    l.sluit = typeof l.sluit === "string" && /^\d{2}:\d{2}$/.test(l.sluit) ? l.sluit : "";
  }
  const tijd = (t) => typeof t === "string" && /^\d{2}:\d{2}$/.test(t);
  const tijdvakken = (l) => (Array.isArray(l) ? l : []).filter(t => t && tijd(t.van) && tijd(t.tot)).map(t => ({ ...t, locatie: veiligId(t.locatie) ? t.locatie : "" }));
  for (const o of n.overzichten) if (o.tijden) o.tijden = tijdvakken(o.tijden);
  if (Array.isArray(n.beschikbaar)) n.beschikbaar = n.beschikbaar.filter(t => t && tijd(t.van) && tijd(t.tot));
  for (const e of n.bezet || []) if (e.kleur) e.kleur = veiligeKleur(e.kleur, "");
  for (const a of Object.values(n.agendas || {})) if (a && a.kleur) a.kleur = veiligeKleur(a.kleur, "");
  for (const l of n.agendaLinks || []) if (l && l.kleur) l.kleur = veiligeKleur(l.kleur, "");
  n.planning = (n.planning || []).filter(b => b && veiligId(b.id));
  for (const b of n.planning) if (b.agenda != null && (typeof b.agenda !== "string" || b.agenda.length > 400)) delete b.agenda;
  if (n.instellingen) {
    if (!["taak", "lijst", "vast"].includes(n.instellingen.agendaDoel)) n.instellingen.agendaDoel = "taak";
    if (!["vragen", "weg", "schuif"].includes(n.instellingen.doenModus)) n.instellingen.doenModus = "vragen";
    if (!["vragen", "voren", "vorenUitloop"].includes(n.instellingen.klaarModus)) n.instellingen.klaarModus = "vragen";
    if (typeof n.instellingen.vasteAgenda !== "string") n.instellingen.vasteAgenda = "";
    if (!["auto", "fiets", "ov", "lopen"].includes(n.instellingen.vervoer)) delete n.instellingen.vervoer;
    if (typeof n.instellingen.mapsSleutel !== "string" || !/^[A-Za-z0-9_-]{0,80}$/.test(n.instellingen.mapsSleutel)) delete n.instellingen.mapsSleutel;
    if (n.instellingen.routes != null) n.instellingen.routes = n.instellingen.routes !== false;
  }
  // afwijkingen per datum (vakantie, cursus, geruilde dag…): alleen geldige datums, soorten en tijden; oud spul (> 1 jaar) valt weg
  const datum = (k) => /^\d{4}-\d{2}-\d{2}$/.test(k), grens = new Date(Date.now() - 366 * 864e5).toISOString().slice(0, 10);
  for (const o of n.overzichten) {
    o.afwijkingen = veiligeAfwijkingen(o.afwijkingen);
    o.genegeerd = veiligGenegeerd(o.genegeerd);
  }
  // abonneer-links: lange willekeurige sleutel, alleen bestaande lijsten
  n.feeds = (Array.isArray(n.feeds) ? n.feeds : []).filter(f => f && typeof f.id === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(f.id)).slice(0, 10)
    .map(f => ({ id: f.id, naam: tekst(f.naam, 100) || "Tijdkompas", lijsten: idLijst(f.lijsten), titels: f.titels !== false, reis: !!f.reis, aangemaakt: tekst(f.aangemaakt, 40) }));
  // AI-toegang: lange willekeurige sleutel per AI, alleen bestaande lijsten
  n.aiToegang = (Array.isArray(n.aiToegang) ? n.aiToegang : []).filter(f => f && typeof f.id === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(f.id)).slice(0, 10)
    .map(f => ({ id: f.id, aid: veiligId(f.aid) ? f.aid : "a" + f.id.slice(0, 10).replace(/[^A-Za-z0-9]/g, "x"), naam: tekst(f.naam, 100) || "AI", aangemaakt: tekst(f.aangemaakt, 40) }));
  // afspraken die niet altijd meetellen: per naam + agenda alleen op werkdagen, of losse keren verborgen
  n.afspraakRegels = (Array.isArray(n.afspraakRegels) ? n.afspraakRegels : []).filter(r => r && typeof r.bron === "string" && r.bron.length <= 400 && ["werkdag", "rolwerk", "rolprive", "herinnering"].includes(r.soort) && (r.soort === "herinnering" || veiligId(r.lijst)))
    .slice(0, 200).map(r => ({ id: veiligId(r.id) ? r.id : "r" + Math.random().toString(36).slice(2, 10), bron: r.bron, titel: tekst(r.titel, 200), lijst: veiligId(r.lijst) ? r.lijst : "", soort: r.soort }));
  const grensV = new Date(Date.now() - 31 * 864e5).toISOString();
  n.verborgen = Object.fromEntries(Object.entries(n.verborgen && typeof n.verborgen === "object" && !Array.isArray(n.verborgen) ? n.verborgen : {})
    .filter(([k, v]) => k.length <= 500 && typeof v === "string" && v.length <= 40 && (k.split("|").at(-2) || "") >= grensV).slice(-500));
  // losse afspraken die een herinnering zijn, en meldingen "buiten je beschikbaarheid" die kloppen
  for (const veld of ["herinneringen", "buitenOk"]) n[veld] = Object.fromEntries(Object.entries(n[veld] && typeof n[veld] === "object" && !Array.isArray(n[veld]) ? n[veld] : {})
    .filter(([k, v]) => k.length <= 500 && typeof v === "string" && v.length <= 40).slice(-500));
  // per losse afspraak: hoort hij bij de rol van een lijst (werk) of juist niet (privé)
  n.rolKeuzes = Object.fromEntries(Object.entries(n.rolKeuzes && typeof n.rolKeuzes === "object" && !Array.isArray(n.rolKeuzes) ? n.rolKeuzes : {})
    .filter(([k, v]) => k.length <= 500 && v && ["werk", "prive"].includes(v.rol) && veiligId(v.lijst) && (k.split("|").at(-2) || "") >= grensV)
    .slice(-500).map(([k, v]) => [k, { rol: v.rol, lijst: v.lijst }]));
  n.boodschappen = veiligeBoodschappen(n.boodschappen);
  n.afspraakVerzoeken = veiligeVerzoeken(n.afspraakVerzoeken);
  n.reistijden = Object.fromEntries(Object.entries(obj(n.reistijden)).filter(([k, v]) => k.length <= 700 && v && typeof v === "object" && Number(v.min) > 0).slice(-600)
    .map(([k, v]) => [k, { van: tekst(v.van, 300), naar: tekst(v.naar, 300), vervoer: ["auto", "fiets", "ov", "lopen"].includes(v.vervoer) ? v.vervoer : "auto",
      min: Math.min(600, Math.round(Number(v.min))), km: Number.isFinite(Number(v.km)) && v.km != null ? Math.round(Number(v.km) * 10) / 10 : null,
      bron: ["google", "osm", "zelf"].includes(v.bron) ? v.bron : "", t: tekst(v.t, 10) }]));
  n.afspraakPlaats = Object.fromEntries(Object.entries(obj(n.afspraakPlaats)).filter(([k, v]) => k.length <= 600 && typeof v === "string").slice(-300).map(([k, v]) => [k, tekst(v, 300)]));
  n.medisch = Object.fromEntries(Object.entries(obj(n.medisch)).filter(([k, v]) => k.length <= 600 && typeof v === "string").slice(-300).map(([k, v]) => [k, tekst(v, 40)]));
  n.tochTonen = Object.fromEntries(Object.entries(obj(n.tochTonen)).filter(([k, v]) => k.length <= 600 && typeof v === "string").slice(-300).map(([k, v]) => [k, tekst(v, 40)]));
  n.afspraakGedaan = Object.fromEntries(Object.entries(obj(n.afspraakGedaan)).filter(([k, v]) => veiligId(k) && v && typeof v === "object").slice(-300)
    .map(([k, v]) => [k, { ok: !!v.ok, t: tekst(v.t, 40), ...(v.fout ? { fout: tekst(v.fout, 200) } : {}) }]));
  const weg = n.afwezig && typeof n.afwezig === "object" && !Array.isArray(n.afwezig) ? n.afwezig : {};
  n.afwezig = Object.fromEntries(Object.entries(weg).filter(([k, x]) => datum(k) && k >= grens && x && typeof x === "object").map(([k, x]) => [k, { reden: tekst(x.reden, 100) }]));
  return n;
}
