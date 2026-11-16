// Tijdkompas — takenlijsten afstemmen met Google Taken en Microsoft To Do (Outlook-taken)
// Elke externe takenlijst hangt aan één Tijdkompas-lijst. Alles van een taak staat in Tijdkompas (matrix, duur,
// deadline, streefdatum, project, wie, wacht op…); wat de takenlijst zelf ook kan, gaat er twee kanten op in mee:
//   Google Taken     titel, notitie, deadline (= vervaldatum), afgerond, en projecten als taak met subtaken
//   Microsoft To Do  titel, notitie, deadline (= vervaldatum), afgerond, en ⭐ belangrijk = matrix „Nu doen”
//                    (To Do kent geen subtaken; projecten staan daar als gewone taak)
// Wie het laatst wijzigde wint (bij twijfel Tijdkompas). Weggooien aan de ene kant gooit ook weg aan de andere kant.
// Per externe lijst onthouden we welke taken we al kenden ("bekend"): staat een taak daar wel en hier niet meer,
// dan is hij hier weggegooid; kenden we hem nog niet, dan is hij nieuw en halen we hem binnen.
import { opslag, bewaar, overzicht, project, nieuweTaak, nieuwProject, verwijder, rondAf, mijnId, isMijn } from "./data.js";
import { verbindingen as alleVerbindingen, heeft, VerlopenFout, takenlijsten, haalTaken, zetTaak, verwijderTaak, verplaatsTaak } from "./koppeling.js";
import { vingerafdruk } from "./sync.js";

const d = () => opslag.d;
export const takenVerbindingen = () => alleVerbindingen().filter(v => heeft(v, "taken"));
export const takenSleutel = (v, id) => `${v.id}|${id}`;
export const takenVerbindingVan = (k) => takenVerbindingen().find(v => k.startsWith(v.id + "|"));
const idVan = (k) => k.slice(k.indexOf("|") + 1);
// vingerafdruk van wat beide kanten delen (parent/ster alleen als ze er zijn, zodat oudere afdrukken blijven kloppen)
const staat = (x) => vingerafdruk([x.titel || "", (x.notitie || "").trim(), x.deadline || "", x.klaar ? 1 : 0,
  ...(x.parent ? ["p:" + x.parent] : []), ...(x.ster ? ["*"] : [])].join("\u0001"));
const extVan = (e, soort) => ({ ...e, ster: soort === "ms" ? !!e.ster : undefined, parent: soort === "google" ? e.parent || "" : "" });
function hier(x, k, soort) {
  const o = { titel: x.titel, notitie: x.notitie, deadline: x.deadline, klaar: x.status === "klaar" };
  if (soort === "google" && x.type === "taak" && x.project) { const p = project(x.project); if (p?.ext?.bron === k) o.parent = p.ext.id; }
  if (soort === "ms") o.ster = !!(x.urgent && x.belangrijk);
  return o;
}
const alles = () => [...d().taken, ...d().projecten];

function neemOver(x, e, k) {
  x.titel = e.titel || x.titel; x.notitie = e.notitie; x.deadline = e.deadline;
  if (e.klaar && x.status !== "klaar") rondAf(x, null, e.klaarOp || new Date());
  if (!e.klaar && x.status === "klaar") { x.status = "open"; delete x.klaarOp; delete x.klaarDoor; }
  if (e.ster !== undefined) { if (e.ster) { x.urgent = true; x.belangrijk = true; } else if (x.urgent && x.belangrijk) x.urgent = false; }
  if (x.type === "taak" && e.parent !== undefined) {
    const p = e.parent ? d().projecten.find(p => p.ext?.bron === k && p.ext.id === e.parent) : null;
    if (p) { x.project = p.id; } else if (!e.parent) x.project = null;
  }
}
// Een taak die in Google subtaken kreeg, wordt hier een project
function maakProject(t) {
  const D = d(); D.taken = D.taken.filter(x => x !== t);
  t.type = "project"; delete t.project; delete t.wie; delete t.wachtOp;
  D.projecten.push(t);
}

