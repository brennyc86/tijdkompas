// Tijdkompas — lijsten opslaan in je eigen Google Drive of OneDrive.
//
// Een lijst kan per stuk in een eigen, verborgen app-map staan (Google: appDataFolder, Microsoft: Apps/Tijdkompas)
// in plaats van in de Tijdkompas-cloud. Handig voor werk: de inhoud blijft dan in je eigen (zakelijke) OneDrive.
// Zulke lijsten zijn persoonlijk; delen met anderen kan alleen met lijsten in de cloud.
//
// Per gekoppeld account staat er één bestand "tijdkompas.json":
//   { app, versie, gewijzigd, lijsten: { id: {...} }, items: { id: {...taak/project, overzicht} } }
// Elk object krijgt een tijdstempel _t. Samenvoegen gaat per taak via een 3-wegsvergelijking
// (laatst gesynchroniseerd ↔ dit apparaat ↔ bestand), zodat twee apparaten elkaars werk niet overschrijven.
import { opslag, bewaar } from "./data.js";
import { verbindingen, heeft, api, VerlopenFout } from "./koppeling.js";

const BESTAND = "tijdkompas.json";
const OPSLAG = "tk_schijf";
const PERSOONLIJK_WEG = ["leden", "ledenInfo", "uitgenodigd", "eigenaar", "slot"];

export const schijf = { bezig: false, fouten: {}, verlopen: new Map(), laatst: {} };
const luisteraars = new Set();
export const opSchijf = (f) => luisteraars.add(f);
const meld = () => luisteraars.forEach(f => { try { f(); } catch {} });
// cloud.js zet hier zijn herbouw-functie neer (ingelogd: geheugen wordt opgebouwd uit cloud + schijf)
export const haak = { herbouw: null, ingelogd: () => false };

// ---------- toestand per apparaat: { [verbindingId]: { lokaal, basis, bestandId } } ----------
let staat = laadStaat();
function laadStaat() { try { return JSON.parse(localStorage.getItem(OPSLAG) || "{}"); } catch { return {}; } }
function bewaarStaat() { try { localStorage.setItem(OPSLAG, JSON.stringify(staat)); } catch {} }
export function vergeet(vId) { if (vId) delete staat[vId]; else staat = {}; bewaarStaat(); }

export const schijfVerbindingen = () => verbindingen().filter(v => heeft(v, "schijf"));
export const isSchijfLijst = (o) => !!o?.opslag;
export const naamVan = (vId) => { const v = verbindingen().find(x => x.id === vId); return v ? `${v.soort === "ms" ? "OneDrive" : "Google Drive"} (${v.email})` : vId.replace(/^ms:(.*)$/, "OneDrive ($1)").replace(/^google:(.*)$/, "Google Drive ($1)"); };

// ---------- stabiele vergelijking ----------
function stabiel(x) {
  if (Array.isArray(x)) return "[" + x.map(stabiel).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).filter(k => x[k] !== undefined && k !== "_t").sort().map(k => JSON.stringify(k) + ":" + stabiel(x[k])).join(",") + "}";
  return JSON.stringify(x ?? null);
}
const kopie = (x) => JSON.parse(JSON.stringify(x));

// ---------- van het geheugen naar "inhoud" voor één account ----------
function inhoudVan(d, vId) {
  const lijsten = {}, items = {};
  for (const o of d.overzichten) if (o.opslag === vId && !o.slot) {
    const l = kopie(o); PERSOONLIJK_WEG.forEach(k => delete l[k]); lijsten[o.id] = l;
  }
  for (const x of [...d.taken, ...d.projecten]) if (lijsten[x.overzicht]) items[x.id] = kopie(x);
  return { lijsten, items };
}

