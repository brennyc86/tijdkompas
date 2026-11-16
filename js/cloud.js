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
// Meerdere inlogs, één Tijdkompas: een hoofdaccount kan andere accounts (bijv. werk, hobby) toevoegen.
//   gebruikers/{hoofd}.aliassen = [uid…]   (alleen het hoofd mag dit wijzigen)
//   gebruikers/{alias}.hoofd    = hoofd-uid (geschreven door het andere account zelf, bij het koppelen)
// Log je in met zo'n ander account, dan zie en bewerk je het Tijdkompas van het hoofd. Alle inlogs staan in
// leden[] van elke lijst en map (dat regelt de app), zodat de bestaande regels per lijst gewoon werken.
//
// Lijsten die in je eigen Drive/OneDrive staan (schijf.js) staan hier alleen als verwijzing in lijstInst
// (naam, icoon, kleur, welk account). Titels en plaatsen van agenda-afspraken, en titels van ingeplande blokken
// uit zulke lijsten, gaan niet naar de cloud: alleen tijden. Dit apparaat onthoudt de titels zelf.
//
// De app blijft werken met één object in het geheugen (opslag.d). Deze module vertaalt dat heen en weer:
// wijzigingen worden als verschil naar Firestore geschreven, en wijzigingen van anderen komen live binnen.
import { CONFIG } from "./config.js";
import { opslag, sessie, uid as nieuwId, startData, isIk } from "./data.js";
import { aanvullen, haak, laadOntbrekende, vergeet } from "./schijf.js";
import { herkenLocatie } from "./plan.js";
import { vingerafdruk } from "./sync.js";

const B = "https://www.gstatic.com/firebasejs/10.14.1/";
let A = null, F = null, auth = null, db = null;
let tweede = null;   // { auth, db }: een tweede Firebase-app om een extra account toe te voegen zonder jezelf uit te loggen

export const cloud = { geladen: false, gebruiker: null, uitnodigingen: [], bezig: false, fout: "",
                       familie: [], aliasInfo: {}, hoofdInfo: null };   // familie: alle uid's van dit Tijdkompas
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
  return e?.message || String(e);
}
// Let op: de popup moet direct binnen de klik openen, daarom is alles vooraf geladen (cloudStart)
export function login(soort) {
  if (!auth) return Promise.reject(new Error(cloudIngesteld() ? "Even geduld, inloggen wordt nog geladen…" : "Inloggen is nog niet geactiveerd"));
  return A.signInWithPopup(auth, aanbieder(soort));
}
export function koppelAccount(soort) { return A.linkWithPopup(auth.currentUser, aanbieder(soort)); }
export async function uitloggen() {
  stop();
  await A.signOut(auth);
  try { await F.clearIndexedDbPersistence?.(db); } catch {}
}

