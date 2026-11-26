// Tijdkompas — doorgeefluik voor gepubliceerde agenda-links (.ics), als Cloudflare Worker (gratis, zonder kaart).
// Een browser mag een Outlook-agendalink niet zelf ophalen (CORS); dit doorgeefluik haalt hem op en geeft hem door
// aan Tijdkompas. Het slaat niets op (ook niet tijdelijk in een cache) en geeft alleen agenda-adressen van bekende
// agendadiensten door, en alleen aan Tijdkompas zelf.
// En: /ai/<sleutel> — AI-toegang: een AI leest daar de taken die je met hem deelt (GET) en meldt wat hij deed (POST).
// Daarnaast: /feed/<sleutel>.ics — je abonneer-link (ingeplande blokken, allemaal op "vrij") voor bijv. Outlook of Copilot.
// Die haalt het doorgeefluik uit Firestore (feeds/<sleutel>, alleen te lezen met die sleutel) en geeft hem door als agenda.
const TOEGESTAAN = [/^outlook\.live\.com$/, /^outlook\.office365\.com$/, /^outlook\.office\.com$/, /(^|\.)calendar\.google\.com$/, /(^|\.)icloud\.com$/];
const HERKOMST = ["https://brennyc86.github.io"];
const FIREBASE_PROJECT = "brennycc86-apps";
const FEED = /^\/feed\/([A-Za-z0-9_-]{32,64})\.ics$/;

