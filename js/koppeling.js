// Tijdkompas — koppelingen met Google (Google Identity Services) en Microsoft (MSAL / Microsoft Graph).
// Inloggen op Tijdkompas zelf loopt via Firebase (cloud.js). Een koppeling geeft toegang voor één of meer doelen:
//   "agenda"  agenda's lezen en ingeplande blokken wegschrijven
//   "schijf"  een eigen, verborgen map in Google Drive / OneDrive om lijsten in op te slaan (schijf.js)
// Alles draait in de browser: Google Identity Services (token-client) en MSAL.js (Microsoft).
// Er is geen eigen server; tokens blijven op dit apparaat.
import { CONFIG } from "./config.js";

const G_SCOPES = {
  basis: ["openid", "email", "profile"],
  agenda: ["https://www.googleapis.com/auth/calendar.readonly",    // agenda's + afspraken lezen
           "https://www.googleapis.com/auth/calendar.events"],     // ingeplande blokken wegschrijven
  schijf: ["https://www.googleapis.com/auth/drive.appdata"],       // alleen de eigen verborgen app-map, niet je andere bestanden
  taken:  ["https://www.googleapis.com/auth/tasks"],               // Google Taken lezen en bijwerken
};
// MailboxSettings.Read: alleen om de kleuren van je Outlook-categorieën over te nemen
const M_SCOPES = { basis: ["User.Read"], agenda: ["Calendars.ReadWrite", "MailboxSettings.Read"], schijf: ["Files.ReadWrite.AppFolder"], taken: ["Tasks.ReadWrite"] };
const DOELNAAM = { agenda: "je agenda", schijf: "de Tijdkompas-map in je Drive", taken: "je takenlijsten" };
const scopesVoor = (tabel, doelen) => [...new Set([...tabel.basis, ...doelen.flatMap(d => tabel[d] || [])])];
/** Waarvoor is deze koppeling? Oudere koppelingen waren alleen voor de agenda. */
export const doelenVan = (v) => v.doelen || ["agenda"];
export const heeft = (v, doel) => doelenVan(v).includes(doel);
const MSAL_URL = "https://cdn.jsdelivr.net/npm/@azure/msal-browser@3.28.1/lib/msal-browser.min.js";

export class VerlopenFout extends Error {
  constructor(v) { super(`Sessie van ${v.email} is verlopen`); this.verbinding = v; }
}

// ---------- client-ID's (config.js, of zelf ingevuld op dit apparaat) ----------
export function ids() {
  let eigen = {};
  try { eigen = JSON.parse(localStorage.getItem("tk_clientids") || "{}"); } catch {}
  return { google: eigen.google || CONFIG.googleClientId || "", microsoft: eigen.microsoft || CONFIG.microsoftClientId || "" };
}
export function zetIds(v) { try { localStorage.setItem("tk_clientids", JSON.stringify(v)); } catch {} gClient = null; msal = null; }

// ---------- verbindingen (per apparaat) ----------
// Welke koppelingen er zijn (account, doelen) hoort bij het hele Tijdkompas en gaat via de app mee naar de cloud
// (koppelHaak), zodat elke inlog en elk apparaat ze ziet. De toegangssleutels (tokens) blijven op het apparaat.
const VSLEUTEL = "tk_verbindingen", VAN = "tk_verbindingenVan";
export const koppelHaak = { wijzig: null };
export function verbindingen() { try { return JSON.parse(localStorage.getItem(VSLEUTEL) || "[]"); } catch { return []; } }
const zonderSleutel = ({ token, verloopt, ...r }) => r;
export const gedeeldeKoppelingen = () => verbindingen().map(zonderSleutel);
function bewaarV(lijst, stil = false) {
  try { localStorage.setItem(VSLEUTEL, JSON.stringify(lijst)); } catch {}
  if (!stil) koppelHaak.wijzig?.(lijst.map(zonderSleutel));
}
/**
 * Neemt de koppelingen uit de cloud over (gemaakt vanuit een ander account of apparaat van dit Tijdkompas).
 * Sleutels die dit apparaat al had blijven bewaard. eigenaar = id van het Tijdkompas.
 * Geeft de lijst terug die naar de cloud moet als er hier iets bij kwam (anders null).
 */