// ---------- staat ----------
let subs = [];
const itemSubs = new Map();     // lijstId → unsubscribe
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
  lijstDocs.clear(); itemDocs.clear(); mapDocs.clear(); wachtend = new Map(); bekend.clear(); gebruikerDoc = null; inGeheugen = new Set();
  geladen = { gebruiker: false, lijsten: false, mappen: false };
  clearTimeout(schrijfTimer); schrijfTimer = null;
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
  cloud.gebruiker = {
    uid: u.uid, naam: u.displayName || u.email || "Gebruiker", email: (u.email || u.providerData.find(p => p.email)?.email || "").toLowerCase(),
    foto: u.photoURL || "", aanbieders: u.providerData.map(p => ({ soort: p.providerId === "google.com" ? "google" : "microsoft", email: p.email || "" })),
  };
  sessie.ik = u.uid; sessie.familie = [u.uid]; cloud.familie = [u.uid];
  meld();
  const ref = F.doc(db, "gebruikers", u.uid);
  let eigen;
  try { eigen = await F.getDocFromServer(ref); } catch { eigen = await F.getDoc(ref); }
  // Hoort deze inlog bij het Tijdkompas van een ander (hoofd)account? Alleen als dat hoofd hem ook echt heeft toegevoegd.
  const hoofd = eigen.exists() ? eigen.data().hoofd : null;
  if (hoofd && hoofd !== u.uid) {
    try {
      const h = await F.getDoc(F.doc(db, "gebruikers", hoofd));
      if (h.exists() && (h.data().aliassen || []).includes(u.uid)) { sessie.ik = hoofd; sessie.familie = [hoofd, ...h.data().aliassen]; cloud.familie = [...sessie.familie]; }
    } catch {}   // niet (meer) toegevoegd: gewoon het eigen Tijdkompas
  }
  if (!eigen.exists() && sessie.ik === u.uid) await eersteKeer();
  abonneer();
}
function afgemeld() {
  const wasIn = !!cloud.gebruiker;
  stop(); cloud.gebruiker = null; cloud.uitnodigingen = []; sessie.ik = null; sessie.familie = []; cloud.familie = []; cloud.aliasInfo = {}; cloud.hoofdInfo = null;
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
    cloud.familie = [ik, ...(gebruikerDoc.aliassen || [])]; sessie.familie = [...cloud.familie];
    cloud.aliasInfo = gebruikerDoc.aliasInfo || {}; cloud.hoofdInfo = gebruikerDoc.profiel || null;
    // als hoofd: eigen naam/e-mail bewaren, zodat andere inlogs kunnen laten zien bij wie ze horen
    if (ik === wie && (!gebruikerDoc.profiel || gebruikerDoc.profiel.email !== cloud.gebruiker.email))
      F.setDoc(F.doc(db, "gebruikers", ik), { profiel: ikInfo() }, { merge: true }).catch(() => {});
    if (ik !== wie && !cloud.familie.includes(wie)) { opnieuw(); return; }   // losgekoppeld terwijl ingelogd
    geladen.gebruiker = true; bouwStraks(); meld();
  }, (e) => (ik !== wie ? opnieuw() : fout(e))));
  subs.push(F.onSnapshot(F.query(F.collection(db, "lijsten"), F.where("leden", "array-contains", wie)), (s) => {
    const nu = new Set();
    s.forEach(doc => {
      nu.add(doc.id); lijstDocs.set(doc.id, doc.data()); bekend.set("lijsten/" + doc.id, stabiel(doc.data()));
      if (!itemSubs.has(doc.id)) itemSubs.set(doc.id, F.onSnapshot(F.collection(db, "lijsten", doc.id, "items"), (si) => {
        for (const k of [...bekend.keys()]) if (k.startsWith(`lijsten/${doc.id}/items/`)) bekend.delete(k);
        itemDocs.set(doc.id, si.docs.map(x => { bekend.set(`lijsten/${doc.id}/items/${x.id}`, stabiel(x.data())); return { ...x.data(), id: x.id }; }));
        bouwStraks();
      }, fout));
    });
    for (const id of [...lijstDocs.keys()]) if (!nu.has(id)) {
      lijstDocs.delete(id); itemDocs.delete(id); itemSubs.get(id)?.(); itemSubs.delete(id);
      for (const k of [...bekend.keys()]) if (k === "lijsten/" + id || k.startsWith(`lijsten/${id}/`)) bekend.delete(k);
    }
    geladen.lijsten = true; bouwStraks();
  }, fout));
  subs.push(F.onSnapshot(F.query(F.collection(db, "mappen"), F.where("leden", "array-contains", wie)), (s) => {
    const nu = new Set();
    s.forEach(doc => { nu.add(doc.id); mapDocs.set(doc.id, doc.data()); bekend.set("mappen/" + doc.id, stabiel(doc.data())); });
    for (const id of [...mapDocs.keys()]) if (!nu.has(id)) { mapDocs.delete(id); bekend.delete("mappen/" + id); }
    geladen.mappen = true; bouwStraks();
  }, fout));
  // Uitnodigingen: per lijst en per map. Een gedeelde map nodigt ook uit voor alles erin; toon alleen de bovenste.
  if (email) for (const soort of ["lijsten", "mappen"]) subs.push(F.onSnapshot(F.query(F.collection(db, soort), F.where("uitgenodigd", "array-contains", email)), (s) => {
    for (const [id, x] of [...wachtend]) if (x.soort === soort) wachtend.delete(id);
    s.docs.filter(x => !(x.data().leden || []).includes(wie)).forEach(x => wachtend.set(x.id, { soort, data: x.data() }));
    const ouderVan = (x) => x.soort === "lijsten" ? x.data.map : x.data.ouder;
    cloud.uitnodigingen = [...wachtend].filter(([, x]) => !wachtend.has(ouderVan(x))).map(([id, x]) => ({
      id, map: x.soort === "mappen", naam: x.data.naam, icoon: x.data.icoon, van: x.data.ledenInfo?.[x.data.eigenaar]?.naam || "iemand",
      aantal: x.soort === "mappen" ? boomVan(id).filter(y => wachtend.get(y)?.soort === "lijsten").length : 0,
    }));
    meld();
  }, () => {}));
}
function fout(e) { cloud.fout = e.message; meld(); }
function opnieuw() { stop(); if (auth.currentUser) aangemeld(auth.currentUser).catch(fout); }