async function geefFeed(req, sleutel) {
  // Tijdkompas zelf mag de link ook lezen (knop "Link testen"); agenda-apps sturen geen Origin mee
  const origin = req.headers.get("Origin") || "";
  const kop = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Tijdkompas-Feed": "1",
                ...(HERKOMST.includes(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Expose-Headers": "X-Tijdkompas-Feed", "Vary": "Origin" } : {}) };
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("Niet toegestaan", { status: 405, headers: kop });
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/feeds/${sleutel}`;
  let r;
  try { r = await fetch(url, { headers: { "User-Agent": "Tijdkompas-feed" }, cache: "no-store" }); }
  catch (e) { if (!/cache/i.test(String(e?.message || e))) throw e; r = await fetch(url, { headers: { "User-Agent": "Tijdkompas-feed" } }); }
  if (!r.ok) return new Response("Onbekende of ingetrokken link", { status: 404, headers: kop });
  const ics = (await r.json())?.fields?.ics?.stringValue || "";
  if (!ics.startsWith("BEGIN:VCALENDAR")) return new Response("Onbekende of ingetrokken link", { status: 404, headers: kop });
  return new Response(req.method === "HEAD" ? null : ics, { headers: { ...kop, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="tijdkompas.ics"' } });
}

// ---------- AI-toegang: /ai/<sleutel> ----------
// GET  → de gedeelde AI-taken (JSON, met uitleg voor de AI) en de meldingen die nog verwerkt moeten worden
// POST → een melding van de AI: { taak, status?: "open"|"bezig"|"beoordelen", tekst?, deeltaken?: [{ titel, klaar }], vraag? | bericht?, door? }
// Het doorgeefluik bewaart niets zelf: alles staat in Firestore, waar de beveiligingsregels het formaat afdwingen.
const AI = /^\/ai\/([A-Za-z0-9_-]{32,64})(?:\.json)?(\/sein)?\/?$/;
const FS = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;
const aiKop = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
                "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const aiJson = (x, status = 200) => new Response(JSON.stringify(x, null, 2), { status, headers: { ...aiKop, "Content-Type": "application/json; charset=utf-8" } });
const waarde = (v) => v == null ? null : v.stringValue ?? v.timestampValue ?? v.booleanValue ?? v.integerValue ?? null;
async function fsGet(pad) {
  let r;
  try { r = await fetch(`${FS}/${pad}`, { headers: { "User-Agent": "Tijdkompas-ai" }, cache: "no-store" }); }
  catch (e) { if (!/cache/i.test(String(e?.message || e))) throw e; r = await fetch(`${FS}/${pad}`, { headers: { "User-Agent": "Tijdkompas-ai" } }); }
  return r;
}
async function geefAi(req, sleutel, sein) {
  if (req.method === "OPTIONS") return new Response(null, { headers: aiKop });
  const doc = await fsGet(`ai/${sleutel}`);
  if (!doc.ok) return aiJson({ fout: "Onbekende of ingetrokken AI-link" }, 404);
  const f = (await doc.json())?.fields || {};
  if (sein) return stuurSein(req, sleutel, f);
  if (req.method === "GET" || req.method === "HEAD") {
    let inhoud = {};
    try { inhoud = JSON.parse(waarde(f.json) || "{}"); } catch {}
    let wachtend = [];
    const m = await fsGet(`ai/${sleutel}/meldingen?pageSize=100`);
    if (m.ok) wachtend = ((await m.json()).documents || []).map(x => {
      const v = x.fields || {}; let deel = null;
      try { deel = v.deeltaken ? JSON.parse(waarde(v.deeltaken)) : null; } catch {}
      return { taak: waarde(v.taak), status: waarde(v.status), tekst: waarde(v.tekst), deeltaken: deel, ...(v.bericht ? { [waarde(v.vraag) ? "vraag" : "bericht"]: waarde(v.bericht) } : {}), door: waarde(v.door), tijd: waarde(v.tijd) };
    });
    return aiJson({ ...inhoud, bijgewerkt: waarde(f.bijgewerkt), wachtend });
  }
  if (req.method !== "POST") return aiJson({ fout: "Alleen GET en POST" }, 405);
  let b;
  try { b = JSON.parse((await req.text()).slice(0, 60000)); } catch { return aiJson({ fout: "Body is geen geldige JSON" }, 400); }
  if (!b || typeof b.taak !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(b.taak)) return aiJson({ fout: "Veld 'taak' (id van de taak) ontbreekt of is ongeldig" }, 400);
  const velden = { taak: { stringValue: b.taak }, tijd: { timestampValue: new Date().toISOString() } };
  if (b.status != null) { if (!["open", "bezig", "beoordelen"].includes(b.status)) return aiJson({ fout: "status moet open, bezig of beoordelen zijn (afvinken doet de eigenaar)" }, 400); velden.status = { stringValue: b.status }; }
  const tekst = b.tekst ?? b.notitie ?? b.toelichting;
  if (tekst != null) velden.tekst = { stringValue: String(tekst).slice(0, 4000) };
  if (b.door != null) velden.door = { stringValue: String(b.door).slice(0, 60) };
  const vraag = b.vraag != null && b.vraag !== false && b.vraag !== true ? b.vraag : null, bericht = vraag ?? b.bericht;
  if (bericht != null && String(bericht).trim()) { velden.bericht = { stringValue: String(bericht).slice(0, 4000) }; velden.vraag = { booleanValue: vraag != null }; }
  if (b.deeltaken != null) {
    if (!Array.isArray(b.deeltaken)) return aiJson({ fout: "deeltaken moet een lijst zijn: [{ titel, klaar }]" }, 400);
    const d = b.deeltaken.slice(0, 50).map(x => typeof x === "string" ? { titel: x, klaar: false } : { titel: String(x?.titel || "").slice(0, 200), klaar: !!x?.klaar }).filter(x => x.titel.trim());
    velden.deeltaken = { stringValue: JSON.stringify(d) };
  }
  if (Object.keys(velden).length <= 2) return aiJson({ fout: "Geef minstens status, tekst, deeltaken, vraag of bericht mee" }, 400);
  const id = "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const r = await fetch(`${FS}/ai/${sleutel}/meldingen?documentId=${id}`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Tijdkompas-ai" }, body: JSON.stringify({ fields: velden }) });
  if (!r.ok) return aiJson({ fout: `Melding niet opgeslagen (${r.status})` }, 502);
  return aiJson({ ok: true, id, uitleg: "Ontvangen. Wordt verwerkt zodra de eigenaar Tijdkompas open heeft; tot die tijd staat hij bij 'wachtend'." });
}

// Seintje: de webhook die de eigenaar bij de agent heeft ingesteld (alleen https) krijgt te horen dat er iets is.
// Werkt met o.a. Slack/Teams ("text"), Discord ("content"), ntfy, n8n, Make en Zapier. De geheime link gaat niet mee.
async function stuurSein(req, sleutel, f) {
  if (req.method !== "POST") return aiJson({ fout: "Alleen POST" }, 405);
  const url = waarde(f.sein) || "";
  if (!/^https:\/\/[^\s]+$/.test(url)) return aiJson({ fout: "Geen seintje (webhook) ingesteld voor deze agent" }, 400);
  // niet vaker dan eens per 30 seconden per agent (bijv. als er meerdere apparaten open staan)
  const rem = globalThis.caches?.default, sleutelUrl = `https://sein.tijdkompas/${sleutel}`;
  try { if (rem && await rem.match(sleutelUrl)) return aiJson({ ok: true, overgeslagen: "net al een seintje gestuurd" }); } catch {}
  let inhoud = {}; try { inhoud = JSON.parse(waarde(f.json) || "{}"); } catch {}
  const a = Array.isArray(inhoud.aandacht) ? inhoud.aandacht : [], agent = inhoud.agent || waarde(f.naam) || "AI";
  const REDEN = { nieuw: "nieuw", antwoord: "antwoord van de eigenaar", teruggestuurd: "teruggestuurd" };
  const tekst = a.length ? `🤖 ${agent}: er ${a.length === 1 ? "is 1 taak" : `zijn ${a.length} taken`} in Tijdkompas die je aandacht ${a.length === 1 ? "vraagt" : "vragen"} — ` + a.slice(0, 10).map(x => `${x.titel} (${REDEN[x.reden] || x.reden})`).join("; ")
                         : `🤖 ${agent}: er is iets bijgewerkt in Tijdkompas.`;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Tijdkompas-sein" },
    body: JSON.stringify({ text: tekst, content: tekst, message: tekst, agent, aandacht: a, tijd: new Date().toISOString() }) }).catch(e => ({ ok: false, status: String(e?.message || e) }));
  try { if (rem) await rem.put(sleutelUrl, new Response("1", { headers: { "Cache-Control": "max-age=30" } })); } catch {}
  return r.ok ? aiJson({ ok: true }) : aiJson({ fout: `Webhook gaf ${r.status}` }, 502);
}

