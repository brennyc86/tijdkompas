# Eenmalige setup: inloggen met Google en Microsoft

Dit doet alleen de **sitebeheerder**, en maar één keer, met het account waarmee het Firebase-project is gemaakt (`brennycc86`).
Gebruikers merken er niets van. Zij klikken alleen in de app op „Inloggen met Google / Microsoft” en, als ze willen, in **⚙️ Instellingen → Koppelingen** op
„Google Agenda koppelen”, „Google Taken koppelen” enzovoort. Google en Microsoft openen dan zelf een venster om toestemming te vragen.

### Overzicht voor de beheerder

| Stap | Waarvoor | Status |
|---|---|---|
| **A** Firebase | inloggen met Google, online opslag, delen | ✅ gedaan — **let op:** plak de nieuwste `firestore.rules` opnieuw bij Regels (nodig voor meerdere accounts per Tijdkompas, sinds 16-11-2026) |
| **B** Microsoft-app | inloggen met Microsoft | nog doen (optioneel) |
| **C-Google** | Google Agenda, Google Taken en Google Drive koppelen | Client ID ✅ ingevuld; controleer de rest van stap C-Google |
| **C-Microsoft** | Outlook-agenda, Microsoft To Do (Outlook-taken) en OneDrive koppelen | nog doen; stuur daarna de **Microsoft client-ID** |

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

## C. Agenda's, takenlijsten, Drive en OneDrive koppelen (± 15 minuten)

Hiermee kan iedere gebruiker zelf koppelen:
- **agenda's**: Tijdkompas plant om je afspraken heen en zet ingeplande blokken in je agenda;
- **takenlijsten**: Google Taken (ook de taken uit Gmail en Google Agenda) en Microsoft To Do (de taken uit Outlook) gaan twee kanten op met een lijst in Tijdkompas;
- **opslag**: per lijst kiezen of hij in de eigen Google Drive of OneDrive staat.

Je gebruikt dezelfde projecten als bij A en B; er komen alleen een paar instellingen bij.
Stuur daarna de twee **client-ID's** naar Claude, of zet ze zelf in `js/config.js` bij `googleClientId` en `microsoftClientId`. Geheime sleutels zijn hiervoor níet nodig.

### Google

Ga naar https://console.cloud.google.com en kies bovenin het Firebase-project uit stap A.

1. **API's aanzetten.** Open deze drie links en klik telkens op **Enable** (Inschakelen):
   - Google Calendar API: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com?project=brennycc86-apps
   - Google Tasks API: https://console.cloud.google.com/apis/library/tasks.googleapis.com?project=brennycc86-apps
   - Google Drive API: https://console.cloud.google.com/apis/library/drive.googleapis.com?project=brennycc86-apps
2. **De website toestaan**
   - Ga naar https://console.cloud.google.com/apis/credentials?project=brennycc86-apps en open **Web client (auto created by Google Service)**.
   - Voeg bij **Authorized JavaScript origins** (Geautoriseerde JavaScript-bronnen) `https://brennyc86.github.io` toe en klik op **Save** (Opslaan).
   - Kopieer de **Client ID** (Client-ID). Die eindigt op `.apps.googleusercontent.com`. **Stuur die naar Claude**: die zet hem in de app.
3. **Toestemmingen kiezen**
   - Ga naar https://console.cloud.google.com/auth/scopes?project=brennycc86-apps (**Google Auth Platform** → **Data Access** (Gegevenstoegang))
     en klik op **Add or remove scopes** (Bereiken toevoegen of verwijderen).
   - Vink deze vier aan (typ in het filterveld bijvoorbeeld `calendar` of `tasks` om ze te vinden):
     - `.../auth/calendar.readonly`: agenda's lezen
     - `.../auth/calendar.events`: ingeplande blokken in je agenda zetten
     - `.../auth/tasks`: takenlijsten lezen en bijwerken
     - `.../auth/drive.appdata`: een eigen verborgen map in Drive
   - Klik op **Update** (Bijwerken) en daarna op **Save** (Opslaan).
