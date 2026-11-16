// Tijdkompas — veiligheidstest: geen code van anderen in de pagina (XSS), geen ongecontroleerde scripts.
// Draai met:  cd tests && npm install && node veiligheid.mjs
//
// 1. Statisch: CSP aanwezig en streng, geen inline event-handlers, MSAL-bestand hoort bij de SRI-hash.
// 2. Dynamisch: de app krijgt "vijandige" gegevens (zoals een kwaadwillende in een gedeelde lijst zou kunnen schrijven)
//    en elk scherm, elke instellingen-tab en elk venster wordt getekend. Daarna mag er nergens een element, attribuut
//    of link uit die gegevens in de pagina staan.
import { parseHTML } from "linkedom";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fouten = [];
const fout = (x) => { fouten.push(x); };

// ---------- 1. statisch ----------
const html = fs.readFileSync(ROOT + "/index.html", "utf8");
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] || "";
if (!csp) fout("index.html: geen Content-Security-Policy");
const scriptSrc = csp.match(/script-src([^;]*)/)?.[1] || "";
if (!scriptSrc) fout("CSP: geen script-src");
if (/unsafe-inline|unsafe-eval|\*|data:|http:/.test(scriptSrc)) fout("CSP: script-src is te ruim: " + scriptSrc);
if (!/object-src 'none'/.test(csp)) fout("CSP: object-src 'none' ontbreekt");
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fout("index.html: inline <script>");
for (const f of fs.readdirSync(ROOT + "/js").filter(f => f.endsWith(".js"))) {
  const s = fs.readFileSync(ROOT + "/js/" + f, "utf8");
  const m = s.match(/<[a-z][^<>`]*\son[a-z]+=["'\\$]/i);
  if (m) fout(`js/${f}: inline event-handler in HTML: ${m[0].slice(0, 80)}`);
  if (/https:\/\/cdn\.jsdelivr|unpkg\.com|cdnjs/.test(s)) fout(`js/${f}: laadt code van een openbare CDN`);
}
const kop = fs.readFileSync(ROOT + "/js/koppeling.js", "utf8");
const sri = kop.match(/MSAL_SRI = "(sha384-[^"]+)"/)?.[1];
const msalPad = kop.match(/new URL\("(vendor\/[^"]+)"/)?.[1];
if (!sri || !msalPad) fout("koppeling.js: MSAL zonder vaste hash (SRI)");
else {
  const echt = "sha384-" + crypto.createHash("sha384").update(fs.readFileSync(ROOT + "/js/" + msalPad)).digest("base64");
  if (echt !== sri) fout(`MSAL-bestand past niet bij de hash: ${echt} ≠ ${sri}`);
}

// Service worker: nooit foutpagina's of doorverwijzingen in de cache
const sw = fs.readFileSync(ROOT + "/sw.js", "utf8");
if (!/r\.ok && r\.type === "basic"/.test(sw)) fout("sw.js: bewaart ook mislukte antwoorden in de cache");
// Doorgeefluik: niets bewaren, alleen Tijdkompas zelf
const wk = fs.readFileSync(ROOT + "/worker/agenda-doorgeef.js", "utf8").replace(/\/\/.*$/gm, "");
if (/cacheTtl|max-age=[1-9]/.test(wk)) fout("doorgeefluik: agenda's worden tijdelijk bewaard (cache)");
if (!/no-store/.test(wk)) fout("doorgeefluik: geen Cache-Control: no-store");
if (!/HERKOMST\.includes\(origin\)\)\s*return new Response\("Niet toegestaan", \{ status: 403/.test(wk)) fout("doorgeefluik: beantwoordt ook andere sites");
// Firestore-regels: uitnodigingen en koppelcodes alleen met een gecontroleerd e-mailadres
const regels = fs.readFileSync(ROOT + "/firestore.rules", "utf8");
for (const f of ["uitgenodigd", "muitgenodigd"]) if (!new RegExp(`function ${f}\\(\\) \\{[^}]*geverifieerd\\(\\)`).test(regels)) fout(`firestore.rules: ${f}() controleert het e-mailadres niet`);
if (!/email_verified/.test(regels)) fout("firestore.rules: email_verified wordt nergens gecontroleerd");
if (/hasOnly\(\['uid', 'email', 'naam'/.test(regels)) fout("firestore.rules: koppelcode met zelfgekozen naam");

// ---------- 2. dynamisch ----------
const P = `"'><xss-x data-xss="1" onmouseover="alert(1)">`;
const vijand = {
  versie: 2, demo: false,
  overzichten: [
    { id: "goed", naam: "Lijst " + P, icoon: `<img src=x onerror=alert(1)>`, kleur: `red;}"><xss-k data-xss=1>`, modus: "vast",
      tijden: [{ dagen: [1], van: `09:00"><xss-t>`, tot: "17:00" }, { dagen: [2], van: "09:00", tot: "17:00", locatie: "kantoor" }],
      eigenaar: "anderUid", leden: ["anderUid", "derde"], ledenInfo: { anderUid: { naam: "Eigenaar " + P, email: P, foto: "javascript:alert(1)" }, derde: { naam: P, email: "x@y.z", foto: `https://x/"><xss-f>` } },
      uitgenodigd: [P], mensen: [P], map: "m1" },
    { id: `slecht" onmouseover="alert(1)`, naam: "Weg", icoon: "📋", kleur: "#fff" },
  ],
  mappen: [{ id: "m1", naam: "Map " + P, icoon: P, kleur: P, ouder: "" }, { id: `m2"><xss-m>`, naam: "x", icoon: "📁", kleur: "#fff" }],
  projecten: [{ id: "p1", type: "project", overzicht: "goed", titel: "Project " + P, notitie: P, status: "open", deadline: P }],
  taken: [
    { id: "t1", type: "taak", overzicht: "goed", project: "p1", titel: "Taak " + P, notitie: P, status: "open", deadline: `2026-12-01"><xss-d>`, streef: P,
      schatting: P, links: [{ url: "javascript:alert(1)", label: P }, { url: `https://ok.nl/"><xss-l>`, label: "ok" }], wie: [P, "~" + P, "anderUid"], wachtOp: [P] },
    { id: "t2", type: "taak", overzicht: "goed", titel: P, status: "klaar", klaarOp: "2026-11-10T10:00:00Z", werkelijk: 30, wie: [] },
    { id: `t3"><xss-i>`, type: "taak", overzicht: "goed", titel: "weg", status: "open" },
  ],
  koers: [{ id: "k1", titel: "Koers " + P, toelichting: P, trefwoorden: P, van: P, tot: "2026-12-31", status: P, evaluatie: P, taken: ["t1", "t2", P], nee: [], doel: { soort: "lijst", id: "goed" } }],
  locaties: [{ id: "thuis", naam: "Thuis " + P, icoon: P, reistijd: 0 }, { id: "kantoor", naam: P, icoon: "🏢", reistijd: 20 }],
  bezet: [{ id: "e1", titel: "Afspraak " + P, plaats: P, start: new Date(Date.now() + 3600e3).toISOString(), eind: new Date(Date.now() + 7200e3).toISOString(), kleur: P, bron: P }],
  planning: [{ id: "b1", item: "t1", overzicht: "goed", titel: "Blok " + P, start: new Date(Date.now() + 9000e3).toISOString(), eind: new Date(Date.now() + 12600e3).toISOString() }],
  agendaLinks: [{ id: "l1", naam: P, url: "https://outlook.live.com/x.ics", kleur: P }],
};

const { window, document } = parseHTML(html);
const mem = { tijdkompas_v1: JSON.stringify(vijand) };
// Sinds Node 21 zijn sommige globale waarden (navigator, crypto, …) alleen-lezen getters: overschrijf ze met defineProperty
const zet = (naam, waarde) => Object.defineProperty(globalThis, naam, { value: waarde, writable: true, configurable: true });
for (const [k, v] of Object.entries({
  window, document, location: new URL("https://brennyc86.github.io/tijdkompas/#vandaag"),
  history: { replaceState() {} }, navigator: {}, matchMedia: () => ({ matches: false }),
  localStorage: { getItem: k => mem[k] ?? null, setItem: (k, v) => mem[k] = String(v), removeItem: k => delete mem[k] },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  scrollY: 0, scrollTo() {}, confirm: () => false, alert() {}, prompt: () => "",
  structuredClone: globalThis.structuredClone, HTMLElement: window.HTMLElement,
})) zet(k, v);
window.top = window.self = window;
globalThis.addEventListener = () => {}; globalThis.setInterval = () => 0;
window.HTMLElement.prototype.showModal = function () { this.open = true; };
window.HTMLElement.prototype.close = function (v) { this.open = false; if (v !== undefined) this.returnValue = v; this.onclose?.(); };
document.elementsFromPoint = () => [];
const FP = Object.getPrototypeOf(document.createElement("form"));
for (const n of ["titel", "overzicht", "notitie", "deadline", "streef", "locatie", "schatting", "werkelijk", "project", "klaarOp"])
  Object.defineProperty(FP, n, { get() { return this.querySelector(`[name=${n}]`) || undefined; }, configurable: true });
process.on("unhandledRejection", e => fout("onverwacht: " + e.message));

// Controle van de hele pagina: elementen, attributen en links die uit de vijandige gegevens komen
function controleer(waar) {
  for (const el of document.querySelectorAll("*")) {
    const tag = el.tagName.toLowerCase();
    if (tag.startsWith("xss")) fout(`${waar}: element <${tag}> uit gegevens in de pagina`);
    for (const a of el.attributes || []) {
      if (/^on/i.test(a.name)) fout(`${waar}: event-attribuut ${a.name} op <${tag}>`);
      if (a.name === "data-xss") fout(`${waar}: attribuut uit gegevens op <${tag}>`);
      if ((a.name === "href" || a.name === "src") && /^\s*(javascript|data|vbscript):/i.test(a.value) && !el.classList?.contains("bookmarklet"))
        fout(`${waar}: gevaarlijke link ${a.value.slice(0, 40)} op <${tag}>`);
    }
  }
}

await import(ROOT + "/js/app.js");
const { opslag, bewaar } = await import(ROOT + "/js/data.js");
const main = document.querySelector("#main");
const D = opslag.d;
if (D.overzichten.some(o => o.id.includes('"'))) fout("lijst met onveilige id niet weggefilterd");
if (D.taken.some(t => t.id.includes('"'))) fout("taak met onveilige id niet weggefilterd");
if (D.overzichten[0]?.kleur !== "#8a978e") fout("onveilige kleur niet vervangen");
if (D.taken.find(t => t.id === "t1")?.links?.some(l => /^javascript/i.test(l.url))) fout("javascript:-link niet weggehaald");

function allesTekenen(ronde) {
  for (const v of ["vandaag", "matrix", "projecten", "taken", "agenda", "inzicht", "koers", "instellingen"]) {
    globalThis.location.hash = "#" + v;
    try { bewaar(); } catch (e) { fout(`${ronde}/${v}: ${e.message}`); }
    controleer(`${ronde}/${v}`);
  }
  for (const t of ["lijsten", "locaties", "koppelingen", "overig"]) {
    localStorage.setItem("tk_instTab", JSON.stringify(t));
    globalThis.location.hash = "#instellingen";
    try { bewaar(); } catch (e) { fout(`${ronde}/inst-${t}: ${e.message}`); }
    controleer(`${ronde}/inst-${t}`);
  }
  // vensters: taak, project, koersafspraak, lijstinstellingen, account
  globalThis.location.hash = "#taken"; bewaar();
  for (const id of ["t1", "t2"]) {
    const rij = main.querySelector(`.item[data-id="${id}"]`);
    try { rij?.dispatchEvent(new window.Event("click", { bubbles: true })); } catch (e) { fout(`${ronde}/editor ${id}: ${e.message}`); }
    controleer(`${ronde}/editor ${id}`);
    document.querySelector("#dlg").close?.("");
  }
  globalThis.location.hash = "#koers"; bewaar();
  for (const sel of ["[data-afspraak]", "[data-actie=koersRapport]"]) {
    try { main.querySelector(sel)?.dispatchEvent(new window.Event("click", { bubbles: true })); } catch (e) { fout(`${ronde}/${sel}: ${e.message}`); }
    controleer(`${ronde}/koers ${sel}`);
    document.querySelector("#dlg").close?.("");
  }
  for (const k of document.querySelectorAll("#ovChips [data-ov], #ovChips [data-menu]")) {
    try { k.dispatchEvent(new window.Event("click", { bubbles: true })); } catch {}
  }
  controleer(`${ronde}/chips`);
  const inst = document.querySelector("#ovChips [data-inst]");
  try { inst?.dispatchEvent(new window.Event("click", { bubbles: true })); } catch (e) { fout(`${ronde}/inst-venster: ${e.message}`); }
  controleer(`${ronde}/inst-venster`);
  try { document.querySelector("#accountKnop").dispatchEvent(new window.Event("click", { bubbles: true })); } catch (e) { fout(`${ronde}/account: ${e.message}`); }
  controleer(`${ronde}/account`);
}

// Ronde 1: zoals binnengekomen (na de filter)
allesTekenen("na filter");
// Ronde 2: de filter overgeslagen (tweede laag: elk veld moet bij het tonen óók veilig zijn).
// Id's niet: die zijn alleen geldig na de filter (en de Firestore-regels).
const o = D.overzichten[0];
Object.assign(o, { naam: P, icoon: P, kleur: P });
for (const m of D.mappen) Object.assign(m, { naam: P, icoon: P, kleur: P });
for (const t of [...D.taken, ...D.projecten]) Object.assign(t, { titel: P, notitie: P });
for (const l of D.locaties) Object.assign(l, { naam: P, icoon: P });
for (const a of D.koers) Object.assign(a, { titel: P, toelichting: P, evaluatie: P });
for (const e of D.bezet) Object.assign(e, { titel: P, plaats: P, kleur: P });
for (const b of D.planning) Object.assign(b, { titel: P });
D.taken[0].links = [{ url: "javascript:alert(1)", label: P }];
const echtBewaar = bewaar;
allesTekenen("zonder filter");

console.log(fouten.length ? "ONVEILIG:\n- " + [...new Set(fouten)].join("\n- ") : "✓ veiligheidstest geslaagd");
process.exit(fouten.length ? 1 : 0);
