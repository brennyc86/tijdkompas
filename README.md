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

## Google en Outlook

- **Inloggen met Google**: je planning wordt ook bewaard in je eigen Google Drive (verborgen app-map), dus op elk apparaat dezelfde.
- **Meerdere accounts tegelijk**: Google (privé, tweede account) en Microsoft/Outlook (zakelijk, Office 365, outlook.com).
- **Agenda's classificeren**: per agenda kies je *Bezet* (er wordt omheen gepland, optioneel gekoppeld aan een lijst), *Rooster van lijst* (de afspraken zíjn de vaste tijden van bijv. werk — voor wisselende diensten) of *Niet meetellen* (verjaardagen, feestdagen).
- **Blokken terugzetten**: per lijst kies je een doelagenda; „In mijn agenda zetten” maakt, verschuift en verwijdert de blokken daar.

### Eenmalige setup
Beide diensten vragen een (openbaar) client-ID — de stappen staan in de app bij *Instellingen → Agenda's & accounts*. Vul ze in `js/config.js` in, dan hoeft niemand anders dit te doen.
- Google Cloud: project, Calendar API + Drive API aan, OAuth-toestemmingsscherm (Extern, testgebruikers), OAuth-client *Webapplicatie* met oorsprong `https://brennyc86.github.io`.
- Microsoft Entra: app-registratie voor *elke organisatie + persoonlijke accounts*, platform SPA, redirect `https://brennyc86.github.io/tijdkompas/auth.html`.

Zolang de Google-app in *testmodus* staat, kunnen alleen toegevoegde testgebruikers (max. 100) inloggen; voor iedereen is Google-verificatie nodig (agenda-rechten zijn „gevoelig”).

## Volgende stap
Samen met anderen aan dezelfde lijst werken (delen) vraagt een gedeelde server (bijv. Firebase of een Cloudflare Worker); de „Delen…”-velden slaan wie erbij hoort al op.

## Snelinvoer

`Offerte sturen ~45m !u ^vr #presentatie +werk`

- `~1u30` geschatte duur · `!u` urgent · `!b` belangrijk · `!nb` niet belangrijk
- `^vr`, `^morgen`, `^15-11` deadline · `#woord` project · `+werk` overzicht
- Toetsen: `n` nieuwe taak, `p` nieuw project

## Techniek

Statische site zonder build-stap: `js/data.js` (model + opslag), `js/plan.js` (dagindeling, inroosteren, .ics), `js/koppeling.js` (Google Identity Services, MSAL, Calendar/Graph/Drive-API), `js/sync.js` (agenda's ophalen/wegschrijven, Drive-sync), `js/app.js` (UI). Geen eigen server: tokens blijven in de browser.
