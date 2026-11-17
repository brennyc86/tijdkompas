// Tijdkompas — inloggen (Google / Microsoft) en online opslag met delen, via Firebase.
//
// Firestore-indeling:
//   gebruikers/{uid}                 persoonlijk: locaties, beschikbaarheid, instellingen, agenda's, planning,
//                                    plus per lijst je eigen manier van inplannen (lijstInst)
//   lijsten/{lijstId}                gedeeld: naam, kleur, icoon, eigenaar, leden[], ledenInfo{}, uitgenodigd[] (e-mails)
//   lijsten/{lijstId}/items/{id}     taken en projecten van die lijst (zichtbaar voor alle leden)
//   mappen/{mapId}                   gedeeld zoals lijsten: naam, icoon, kleur, ouder (indeling van de eigenaar), leden…
//   Waar een lijst of map bij jóu staat (map/ouder) is persoonlijk (lijstInst.map, mapInst.ouder); zonder eigen keuze
//   geldt de indeling van de eigenaar, zodat een gedeelde map bij de ander met dezelfde inhoud verschijnt.
//   Koers-afspraken (POP/PAP) zijn persoonlijk: gebruikers/{uid}.koers
//
// Gelinkte accounts (bijv. privé en werk): elk account blijft zelfstandig, met eigen koppelingen (agenda, taken, Drive),
// eigen planning en eigen kleuren. Door de link:
//   - staan alle gelinkte accounts in leden[] van elkaars lijsten en mappen (dat regelt de app): je ziet en bewerkt ze allemaal;
//   - mogen ze elkaars gebruikersdocument lezen, zodat je ook de agenda en planning van de ander ziet (gedimd).
//   gebruikers/{hoofd}.aliassen = [uid…]   gelinkte accounts (alleen het hoofd wijzigt dit)
//   gebruikers/{alias}.hoofd    = hoofd-uid, en gebruikers/{alias}.aliassen = [hoofd] (zodat het hoofd mag meelezen)
//
// Lijsten die in je eigen Drive/OneDrive staan (schijf.js) staan hier alleen als verwijzing in lijstInst
// (naam, icoon, kleur, welk account). Titels en plaatsen van agenda-afspraken, en titels van ingeplande blokken
// uit zulke lijsten, gaan niet naar de cloud: alleen tijden. Dit apparaat onthoudt de titels zelf.
//
// De app blijft werken met één object in het geheugen (opslag.d). Deze module vertaalt dat heen en weer:
// wijzigingen worden als verschil naar Firestore geschreven, en wijzigingen van anderen komen live binnen.
import { CONFIG } from "./config.js";
import { opslag, sessie, uid as nieuwId, startData, isIk, bewaar } from "./data.js";
import { aanvullen, haak, laadOntbrekende, vergeet } from "./schijf.js";
import { herkenLocatie, maakFeedIcs } from "./plan.js";
import { vingerafdruk } from "./sync.js";
import { veiligIcoon, veiligeKleur, veiligId } from "./veilig.js";
import { vergeetSleutels } from "./koppeling.js";

const B = "https://www.gstatic.com/firebasejs/10.14.1/";
let A = null, F = null, auth = null, db = null;
let tweede = null;   // { auth, db }: een tweede Firebase-app om een extra account toe te voegen zonder jezelf uit te loggen

export const cloud = { geladen: false, gebruiker: null, uitnodigingen: [], bezig: false, fout: "", melding: "", familieFout: new Map(),
                       familie: [], aliasInfo: {}, hoofdInfo: null, hoofdUid: null };   // familie: alle gelinkte uid's (incl. jij)
const familie = () => (cloud.familie.length ? cloud.familie : [sessie.ik]);
const authUid = () => cloud.gebruiker?.uid || sessie.ik;
const luisteraars = new Set();
export const opCloud = (f) => luisteraars.add(f);
const meld = () => luisteraars.forEach(f => { try { f(); } catch {} });
export const cloudIngesteld = () => !!CONFIG.firebase?.apiKey;
haak.ingelogd = () => !!cloud.gebruiker;
haak.herbouw = () => bouwStraks();

// Titels die bewust niet in de cloud staan, bewaard op dit apparaat
const TITELS = "tk_titels";
function leesTitels() { try { return JSON.parse(localStorage.getItem(TITELS) || "{}"); } catch { return {}; } }
function onthoudTitels(d) {
  const t = leesTitels(); t.bezet ||= {}; t.blok ||= {};
  for (const e of d.bezet || []) if (e.titel && e.titel !== "Bezet") t.bezet[e.id] = { titel: e.titel, plaats: e.plaats || "" };
  for (const b of d.planning || []) if (b.titel) t.blok[b.id] = b.titel;
  const nuB = new Set((d.bezet || []).map(e => e.id)), nuP = new Set((d.planning || []).map(b => b.id));
  for (const k of Object.keys(t.bezet)) if (!nuB.has(k)) delete t.bezet[k];
  for (const k of Object.keys(t.blok)) if (!nuP.has(k)) delete t.blok[k];
  try { localStorage.setItem(TITELS, JSON.stringify(t)); } catch {}
}

// ---------- opstarten ----------
export async function cloudStart(test) {
  if (test) { A = test.A; F = test.F; auth = test.auth; db = test.db; tweede = test.tweede || null; A.onAuthStateChanged(auth, (u) => (u ? aangemeld(u) : afgemeld())); cloud.geladen = true; return; }
  if (!cloudIngesteld() || auth) return;
  try {
    const [app, a, f] = await Promise.all([import(B + "firebase-app.js"), import(B + "firebase-auth.js"), import(B + "firebase-firestore.js")]);
    A = a; F = f;
    const fb = app.initializeApp(CONFIG.firebase);
    auth = a.getAuth(fb);
    try { db = f.initializeFirestore(fb, { localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) }); }
    catch { db = f.getFirestore(fb); }
    a.onAuthStateChanged(auth, (u) => (u ? aangemeld(u) : afgemeld()).catch(e => { cloud.fout = e.message; meld(); }));
    setTimeout(() => rondEmailLinkAf().catch(e => { cloud.fout = foutTekst(e); meld(); }), 0);
    // vooraf klaarzetten: de inlog-popup moet direct bij de klik openen
    try {
      const fb2 = app.initializeApp(CONFIG.firebase, "toevoegen");
      tweede = { auth: a.initializeAuth(fb2, { persistence: a.inMemoryPersistence, popupRedirectResolver: a.browserPopupRedirectResolver }), db: f.getFirestore(fb2) };
    } catch {}
  } catch (e) { cloud.fout = "Kon inlogdienst niet laden: " + e.message; }
  cloud.geladen = true; meld();
}

// ---------- inloggen ----------
function aanbieder(soort) {
  const p = soort === "google" ? new A.GoogleAuthProvider() : new A.OAuthProvider("microsoft.com");
  p.setCustomParameters({ prompt: "select_account" });
  return p;
}
export function foutTekst(e) {
  const c = e?.code || "";
  if (c.includes("popup-closed") || c.includes("cancelled-popup")) return "Inloggen afgebroken";
  if (c.includes("popup-blocked")) return "De browser blokkeerde het inlogvenster — sta pop-ups toe voor deze site";
  if (c.includes("account-exists-with-different-credential")) return "Dit e-mailadres hoort al bij een account met een andere inlogmethode. Log daarmee in en koppel dit account daarna.";
  if (c.includes("credential-already-in-use")) return "Dit account is al gebruikt voor een ander Tijdkompas-account.";
  if (c.includes("provider-already-linked")) return "Er is al een account van deze soort gekoppeld.";
  if (c.includes("operation-not-allowed")) return "Deze inlogmethode is nog niet aangezet.";
  if (c.includes("unauthorized-domain")) return "Deze website staat nog niet in de lijst met toegestane domeinen.";
  if (c.includes("invalid-action-code") || c.includes("expired-action-code")) return "Deze inloglink is verlopen of al gebruikt. Vraag een nieuwe aan.";
  if (c.includes("invalid-email")) return "Dat e-mailadres klopt niet helemaal.";
  if (c.includes("quota-exceeded")) return "Er zijn vandaag te veel inloglinks verstuurd. Probeer het morgen opnieuw.";
  if (c.includes("permission-denied")) return "Firebase weigert dit. Staan de nieuwste beveiligingsregels erin? (SETUP.md → Beveiligingsregels bijwerken)";
  return e?.message || String(e);
}
// Let op: de popup moet direct binnen de klik openen, daarom is alles vooraf geladen (cloudStart)
export function login(soort) {
  if (!auth) return Promise.reject(new Error(cloudIngesteld() ? "Even geduld, inloggen wordt nog geladen…" : "Inloggen is nog niet geactiveerd"));
  return A.signInWithPopup(auth, aanbieder(soort));
}
export function koppelAccount(soort) { return A.linkWithPopup(auth.currentUser, aanbieder(soort)); }

