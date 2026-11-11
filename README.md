# 🧭 Tijdkompas

Planner voor werk, privé en hobby's: projecten en taken, de Eisenhower-matrix (urgent/belangrijk), schatten en meten, en automatisch inroosteren in je agenda.

**Live:** https://brennyc86.github.io/tijdkompas/

## Wat er nu al werkt (fase 1: lokaal, in de browser)

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
| Bestaande afspraken ontwijken | ✅ via .ics-import (Google/Outlook-export) |
| Planning naar Google Agenda / Outlook | ✅ .ics-export of per blok één klik |
| Inzicht: schatfactor, tijd per kwadrant | ✅ |
| Back-up downloaden/terugzetten | ✅ |

## Fase 2: inloggen, meerdere accounts, delen (volgt)

- Inloggen met Google (en Microsoft voor zakelijk Outlook).
- Overzichten zijn gedeelde ruimtes met leden: je koppelt je zakelijke én privé-account aan hetzelfde overzicht; delen met anderen werkt op dezelfde manier. De „Delen…”-velden slaan dit nu al op.
- Live synchronisatie tussen apparaten en mensen.
- Agenda rechtstreeks via Google Calendar API / Microsoft Graph (vrije tijd lezen en blokken wegschrijven), zonder .ics.

Eenmalige setup daarvoor: een Firebase-project (Auth + Firestore) of een Cloudflare Worker + D1, plus een OAuth-client in Google Cloud en een app-registratie in Azure voor Outlook.

## Snelinvoer

`Offerte sturen ~45m !u ^vr #presentatie +werk`

- `~1u30` geschatte duur · `!u` urgent · `!b` belangrijk · `!nb` niet belangrijk
- `^vr`, `^morgen`, `^15-11` deadline · `#woord` project · `+werk` overzicht
- Toetsen: `n` nieuwe taak, `p` nieuw project

## Techniek

Statische site zonder build-stap: `index.html`, `style.css`, `js/data.js` (model + opslag), `js/plan.js` (inroosteren, .ics, agenda-links), `js/app.js` (UI). Data staat in `localStorage`. De opslaglaag in `data.js` is de plek waar de cloud-adapter straks onder komt.
