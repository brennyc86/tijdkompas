// Tijdkompas — boodschappenlijst
// Zet er willekeurig iets op, van heel algemeen ("drinken") tot heel precies ("Arla biologische halfvolle melk 1,5 l").
// De lijst deelt alles in naar het soort winkel waar je het haalt (melk → supermarkt, lamp → bouwmarkt), en zoekt bij
// supermarktproducten waar het nu het goedkoopst is en of het ergens in de aanbieding is (zie prijzen.js).
// Wat je zelf indeelt onthoudt de lijst (geleerd), en wat je vaak koopt komt terug als snelle keuze.

import { opslag, bewaar, uid, mijnId, locatie, nieuweTaak, isIk } from "./data.js";
import { dagIndeling, dagStr, plaatsBlok } from "./plan.js";
import { laadPrijzen, prijsStand, zoek, keuzeRuimte, verfijningen, aanbiedingen, productUrl, stammen, stam, woorden, leesMaat, eenheidNaam } from "./prijzen.js";

const d = () => opslag.d;
const B = () => (d().boodschappen ||= leegBs());
export const leegBs = () => ({ items: [], geleerd: {}, historie: {}, ketens: [], voorkeur: {}, favorieten: [] });

// ---------- soorten winkels ----------
export const SOORTEN = [
  { id: "supermarkt", naam: "Supermarkt", icoon: "🛒" },
  { id: "bakker", naam: "Bakker", icoon: "🥖" },
  { id: "slager", naam: "Slager", icoon: "🥩" },
  { id: "markt", naam: "Markt / groenteboer", icoon: "🥕" },
  { id: "drogist", naam: "Drogist", icoon: "🧴" },
  { id: "apotheek", naam: "Apotheek", icoon: "💊" },
  { id: "bouwmarkt", naam: "Bouwmarkt", icoon: "🔨" },
  { id: "tuin", naam: "Tuincentrum", icoon: "🌱" },
  { id: "elektronica", naam: "Elektronica", icoon: "🔌" },
  { id: "wonen", naam: "Huishoud & wonen", icoon: "🏠" },
  { id: "dieren", naam: "Dierenwinkel", icoon: "🐾" },
  { id: "slijterij", naam: "Slijterij", icoon: "🥃" },
  { id: "kantoor", naam: "Boek & kantoor", icoon: "📚" },
  { id: "kleding", naam: "Kleding & schoenen", icoon: "👕" },
  { id: "sport", naam: "Sport & outdoor", icoon: "⛺" },
  { id: "fiets", naam: "Fietsenwinkel", icoon: "🚲" },
  { id: "watersport", naam: "Watersport", icoon: "⚓" },
  { id: "auto", naam: "Auto", icoon: "🚗" },
  { id: "overig", naam: "Nog indelen", icoon: "❔" },
];
export const soort = (id) => SOORTEN.find(s => s.id === id) || SOORTEN.at(-1);

// Woorden per soort winkel. Een samenstelling telt ook (ledlamp → lamp), het langste passende woord wint.
const WOORDEN = {
  supermarkt: `melk brood boterham beschuit ei kaas boter margarine yoghurt kwark vla room slagroom karnemelk koffie koffiebonen thee suiker zout peper meel bloem rijst
    pasta macaroni spaghetti penne noedels mie aardappel friet patat groente fruit appel peer banaan sinaasappel mandarijn citroen limoen druif aardbei framboos blauwe bes
    tomaat komkommer paprika sla ijsbergsla ui sjalot knoflook wortel winterpeen prei broccoli bloemkool spinazie andijvie champignon courgette aubergine avocado mais
    gehakt kip kipfilet kippenpoot worst rookworst ham salami spek speklap hamburger schnitzel vis zalm tonijn kabeljauw garnaal haring pindakaas jam hagelslag honing
    chocopasta cornflakes muesli havermout cracker koek koekje biscuit chips noot pinda snoep chocolade drop frisdrank cola sinas cassis sap jus water spa bier pils
    wijn rosé prosecco ijs pizza soep saus pastasaus mayonaise ketchup mosterd olie olijfolie azijn kruiden bouillon tortilla wrap toiletpapier keukenrol keukenpapier
    afwasmiddel wasmiddel wasverzachter vaatwastablet allesreiniger schoonmaakazijn vuilniszak boterhamzak aluminiumfolie huishoudfolie luier billendoekje batterij
    tofu hummus falafel olijf augurk kappertje bonen linzen kikkererwt couscous bulgur quinoa`,
  bakker: `taart gebak appeltaart vlaai tompouce slagroomtaart verjaardagstaart oliebol appelflap krentenbol`,
  slager: `rollade ossenhaas entrecote tournedos runderlap sukadelap`,
  markt: ``,
  drogist: `shampoo conditioner douchegel deodorant deo tandpasta tandenborstel flosdraad tandenstoker mondwater scheermes scheermesje scheerschuim zonnebrand
    aftersun bodylotion handcreme creme dagcreme nachtcreme makeup mascara foundation lippenbalsem lipstick nagellak nagelvijl watten wattenstaafje wattenschijfje
    maandverband tampon inlegkruisje paracetamol ibuprofen pleister vitamine vitamines neusspray keelpastille condoom haarlak haargel haarelastiek haarspeld
    kam haarborstel oordop oordopjes reisverpakking zakdoek tissue`,
  apotheek: `medicijn medicijnen recept herhaalrecept insuline antibiotica zalf oogdruppels`,
  bouwmarkt: `lamp peertje gloeilamp ledlamp spot spotje ledstrip schroef spijker plug boor boortje boormachine accuboor schroevendraaier bit bitjes hamer zaag
    tang moersleutel waterpomptang inbussleutel verf muurverf lak beits kwast roller afplaktape tape ducttape kit siliconenkit acrylaatkit lijm houtlijm secondelijm
    montagelijm schuurpapier hout plank lat multiplex mdf gips plamuur cement tegel tegellijm voegmiddel stopcontact verlengsnoer stekker schakelaar snoer
    installatiedraad zekering scharnier cilinderslot hangslot deurklink handgreep ladder trapje rolmaat waterpas duimstok isolatie kitpistool emmer rookmelder
    koolmonoxidemelder tochtstrip pvc buis kraan sifon afvoer ontstopper wd40 kruipolie handschoen werkhandschoen stofmasker veiligheidsbril`,
  tuin: `potgrond aarde tuinaarde plant kamerplant bloem bloemen bloembol zaad zaden graszaad mest kunstmest bloempot plantenbak tuinslang hark schoffel spade
    snoeischaar heggenschaar kruiwagen vogelvoer vetbol pindaslinger tuinhandschoen gieter onkruid onkruidverdelger`,
  elektronica: `oplader lader usbkabel usb hdmi koptelefoon oortjes oordopjes headset muis toetsenbord laptop tablet telefoon smartphone hoesje telefoonhoes
    screenprotector printer inkt cartridge toner geheugenkaart sdkaart usbstick ssd router camera tv televisie speaker powerbank adapter verloopstekker`,
  wonen: `handdoek theedoek vaatdoek dekbed dekbedovertrek kussen kussensloop hoeslaken laken kaars theelicht servet pan koekenpan wok bord glas bestek mok beker
    vaas fotolijst opbergbox mand wasmand prullenbak strijkplank wasknijper kapstok gordijn kleed vloerkleed deurmat cadeaupapier inpakpapier schaar
    bakvorm ovenschaal snijplank keukenmes dienblad`,
  dieren: `kattenvoer hondenvoer kattenbak kattenbakvulling brokjes brok hondenbrok kauwbot halsband vogelzaad visvoer knaagdiervoer hooi strooisel krabpaal
    kattensnoepje hondensnack`,
  slijterij: `whisky wodka jenever rum gin likeur cognac port sherry advocaat`,
  kantoor: `pen balpen potlood gum schrift notitieblok printpapier envelop postzegel ordner map nietje nietmachine plakband boek agenda kalender wenskaart
    verjaardagskaart kaart puntenslijper liniaal stift markeerstift post-it memoblok`,
  kleding: `sok sokken ondergoed onderbroek boxershort bh shirt tshirt trui vest broek spijkerbroek jas regenjas jurk rok schoen schoenen sneaker laars
    panty sjaal muts handschoenen pyjama badpak zwembroek bikini`,
  sport: `tent slaapzak luchtbed matje rugzak wandelschoen hardloopschoen bidon voetbal tennisbal yogamat dumbbell gewichten zaklamp hoofdlamp`,
  fiets: `fietsband binnenband buitenband fietslamp fietsverlichting fietsslot kettingslot fietspomp fietsbel bagagedrager fietstas zadel remblok fietsketting
    kettingolie spaak fietshelm bandenplakset ventiel ventielslang`,
  watersport: `zwemvest reddingsvest landvast stootwil fender anker ankerlijn zeil bootshaak antifouling teakolie bilgepomp impeller schoot lijnen marifoon
    navigatieverlichting dekzwabber bootshoes zeilhandschoen`,
  auto: `ruitenvloeistof ruitensproeiervloeistof motorolie ruitenwisser antivries koelvloeistof autoshampoo ijskrabber bandenspanning autolamp`,
};
// Te algemeen voor een prijs, maar wel duidelijk welk soort winkel; met voorstellen om specifieker te worden
const CATEGORIE = {
  drinken: ["supermarkt", "melk", "sap", "frisdrank", "water", "koffie", "thee", "bier", "wijn"],
  drank: ["supermarkt", "frisdrank", "sap", "bier", "wijn", "whisky"],
  fruit: ["supermarkt", "appels", "bananen", "peren", "druiven", "mandarijnen", "aardbeien"],
  groente: ["supermarkt", "tomaten", "komkommer", "paprika", "sla", "wortels", "broccoli", "uien"],
  vlees: ["supermarkt", "gehakt", "kipfilet", "speklappen", "rookworst", "biefstuk"],
  vis: ["supermarkt", "zalm", "kabeljauw", "garnalen", "tonijn", "haring"],
  beleg: ["supermarkt", "kaas", "ham", "pindakaas", "hagelslag", "jam", "smeerkaas"],
  broodbeleg: ["supermarkt", "kaas", "ham", "pindakaas", "hagelslag", "jam"],
  zuivel: ["supermarkt", "melk", "yoghurt", "kwark", "vla", "boter", "kaas"],
  ontbijt: ["supermarkt", "brood", "muesli", "havermout", "cornflakes", "eieren"],
  snoep: ["supermarkt", "drop", "chocolade", "winegums", "kauwgom"],
  snacks: ["supermarkt", "chips", "nootjes", "borrelnootjes", "kaasstengels"],
  avondeten: ["supermarkt", "pasta", "rijst", "aardappelen", "groente", "vlees"],
  schoonmaak: ["supermarkt", "allesreiniger", "afwasmiddel", "wasmiddel", "vaatwastabletten", "wc-reiniger"],
  schoonmaakmiddel: ["supermarkt", "allesreiniger", "afwasmiddel", "wc-reiniger", "glasreiniger"],
  verzorging: ["drogist", "shampoo", "douchegel", "deodorant", "tandpasta"],
  toiletartikelen: ["drogist", "shampoo", "tandpasta", "deodorant", "scheermesjes"],
  medicijnen: ["drogist", "paracetamol", "ibuprofen", "pleisters", "neusspray"],
  gereedschap: ["bouwmarkt", "schroevendraaier", "hamer", "boormachine", "tang", "rolmaat"],
  klusspullen: ["bouwmarkt", "schroeven", "pluggen", "kit", "verf", "tape"],
  dierenvoer: ["dieren", "kattenvoer", "hondenvoer", "vogelzaad"],
  cadeau: ["overig", "boek", "bloemen", "chocolade", "cadeaubon"],
  kleren: ["kleding", "sokken", "ondergoed", "shirt", "broek"],
};
const lijstVan = (s) => s.split(/\s+/).filter(Boolean);
const WOORD_SOORT = new Map();     // stam → soort
for (const [s, tekst] of Object.entries(WOORDEN)) for (const w of lijstVan(tekst)) for (const st of stammen(w)) if (!WOORD_SOORT.has(st)) WOORD_SOORT.set(st, s);
const CAT = new Map(Object.entries(CATEGORIE).map(([w, v]) => [stam(w), { soort: v[0], voorstel: v.slice(1) }]));