// ---------- inloggen met een link per e-mail (zonder wachtwoord, zonder Google/Microsoft) ----------
// We sturen een link naar het e-mailadres; wie erop klikt (in deze browser of een andere) is ingelogd.
// Met ?koppel=1 is de link bedoeld om dat adres als gelinkt account toe te voegen aan wie hier al is ingelogd.
const MAILSLEUTEL = "tk_inlogmail";
const terugUrl = (extra = "") => location.origin + location.pathname + "?emaillink=1" + extra;
export async function stuurInlogLink(email, { koppelen = false } = {}) {
  if (!auth) throw new Error(cloudIngesteld() ? "Even geduld, inloggen wordt nog geladen…" : "Inloggen is nog niet geactiveerd");
  email = String(email || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Vul een geldig e-mailadres in");
  await A.sendSignInLinkToEmail(auth, email, { url: terugUrl(koppelen ? "&koppel=1" : ""), handleCodeInApp: true });
  try { localStorage.setItem(MAILSLEUTEL, email); } catch {}
  return email;
}
// Bij het openen van de app via zo'n link: inloggen (of koppelen) afmaken
async function rondEmailLinkAf() {
  const url = location.href;
  if (!A.isSignInWithEmailLink(auth, url)) return;
  let email = ""; try { email = localStorage.getItem(MAILSLEUTEL) || ""; } catch {}
  if (!email) email = (prompt("Met welk e-mailadres vroeg je de inloglink aan?") || "").trim().toLowerCase();
  const schoon = () => history.replaceState(null, "", location.pathname + location.hash);
  if (!email) { schoon(); return; }
  const koppel = new URL(url).searchParams.get("koppel") === "1";
  try {
    if (koppel) {
      // eerst wachten tot het hoofdaccount hier ingelogd is, dan het e-mailaccount in de tweede app aanmelden en koppelen
      await new Promise((ok) => { const t = setInterval(() => { if (cloud.gebruiker && geladen.gebruiker) { clearInterval(t); ok(); } }, 200); setTimeout(() => { clearInterval(t); ok(); }, 15000); });
      if (!cloud.gebruiker) throw new Error("Log eerst in met het account waaraan je dit adres wilt koppelen, en klik dan opnieuw op de link in de mail.");
      const r = await A.signInWithEmailLink(tweede.auth, email, url);
      cloud.koppelResultaat = await koppelUitvoeren(r.user);
    } else await A.signInWithEmailLink(auth, email, url);
    try { localStorage.removeItem(MAILSLEUTEL); } catch {}
  } catch (e) { cloud.fout = foutTekst(e); }
  schoon(); meld();
}
// ---------- e-mailadres bevestigen ----------
// Google en de e-maillink controleren je adres zelf. Bij sommige andere inlogs (bijv. Microsoft) moet je het één keer
// bevestigen via een mail; pas dan zie je uitnodigingen en kun je accounts linken.
export async function stuurBevestiging() {
  if (!auth?.currentUser) throw new Error("Log eerst in");
  await A.sendEmailVerification(auth.currentUser, { url: location.origin + location.pathname });
  return cloud.gebruiker.email;
}
export async function controleerBevestiging() {
  if (!auth?.currentUser) return false;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);     // nieuw token, met email_verified erin
  if (auth.currentUser.emailVerified) { opnieuw(); return true; }
  return false;
}
const moetGeverifieerd = (wat) => { if (!cloud.gebruiker?.geverifieerd) throw new Error(`Bevestig eerst je e-mailadres (${cloud.gebruiker?.email || "?"}) om ${wat}: Account → „E-mailadres bevestigen”.`); };

export async function uitloggen() {
  stop();
  await A.signOut(auth);
  vergeetSleutels();   // geen toegang tot je agenda's meer vanaf dit apparaat
  try { await F.terminate?.(db); await F.clearIndexedDbPersistence?.(db); } catch {}
}

// ---------- staat ----------
let subs = [];
const itemSubs = new Map();     // lijstId → unsubscribe
const koersSubs = new Map();    // "lijsten/id" of "mappen/id" → unsubscribe (koersafspraken voor iedereen in die lijst/map)
const koersDocs = new Map();    // idem → [afspraken]
const lijstDocs = new Map();    // lijstId → data
const itemDocs = new Map();     // lijstId → [items]
const mapDocs = new Map();      // mapId → data
let wachtend = new Map();       // id → {soort, data}: uitnodigingen (lijsten en mappen) waar ik nog niet in zit
let gebruikerDoc = null;
const bekend = new Map();       // pad → stabiele JSON zoals laatst gezien/geschreven
// Paden die ook in het geheugen (opslag.d) zitten. Alleen die mogen bij opruimen weg: iets wat net binnenkwam
// en nog niet in het geheugen staat, is niet "door jou verwijderd" maar gewoon nieuw.
let inGeheugen = new Set();
let geladen = { gebruiker: false, lijsten: false, mappen: false };

function stop() {
  subs.forEach(f => f()); subs = [];
  itemSubs.forEach(f => f()); itemSubs.clear();
  koersSubs.forEach(f => f()); koersSubs.clear(); koersDocs.clear();
  koppelStop();
  lijstDocs.clear(); itemDocs.clear(); mapDocs.clear(); wachtend = new Map(); bekend.clear(); gebruikerDoc = null; inGeheugen = new Set();
  geladen = { gebruiker: false, lijsten: false, mappen: false };
  clearTimeout(schrijfTimer); schrijfTimer = null;
  familieSubs.forEach(f => f()); familieSubs.clear(); familieDocs.clear(); cloud.familieFout.clear();
}

// JSON met gesorteerde sleutels, zodat Firestore-volgorde geen schijnverschillen geeft
function stabiel(x) {
  if (Array.isArray(x)) return "[" + x.map(stabiel).join(",") + "]";
  if (x && typeof x === "object") return "{" + Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => JSON.stringify(k) + ":" + stabiel(x[k])).join(",") + "}";
  return JSON.stringify(x ?? null);
}
const schoon = (x) => JSON.parse(JSON.stringify(x));
const ikInfo = () => ({ naam: cloud.gebruiker.naam, email: cloud.gebruiker.email, foto: cloud.gebruiker.foto || "" });

async function aangemeld(u) {
  cloud.melding = "";
  cloud.gebruiker = {
    uid: u.uid, naam: u.displayName || u.email || "Gebruiker", email: (u.email || u.providerData.find(p => p.email)?.email || "").toLowerCase(),
    foto: u.photoURL || "", geverifieerd: !!u.emailVerified, aanbieders: u.providerData.map(p => ({ soort: p.providerId === "google.com" ? "google" : p.providerId === "microsoft.com" ? "microsoft" : "email", email: p.email || "" })),
  };
  sessie.ik = u.uid; sessie.familie = [u.uid]; cloud.familie = [u.uid]; cloud.hoofdUid = null;
  meld();
  const ref = F.doc(db, "gebruikers", u.uid);
  let eigen;
  try { eigen = await F.getDocFromServer(ref); } catch { eigen = await F.getDoc(ref); }
  // Hoort deze inlog bij het Tijdkompas van een ander (hoofd)account? Alleen als dat hoofd hem ook echt heeft toegevoegd.
  const hoofd = eigen.exists() ? eigen.data().hoofd : null;
  if (hoofd && hoofd !== u.uid) {
    try {
      const h = await F.getDoc(F.doc(db, "gebruikers", hoofd));
      if (h.exists() && (h.data().aliassen || []).includes(u.uid)) {
        cloud.hoofdUid = hoofd; sessie.familie = [hoofd, ...h.data().aliassen]; cloud.familie = [...sessie.familie];
        // het hoofd mag ook mijn agenda en planning zien
        if (!(eigen.data().aliassen || []).includes(hoofd)) await F.setDoc(ref, { aliassen: F.arrayUnion(hoofd) }, { merge: true }).catch(() => {});
      } else if (h.exists()) await F.setDoc(ref, { hoofd: F.deleteField(), aliassen: [] }, { merge: true }).catch(() => {});   // niet meer gelinkt
    } catch (e) {
      // mag het hoofd-Tijdkompas niet lezen: meestal staan de nieuwste beveiligingsregels nog niet in Firebase
      cloud.melding = "Dit account is toegevoegd aan een ander Tijdkompas, maar Firebase laat dat nog niet toe. " +
        "Waarschijnlijk staan de nieuwste beveiligingsregels er nog niet in (SETUP.md → Beveiligingsregels bijwerken).";
      console.warn("Hoofd-Tijdkompas niet leesbaar", e);
    }
  }
  if (!eigen.exists()) await eersteKeer();
  abonneer();
}
function afgemeld() {
  const wasIn = !!cloud.gebruiker;
  stop(); cloud.gebruiker = null; cloud.uitnodigingen = []; sessie.ik = null; cloud.melding = ""; sessie.familie = []; cloud.familie = []; cloud.aliasInfo = {}; cloud.hoofdInfo = null; cloud.hoofdUid = null;
  if (wasIn) { vergeet(); try { localStorage.removeItem(TITELS); } catch {} opslag.demo(); }   // gegevens van het account niet op dit apparaat laten staan
  meld();
  return Promise.resolve();
}

