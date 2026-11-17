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
  const afw = (x) => {
    if (!x || typeof x !== "object" || !["vrij", "anders", "bezet"].includes(x.soort)) return null;
    return { soort: x.soort, reden: tekst(x.reden, 100), tijden: x.soort === "vrij" ? [] : tijdvakken(x.tijden).map(t => ({ van: t.van, tot: t.tot, locatie: t.locatie })) };
  };
  for (const o of n.overzichten) {
    if (!o.afwijkingen || typeof o.afwijkingen !== "object" || Array.isArray(o.afwijkingen)) { o.afwijkingen = {}; continue; }
    o.afwijkingen = Object.fromEntries(Object.entries(o.afwijkingen).filter(([k]) => datum(k) && k >= grens).map(([k, x]) => [k, afw(x)]).filter(([, x]) => x));
  }
  // abonneer-links: lange willekeurige sleutel, alleen bestaande lijsten
  n.feeds = (Array.isArray(n.feeds) ? n.feeds : []).filter(f => f && typeof f.id === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(f.id)).slice(0, 10)
    .map(f => ({ id: f.id, naam: tekst(f.naam, 100) || "Tijdkompas", lijsten: idLijst(f.lijsten), titels: f.titels !== false, reis: !!f.reis, aangemaakt: tekst(f.aangemaakt, 40) }));
  const weg = n.afwezig && typeof n.afwezig === "object" && !Array.isArray(n.afwezig) ? n.afwezig : {};
  n.afwezig = Object.fromEntries(Object.entries(weg).filter(([k, x]) => datum(k) && k >= grens && x && typeof x === "object").map(([k, x]) => [k, { reden: tekst(x.reden, 100) }]));
  return n;
}