/** Sleutel voor "dit heb ik zelf ingedeeld": de stammen op volgorde; plus het laatste woord (meestal het zelfstandig naamwoord) */
const sleutel = (t) => stammen(t).sort().join(" ");
const hoofdwoord = (t) => { const s = woorden(t).map(stam); return s.at(-1) || ""; };

/** Is dit een categorie (drinken, fruit, gereedschap…) in plaats van een product? */
export function categorie(tekst) {
  const s = stammen(tekst);
  return s.length === 1 && CAT.has(s[0]) ? CAT.get(s[0]) : null;
}

// ---------- prijzen (in het geheugen, per omschrijving) ----------
let idx = null, opnieuw = () => {};
const zoekCache = new Map();
function prijsVan(tekst, bij = ketens()) {
  if (!idx || categorie(tekst)) return null;
  const k = tekst.toLowerCase().trim() + "|" + bij.join(",");
  if (!zoekCache.has(k)) { if (zoekCache.size > 800) zoekCache.clear(); zoekCache.set(k, zoek(idx, tekst, { ketens: bij.length ? bij : null })); }
  return zoekCache.get(k);
}
/** De supermarkten waar je wilt vergelijken: zelf gekozen, anders die van je eigen winkels, anders allemaal ([]) */
const ketens = () => {
  const eigen = (B().ketens || []).length ? B().ketens : [...new Set(winkels().flatMap(w => w.ketens || []))];
  return eigen.filter(n => !idx || idx.ketens.some(k => k.n === n));
};

// ---------- favorieten: je vaste, precieze producten ----------
// Een favoriet is een precieze omschrijving ("Arla biologische halfvolle melk 1 l"). Zet je iets algemeens op je lijstje ("melk"),
// dan kijkt Tijdkompas naar de prijzen en aanbiedingen van je favoriet(en) in plaats van naar alle melk. Per item uit te zetten (geenFav).
const favs = () => (B().favorieten ||= []);
const FAV_MAX = 200;
const isFavoriet = (tekst) => { const k = sleutel(tekst); return !!k && favs().some(f => sleutel(f.tekst) === k); };
const dektWoord = (s, b, samen) => b.some(w => w === s || (samen && s.length >= 3 && w.length > s.length && w.endsWith(s)));
/** Welke favorieten vallen onder dit item? "melk" → je favoriete melk; "drinken" → je favoriete melk, sap, frisdrank… */
export function favorietenVoor(it) {
  if (!favs().length || it.geenFav) return [];
  const k = sleutel(it.tekst); if (!k) return [];
  const cat = categorie(it.tekst), a = stammen(it.tekst);
  const past = (samen) => favs().filter(f => {
    const b = stammen(f.tekst);
    if (sleutel(f.tekst) === k) return false;                                   // het item ís de favoriet
    if (cat) return cat.voorstel.some(v => stammen(v).every(s => dektWoord(s, b, true)));
    return b.length > a.length && a.every(s => dektWoord(s, b, samen));     // de favoriet is preciezer dan wat je opschreef
  });
  const los = past(false);                                                       // liefst als los woord: "melk" → niet je chocolademelk
  return los.length ? los : past(true);
}
/** Per liter/kilo als dat kan (zelfde eenheid), anders op prijs */
const goedkoper = (a, b) => a.pe != null && b.pe != null && a.maat?.e === b.maat?.e ? a.pe < b.pe : a.p < b.p;
const opPrijs = (a, b) => (goedkoper(a, b) ? -1 : goedkoper(b, a) ? 1 : 0);
/** Prijzen van één favoriet: per supermarkt het passende product */
const favPrijs = (f, bij = ketens()) => { const r = prijsVan(f.tekst, bij); return r?.perKeten.size ? r : null; };
/** Prijs voor een item op je lijst: via je favorieten als die eronder vallen (en prijzen hebben), anders gewoon op de omschrijving */
function prijsItem(it, bij = ketens()) {
  if (!idx) return null;
  const fs = favorietenVoor(it).map(f => ({ f, r: favPrijs(f, bij) })).filter(x => x.r);
  if (!fs.length) return prijsVan(it.tekst, bij);
  const perKeten = new Map(), treffers = [];
  for (const { f, r } of fs) for (const p of r.perKeten.values()) {
    const q = { ...p, fav: f.tekst }; treffers.push(q);
    const oud = perKeten.get(p.k); if (!oud || goedkoper(q, oud)) perKeten.set(p.k, q);
  }
  return { treffers, perKeten, eenheid: fs[0].r.eenheid, aantal: treffers.length, favs: fs.map(x => x.f) };
}
function favorietBij(tekst, bron) {
  const t = String(tekst || "").replace(/\s+/g, " ").trim().slice(0, 120); if (!t) return false;
  const k = sleutel(t), i = favs().findIndex(f => sleutel(f.tekst) === k);
  if (i >= 0) { favs().splice(i, 1); toast(`„${t}” is geen favoriet meer`); bewaar(); return false; }
  if (favs().length >= FAV_MAX) { toast(`Maximaal ${FAV_MAX} favorieten`); return false; }
  favs().push({ id: uid(), tekst: t, ...(bron ? { bron } : {}), gemaakt: new Date().toISOString().slice(0, 10) });
  toast(`⭐ „${t}” is nu een favoriet — zet je iets algemeens op je lijstje, dan kijkt Tijdkompas naar deze`); bewaar(); return true;
}
/** Je favorieten die nu in de aanbieding zijn (ook als ze niet op je lijst staan): om in te slaan */
export function favorietenAanbod() {
  if (!idx) return [];
  return favs().map(f => { const r = favPrijs(f); const a = r && aanbiedingen({ treffers: [...r.perKeten.values()] })[0]; return a ? { f, p: a } : null; })
    .filter(Boolean).sort((x, y) => (x.p.p / x.p.w) - (y.p.p / y.p.w));
}