// Nieuw account: huidige planning van dit apparaat meenemen, of schoon beginnen met Werk + Privé
async function eersteKeer() {
  const d = opslag.d;
  const heeftEigen = !d.demo && (d.taken.length || d.projecten.length);
  let start = heeftEigen && confirm("Welkom! Wil je de planning die op dit apparaat staat meenemen naar je account?\n\nOK = meenemen\nAnnuleren = schoon beginnen")
    ? schoon(d) : startData();
  // lijst-id's moeten wereldwijd uniek zijn (lijsten zijn gedeelde documenten)
  const kaart = {}; start.overzichten.forEach(o => kaart[o.id] = nieuwId() + nieuwId());
  start.overzichten.forEach(o => { o.id = kaart[o.id]; o.eigenaar = sessie.ik; o.leden = [sessie.ik]; o.ledenInfo = { [sessie.ik]: ikInfo() }; o.uitgenodigd = []; });
  for (const x of [...start.taken, ...start.projecten, ...start.planning]) if (kaart[x.overzicht]) x.overzicht = kaart[x.overzicht];
  (start.mappen || []).forEach(m => kaart[m.id] = nieuwId() + nieuwId());
  (start.mappen || []).forEach(m => { m.id = kaart[m.id]; m.ouder = kaart[m.ouder] || ""; m.eigenaar = sessie.ik; m.leden = [sessie.ik]; m.ledenInfo = { [sessie.ik]: ikInfo() }; m.uitgenodigd = []; });
  start.overzichten.forEach(o => { o.map = kaart[o.map] || ""; });
  (start.koers || []).forEach(a => { if (a.doel?.id && kaart[a.doel.id]) a.doel.id = kaart[a.doel.id]; });
  for (const x of start.taken) { x.wie = (x.wie || ["ik"]).map(w => w === "ik" ? sessie.ik : w); if (x.klaarDoor === "ik") x.klaarDoor = sessie.ik; }
  for (const a of Object.values(start.agendas || {})) if (kaart[a.lijst]) a.lijst = kaart[a.lijst];
  for (const a of Object.values(start.takenlijsten || {})) if (kaart[a.lijst]) a.lijst = kaart[a.lijst];
  start.demo = false;
  await schrijf(naarDocs(start), new Map());
}

function abonneer() {
  stop();
  const ik = sessie.ik, email = cloud.gebruiker.email, wie = authUid();
  subs.push(F.onSnapshot(F.doc(db, "gebruikers", ik), (s) => {
    gebruikerDoc = s.data() || {}; bekend.set("gebruikers/" + ik, stabiel(gebruikerDoc));
    if (!cloud.hoofdUid) {                 // als hoofd: de familie staat in je eigen document
      cloud.familie = [ik, ...(gebruikerDoc.aliassen || [])]; sessie.familie = [...cloud.familie];
      cloud.aliasInfo = gebruikerDoc.aliasInfo || {}; cloud.hoofdInfo = gebruikerDoc.profiel || null;
    }
    // eigen naam/e-mail bewaren, zodat gelinkte accounts kunnen laten zien wie je bent
    if (!gebruikerDoc.profiel || gebruikerDoc.profiel.email !== cloud.gebruiker.email)
      F.setDoc(F.doc(db, "gebruikers", ik), { profiel: ikInfo() }, { merge: true }).catch(() => {});
    abonneerFamilie();
    geladen.gebruiker = true; bouwStraks(); meld();
  }, fout));
  hervatKoppel();
  subs.push(F.onSnapshot(F.query(F.collection(db, "lijsten"), F.where("leden", "array-contains", wie)), (s) => {
    const nu = new Set();
    s.forEach(doc => {
      nu.add(doc.id); lijstDocs.set(doc.id, doc.data()); bekend.set("lijsten/" + doc.id, stabiel(doc.data()));
      if (!itemSubs.has(doc.id)) itemSubs.set(doc.id, F.onSnapshot(F.collection(db, "lijsten", doc.id, "items"), (si) => {
        for (const k of [...bekend.keys()]) if (k.startsWith(`lijsten/${doc.id}/items/`)) bekend.delete(k);
        itemDocs.set(doc.id, si.docs.map(x => { bekend.set(`lijsten/${doc.id}/items/${x.id}`, stabiel(x.data())); return { ...x.data(), id: x.id }; }));
        bouwStraks();
      }, fout));
      volgKoers("lijsten", doc.id);
    });
    for (const id of [...lijstDocs.keys()]) if (!nu.has(id)) {
      lijstDocs.delete(id); itemDocs.delete(id); itemSubs.get(id)?.(); itemSubs.delete(id); stopKoers("lijsten", id);
      for (const k of [...bekend.keys()]) if (k === "lijsten/" + id || k.startsWith(`lijsten/${id}/`)) bekend.delete(k);
    }
    geladen.lijsten = true; bouwStraks();
  }, fout));
  subs.push(F.onSnapshot(F.query(F.collection(db, "mappen"), F.where("leden", "array-contains", wie)), (s) => {
    const nu = new Set();
    s.forEach(doc => { nu.add(doc.id); mapDocs.set(doc.id, doc.data()); bekend.set("mappen/" + doc.id, stabiel(doc.data())); volgKoers("mappen", doc.id); });
    for (const id of [...mapDocs.keys()]) if (!nu.has(id)) {
      mapDocs.delete(id); stopKoers("mappen", id);
      for (const k of [...bekend.keys()]) if (k === "mappen/" + id || k.startsWith(`mappen/${id}/`)) bekend.delete(k);
    }
    geladen.mappen = true; bouwStraks();
  }, fout));
  // Uitnodigingen: per lijst en per map. Een gedeelde map nodigt ook uit voor alles erin; toon alleen de bovenste.
  // Uitnodigingen gaan op e-mailadres: alleen met een gecontroleerd adres (anders kan iedereen zich als jou voordoen)
  if (email && cloud.gebruiker.geverifieerd) for (const soort of ["lijsten", "mappen"]) subs.push(F.onSnapshot(F.query(F.collection(db, soort), F.where("uitgenodigd", "array-contains", email)), (s) => {
    for (const [id, x] of [...wachtend]) if (x.soort === soort) wachtend.delete(id);
    s.docs.filter(x => veiligId(x.id) && !(x.data().leden || []).includes(wie)).forEach(x => wachtend.set(x.id, { soort, data: x.data() }));
    const ouderVan = (x) => x.soort === "lijsten" ? x.data.map : x.data.ouder;
    cloud.uitnodigingen = [...wachtend].filter(([, x]) => !wachtend.has(ouderVan(x))).map(([id, x]) => ({
      id, map: x.soort === "mappen", naam: String(x.data.naam || "").slice(0, 200), icoon: veiligIcoon(x.data.icoon), van: String(x.data.ledenInfo?.[x.data.eigenaar]?.naam || "iemand").slice(0, 200),
      aantal: x.soort === "mappen" ? boomVan(id).filter(y => wachtend.get(y)?.soort === "lijsten").length : 0,
    }));
    meld();
  }, () => {}));
}
function fout(e) { cloud.fout = e.message; meld(); }
// Koersafspraken die bij een lijst of map horen en voor iedereen daarin zijn
function volgKoers(soort, id) {
  const k = soort + "/" + id;
  if (koersSubs.has(k)) return;
  koersSubs.set(k, F.onSnapshot(F.collection(db, soort, id, "koers"), (s) => {
    for (const p of [...bekend.keys()]) if (p.startsWith(k + "/koers/")) bekend.delete(p);
    koersDocs.set(k, s.docs.map(x => { bekend.set(`${k}/koers/${x.id}`, stabiel(x.data())); return { ...x.data(), id: x.id, gedeeld: true }; }));
    bouwStraks();
  }, () => {}));
}
function stopKoers(soort, id) {
  const k = soort + "/" + id;
  koersSubs.get(k)?.(); koersSubs.delete(k); koersDocs.delete(k);
  for (const p of [...bekend.keys()]) if (p.startsWith(k + "/koers/")) bekend.delete(p);
}