// Leg vast wat er nu op dit apparaat staat; gewijzigde objecten krijgen een nieuwe tijdstempel
function vastleggen(d = opslag.d) {
  const ids = new Set([...d.overzichten.filter(o => o.opslag && !o.slot).map(o => o.opslag), ...Object.keys(staat)]);
  let gewijzigd = false;
  for (const vId of ids) {
    // ingelogd zonder dat dit account hier gekoppeld is: lijsten staan als 'slot' en zijn niet geladen — niets vastleggen
    if (!d.overzichten.some(o => o.opslag === vId && !o.slot) && !staat[vId]) continue;
    const st = (staat[vId] ||= { lokaal: { lijsten: {}, items: {} }, basis: null });
    const nu = inhoudVan(d, vId), t = Date.now(), weg = new Set(st.weg || []);
    // Een lijst die hier (nog) niet geladen is, of nog niet in je profiel staat, is níet verwijderd:
    // alleen expliciet verwijderen (lijstWeg) of naar een andere opslag verplaatsen haalt hem uit het bestand.
    for (const [id, l] of Object.entries(st.lokaal.lijsten)) {
      if (nu.lijsten[id] || weg.has(id) || d.overzichten.some(o => o.id === id && !o.slot && o.opslag !== vId)) continue;
      nu.lijsten[id] = l;
      for (const [iid, x] of Object.entries(st.lokaal.items)) if (x.overzicht === id) nu.items[iid] = x;
    }
    for (const soort of ["lijsten", "items"]) {
      for (const [id, x] of Object.entries(nu[soort])) {
        const oud = st.lokaal[soort][id];
        x._t = oud && stabiel(oud) === stabiel(x) ? oud._t : t;
      }
    }
    if (stabiel(nu) !== stabiel(st.lokaal)) gewijzigd = true;
    st.lokaal = nu;
  }
  bewaarStaat();
  return gewijzigd;
}

/**
 * 3-wegs samenvoegen (puur, getest in t/test5.mjs).
 * basis = stand bij de vorige synchronisatie (null = nog nooit), lokaal = dit apparaat, ver = het bestand.
 */
export function samenvoegen(basis, lokaal, ver) {
  const uit = { lijsten: {}, items: {} };
  for (const soort of ["lijsten", "items"]) {
    const B = basis?.[soort] || {}, L = lokaal?.[soort] || {}, R = ver?.[soort] || {};
    for (const id of new Set([...Object.keys(B), ...Object.keys(L), ...Object.keys(R)])) {
      const b = B[id], l = L[id], r = R[id];
      const sb = b ? stabiel(b) : null, sl = l ? stabiel(l) : null, sr = r ? stabiel(r) : null;
      let kies;
      if (sl === sr) kies = l || r;
      else if (sl === sb) kies = r;                 // alleen het bestand is veranderd (of daar verwijderd)
      else if (sr === sb) kies = l;                 // alleen dit apparaat is veranderd (of hier verwijderd)
      else if (!l) kies = r;                        // hier verwijderd, daar bewerkt: bewerking wint
      else if (!r) kies = l;                        // daar verwijderd, hier bewerkt: bewerking wint
      else kies = (r._t || 0) > (l._t || 0) ? r : l; // beide bewerkt: de laatste wint
      if (kies) uit[soort][id] = kies;
    }
  }
  // taken van een lijst die niet meer bestaat horen er niet meer bij
  for (const [id, x] of Object.entries(uit.items)) if (!uit.lijsten[x.overzicht]) delete uit.items[id];
  return uit;
}

// ---------- bestand lezen/schrijven ----------
const GD = "https://www.googleapis.com/drive/v3/files", GU = "https://www.googleapis.com/upload/drive/v3/files";
const MG = "https://graph.microsoft.com/v1.0/me/drive/special/approot";