export function neemGedeeldeOver(metas, eigenaar) {
  const lokaal = verbindingen();
  let van = null; try { van = localStorage.getItem(VAN); } catch {}
  let uit;
  if (!Array.isArray(metas)) uit = van && van !== eigenaar ? [] : lokaal;                    // cloud kent nog niets: eigen koppelingen meenemen
  else {
    uit = metas.map(m => { const l = lokaal.find(x => x.id === m.id); return l ? { ...m, token: l.token, verloopt: l.verloopt } : { ...m }; });
    if (!van) for (const l of lokaal) if (!uit.some(x => x.id === l.id)) uit.push(l);       // gemaakt zonder in te loggen: erbij
  }
  try { localStorage.setItem(VAN, eigenaar); } catch {}
  if (JSON.stringify(uit) !== JSON.stringify(lokaal)) bewaarV(uit, true);
  const naarCloud = uit.map(zonderSleutel);
  return JSON.stringify(naarCloud) !== JSON.stringify(metas ?? null) ? naarCloud : null;
}
function werkV(v) { const l = verbindingen(); const i = l.findIndex(x => x.id === v.id); if (i >= 0) l[i] = v; else l.push(v); bewaarV(l); return v; }
export const primair = () => verbindingen().find(v => v.primair && v.soort === "google") || null;
export const isVerlopen = (v) => v.soort === "google" && (!v.token || Date.now() > v.verloopt);

function laadScript(src) {
  return new Promise((ok, fout) => {
    if ([...document.scripts].some(s => s.src === src && s.dataset.geladen)) return ok();
    const s = document.createElement("script"); s.src = src; s.async = true;
    s.onload = () => { s.dataset.geladen = "1"; ok(); }; s.onerror = () => fout(new Error("Kon " + src + " niet laden"));
    document.head.appendChild(s);
  });
}

// Scripts vooraf laden: een inlog-popup moet direct bij de klik openen, anders blokkeert de browser hem
export function voorbereiden() {
  if (ids().google) googleClient().catch(() => {});
  if (ids().microsoft) msClient().catch(() => {});
}

// ================= Google =================
let gClient = null, gWacht = null;
async function googleClient() {
  if (gClient) return gClient;
  await laadScript("https://accounts.google.com/gsi/client");
  gClient = google.accounts.oauth2.initTokenClient({
    client_id: ids().google, scope: scopesVoor(G_SCOPES, ["agenda"]).join(" "), include_granted_scopes: true,
    callback: (r) => gWacht?.(r),
    error_callback: (e) => gWacht?.({ error: e?.type === "popup_closed" ? "Venster gesloten" : (e?.message || e?.type || "Inloggen mislukt") }),
  });
  return gClient;
}
function vraagGoogleToken(opties) {
  if (!ids().google) return Promise.reject(new Error("Google-koppeling is nog niet ingesteld (client-ID ontbreekt)"));
  if (!gClient) { googleClient(); return Promise.reject(new Error("Google wordt nog geladen — klik nog een keer")); }
  return new Promise((ok, fout) => {
    gWacht = (r) => { gWacht = null; r.error ? fout(new Error(r.error_description || r.error)) : ok(r); };
    gClient.requestAccessToken(opties);   // opent de popup: moet synchroon binnen de klik gebeuren
  });
}
function bewaarToken(v, r) { v.token = r.access_token; v.verloopt = Date.now() + (r.expires_in - 120) * 1000; }

/** Koppelt een Google-account voor de gevraagde doelen (["agenda"], ["schijf"] of beide). Bestaande doelen blijven behouden. */
export async function koppelGoogle(doelen = ["agenda"]) {
  const r = await vraagGoogleToken({ prompt: "select_account", scope: scopesVoor(G_SCOPES, doelen).join(" ") });
  const info = await (await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + r.access_token } })).json();
  const oud = verbindingen().find(x => x.id === "google:" + info.email);
  // include_granted_scopes: het token bevat ook eerder gegeven toestemmingen — kijk wat er nu werkelijk mag
  const mag = (d) => G_SCOPES[d].every(s => google.accounts.oauth2.hasGrantedAllScopes(r, s));
  const nu = [...new Set([...(oud ? doelenVan(oud) : []), ...doelen])].filter(mag);
  const v = { ...(oud || {}), id: "google:" + info.email, soort: "google", email: info.email, naam: info.name || info.email, foto: info.picture || "",
              primair: oud?.primair ?? !primair(), doelen: nu, rechten: { agenda: nu.includes("agenda") } };
  bewaarToken(v, r);
  werkV(v);
  const geweigerd = doelen.filter(d => !nu.includes(d));
  if (geweigerd.length) throw new Error(`Je hebt geen toestemming gegeven voor ${geweigerd.map(d => DOELNAAM[d] || d).join(" en ")}. Probeer opnieuw en vink het aan.`);
  return v;
}
export async function vernieuw(v) {
  if (v.soort === "ms") { await msToken(v, true); return v; }
  const r = await vraagGoogleToken({ prompt: "", hint: v.email, login_hint: v.email, scope: scopesVoor(G_SCOPES, doelenVan(v)).join(" ") });
  bewaarToken(v, r); return werkV(v);
}