function opnieuw() { stop(); if (auth.currentUser) aangemeld(auth.currentUser).catch(fout); }

// ---------- gelinkte accounts: hun agenda en planning meelezen ----------
const familieDocs = new Map(), familieSubs = new Map();
function abonneerFamilie() {
  const andere = cloud.familie.filter(u => u !== sessie.ik);
  for (const [u, f] of familieSubs) if (!andere.includes(u)) { f(); familieSubs.delete(u); familieDocs.delete(u); }
  for (const u of andere) if (!familieSubs.has(u)) familieSubs.set(u, F.onSnapshot(F.doc(db, "gebruikers", u), (s) => {
    const x = s.data() || {}; familieDocs.set(u, x); cloud.familieFout.delete(u);
    if (u === cloud.hoofdUid) {            // als gelinkt account: de familie staat bij het hoofd
      if (!(x.aliassen || []).includes(sessie.ik)) { opnieuw(); return; }   // losgekoppeld terwijl ingelogd
      cloud.familie = [u, ...x.aliassen]; sessie.familie = [...cloud.familie];
      cloud.aliasInfo = x.aliasInfo || {}; cloud.hoofdInfo = x.profiel || null;
      abonneerFamilie();
    }
    verhuisStraks(); bouwStraks(); meld();
  }, (e) => {
    // niet te lezen (meestal: de nieuwste beveiligingsregels staan nog niet in Firebase) — laten zien in plaats van stil weglaten
    familieDocs.delete(u); familieSubs.delete(u); cloud.familieFout.set(u, foutTekst(e)); meld(); bouwStraks();
    if (u === cloud.hoofdUid) opnieuw();
  }));
}
const accVan = (k) => String(k || "").match(/^(?:google|ms):([^|]+)/)?.[1]?.toLowerCase() || "";
export function emailVan(uid) {
  if (uid === sessie.ik) return cloud.gebruiker?.email || "";
  if (uid === (cloud.hoofdUid || sessie.ik)) return (cloud.hoofdInfo?.email || "").toLowerCase();
  return (cloud.aliasInfo?.[uid]?.email || familieDocs.get(uid)?.profiel?.email || "").toLowerCase();
}
/** Is deze lijst of map van een gelinkt account? Dan wat dat account heeft ingesteld (alleen om te tonen). */
export function gelinkteInfo(x) {
  if (!x?.eigenaar || x.eigenaar === sessie.ik || !cloud.familie.includes(x.eigenaar)) return null;
  const X = familieDocs.get(x.eigenaar) || {}, inst = X.lijstInst?.[x.id] || {};
  const tl = Object.values(X.takenlijsten || {}).find(t => t.lijst === x.id);
  return { email: emailVan(x.eigenaar) || "je gelinkte account", inst, takenlijst: tl || null,
           agenda: inst.doelAgenda ? (X.agendas?.[inst.doelAgenda]?.naam || "een agenda") : "",
           locatie: (X.locaties || []).find(l => l.id === inst.locatie)?.naam || "",
           locNaam: (id) => (X.locaties || []).find(l => l.id === id)?.naam || "" };
}
/** Agenda en planning van gelinkte accounts (alleen om te tonen en om omheen te plannen) */
export function familieAgenda() {
  const bezet = [], planning = [];
  for (const [u, x] of familieDocs) {
    const van = emailVan(u);
    for (const e of x.bezet || []) bezet.push({ ...e, kleur: veiligeKleur(e.kleur, ""), vanFamilie: van, soortF: x.agendas?.[e.bron]?.soort || "bezet", kleurF: veiligeKleur(x.agendas?.[e.bron]?.kleur, "") });
    for (const b of x.planning || []) planning.push({ ...b, vanFamilie: van, titel: b.titel || "Gepland" });
  }
  return { bezet, planning };
}
// Opruimen na de oude opzet (één gedeeld Tijdkompas): koppelingen, agenda's en takenlijsten horen bij het account
// van wie ze zijn. Wat van mijn account bij een gelinkt account staat, haal ik naar me toe; wat van hun account bij mij
// staat en zij zelf al hebben, haal ik weg. Lijsten van hun takenlijsten worden van hen (zij plannen ze in).
let verhuisTimer = null;
function verhuisStraks() { clearTimeout(verhuisTimer); verhuisTimer = setTimeout(verhuis, 300); }
function verhuis() {
  if (!cloudGeladen() || !familieDocs.size) return;
  const D = opslag.d, mij = (cloud.gebruiker.email || "").toLowerCase(); let anders = false;
  D.agendas ||= {}; D.takenlijsten ||= {}; D.extern ||= {}; D.bezet ||= [];
  for (const [u, X] of familieDocs) {
    const hun = emailVan(u);
    const kop = Array.isArray(D.koppelingen) ? D.koppelingen : [];
    for (const k of X.koppelingen || []) if ((k.email || "").toLowerCase() === mij && !kop.some(x => x.id === k.id)) { D.koppelingen = [...(D.koppelingen || []), k]; anders = true; }
    for (const [key, a] of Object.entries(X.agendas || {})) if (accVan(key) === mij && !D.agendas[key]) { D.agendas[key] = a; anders = true; }
    for (const [key, t] of Object.entries(X.takenlijsten || {})) if (accVan(key) === mij && !D.takenlijsten[key]) { D.takenlijsten[key] = t; anders = true; }
    const ids = new Set(D.bezet.map(e => e.id));
    for (const e of X.bezet || []) if (accVan(e.bron) === mij && !ids.has(e.id)) { D.bezet.push(e); anders = true; }
    for (const [key, x] of Object.entries(X.extern || {})) if (accVan(x.bron) === mij && !D.extern[key]) { D.extern[key] = x; anders = true; }
    if (!hun || hun === mij) continue;
    const hunKop = new Set((X.koppelingen || []).map(k => k.id));
    if ((D.koppelingen || []).some(k => (k.email || "").toLowerCase() === hun && hunKop.has(k.id))) {
      D.koppelingen = D.koppelingen.filter(k => !((k.email || "").toLowerCase() === hun && hunKop.has(k.id))); anders = true;
    }
    for (const key of Object.keys(D.agendas)) if (accVan(key) === hun && X.agendas?.[key]) { delete D.agendas[key]; anders = true; }
    for (const key of Object.keys(D.takenlijsten)) if (accVan(key) === hun && X.takenlijsten?.[key]) { delete D.takenlijsten[key]; anders = true; }
    const n = D.bezet.length; D.bezet = D.bezet.filter(e => !(accVan(e.bron) === hun && X.agendas?.[e.bron])); if (D.bezet.length !== n) anders = true;
    for (const [key, x] of Object.entries(D.extern)) if (accVan(x.bron) === hun && X.extern?.[key]) { delete D.extern[key]; anders = true; }
    for (const t of Object.values(X.takenlijsten || {})) {
      const l = t.lijst && lijstDocs.get(t.lijst);
      if (l && l.eigenaar === sessie.ik && !Object.values(D.takenlijsten).some(m => m.lijst === t.lijst))
        F.updateDoc(F.doc(db, "lijsten", t.lijst), { eigenaar: u }).catch(() => {});
    }
  }
  if (anders) bewaar();
}

