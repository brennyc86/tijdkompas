// Tijdkompas — doorgeefluik voor gepubliceerde agenda-links (.ics), als Cloudflare Worker (gratis, zonder kaart).
// Een browser mag een Outlook-agendalink niet zelf ophalen (CORS); dit doorgeefluik haalt hem op en geeft hem door
// aan Tijdkompas. Het slaat niets op en geeft alleen agenda-adressen van bekende agendadiensten door.
const TOEGESTAAN = [/^outlook\.live\.com$/, /^outlook\.office365\.com$/, /^outlook\.office\.com$/, /(^|\.)calendar\.google\.com$/, /(^|\.)icloud\.com$/];
const HERKOMST = ["https://brennyc86.github.io"];

export default {
  async fetch(req) {
    const origin = req.headers.get("Origin") || "";
    const cors = { "Access-Control-Allow-Origin": HERKOMST.includes(origin) ? origin : HERKOMST[0], "Vary": "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "GET" } });
    const ruw = (new URL(req.url).searchParams.get("url") || "").replace(/^webcals?:\/\//i, "https://");
    let doel;
    try { doel = new URL(ruw); } catch { return new Response("Geen geldige agendalink", { status: 400, headers: cors }); }
    if (doel.protocol !== "https:" || !TOEGESTAAN.some(r => r.test(doel.hostname)))
      return new Response("Alleen agendalinks van Outlook, Google of iCloud worden doorgegeven", { status: 403, headers: cors });
    const r = await fetch(doel.toString(), { headers: { "User-Agent": "Tijdkompas-agenda" }, cf: { cacheTtl: 300 } });
    const tekst = await r.text();
    if (!r.ok || !tekst.includes("BEGIN:VCALENDAR"))
      return new Response(`Geen agenda gevonden op die link (${r.status})`, { status: 502, headers: cors });
    return new Response(tekst, { headers: { ...cors, "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=300" } });
  },
};