// ================= Microsoft =================
let msal = null;
async function msClient() {
  if (msal) return msal;
  await laadScript(MSAL_URL);
  const pca = new window.msal.PublicClientApplication({
    auth: { clientId: ids().microsoft, authority: "https://login.microsoftonline.com/common", redirectUri: new URL("auth.html", location.href).href },
    cache: { cacheLocation: "localStorage" },
  });
  await pca.initialize();
  msal = pca; return pca;
}
/** Koppelt een Microsoft-account (werk/school of persoonlijk) voor de gevraagde doelen. Bestaande doelen blijven behouden. */
export async function koppelMs(doelen = ["agenda"]) {
  if (!ids().microsoft) throw new Error("Microsoft-koppeling is nog niet ingesteld (client-ID ontbreekt)");
  if (!msal) { msClient(); throw new Error("Microsoft wordt nog geladen — klik nog een keer"); }
  const r = await msal.loginPopup({ scopes: M_SCOPES.basis.concat(doelen.flatMap(d => M_SCOPES[d])), prompt: "select_account" });
  const a = r.account, id = "ms:" + a.username.toLowerCase(), oud = verbindingen().find(x => x.id === id);
  return werkV({ ...(oud || {}), id, soort: "ms", email: a.username, naam: a.name || a.username, homeAccountId: a.homeAccountId, primair: false,
                 doelen: [...new Set([...(oud ? doelenVan(oud) : []), ...doelen])] });
}
async function msToken(v, interactief = false) {
  const pca = await msClient();
  let account = pca.getAccountByHomeId(v.homeAccountId);
  if (!account && interactief) {          // gekoppeld op een ander apparaat of met een ander account: hier één keer aanmelden
    const r = await pca.loginPopup({ scopes: scopesVoor(M_SCOPES, doelenVan(v)), loginHint: v.email, prompt: "select_account" });
    account = r.account; werkV({ ...v, homeAccountId: account.homeAccountId });
    return r.accessToken;
  }
  if (!account) throw new VerlopenFout(v);
  const scopes = scopesVoor(M_SCOPES, doelenVan(v));
  try { return (await pca.acquireTokenSilent({ scopes, account })).accessToken; }
  catch (e) {
    if (!interactief) throw new VerlopenFout(v);
    return (await pca.acquireTokenPopup({ scopes, account })).accessToken;
  }
}
/** Haalt één doel weg van een koppeling; zonder doelen wordt de koppeling helemaal verbroken. */
export async function zonderDoel(v, doel) {
  const rest = doelenVan(v).filter(d => d !== doel);
  if (!rest.length) return ontkoppel(v);
  werkV({ ...v, doelen: rest, rechten: { agenda: rest.includes("agenda") } });
}

export async function ontkoppel(v) {
  try {
    if (v.soort === "google" && v.token && window.google?.accounts) google.accounts.oauth2.revoke(v.token, () => {});
    if (v.soort === "ms") { const pca = await msClient(); const a = pca.getAccountByHomeId(v.homeAccountId); if (a) await pca.clearCache({ account: a }); }
  } catch {}
  let l = verbindingen().filter(x => x.id !== v.id);
  if (v.primair) { const g = l.find(x => x.soort === "google"); if (g) g.primair = true; }
  bewaarV(l);
}
export function maakPrimair(v) { bewaarV(verbindingen().map(x => ({ ...x, primair: x.id === v.id }))); }