// ---------- meerdere inlogs, één Tijdkompas ----------
export const isHoofd = () => !!cloud.gebruiker && !cloud.hoofdUid;
/** Voegt een ander Google-/Microsoft-account toe aan dit Tijdkompas. Moet direct binnen een klik aangeroepen worden (popup). */
export async function voegInlogToe(soort) {
  if (!tweede) throw new Error("Even geduld, inloggen wordt nog geladen…");
  if (!isHoofd()) throw new Error("Accounts toevoegen kan alleen als je inlogt met het hoofdaccount.");
  const r = await A.signInWithPopup(tweede.auth, aanbieder(soort));
  return koppelUitvoeren(r.user);
}
// b = het andere account, aangemeld in de tweede app (via popup of via een e-maillink)
async function koppelUitvoeren(b) {
  const ik = sessie.ik;
  if (!isHoofd()) throw new Error("Accounts toevoegen kan alleen als je inlogt met het hoofdaccount.");
  try {
    if (b.uid === ik || cloud.familie.includes(b.uid)) throw new Error("Dit account hoort al bij dit Tijdkompas.");
    const email = (b.email || b.providerData.find(p => p.email)?.email || "").toLowerCase();
    const zijn = await F.getDoc(F.doc(tweede.db, "gebruikers", b.uid));
    if ((zijn.data()?.aliassen || []).some(u => u !== ik) && !zijn.data()?.hoofd) throw new Error(`${email} heeft zelf al andere accounts gekoppeld. Haal die daar eerst weg, of voeg dit account juist daar toe.`);
    // 1. het hoofd keurt goed  2. het andere account wijst naar het hoofd
    await F.updateDoc(F.doc(db, "gebruikers", ik), { aliassen: F.arrayUnion(b.uid), [`aliasInfo.${b.uid}`]: { email, naam: b.displayName || email, foto: b.photoURL || "" } });
    await F.setDoc(F.doc(tweede.db, "gebruikers", b.uid), { hoofd: ik, aliassen: [ik] }, { merge: true });
    // 3. zijn lijsten en mappen: hele familie erbij (eigenaar blijft hij; hij plant ze ook in)
    const fam = [...new Set([...familie(), ik, b.uid])];
    let n = 0;
    for (const soortC of ["mappen", "lijsten"]) {
      const sn = await F.getDocs(F.query(F.collection(tweede.db, soortC), F.where("leden", "array-contains", b.uid)));
      for (const x of sn.docs) {
        await F.updateDoc(x.ref, { leden: F.arrayUnion(...fam) });
        if (soortC === "lijsten") n++;
      }
    }
    exFamilie.delete(b.uid);   // 4. alles van dit Tijdkompas krijgt het nieuwe account als lid: gebeurt bij de volgende herbouw (metFamilie)
    return { email, lijsten: n };
  } finally { try { await A.signOut(tweede.auth); } catch {} }
}
/** Haalt een toegevoegd account weer los. Zijn eigen (oude) gegevens blijven bestaan; het ziet dit Tijdkompas niet meer. */
export async function verwijderInlog(uid) {
  if (!isHoofd()) throw new Error("Dit kan alleen vanuit het hoofdaccount.");
  exFamilie.add(uid);
  await F.updateDoc(F.doc(db, "gebruikers", sessie.ik), { aliassen: F.arrayRemove(uid), [`aliasInfo.${uid}`]: F.deleteField() });
  // mijn lijsten: hij eruit; zijn eigen lijsten: wij eruit (die neemt hij weer mee)
  const wij = familie().filter(u => u !== uid);
  for (const [soort, docs] of [["lijsten", lijstDocs], ["mappen", mapDocs]])
    for (const [id, x] of docs) {
      if (x.eigenaar === uid) await F.updateDoc(F.doc(db, soort, id), { leden: F.arrayRemove(...wij), ...Object.fromEntries(wij.map(u => [`ledenInfo.${u}`, F.deleteField()])) }).catch(() => {});
      else if ((x.leden || []).includes(uid)) await F.updateDoc(F.doc(db, soort, id), { leden: F.arrayRemove(uid), [`ledenInfo.${uid}`]: F.deleteField() }).catch(() => {});
    }
  opnieuw();   // alles opnieuw laden: zijn lijsten zijn niet meer van ons, de onze niet meer van hem
}

// ---------- van Firestore naar het geheugen ----------
let bouwTimer = null;
function bouwStraks() { clearTimeout(bouwTimer); bouwTimer = setTimeout(bouw, 30); }
function bouw() {
  if (!geladen.gebruiker || !geladen.lijsten || !geladen.mappen) return;
  // eigen wijzigingen die nog niet weg zijn eerst versturen; de snapshots daarvan bouwen daarna opnieuw
  if (schrijfTimer) { clearTimeout(schrijfTimer); schrijfTimer = null; if (schrijfVerschil() > 0) return; }
  const u = gebruikerDoc || {}, volgorde = u.lijstVolgorde || [];
  const opSchijf = Object.entries(u.lijstInst || {}).filter(([, x]) => x?.opslag).map(([id]) => id);
  const kop = (id) => lijstDocs.get(id) || u.lijstInst[id];
  const ids = [...lijstDocs.keys(), ...opSchijf.filter(id => !lijstDocs.has(id))].sort((a, b) => {
    const x = volgorde.indexOf(a), y = volgorde.indexOf(b);
    return (x < 0 ? 1e9 : x) - (y < 0 ? 1e9 : y) || String(kop(a).naam).localeCompare(kop(b).naam);
  });
  const items = ids.flatMap(id => (itemDocs.get(id) || []).map(x => ({ ...x, overzicht: id })));
  const titels = leesTitels();
  const d = aanvullen({
    locaties: u.locaties, beschikbaar: u.beschikbaar, afwezig: u.afwezig || {}, feeds: u.feeds || [], instellingen: u.instellingen, agendas: u.agendas || {}, extern: u.extern || {},
    planning: u.planning || [], agendaSync: u.agendaSync, gewijzigd: u.gewijzigd, takenlijsten: u.takenlijsten || {}, takenSync: u.takenSync || "", koppelingen: u.koppelingen, agendaLinks: u.agendaLinks || [],
    bezet: (u.bezet || []).map(e => ({ ...e, titel: titels.bezet?.[e.id]?.titel || e.titel || "Bezet", plaats: titels.bezet?.[e.id]?.plaats || e.plaats || "" })),
    overzichten: ids.map(id => {
      const l = lijstDocs.get(id);
      if (!l) { const s = u.lijstInst[id]; return { id, naam: s.naam || "Lijst", kleur: s.kleur || "#8a978e", icoon: s.icoon || "🔒", opslag: s.opslag, slot: true, map: s.map || "", mensen: [],
                                                    eigenaar: sessie.ik, leden: [sessie.ik], ledenInfo: {}, uitgenodigd: [], modus: "vrij", locatie: "", tijden: [], doelAgenda: null }; }
      return { id, naam: l.naam, kleur: l.kleur, icoon: l.icoon, eigenaar: l.eigenaar, leden: l.leden || [], ledenInfo: l.ledenInfo || {},
               uitgenodigd: l.uitgenodigd || [], mensen: l.mensen || [], verdeling: l.verdeling || "samen", map: mapDocs.has(l.map) ? l.map : "", modus: "vrij", locatie: "", tijden: [], doelAgenda: null, ...(u.lijstInst?.[id] || {}) };
    }),
    mappen: [...mapDocs].sort(([a], [b]) => { const v = u.mapVolgorde || [], x = v.indexOf(a), y = v.indexOf(b); return (x < 0 ? 1e9 : x) - (y < 0 ? 1e9 : y); })
      .map(([id, m]) => ({ id, naam: m.naam, icoon: m.icoon, kleur: m.kleur, eigenaar: m.eigenaar, leden: m.leden || [], ledenInfo: m.ledenInfo || {}, uitgenodigd: m.uitgenodigd || [],
                           ouder: u.mapInst?.[id]?.ouder ?? (mapDocs.has(m.ouder) ? m.ouder : "") })),
    koers: [...(u.koers || []).filter(a => !a.gedeeld), ...[...koersDocs.values()].flat()],
    taken: items.filter(x => x.type === "taak"), projecten: items.filter(x => x.type === "project"), demo: false,
  }, { nieuweToevoegen: false });
  // titels van blokken uit schijflijsten terugzetten (de cloud kent alleen tijden)
  const itemTitel = new Map([...d.taken, ...d.projecten].map(x => [x.id, x.titel]));
  d.planning = d.planning.map(b => b.titel ? b : { ...b, titel: itemTitel.get(b.item) || titels.blok?.[b.id] || "🔒 Niet geladen" });
  opslag.vervang(d, { stil: true });
  verhuisStraks();
  inGeheugen = new Set([...d.overzichten.map(o => "lijsten/" + o.id), ...(d.mappen || []).map(m => "mappen/" + m.id),
                        ...[...d.taken, ...d.projecten].map(x => `lijsten/${x.overzicht}/items/${x.id}`),
                        ...d.koers.filter(a => a.gedeeld).map(koersPad).filter(Boolean)]);
  // nieuw toegevoegd account nog niet overal lid? (bijv. net gekoppeld) → bijwerken
  const fam = echteFamilie();
  if (fam.length > 1 && [...lijstDocs.values(), ...mapDocs.values()].some(x => fam.some(u => !(x.leden || []).includes(u)))) planSchrijven();
  laadOntbrekende(d);
}

