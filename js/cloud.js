// Tijdkompas — inloggen (Google / Microsoft) en online opslag met delen, via Firebase.
//
// Firestore-indeling:
//   gebruikers/{uid}                 persoonlijk: locaties, beschikbaarheid, instellingen, agenda's, planning,
//                                    plus per lijst je eigen manier van inplannen (lijstInst)
//   lijsten/{lijstId}                gedeeld: naam, kleur, icoon, eigenaar, leden[], ledenInfo{}, uitgenodigd[] (e-mails)
//   lijsten/{lijstId}/items/{id}     taken en projecten van die lijst (zichtbaar voor alle leden)
//
// De app blijft werken met één object in het geheugen (opslag.d). Deze module vertaalt dat heen en weer:
// wijzigingen worden als verschil naar Firestore geschreven, en wijzigingen van anderen komen live binnen.
import { CONFIG } from "./config.js";
import { opslag, sessie, uid as nieuwId, startData } from "./data.js";

const B = "https://www.gstatic.com/firebasejs/10.14.1/";
let A = null, F = null, auth = null, db = null;

export const cloud = { geladen: false, gebruiker: null, uitnodigingen: [], bezig: false, fout: "" };
const luisteraars = new Set();
export const opCloud = (f) => luisteraars.add(f);
const meld = () => luisteraars.forEach(f => { try { f(); } catch {} });
export const cloudIngesteld = () => !!CONFIG.firebase?.apiKey;

