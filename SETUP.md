# Eenmalige setup: inloggen met Google en Microsoft

Dit doet alleen de eigenaar van de site, en maar één keer. Gebruikers merken er niets van: zij zien gewoon „Inloggen met Google / Microsoft”.

**Over de knoppen in deze handleiding:** de Firebase-console is altijd Engels. Google Cloud en Microsoft tonen soms Nederlands, afhankelijk van je instellingen.
Daarom staat elke knop er zo: **English label** (Nederlandse vertaling). Kijk dus naar wat jouw scherm toont.

---

## A. Firebase: inloggen met Google, online opslag en delen (± 10 minuten)

De Firebase-console is in 2025/2026 vernieuwd. Er is geen kopje **Build** meer.
Negeer **Build a backend** en **Firebase Studio**: dat is de AI-bouwer, die heb je niet nodig.
Producten staan links onder **Product categories**: Authentication bij *Security*, Firestore bij *Databases & Storage*. Je kunt ze ook bovenin opzoeken via het zoekveld.

Het makkelijkst zijn de directe links hieronder. Ze zijn gemaakt voor project-ID `brennycc86-apps`.
Zie je na het openen van je project in de adresbalk na `/project/` iets anders staan, bijvoorbeeld `brennycc86-apps-1a2b3`? Dan heeft Firebase er iets achter gezet. Pas het in de links dan even aan.

1. **Project maken**
   - Ga naar https://console.firebase.google.com en klik op **Create a project** (Project maken).
     Heb je het project al gemaakt, zoals `brennycc86-apps`? Open het dan gewoon.
   - Google Analytics mag uit.
2. **Inloggen met Google aanzetten**
   - Ga naar https://console.firebase.google.com/project/brennycc86-apps/authentication en klik op **Get started** (Aan de slag).
   - Open het tabblad **Sign-in method** (Inlogmethode), kies **Google** en zet **Enable** (Inschakelen) aan.
   - Kies bij **Project support email** (Ondersteunings-e-mail) je eigen adres en klik op **Save** (Opslaan).
3. **De website toestaan**
   - Blijf op dezelfde pagina en ga naar het tabblad **Settings** (Instellingen), onderdeel **Authorized domains** (Geautoriseerde domeinen).
   - Klik op **Add domain** (Domein toevoegen) en vul `brennyc86.github.io` in.
     Let op: dit is je GitHub-naam, met één c.
4. **Database maken**
   - Ga naar https://console.firebase.google.com/project/brennycc86-apps/firestore en klik op **Create database** (Database maken).
   - Vraagt hij om een editie, kies dan **Standard edition**.
   - Kies als **Location** (Locatie) `europe-west4 (Netherlands)`.
   - Kies **Start in production mode** (Starten in productiemodus) en klik op **Create** (Maken).
   - Open daarna het tabblad **Rules** (Regels). Vervang alles door de inhoud van [`firestore.rules`](firestore.rules) en klik op **Publish** (Publiceren).
5. **De app registreren**
   - Ga naar https://console.firebase.google.com/project/brennycc86-apps/settings/general.
     Je komt hier ook via het tandwiel naast **Project Overview** (Projectoverzicht) → **Project settings** (Projectinstellingen).
   - Klik onderaan bij **Your apps** (Je apps) op het web-icoon `</>`.
   - Vul bij **App nickname** (Bijnaam) `Tijdkompas` in. Vink **Firebase Hosting** níet aan. Klik op **Register app** (App registreren).
   - Je ziet nu een blok `const firebaseConfig = { apiKey: …, authDomain: …, projectId: …, … }`.
     **Kopieer dat en stuur het naar Claude**, of zet het zelf in `js/config.js` bij `firebase:`.

Klaar: vanaf nu kan iedereen inloggen met Google. Google hoeft daar niets voor goed te keuren, want de site vraagt alleen naam en e-mailadres.

---

## B. Microsoft-inlog (optioneel, ± 10 minuten)

1. **App registreren bij Microsoft**
   - Ga naar https://portal.azure.com, zoek bovenin **App registrations** (App-registraties) en klik op **New registration** (Nieuwe registratie).
     Dit werkt met elk Microsoft-account. Met een persoonlijk account krijg je automatisch een eigen **Default Directory** (Standaardmap).
     https://entra.microsoft.com kan ook, maar toont bij persoonlijke accounts soms „geen toegang”.
   - **Name** (Naam): `Tijdkompas`.
   - **Supported account types** (Ondersteunde accounttypen): kies **Accounts in any organizational directory and personal Microsoft accounts** (Accounts in een organisatiemap en persoonlijke Microsoft-accounts).
   - **Redirect URI** (Omleidings-URI): kies platform **Web** en vul `https://brennycc86-apps.firebaseapp.com/__/auth/handler` in.
     Dit adres zie je ook in Firebase bij stap 3 hieronder.
   - Klik op **Register** (Registreren).
2. **Gegevens kopiëren**
   - Kopieer op **Overview** (Overzicht) de **Application (client) ID** (Toepassings-id (client)).
   - Ga naar **Certificates & secrets** (Certificaten en geheimen) en klik op **New client secret** (Nieuw clientgeheim).
   - Kopieer meteen de **Value** (Waarde). Die is later niet meer te zien.
