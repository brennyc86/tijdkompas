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
      if (x.project && !veiligId(x.project)) x.project = "";
      if (Array.isArray(x.wachtOp)) x.wachtOp = idLijst(x.wachtOp);
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
    if (typeof n.instellingen.vasteAgenda !== "string") n.instellingen.vasteAgenda = "";
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
  const weg = n.afwezig && typeof n.afwezig === "object" && !Array.isArray(n.afwezig) ? n.afwezig : {};
  n.afwezig = Object.fromEntries(Object.entries(weg).filter(([k, x]) => datum(k) && k >= grens && x && typeof x === "object").map(([k, x]) => [k, { reden: tekst(x.reden, 100) }]));
  return n;
}
