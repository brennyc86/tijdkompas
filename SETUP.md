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

## C. Drive, OneDrive en agenda's koppelen (± 15 minuten)

Hiermee kan iedereen per lijst kiezen om hem in de eigen Google Drive of OneDrive te bewaren, en agenda's koppelen.
Je gebruikt dezelfde projecten als bij A en B; er komen alleen een paar instellingen bij. Stuur daarna de twee **client-ID's** naar Claude
(of zet ze zelf in `js/config.js` bij `googleClientId` en `microsoftClientId`). Geheime sleutels zijn hiervoor níet nodig.

**Google** (in https://console.cloud.google.com, kies bovenin het Firebase-project uit stap A)
1. **API's en services → Bibliotheek** → zet **Google Drive API** aan (en **Google Calendar API** voor agenda's).
2. **API's en services → Inloggegevens** → open **Web client (auto created by Google Service)** →
   bij **Geautoriseerde JavaScript-bronnen** `https://brennyc86.github.io` toevoegen → **Opslaan**. Kopieer de **Client-ID** (eindigt op `.apps.googleusercontent.com`).
3. **Google Auth Platform → Gegevenstoegang** → **Bereiken toevoegen** → vink `.../auth/drive.appdata` aan (en voor agenda's `calendar.readonly` en `calendar.events`) → **Opslaan**.
4. **Google Auth Platform → Doelgroep** → **App publiceren** (naar „In productie”). Anders kunnen alleen testgebruikers koppelen en vervalt de koppeling elke 7 dagen.
   - Drive-opslag (`drive.appdata`) is een *niet-gevoelige* toestemming: daar is geen verificatie voor nodig.
   - Agenda-rechten zijn *gevoelig*: tot Google de app heeft geverifieerd zien gebruikers een waarschuwing („niet geverifieerd”) en geldt een maximum van 100 gebruikers. Jij kunt het wel meteen gebruiken.

**Microsoft** (in https://entra.microsoft.com, de app-registratie `Tijdkompas` uit stap B)
1. **Verificatie → Een platform toevoegen → Toepassing met één pagina (SPA)** → omleidings-URI `https://brennyc86.github.io/tijdkompas/auth.html` → **Configureren**.
   (Het Web-platform van stap B blijft gewoon staan.)
2. **API-machtigingen → Een machtiging toevoegen → Microsoft Graph → Gedelegeerde machtigingen** → `Files.ReadWrite.AppFolder` en `Calendars.ReadWrite` (en `User.Read`, staat er meestal al) → **Machtigingen toevoegen**.
3. Kopieer op **Overzicht** de **Toepassings-id (client-id)**.

**Zakelijke Microsoft-accounts:** veel bedrijven laten medewerkers zelf geen toestemming geven aan apps van buiten. Krijg je bij het koppelen van je werk-OneDrive
„Goedkeuring van beheerder vereist”, dan moet de IT-afdeling Tijdkompas één keer goedkeuren (ze zien precies welke rechten: alleen een eigen app-map en je agenda).
Een „geverifieerde uitgever” in Entra maakt dat makkelijker, maar vraagt een Microsoft-partneraccount; dat kan later.

### Goed om te weten
- **Google Drive vraagt elk uur even opnieuw verbinden.** Zonder eigen server geeft Google een browser alleen toegang voor een uur; daarna verschijnt een balk
  „Opnieuw verbinden” (één klik). Wijzigingen blijven intussen veilig op het apparaat staan. OneDrive heeft dit niet: dat vernieuwt zichzelf op de achtergrond.
- Lijsten in je eigen schijf zijn **persoonlijk**: delen kan alleen met lijsten in de Tijdkompas-cloud.
- Met een login weet de cloud van zo'n lijst alleen naam, icoon en kleur. De taken, en ook titels en plaatsen van agenda-afspraken, staan er niet in; alleen tijden.
