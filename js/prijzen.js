// Tijdkompas — prijzen van supermarkten vergelijken (voor de boodschappenlijst)
// Bron: de open dataset van Checkjebon.nl (MIT, dagelijks bijgewerkt, ± 100.000 producten van AH, Jumbo, Lidl, Plus, Dirk, …).
// Een GitHub Action van Tijdkompas (tools/prijzen.mjs) houdt daar elke dag een geschiedenis van bij en zet het resultaat,
// mét "normale prijs" per product, op de tak `data`: zo herkent de app wanneer iets nu duidelijk goedkoper is dan gewoonlijk.
// Lukt dat niet, dan haalt de app de dataset rechtstreeks bij Checkjebon (dan zonder aanbiedingen).
// Alles hieronder behalve laadPrijzen() is pure logica (ook in Node te testen).

export const PRIJS_URL = "https://raw.githubusercontent.com/brennyc86/tijdkompas/data/prijzen.json.gz";
export const CHECKJEBON_URL = "https://www.checkjebon.nl/data/supermarkets.json";

// ---------- tekst ----------
const STOP = new Set("de het een en van voor met in op of per x ca stuk stuks st pak fles zak doos los".split(" "));
const EENHEID = /^(\d+([.,]\d+)?|ml|cl|dl|l|ltr|liter|g|gr|gram|kg|kilo|mg)$/;
const VAST = { eieren: "ei", eitje: "ei", eitjes: "ei", bio: "biologisch", biologische: "biologisch", wc: "toilet", tp: "toiletpapier",
               aardappels: "aardappel", aardappelen: "aardappel", kipfilet: "kipfilet", kippenfilet: "kipfilet" };
export function normaal(s) {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9.,%+]+/g, " ").trim();
}
/** Stam van een woord: meervoud en buigings-e eraf, dubbele klinker/medeklinker samen (bananen ~ banaan, halfvolle ~ halfvol) */
const stamCache = new Map();
export function stam(w) {
  let c = stamCache.get(w); if (c !== undefined) return c;
  c = stamRuw(w); if (stamCache.size < 200000) stamCache.set(w, c); return c;
}
function stamRuw(w) {
  if (VAST[w]) return VAST[w];
  let s = w;
  if (s.length > 4 && s.endsWith("en")) s = s.slice(0, -2);
  else if (s.length > 4 && s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  else if (s.length > 4 && s.endsWith("e") && !s.endsWith("je")) s = s.slice(0, -1);
  if (s.length > 5 && s.endsWith("je")) s = s.slice(0, -2);              // verkleinwoord: theelichtje ~ theelicht, lampje ~ lamp
  s = s.replace(/v$/, "f").replace(/z$/, "s");                          // schroeven ~ schroef, kazen ~ kaas
  s = s.replace(/([aeou])\1/g, "$1").replace(/([bcdfgklmnprstvz])\1$/, "$1");
  return s;
}
// Productsoorten: staat zo'n woord in een productnaam maar niet in je boodschap, dan is het waarschijnlijk iets anders
// ("melk" ≠ "Digestive melk"-koekjes, "kaas" ≠ "Houtovenpizza kaas")
const RUIS = new Set(["pizza", "gratin", "spaghetti", "tagliatelle", "macaroni", "pasta", "noedel", "lasagne", "salade", "slaatje", "creamer", "muesli", "granola",
  "wafel", "koek", "koekje", "biscuit", "digestive", "reep", "chocolade", "choco", "hagelslag", "chip", "saus", "smaak", "drop", "snoep", "ijs", "soep", "taart",
  "cake", "bonbon", "toffe", "snack", "kroket", "cracker", "crisp", "popcorn", "gebak", "worst", "grillworst", "spread", "dressing", "pudding", "vla", "toetje",
  "candy", "gum", "kauwgom", "pastille", "marinade", "kruidenmix", "mix", "bakmix", "aroma", "geur", "shampo", "douchegel", "zeep", "dip", "tortellini",
  "ravioli", "vochtig", "doekje", "tablet", "capsule", "wrap", "tosti", "croissant", "bagel", "maaltijd", "ovenschotel"].map(w => stam(w)));
// ook samenstellingen: houtovenpizza, koffiesnoepjes, thuisbakmix
const ruisCache = new Map();
const isRuis = (w) => { let r = ruisCache.get(w); if (r === undefined) { r = RUIS.has(w) || [...RUIS].some(x => x.length >= 4 && (w.endsWith(x) || w.startsWith(x)) && w !== x); if (ruisCache.size < 200000) ruisCache.set(w, r); } return r; };
// Na deze woorden komt een bijzaak: "gratin met kaas", "creamer voor koffie", "chips paprika smaak"
const VOEGWOORD = new Set(["met", "voor", "en", "in", "op", "smaak", "van", "a", "la"]);
const woordenUit = (t) => t.split(" ").filter(w => w && !STOP.has(w) && !EENHEID.test(w));
export const woorden = (s) => woordenUit(normaal(s));
export const stammen = (s) => [...new Set(woorden(s).map(stam))];

// ---------- inhoud: "1,5 liter", "6 x 1 L", "Per 1000 ml", "4 x 125 g", "per stuk" ----------
/** @returns {{q:number, e:"l"|"kg"|"st"}|null} hoeveelheid in liter, kilo of stuks */
export function leesMaat(s) {
  const t = normaal(s).replace(/,/g, ".");
  if (!t) return null;
  let m = t.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(ml|cl|dl|l|ltr|liter|g|gr|gram|kg|kilo)\b/);
  let n = 1, q, e;
  if (m) { n = +m[1]; q = +m[2]; e = m[3]; }
  else if ((m = t.match(/(\d+(?:\.\d+)?)\s*(ml|cl|dl|l|ltr|liter|liters|g|gr|gram|kg|kilo|kilogram)\b/))) { q = +m[1]; e = m[2]; }
  else if ((m = t.match(/(\d+)\s*(stuks|stuk|st|rollen|rol|tabletten|zakjes|capsules|pads)\b/))) return { q: +m[1], e: "st" };
  else if (/per (stuk|st)\b|^stuk$/.test(t)) return { q: 1, e: "st" };
  else if (/per (kilo|kg)\b/.test(t)) return { q: 1, e: "kg" };
  else return null;
  const f = { ml: [0.001, "l"], cl: [0.01, "l"], dl: [0.1, "l"], l: [1, "l"], ltr: [1, "l"], liter: [1, "l"], liters: [1, "l"],
              g: [0.001, "kg"], gr: [0.001, "kg"], gram: [0.001, "kg"], kg: [1, "kg"], kilo: [1, "kg"], kilogram: [1, "kg"] }[e];
  if (!f || !q) return null;
  return { q: n * q * f[0], e: f[1] };
}
export const eenheidNaam = { l: "liter", kg: "kilo", st: "stuk" };