// ---------- van het geheugen naar Firestore ----------
const PERSOONLIJK = ["modus", "locatie", "tijden", "afwijkingen", "doelAgenda", "map"];
// Alle inlogs van dit Tijdkompas horen in elke lijst/map (zonder losgekoppelde: die staan niet meer in familie)
const exFamilie = new Set();
// Als hoofd: een gelinkt account pas toevoegen als het zelf ook naar mij wijst (wederzijds; zo eisen de regels het ook)
const echteFamilie = () => familie().filter(u => !exFamilie.has(u) && (u === sessie.ik || !!cloud.hoofdUid || familieDocs.get(u)?.hoofd === sessie.ik));
const metFamilie = (leden) => [...new Set([...(leden?.length ? leden : [sessie.ik]), ...echteFamilie()])].filter(u => !exFamilie.has(u));   // per gebruiker, ook bij gedeelde lijsten
// ledenInfo: wat op de server staat blijft staan (de regel van een ander pas je niet aan); nieuwe leden krijgen hun regel erbij
function infoNaar(server, lokaal, leden) {
  const uit = {}, oudeLeden = new Set(server?.leden || []), info = server?.ledenInfo || {};
  for (const u of leden) {
    if (info[u]) uit[u] = info[u];
    else if (lokaal?.[u] && (!oudeLeden.has(u) || u === sessie.ik)) uit[u] = lokaal[u];
  }
  if (!uit[sessie.ik] && leden.includes(sessie.ik) && !Object.keys(uit).length) uit[sessie.ik] = ikInfo();
  return uit;
}
// Waar een gedeelde koersafspraak staat
const koersPad = (a) => a.doel?.id && (a.doel.soort === "map" || a.doel.soort === "lijst") ? `${a.doel.soort === "map" ? "mappen" : "lijsten"}/${a.doel.id}/koers/${a.id}` : "";
// Velden in je gebruikersdocument die alleen via het linken veranderen (nooit overschrijven met een oudere kopie)
const BESCHERMD = ["aliassen", "aliasInfo", "hoofd", "profiel", "koppelcode"];
function naarDocs(d) {
  const ik = sessie.ik, docs = new Map();
  const schijfLijst = new Set(d.overzichten.filter(o => o.opslag).map(o => o.id));
  onthoudTitels(d);
  docs.set("gebruikers/" + ik, schoon({
    locaties: d.locaties, beschikbaar: d.beschikbaar, afwezig: d.afwezig || {}, feeds: d.feeds || [], instellingen: d.instellingen, agendas: d.agendas || {},
    extern: Object.fromEntries(Object.entries(d.extern || {}).map(([k, x]) => { const { titel, ...r } = x; return [k, titel !== undefined && !r.th ? { ...r, th: vingerafdruk(titel) } : r]; })),
    planning: (d.planning || []).map(b => schijfLijst.has(b.overzicht) && b.soort !== "reis" ? { ...b, titel: "" } : b),
    // afspraken mét titel: zo ziet elke inlog en elk apparaat van dit Tijdkompas dezelfde agenda
    bezet: (d.bezet || []).map(e => ({ ...e, loc: e.loc ?? (herkenLocatie(e.plaats) || "") })),
    agendaSync: d.agendaSync || "", gewijzigd: d.gewijzigd || "",
    takenlijsten: d.takenlijsten || {}, takenSync: d.takenSync || "", agendaLinks: d.agendaLinks || [],
    ...(Array.isArray(d.koppelingen) ? { koppelingen: d.koppelingen } : {}),
    // beheerd buiten naarDocs (meerdere inlogs): ongewijzigd laten staan
    ...(gebruikerDoc?.aliassen ? { aliassen: gebruikerDoc.aliassen, aliasInfo: gebruikerDoc.aliasInfo || {} } : {}),
    ...(gebruikerDoc?.profiel ? { profiel: gebruikerDoc.profiel } : {}),
    ...(gebruikerDoc?.hoofd ? { hoofd: gebruikerDoc.hoofd } : {}),
    lijstVolgorde: d.overzichten.map(o => o.id), mapVolgorde: (d.mappen || []).map(m => m.id),
    mapInst: Object.fromEntries((d.mappen || []).map(m => [m.id, { ouder: m.ouder || "" }])),
    koers: (d.koers || []).filter(a => !a.gedeeld || !koersPad(a)),
    lijstInst: Object.fromEntries(d.overzichten.map(o => [o.id, o.opslag
      ? { opslag: o.opslag, naam: o.naam || "", icoon: o.icoon || "", kleur: o.kleur || "", map: o.map || "" }
      : Object.fromEntries(PERSOONLIJK.map(k => [k, o[k] ?? null]))])),
  }));
  // Andermans lijst of map (niet van jou of je gelinkte accounts): de instellingen zijn van de eigenaar en gaan
  // ongewijzigd terug; jij past alleen leden (jezelf en je gelinkte accounts), je eigen ledenregel en 'mensen' aan.
  for (const o of d.overzichten) {
    if (o.opslag) continue;
    const srv = lijstDocs.get(o.id), leden = metFamilie(o.leden);
    if (srv && !isIk(srv.eigenaar)) {
      docs.set("lijsten/" + o.id, schoon({ ...srv, leden, ledenInfo: infoNaar(srv, o.ledenInfo, leden), mensen: o.mensen || [] }));
      continue;
    }
    docs.set("lijsten/" + o.id, schoon({
      naam: o.naam, kleur: o.kleur, icoon: o.icoon, eigenaar: srv?.eigenaar || o.eigenaar || ik,   // eigenaar verandert alleen op de server
      leden, ledenInfo: infoNaar(srv, o.ledenInfo, leden),
      uitgenodigd: (o.uitgenodigd || []).map(e => e.toLowerCase()), mensen: o.mensen || [], verdeling: o.verdeling || "samen",
      map: (o.eigenaar || ik) === ik ? o.map || "" : srv?.map ?? "",        // indeling van de eigenaar (alleen die zet hem)
    }));
  }
  for (const m of d.mappen || []) {
    const srv = mapDocs.get(m.id), leden = metFamilie(m.leden);
    if (srv && !isIk(srv.eigenaar)) {
      docs.set("mappen/" + m.id, schoon({ ...srv, leden, ledenInfo: infoNaar(srv, m.ledenInfo, leden) }));
      continue;
    }
    docs.set("mappen/" + m.id, schoon({
      naam: m.naam, icoon: m.icoon, kleur: m.kleur, eigenaar: srv?.eigenaar || m.eigenaar || ik,
      ouder: (m.eigenaar || ik) === ik ? m.ouder || "" : srv?.ouder ?? "",
      leden, ledenInfo: infoNaar(srv, m.ledenInfo, leden),
      uitgenodigd: (m.uitgenodigd || []).map(e => e.toLowerCase()),
    }));
  }
  // Koersafspraken voor iedereen in een lijst of map (alleen in de Tijdkompas-cloud, niet in een eigen schijf)
  for (const a of d.koers || []) {
    if (!a.gedeeld) continue;
    const pad = koersPad(a); if (!pad) continue;
    const [soort, id] = pad.split("/");
    if (soort === "lijsten" ? schijfLijst.has(id) || !d.overzichten.some(o => o.id === id) : !(d.mappen || []).some(m => m.id === id)) continue;
    const { gedeeld, ...rest } = a;
    docs.set(pad, schoon({ ...rest, gedeeld: true }));
  }
  for (const x of [...d.taken, ...d.projecten]) {
    if (!d.overzichten.some(o => o.id === x.overzicht) || schijfLijst.has(x.overzicht)) continue;
    const { overzicht, ...rest } = x;
    docs.set(`lijsten/${overzicht}/items/${x.id}`, schoon(rest));
  }
  return docs;
}