/** Koppelt externe lijst k aan Tijdkompas-lijst lijstId ("" = loskoppelen). Eén externe lijst per Tijdkompas-lijst. */
export function koppelTakenlijst(k, lijstId) {
  const D = d(); D.takenlijsten ||= {};
  for (const [k2, x] of Object.entries(D.takenlijsten)) if (lijstId && k2 !== k && x.lijst === lijstId) { x.lijst = ""; x.bekend = []; }
  const x = D.takenlijsten[k]; if (!x) return;
  if (x.lijst !== lijstId) { x.lijst = lijstId; x.bekend = []; }
  x.uit = !lijstId;          // bewust losgekoppeld: niet vanzelf opnieuw een lijst maken
  // oude koppelingen loslaten: er wordt niets weggegooid, de taken staan dan gewoon aan beide kanten.
  // Alleen van je eigen koppelingen: taken die een gelinkt account met zíjn takenlijst bijhoudt, blijven van hem.
  const eigen = (bron) => takenVerbindingen().some(v => bron.startsWith(v.id + "|"));
  for (const t of alles()) if (t.ext && eigen(t.ext.bron) && !Object.entries(D.takenlijsten).some(([k2, y]) => k2 === t.ext.bron && y.lijst === t.overzicht)) delete t.ext;
  bewaar();
}
export const takenlijstVan = (lijstId) => Object.entries(d().takenlijsten || {}).find(([, x]) => x.lijst === lijstId)?.[0] || "";

/**
 * Haalt alle takenlijsten op en stemt de gekoppelde af.
 * maakLijst(naam, soort, email) → id: maakt een Tijdkompas-lijst voor een nieuw gevonden takenlijst (die verschijnt dan vanzelf)
 */
