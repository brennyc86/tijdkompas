// Tijdkompas — doorgeefluik voor gepubliceerde agenda-links (.ics), als Cloudflare Worker (gratis, zonder kaart).
// Een browser mag een Outlook-agendalink niet zelf ophalen (CORS); dit doorgeefluik haalt hem op en geeft hem door
// aan Tijdkompas. Het slaat niets op (ook niet tijdelijk in een cache) en geeft alleen agenda-adressen van bekende
// agendadiensten door, en alleen aan Tijdkompas zelf.
const TOEGESTAAN = [/^outlook\.live\.com$/, /^outlook\.office365\.com$/, /^outlook\.office\.com$/, /(^|\.)calendar\.google\.com$/, /(^|\.)icloud\.com$/];
const HERKOMST = ["https://brennyc86.github.io"];

export default {
  async fetch(req) {
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
