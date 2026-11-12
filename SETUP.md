# Eenmalige setup — inloggen met Google en Microsoft

Dit doet alleen de eigenaar van de site, één keer. Gebruikers merken er niets van: zij zien gewoon „Inloggen met Google / Microsoft”.

## A. Firebase (inloggen met Google + online opslag + delen) — ± 10 minuten

1. Ga naar https://console.firebase.google.com → **Project toevoegen** → naam `brennyc86-apps` (algemene naam: dezelfde inlog kan straks voor al je sites op brennyc86.github.io gebruikt worden; de projectnaam is later niet te wijzigen en staat in het Google-inlogvenster) → Google Analytics mag uit → **Project maken**.
2. Links **Build → Authentication** → **Aan de slag** → tab **Sign-in method** → **Google** → **Inschakelen**, kies je e-mail als ondersteuningsadres → **Opslaan**.
3. Zelfde pagina, tab **Instellingen** → **Geautoriseerde domeinen** → **Domein toevoegen** → `brennyc86.github.io`.
4. Links **Build → Firestore Database** → **Database maken** → locatie `europe-west4 (Netherlands)` → **productiemodus** → **Maken**.
   Daarna tab **Regels**: vervang alles door de inhoud van [`firestore.rules`](firestore.rules) → **Publiceren**.
5. Tandwiel linksboven → **Projectinstellingen** → onderaan **Je apps** → het web-icoon `</>` → bijnaam `Tijdkompas` (Hosting níet aanvinken) → **App registreren**.
   Je ziet een blok `const firebaseConfig = { apiKey: …, authDomain: …, projectId: …, … }` — **kopieer dat en stuur het naar Claude** (of zet het zelf in `js/config.js` bij `firebase:`).

Klaar: vanaf dan kan iedereen inloggen met Google. Er is geen goedkeuring van Google nodig, omdat alleen naam en e-mailadres worden gevraagd.

## B. Microsoft-inlog (optioneel, ± 10 minuten)

1. https://entra.microsoft.com → **Identiteit → Toepassingen → App-registraties → Nieuwe registratie**.
   - Naam `Tijdkompas`
   - Accounttypen: **Accounts in elke organisatiemap en persoonlijke Microsoft-accounts**
   - Omleidings-URI: platform **Web**, adres `https://<projectId>.firebaseapp.com/__/auth/handler` (staat ook in Firebase bij de Microsoft-aanbieder)
2. Kopieer de **Toepassings-id (client-id)**. Ga naar **Certificaten en geheimen → Nieuw clientgeheim** en kopieer de **Waarde**.
3. In Firebase: **Authentication → Sign-in method → Nieuwe aanbieder → Microsoft** → plak toepassings-id en geheim → **Opslaan**.

## C. Agenda's rechtstreeks koppelen (later)

Lezen en schrijven in Google Agenda vraagt bij Google een verificatie (agenda-rechten zijn „gevoelig”). Tot die is afgerond kunnen maximaal 100 vooraf opgegeven testgebruikers hun agenda koppelen. Outlook-agenda's kunnen via de app-registratie van stap B. Tot die tijd werkt importeren via een .ics-bestand.