export async function syncTaken({ maakLijst } = {}) {
  const D = d(); D.takenlijsten ||= {};
  const r = { binnen: 0, bij: 0, weg: 0, naar: 0, verlopen: [], fouten: [] };
  for (const v of takenVerbindingen()) {
    try {
      const lijsten = await takenlijsten(v);
      for (const l of lijsten) {
        const k = takenSleutel(v, l.id), nieuw = !D.takenlijsten[k];
        D.takenlijsten[k] = { lijst: "", bekend: [], ...D.takenlijsten[k], naam: l.naam, standaard: !!l.standaard, account: v.email, accountSoort: v.soort };
        // standaardlijst met de standaardnaam ("Mijn taken", "Tasks"…) → naam van het account; een eigen naam nemen we over
        const standaardNaam = l.standaard && /^(my tasks|mijn taken|tasks|taken|to ?do|takenlijst)$/i.test(String(l.naam || "").trim());
        if (nieuw && maakLijst && !l.gemarkeerd) D.takenlijsten[k].lijst = maakLijst(standaardNaam ? v.email.split("@")[0] : l.naam, v.soort, v.email) || "";
      }
      for (const k of Object.keys(D.takenlijsten)) if (k.startsWith(v.id + "|") && !lijsten.some(l => takenSleutel(v, l.id) === k)) delete D.takenlijsten[k];

      for (const [k, info] of Object.entries(D.takenlijsten)) {
        if (!k.startsWith(v.id + "|") || !info.lijst || !overzicht(info.lijst) || overzicht(info.lijst).slot) continue;
        const lijstId = idVan(k), ov = info.lijst, bekend = new Set(info.bekend || []);
        const gekoppeld = () => alles().filter(x => x.ext?.bron === k);
        // hier naar een andere lijst verplaatst: daar weghalen (in de nieuwe lijst gaat hij eventueel naar diens koppeling)
        for (const x of gekoppeld().filter(x => x.overzicht !== ov)) { await verwijderTaak(v, lijstId, x.ext.id); delete x.ext; r.weg++; }

        const ext = (await haalTaken(v, lijstId)).map(e => extVan(e, v.soort)), daar = new Map(ext.map(e => [e.id, e]));
        const hierIds = new Set(gekoppeld().map(x => x.ext.id));
        // Veiligheidsstop: verdwijnt in één keer meer dan de helft van de bekende taken (aan één kant), dan is er
        // waarschijnlijk iets niet goed geladen. Dan niets weggooien en het melden.
        const weghier = ext.filter(e => bekend.has(e.id) && !hierIds.has(e.id));
        const wegdaar = [...hierIds].filter(id => !daar.has(id));
        const teVeel = (n) => n > 3 && n > bekend.size / 2;
        if (teVeel(weghier.length) || teVeel(wegdaar.length)) {
          r.fouten.push(`„${info.naam}”: ${Math.max(weghier.length, wegdaar.length)} taken lijken weg; voor de zekerheid niets weggegooid. Klopt het wel? Zet de koppeling op „niet koppelen” en daarna weer terug.`);
          continue;
        }
        // hier weggegooid → daar ook. Een project dat hier weg is maar waarvan de taken blijven: die taken eerst
        // los hangen, anders gooit Google ze met hun ouder mee weg.
        for (const e of weghier) {
          for (const c of ext.filter(c => c.parent === e.id && hierIds.has(c.id))) { await verplaatsTaak(v, lijstId, c.id, ""); c.parent = ""; }
          await verwijderTaak(v, lijstId, e.id); daar.delete(e.id); r.weg++;
        }
        // taken die daar subtaken kregen, worden hier projecten
        const ouders = new Set(ext.map(e => e.parent).filter(Boolean));
        for (const t of D.taken.filter(t => t.ext?.bron === k && ouders.has(t.ext.id))) maakProject(t);

        // bestaande: vergelijken (projecten eerst, zodat subtaken hun project kunnen vinden)
        for (const x of [...D.projecten.filter(p => p.ext?.bron === k), ...D.taken.filter(t => t.ext?.bron === k)]) {
          const e = daar.get(x.ext.id); daar.delete(x.ext.id);
          if (!e) { if (x.status === "klaar") delete x.ext; else { delete x.ext; verwijder(x); } r.weg++; continue; }   // daar weggegooid
          const h = hier(x, k, v.soort), sDaar = staat(e), sHier = staat(h);
          if (sDaar === sHier) { x.ext.h = sDaar; continue; }
          if (sDaar !== x.ext.h && sHier === x.ext.h) { neemOver(x, e, k); x.ext.h = staat(hier(x, k, v.soort)); r.bij++; }   // alleen daar gewijzigd
          else {                                                                                       // hier gewijzigd (of allebei: Tijdkompas wint)
            x.ext.id = await zetTaak(v, lijstId, h, x.ext.id);
            if (v.soort === "google" && (h.parent || "") !== (e.parent || "")) await verplaatsTaak(v, lijstId, x.ext.id, h.parent || "");
            x.ext.h = sHier; r.naar++;
          }
        }
        // nieuw daar → hier (afgeronde taken van vroeger laten we liggen). Eerst het bovenste niveau, dan subtaken.
        const nieuwDaar = [...daar.values()].filter(e => !e.klaar && !bekend.has(e.id));
        for (const e of [...nieuwDaar.filter(e => !e.parent), ...nieuwDaar.filter(e => e.parent)]) {
          const basis = { overzicht: ov, titel: e.titel || "(zonder titel)", notitie: e.notitie, deadline: e.deadline,
                          ...(e.ster ? { urgent: true, belangrijk: true } : {}) };
          let x;
          if (!e.parent && ouders.has(e.id)) x = nieuwProject(basis);
          else {
            const p = e.parent ? D.projecten.find(p => p.ext?.bron === k && p.ext.id === e.parent) : null;
            x = nieuweTaak({ ...basis, project: p?.id || null, wie: [mijnId()] });
          }
          x.ext = { bron: k, id: e.id, h: staat(hier(x, k, v.soort)) }; r.binnen++;
        }
        // nieuw hier → daar: eerst projecten (open), dan taken (open en bij jou), zodat subtaken hun ouder hebben
        for (const x of [...D.projecten.filter(p => p.overzicht === ov && !p.ext && p.status !== "klaar"),
                         ...D.taken.filter(t => t.overzicht === ov && !t.ext && t.status !== "klaar" && isMijn(t))]) {
          const h = hier(x, k, v.soort);
          x.ext = { bron: k, id: await zetTaak(v, lijstId, h), h: staat(h) }; r.naar++;
        }
        info.bekend = gekoppeld().map(x => x.ext.id);
      }
    } catch (e) { e instanceof VerlopenFout ? r.verlopen.push(v) : r.fouten.push(`${v.email}: ${e.message}`); }
  }
  D.takenSync = new Date().toISOString();
  bewaar();
  return r;
}