// ---------- index ----------
/**
 * Bouwt een zoekindex uit [{n:"ah", c:"AH", u:"https://…/", d:[{n,l,p,s,w?,v?}]}].
 * w = normale prijs (alleen als het nu een aanbieding is), v = sinds wanneer (datum).
 */
export function maakIndex(ketens) {
  const b = indexBouwer(ketens);
  for (const [ki, k] of ketens.entries()) for (const x of k.d || []) b.voeg(x, ki);
  return b.klaar();
}
/** Zelfde, maar in stukjes, zodat de pagina blijft reageren (op een telefoon duurt het opbouwen een paar seconden) */
export async function maakIndexRustig(ketens, stap = 3000) {
  const b = indexBouwer(ketens); let n = 0;
  for (const [ki, k] of ketens.entries()) for (const x of k.d || []) { b.voeg(x, ki); if (++n % stap === 0) await new Promise(r => setTimeout(r, 0)); }
  return b.klaar();
}
function indexBouwer(ketens) {
  const producten = [], perWoord = new Map(), merkTel = new Map();
  return {
    voeg(x, ki) {
      if (!x || typeof x.n !== "string" || !(x.p > 0)) return;
      const t = normaal(x.n), ruw = t.split(" ");
      const st = woordenUit(t).map(stam), zw = [];
      for (let j = 0, na = false; j < ruw.length; j++) { if (VOEGWOORD.has(ruw[j])) na = true; else if (na) zw.push(stam(ruw[j])); }
      const maat = leesMaat(x.s) || leesMaat(x.n);
      producten.push({ k: ki, n: x.n, l: x.l || "", p: Math.round(x.p * 100) / 100, s: x.s || "", st, maat,
                       pe: maat ? x.p / maat.q : null, w: x.w > x.p ? x.w : 0, v: x.v || "",
                       zw: zw.length ? zw : null, ruis: st.filter(isRuis) });
      if (st[0]) merkTel.set(st[0], (merkTel.get(st[0]) || 0) + 1);
    },
    klaar() {
      // merknamen: woorden die heel vaak vooraan staan (AH, Jumbo, Arla, Campina…) tellen niet mee als "inhoud" van de naam
      const merken = new Set([...merkTel].filter(([, n]) => n >= 40).map(([w]) => w));
      producten.forEach((p, i) => {
        p.inhoud = p.st.filter((w, j) => !(j === 0 && merken.has(w))).length || 1;
        for (const w of new Set(p.st)) { let a = perWoord.get(w); if (!a) perWoord.set(w, a = []); a.push(i); }
      });
      return { ketens: ketens.map(k => ({ n: k.n, c: k.c, u: k.u })), producten, perWoord, woordenLijst: [...perWoord.keys()], merken };
    },
  };
}

