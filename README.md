# 🧭 Tijdkompas

Planner voor werk, privé en hobby's: projecten en taken, de Eisenhower-matrix (urgent/belangrijk), schatten en meten, en automatisch inroosteren in je agenda.

**Live:** https://brennyc86.github.io/tijdkompas/

## Wat er werkt

| Wens | Status |
|---|---|
| Projecten opdelen in taken (ook in één keer: één taak per regel) | ✅ |
| Losse taken; later aan een project koppelen en er weer uithalen | ✅ |
| Deadline én eigen streefdatum op taken en projecten | ✅ |
| Geschatte tijd vooraf, werkelijke tijd achteraf (gevraagd bij afronden) | ✅ |
| Urgent/belangrijk-matrix op projecten én taken, verslepen tussen kwadranten | ✅ |
| Mails/links koppelen (Gmail, Outlook, Drive, SharePoint…) | ✅ plakken, bladwijzer-knop, „Delen” op Android |
| Meerdere overzichten (werk/privé/hobby), los of gecombineerd tonen | ✅ |
| Automatisch inroosteren in vrije tijd, per overzicht eigen werktijden | ✅ |
| Bestaande afspraken ontwijken | ✅ rechtstreeks uit Google/Outlook, of via .ics |
| Planning naar Google Agenda / Outlook | ✅ automatisch per lijst, of .ics / per blok |
| Inzicht: schatfactor, tijd per kwadrant | ✅ |
| Back-up downloaden/terugzetten | ✅ |

## Lijsten, locaties en reistijd

- **Lijsten** (werk, privé, boot, vereniging…) hebben een naam, kleur, standaardlocatie en een soort:
  - **Vaste tijden** — eigen tijdvakken per dag, elk met een locatie (bijv. ma/di/do kantoor, wo/vr thuis). Taken alleen binnen die tijden; reistijd ervoor en erna gaat af van je vrije tijd.
  - **Vrije tijd** — wordt gevuld met wat overblijft binnen je *beschikbaarheid*, na aftrek van vaste tijden, reistijd en afspraken. Op een locatie met reistijd krijgt elke sessie reis heen en terug, en taken op dezelfde plek worden achter elkaar gezet.
- **Locaties** met reistijd (enkele reis vanaf huis) en optioneel adres; afspraken met een herkenbare plaats krijgen automatisch reistijd.
- Een taak of project kan een eigen locatie hebben (bijv. „printen op kantoor” → alleen op kantoordagen).

## Inloggen en delen

- **Inloggen met Google of Microsoft** (Firebase Authentication). Je planning staat online (Firestore) en is op elk apparaat hetzelfde, ook offline bruikbaar.
- **Zakelijk + privé**: log in met het ene account en koppel het andere erbij; daarna kom je met beide in hetzelfde Tijdkompas.
- **Lijsten delen**: nodig iemand uit op e-mailadres; die ziet de uitnodiging zodra hij inlogt. Alle leden zien en bewerken de taken en projecten van die lijst live.
- In een gedeelde lijst kies je per taak **wie het doet**; de planner plant alleen jouw eigen taken in. Je werktijden en locaties blijven persoonlijk.
- Zonder inloggen werkt alles ook, dan alleen in deze browser.

Eenmalige setup door de eigenaar: zie [SETUP.md](SETUP.md).

## Agenda's

- Bestaande afspraken komen uit Google/Outlook (rechtstreeks, zodra ingesteld) of uit een .ics-bestand.
- Per agenda: *Bezet* (er wordt omheen gepland), *Rooster van lijst* (de afspraken zijn de vaste tijden van bijv. werk) of *Niet meetellen*.
- Per lijst een doelagenda; „In mijn agenda zetten” maakt, verschuift en verwijdert de blokken daar.

## Snelinvoer

`Offerte sturen ~45m !u ^vr #presentatie +werk`

- `~1u30` geschatte duur · `!u` urgent · `!b` belangrijk · `!nb` niet belangrijk
- `^vr`, `^morgen`, `^15-11` deadline · `#woord` project · `+werk` overzicht
- Toetsen: `n` nieuwe taak, `p` nieuw project

## Techniek

Statische site zonder build-stap: `js/data.js` (model + opslag), `js/plan.js` (dagindeling, inroosteren, .ics), `js/cloud.js` (Firebase: inloggen, Firestore-opslag als verschil-synchronisatie, delen), `js/koppeling.js` + `js/sync.js` (Google Agenda / Outlook), `js/app.js` (UI). Beveiligingsregels: `firestore.rules`.
