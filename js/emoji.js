// Tijdkompas — emoji-kiezer voor lijsten, mappen en locaties
// Bovenaan voorstellen die passen bij de naam, dan vaste groepen, en onder "Alle emoji's" alles wat dit apparaat kent.

// Groepen met trefwoorden (voor voorstellen en zoeken)
const GROEPEN = [
  ["Werk & studie", [
    ["💼", "werk baan kantoor zakelijk"], ["🏢", "kantoor bedrijf werk gebouw"], ["👥", "team groep collega's samen"], ["🤝", "samenwerking klant overleg partner"],
    ["📋", "lijst taken checklist"], ["📁", "map dossier archief"], ["🗂️", "mappen ordenen administratie"], ["📊", "cijfers rapportage data analyse"],
    ["📈", "groei resultaat doel"], ["🎯", "doel koers focus"], ["🧭", "koers richting kompas"], ["💡", "idee innovatie"],
    ["🛠️", "techniek onderhoud reparatie"], ["⚙️", "instellingen techniek proces"], ["🔧", "klussen reparatie onderhoud"], ["🧪", "test lab onderzoek"],
    ["💻", "computer ict programmeren"], ["🖥️", "computer scherm ict"], ["📞", "bellen telefoon"], ["✉️", "mail post"],
    ["📝", "schrijven notities verslag"], ["📚", "studie leren boeken opleiding"], ["🎓", "studie opleiding diploma school"], ["🏫", "school"],
    ["🗓️", "agenda planning kalender jaar"], ["⏰", "deadline tijd"], ["💶", "geld financien budget administratie"], ["🧾", "facturen bonnen declaratie"],
    ["⚖️", "juridisch beleid"], ["🏗️", "bouw project nieuwbouw"], ["🌱", "duurzaam groei werkgroep ontwikkeling"], ["🔬", "onderzoek wetenschap"],
    ["📣", "communicatie marketing"], ["🎤", "presentatie spreken"], ["🧑‍💼", "manager leidinggevende"], ["🏆", "prestatie winnen"],
  ]],
  ["Thuis & privé", [
    ["🏠", "thuis huis privé"], ["🏡", "huis tuin thuis"], ["👨‍👩‍👧", "gezin familie kinderen"], ["❤️", "relatie liefde"],
    ["🧹", "schoonmaken huishouden"], ["🧺", "was huishouden"], ["🛒", "boodschappen winkelen"], ["🍳", "koken eten"],
    ["🪴", "planten tuin"], ["🛋️", "inrichting wonen"], ["🔨", "klussen verbouwing"], ["🎁", "cadeau verjaardag"],
    ["🎂", "verjaardag feest"], ["🩺", "gezondheid dokter"], ["💊", "medicijnen zorg"], ["🧘", "rust ontspanning yoga"],
    ["💤", "slapen rust"], ["🐶", "hond huisdier"], ["🐱", "kat huisdier"], ["👶", "baby kind"],
    ["📦", "verhuizen pakket opruimen"], ["🔑", "sleutel huis"], ["💰", "sparen geld"], ["🧾", "belasting administratie"],
  ]],
  ["Hobby & sport", [
    ["⛵", "boot zeilen jacht"], ["🚤", "boot motorboot varen"], ["⚓", "haven anker boot"], ["🌊", "water zee"],
    ["⚽", "voetbal sport"], ["🏃", "hardlopen sport"], ["🚴", "fietsen wielrennen"], ["🏊", "zwemmen"],
    ["🎾", "tennis padel"], ["🏋️", "fitness sport"], ["⛳", "golf"], ["🎣", "vissen"],
    ["🎸", "muziek gitaar band"], ["🎹", "muziek piano"], ["🎨", "schilderen kunst creatief"], ["📷", "foto fotografie"],
    ["🎮", "gamen spel"], ["🧩", "puzzel spel"], ["📖", "lezen boek"], ["🎬", "film video"],
    ["🧵", "naaien handwerk"], ["🪚", "houtbewerking klussen"], ["🖨️", "3d printen printer"], ["🤖", "robot elektronica maken"],
    ["🏛️", "vereniging club"], ["🎭", "theater toneel"], ["⛺", "kamperen"], ["🏕️", "kamp buiten"],
  ]],
  ["Reizen & vervoer", [
    ["✈️", "vliegen reis vakantie"], ["🧳", "vakantie reizen koffer"], ["🚗", "auto rijden"], ["🚆", "trein ov"],
    ["🚲", "fiets"], ["🗺️", "reis route kaart"], ["🏖️", "strand vakantie"], ["🏔️", "bergen ski"],
    ["⛽", "tanken brandstof"], ["🅿️", "parkeren"], ["📍", "locatie plek"], ["🌍", "wereld internationaal"],
  ]],
  ["Natuur & weer", [
    ["🌳", "boom natuur bos"], ["🌻", "bloem zomer"], ["🍂", "herfst"], ["❄️", "winter"],
    ["☀️", "zon zomer"], ["🌧️", "regen"], ["🌙", "nacht avond"], ["⭐", "ster favoriet"],
    ["🔥", "vuur belangrijk urgent"], ["⚡", "snel energie stroom"], ["💧", "water"], ["🌈", "regenboog"],
  ]],
  ["Symbolen", [
    ["✅", "klaar gedaan"], ["❗", "belangrijk"], ["❓", "vraag"], ["🔴", "rood"], ["🟠", "oranje"], ["🟡", "geel"],
    ["🟢", "groen"], ["🔵", "blauw"], ["🟣", "paars"], ["⚫", "zwart"], ["⚪", "wit"], ["🟤", "bruin"],
    ["🔒", "privé geheim"], ["🔔", "herinnering"], ["📌", "vast pin"], ["🏷️", "label"], ["💬", "gesprek chat"], ["🔗", "link"],
  ]],
];
const ALLE_GEKOZEN = GROEPEN.flatMap(([, l]) => l);

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Voorstellen die passen bij een naam, aangevuld met de meest gebruikte */
export function voorstellen(naam, soort = "lijst") {
  const w = norm(naam).split(/[^a-z0-9]+/).filter(x => x.length >= 3);
  // exacte treffer telt zwaarder dan een begin ("werkgroep" → 🌱 eerder dan 💼 via "werk")
  const score = new Map();
  for (const [e, kw] of ALLE_GEKOZEN) {
    let p = 0;
    for (const x of w) for (const k of norm(kw).split(" ")) p += k === x ? 3 : (k.startsWith(x) || (x.startsWith(k) && k.length >= 4)) ? 1 : 0;
    if (p) score.set(e, Math.max(score.get(e) || 0, p));
  }
  const uit = [...score].sort((a, b) => b[1] - a[1]).map(([e]) => e);
  const basis = soort === "map" ? ["📁", "🗂️", "💼", "🏠", "👥", "🌱", "🏛️", "⛵"] : soort === "locatie" ? ["🏠", "🏢", "📍", "⚓", "🏛️", "🏫", "🏋️", "🛒"]
    : soort === "project" ? ["🚀", "🛠️", "🏗️", "📦", "🎯", "🧩", "📐", "🎨"]
    : ["📋", "💼", "🏠", "👥", "🌱", "⛵", "🎯", "📚"];
  return [...new Set([...uit, ...basis])].slice(0, 16);
}