// ---------- abonneer-link (.ics) voor je (werk)agenda ----------
// De app zet bij elke wijziging een .ics van de gekozen lijsten in feeds/{sleutel}; het doorgeefluik geeft die door
// op <doorgeefluik>/feed/<sleutel>.ics. Wie de link heeft kan hem lezen (net als het "geheime adres" van Google Agenda),
// dus de sleutel is lang en willekeurig, en een nieuwe link maakt de oude onbruikbaar.
export const feedStand = new Map();   // sleutel → { hash, bijgewerkt, fout }
const feedGelezen = new Set();
export const feedUrl = (sleutel) => `${CONFIG.icsProxy}/feed/${sleutel}.ics`;
export function nieuweFeedSleutel() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const hash = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ":" + t.length; };
export function feedBlokken(f) {
  const lijsten = new Set(f.lijsten || []), grens = Date.now() - 14 * 864e5, uit = new Map();
  const schijf = new Set(opslag.d.overzichten.filter(o => o.opslag).map(o => o.id));     // lijsten in je eigen Drive/OneDrive: nooit naar buiten
  for (const b of [...(opslag.d.planning || []), ...familieAgenda().planning])
    if (lijsten.has(b.overzicht) && !schijf.has(b.overzicht) && (f.reis || b.soort !== "reis") && new Date(b.eind).getTime() > grens && !uit.has(b.id)) uit.set(b.id, b);
  return [...uit.values()];
}
let feedTimer = null;
export function feedsLater(ms = 3000) {
  if (!cloud.gebruiker || !(opslag.d.feeds || []).length) return;
  clearTimeout(feedTimer); feedTimer = setTimeout(() => { feedTimer = null; feedsBijwerken().catch(() => {}); }, ms);
}
export async function feedsBijwerken() {
  if (!cloudGeladen()) return;
  for (const f of opslag.d.feeds || []) {
    const ref = F.doc(db, "feeds", f.id);
    const { ics, kern } = maakFeedIcs(feedBlokken(f), { naam: f.naam, titels: f.titels !== false });
    const h = hash(kern);
    try {
      if (!feedGelezen.has(f.id)) {
        feedGelezen.add(f.id);
        const s = await F.getDoc(ref).catch(() => null);
        if (s?.exists()) feedStand.set(f.id, { hash: s.data().hash, bijgewerkt: s.data().bijgewerkt });
      }
      if (feedStand.get(f.id)?.hash === h) continue;
      const bijgewerkt = new Date().toISOString();
      await F.setDoc(ref, { eigenaar: sessie.ik, naam: String(f.naam || "Tijdkompas").slice(0, 100), ics, hash: h, bijgewerkt });
      feedStand.set(f.id, { hash: h, bijgewerkt });
    } catch (e) { feedStand.set(f.id, { ...(feedStand.get(f.id) || {}), fout: foutTekst(e) }); }
  }
}
/**
 * Link intrekken: het document weg, dan geeft het doorgeefluik "onbekende link".
 * Bestond het document nooit (bijv. omdat Firebase het aanmaken weigerde), dan is er niets in te trekken: dan is het ook goed.
 * @returns {Promise<"weg"|"bestond niet">}
 */
export async function feedWeg(sleutel) {
  if (!cloud.gebruiker) throw new Error("Log eerst in");
  const ref = F.doc(db, "feeds", sleutel);
  let bestaat = true;
  try { bestaat = (await F.getDoc(ref)).exists(); }
  catch (e) {
    // Mag ik hem niet eens lezen, dan kent Firebase de regels voor links nog niet: dan kan hij ook nooit zijn aangemaakt
    if (String(e?.code || "").includes("permission-denied")) bestaat = false; else throw e;
  }
  if (bestaat) await F.deleteDoc(ref);
  feedStand.delete(sleutel); feedGelezen.delete(sleutel);
  return bestaat ? "weg" : "bestond niet";
}

let schrijfTimer = null;
export function planSchrijven() {
  if (!cloud.gebruiker || !geladen.lijsten) return;
  clearTimeout(schrijfTimer);
  schrijfTimer = setTimeout(() => { schrijfTimer = null; schrijfVerschil(); }, 400);
}
function schrijfVerschil() {
  if (!cloud.gebruiker) return 0;
  return schrijf(naarDocs(opslag.d), bekend, true);
}
// Schrijft wat verschilt van 'oud'; geeft het aantal bewerkingen terug (commit loopt asynchroon door)
function schrijf(gewenst, oud, opruimen = false) {
  const ik = sessie.ik, ops = [], metInhoud = [];
  for (const [pad, obj] of gewenst) {
    const s = stabiel(obj);
    if (oud.get(pad) !== s) { ops.push(["set", pad, obj]); if (oud === bekend) bekend.set(pad, s); }
    inGeheugen.add(pad);
  }
  if (opruimen) for (const pad of [...bekend.keys()]) {
    if (gewenst.has(pad) || !inGeheugen.has(pad)) continue;
    inGeheugen.delete(pad);
    const delen = pad.split("/");
    if ((delen[0] === "lijsten" || delen[0] === "mappen") && delen.length === 2) {
      const l = (delen[0] === "lijsten" ? lijstDocs : mapDocs).get(delen[1]);
      if (!l || isIk(l.eigenaar)) metInhoud.push(pad);                   // eigen lijst/map: met alles erin weg (zie hieronder)
      else ops.push(["verlaat", pad]);                                   // andermans lijst: alleen jezelf eruit halen
    } else if ((delen[0] === "lijsten" || delen[0] === "mappen") && delen.length === 4) {
      const l = (delen[0] === "lijsten" ? lijstDocs : mapDocs).get(delen[1]);
      if (gewenst.has(delen[0] + "/" + delen[1]) || isIk(l?.eigenaar)) ops.push(["del", pad]);
    }
    bekend.delete(pad);
  }
  if (!ops.length && !metInhoud.length) return oud !== bekend ? Promise.resolve(0) : 0;
  cloud.bezig = true; meld();
  const klaar = [];
  // Gedeelde koersafspraken apart: wordt zo'n schrijfactie geweigerd, dan blijft de rest (taken, lijsten) gewoon bewaard
  const groepen = [ops.filter(o => !o[1].includes("/koers/")), ops.filter(o => o[1].includes("/koers/"))].filter(g => g.length);
  for (const g of groepen) for (let i = 0; i < g.length; i += 450) {
    const b = F.writeBatch(db);
    for (const [soort, pad, obj] of g.slice(i, i + 450)) {
      const ref = F.doc(db, pad);
      if (soort === "set" && pad.startsWith("gebruikers/")) b.set(ref, obj, { mergeFields: Object.keys(obj).filter(k => !BESCHERMD.includes(k)) });
      else if (soort === "set") b.set(ref, obj);
      else if (soort === "del") b.delete(ref);
      else b.update(ref, { leden: F.arrayRemove(...familie()), ...Object.fromEntries(familie().map(u => [`ledenInfo.${u}`, F.deleteField()])) });
    }
    klaar.push(b.commit());
  }
  // Verwijderde lijsten en mappen pas ná de rest, en dan met alles erin (taken, gedeelde koers): Firestore haalt
  // sub-verzamelingen niet vanzelf weg, en de regels willen dat de lijst nog bestaat zolang je de inhoud weghaalt.
  Promise.all(klaar).then(() => Promise.all(metInhoud.map(verwijderMetInhoud))).then(() => { cloud.fout = ""; })
    .catch(e => { cloud.fout = "Opslaan mislukt: " + e.message; })
    .finally(() => { cloud.bezig = false; meld(); });
  if (oud !== bekend) return Promise.all(klaar).then(() => ops.length + metInhoud.length);
  return ops.length + metInhoud.length;
}
async function verwijderMetInhoud(pad) {
  const [soort, id] = pad.split("/");
  for (const sub of soort === "lijsten" ? ["items", "koers"] : ["koers"]) {
    const sn = await F.getDocs(F.collection(db, soort, id, sub));
    for (let i = 0; i < sn.docs.length; i += 400) {
      const b = F.writeBatch(db);
      sn.docs.slice(i, i + 400).forEach(x => b.delete(x.ref));
      await b.commit();
    }
  }
  await F.deleteDoc(F.doc(db, soort, id));
}

// ---------- delen ----------
// Een uitnodiging plus (bij een map) alles daaronder waarvoor je ook bent uitgenodigd
function boomVan(id) {
  const uit = [id];
  for (let i = 0; i < uit.length; i++)
    for (const [x, w] of wachtend) if (!uit.includes(x) && (w.soort === "lijsten" ? w.data.map : w.data.ouder) === uit[i]) uit.push(x);
  return uit;
}
export async function accepteer(id) {
  const ik = sessie.ik;
  for (const x of boomVan(id)) {
    const soort = wachtend.get(x)?.soort || "lijsten";
    const wie = authUid();   // alleen jezelf mag je toevoegen; daarna (als lid) de rest van je inlogs
    await F.updateDoc(F.doc(db, soort, x), { leden: F.arrayUnion(wie), uitgenodigd: F.arrayRemove(cloud.gebruiker.email), [`ledenInfo.${wie}`]: ikInfo() });
    if (familie().length > 1) await F.updateDoc(F.doc(db, soort, x), { leden: F.arrayUnion(...familie()) });
  }
}
export async function weiger(id) {
  for (const x of boomVan(id)) await F.updateDoc(F.doc(db, wachtend.get(x)?.soort || "lijsten", x), { uitgenodigd: F.arrayRemove(cloud.gebruiker.email) });
}
export const ingelogd = () => !!cloud.gebruiker;
/** Zijn de gegevens van het ingelogde Tijdkompas binnen (en niet meer die van daarvoor)? */
export const cloudGeladen = () => !!cloud.gebruiker && geladen.gebruiker && geladen.lijsten;