export default {
  async fetch(req) {
    const ai = new URL(req.url).pathname.match(AI);
    if (ai) { try { return await geefAi(req, ai[1], !!ai[2]); } catch (e) { return aiJson({ fout: "Doorgeefluik: " + String(e?.message || e).slice(0, 200) }, 502); } }
    // Abonneer-link: agenda-apps sturen geen Origin mee; de lange sleutel is de toegang
    const feed = new URL(req.url).pathname.match(FEED);
    if (feed) return geefFeed(req, feed[1]);
    const origin = req.headers.get("Origin") || "";
    const cors = { "Access-Control-Allow-Origin": HERKOMST.includes(origin) ? origin : HERKOMST[0], "Vary": "Origin",
                   "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
    // Alleen vragen vanuit Tijdkompas zelf (een browser stuurt altijd Origin mee bij zo'n verzoek)
    if (!HERKOMST.includes(origin)) return new Response("Niet toegestaan", { status: 403, headers: cors });
    if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "GET" } });
    if (req.method !== "GET") return new Response("Niet toegestaan", { status: 405, headers: cors });
    const ruw = (new URL(req.url).searchParams.get("url") || "").replace(/^webcals?:\/\//i, "https://");
    let doel;
    try { doel = new URL(ruw); } catch { return new Response("Geen geldige agendalink", { status: 400, headers: cors }); }
    if (doel.protocol !== "https:" || !TOEGESTAAN.some(r => r.test(doel.hostname)))
      return new Response("Alleen agendalinks van Outlook, Google of iCloud worden doorgegeven", { status: 403, headers: cors });
    // Geen cache bij Cloudflare: de agenda gaat alleen door, wordt nergens bewaard
    // (cache: "no-store" werkt bij Workers met een compatibiliteitsdatum vanaf 11-11-2024; anders zonder cache-opties:
    //  .ics-bestanden komen dan standaard ook niet in de Cloudflare-cache. Nooit cacheTtl gebruiken: dat zet de cache juist aan.)
    const opties = { headers: { "User-Agent": "Tijdkompas-agenda" }, redirect: "follow" };
    let r;
    try { r = await fetch(doel.toString(), { ...opties, cache: "no-store" }); }
    catch (e) { if (!/cache/i.test(String(e?.message || e))) throw e; r = await fetch(doel.toString(), opties); }
    const tekst = await r.text();
    if (!r.ok || !tekst.includes("BEGIN:VCALENDAR"))
      return new Response(`Geen agenda gevonden op die link (${r.status})`, { status: 502, headers: cors });
    return new Response(tekst, { headers: { ...cors, "Content-Type": "text/calendar; charset=utf-8" } });
  },
};