// ---------- je eigen winkels (locaties met soort "winkel") ----------
// Een winkel of winkelcentrum is een locatie met: welke supermarkten (ketens) en soorten winkels er zitten, en hoe je er komt:
// "langs" = even heen vanaf huis (reistijd = enkele reis), "route" = op de terugweg van een andere locatie (bv. kantoor; omweg in min).
export const KETENS = [["ah", "AH"], ["jumbo", "Jumbo"], ["lidl", "Lidl"], ["aldi", "ALDI"], ["plus", "PLUS"], ["dirk", "Dirk"], ["hoogvliet", "Hoogvliet"],
  ["spar", "SPAR"], ["dekamarkt", "DekaMarkt"], ["poiesz", "Poiesz"], ["vomar", "Vomar"], ["coop", "Coop"], ["janlinders", "Jan Linders"], ["ekoplaza", "Ekoplaza"]];
export const winkels = () => (d().locaties || []).filter(l => l.soort === "winkel");
const winkelSoorten = (w) => new Set([...(w.soorten || []), ...((w.ketens || []).length ? ["supermarkt"] : [])]);
const winkeltijd = (n) => Math.min(45, 10 + 2 * n);
const DAGNAAM = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const hhmm = (x) => String(x.getHours()).padStart(2, "0") + ":" + String(x.getMinutes()).padStart(2, "0");

/** Wanneer kom je de komende dagen terug van een locatie (einde van je laatste vaste blok daar die dag) */
export function terugwegen(locId, dagen = 7, vanaf = new Date()) {
  const uit = [];
  for (let i = 0; i < dagen; i++) {
    const dag = new Date(vanaf.getFullYear(), vanaf.getMonth(), vanaf.getDate() + i);
    let I; try { I = dagIndeling(dag); } catch { continue; }
    const blokken = (I.vast || []).filter(x => x.locatie === locId);
    if (!blokken.length) continue;
    const eind = new Date(Math.max(...blokken.map(x => +x.b)));
    if (eind > vanaf) uit.push({ dag, eind });
  }
  return uit;
}
/** Advies: welke van je winkels, wanneer, met wat erbij (beste eerst) */
export function winkelAdvies(open = B().items.filter(i => !i.klaar), vanaf = new Date()) {
  const uit = [];
  for (const w of winkels()) {
    const ws = winkelSoorten(w), dekt = open.filter(it => ws.has(soortVan(it)));
    if (!dekt.length) continue;
    // prijzen bij de supermarkt(en) van deze winkel
    let som = 0, gevonden = 0; const aanb = [];
    if (idx && (w.ketens || []).length) for (const it of dekt) {
      const r = prijsItem(it, w.ketens); if (!r?.perKeten.size) continue;
      gevonden++; som += Math.min(...[...r.perKeten.values()].map(p => p.p)) * (it.aantal || 1);
      const a = aanbiedingen(r)[0]; if (a) aanb.push({ it, p: a });
    }
    const tijd = winkeltijd(dekt.length);
    let moment = null, extra;
    if (w.bereik === "route" && w.route) {
      extra = (w.omweg || 0) + tijd;
      moment = terugwegen(w.route, 7, vanaf).map(t => ({ ...t, start: t.eind }))
        .find(t => !w.sluit || hhmm(new Date(t.start.getTime() + (w.omweg || 0) * 6e4)) < w.sluit) || null;
    } else extra = 2 * (w.reistijd || 0) + tijd;
    // meer boodschappen en aanbiedingen = beter; omrijden en lang wachten = minder
    const wacht = moment ? (moment.start - vanaf) / 864e5 : 1.5;
    const score = dekt.length * 10 + aanb.length * 6 - extra / 4 - wacht * 2;
    uit.push({ w, dekt, som, gevonden, aanb, tijd, extra, moment, score });
  }
  return uit.sort((a, b) => b.score - a.score);
}
const momentTekst = (m, w) => {
  const vd = dagStr(new Date()), ds = dagStr(m.dag), morgen = dagStr(new Date(Date.now() + 864e5));
  const dag = ds === vd ? "vandaag" : ds === morgen ? "morgen" : DAGNAAM[m.dag.getDay()];
  return `${dag} ± ${hhmm(m.start)}, op de terugweg van ${esc(locatie(w.route)?.naam || "je werk")}`;
};
function adviesBlok() {
  const open = B().items.filter(i => !i.klaar);
  if (!open.length) return "";
  if (!winkels().length) return `<div class="bsadvies leegadvies"><span>🧭 <b>Tip:</b> zet je eigen winkels erin — een supermarkt om de hoek, of het winkelcentrum op je route terug van je werk.
      Dan zegt Tijdkompas wáár en wanneer je het beste kunt gaan, en plant het in.</span><button type="button" class="knop klein" data-bs="winkelBij">＋ Winkel toevoegen</button></div>`;
  const adv = winkelAdvies(open).slice(0, 3);
  if (!adv.length) return `<div class="bsadvies leegadvies"><span>🧭 Wat er nu op je lijst staat, haal je niet bij een van je eigen winkels. <a href="#instellingen" data-bs="winkelBeheer">Winkels beheren</a></span></div>`;
  return `<div class="bsadvies"><div class="hint">🧭 Waar en wanneer</div>${adv.map((a, i) => `<div class="bsadv ${i === 0 ? "beste" : ""}" data-winkel="${esc(a.w.id)}">
      <div class="bsadvkop"><span class="bsadvicoon">${esc(a.w.icoon || "🏪")}</span><div><b>${esc(a.w.naam)}</b>
        <div class="hint">${a.moment ? momentTekst(a.moment, a.w) : a.w.bereik === "route" ? "op je route — de komende week geen werkdag daar gevonden" : `even langs · ± ${a.extra} min heen en terug met winkelen`}${a.w.sluit ? ` · open tot ${esc(a.w.sluit)}` : ""}</div></div></div>
      <div class="imeta"><span>${a.dekt.length} van ${open.length} boodschappen</span>${a.gevonden ? `<span class="bsprijs">± ${euro(a.som)}</span>` : ""}
        ${a.aanb.length ? `<span class="tag bsaanb" title="${esc(a.aanb.map(x => x.it.tekst).join(", "))}">📉 ${a.aanb.length} in de aanbieding</span>` : ""}
        ${a.w.bereik === "route" && a.moment ? `<span>+${a.extra} min</span>` : ""}</div>
      <div class="hint bsadvitems">${a.dekt.map(it => esc(it.tekst)).join(" · ")}</div>
      <div><button type="button" class="knop klein ${i === 0 ? "prim" : ""}" data-bs="plan" data-w="${esc(a.w.id)}">${a.moment ? `🗓️ Na je werk inplannen` : "🗓️ Inplannen…"}</button></div>
    </div>`).join("")}</div>`;
}
/** Voor Vandaag: kom je vandaag op de terugweg langs een van je winkels terwijl er boodschappen open staan? */
export function boodschappenVandaag() {
  const open = B().items.filter(i => !i.klaar); if (!open.length) return "";
  const vd = dagStr(new Date());
  const a = winkelAdvies(open).find(x => x.moment && dagStr(x.moment.dag) === vd);
  if (!a) return "";
  return `<div class="paneel bsvandaag"><span>🛒 Vandaag ± ${hhmm(a.moment.start)} op de terugweg van ${esc(locatie(a.w.route)?.naam || "je werk")}: <b>${esc(a.w.naam)}</b> —
    ${a.dekt.length} boodschap${a.dekt.length === 1 ? "" : "pen"}${a.aanb.length ? `, ${a.aanb.length} in de aanbieding` : ""}.</span> <a class="knop klein" href="#boodschappen">Bekijk lijstje</a></div>`;
}
/** Het lijstje als taak bij die winkel: op de terugweg meteen na je werk, of "even langs" via het inplanvenster */
let haken = { planTaak: null, agendaBij: null };
function lijstVoorBoodschappen() {
  const eigen = d().overzichten.filter(o => !o.slot && (!o.eigenaar || isIk(o.eigenaar)));
  return eigen.find(o => o.id === B().lijst) || eigen.find(o => o.modus === "vrij" && /priv|thuis|huis/i.test(o.naam)) || eigen.find(o => o.modus === "vrij") || eigen[0] || null;
}
export function planWinkel(wid) {
  const a = winkelAdvies().find(x => x.w.id === wid); if (!a) return;
  const o = lijstVoorBoodschappen(); if (!o) { toast("Maak eerst een lijst (bv. Privé), dan kan het lijstje als taak worden ingepland"); return; }
  const titel = `🛒 Boodschappen ${a.w.naam}`, notitie = a.dekt.map(it => (it.aantal > 1 ? it.aantal + "× " : "") + it.tekst).join("\n");
  let t = d().taken.find(x => x.status !== "klaar" && x.locatie === a.w.id && x.titel.startsWith("🛒"));
  const v = { titel, notitie, schatting: a.moment ? a.extra : a.tijd, locatie: a.w.id, overzicht: o.id, belangrijk: true, urgent: a.aanb.length > 0 };
  if (t) Object.assign(t, v); else t = nieuweTaak({ ...v, streef: a.moment ? dagStr(a.moment.dag) : "" });
  if (a.moment) {
    const r = plaatsBlok(t, a.moment.start, a.extra, undefined, { hierAl: true });   // je komt er toch langs: geen reistijd vanaf huis
    bewaar(); haken.agendaBij?.([r.blok.id]);
    toast(`Ingepland: ${momentTekst(a.moment, a.w).replace(/<[^>]+>/g, "")} (${a.extra} min)`);
  } else { bewaar(); haken.planTaak?.(t); }
}
export function startPrijzen() {
  if (idx || prijsStand.bezig) return;
  laadPrijzen().then(i => { idx = i; zoekCache.clear(); opnieuw(); }).catch(() => opnieuw());
}