async function leesBestand(v, st) {
  if (v.soort === "google") {
    const r = await api(v, `${GD}?spaces=appDataFolder&q=${encodeURIComponent(`name='${BESTAND}' and trashed=false`)}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`);
    const f = r.files?.[0];
    if (!f) { st.bestandId = null; return null; }
    st.bestandId = f.id;
    return JSON.parse(await api(v, `${GD}/${f.id}?alt=media`, { tekst: true }));
  }
  // OneDrive: eerst de gegevens van het bestand ophalen; de downloadlink werkt zonder extra headers (geen CORS-gedoe)
  const meta = await api(v, `${MG}:/${BESTAND}`, { weg: true });
  if (!meta) return null;
  const url = meta["@microsoft.graph.downloadUrl"];
  const r = await fetch(url);
  if (!r.ok) throw new Error("OneDrive " + r.status);
  return JSON.parse(await r.text());
}
async function schrijfBestand(v, st, inhoud) {
  const tekst = JSON.stringify(inhoud);
  if (v.soort === "google") {
    if (st.bestandId) { await api(v, `${GU}/${st.bestandId}?uploadType=media`, { method: "PATCH", body: tekst, headers: { "Content-Type": "application/json" } }); return; }
    const grens = "tk" + Math.random().toString(36).slice(2);
    const body = `--${grens}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: BESTAND, parents: ["appDataFolder"] })}\r\n` +
                 `--${grens}\r\nContent-Type: application/json\r\n\r\n${tekst}\r\n--${grens}--`;
    const r = await api(v, `${GU}?uploadType=multipart&fields=id`, { method: "POST", body, headers: { "Content-Type": `multipart/related; boundary=${grens}` } });
    st.bestandId = r.id; return;
  }
  await api(v, `${MG}:/${BESTAND}:/content`, { method: "PUT", body: tekst, headers: { "Content-Type": "application/json" } });
}

// ---------- synchroniseren ----------
/** Synchroniseert één account. Gooit VerlopenFout als opnieuw inloggen nodig is. */
export async function synchroniseer(v) {
  vastleggen();
  const st = (staat[v.id] ||= { lokaal: { lijsten: {}, items: {} }, basis: null });
  const ver = await leesBestand(v, st);
  const samen = samenvoegen(st.basis, st.lokaal, ver);
  const leeg = !Object.keys(samen.lijsten).length;
  if (ver ? stabiel({ l: ver.lijsten, i: ver.items }) !== stabiel({ l: samen.lijsten, i: samen.items }) : !leeg) {
    await schrijfBestand(v, st, { app: "tijdkompas", versie: 1, gewijzigd: new Date().toISOString(), ...samen });
  }
  const veranderdHier = stabiel(samen) !== stabiel(st.lokaal);
  st.basis = kopie(samen); st.lokaal = kopie(samen); st.gesynct = new Date().toISOString();
  st.weg = (st.weg || []).filter(id => samen.lijsten[id]);   // verwerkte verwijderingen vergeten
  bewaarStaat();
  schijf.laatst[v.id] = st.gesynct; delete schijf.fouten[v.id]; schijf.verlopen.delete(v.id);
  if (veranderdHier) toepassenOpGeheugen();
  return veranderdHier;
}

let loopt = null, opnieuw = false;
/** Synchroniseert alle accounts met schijfopslag. Meerdere aanroepen tegelijk worden samengevoegd. */
export function synchroniseerAlles() {
  if (loopt) { opnieuw = true; return loopt; }
  loopt = (async () => {
    schijf.bezig = true; meld();
    try {
      do {
        opnieuw = false;
        for (const v of schijfVerbindingen()) {      // ook zonder lijsten hier: een nieuw apparaat haalt zo alles op
          try { await synchroniseer(v); }
          catch (e) {
            if (e instanceof VerlopenFout) schijf.verlopen.set(v.id, v);
            else schijf.fouten[v.id] = e.message;
          }
        }
      } while (opnieuw);
    } finally { schijf.bezig = false; loopt = null; meld(); }
  })();
  return loopt;
}

// ---------- terug naar het geheugen ----------
/**
 * Vult een (nieuw opgebouwd) datablob aan met de lijsten en taken uit de schijf-cache.
 * Lijsten die als 'opslag' bekend zijn maar hier (nog) niet geladen zijn, blijven als 'slot' staan.
 * nieuweToevoegen: lijsten die alleen in het bestand staan ook toevoegen (zonder login; met login bepaalt het gebruikersprofiel welke lijsten er zijn).
 */