// Welke index-woorden passen bij een zoekwoord: precies dezelfde stam, of een samenstelling die erop eindigt (volkoren|brood)
function passend(idx, q) {
  const exact = idx.perWoord.has(q) ? [q] : [];
  const samen = q.length >= 4 ? idx.woordenLijst.filter(w => w !== q && w.length >= q.length + 3 && w.endsWith(q)) : [];
  return { exact, samen };
}

/**
 * Zoek producten voor een boodschap ("melk", "halfvolle melk", "Arla biologische halfvolle melk 1,5 l").
 * @returns {{treffers: object[], perKeten: Map<number, object>, eenheid: string|null, aantal: number}}
 *   treffers = relevante producten (beste eerst); perKeten = goedkoopste passende product per keten.
 */
export function zoek(idx, tekst, { ketens = null } = {}) {
  const leeg = { treffers: [], perKeten: new Map(), eenheid: null, aantal: 0 };
  if (!idx) return leeg;
  const qs = stammen(tekst);
  if (!qs.length) return leeg;
  const vraagMaat = leesMaat(tekst);
  // per zoekwoord: welke producten (exact of als samenstelling)
  const sets = qs.map(q => {
    const { exact, samen } = passend(idx, q), ex = new Set(), sa = new Set();
    for (const w of exact) for (const i of idx.perWoord.get(w)) ex.add(i);
    for (const w of samen) for (const i of idx.perWoord.get(w)) if (!ex.has(i)) sa.add(i);
    return { ex, sa };
  });
  // kandidaten: alle zoekwoorden moeten erin zitten; liefst allemaal als los woord
  const kleinste = sets.reduce((a, b) => (a.ex.size + a.sa.size <= b.ex.size + b.sa.size ? a : b));
  let kand = [];
  for (const i of [...kleinste.ex, ...kleinste.sa]) {
    let score = 0, ok = true, samengesteld = 0;
    const p = idx.producten[i];
    for (const [j, s] of sets.entries()) {
      if (s.ex.has(i)) score += p.zw?.includes(qs[j]) ? 0.3 : 1;      // na "met"/"voor": bijzaak
      else if (s.sa.has(i)) { score += 0.35; samengesteld++; } else { ok = false; break; }
    }
    if (!ok) continue;
    if (p.ruis.some(w => !qs.includes(w) && !qs.some(q => w.endsWith(q) && q.length >= 4))) score *= 0.3;              // een ander soort product
    if (ketens && !ketens.includes(idx.ketens[p.k].n)) continue;
    kand.push({ i, p, score: score / Math.max(p.inhoud, qs.length), samengesteld });
  }
  const zuiver = kand.filter(x => !x.samengesteld && x.score >= 0.25);
  if (zuiver.length >= 3) kand = zuiver;                          // "melk": geen chocolademelk als er gewone melk genoeg is
  if (!kand.length) return leeg;
  // eenheid: wat de meeste treffers hebben (melk → liter; dan valt melkchocolade in kilo's af)
  const tel = new Map(); for (const x of kand) if (x.p.maat) tel.set(x.p.maat.e, (tel.get(x.p.maat.e) || 0) + x.score);
  const eenheid = vraagMaat?.e || [...tel].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  if (eenheid) kand = kand.filter(x => !x.p.maat || x.p.maat.e === eenheid);
  if (vraagMaat) {                                                 // "1,5 l" gevraagd: alleen (ongeveer) die maat
    const zelfde = kand.filter(x => x.p.maat && Math.abs(x.p.maat.q - vraagMaat.q) / vraagMaat.q < 0.08);
    if (zelfde.length) kand = zelfde;
  }
  const top = Math.max(...kand.map(x => x.score));
  kand = kand.filter(x => x.score >= top * 0.45);
  kand.sort((a, b) => b.score - a.score || (a.p.pe ?? 1e9) - (b.p.pe ?? 1e9) || a.p.p - b.p.p);
  // gangbare verpakking: geen grootverpakking (6 liter melk) als goedkoopste kiezen voor "melk" op je lijstje
  const maten = kand.filter(x => x.p.maat).map(x => x.p.maat.q).sort((a, b) => a - b);
  const gewoon = maten.length ? maten[maten.length >> 1] * 2.5 : Infinity;
  const perKeten = new Map();
  for (const x of kand) {
    if (!vraagMaat && x.p.maat && x.p.maat.q > gewoon && kand.some(y => y.p.k === x.p.k && y.p.maat && y.p.maat.q <= gewoon)) continue;
    const oud = perKeten.get(x.p.k);
    // goedkoopste per keten: op prijs per liter/kilo als die er is, anders gewoon de prijs
    const beter = !oud || (x.p.pe != null && (oud.pe == null || x.p.pe < oud.pe)) || (x.p.pe == null && oud.pe == null && x.p.p < oud.p);
    if (beter) perKeten.set(x.p.k, x.p);
  }
  return { treffers: kand.map(x => x.p), perKeten, eenheid, aantal: kand.length };
}