/** Bij welk soort winkel hoort dit? Eigen keuze > wat je eerder zelf indeelde > woordenlijst > staat in de supermarkt-prijzen > nog indelen */
export function soortVan(it) {
  if (it.soort && SOORTEN.some(s => s.id === it.soort)) return it.soort;
  const g = B().geleerd || {}, k = sleutel(it.tekst), h = hoofdwoord(it.tekst);
  if (g[k]) return g[k];
  const cat = categorie(it.tekst); if (cat) return cat.soort;
  if (h && g["~" + h]) return g["~" + h];               // zelf ingedeeld: "brood" → bakker geldt ook voor "volkoren brood"
  // woordenlijst: precies hetzelfde woord, anders het langste woord waar het op eindigt (ledlamp → lamp)
  let beste = null, lengte = 0;
  for (const w of woorden(it.tekst).map(stam)) {
    if (WOORD_SOORT.has(w) && w.length + 100 > lengte) { beste = WOORD_SOORT.get(w); lengte = w.length + 100; continue; }
    for (const [x, s] of WOORD_SOORT) if (x.length >= 3 && w.length > x.length && w.endsWith(x) && x.length > lengte) { beste = s; lengte = x.length; }
  }
  if (beste) return beste;
  const p = prijsVan(it.tekst);
  if (p && p.aantal >= 2) return "supermarkt";
  return "overig";
}
function leer(tekst, s) {
  const g = B().geleerd ||= {};
  g[sleutel(tekst)] = s;
  const h = hoofdwoord(tekst); if (h) g["~" + h] = s;
  const ks = Object.keys(g); if (ks.length > 600) for (const x of ks.slice(0, ks.length - 600)) delete g[x];
}