4. **App publiceren**
   - Ga naar https://console.cloud.google.com/auth/audience?project=brennycc86-apps (**Google Auth Platform** → **Audience** (Doelgroep))
     en klik op **Publish app** (App publiceren), zodat de status **In production** (In productie) wordt.
     Doe je dit niet, dan kunnen alleen testgebruikers koppelen en vervalt de koppeling elke 7 dagen.
     Staat bij **Publishing status** (Publicatiestatus) al **In production** met een knop **Back to testing**? Dan is dit al gebeurd (meestal vanzelf via Firebase): niets doen en níet op die knop klikken.
   - Voor Drive-opslag (`drive.appdata`) is geen verificatie nodig: het is een *niet-gevoelige* toestemming.
   - Agenda- en takenrechten zijn wel *gevoelig*. Tot Google de app heeft geverifieerd, zien gebruikers een waarschuwing („niet geverifieerd”) en kunnen er maximaal 100 gebruikers koppelen.
     Jij kunt het wel meteen gebruiken.

### Microsoft

Open in https://portal.azure.com de app-registratie `Tijdkompas` uit stap B.

1. **Platform toevoegen**
   - Ga naar **Authentication** (Verificatie) → **Add a platform** (Een platform toevoegen) en kies **Single-page application** (Toepassing met één pagina).
   - Vul als omleidings-URI `https://brennyc86.github.io/tijdkompas/auth.html` in en klik op **Configure** (Configureren).
   - Het Web-platform uit stap B blijft gewoon staan.
2. **Machtigingen toevoegen**
   - Ga naar **API permissions** (API-machtigingen) → **Add a permission** (Een machtiging toevoegen) → **Microsoft Graph** → **Delegated permissions** (Gedelegeerde machtigingen).
   - Vink `Files.ReadWrite.AppFolder`, `Calendars.ReadWrite` en `Tasks.ReadWrite` aan. `User.Read` staat er meestal al.
   - Klik op **Add permissions** (Machtigingen toevoegen).
3. **ID kopiëren:** kopieer op **Overview** (Overzicht) de **Application (client) ID** (Toepassings-id (client)).

### Zakelijke Microsoft-accounts

Veel bedrijven laten medewerkers zelf geen toestemming geven aan apps van buiten.
Krijg je bij het koppelen van je werk-OneDrive de melding **Need admin approval** (Goedkeuring van beheerder vereist)? Dan moet de IT-afdeling Tijdkompas één keer goedkeuren.
Ze zien precies welke rechten de app vraagt: alleen een eigen app-map en je agenda.
Een **verified publisher** (geverifieerde uitgever) in Microsoft maakt dat makkelijker, maar daarvoor heb je een Microsoft-partneraccount nodig. Dat kan later nog.

### Goed om te weten

- **Takenlijsten koppelen (als gebruiker).** Na het koppelen zie je in **⚙️ Instellingen → Koppelingen** al je takenlijsten. Kies per takenlijst bij welke
  Tijdkompas-lijst hij hoort, of maak er met „＋ nieuwe lijst” meteen een aan. Dat kan ook vanuit de lijst zelf (⚙️ → „Taken synchroniseren met”).
  - Wat je daar toevoegt komt hier binnen en wordt ingepland. Wat je hier toevoegt (en bij jou hoort) komt daar te staan.
  - Titel, notitie, deadline en afvinken gaan heen en weer. Weggooien ook.
  - Al afgeronde taken van vroeger worden niet binnengehaald.
  - Verdwijnt in één keer meer dan de helft van de taken, dan gooit Tijdkompas voor de zekerheid niets weg en meldt het dat.
  - Bijwerken gebeurt vanzelf elke 10 minuten zolang de app openstaat, of direct met „🔄 Taken synchroniseren”.

- **Google Drive vraagt elk uur even opnieuw te verbinden.** Zonder eigen server geeft Google een browser maar een uur toegang.
  Daarna verschijnt een balk „Opnieuw verbinden”; dat is één klik. Je wijzigingen blijven intussen veilig op het apparaat staan.
  OneDrive heeft dit niet: dat vernieuwt zichzelf op de achtergrond.
- Lijsten in je eigen schijf zijn **persoonlijk**. Delen kan alleen met lijsten in de Tijdkompas-cloud.
- Ben je ingelogd, dan kent de cloud van zo'n lijst alleen de naam, het icoon en de kleur.
  De taken staan er niet in, en van agenda-afspraken ook de titels en plaatsen niet; alleen de tijden.

### Beveiligingsregels bijwerken

Als Claude `firestore.rules` heeft aangepast (staat in de tabel bovenaan), plak je ze opnieuw:
https://console.firebase.google.com/project/brennycc86-apps/firestore/rules → alles vervangen door de inhoud van
[`firestore.rules`](firestore.rules) → **Publish** (Publiceren).
