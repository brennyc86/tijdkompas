// Tijdkompas — takenlijsten afstemmen met Google Taken en Microsoft To Do (Outlook-taken)
// Elke externe takenlijst kan aan één Tijdkompas-lijst hangen. Dan gaat het twee kanten op:
//   - nieuwe taken daar komen hier binnen; nieuwe (eigen) taken hier gaan daarheen
//   - titel, notitie, deadline en afgerond gaan heen en weer; wie het laatst wijzigde wint (bij twijfel Tijdkompas)
//   - weggooien aan de ene kant gooit ook weg aan de andere kant
// Per externe lijst onthouden we welke taken we al kenden ("bekend"). Zo is een taak die daar wel en hier niet
// meer staat hier weggegooid (dus daar ook weg), en een taak die we nog niet kenden nieuw (dus hier binnenhalen).
import { opslag, bewaar, overzicht, nieuweTaak, verwijder, rondAf, mijnId, isMijn } from "./data.js";
import { verbindingen as alleVerbindingen, heeft, VerlopenFout, takenlijsten, haalTaken, zetTaak, verwijderTaak } from "./koppeling.js";
import { vingerafdruk } from "./sync.js";

const d = () => opslag.d;
export const takenVerbindingen = () => alleVerbindingen().filter(v => heeft(v, "taken"));
export const takenSleutel = (v, id) => `${v.id}|${id}`;
export const takenVerbindingVan = (k) => takenVerbindingen().find(v => k.startsWith(v.id + "|"));
const idVan = (k) => k.slice(k.indexOf("|") + 1);
const staat = (x) => vingerafdruk([x.titel || "", (x.notitie || "").trim(), x.deadline || "", x.klaar ? 1 : 0].join("\u0001"));
const hier = (t) => ({ titel: t.titel, notitie: t.notitie, deadline: t.deadline, klaar: t.status === "klaar" });

function neemOver(t, e) {
  t.titel = e.titel || t.titel; t.notitie = e.notitie; t.deadline = e.deadline;
  if (e.klaar && t.status !== "klaar") rondAf(t, null, e.klaarOp || new Date());
  if (!e.klaar && t.status === "klaar") { t.status = "open"; delete t.klaarOp; delete t.klaarDoor; }
}

/** Koppelt externe lijst k aan Tijdkompas-lijst lijstId ("" = loskoppelen). Eén externe lijst per Tijdkompas-lijst. */
export function koppelTakenlijst(k, lijstId) {
  const D = d(); D.takenlijsten ||= {};
  for (const [k2, x] of Object.entries(D.takenlijsten)) if (lijstId && k2 !== k && x.lijst === lijstId) { x.lijst = ""; x.bekend = []; }
  const x = D.takenlijsten[k]; if (!x) return;
  if (x.lijst !== lijstId) { x.lijst = lijstId; x.bekend = []; }
  x.uit = !lijstId;          // bewust losgekoppeld: niet vanzelf opnieuw een lijst maken
  // oude koppelingen loslaten: er wordt niets weggegooid, de taken staan dan gewoon aan beide kanten
  for (const t of D.taken) if (t.ext && !Object.entries(D.takenlijsten).some(([k2, y]) => k2 === t.ext.bron && y.lijst === t.overzicht)) delete t.ext;
  bewaar();
}
export const takenlijstVan = (lijstId) => Object.entries(d().takenlijsten || {}).find(([, x]) => x.lijst === lijstId)?.[0] || "";

/** Haalt alle takenlijsten op en stemt de gekoppelde af. */
/** maakLijst(naam, soort) → id: maakt een Tijdkompas-lijst voor een nieuw gevonden takenlijst (die verschijnt dan vanzelf) */
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
        // taak hier naar een andere lijst verplaatst: daar weghalen (in de nieuwe lijst gaat hij eventueel naar diens koppeling)
        for (const t of D.taken.filter(t => t.ext?.bron === k && t.overzicht !== ov)) { await verwijderTaak(v, lijstId, t.ext.id); delete t.ext; r.weg++; }

        const ext = await haalTaken(v, lijstId), daar = new Map(ext.map(e => [e.id, e]));
        const hierIds = new Set(D.taken.filter(t => t.ext?.bron === k).map(t => t.ext.id));
        // Veiligheidsstop: verdwijnt in één keer meer dan de helft van de bekende taken (aan één kant), dan is er
        // waarschijnlijk iets niet goed geladen. Dan niets weggooien en het melden.
        const weghier = ext.filter(e => bekend.has(e.id) && !hierIds.has(e.id));
        const wegdaar = [...hierIds].filter(id => !daar.has(id));
        const teVeel = (n) => n > 3 && n > bekend.size / 2;
        if (teVeel(weghier.length) || teVeel(wegdaar.length)) {
          r.fouten.push(`„${info.naam}”: ${Math.max(weghier.length, wegdaar.length)} taken lijken weg; voor de zekerheid niets weggegooid. Klopt het wel? Zet de koppeling op „niet koppelen” en daarna weer terug.`);
          continue;
        }
        // hier weggegooid → daar ook
        for (const e of weghier) { await verwijderTaak(v, lijstId, e.id); daar.delete(e.id); r.weg++; }

        for (const t of D.taken.filter(t => t.ext?.bron === k)) {
          const e = daar.get(t.ext.id); daar.delete(t.ext.id);
          if (!e) { if (t.status === "klaar") delete t.ext; else { delete t.ext; verwijder(t); } r.weg++; continue; }   // daar weggegooid
          const sDaar = staat(e), sHier = staat(hier(t));
          if (sDaar === sHier) { t.ext.h = sDaar; continue; }
          if (sDaar !== t.ext.h && sHier === t.ext.h) { neemOver(t, e); t.ext.h = sDaar; r.bij++; }   // alleen daar gewijzigd
          else { t.ext.id = await zetTaak(v, lijstId, hier(t), t.ext.id); t.ext.h = sHier; r.naar++; }   // hier gewijzigd (of allebei: Tijdkompas wint)
        }
        // nieuw daar → hier (afgeronde taken van vroeger laten we liggen)
        for (const e of daar.values()) {
          if (e.klaar || bekend.has(e.id)) continue;
          const t = nieuweTaak({ overzicht: ov, titel: e.titel || "(zonder titel)", notitie: e.notitie, deadline: e.deadline, wie: [mijnId()] });
          t.ext = { bron: k, id: e.id, h: staat(e) }; r.binnen++;
        }
        // nieuw hier → daar (alleen open taken die bij jou horen)
        for (const t of D.taken.filter(t => t.overzicht === ov && !t.ext && t.status !== "klaar" && isMijn(t))) {
          const id = await zetTaak(v, lijstId, hier(t)); t.ext = { bron: k, id, h: staat(hier(t)) }; r.naar++;
        }
        info.bekend = D.taken.filter(t => t.ext?.bron === k).map(t => t.ext.id);
      }
    } catch (e) { e instanceof VerlopenFout ? r.verlopen.push(v) : r.fouten.push(`${v.email}: ${e.message}`); }
  }
  D.takenSync = new Date().toISOString();
  bewaar();
  return r;
}