3. **Microsoft toevoegen in Firebase**
   - Ga naar https://console.firebase.google.com/project/brennycc86-apps/authentication/providers.
   - Klik op **Add new provider** (Nieuwe aanbieder toevoegen) en kies **Microsoft**.
   - Plak de ID bij **Application ID** en het geheim bij **Application secret**. Zet **Enable** aan en klik op **Save**.

---

## C. Drive, OneDrive en agenda's koppelen (± 15 minuten)

Hiermee kan iedereen per lijst kiezen of hij in de eigen Google Drive of OneDrive komt te staan, en kun je agenda's koppelen.
Je gebruikt dezelfde projecten als bij A en B; er komen alleen een paar instellingen bij.
Stuur daarna de twee **client-ID's** naar Claude, of zet ze zelf in `js/config.js` bij `googleClientId` en `microsoftClientId`. Geheime sleutels zijn hiervoor níet nodig.

### Google

Ga naar https://console.cloud.google.com en kies bovenin het Firebase-project uit stap A.

1. **API's aanzetten**
   - Ga naar **APIs & Services** (API's en services) → **Library** (Bibliotheek).
   - Zet **Google Drive API** aan met **Enable** (Inschakelen). Voor agenda's zet je ook **Google Calendar API** aan.
2. **De website toestaan**
   - Ga naar **APIs & Services** → **Credentials** (Inloggegevens) en open **Web client (auto created by Google Service)**.
   - Voeg bij **Authorized JavaScript origins** (Geautoriseerde JavaScript-bronnen) `https://brennyc86.github.io` toe en klik op **Save** (Opslaan).
   - Kopieer de **Client ID** (Client-ID). Die eindigt op `.apps.googleusercontent.com`.
3. **Toestemmingen kiezen**
   - Ga naar **Google Auth Platform** → **Data Access** (Gegevenstoegang) en klik op **Add or remove scopes** (Bereiken toevoegen of verwijderen).
   - Vink `.../auth/drive.appdata` aan. Voor agenda's vink je ook `calendar.readonly` en `calendar.events` aan.
   - Klik op **Update** (Bijwerken) en daarna op **Save** (Opslaan).
4. **App publiceren**
   - Ga naar **Google Auth Platform** → **Audience** (Doelgroep) en klik op **Publish app** (App publiceren), zodat de status **In production** (In productie) wordt.
     Doe je dit niet, dan kunnen alleen testgebruikers koppelen en vervalt de koppeling elke 7 dagen.
   - Voor Drive-opslag (`drive.appdata`) is geen verificatie nodig: het is een *niet-gevoelige* toestemming.
   - Agenda-rechten zijn wel *gevoelig*. Tot Google de app heeft geverifieerd, zien gebruikers een waarschuwing („niet geverifieerd”) en kunnen er maximaal 100 gebruikers koppelen.
     Jij kunt het wel meteen gebruiken.

### Microsoft

Open in https://portal.azure.com de app-registratie `Tijdkompas` uit stap B.

1. **Platform toevoegen**
   - Ga naar **Authentication** (Verificatie) → **Add a platform** (Een platform toevoegen) en kies **Single-page application** (Toepassing met één pagina).
   - Vul als omleidings-URI `https://brennyc86.github.io/tijdkompas/auth.html` in en klik op **Configure** (Configureren).
   - Het Web-platform uit stap B blijft gewoon staan.
2. **Machtigingen toevoegen**
   - Ga naar **API permissions** (API-machtigingen) → **Add a permission** (Een machtiging toevoegen) → **Microsoft Graph** → **Delegated permissions** (Gedelegeerde machtigingen).
   - Vink `Files.ReadWrite.AppFolder` en `Calendars.ReadWrite` aan. `User.Read` staat er meestal al.
   - Klik op **Add permissions** (Machtigingen toevoegen).
3. **ID kopiëren:** kopieer op **Overview** (Overzicht) de **Application (client) ID** (Toepassings-id (client)).

### Zakelijke Microsoft-accounts

Veel bedrijven laten medewerkers zelf geen toestemming geven aan apps van buiten.
Krijg je bij het koppelen van je werk-OneDrive de melding **Need admin approval** (Goedkeuring van beheerder vereist)? Dan moet de IT-afdeling Tijdkompas één keer goedkeuren.
Ze zien precies welke rechten de app vraagt: alleen een eigen app-map en je agenda.
Een **verified publisher** (geverifieerde uitgever) in Microsoft maakt dat makkelijker, maar daarvoor heb je een Microsoft-partneraccount nodig. Dat kan later nog.

### Goed om te weten

- **Google Drive vraagt elk uur even opnieuw te verbinden.** Zonder eigen server geeft Google een browser maar een uur toegang.
  Daarna verschijnt een balk „Opnieuw verbinden”; dat is één klik. Je wijzigingen blijven intussen veilig op het apparaat staan.
  OneDrive heeft dit niet: dat vernieuwt zichzelf op de achtergrond.
- Lijsten in je eigen schijf zijn **persoonlijk**. Delen kan alleen met lijsten in de Tijdkompas-cloud.
- Ben je ingelogd, dan kent de cloud van zo'n lijst alleen de naam, het icoon en de kleur.
  De taken staan er niet in, en van agenda-afspraken ook de titels en plaatsen niet; alleen de tijden.