// ---------- opstarten ----------
export async function cloudStart(test) {
  if (test) { A = test.A; F = test.F; auth = test.auth; db = test.db; A.onAuthStateChanged(auth, (u) => (u ? aangemeld(u) : afgemeld())); cloud.geladen = true; return; }
  if (!cloudIngesteld() || auth) return;
  try {
    const [app, a, f] = await Promise.all([import(B + "firebase-app.js"), import(B + "firebase-auth.js"), import(B + "firebase-firestore.js")]);
    A = a; F = f;
    const fb = app.initializeApp(CONFIG.firebase);
    auth = a.getAuth(fb);
    try { db = f.initializeFirestore(fb, { localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) }); }
    catch { db = f.getFirestore(fb); }
    a.onAuthStateChanged(auth, (u) => (u ? aangemeld(u) : afgemeld()).catch(e => { cloud.fout = e.message; meld(); }));
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
let gebruikerDoc = null;
const bekend = new Map();       // pad → stabiele JSON zoals laatst gezien/geschreven
let geladen = { gebruiker: false, lijsten: false };

function stop() {
  subs.forEach(f => f()); subs = [];
  itemSubs.forEach(f => f()); itemSubs.clear();
  lijstDocs.clear(); itemDocs.clear(); bekend.clear(); gebruikerDoc = null;
  geladen = { gebruiker: false, lijsten: false };
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
  sessie.ik = u.uid;
  meld();
  const ref = F.doc(db, "gebruikers", u.uid);
  let bestaat;
  try { bestaat = (await F.getDocFromServer(ref)).exists(); } catch { bestaat = (await F.getDoc(ref)).exists(); }
  if (!bestaat) await eersteKeer();
  abonneer();
}
function afgemeld() {
  const wasIn = !!cloud.gebruiker;
  stop(); cloud.gebruiker = null; cloud.uitnodigingen = []; sessie.ik = null;
  if (wasIn) opslag.demo();      // gegevens van het account niet op dit apparaat laten staan
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
  for (const x of start.taken) x.toegewezen ||= sessie.ik;
  for (const a of Object.values(start.agendas || {})) if (kaart[a.lijst]) a.lijst = kaart[a.lijst];
  start.demo = false;
  await schrijf(naarDocs(start), new Map());
}

function abonneer() {
  stop();
  const ik = sessie.ik, email = cloud.gebruiker.email;
  subs.push(F.onSnapshot(F.doc(db, "gebruikers", ik), (s) => {
    gebruikerDoc = s.data() || {}; bekend.set("gebruikers/" + ik, stabiel(gebruikerDoc));
    geladen.gebruiker = true; bouwStraks();
  }, fout));
  subs.push(F.onSnapshot(F.query(F.collection(db, "lijsten"), F.where("leden", "array-contains", ik)), (s) => {
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
  if (email) subs.push(F.onSnapshot(F.query(F.collection(db, "lijsten"), F.where("uitgenodigd", "array-contains", email)), (s) => {
    cloud.uitnodigingen = s.docs.filter(x => !(x.data().leden || []).includes(ik)).map(x => {
      const l = x.data(); return { id: x.id, naam: l.naam, icoon: l.icoon, van: l.ledenInfo?.[l.eigenaar]?.naam || "iemand" };
    });
    meld();
  }, () => {}));
}
function fout(e) { cloud.fout = e.message; meld(); }

// ---------- van Firestore naar het geheugen ----------
let bouwTimer = null;
function bouwStraks() { clearTimeout(bouwTimer); bouwTimer = setTimeout(bouw, 30); }
function bouw() {
  if (!geladen.gebruiker || !geladen.lijsten) return;
  // eigen wijzigingen die nog niet weg zijn eerst versturen; de snapshots daarvan bouwen daarna opnieuw
  if (schrijfTimer) { clearTimeout(schrijfTimer); schrijfTimer = null; if (schrijfVerschil() > 0) return; }
  const u = gebruikerDoc || {}, volgorde = u.lijstVolgorde || [];
  const ids = [...lijstDocs.keys()].sort((a, b) => {
    const x = volgorde.indexOf(a), y = volgorde.indexOf(b);
    return (x < 0 ? 1e9 : x) - (y < 0 ? 1e9 : y) || String(lijstDocs.get(a).naam).localeCompare(lijstDocs.get(b).naam);
  });
  const items = ids.flatMap(id => (itemDocs.get(id) || []).map(x => ({ ...x, overzicht: id })));
  const d = {
    locaties: u.locaties, beschikbaar: u.beschikbaar, instellingen: u.instellingen, agendas: u.agendas || {}, extern: u.extern || {},
    planning: u.planning || [], bezet: u.bezet || [], agendaSync: u.agendaSync, gewijzigd: u.gewijzigd,
    overzichten: ids.map(id => {
      const l = lijstDocs.get(id);
      return { id, naam: l.naam, kleur: l.kleur, icoon: l.icoon, eigenaar: l.eigenaar, leden: l.leden || [], ledenInfo: l.ledenInfo || {},
               uitgenodigd: l.uitgenodigd || [], modus: "vrij", locatie: "", tijden: [], doelAgenda: null, ...(u.lijstInst?.[id] || {}) };
    }),
    taken: items.filter(x => x.type === "taak"), projecten: items.filter(x => x.type === "project"), demo: false,
  };
  opslag.vervang(d, { stil: true });
}

// ---------- van het geheugen naar Firestore ----------
const PERSOONLIJK = ["modus", "locatie", "tijden", "doelAgenda"];
function naarDocs(d) {
  const ik = sessie.ik, docs = new Map();
  docs.set("gebruikers/" + ik, schoon({
    locaties: d.locaties, beschikbaar: d.beschikbaar, instellingen: d.instellingen, agendas: d.agendas || {}, extern: d.extern || {},
    planning: d.planning || [], bezet: d.bezet || [], agendaSync: d.agendaSync || "", gewijzigd: d.gewijzigd || "",
    lijstVolgorde: d.overzichten.map(o => o.id),
    lijstInst: Object.fromEntries(d.overzichten.map(o => [o.id, Object.fromEntries(PERSOONLIJK.map(k => [k, o[k] ?? null]))])),
  }));
  for (const o of d.overzichten) {
    docs.set("lijsten/" + o.id, schoon({
      naam: o.naam, kleur: o.kleur, icoon: o.icoon, eigenaar: o.eigenaar || ik,
      leden: o.leden?.length ? o.leden : [ik], ledenInfo: o.ledenInfo && Object.keys(o.ledenInfo).length ? o.ledenInfo : { [ik]: ikInfo() },
      uitgenodigd: (o.uitgenodigd || []).map(e => e.toLowerCase()),
    }));
  }
  for (const x of [...d.taken, ...d.projecten]) {
    if (!d.overzichten.some(o => o.id === x.overzicht)) continue;
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
  }
  if (opruimen) for (const pad of [...bekend.keys()]) {
    if (gewenst.has(pad)) continue;
    const delen = pad.split("/");
    if (delen[0] === "lijsten" && delen.length === 2) {
      const l = lijstDocs.get(delen[1]);
      if (!l || l.eigenaar === ik) ops.push(["del", pad]);
      else ops.push(["verlaat", pad]);                                   // andermans lijst: alleen jezelf eruit halen
    } else if (delen[0] === "lijsten" && delen.length === 4) {
      const l = lijstDocs.get(delen[1]);
      if (gewenst.has("lijsten/" + delen[1]) || l?.eigenaar === ik) ops.push(["del", pad]);
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
      else b.update(ref, { leden: F.arrayRemove(ik), [`ledenInfo.${ik}`]: F.deleteField() });
    }
    klaar.push(b.commit());
  }
  Promise.all(klaar).then(() => { cloud.fout = ""; }).catch(e => { cloud.fout = "Opslaan mislukt: " + e.message; })
    .finally(() => { cloud.bezig = false; meld(); });
  if (oud !== bekend) return Promise.all(klaar).then(() => ops.length);
  return ops.length;
}

// ---------- delen ----------
export async function accepteer(id) {
  const ik = sessie.ik;
  await F.updateDoc(F.doc(db, "lijsten", id), { leden: F.arrayUnion(ik), uitgenodigd: F.arrayRemove(cloud.gebruiker.email), [`ledenInfo.${ik}`]: ikInfo() });
}
export async function weiger(id) {
  await F.updateDoc(F.doc(db, "lijsten", id), { uitgenodigd: F.arrayRemove(cloud.gebruiker.email) });
}
export const ingelogd = () => !!cloud.gebruiker;