// ---------- koppelcode: twee accounts linken, ook als ze niet op hetzelfde apparaat ingelogd zijn ----------
// 1. Account B vraagt een code aan (6 tekens, 10 minuten geldig). In Firestore staat die onder een hash van e-mail + code,
//    zodat alleen wie allebei kent hem kan vinden.
// 2. Het hoofdaccount A vult het e-mailadres van B en de code in → verzoek.
// 3. B ziet wie wil linken en bevestigt (of weigert). Bij bevestigen zet B in één keer: de code op "klaar", zichzelf in
//    A's lijst van gelinkte accounts en A als hoofd in zijn eigen document. De regels staan dat alleen in die combinatie toe.
const TEKENS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // zonder 0/O, 1/I/L
const KOPPEL = "tk_koppel";                          // + "_" + uid: per account op dit apparaat
export const koppel = { b: null, a: null };            // b: mijn aangevraagde code · a: mijn verzoek met andermans code
let koppelSubs = [];
function koppelStop() { koppelSubs.forEach(f => f()); koppelSubs = []; koppel.a = koppel.b = null; }
async function codeHash(email, code) {
  const tekst = String(email || "").trim().toLowerCase() + "|" + String(code || "").replace(/[\s-]/g, "").toUpperCase();
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tekst));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
function bewaarKoppel() {
  try { const x = { uid: sessie.ik, a: koppel.a?.id || "", b: koppel.b ? { id: koppel.b.id, code: koppel.b.code, verloopt: koppel.b.verloopt } : null };
        if (x.a || x.b) localStorage.setItem(KOPPEL + "_" + sessie.ik, JSON.stringify(x)); else localStorage.removeItem(KOPPEL + "_" + sessie.ik); } catch {}
}
function volgCode(rol, id) {
  koppelSubs.push(F.onSnapshot(F.doc(db, "koppelcodes", id), (s) => {
    const x = s.data();
    if (rol === "b") {
      if (!koppel.b || koppel.b.id !== id) return;
      if (!x || x.status === "klaar") { koppel.b = null; bewaarKoppel(); meld(); return; }
      koppel.b.status = x.status; koppel.b.van = x.van || null; meld();
    } else {
      if (!koppel.a || koppel.a.id !== id) return;
      if (!x) { koppel.a = null; bewaarKoppel(); meld(); return; }
      koppel.a.status = x.status;
      if (x.status === "klaar" || x.status === "geweigerd") {
        cloud.koppelResultaat = { email: x.email, geweigerd: x.status === "geweigerd" };
        koppel.a = null; bewaarKoppel();
        F.deleteDoc(F.doc(db, "koppelcodes", id)).catch(() => {});
      }
      meld();
    }
  }, () => {}));
}
// Na herladen: lopende code of verzoek weer volgen
function hervatKoppel() {
  if (koppelSubs.length || koppel.a || koppel.b) return;
  let x = null; try { x = JSON.parse(localStorage.getItem(KOPPEL + "_" + sessie.ik) || "null"); } catch {}
  if (!x || x.uid !== sessie.ik) return;
  if (x.b && x.b.verloopt + 40 * 60e3 > Date.now()) { koppel.b = { ...x.b, status: "open", van: null }; volgCode("b", x.b.id); }
  if (x.a) { koppel.a = { id: x.a, status: "verzocht" }; volgCode("a", x.a); }
}
/** Account B: vraag een koppelcode aan om dit account aan een ander (hoofd)account te linken */
export async function vraagKoppelcode() {
  if (!cloud.gebruiker) throw new Error("Log eerst in");
  if (cloud.hoofdUid) throw new Error(`Dit account is al gelinkt aan ${cloud.hoofdInfo?.email || "een ander account"}.`);
  if ((gebruikerDoc?.aliassen || []).length) throw new Error("Aan dit account zijn zelf al andere accounts gelinkt. Gebruik dit account als hoofd: vul hier de code van het andere account in.");
  const email = cloud.gebruiker.email;
  if (!email) throw new Error("Dit account heeft geen e-mailadres; linken met een code kan dan niet.");
  moetGeverifieerd("accounts te linken");
  const r = crypto.getRandomValues(new Uint32Array(6)), code = [...r].map(x => TEKENS[x % TEKENS.length]).join("");
  const id = await codeHash(email, code), verloopt = Date.now() + 10 * 60e3;
  // alleen uid en je (door Google/Microsoft/de bevestigingsmail gecontroleerde) e-mailadres: niets wat je zelf kunt verzinnen
  await F.setDoc(F.doc(db, "koppelcodes", id), { uid: sessie.ik, email, status: "open", verloopt: F.Timestamp.fromMillis(verloopt) });
  koppelSubs.forEach(f => f()); koppelSubs = [];
  koppel.b = { id, code, verloopt, status: "open", van: null };
  bewaarKoppel(); volgCode("b", id); meld();
  return koppel.b;
}
/** Hoofdaccount A: het e-mailadres en de code van account B invullen → B krijgt een verzoek om te bevestigen */
export async function gebruikKoppelcode(email, code) {
  if (!cloud.gebruiker) throw new Error("Log eerst in");
  if (!isHoofd()) throw new Error("Accounts linken doe je vanuit het hoofdaccount.");
  moetGeverifieerd("accounts te linken");
  email = String(email || "").trim().toLowerCase(); code = String(code || "").replace(/[\s-]/g, "").toUpperCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Vul het e-mailadres van het andere account in");
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("De koppelcode heeft 6 tekens");
  if (email === cloud.gebruiker.email) throw new Error("Dat is het account waarmee je nu bent ingelogd. Vraag de code aan op het andere account.");
  const id = await codeHash(email, code), ref = F.doc(db, "koppelcodes", id);
  const s = await F.getDoc(ref).catch(() => null);
  const x = s?.exists() ? s.data() : null;
  if (!x) throw new Error("Deze combinatie van e-mailadres en code klopt niet, of de code is verlopen.");
  const tot = x.verloopt?.toMillis ? x.verloopt.toMillis() : (x.verloopt?.seconds ?? 0) * 1000;
  if (x.status !== "open" || tot < Date.now()) throw new Error("Deze code is al gebruikt of verlopen. Vraag op het andere account een nieuwe aan.");
  if (x.uid === sessie.ik || cloud.familie.includes(x.uid)) throw new Error("Dit account hoort al bij dit Tijdkompas.");
  await F.updateDoc(ref, { status: "verzocht", van: { uid: sessie.ik, email: cloud.gebruiker.email } });
  koppel.a = { id, email: x.email, status: "verzocht" };
  bewaarKoppel(); volgCode("a", id); meld();
  return koppel.a;
}
/** Account B: het verzoek bevestigen (ja = linken) of weigeren */
export async function beantwoordKoppel(ja) {
  const k = koppel.b;
  if (!k || k.status !== "verzocht" || !k.van?.uid) throw new Error("Er is geen verzoek om te bevestigen");
  const ref = F.doc(db, "koppelcodes", k.id);
  if (!ja) { await F.updateDoc(ref, { status: "geweigerd" }); koppel.b = null; bewaarKoppel(); meld(); return null; }
  if ((gebruikerDoc?.aliassen || []).length || cloud.hoofdUid) throw new Error("Dit account is intussen al gelinkt.");
  moetGeverifieerd("accounts te linken");
  const A = k.van, b = F.writeBatch(db);
  b.update(ref, { status: "klaar" });
  b.set(F.doc(db, "gebruikers", sessie.ik), { hoofd: A.uid, aliassen: [A.uid] }, { merge: true });
  b.update(F.doc(db, "gebruikers", A.uid), { aliassen: F.arrayUnion(sessie.ik), [`aliasInfo.${sessie.ik}`]: ikInfo(), koppelcode: k.id });
  await b.commit();
  koppel.b = null; bewaarKoppel();
  cloud.koppelResultaat = { email: A.email };
  opnieuw();   // nu als gelinkt account: lijsten, agenda en planning van het hoofd erbij
  return A;
}
export function stopKoppelcode() {
  const k = koppel.b; if (!k) return;
  F.deleteDoc(F.doc(db, "koppelcodes", k.id)).catch(() => {});
  koppelSubs.forEach(f => f()); koppelSubs = []; koppel.b = null; bewaarKoppel(); meld();
}