// ---------- invoer: "2x melk", "melk x2", "lamp #bouwmarkt", "melk @jumbo", meerdere met komma's ----------
export function leesInvoer(regel) {
  let t = String(regel || "").trim(), aantal = 1, s = "", keten = "";
  t = t.replace(/(^|\s)#([\p{L}-]+)/gu, (m, a, w) => { const x = SOORTEN.find(z => z.id.startsWith(w.toLowerCase()) || z.naam.toLowerCase().startsWith(w.toLowerCase())); if (x) { s = x.id; return a; } return m; });
  t = t.replace(/(^|\s)@([\p{L}-]+)/gu, (m, a, w) => { keten = w.toLowerCase(); return a; });
  let m = t.match(/^(\d{1,2})\s*[x×]\s+(.+)$/i) || t.match(/^(\d{1,2})\s+(?!(?:ml|cl|l|liter|g|gr|gram|kg|kilo|stuks?)\b)(\D.*)$/i);
  if (m) { aantal = +m[1]; t = m[2]; }
  else if ((m = t.match(/^(.+?)\s+[x×]\s*(\d{1,2})$/i) || t.match(/^(.+?)\s+(\d{1,2})\s*[x×]$/i))) { aantal = +m[2]; t = m[1]; }
  t = t.replace(/\s+/g, " ").trim().slice(0, 120);
  return t ? { tekst: t, aantal: Math.max(1, Math.min(99, aantal)), soort: s, keten } : null;
}
export function voegToe(regels) {
  const nieuw = [];
  for (const r of String(regels).split(/[\n,;]+/)) {
    const x = leesInvoer(r); if (!x) continue;
    const zelfde = B().items.find(i => !i.klaar && i.tekst.toLowerCase() === x.tekst.toLowerCase());
    if (zelfde) {
      if (x.soort || x.keten) { if (x.soort) { zelfde.soort = x.soort; leer(x.tekst, x.soort); } if (x.keten) zelfde.keten = x.keten; }
      else zelfde.aantal = (zelfde.aantal || 1) + x.aantal;
      nieuw.push(zelfde); continue;
    }
    const it = { id: uid(), tekst: x.tekst, aantal: x.aantal, klaar: false, gemaakt: new Date().toISOString(), door: mijnId() };
    if (x.soort) { it.soort = x.soort; leer(x.tekst, x.soort); }
    if (x.keten) it.keten = x.keten;
    B().items.push(it); nieuw.push(it);
  }
  if (nieuw.length) bewaar();
  return nieuw;
}
function onthoud(it) {
  const h = B().historie ||= {}, k = sleutel(it.tekst); if (!k) return;
  const oud = h[k] || { n: 0 };
  h[k] = { tekst: it.tekst, n: oud.n + 1, laatst: new Date().toISOString().slice(0, 10) };
  const ks = Object.entries(h); if (ks.length > 400) { ks.sort((a, b) => a[1].laatst.localeCompare(b[1].laatst)); for (const [x] of ks.slice(0, ks.length - 400)) delete h[x]; }
}
/** Lijkt dit op iets anders op de lijst? ("melk" naast "halfvolle melk": waarschijnlijk hetzelfde) */
function dubbelVan(it, items) {
  const a = new Set(stammen(it.tekst)); if (!a.size) return null;
  return items.find(x => x !== it && !x.klaar && (() => { const b = stammen(x.tekst); return b.length > a.size && [...a].every(w => b.includes(w)); })()) || null;
}

// ---------- weergave ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const euro = (x) => "€" + (Math.round(x * 100) / 100).toFixed(2).replace(".", ",");
const ketenNaam = (k) => esc(idx?.ketens[k]?.c || "");
const ketenNaamN = (n) => esc(idx?.ketens.find(k => k.n === n)?.c || n);
const DAG = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const sindsTekst = (v) => { if (!v) return ""; const x = new Date(v + "T12:00"), dgn = Math.round((Date.now() - x) / 864e5); return dgn <= 0 ? "sinds vandaag" : dgn === 1 ? "sinds gisteren" : dgn < 7 ? "sinds " + DAG[x.getDay()] : "sinds " + x.getDate() + "/" + (x.getMonth() + 1); };
const voorkeur = { lees(k, s) { try { const v = localStorage.getItem("tk_bs_" + k); return v == null ? s : JSON.parse(v); } catch { return s; } }, zet(k, v) { try { localStorage.setItem("tk_bs_" + k, JSON.stringify(v)); } catch {} } };

/** Beste keuze voor een item: vastgezette supermarkt, anders de goedkoopste (op prijs per liter/kilo) */
function besteVoor(it) {
  const r = prijsItem(it); if (!r || !r.perKeten.size) return null;
  const opties = [...r.perKeten.values()];
  const vast = it.keten && opties.find(p => idx.ketens[p.k].n === it.keten || idx.ketens[p.k].c.toLowerCase().startsWith(it.keten));
  const goedkoopst = opties.slice().sort((a, b) => (a.pe ?? 1e9) - (b.pe ?? 1e9) || a.p - b.p)[0];
  return { r, gekozen: vast || goedkoopst, goedkoopst, vast: !!vast };
}
function ruimteBolletjes(it) {
  const cat = categorie(it.tekst);
  let n;
  if (cat) n = 1;
  else { const r = prijsVan(it.tekst); n = r?.aantal ? keuzeRuimte(r, it.tekst) : (leesMaat(it.tekst) ? 4 : Math.min(4, 1 + woorden(it.tekst).length)); }
  const tip = ["", "Heel algemeen: nog alle keuze in de winkel", "Algemeen: nog veel keuze", "Vrij precies: weinig keuze meer", "Precies: één bepaald product"][n];
  return `<span class="bsruimte r${n}" title="${tip}" aria-label="${tip}">${"<i></i>".repeat(4)}</span>`;
}
function itemRij(it, items) {
  const s = soort(soortVan(it)), b = !it.klaar && besteVoor(it), cat = categorie(it.tekst), dub = !it.klaar && dubbelVan(it, items);
  const aanb = b && aanbiedingen(b.r)[0];
  const ookBij = b && s.id !== "supermarkt" && s.id !== "overig";
  const fav = b ? b.r.favs : null, ster = !fav && isFavoriet(it.tekst);
  const prijs = ookBij ? `<span class="hint">ook bij ${ketenNaam(b.gekozen.k)} ${euro(b.gekozen.p)}</span>` : b ? `<span class="bsprijs" title="${b.vast ? "Vastgezet" : "Goedkoopst"}: ${esc(b.gekozen.n)} ${esc(b.gekozen.s)}">${b.vast ? "📌 " : ""}${fav ? "⭐ " : ""}${ketenNaam(b.gekozen.k)} ${euro(b.gekozen.p * (it.aantal || 1))}${b.gekozen.pe && b.gekozen.maat && b.gekozen.maat.e !== "st" ? ` <small>${euro(b.gekozen.pe)}/${eenheidNaam[b.gekozen.maat.e]}</small>` : ""}</span>` : "";
  return `<div class="bsitem ${it.klaar ? "klaar" : ""}" data-bsid="${esc(it.id)}">
    <button type="button" class="vink" data-bs="vink" aria-label="${it.klaar ? "Terug op de lijst" : "Afvinken"}">${it.klaar ? "✓" : ""}</button>
    <div class="bsbody" data-bs="open">
      <div class="bstitel">${it.aantal > 1 ? `<b class="bsaantal">${it.aantal}×</b> ` : ""}${esc(it.tekst)}${ster ? ` <span class="bsster" title="Favoriet">⭐</span>` : ""}${ruimteBolletjes(it)}</div>
      ${it.klaar ? "" : `<div class="imeta">${prijs}
        ${aanb ? `<span class="tag bsaanb" title="${aanb.fav ? esc(aanb.fav) + " · " : ""}Normaal ${euro(aanb.w)} · ${sindsTekst(aanb.v)}">📉 ${aanb.fav ? "⭐ " : ""}${ketenNaam(aanb.k)} −${Math.round((1 - aanb.p / aanb.w) * 100)}%</span>` : ""}
        ${fav ? `<span class="hint bsfavnaam">⭐ ${esc(b.gekozen.fav)}${fav.length > 1 ? ` <small>(+${fav.length - 1})</small>` : ""}</span>` : ""}
        ${cat ? `<span class="hint">Nog alle kanten op — tik om specifieker te maken</span>` : ""}
        ${dub ? `<span class="tag bsdubbel" data-bs="samen" data-met="${esc(dub.id)}" title="Samenvoegen: houd de preciezere">🔗 ook: ${esc(dub.tekst)}</span>` : ""}
        ${it.notitie ? `<span class="hint">${esc(it.notitie)}</span>` : ""}</div>`}
    </div>
    <button type="button" class="bssoort" data-bs="soort" title="Soort winkel: ${esc(s.naam)} (tik om te wijzigen)">${s.icoon}</button>
  </div>`;
}

const MODI = [["soort", "🏪 Per soort winkel"], ["winkel", "💶 Per supermarkt"], ["lijst", "📝 Op volgorde"]];
export function boodschappenWeergave() {
  startPrijzen();
  const bs = B(), items = bs.items, open = items.filter(i => !i.klaar), klaar = items.filter(i => i.klaar);
  const modus = voorkeur.lees("modus", "soort"), winkelModus = voorkeur.lees("inWinkel", false);
  const groep = (titel, sub, lijst, extra = "") => lijst.length ? `<section class="bsgroep">
      <div class="bsgroepkop"><h2>${titel}</h2>${sub ? `<span class="tel">${sub}</span>` : ""}${extra}</div>
      <div class="lijst">${lijst.map(i => itemRij(i, items)).join("")}</div></section>` : "";
  let lijf = "";
  if (!items.length) lijf = `<div class="leeg">Nog niets op je lijstje. Typ hierboven wat je nodig hebt — zo algemeen of precies als je wilt,
      bv. <i>drinken</i>, <i>melk</i> of <i>Arla biologische halfvolle melk 1,5 l</i>. Meerdere tegelijk kan met komma's.</div>`;
  else if (modus === "lijst") lijf = groep("Op je lijstje", open.length + " open", open);
  else if (modus === "winkel") {
    // supermarktproducten bij de goedkoopste (of vastgezette) supermarkt; de rest per soort winkel
    const per = new Map(), rest = [];
    for (const it of open) { const b = soortVan(it) === "supermarkt" && besteVoor(it); if (b) { const k = b.gekozen.k; if (!per.has(k)) per.set(k, []); per.get(k).push(it); } else rest.push(it); }
    const som = (l) => l.reduce((s, it) => s + besteVoor(it).gekozen.p * (it.aantal || 1), 0);
    lijf = [...per].sort((a, b) => b[1].length - a[1].length).map(([k, l]) => groep(`🛒 ${ketenNaam(k)}`, `${l.length} · ± ${euro(som(l))}`, l)).join("")
      + perSoort(rest, groep);
  } else lijf = perSoort(open, groep);
  if (klaar.length) lijf += `<section class="bsgroep bsklaar"><div class="bsgroepkop"><h2>✓ In je mandje</h2><span class="tel">${klaar.length}</span>
      <button type="button" class="knop klein" data-bs="opruimen">Lijst opschonen</button></div>
      <div class="lijst">${klaar.map(i => itemRij(i, items)).join("")}</div></section>`;
  const hist = Object.values(bs.historie || {}).filter(h => !open.some(i => sleutel(i.tekst) === sleutel(h.tekst))).sort((a, b) => b.n - a.n || b.laatst.localeCompare(a.laatst)).slice(0, 10);
  return `<div class="titelbalk"><h1>🛒 Boodschappen</h1><span class="sub">Zet erop wat je nodig hebt; Tijdkompas deelt het in per winkel en zoekt waar het het goedkoopst is</span>
      <div class="rechts"><label class="schakel" title="Grote regels, zonder prijzen: handig met je telefoon in de winkel"><input type="checkbox" data-bs="inWinkel" ${winkelModus ? "checked" : ""}> In de winkel</label></div></div>
    <form class="snel bsinvoer" data-bs="toevoegen"><input id="bsInvoer" type="text" name="t" list="bsHist" placeholder="Wat heb je nodig? bv. 2x melk, brood, lamp #bouwmarkt" autocomplete="off" aria-label="Boodschap toevoegen" enterkeyhint="done">
      <button class="knop prim">Erop</button>
      <datalist id="bsHist">${Object.values(bs.historie || {}).sort((a, b) => b.n - a.n).slice(0, 80).map(h => `<option value="${esc(h.tekst)}">`).join("")}</datalist></form>
    ${hist.length && !winkelModus ? `<div class="chips bsvaak"><span class="hint">Vaak gekocht:</span>${hist.map(h => `<button type="button" data-bs="vaak" data-tekst="${esc(h.tekst)}">＋ ${esc(h.tekst)}</button>`).join("")}</div>` : ""}
    ${items.length ? `<div class="bsbalk"><div class="segment" role="group" aria-label="Indeling">${MODI.map(([k, t]) => `<button type="button" data-bs="modus" data-m="${k}" aria-pressed="${modus === k}">${t}</button>`).join("")}</div>
      ${prijsStatus()}</div>` : ""}
    ${!winkelModus ? adviesBlok() + samenvatting(open) + favAanbodBlok(open) : ""}
    <div class="bslijst ${winkelModus ? "inwinkel" : ""}">${lijf}</div>
    ${!winkelModus ? favorietenBlok() + instellingenBlok() : ""}`;
}
function perSoort(lijst, groep) {
  const per = new Map();
  for (const it of lijst) { const s = soortVan(it); if (!per.has(s)) per.set(s, []); per.get(s).push(it); }
  const volg = SOORTEN.map(s => s.id);
  return [...per].sort((a, b) => volg.indexOf(a[0]) - volg.indexOf(b[0])).map(([s, l]) => {
    const x = soort(s), vk = B().voorkeur?.[s];
    return groep(`${x.icoon} ${esc(x.naam)}`, `${l.length}${vk ? " · " + esc(vk) : ""}`, l, s === "overig" ? `<span class="hint">Tik op ❔ om in te delen — dat onthoudt Tijdkompas</span>` : "");
  }).join("");
}
function prijsStatus() {
  if (prijsStand.bezig) return `<span class="hint bsstatus">⏳ Prijzen laden…</span>`;
  if (!idx) return prijsStand.fout ? `<span class="hint bsstatus" title="${esc(prijsStand.fout)}">Prijzen niet beschikbaar (offline?)</span>` : "";
  const dt = prijsStand.datum ? new Date(prijsStand.datum + "T12:00") : null;
  return `<span class="hint bsstatus" title="Bron: Checkjebon.nl (open data, MIT)${prijsStand.bron === "checkjebon" ? " — aanbiedingen nog niet beschikbaar" : ""}">💶 ${idx.producten.length.toLocaleString("nl-NL")} prijzen${dt ? " van " + dt.getDate() + "/" + (dt.getMonth() + 1) : ""}</span>`;
}
/** Waar ben je het goedkoopst uit voor alles in één keer, en wat is er nu in de aanbieding? */
function samenvatting(open) {
  if (!idx) return "";
  // alleen wat je in de supermarkt haalt (een lamp van de Dirk telt niet mee)
  const met = open.filter(it => soortVan(it) === "supermarkt").map(it => ({ it, r: prijsItem(it) })).filter(x => x.r?.perKeten.size);
  if (!met.length) return "";
  const totaal = new Map();   // keten → {som, n}
  for (const { it, r } of met) for (const [k, p] of r.perKeten) { const t = totaal.get(k) || { som: 0, n: 0 }; t.som += p.p * (it.aantal || 1); t.n++; totaal.set(k, t); }
  const rij = [...totaal].sort((a, b) => b[1].n - a[1].n || a[1].som - b[1].som).slice(0, 5);
  const maxN = rij[0]?.[1].n || 0;
  // overal het goedkoopste, voor dezelfde producten als de beste supermarkt (anders vergelijk je appels met peren)
  const beste = rij[0], besteK = beste?.[0];
  const slim = met.filter(({ r }) => r.perKeten.has(besteK)).reduce((s, { it, r }) => s + Math.min(...[...r.perKeten.values()].map(p => p.p)) * (it.aantal || 1), 0);
  const scheelt = beste ? beste[1].som - slim : 0;
  const aanb = met.flatMap(({ it, r }) => aanbiedingen(r).slice(0, 1).map(p => ({ it, p }))).slice(0, 6);
  return `<div class="bssamen">
    <div class="bsvergelijk"><div class="hint">Alles bij één supermarkt (${maxN} van ${met.length} producten gevonden)</div>
      ${rij.map(([k, t], i) => `<div class="bsketen ${i === 0 && t.n === maxN ? "beste" : ""}"><span>${ketenNaam(k)}</span><b>${euro(t.som)}</b>${t.n < maxN ? `<small>${maxN - t.n} niet gevonden</small>` : ""}</div>`).join("")}
      ${scheelt >= 0.5 ? `<div class="hint">Per product de goedkoopste supermarkt: ± ${euro(slim)} — ${euro(scheelt)} minder dan alles bij ${ketenNaam(besteK)}</div>` : ""}</div>
    ${aanb.length ? `<div class="bsaanbod"><div class="hint">📉 Nu goedkoper dan normaal</div>${aanb.map(({ it, p }) => `<div class="linkrij"><span>${esc(it.tekst)}${p.fav ? ` <small class="hint">⭐ ${esc(p.fav)}</small>` : ""}</span>
      <span class="tag bsaanb">${ketenNaam(p.k)} ${euro(p.p)} <s>${euro(p.w)}</s></span><span class="hint">${sindsTekst(p.v)}</span></div>`).join("")}</div>` : ""}
  </div>`;
}
/** Favorieten in de aanbieding die (nog) niet op je lijstje staan: misschien nu inslaan? */
function favAanbodBlok(open) {
  const opLijst = (f) => open.some(it => sleutel(it.tekst) === sleutel(f.tekst) || favorietenVoor(it).includes(f));
  const l = favorietenAanbod().filter(x => !opLijst(x.f)).slice(0, 5);
  if (!l.length) return "";
  return `<div class="bsfavaanbod"><div class="hint">⭐📉 Je favorieten nu in de aanbieding — misschien inslaan?</div>${l.map(({ f, p }) => `<div class="linkrij">
      <span>${esc(f.tekst)}</span><span class="tag bsaanb">${ketenNaam(p.k)} ${euro(p.p)} <s>${euro(p.w)}</s> −${Math.round((1 - p.p / p.w) * 100)}%</span>
      <span class="hint">${sindsTekst(p.v)}</span><button type="button" class="knop klein" data-bs="favErop" data-f="${esc(f.id)}">＋ Erop</button></div>`).join("")}</div>`;
}
function favorietenBlok() {
  const l = favs();
  const rij = (f) => {
    const r = favPrijs(f), opties = r ? [...r.perKeten.values()].sort(opPrijs) : [], g = opties[0];
    const a = r && aanbiedingen({ treffers: opties })[0];
    return `<div class="bsfav" data-f="${esc(f.id)}"><div><b>⭐ ${esc(f.tekst)}</b>
        <div class="imeta">${g ? `<span class="bsprijs">${ketenNaam(g.k)} ${euro(g.p)}</span>${g.pe && g.maat && g.maat.e !== "st" ? `<small class="hint">${euro(g.pe)}/${eenheidNaam[g.maat.e]}</small>` : ""}${opties.length > 1 ? `<span class="hint">duurst ${ketenNaam(opties.at(-1).k)}</span>` : ""}` : idx ? `<span class="hint">Geen supermarktprijs gevonden</span>` : ""}
        ${a ? `<span class="tag bsaanb">📉 ${ketenNaam(a.k)} −${Math.round((1 - a.p / a.w) * 100)}%</span>` : ""}</div></div>
      <span class="bsfavknoppen"><button type="button" class="knop klein" data-bs="favErop" data-f="${esc(f.id)}" title="Op je lijstje">＋</button><button type="button" class="x" data-bs="favWeg" data-f="${esc(f.id)}" title="Geen favoriet meer" aria-label="Geen favoriet meer">✕</button></span></div>`;
  };
  return `<details class="bsinst bsfavs" ${voorkeur.lees("favOpen", false) ? "open" : ""} data-bsfavs><summary>⭐ Favorieten${l.length ? ` (${l.length})` : ""}</summary>
    <p class="hint">Je vaste producten, zo precies als je wilt (merk, soort, maat). Zet je daarna iets algemeens op je lijstje, zoals <i>melk</i>, dan kijkt Tijdkompas
      naar de prijzen en aanbiedingen van je favoriete melk. Ook te maken met ⭐ in het venster van een boodschap.</p>
    <form class="snel" data-bs="favToevoegen"><input type="text" name="f" maxlength="120" placeholder="bv. Arla biologische halfvolle melk 1 l" aria-label="Favoriet toevoegen" autocomplete="off"><button class="knop">⭐ Toevoegen</button></form>
    <div class="lijst">${l.map(rij).join("")}</div>
  </details>`;
}
function instellingenBlok() {
  const bs = B(), gekozen = new Set(bs.ketens || []);
  return `<details class="bsinst"><summary>⚙️ Supermarkten en vaste winkels</summary>
    <p class="hint">Vergelijk alleen bij de supermarkten waar je echt komt. Niets gekozen = ${winkels().some(w => (w.ketens || []).length) ? "die van je eigen winkels (Instellingen → Locaties)" : "allemaal"}.</p>
    <div class="chips">${(idx?.ketens || []).map(k => `<button type="button" data-bs="keten" data-n="${esc(k.n)}" aria-pressed="${gekozen.has(k.n)}" class="${gekozen.has(k.n) ? "aan" : ""}">${esc(k.c)}</button>`).join("") || `<span class="hint">Supermarkten verschijnen zodra de prijzen geladen zijn.</span>`}</div>
    <p class="hint">Je vaste winkel per soort (verschijnt bij de kop, bv. "Gamma Drachten"):</p>
    <div class="bsvast">${SOORTEN.filter(s => s.id !== "overig" && s.id !== "supermarkt").map(s => `<label>${s.icoon} ${esc(s.naam)}<input type="text" data-bs="vast" data-s="${s.id}" value="${esc(bs.voorkeur?.[s.id] || "")}" maxlength="40" placeholder="—"></label>`).join("")}</div>
    <p class="hint">Prijzen: open data van <a href="https://www.checkjebon.nl" target="_blank" rel="noopener">Checkjebon.nl</a>, dagelijks bijgewerkt. "Nu goedkoper dan normaal" = minstens 10% onder de gewone prijs van de afgelopen weken.
      Bonus-acties als "2e halve prijs" staan daar niet in; aanbiedingen van komende week ook (nog) niet.</p>
  </details>`;
}

// ---------- detailvenster ----------
let dlg = null;
function venster() {
  if (dlg) return dlg;
  dlg = document.createElement("dialog"); dlg.className = "bsdlg"; document.body.appendChild(dlg);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); else klik(e); });
  dlg.addEventListener("change", wijzig);
  dlg.addEventListener("submit", (e) => { e.preventDefault(); const f = e.target, it = item(f.dataset.bsid); if (!it) return;
    const t = f.querySelector("[name=tekst]").value.trim(); if (t && t !== it.tekst) { it.tekst = t.slice(0, 120); delete it.keten; }
    it.notitie = f.querySelector("[name=notitie]").value.trim().slice(0, 300); bewaar(); dlg.close(); });
  return dlg;
}
const item = (id) => B().items.find(i => i.id === id);
const ZOEK = {
  supermarkt: [], drogist: [["Kruidvat", "https://www.kruidvat.nl/search?q="]],
  bouwmarkt: [["Gamma", "https://www.gamma.nl/assortiment/zoeken?text="], ["Karwei", "https://www.karwei.nl/assortiment/zoeken?text="], ["Hornbach", "https://www.hornbach.nl/s/"]],
  elektronica: [["Tweakers Pricewatch", "https://tweakers.net/pricewatch/zoeken/?keyword="], ["Coolblue", "https://www.coolblue.nl/zoeken?query="]],
  wonen: [["IKEA", "https://www.ikea.com/nl/nl/search/?q="], ["Action", "https://www.action.com/nl-nl/search/?q="]],
  sport: [["Decathlon", "https://www.decathlon.nl/search?Ntt="]], fiets: [["Halfords", "https://www.halfords.nl/zoeken?q="]],
};
function zoekLinks(it, s) {
  const q = encodeURIComponent(it.tekst);
  const l = [...(ZOEK[s] || []), ["bol.com", "https://www.bol.com/nl/nl/s/?searchtext="], ["Google Shopping (prijzen vergelijken)", "https://www.google.com/search?tbm=shop&q="]];
  if (s === "supermarkt") l.splice(0, l.length);
  return l.length ? `<div class="bszoek"><div class="hint">Zoeken en vergelijken</div><div class="chips">${l.map(([n, u]) => `<a class="knop klein" href="${u}${q}" target="_blank" rel="noopener noreferrer">${esc(n)} ↗</a>`).join("")}</div></div>` : "";
}
export function open(id, openSoort = false) {
  const it = item(id); if (!it) return;
  const dl = venster(), s = soortVan(it), cat = categorie(it.tekst), r = prijsVan(it.tekst);
  const ver = cat ? cat.voorstel.map(w => ({ woord: w, vervang: true })) : r && idx ? verfijningen(idx, r, it.tekst) : [];
  const rijen = r ? [...r.perKeten.values()].sort((a, b) => (a.pe ?? 1e9) - (b.pe ?? 1e9) || a.p - b.p) : [];
  const andere = r ? r.treffers.filter(p => !rijen.includes(p)).sort((a, b) => (a.pe ?? 1e9) - (b.pe ?? 1e9)).slice(0, 6) : [];
  const fv = favorietenVoor(it), favR = fv.map(f => ({ f, r: favPrijs(f) })), alFav = isFavoriet(it.tekst);
  const prodTekst = (p) => p.n + (p.s && !/\d/.test(p.n) ? " " + p.s : "");
  const prod = (p, hoofd) => { const url = productUrl(idx, p), a = p.w && p.p <= p.w * 0.9, pf = isFavoriet(prodTekst(p));
    return `<tr class="${hoofd && it.keten && (idx.ketens[p.k].n === it.keten) ? "vast" : ""}"><td>${ketenNaam(p.k)}</td>
      <td>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(p.n)}</a>` : esc(p.n)} <span class="hint">${esc(p.s)}</span>${a ? ` <span class="tag bsaanb" title="Normaal ${euro(p.w)}">📉 −${Math.round((1 - p.p / p.w) * 100)}% ${sindsTekst(p.v)}</span>` : ""}</td>
      <td class="getal"><b>${euro(p.p)}</b>${p.pe && p.maat && p.maat.e !== "st" ? `<br><small class="hint">${euro(p.pe)}/${eenheidNaam[p.maat.e]}</small>` : ""}</td>
      <td class="bsknoppen">${hoofd ? `<button type="button" class="x" data-bs="vastzet" data-n="${esc(idx.ketens[p.k].n)}" title="Hier halen">📌</button>` : ""}<button type="button" class="x" data-bs="precies" data-p="${esc(prodTekst(p))}" data-n="${esc(idx.ketens[p.k].n)}" title="Precies dit product">🎯</button><button type="button" class="x ${pf ? "aan" : ""}" data-bs="favProduct" data-p="${esc(prodTekst(p))}" data-n="${esc(idx.ketens[p.k].n)}" title="${pf ? "Geen favoriet meer" : "Favoriet maken"}">${pf ? "⭐" : "☆"}</button></td></tr>`; };
  const favBlok = fv.length ? `<div class="bsfavdlg"><div class="hint">⭐ Je favoriet${fv.length > 1 ? "en" : ""} voor „${esc(it.tekst)}” — daar kijkt Tijdkompas naar</div>
      ${favR.map(({ f, r }) => { const o = r ? [...r.perKeten.values()].sort(opPrijs) : [], a = r && aanbiedingen({ treffers: o })[0];
        return `<div class="linkrij"><span><b>${esc(f.tekst)}</b></span>${o[0] ? `<span class="bsprijs">${ketenNaam(o[0].k)} ${euro(o[0].p)}</span>` : `<span class="hint">geen prijs gevonden</span>`}
          ${a ? `<span class="tag bsaanb" title="Normaal ${euro(a.w)}">📉 ${ketenNaam(a.k)} ${euro(a.p)} ${sindsTekst(a.v)}</span>` : ""}
          <button type="button" class="knop klein" data-bs="favKies" data-p="${esc(f.tekst)}" title="Precies deze op je lijstje">🎯</button></div>`; }).join("")}
      <button type="button" class="knop klein" data-bs="geenFav">Toch alle ${esc(it.tekst)} vergelijken</button></div>`
    : it.geenFav && favs().length ? `<div class="bsfavdlg"><span class="hint">Je favorieten tellen hier niet mee.</span> <button type="button" class="knop klein" data-bs="welFav">⭐ Wel naar mijn favorieten kijken</button></div>` : "";
  dl.innerHTML = `<form method="dialog" class="bsdetail" data-bsid="${esc(it.id)}">
    <div class="bsdkop"><input name="tekst" value="${esc(it.tekst)}" maxlength="120" aria-label="Omschrijving">
      <div class="bsaantalkies"><button type="button" class="knop klein" data-bs="min">−</button><b>${it.aantal || 1}</b><button type="button" class="knop klein" data-bs="plus">＋</button></div></div>
    <div class="bsruimteuitleg">${ruimteBolletjes(it)} ${!cat ? `<button type="button" class="knop klein bsfavknop ${alFav ? "aan" : ""}" data-bs="favItem" title="${alFav ? "Geen favoriet meer" : "Dit als favoriet bewaren"}">${alFav ? "⭐ Favoriet" : "☆ Favoriet maken"}</button>` : ""} <span class="hint">${cat ? "Een soort, geen product: kies hieronder wat je bedoelt — of laat het zo en kies in de winkel." : r?.aantal ? `${r.aantal} passende producten${r.eenheid ? ", vergeleken per " + eenheidNaam[r.eenheid] : ""}` : idx ? "Geen supermarktproduct gevonden" : "Prijzen laden…"}</span></div>
    ${favBlok}
    ${ver.length ? `<div class="bsverfijn"><div class="hint">${cat ? "Bedoel je…" : "Specifieker maken"}</div><div class="chips">${ver.map(v => `<button type="button" data-bs="verfijn" data-w="${esc(v.woord)}" data-vervang="${v.vervang ? 1 : ""}">${v.merk ? "🏷️ " : ""}${esc(v.woord)}</button>`).join("")}</div></div>` : ""}
    <details class="bskiessoort" ${s === "overig" || openSoort ? "open" : ""}><summary><span class="hint">Soort winkel:</span> ${soort(s).icoon} ${esc(soort(s).naam)} <span class="hint">· wijzigen</span></summary>
      <div class="chips">${SOORTEN.map(x => `<button type="button" data-bs="kiesSoort" data-s="${x.id}" aria-pressed="${x.id === s}" class="${x.id === s ? "aan" : ""}">${x.icoon} ${esc(x.naam)}</button>`).join("")}</div></details>
    ${rijen.length ? `<div class="bsprijzen"><div class="hint">${fv.length ? "Alle passende producten, " : ""}goedkoopste per supermarkt · 📌 hier halen · 🎯 precies dit product · ☆ favoriet</div>
      <table class="tabel"><tbody>${rijen.map(p => prod(p, true)).join("")}</tbody></table>
      ${andere.length ? `<details><summary class="hint">Meer passende producten</summary><table class="tabel"><tbody>${andere.map(p => prod(p, false)).join("")}</tbody></table></details>` : ""}
      ${it.keten ? `<button type="button" class="knop klein" data-bs="losmaken">📌 Niet meer vastzetten (${ketenNaamN(it.keten)})</button>` : ""}</div>` : ""}
    ${zoekLinks(it, s)}
    <label class="veld"><span class="vlabel">Notitie</span><input name="notitie" value="${esc(it.notitie || "")}" maxlength="300" placeholder="bv. voor de verjaardag, of: die van vorige keer"></label>
    <div class="dvoet"><button type="button" class="knop gevaar" data-bs="weg">Verwijderen</button><span style="flex:1"></span>
      <button type="button" class="knop" data-bs="sluit">Sluiten</button><button class="knop prim" type="submit">Opslaan</button></div>
  </form>`;
  if (!dl.open) dl.showModal();
}

// ---------- acties ----------
let toast = () => {};
function klik(e) {
  const el = e.target.closest("[data-bs]"); if (!el) return;
  const a = el.dataset.bs, rij = el.closest("[data-bsid]"), it = rij && item(rij.dataset.bsid), inDlg = !!el.closest("dialog");
  if (a === "open" && it) { open(it.id); return; }
  if (a === "vink" && it) {
    it.klaar = !it.klaar; if (it.klaar) { it.klaarOp = new Date().toISOString(); onthoud(it); } else delete it.klaarOp;
    navigator.vibrate?.(10); bewaar(); return;
  }
  if (a === "soort" && it) { open(it.id, true); return; }
  if (a === "samen" && it) {
    const met = item(el.dataset.met); if (!met) return;
    met.aantal = Math.max(met.aantal || 1, it.aantal || 1); if (it.notitie && !met.notitie) met.notitie = it.notitie;
    B().items = B().items.filter(x => x !== it); bewaar();
    toast(`Samengevoegd met „${met.tekst}”`, { label: "Ongedaan maken", f: () => { B().items.push(it); bewaar(); } }); return;
  }
  if (a === "opruimen") {
    const weg = B().items.filter(i => i.klaar); B().items = B().items.filter(i => !i.klaar); bewaar();
    toast(`${weg.length} afgevinkt${weg.length === 1 ? "" : "e"} van de lijst gehaald`, { label: "Ongedaan maken", f: () => { B().items.push(...weg); bewaar(); } }); return;
  }
  if (a === "vaak") { voegToe(el.dataset.tekst); return; }
  if (a === "plan") { planWinkel(el.dataset.w); return; }
  if (a === "winkelBij" || a === "winkelBeheer") {
    e.preventDefault();
    if (a === "winkelBij") d().locaties.push({ id: uid(), naam: "Mijn supermarkt", icoon: "🏪", reistijd: 5, adres: "", soort: "winkel", ketens: [], soorten: [], bereik: "langs" });
    try { localStorage.setItem("tk_instTab", JSON.stringify("locaties")); } catch {}
    bewaar(); location.hash = "#instellingen"; return;
  }
  if (a === "modus") { voorkeur.zet("modus", el.dataset.m); opnieuw(); return; }
  if (a === "favErop" || a === "favWeg") {
    const f = favs().find(x => x.id === el.dataset.f); if (!f) return;
    if (a === "favErop") { voegToe(f.tekst.replace(/[,;]/g, " ")); toast(`„${f.tekst}” staat op je lijstje`); }
    else { B().favorieten = favs().filter(x => x !== f); bewaar(); toast(`„${f.tekst}” is geen favoriet meer`, { label: "Ongedaan maken", f: () => { favs().push(f); bewaar(); } }); }
    return;
  }
  if (a === "keten") {
    const n = el.dataset.n, l = new Set(B().ketens || []); l.has(n) ? l.delete(n) : l.add(n); B().ketens = [...l]; zoekCache.clear(); bewaar(); return;
  }
  if (!it) return;
  if (a === "min" || a === "plus") { it.aantal = Math.max(1, Math.min(99, (it.aantal || 1) + (a === "plus" ? 1 : -1))); bewaar(); if (inDlg) open(it.id); return; }
  if (a === "kiesSoort") { it.soort = el.dataset.s; leer(it.tekst, it.soort); bewaar(); if (inDlg) open(it.id); toast(`Onthouden: ${it.tekst} → ${soort(it.soort).naam}`); return; }
  if (a === "verfijn") {
    const w = el.dataset.w;
    it.tekst = el.dataset.vervang ? w : `${w} ${it.tekst}`.slice(0, 120);   // bijvoeglijk naamwoord en merk staan vooraan: "halfvolle melk", "Arla halfvolle melk"
    delete it.keten; bewaar(); open(it.id); return;
  }
  if (a === "vastzet") { it.keten = el.dataset.n; bewaar(); open(it.id); return; }
  if (a === "losmaken") { delete it.keten; bewaar(); open(it.id); return; }
  if (a === "favProduct") { favorietBij(el.dataset.p, { k: el.dataset.n }); if (inDlg) open(it.id); return; }
  if (a === "favItem") { favorietBij(it.tekst); if (inDlg) open(it.id); return; }
  if (a === "favKies") { it.tekst = el.dataset.p.slice(0, 120); delete it.keten; delete it.geenFav; bewaar(); open(it.id); return; }
  if (a === "geenFav" || a === "welFav") { if (a === "geenFav") it.geenFav = true; else delete it.geenFav; bewaar(); open(it.id); return; }
  if (a === "precies") { it.tekst = el.dataset.p.slice(0, 120); it.keten = el.dataset.n; bewaar(); open(it.id); return; }
  if (a === "weg") {
    B().items = B().items.filter(x => x !== it); bewaar(); dlg?.close();
    toast(`„${it.tekst}” verwijderd`, { label: "Ongedaan maken", f: () => { B().items.push(it); bewaar(); } }); return;
  }
  if (a === "sluit") { dlg?.close(); return; }
}
function wijzig(e) {
  const el = e.target;
  if (el.dataset.bs === "inWinkel") { voorkeur.zet("inWinkel", el.checked); opnieuw(); return; }
  if (el.dataset.bs === "vast") { const v = (B().voorkeur ||= {}); const t = el.value.trim().slice(0, 40); if (t) v[el.dataset.s] = t; else delete v[el.dataset.s]; bewaar(); }
}
/** Koppelt de lijst aan de pagina (één keer): klikken, invoer en hertekenen */
export function initBoodschappen({ main, toast: t, render, planTaak, agendaBij }) {
  toast = t; opnieuw = render; haken = { planTaak, agendaBij };
  main.addEventListener("click", (e) => { if (e.target.closest("[data-bs]") && e.target.closest(".bspagina")) klik(e); });
  main.addEventListener("change", (e) => { if (e.target.closest(".bspagina")) wijzig(e); });
  main.addEventListener("toggle", (e) => { if (e.target.matches?.("[data-bsfavs]")) voorkeur.zet("favOpen", e.target.open); }, true);
  main.addEventListener("submit", (e) => {
    if (e.target.dataset.bs === "favToevoegen") {
      e.preventDefault(); const inv = e.target.querySelector("input[name=f]"); if (inv.value.trim()) { voorkeur.zet("favOpen", true); favorietBij(inv.value); } return;
    }
    if (e.target.dataset.bs !== "toevoegen") return;
    e.preventDefault();
    const inv = e.target.querySelector("input[name=t]"), nieuw = voegToe(inv.value);
    if (nieuw.length) setTimeout(() => { const i = document.getElementById("bsInvoer"); if (i) { i.value = ""; i.focus(); } }, 0);
  });
}
export const focusInvoer = () => document.getElementById("bsInvoer")?.focus();

// ---------- winkel-velden bij een locatie (Instellingen → Locaties) ----------
export const winkelOpen = new Set();      // welke winkels je net aan het instellen bent (blijft open na hertekenen)
export function winkelVelden(l) {
  const andere = (d().locaties || []).filter(x => x.id !== l.id && x.id !== "thuis" && x.soort !== "winkel");
  const ks = new Set(l.ketens || []), ss = new Set(l.soorten || []);
  return `<div class="winkelvelden">
    <label class="schakel"><input type="checkbox" data-locveld="soort" ${l.soort === "winkel" ? "checked" : ""}> 🏪 Winkel of winkelcentrum</label>
    ${l.soort === "winkel" ? `
    <details class="winkelkeuze" data-wopen="${esc(l.id)}" ${winkelOpen.has(l.id) || !(ks.size + ss.size) ? "open" : ""}><summary>${[...KETENS.filter(([n]) => ks.has(n)).map(([, c]) => c), ...SOORTEN.filter(x => ss.has(x.id)).map(x => x.icoon + " " + esc(x.naam))].join(" · ") || "Wat zit er?"} <span class="hint">· wijzigen</span></summary>
    <div><div class="hint">Supermarkt(en) hier</div><div class="chips">${KETENS.map(([n, c]) => `<button type="button" data-wketen="${n}" aria-pressed="${ks.has(n)}" class="${ks.has(n) ? "aan" : ""}">${c}</button>`).join("")}</div></div>
    <div><div class="hint">Andere winkels hier</div><div class="chips">${SOORTEN.filter(x => !["supermarkt", "overig"].includes(x.id)).map(x => `<button type="button" data-wsoort="${x.id}" aria-pressed="${ss.has(x.id)}" class="${ss.has(x.id) ? "aan" : ""}">${x.icoon} ${esc(x.naam)}</button>`).join("")}</div></div></details>
    <div class="rij">
      <label class="veld">Hoe kom je er?<select data-locveld="bereik"><option value="langs" ${l.bereik !== "route" ? "selected" : ""}>Even langs vanaf huis</option>
        <option value="route" ${l.bereik === "route" ? "selected" : ""}>Op de terugweg van…</option></select></label>
      ${l.bereik === "route" ? `<label class="veld">Terugweg van<select data-locveld="route"><option value="">— kies —</option>${andere.map(x => `<option value="${esc(x.id)}" ${l.route === x.id ? "selected" : ""}>${esc(x.icoon)} ${esc(x.naam)}</option>`).join("")}</select></label>
        <label class="veld">Omweg (min)<input type="number" min="0" max="120" step="5" value="${+l.omweg || 0}" data-locveld="omweg"></label>` : ""}
      <label class="veld">Open tot<input type="time" value="${esc(l.sluit || "")}" data-locveld="sluit"></label>
    </div>` : ""}
  </div>`;
}
