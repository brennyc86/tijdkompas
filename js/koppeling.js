// Tijdkompas — koppelingen met Google (inloggen, Agenda, Drive) en Microsoft (Outlook-agenda)
// Alles draait in de browser: Google Identity Services (token-client) en MSAL.js (Microsoft).
// Er is geen eigen server; tokens blijven op dit apparaat.
import { CONFIG } from "./config.js";

const GOOGLE_SCOPES = [
  "openid", "email", "profile",
  "https://www.googleapis.com/auth/calendar.readonly",   // agenda's + afspraken lezen
  "https://www.googleapis.com/auth/calendar.events",     // ingeplande blokken wegschrijven
  "https://www.googleapis.com/auth/drive.appdata",       // eigen planning in verborgen app-map van je Drive
].join(" ");
const MS_SCOPES = ["User.Read", "Calendars.ReadWrite"];
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
const VSLEUTEL = "tk_verbindingen";
export function verbindingen() { try { return JSON.parse(localStorage.getItem(VSLEUTEL) || "[]"); } catch { return []; } }
function bewaarV(lijst) { try { localStorage.setItem(VSLEUTEL, JSON.stringify(lijst)); } catch {} }
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
    client_id: ids().google, scope: GOOGLE_SCOPES, include_granted_scopes: true,
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

export async function koppelGoogle() {
  const r = await vraagGoogleToken({ prompt: "select_account" });
  const info = await (await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: "Bearer " + r.access_token } })).json();
  const agenda = google.accounts.oauth2.hasGrantedAllScopes(r, "https://www.googleapis.com/auth/calendar.events");
  const drive = google.accounts.oauth2.hasGrantedAllScopes(r, "https://www.googleapis.com/auth/drive.appdata");
  const v = { id: "google:" + info.email, soort: "google", email: info.email, naam: info.name || info.email, foto: info.picture || "",
              primair: !primair() || primair()?.email === info.email, rechten: { agenda, drive } };
  bewaarToken(v, r);
  return werkV(v);
}
export async function vernieuw(v) {
  if (v.soort === "ms") { await msToken(v, true); return v; }
  const r = await vraagGoogleToken({ prompt: "", hint: v.email, login_hint: v.email });
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
export async function koppelMs() {
  if (!ids().microsoft) throw new Error("Outlook-koppeling is nog niet ingesteld (client-ID ontbreekt)");
  if (!msal) { msClient(); throw new Error("Microsoft wordt nog geladen — klik nog een keer"); }
  const r = await msal.loginPopup({ scopes: MS_SCOPES, prompt: "select_account" });
  const a = r.account;
  return werkV({ id: "ms:" + a.username.toLowerCase(), soort: "ms", email: a.username, naam: a.name || a.username, homeAccountId: a.homeAccountId, primair: false });
}
async function msToken(v, interactief = false) {
  const pca = await msClient();
  const account = pca.getAccountByHomeId(v.homeAccountId);
  if (!account) throw new VerlopenFout(v);
  try { return (await pca.acquireTokenSilent({ scopes: MS_SCOPES, account })).accessToken; }
  catch (e) {
    if (!interactief) throw new VerlopenFout(v);
    return (await pca.acquireTokenPopup({ scopes: MS_SCOPES, account })).accessToken;
  }
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
async function api(v, url, opties = {}) {
  let token;
  if (v.soort === "google") { if (isVerlopen(v)) throw new VerlopenFout(v); token = v.token; }
  else token = await msToken(v);
  const headers = { Authorization: "Bearer " + token, ...(opties.headers || {}) };
  if (typeof opties.body === "string" && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const r = await fetch(url, { ...opties, headers });
  if (r.status === 401) { if (v.soort === "google") werkV({ ...v, verloopt: 0 }); throw new VerlopenFout(v); }
  if ((r.status === 404 || r.status === 410) && opties.weg) return null;
  if (!r.ok) throw new Error(`${v.soort === "ms" ? "Outlook" : "Google"} ${r.status}: ${(await r.text()).slice(0, 180)}`);
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

/** Afspraken in [van, tot): [{extId, start, eind, titel, plaats, eigen}] — herhalingen uitgeklapt, hele-dag-items overgeslagen */
export async function haalAfspraken(v, agendaId, van, tot) {
  const uit = [];
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
                   titel: e.summary || "Bezet", plaats: e.location || "", eigen: !!e.extendedProperties?.private?.tijdkompas });
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
                 titel: e.subject || "Bezet", plaats: e.location?.displayName || "", eigen: (e.categories || []).includes("Tijdkompas") });
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

// ================= Google Drive (verborgen app-map) =================
const DRIVE = "https://www.googleapis.com/drive/v3", UPLOAD = "https://www.googleapis.com/upload/drive/v3";
export async function driveLees(v) {
  const r = await api(v, `${DRIVE}/files?spaces=appDataFolder&q=${enc("name='tijdkompas.json'")}&fields=files(id,modifiedTime)`);
  const f = (r.files || [])[0];
  if (!f) return null;
  const tekst = await api(v, `${DRIVE}/files/${f.id}?alt=media`, { tekst: true });
  return { id: f.id, data: JSON.parse(tekst) };
}
export async function driveSchrijf(v, data, id) {
  const json = JSON.stringify(data);
  if (id) {
    const r = await api(v, `${UPLOAD}/files/${id}?uploadType=media`, { method: "PATCH", body: json, weg: true });
    if (r) return r.id || id;
  }
  const grens = "tk" + Math.random().toString(36).slice(2);
  const body = `--${grens}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: "tijdkompas.json", parents: ["appDataFolder"], mimeType: "application/json" }) +
    `\r\n--${grens}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${grens}--`;
  const r = await api(v, `${UPLOAD}/files?uploadType=multipart&fields=id`, { method: "POST", body, headers: { "Content-Type": "multipart/related; boundary=" + grens } });
  return r.id;
}