// ================= API-aanroepen =================
export async function api(v, url, opties = {}) {
  let token;
  if (v.soort === "google") { if (isVerlopen(v)) throw new VerlopenFout(v); token = v.token; }
  else token = await msToken(v);
  const headers = { Authorization: "Bearer " + token, ...(opties.headers || {}) };
  if (typeof opties.body === "string" && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const r = await fetch(url, { ...opties, headers });
  if (r.status === 401) { if (v.soort === "google") werkV({ ...v, verloopt: 0 }); throw new VerlopenFout(v); }
  if ((r.status === 404 || r.status === 410) && opties.weg) return null;
  if (!r.ok) { const f = new Error(`${v.soort === "ms" ? "Microsoft" : "Google"} ${r.status}: ${(await r.text()).slice(0, 180)}`); f.status = r.status; throw f; }
  if (r.status === 204 || opties.tekst) return opties.tekst ? r.text() : null;
  return r.json();
}
const G = "https://www.googleapis.com/calendar/v3", M = "https://graph.microsoft.com/v1.0";
const enc = encodeURIComponent;

/** Agenda's van een account: [{id, naam, kleur, primair, schrijf}] */
export async function agendaLijst(v) {
  if (v.soort === "google") {
    const r = await api(v, `${G}/users/me/calendarList?minAccessRole=reader&maxResults=250`);
    return (r.items || []).map(c => ({ id: c.id, naam: c.summaryOverride || c.summary, kleur: c.backgroundColor || "#888",
      primair: !!c.primary, schrijf: c.accessRole === "owner" || c.accessRole === "writer",
      info: /#(holiday|contacts|weeknum)@/.test(c.id) }));
  }
  const r = await api(v, `${M}/me/calendars?$top=100&$select=id,name,hexColor,canEdit,isDefaultCalendar`);
  return (r.value || []).map(c => ({ id: c.id, naam: c.name, kleur: c.hexColor || "#6f9fd8", primair: !!c.isDefaultCalendar, schrijf: !!c.canEdit,
    info: /verjaardag|birthday|feestdag|holiday/i.test(c.name) }));
}

// Kleuren van losse afspraken, zoals je ze in Google of Outlook hebt gegeven
const OUTLOOK_KLEUR = ["#d13438", "#ca5010", "#8e562e", "#c19c00", "#498205", "#038387", "#7a7a00", "#0078d4", "#8764b8", "#a4262c", "#69797e", "#4a5459", "#7a7574",
  "#5d5a58", "#393939", "#750b1c", "#8e4002", "#5c2e10", "#986f0b", "#0b6a0b", "#005b70", "#4b5320", "#004e8c", "#5c2e91", "#6e0811"];
const kleurCache = new Map();
async function afspraakKleuren(v) {
  if (kleurCache.has(v.id)) return kleurCache.get(v.id);
  let k = {};
  try {
    if (v.soort === "google") { const r = await api(v, `${G}/colors`); k = Object.fromEntries(Object.entries(r.event || {}).map(([id, c]) => [id, c.background])); }
    else { const r = await api(v, `${M}/me/outlook/masterCategories`); k = Object.fromEntries((r.value || []).map(c => [c.displayName, OUTLOOK_KLEUR[+String(c.color).replace("preset", "")] || ""]).filter(([, x]) => x)); }
  } catch (e) { if (e instanceof VerlopenFout) throw e; }   // zonder kleuren gaat het ook
  kleurCache.set(v.id, k); return k;
}

/** Afspraken in [van, tot): [{extId, start, eind, titel, plaats, eigen, kleur}] — herhalingen uitgeklapt, hele-dag-items overgeslagen */
export async function haalAfspraken(v, agendaId, van, tot) {
  const uit = [], kleuren = await afspraakKleuren(v);
  if (v.soort === "google") {
    let pagina = "";
    do {
      const r = await api(v, `${G}/calendars/${enc(agendaId)}/events?singleEvents=true&orderBy=startTime&maxResults=2500` +
        `&timeMin=${enc(van.toISOString())}&timeMax=${enc(tot.toISOString())}` + (pagina ? `&pageToken=${enc(pagina)}` : ""));
      for (const e of r.items || []) {
        if (e.status === "cancelled" || !e.start?.dateTime) continue;
        if (e.transparency === "transparent") continue;          // staat op "beschikbaar"
        if ((e.attendees || []).some(a => a.self && a.responseStatus === "declined")) continue;
        uit.push({ extId: e.id, start: new Date(e.start.dateTime).toISOString(), eind: new Date(e.end.dateTime).toISOString(),
                   titel: e.summary || "Bezet", plaats: e.location || "", eigen: !!e.extendedProperties?.private?.tijdkompas, kleur: (e.colorId && kleuren[e.colorId]) || "" });
      }
      pagina = r.nextPageToken;
    } while (pagina);
    return uit;
  }
  let url = `${M}/me/calendars/${enc(agendaId)}/calendarView?startDateTime=${enc(van.toISOString())}&endDateTime=${enc(tot.toISOString())}` +
            `&$top=500&$select=id,subject,start,end,showAs,isAllDay,isCancelled,location,categories`;
  while (url) {
    const r = await api(v, url, { headers: { Prefer: 'outlook.timezone="UTC"' } });
    for (const e of r.value || []) {
      if (e.isAllDay || e.isCancelled || e.showAs === "free") continue;
      uit.push({ extId: e.id, start: new Date(e.start.dateTime.replace(/Z?$/, "Z")).toISOString(), eind: new Date(e.end.dateTime.replace(/Z?$/, "Z")).toISOString(),
                 titel: e.subject || "Bezet", plaats: e.location?.displayName || "", eigen: (e.categories || []).includes("Tijdkompas"),
                 kleur: (e.categories || []).map(c => kleuren[c]).find(Boolean) || "" });
    }
    url = r["@odata.nextLink"] || "";
  }
  return uit;
}

/** Afspraak aanmaken of bijwerken; geeft het id in de externe agenda terug */
export async function zetAfspraak(v, agendaId, ev, bestaandId) {
  if (v.soort === "google") {
    const body = JSON.stringify({ summary: ev.titel, description: ev.omschrijving, location: ev.plaats || undefined,
      start: { dateTime: ev.start }, end: { dateTime: ev.eind }, extendedProperties: { private: { tijdkompas: ev.tkId } } });
    if (bestaandId) {
      const r = await api(v, `${G}/calendars/${enc(agendaId)}/events/${enc(bestaandId)}`, { method: "PATCH", body, weg: true });
      if (r) return r.id;
    }
    return (await api(v, `${G}/calendars/${enc(agendaId)}/events`, { method: "POST", body })).id;
  }
  const utc = (iso) => new Date(iso).toISOString().slice(0, 19);
  const body = JSON.stringify({ subject: ev.titel, body: { contentType: "text", content: ev.omschrijving },
    start: { dateTime: utc(ev.start), timeZone: "UTC" }, end: { dateTime: utc(ev.eind), timeZone: "UTC" },
    location: ev.plaats ? { displayName: ev.plaats } : undefined, categories: ["Tijdkompas"], isReminderOn: false });
  if (bestaandId) {
    const r = await api(v, `${M}/me/events/${enc(bestaandId)}`, { method: "PATCH", body, weg: true });
    if (r) return r.id;
  }
  return (await api(v, `${M}/me/calendars/${enc(agendaId)}/events`, { method: "POST", body })).id;
}
export async function verwijderAfspraak(v, agendaId, id) {
  if (v.soort === "google") await api(v, `${G}/calendars/${enc(agendaId)}/events/${enc(id)}`, { method: "DELETE", weg: true });
  else await api(v, `${M}/me/events/${enc(id)}`, { method: "DELETE", weg: true });
}

// ================= Takenlijsten: Google Taken en Microsoft To Do (Outlook-taken) =================
const GT = "https://tasks.googleapis.com/tasks/v1";
const datum = (x) => (x ? String(x).slice(0, 10) : "");
const zonderHtml = (s) => String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

/** Takenlijsten van een account: [{id, naam, standaard}] */
export async function takenlijsten(v) {
  if (v.soort === "google") {
    const r = await api(v, `${GT}/users/@me/lists?maxResults=100`);
    return (r.items || []).map((l, i) => ({ id: l.id, naam: l.title, standaard: i === 0 }));   // de eerste is je standaardlijst
  }
  const uit = [];
  let url = `${M}/me/todo/lists?$top=100`;
  while (url) { const r = await api(v, url); for (const l of r.value || []) uit.push({ id: l.id, naam: l.displayName, standaard: l.wellknownListName === "defaultList", gemarkeerd: l.wellknownListName === "flaggedEmails" }); url = r["@odata.nextLink"] || ""; }
  return uit;
}

/** Taken in een lijst: [{id, titel, notitie, deadline "JJJJ-MM-DD", klaar, klaarOp}] */
export async function haalTaken(v, lijstId) {
  const uit = [];
  if (v.soort === "google") {
    let pagina = "";
    do {
      const r = await api(v, `${GT}/lists/${enc(lijstId)}/tasks?showCompleted=true&showHidden=true&maxResults=100` + (pagina ? `&pageToken=${enc(pagina)}` : ""));
      for (const t of r.items || []) {
        if (t.deleted) continue;
        uit.push({ id: t.id, titel: t.title || "", notitie: t.notes || "", deadline: datum(t.due), klaar: t.status === "completed", klaarOp: t.completed || "", parent: t.parent || "" });
      }
      pagina = r.nextPageToken;
    } while (pagina);
    return uit;
  }
  let url = `${M}/me/todo/lists/${enc(lijstId)}/tasks?$top=100`;
  while (url) {
    const r = await api(v, url);
    for (const t of r.value || []) uit.push({ id: t.id, titel: t.title || "", notitie: t.body?.contentType === "html" ? zonderHtml(t.body.content) : (t.body?.content || "").trim(),
      deadline: datum(t.dueDateTime?.dateTime), klaar: t.status === "completed", ster: t.importance === "high",
      klaarOp: t.completedDateTime?.dateTime ? new Date(t.completedDateTime.dateTime.replace(/Z?$/, "Z")).toISOString() : "" });
    url = r["@odata.nextLink"] || "";
  }
  return uit;
}

/**
 * Taak aanmaken of bijwerken; geeft het externe id terug.
 * t = {titel, notitie, deadline, klaar, parent?} (Google: parent = bovenliggende taak, zo worden projecten taken met subtaken)
 *   of {…, ster} (Microsoft: ster = "belangrijk" in To Do).
 */
export async function zetTaak(v, lijstId, t, bestaandId) {
  if (v.soort === "google") {
    const body = JSON.stringify({ title: t.titel, notes: t.notitie || "", due: t.deadline ? t.deadline + "T00:00:00.000Z" : null,
      status: t.klaar ? "completed" : "needsAction", ...(t.klaar ? {} : { completed: null }) });
    if (bestaandId) { const r = await api(v, `${GT}/lists/${enc(lijstId)}/tasks/${enc(bestaandId)}`, { method: "PATCH", body, weg: true }); if (r) return r.id; }
    return (await api(v, `${GT}/lists/${enc(lijstId)}/tasks` + (t.parent ? `?parent=${enc(t.parent)}` : ""), { method: "POST", body })).id;
  }
  const body = JSON.stringify({ title: t.titel, body: { content: t.notitie || "", contentType: "text" }, importance: t.ster ? "high" : "normal",
    dueDateTime: t.deadline ? { dateTime: t.deadline + "T00:00:00", timeZone: "UTC" } : null, status: t.klaar ? "completed" : "notStarted" });
  if (bestaandId) { const r = await api(v, `${M}/me/todo/lists/${enc(lijstId)}/tasks/${enc(bestaandId)}`, { method: "PATCH", body, weg: true }); if (r) return r.id; }
  return (await api(v, `${M}/me/todo/lists/${enc(lijstId)}/tasks`, { method: "POST", body })).id;
}
/** Google: taak onder een andere taak hangen (parent "" = bovenste niveau) */
export async function verplaatsTaak(v, lijstId, id, parent) {
  if (v.soort !== "google") return;
  await api(v, `${GT}/lists/${enc(lijstId)}/tasks/${enc(id)}/move` + (parent ? `?parent=${enc(parent)}` : ""), { method: "POST" });
}
export async function verwijderTaak(v, lijstId, id) {
  if (v.soort === "google") await api(v, `${GT}/lists/${enc(lijstId)}/tasks/${enc(id)}`, { method: "DELETE", weg: true });
  else await api(v, `${M}/me/todo/lists/${enc(lijstId)}/tasks/${enc(id)}`, { method: "DELETE", weg: true });
}
