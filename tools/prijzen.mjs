// Tijdkompas — dagelijks prijzen bijwerken (draait in GitHub Actions, zie .github/workflows/prijzen.yml)
//
// Bron: de open dataset van Checkjebon.nl (github.com/supermarkt/checkjebon, MIT-licentie): elke dag de prijzen van
// ± 100.000 producten bij AH, Jumbo, Lidl, Plus, Dirk, Hoogvliet, SPAR, DekaMarkt, Poiesz en Vomar.
// Wij houden daar een geschiedenis van bij (staat.json.gz: per product de prijs van de laatste 35 dagen) en rekenen per
// product een "normale prijs" uit (mediaan van de vorige dagen). Is een product nu minstens 10% goedkoper dan normaal,
// dan is het waarschijnlijk in de aanbieding: dat komt in prijzen.json.gz, dat de app inleest.
// De eerste keer (nog geen staat) halen we de vorige dagen uit de git-geschiedenis van Checkjebon.
//
// Gebruik: node tools/prijzen.mjs <map>   (leest/schrijft <map>/staat.json.gz en <map>/prijzen.json.gz)
// Omgeving: GITHUB_TOKEN (optioneel, voor de GitHub-API), BOOTSTRAP_DAGEN (standaard 28)

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const MAP = process.argv[2] || "uit";
const DAGEN = 35, BOOT = Number(process.env.BOOTSTRAP_DAGEN || 28), MIN_DAGEN = 5, KORTING = 0.9;
const REPO = "supermarkt/checkjebon", PAD = "data/supermarkets.json";
const kop = { "User-Agent": "tijdkompas-prijzen", Accept: "application/vnd.github+json",
              ...(process.env.GITHUB_TOKEN ? { Authorization: "Bearer " + process.env.GITHUB_TOKEN } : {}) };

async function json(url, headers = {}) {
  for (let poging = 1; ; poging++) {
    const r = await fetch(url, { headers });
    if (r.ok) return r.json();
    if (poging >= 3) throw new Error(`${url}: HTTP ${r.status}`);
    await new Promise(z => setTimeout(z, 3000 * poging));
  }
}
/** De laatste n versies van de dataset: [{sha, dag}], nieuwste eerst, één per dag */
async function versies(n) {
  const lijst = await json(`https://api.github.com/repos/${REPO}/commits?path=${PAD}&per_page=${Math.min(100, n + 10)}`, kop);
  const perDag = new Map();
  for (const c of lijst) {
    const dag = (c.commit?.committer?.date || c.commit?.author?.date || "").slice(0, 10);
    if (dag && !perDag.has(dag)) perDag.set(dag, c.sha);
  }
  return [...perDag].slice(0, n).map(([dag, sha]) => ({ dag, sha }));
}
const dataset = (sha) => json(`https://raw.githubusercontent.com/${REPO}/${sha}/${PAD}`);
const sleutel = (keten, p) => keten + "|" + (p.l || p.n);

function leesStaat() {
  try { return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(MAP, "staat.json.gz")))); }
  catch { return null; }
}
/** Een dag in de staat zetten (vervangt dezelfde dag als die er al is) */
function voegDagToe(staat, dag, ketens) {
  let kol = staat.dagen.indexOf(dag);
  if (kol < 0) {
    staat.dagen.push(dag); staat.dagen.sort();
    kol = staat.dagen.indexOf(dag);
    for (const rij of Object.values(staat.prijs)) rij.splice(kol, 0, null);
  }
  const breedte = staat.dagen.length;
  for (const k of ketens) for (const p of k.d || []) {
    if (!(p.p > 0)) continue;
    const s = sleutel(k.n, p);
    let rij = staat.prijs[s];
    if (!rij) rij = staat.prijs[s] = new Array(breedte).fill(null);
    rij[kol] = Math.round(p.p * 100) / 100;
  }
}
function snoei(staat) {
  while (staat.dagen.length > DAGEN) { staat.dagen.shift(); for (const rij of Object.values(staat.prijs)) rij.shift(); }
  for (const [s, rij] of Object.entries(staat.prijs)) if (rij.every(x => x == null)) delete staat.prijs[s];
}
const mediaan = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };

/** Normale prijs en "sinds wanneer goedkoper" voor de laatste dag; null = geen aanbieding */
export function aanbieding(rij, dagen) {
  const nu = rij.at(-1);
  if (!(nu > 0)) return null;
  const eerder = rij.slice(0, -1).filter(x => x > 0);
  if (eerder.length < MIN_DAGEN) return null;
  const normaal = mediaan(eerder);
  if (!(nu <= normaal * KORTING && normaal - nu >= 0.1)) return null;
  let i = rij.length - 1;
  while (i > 0 && rij[i - 1] > 0 && rij[i - 1] <= normaal * KORTING) i--;
  return { w: Math.round(normaal * 100) / 100, v: dagen[i] };
}

async function hoofd() {
  fs.mkdirSync(MAP, { recursive: true });
  const nieuwste = (await versies(1))[0];
  if (!nieuwste) throw new Error("Geen versie van de dataset gevonden");
  console.log("Nieuwste dataset:", nieuwste.dag, nieuwste.sha.slice(0, 10));
  let staat = leesStaat();
  if (!staat?.dagen?.length) {
    staat = { dagen: [], prijs: {} };
    const oud = (await versies(BOOT)).filter(v => v.dag !== nieuwste.dag).reverse();
    console.log(`Geen staat: ${oud.length} eerdere dagen ophalen uit de geschiedenis…`);
    for (const v of oud) {
      try { voegDagToe(staat, v.dag, await dataset(v.sha)); console.log("  +", v.dag); }
      catch (e) { console.log("  overgeslagen", v.dag, e.message); }
    }
  }
  const ketens = await dataset(nieuwste.sha);
  voegDagToe(staat, nieuwste.dag, ketens);
  snoei(staat);
  const kol = staat.dagen.indexOf(nieuwste.dag), tot = kol + 1;
  let aantal = 0, aanb = 0;
  const uit = {
    v: 1, datum: nieuwste.dag, dagen: staat.dagen.length,
    bron: "Checkjebon.nl (github.com/supermarkt/checkjebon, MIT-licentie); aanbiedingen afgeleid uit de prijsgeschiedenis",
    ketens: ketens.map(k => ({
      n: k.n, c: k.c, u: k.u,
      d: (k.d || []).filter(p => p.p > 0).map(p => {
        aantal++;
        const rij = (staat.prijs[sleutel(k.n, p)] || []).slice(0, tot);
        const a = aanbieding(rij, staat.dagen.slice(0, tot));
        const r = [p.n, p.l, Math.round(p.p * 100) / 100, p.s || ""];
        if (a) { aanb++; r.push(a.w, a.v); }
        return r;
      }),
    })).filter(k => k.d.length),
  };
  fs.writeFileSync(path.join(MAP, "prijzen.json.gz"), zlib.gzipSync(JSON.stringify(uit), { level: 9 }));
  fs.writeFileSync(path.join(MAP, "staat.json.gz"), zlib.gzipSync(JSON.stringify(staat), { level: 9 }));
  console.log(`${aantal} producten, ${aanb} aanbiedingen, geschiedenis van ${staat.dagen.length} dagen (${staat.dagen[0]} – ${staat.dagen.at(-1)})`);
  console.log("prijzen.json.gz:", (fs.statSync(path.join(MAP, "prijzen.json.gz")).size / 1e6).toFixed(2), "MB; staat.json.gz:",
              (fs.statSync(path.join(MAP, "staat.json.gz")).size / 1e6).toFixed(2), "MB");
}

const direct = process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) hoofd().catch(e => { console.error(e); process.exit(1); });