/** Hoeveel keuze laat deze omschrijving nog over? 1 = alleen een soort (drinken) … 4 = precies één product */
export function keuzeRuimte(res, tekst) {
  const n = res.aantal;
  if (!n) return 0;
  if (leesMaat(tekst) && n <= 12) return 4;
  return n > 250 ? 1 : n > 60 ? 2 : n > 12 ? 3 : 4;
}

/**
 * Hoe kun je specifieker worden? Veelvoorkomende woorden in de namen van de treffers die nog niet in je omschrijving staan
 * (melk → halfvolle, volle, biologisch, karne…; plus merken).
 */
export function verfijningen(idx, res, tekst, max = 8) {
  if (!res.treffers.length) return [];
  const al = new Set(stammen(tekst)), tel = new Map(), vb = new Map();
  for (const p of res.treffers.slice(0, 600)) {
    const ws = woorden(p.n);
    for (const w of new Set(ws)) {
      const s = stam(w);
      if (al.has(s) || w.length < 3 || /\d/.test(w)) continue;
      tel.set(s, (tel.get(s) || 0) + 1);
      if (!vb.has(s)) vb.set(s, w);
    }
  }
  const n = Math.min(res.treffers.length, 600);
  return [...tel].filter(([, c]) => c >= Math.max(3, n * 0.04) && c < n * 0.9).sort((a, b) => b[1] - a[1]).slice(0, max)
    .map(([s, c]) => ({ woord: vb.get(s), merk: idx.merken.has(s), aantal: c }));
}

/** Aanbiedingen onder de treffers: nu minstens 10% onder de normale prijs */
export const aanbiedingen = (res) => res.treffers.filter(p => p.w && p.p <= p.w * 0.9).sort((a, b) => (a.p / a.w) - (b.p / b.w));

export const productUrl = (idx, p) => { const u = idx.ketens[p.k]?.u || ""; return /^https:\/\//.test(u) && p.l ? u + p.l : ""; };

// ---------- laden (browser) ----------
let geladen = null;   // Promise<index>
export const prijsStand = { bron: "", datum: "", fout: "", bezig: false };
/** Laadt de prijzen (hooguit één keer per dag van internet; anders uit de cache van de browser) */
export function laadPrijzen() {
  if (geladen) return geladen;
  prijsStand.bezig = true;
  geladen = (async () => {
    // de cache van de browser is een extraatje: weigert of hangt hij (privévenster, sommige browsers), dan zonder
    const metTijd = (p, ms = 1500) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]).catch(() => null);
    const cache = typeof caches !== "undefined" ? await metTijd(caches.open("tk-prijzen")) : null;
    const vers = async (url) => {
      const oud = cache && await metTijd(cache.match(url));
      if (oud && Date.now() - Number(oud.headers.get("x-tk-tijd") || 0) < 20 * 3600e3) return oud;
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) { if (oud) return oud; throw new Error("HTTP " + r.status); }
      const buf = await r.arrayBuffer();
      const kopie = new Response(buf, { headers: { "x-tk-tijd": String(Date.now()), "content-type": r.headers.get("content-type") || "" } });
      if (cache) metTijd(cache.put(url, kopie.clone()), 10000);
      return kopie;
    };
    let ruw;
    try {
      const r = await vers(PRIJS_URL);
      const tekst = await new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).text();
      ruw = JSON.parse(tekst); prijsStand.bron = "tijdkompas"; prijsStand.datum = ruw.datum || "";
    } catch (e) {
      const r = await vers(CHECKJEBON_URL);
      ruw = { ketens: await r.json() }; prijsStand.bron = "checkjebon"; prijsStand.datum = "";
    }
    return maakIndexRustig(uitDataset(ruw));
  })().then(idx => { prijsStand.bezig = false; prijsStand.fout = ""; return idx; },
             e => { prijsStand.bezig = false; prijsStand.fout = String(e?.message || e); geladen = null; throw e; });
  return geladen;
}
/** Eigen formaat (compacte rijen) of dat van Checkjebon → [{n,c,u,d:[{n,l,p,s,w,v}]}] */
export function uitDataset(ruw) {
  return (ruw.ketens || []).filter(k => k && typeof k.n === "string").map(k => ({
    n: k.n, c: String(k.c || k.n).replace(/\s*\(.*\)\s*$/, "").slice(0, 40), u: typeof k.u === "string" ? k.u : "",
    d: (k.d || []).map(x => Array.isArray(x) ? { n: x[0], l: x[1], p: x[2], s: x[3], w: x[4] || 0, v: x[5] || "" } : x).filter(x => x && x.p > 0),
  })).filter(k => k.d.length);
}