export function aanvullen(d, { nieuweToevoegen = !haak.ingelogd() } = {}) {
  const vIds = new Set([...d.overzichten.filter(o => o.opslag).map(o => o.opslag), ...(nieuweToevoegen ? Object.keys(staat) : [])]);
  for (const vId of vIds) {
    const st = staat[vId];
    if (!st?.lokaal) continue;
    const inh = st.lokaal;
    const verbonden = schijfVerbindingen().some(v => v.id === vId);
    d.overzichten = d.overzichten.flatMap(o => {
      if (o.opslag !== vId) return [o];
      const l = inh.lijsten[o.id];
      if (l) { const { _t, ...rest } = l; return [{ ...o, ...rest, opslag: vId, slot: false }]; }
      // Zonder login is het bestand leidend: na een geslaagde synchronisatie is hij daar verwijderd.
      // Met login is de verwijzing in je profiel leidend: dan is hij gewoon nog niet geladen.
      return nieuweToevoegen && st.gesynct && verbonden ? [] : [{ ...o, slot: true }];
    });
    if (nieuweToevoegen) for (const [id, l] of Object.entries(inh.lijsten)) {
      if (!d.overzichten.some(o => o.id === id)) { const { _t, ...rest } = l; d.overzichten.push({ ...rest, opslag: vId, slot: false }); }
    }
    const lijstIds = new Set(d.overzichten.filter(o => o.opslag === vId && !o.slot).map(o => o.id));
    const items = Object.values(inh.items).filter(x => lijstIds.has(x.overzicht)).map(({ _t, ...x }) => x);
    for (const soort of ["taken", "projecten"]) {
      d[soort] = d[soort].filter(x => !lijstIds.has(x.overzicht)).concat(items.filter(x => x.type === (soort === "taken" ? "taak" : "project")));
    }
  }
  return d;
}

// Staan er lijsten als 'slot' terwijl het account hier wel gekoppeld is? Dan even ophalen (hooguit eens per minuut).
let laatstOntbrekend = 0;
export function laadOntbrekende(d) {
  const ids = new Set(schijfVerbindingen().map(v => v.id));
  if (!d.overzichten.some(o => o.slot && ids.has(o.opslag)) || Date.now() - laatstOntbrekend < 60e3) return;
  laatstOntbrekend = Date.now(); synchroniseerAlles();
}

function toepassenOpGeheugen() {
  if (haak.ingelogd() && haak.herbouw) return haak.herbouw();
  opslag.vervang(aanvullen(kopie(opslag.d)), { stil: true });
}

/** Meld dat een lijst bewust verwijderd wordt (aanroepen vóór het weghalen uit het geheugen). */
export function lijstWeg(id) {
  const o = opslag.d.overzichten.find(x => x.id === id);
  if (!o?.opslag || !staat[o.opslag]) return;
  const st = staat[o.opslag]; st.weg = [...new Set([...(st.weg || []), id])]; bewaarStaat();
}

// ---------- lijsten verplaatsen ----------
/** Zet een lijst in de schijf van account vId (of terug naar de cloud/deze browser met vId = null). Schrijft eerst, verplaatst daarna. */
export async function verplaats(lijstId, vId) {
  const o = opslag.d.overzichten.find(x => x.id === lijstId);
  if (!o) return;
  if (vId) {
    const v = schijfVerbindingen().find(x => x.id === vId);
    if (!v) throw new Error("Dat account is op dit apparaat niet gekoppeld");
    if ((o.leden || []).length > 1 || (o.uitgenodigd || []).length) throw new Error("Een gedeelde lijst kan niet in je eigen schijf; haal eerst de andere leden eruit");
    const oud = o.opslag;
    o.opslag = vId; o.slot = false;
    try { await synchroniseer(v); }
    catch (e) { o.opslag = oud; vastleggen(); throw e; }
  } else {
    o.opslag = null;
  }
  bewaar();                 // cloud.js schrijft nu (of verwijdert) de lijst in Firestore
  synchroniseerAlles();     // en het oude bestand wordt bijgewerkt
}

// ---------- automatisch ----------
let timer = null;
opslag.luister(({ stil } = {}) => {
  if (stil) return;
  if (vastleggen()) { clearTimeout(timer); timer = setTimeout(synchroniseerAlles, 2500); }
});
let gestart = false;
export function startSchijf() {
  if (!schijfVerbindingen().length) return;
  if (gestart) return synchroniseerAlles();
  gestart = true;
  synchroniseerAlles();
  // regelmatig kijken of een ander apparaat iets veranderd heeft (alleen als het tabblad zichtbaar is)
  setInterval(() => { if (document.visibilityState === "visible") synchroniseerAlles(); }, 3 * 60e3);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") synchroniseerAlles(); });
}