// ---------- meerdere inlogs, één Tijdkompas ----------
export const isHoofd = () => !!cloud.gebruiker && cloud.gebruiker.uid === sessie.ik;
/** Voegt een ander Google-/Microsoft-account toe aan dit Tijdkompas. Moet direct binnen een klik aangeroepen worden (popup). */
export async function voegInlogToe(soort) {
  if (!tweede) throw new Error("Even geduld, inloggen wordt nog geladen…");
  if (!isHoofd()) throw new Error("Accounts toevoegen kan alleen als je inlogt met het hoofdaccount.");
  const r = await A.signInWithPopup(tweede.auth, aanbieder(soort));
  const b = r.user, ik = sessie.ik;
  try {
    if (b.uid === ik || cloud.familie.includes(b.uid)) throw new Error("Dit account hoort al bij dit Tijdkompas.");
    const email = (b.email || b.providerData.find(p => p.email)?.email || "").toLowerCase();
    const zijn = await F.getDoc(F.doc(tweede.db, "gebruikers", b.uid));
    if ((zijn.data()?.aliassen || []).length) throw new Error(`${email} heeft zelf al andere accounts gekoppeld. Haal die daar eerst weg, of voeg dit account juist daar toe.`);
    // 1. het hoofd keurt goed  2. het andere account wijst naar het hoofd
    await F.updateDoc(F.doc(db, "gebruikers", ik), { aliassen: F.arrayUnion(b.uid), [`aliasInfo.${b.uid}`]: { email, naam: b.displayName || email, foto: b.photoURL || "" } });
    await F.setDoc(F.doc(tweede.db, "gebruikers", b.uid), { hoofd: ik }, { merge: true });
    // 3. wat het andere account al had (lijsten en mappen) samenvoegen: hele familie erbij, eigen lijsten op naam van het hoofd
    const fam = [...new Set([...familie(), ik, b.uid])];
    let n = 0;
    for (const soortC of ["mappen", "lijsten"]) {
      const sn = await F.getDocs(F.query(F.collection(tweede.db, soortC), F.where("leden", "array-contains", b.uid)));
      for (const x of sn.docs) {
        const vanHem = x.data().eigenaar === b.uid && (x.data().leden || []).length === 1;
        // lege lijsten die alleen van dat account waren (zoals de standaard Werk/Privé) niet dubbel meenemen
        if (soortC === "lijsten" && vanHem && (await F.getDocs(F.collection(tweede.db, "lijsten", x.id, "items"))).docs.length === 0) {
          await F.deleteDoc(x.ref); continue;
        }
        await F.updateDoc(x.ref, { leden: F.arrayUnion(...fam), ...(x.data().eigenaar === b.uid ? { eigenaar: ik } : {}) });
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
  for (const [soort, docs] of [["lijsten", lijstDocs], ["mappen", mapDocs]])
    for (const [id, x] of docs) if ((x.leden || []).includes(uid))
      await F.updateDoc(F.doc(db, soort, id), { leden: F.arrayRemove(uid), [`ledenInfo.${uid}`]: F.deleteField() }).catch(() => {});
  const d = opslag.d;
  for (const x of [...d.overzichten, ...(d.mappen || [])]) if (x.leden) x.leden = x.leden.filter(u => u !== uid);
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
    locaties: u.locaties, beschikbaar: u.beschikbaar, instellingen: u.instellingen, agendas: u.agendas || {}, extern: u.extern || {},
    planning: u.planning || [], agendaSync: u.agendaSync, gewijzigd: u.gewijzigd, takenlijsten: u.takenlijsten || {}, takenSync: u.takenSync || "",
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
    koers: u.koers || [],
    taken: items.filter(x => x.type === "taak"), projecten: items.filter(x => x.type === "project"), demo: false,
  }, { nieuweToevoegen: false });
  // titels van blokken uit schijflijsten terugzetten (de cloud kent alleen tijden)
  const itemTitel = new Map([...d.taken, ...d.projecten].map(x => [x.id, x.titel]));
  d.planning = d.planning.map(b => b.titel ? b : { ...b, titel: itemTitel.get(b.item) || titels.blok?.[b.id] || "🔒 Niet geladen" });
  opslag.vervang(d, { stil: true });
  inGeheugen = new Set([...d.overzichten.map(o => "lijsten/" + o.id), ...(d.mappen || []).map(m => "mappen/" + m.id),
                        ...[...d.taken, ...d.projecten].map(x => `lijsten/${x.overzicht}/items/${x.id}`)]);
  // nieuw toegevoegd account nog niet overal lid? (bijv. net gekoppeld) → bijwerken
  const fam = familie().filter(u => !exFamilie.has(u));
  if (fam.length > 1 && [...lijstDocs.values(), ...mapDocs.values()].some(x => fam.some(u => !(x.leden || []).includes(u)))) planSchrijven();
  laadOntbrekende(d);
}

// ---------- van het geheugen naar Firestore ----------
const PERSOONLIJK = ["modus", "locatie", "tijden", "doelAgenda", "map"];
// Alle inlogs van dit Tijdkompas horen in elke lijst/map (zonder losgekoppelde: die staan niet meer in familie)
const exFamilie = new Set();
const metFamilie = (leden) => [...new Set([...(leden?.length ? leden : [sessie.ik]), ...familie()])].filter(u => !exFamilie.has(u));   // per gebruiker, ook bij gedeelde lijsten
function naarDocs(d) {
  const ik = sessie.ik, docs = new Map();
  const schijfLijst = new Set(d.overzichten.filter(o => o.opslag).map(o => o.id));
  onthoudTitels(d);
  docs.set("gebruikers/" + ik, schoon({
    locaties: d.locaties, beschikbaar: d.beschikbaar, instellingen: d.instellingen, agendas: d.agendas || {},
    extern: Object.fromEntries(Object.entries(d.extern || {}).map(([k, x]) => { const { titel, ...r } = x; return [k, titel !== undefined && !r.th ? { ...r, th: vingerafdruk(titel) } : r]; })),
    planning: (d.planning || []).map(b => schijfLijst.has(b.overzicht) && b.soort !== "reis" ? { ...b, titel: "" } : b),
    bezet: (d.bezet || []).map(e => ({ ...e, titel: "", plaats: "", loc: e.loc ?? (herkenLocatie(e.plaats) || "") })),
    agendaSync: d.agendaSync || "", gewijzigd: d.gewijzigd || "",
    takenlijsten: d.takenlijsten || {}, takenSync: d.takenSync || "",
    // beheerd buiten naarDocs (meerdere inlogs): ongewijzigd laten staan
    ...(gebruikerDoc?.aliassen ? { aliassen: gebruikerDoc.aliassen, aliasInfo: gebruikerDoc.aliasInfo || {} } : {}),
    ...(gebruikerDoc?.profiel ? { profiel: gebruikerDoc.profiel } : {}),
    ...(gebruikerDoc?.hoofd ? { hoofd: gebruikerDoc.hoofd } : {}),
    lijstVolgorde: d.overzichten.map(o => o.id), mapVolgorde: (d.mappen || []).map(m => m.id),
    mapInst: Object.fromEntries((d.mappen || []).map(m => [m.id, { ouder: m.ouder || "" }])),
    koers: d.koers || [],
    lijstInst: Object.fromEntries(d.overzichten.map(o => [o.id, o.opslag
      ? { opslag: o.opslag, naam: o.naam || "", icoon: o.icoon || "", kleur: o.kleur || "", map: o.map || "" }
      : Object.fromEntries(PERSOONLIJK.map(k => [k, o[k] ?? null]))])),
  }));
  for (const o of d.overzichten) {
    if (o.opslag) continue;
    docs.set("lijsten/" + o.id, schoon({
      naam: o.naam, kleur: o.kleur, icoon: o.icoon, eigenaar: o.eigenaar || ik,
      leden: metFamilie(o.leden), ledenInfo: o.ledenInfo && Object.keys(o.ledenInfo).length ? o.ledenInfo : { [ik]: ikInfo() },
      uitgenodigd: (o.uitgenodigd || []).map(e => e.toLowerCase()), mensen: o.mensen || [], verdeling: o.verdeling || "samen",
      map: isIk(o.eigenaar || ik) ? o.map || "" : lijstDocs.get(o.id)?.map ?? "",        // indeling van de eigenaar
    }));
  }
  for (const m of d.mappen || []) {
    docs.set("mappen/" + m.id, schoon({
      naam: m.naam, icoon: m.icoon, kleur: m.kleur, eigenaar: m.eigenaar || ik,
      ouder: isIk(m.eigenaar || ik) ? m.ouder || "" : mapDocs.get(m.id)?.ouder ?? "",
      leden: metFamilie(m.leden), ledenInfo: m.ledenInfo && Object.keys(m.ledenInfo).length ? m.ledenInfo : { [ik]: ikInfo() },
      uitgenodigd: (m.uitgenodigd || []).map(e => e.toLowerCase()),
    }));
  }
  for (const x of [...d.taken, ...d.projecten]) {
    if (!d.overzichten.some(o => o.id === x.overzicht) || schijfLijst.has(x.overzicht)) continue;
    const { overzicht, ...rest } = x;
    docs.set(`lijsten/${overzicht}/items/${x.id}`, schoon(rest));
  }
  return docs;
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
  const ik = sessie.ik, ops = [];
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
      if (!l || isIk(l.eigenaar)) ops.push(["del", pad]);
      else ops.push(["verlaat", pad]);                                   // andermans lijst: alleen jezelf eruit halen
    } else if (delen[0] === "lijsten" && delen.length === 4) {
      const l = lijstDocs.get(delen[1]);
      if (gewenst.has("lijsten/" + delen[1]) || isIk(l?.eigenaar)) ops.push(["del", pad]);
    }
    bekend.delete(pad);
  }
  if (!ops.length) return ops.length === 0 && oud !== bekend ? Promise.resolve(0) : 0;
  cloud.bezig = true; meld();
  const klaar = [];
  for (let i = 0; i < ops.length; i += 450) {
    const b = F.writeBatch(db);
    for (const [soort, pad, obj] of ops.slice(i, i + 450)) {
      const ref = F.doc(db, pad);
      if (soort === "set") b.set(ref, obj);
      else if (soort === "del") b.delete(ref);
      else b.update(ref, { leden: F.arrayRemove(...familie()), ...Object.fromEntries(familie().map(u => [`ledenInfo.${u}`, F.deleteField()])) });
    }
    klaar.push(b.commit());
  }
  Promise.all(klaar).then(() => { cloud.fout = ""; }).catch(e => { cloud.fout = "Opslaan mislukt: " + e.message; })
    .finally(() => { cloud.bezig = false; meld(); });
  if (oud !== bekend) return Promise.all(klaar).then(() => ops.length);
  return ops.length;
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