// Alle losse emoji die dit apparaat kent (zonder vlaggen/combinaties), eenmalig opgebouwd
let alle = null;
function alleEmoji() {
  if (alle) return alle;
  alle = [];
  const re = /\p{Emoji_Presentation}/u;
  for (const [a, b] of [[0x1F300, 0x1F5FF], [0x1F600, 0x1F64F], [0x1F680, 0x1F6FF], [0x1F900, 0x1F9FF], [0x1FA70, 0x1FAFF], [0x2600, 0x27BF]])
    for (let c = a; c <= b; c++) { const ch = String.fromCodePoint(c); if (re.test(ch)) alle.push(ch); }
  return alle;
}

let open = null;
export function sluitEmoji() { open?.remove(); open = null; }
/**
 * Toont de kiezer bij een knop. klaar(emoji) wordt aangeroepen met de keuze.
 * @param {HTMLElement} knop  @param {{naam?:string, soort?:string, huidig?:string}} o
 */
export function kiesEmoji(knop, { naam = "", soort = "lijst", huidig = "" } = {}, klaar) {
  sluitEmoji();
  const el = document.createElement("div");
  el.className = "emojikies"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Icoon kiezen");
  const knopjes = (lijst) => lijst.map(e => `<button type="button" data-e="${e}" aria-pressed="${e === huidig}" title="${e}">${e}</button>`).join("");
  const teken = (zoek = "", allesTonen = false) => {
    const z = norm(zoek).trim();
    let inhoud;
    if (z) {
      const gev = ALLE_GEKOZEN.filter(([, kw]) => norm(kw).includes(z)).map(([e]) => e);
      inhoud = `<div class="egroep"><div class="ekop">Gevonden</div><div class="eraster">${knopjes([...new Set(gev)]) || `<span class="hint">Niets gevonden — plak hieronder zelf een emoji</span>`}</div></div>`;
    } else {
      inhoud = `<div class="egroep"><div class="ekop">Voorgesteld</div><div class="eraster">${knopjes(voorstellen(naam, soort))}</div></div>`
        + GROEPEN.map(([g, l]) => `<div class="egroep"><div class="ekop">${g}</div><div class="eraster">${knopjes([...new Set(l.map(([e]) => e))])}</div></div>`).join("")
        + (allesTonen ? `<div class="egroep"><div class="ekop">Alle emoji's</div><div class="eraster">${knopjes(alleEmoji())}</div></div>`
          : `<button type="button" class="knop klein" data-alles style="margin:6px">Alle emoji's tonen…</button>`);
    }
    el.querySelector(".einhoud").innerHTML = inhoud;
  };
  el.innerHTML = `<div class="ezoek"><input type="search" placeholder="Zoek: boot, werk, sport…" aria-label="Zoeken"><button type="button" class="x" data-dicht aria-label="Sluiten">✕</button></div>
    <div class="einhoud"></div>
    <div class="eeigen"><input type="text" maxlength="8" placeholder="of plak/typ zelf" aria-label="Eigen emoji"><button type="button" class="knop klein" data-eigen>Gebruik</button></div>`;
  (knop.closest("dialog") || document.body).appendChild(el);
  open = el;
  teken();
  const r = knop.getBoundingClientRect(), bw = window.innerWidth || 1000, bh = window.innerHeight || 800;
  el.style.left = Math.max(8, Math.min(r.left, bw - 340)) + "px";
  el.style.top = (r.bottom + 360 > bh && r.top > 380 ? Math.max(8, r.top - 366) : r.bottom + 6) + "px";
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    const b = e.target.closest("[data-e]");
    if (b) { sluitEmoji(); klaar(b.dataset.e); return; }
    if (e.target.closest("[data-alles]")) teken("", true);
    if (e.target.closest("[data-dicht]")) sluitEmoji();
    if (e.target.closest("[data-eigen]")) { const v = el.querySelector(".eeigen input").value.trim(); if (v) { sluitEmoji(); klaar(v); } }
  });
  el.querySelector(".ezoek input").addEventListener("input", (e) => teken(e.target.value));
  el.querySelector(".eeigen input").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); el.querySelector("[data-eigen]").click(); } });
  setTimeout(() => el.querySelector(".ezoek input")?.focus?.(), 30);
}
document.addEventListener("pointerdown", (e) => { if (open && !e.target.closest?.(".emojikies,[data-emoji]")) sluitEmoji(); });
document.addEventListener("keydown", (e) => { if (open && e.key === "Escape") { e.stopPropagation(); e.preventDefault(); sluitEmoji(); } }, true);
