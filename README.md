# 🧭 Tijdkompas

Planner voor werk, privé en hobby's: projecten en taken, de Eisenhower-matrix (urgent/belangrijk), schatten en meten, en automatisch inroosteren in je agenda.

**Live:** https://brennyc86.github.io/tijdkompas/

## Wat er werkt

| Wens | Status |
|---|---|
| Projecten opdelen in taken (ook in één keer: één taak per regel) | ✅ |
| Losse taken; later aan een project koppelen en er weer uithalen | ✅ |
| Taken toewijzen (mij, collega's, hele groep) en afhankelijkheden („wacht op”) | ✅ |
| Mappen met lijsten (onbeperkt diep), map of lijst delen | ✅ |
| Koers: periode-afspraken (POP/PAP) met gekoppelde taken en gespreksoverzicht | ✅ |
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

## Mappen en lijsten

- Lijsten staan in **mappen**, zo diep als je wilt (📁 Werk → 💼 Team, 🌱 Werkgroep, 📁 Projecten 2027 → …). Een lijst bevat nooit een lijst.
- Verplaatsen met „In map”, hernoemen in het naamveld (Instellingen → Mappen & lijsten). Map verwijderen = de inhoud schuift een niveau omhoog.
- **⚙️ overal**: kijk je naar één lijst of map, dan staat bovenin „⚙️ naam” — daar wijzig je alles (soort, tijden, verdeling, map, delen, koersafspraken), ook later bij op- of afschalen. Ook via ⚙️ in het ▾-mapmenu.
- **Icoon kiezen** uit een emoji-kiezer: voorstellen die bij de naam passen bovenaan, dan groepen, zoeken, en „Alle emoji's”.
- Bovenin: **klik** = alleen die lijst of map, nog eens = weer alles. **Ctrl/⌘+klik** (telefoon: lang indrukken) = erbij of eraf. **▾** naast een map = de lijsten erin los aan/uit vinken. **＋** = nieuwe lijst of map.
- **Delen**: een hele map (met alles erin, ook wat er later bij komt) of één lijst. Waar je een gedeelde lijst of map bij jezelf neerzet is persoonlijk; zonder eigen keuze zie je de indeling van de eigenaar.
- **Verdeling** per lijst: 🙌 *Samen* — alles wordt bij iedereen ingepland (privé, of in het begin); 🧩 *Verdelen* — pas ingepland bij wie het is toegewezen, „hele groep” blijft liggen tot iemand het oppakt.

## Koers (POP/PAP)

- Leg aan het begin van een periode (bv. een jaar) **koersafspraken** vast: wat je wilt bereiken, waaraan je merkt dat het gelukt is, trefwoorden, en bij welke lijst of map het hoort (of algemeen).
- Taken die erop lijken worden **voorgesteld** (bij snelinvoer, in de taak, bij afronden en op de Koers-pagina); koppelen kan ook met de hand.
- Verhuist een lijst naar een map, dan kun je de afspraken meenemen naar de hele map.
- **Overzicht voor het gesprek**: per afspraak de afgeronde taken met datum en tijd, wat nog open staat en je terugblik — af te drukken als PDF of te kopiëren als tekst.
- Koers is persoonlijk: collega's in gedeelde lijsten zien het niet.

## Samenwerken: wie doet wat, en wie wacht op wie

- Per taak **wie het doet**: ik, een of meer leden, iemand zonder Tijdkompas (alleen een naam), of **de hele groep** (nog niet verdeeld). Snelinvoer: `@sanne`, `@team`.
- De groep blijft verantwoordelijk: iedereen kan meedoen („🙋 Ik” erbij) of andermans taak afvinken. De planner plant alleen wat (ook) van jou is.
- **Wacht op**: een taak kan wachten op andere taken (ook uit een andere lijst). Je ziet ⛓ *wacht op…* en ⏳ *Sanne wacht hierop*, plus 📅 wanneer het is ingepland.
  - De planner zet een wachtende taak pas ná de taak waar hij op wacht, en geeft een blokkerende taak minstens de prioriteit van wie erop wacht.
  - Filter *Waar anderen op mij wachten* / *Waar Sanne op wacht* / *Mijn taken* / *Nog niet verdeeld* in Taken en Matrix; Vandaag toont „Anderen wachten op jou”.
- **Afronden**: tijdstip (standaard nu) en, als je wilt, de gewerkte tijd (`1,5` = anderhalf uur). Dat helpt de schatfactor.

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
- **Opslag per lijst in je eigen Google Drive of OneDrive** (verborgen app-map): bijvoorbeeld je werklijst in je zakelijke OneDrive. Zo'n lijst is persoonlijk; de cloud kent dan alleen naam, icoon en kleur. Wijzigingen van meerdere apparaten worden per taak samengevoegd.
- Titels en plaatsen van agenda-afspraken gaan nooit naar de cloud, alleen tijden.

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

Statische site zonder build-stap: `js/data.js` (model + opslag), `js/plan.js` (dagindeling, inroosteren, .ics), `js/cloud.js` (Firebase: inloggen, Firestore-opslag als verschil-synchronisatie, delen), `js/koppeling.js` + `js/sync.js` (Google Agenda / Outlook), `js/schijf.js` (lijsten in eigen Drive/OneDrive, 3-wegs samenvoegen), `js/app.js` (UI). Beveiligingsregels: `firestore.rules`.
