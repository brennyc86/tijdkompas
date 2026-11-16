# Eenmalige setup: inloggen met Google en Microsoft

Dit doet alleen de **sitebeheerder**, en maar één keer, met het account waarmee het Firebase-project is gemaakt (`brennycc86`).
Gebruikers merken er niets van. Zij klikken alleen in de app op „Inloggen met Google / Microsoft” en, als ze willen, in **⚙️ Instellingen → Koppelingen** op
„Google Agenda koppelen”, „Google Taken koppelen” enzovoort. Google en Microsoft openen dan zelf een venster om toestemming te vragen.

### Overzicht voor de beheerder

| Stap | Waarvoor | Status |
|---|---|---|
| **A** Firebase | inloggen met Google of met een link per e-mail (2b), online opslag, delen | ✅ gedaan — ⚠️ **plak de nieuwste `firestore.rules` opnieuw** (zie [Beveiligingsregels bijwerken](#beveiligingsregels-bijwerken); nieuw op 16-11-2026: koppelcode, gedeelde Koers, strengere regels voor delen) |
| **B** Microsoft-omgeving + app | inloggen met Microsoft (B0: eenmalig een gratis eigen omgeving) | ✅ gedaan — maak het geheim (B2) opnieuw aan als het ooit in een chat of mail heeft gestaan |
| **C-Google** | Google Agenda, Google Taken en Google Drive koppelen | Client ID ✅ ingevuld; controleer de rest van stap C-Google |
| **C-Microsoft** | Outlook-agenda, Microsoft To Do (Outlook-taken) en OneDrive koppelen | ✅ client-ID ingevuld, redirect-URI (SPA) staat |
| **E** Extra afschermen (aanbevolen) | API-sleutel beperken tot deze site; controleren wie bij het Firebase-project kan | zie [E. Extra afschermen](#e-extra-afschermen-aanbevolen-10-minuten) |
| **D** Outlook-agenda via een link | Outlook-agenda zien en eromheen plannen (alleen lezen), zonder Microsoft-registratie | ⚠️ **plak de nieuwe code in het doorgeefluik** (D1 → Bijwerken; geen cache meer) — of haal het weg als je de Microsoft-koppeling gebruikt (E3) |

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
2b. **Inloggen met een link per e-mail aanzetten** (voor wie geen Google-account heeft; geen Microsoft-registratie nodig)
   - Ga naar https://console.firebase.google.com/project/brennycc86-apps/authentication/providers en klik op **Add new provider** (Nieuwe aanbieder toevoegen) → **Email/Password** (E-mail/wachtwoord).
   - Zet **Email/Password** aan én daaronder **Email link (passwordless sign-in)** (E-maillink, inloggen zonder wachtwoord). Klik op **Save**.
   - Optioneel, mails in het Nederlands: tabblad **Templates** (Sjablonen) → potloodje bij **Template language** (Sjabloontaal) → **Dutch** → **Save**.
   - De mail komt van `noreply@brennycc86-apps.firebaseapp.com` en kan in de spam belanden.
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

## B. Microsoft: eigen omgeving, app-registratie en inloggen (± 25 minuten)

Firebase doet het inloggen, maar Microsoft wil dat de app ook bij Microsoft geregistreerd is. Dat is één registratie die je
voor alles gebruikt: inloggen (deze stap B) én Outlook-agenda, To Do en OneDrive (stap C-Microsoft). Je doet B en C-Microsoft
dus achter elkaar, in dezelfde registratie.

### B0. Een eigen Microsoft-omgeving (eenmalig)

> ⚠️ **Let op: route 2 hieronder vraagt een creditcard** (ter controle; een gratis account schrijft niets af, maar je moet de gegevens wel invullen).
> Wil je dat niet, dan zijn er twee andere routes:
> - **Zonder kaart, via je werk:** log met je zakelijke Microsoft-account in op https://portal.azure.com → **App registrations** → **New registration**.
>   Zie je het formulier, dan mag je daar registreren (standaard mag dat, tenzij IT het heeft uitgezet). Sla dan B0 over en ga verder bij B1.
>   Nadeel: de registratie staat in de omgeving van je werkgever; vraag het eventueel na bij IT.
> - **Microsoft voorlopig overslaan:** Google werkt volledig. Een Outlook-agenda kan Tijdkompas dan alleen *lezen* via een gepubliceerde agendalink (vraag Claude).

Een app registreren kan alleen in een eigen Microsoft-omgeving (een *tenant*). Met een gewoon persoonlijk Microsoft-account
heb je die nog niet; je krijgt hem gratis door een gratis Azure-account aan te maken. App-registraties kosten niets.

1. **Microsoft-account.** Heb je er nog geen met het adres dat je wilt gebruiken (bijv. `brennycc86@gmail.com`)?
   Ga naar https://signup.live.com, kies **Use your email instead**/vul je e-mailadres in en volg de stappen (je krijgt een code per mail).
   Zo wordt je Gmail-adres ook een Microsoft-account; je mail blijft gewoon bij Gmail.
2. **Gratis Azure-account.** Ga naar https://azure.microsoft.com/free en klik op **Try Azure for free** / **Start free** (Gratis beginnen).
   - Log in met het Microsoft-account van stap 1.
   - Vul je gegevens in. Microsoft vraagt een telefoonnummer en een **creditcard ter controle**. Er wordt niets afgeschreven:
     een gratis account heeft een uitgavenlimiet en wordt nooit vanzelf betaald. Kies later dus níet voor „Upgrade”.
   - Rond af met **Sign up** (Aanmelden). Je komt in https://portal.azure.com.
3. **Controleer de omgeving.** Rechtsboven in de portal staat onder je naam de omgeving, meestal **Default Directory** (Standaardmap).
   Staat er **Microsoft Services** of zie je straks „geen toegang”? Klik dan rechtsboven op je naam → **Switch directory** (Map wisselen)
   en kies **Default Directory**.

### B1. De app registreren

1. Ga naar https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade
   (of zoek bovenin **App registrations** (App-registraties)) en klik op **New registration** (Nieuwe registratie).
   - **Name** (Naam): `Tijdkompas` (of algemener, bijv. `Brendans apps`: deze naam zien gebruikers in het toestemmingsvenster).
   - **Supported account types** (Ondersteunde accounttypen): kies **Accounts in any organizational directory and personal Microsoft accounts**
     (Accounts in een organisatiemap en persoonlijke Microsoft-accounts). Zo kan iedereen inloggen: privé én werk.
   - **Redirect URI** (Omleidings-URI): kies platform **Web** en vul `https://brennycc86-apps.firebaseapp.com/__/auth/handler` in.
   - Klik op **Register** (Registreren).
2. Je staat nu op **Overview** (Overzicht). Kopieer de **Application (client) ID** (Toepassings-id (client)) en bewaar hem even.

### B2. Een geheim maken voor Firebase

1. Ga links naar **Certificates & secrets** (Certificaten en geheimen) → tabblad **Client secrets** (Clientgeheimen) → **New client secret** (Nieuw clientgeheim).
2. **Description** (Beschrijving): `Firebase`. **Expires** (Verloopt): kies de langste termijn (24 maanden). Klik op **Add** (Toevoegen).
3. Kopieer meteen de **Value** (Waarde) — níet de *Secret ID*. De waarde is later niet meer te zien.
   Zet in je agenda een herinnering een paar weken vóór het verloopt: dan maak je een nieuw geheim en plak je dat in Firebase.

### B3. Microsoft aanzetten in Firebase

1. Ga naar https://console.firebase.google.com/project/brennycc86-apps/authentication/providers
   (of: linkermenu → **Authentication** → tabblad **Sign-in method**).
2. Klik op **Add new provider** (Nieuwe aanbieder toevoegen) en kies **Microsoft**.
3. Zet **Enable** aan. Plak de Application (client) ID bij **Application ID** en de Value van B2 bij **Application secret**. Klik op **Save**.

Klaar met inloggen. Ga meteen door met **C-Microsoft** hieronder (zelfde registratie), en stuur daarna de Application (client) ID naar Claude.

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

Open in https://portal.azure.com dezelfde app-registratie `Tijdkompas` uit stap B (**App registrations** → `Tijdkompas`).

1. **Platform toevoegen**
   - Ga links naar **Authentication** (Verificatie) → **Add a platform** (Een platform toevoegen) → **Single-page application** (Toepassing met één pagina).
   - Vul als omleidings-URI `https://brennyc86.github.io/tijdkompas/auth.html` in (GitHub-naam, met één c) en klik op **Configure** (Configureren).
   - Het Web-platform uit stap B blijft gewoon staan; je hebt er nu twee.
2. **Machtigingen toevoegen**
   - Ga links naar **API permissions** (API-machtigingen) → **Add a permission** (Een machtiging toevoegen) → **Microsoft Graph** → **Delegated permissions** (Gedelegeerde machtigingen).
   - Typ in het zoekveld de namen en vink ze aan: `Calendars.ReadWrite`, `Tasks.ReadWrite`, `Files.ReadWrite.AppFolder` en `MailboxSettings.Read`.
     `User.Read` staat er meestal al. (`MailboxSettings.Read` is alleen om de kleuren van je Outlook-categorieën over te nemen.)
   - Klik op **Add permissions** (Machtigingen toevoegen). Op **Grant admin consent** (Beheerderstoestemming verlenen) hoef je niet te klikken:
     elke gebruiker geeft zelf toestemming bij het koppelen.
3. **ID sturen:** stuur de **Application (client) ID** van **Overview** (Overzicht) naar Claude (dezelfde als in stap B). Die komt in `js/config.js`.

### Zakelijke Microsoft-accounts

Veel bedrijven laten medewerkers zelf geen toestemming geven aan apps van buiten.
Krijg je bij het koppelen van je werk-OneDrive de melding **Need admin approval** (Goedkeuring van beheerder vereist)? Dan moet de IT-afdeling Tijdkompas één keer goedkeuren.
Ze zien precies welke rechten de app vraagt: alleen een eigen app-map en je agenda.
Een **verified publisher** (geverifieerde uitgever) in Microsoft maakt dat makkelijker, maar daarvoor heb je een Microsoft-partneraccount nodig. Dat kan later nog.

### Goed om te weten

- **Takenlijsten koppelen (als gebruiker).** Na het koppelen zie je in **⚙️ Instellingen → Koppelingen** al je takenlijsten. Kies per takenlijst bij welke
  Tijdkompas-lijst hij hoort. Nieuwe takenlijsten verschijnen vanzelf als eigen lijst (met dezelfde naam, die je daarna vrij kunt wijzigen). Dat kan ook vanuit de lijst zelf (⚙️ → „Taken synchroniseren met”).
  - Wat je daar toevoegt komt hier binnen en wordt ingepland. Wat je hier toevoegt (en bij jou hoort) komt daar te staan.
  - Titel, notitie, deadline en afvinken gaan heen en weer. Weggooien ook.
  - Al afgeronde taken van vroeger worden niet binnengehaald.
  - Verdwijnt in één keer meer dan de helft van de taken, dan gooit Tijdkompas voor de zekerheid niets weg en meldt het dat.
  - Bijwerken gebeurt vanzelf elke 10 minuten zolang de app openstaat, of direct met „🔄 Taken synchroniseren”.

- **Google Drive vraagt elk uur even opnieuw te verbinden.** Zonder eigen server geeft Google een browser maar een uur toegang.
  Daarna verschijnt een balk „Opnieuw verbinden”; dat is één klik. Je wijzigingen blijven intussen veilig op het apparaat staan.
  OneDrive heeft dit niet: dat vernieuwt zichzelf op de achtergrond.
- Lijsten in je eigen schijf zijn **persoonlijk**. Delen kan alleen met lijsten in de Tijdkompas-cloud.
- Ben je ingelogd, dan kent de cloud van zo'n lijst alleen de naam, het icoon en de kleur; de taken staan er niet in.
- Agenda-afspraken (met titel) en welke koppelingen je hebt, staan wél in je Tijdkompas in de cloud. Zo zie je met elk van je
  gekoppelde accounts en op elk apparaat dezelfde agenda's en takenlijsten. De toegangssleutels zelf blijven op het apparaat.

## D. Outlook-agenda via een link (alleen lezen)

Zonder Microsoft-registratie (stap B/C) kan Tijdkompas een Outlook-agenda toch **lezen**: Outlook kan een agenda publiceren als link,
en Tijdkompas haalt die elk kwartier op. Je ziet de afspraken in Tijdkompas en de planner plant eromheen.
Wat níet kan: blokken in Outlook zetten en Microsoft To Do synchroniseren (daarvoor is stap B/C nodig).

Een browser mag zo'n link niet zelf ophalen; daarom zet je één keer een klein **doorgeefluik** neer op Cloudflare (gratis, zonder kaart).
Het slaat niets op en geeft alleen links van Outlook, Google en iCloud door.

### D1. Het doorgeefluik (eenmalig, ± 5 minuten)

1. Ga naar https://dash.cloudflare.com en log in met je bestaande Cloudflare-account.
2. Ga links naar **Compute (Workers)** → **Workers & Pages** en klik op **Create** (Maken) → **Create Worker** / **Start with Hello World!**.
3. **Worker name**: `tijdkompas-agenda` → **Deploy** (Implementeren).
4. Klik op **Edit code** (Code bewerken). Selecteer links alle code (Ctrl+A) en vervang die door de inhoud van
   [`worker/agenda-doorgeef.js`](worker/agenda-doorgeef.js) (open het bestand, klik op **Raw**, Ctrl+A, Ctrl+C).
5. Klik rechtsboven op **Deploy** (Implementeren).
6. Bovenaan staat het adres, iets als `https://tijdkompas-agenda.<jouwnaam>.workers.dev`. **Stuur dat adres naar Claude**
   (of zet het zelf in `js/config.js` bij `icsProxy`).

**Bijwerken** (als Claude `worker/agenda-doorgeef.js` heeft aangepast, zoals op 16-11-2026: niets meer in de cache, alleen nog Tijdkompas zelf):
https://dash.cloudflare.com → **Workers & Pages** → **tijdkompas-agenda** → **Edit code** (Code bewerken) → Ctrl+A, plak de nieuwe inhoud → **Deploy**.
Controle: open https://tijdkompas-agenda.brennycc86.workers.dev/?url=x in je browser. Je hoort **Niet toegestaan** te zien (de site zelf mag hem wel gebruiken).

### D2. Je Outlook-agenda publiceren (per agenda, ± 2 minuten)

1. Open Outlook op het web: **outlook.live.com** (privé/Outlook.com) of **outlook.office.com** (werk).
2. Klik rechtsboven op het tandwiel **Settings** (Instellingen) → **Calendar** (Agenda) → **Shared calendars** (Gedeelde agenda's).
3. Bij **Publish a calendar** (Een agenda publiceren): kies de agenda, kies **Can view all details** (Kan alle details weergeven) en klik op **Publish** (Publiceren).
4. Je krijgt twee links. Kopieer de **ICS**-link (eindigt op `.ics`), niet de HTML-link.

Let op: iedereen die deze link heeft, kan je agenda zien. Bewaar hem dus alleen in Tijdkompas. Bij een zakelijk account kan IT het publiceren
hebben uitgezet; dan zie je de optie niet. Spijt? Klik daar op **Unpublish** (Publicatie ongedaan maken) of **Reset links**: de oude link werkt dan niet meer.

### D3. In Tijdkompas

1. **⚙️ Instellingen → Koppelingen → Agenda via een link (alleen lezen)**.
2. Vul een naam in (bv. *Outlook werk*), plak de ICS-link en klik op **＋ Toevoegen**.
3. De afspraken verschijnen in de agenda en op Vandaag, en worden elk kwartier bijgewerkt. Kies eventueel een kleur bij de link,
   en bij **Agenda's — wat staat erin?** of hij „bezet” is, een rooster, of alleen ter info.

### Beveiligingsregels bijwerken

**Doe dit vóórdat je de nieuwe functies gebruikt** (koppelcode, gedeelde Koers). Met de oude regels weigert Firebase die.
Sinds 16-11-2026 (tweede ronde) eisen de regels ook een **bevestigd e-mailadres** voor uitnodigingen en koppelcodes. Google en de e-maillink
bevestigen dat zelf. Log je in met Microsoft en zie je in Tijdkompas „E-mailadres bevestigen”, klik dan op **Bevestigingsmail sturen**.

Als Claude `firestore.rules` heeft aangepast (staat in de tabel bovenaan), plak je ze opnieuw:
https://console.firebase.google.com/project/brennycc86-apps/firestore/databases/-default-/rules (of: linkermenu → Firestore Database → tabblad **Rules**) → in het tekstvak Ctrl+A, Delete, alles vervangen door de inhoud van
[`firestore.rules`](firestore.rules) → **Publish** (Publiceren).

Gaat het daarna mis (bijv. „Opslaan mislukt” of „Missing or insufficient permissions” rechtsboven bij je account)? Stuur dan een schermafbeelding.
Je kunt ook zelf testen in de **Rules Playground** (Regels-speeltuin) op dezelfde pagina.

---

## E. Extra afschermen (aanbevolen, ± 10 minuten)

Wat er nu al geregeld is (in de app en in `firestore.rules`):

- **Je agenda, planning, koppelingen en persoonlijke Koers** staan in je eigen gebruikersdocument. Alleen jij en de accounts die je zelf hebt gelinkt kunnen dat lezen.
- **Toegangssleutels** voor Google en Microsoft staan alleen in de browser van je eigen apparaat. Bij uitloggen worden ze gewist.
- **Gedeelde lijsten**: alleen leden zien de taken. Niemand komt in een lijst zonder zelf een uitnodiging te accepteren. Alleen de eigenaar wijzigt naam, kleur en wie er is uitgenodigd.
- **Linken van accounts** kan alleen als beide kanten instemmen (koppelcode én bevestiging). Een verzoek toont alleen het door Google/Microsoft gecontroleerde e-mailadres, geen zelfgekozen naam.
- **Uitnodigingen** (op e-mailadres) zie je alleen met een bevestigd e-mailadres: niemand kan een account met jouw adres maken en zo meekijken.
- **Een lijst verwijderen** haalt in de cloud ook alle taken en gedeelde koersafspraken erin weg (of verhuist ze eerst, als je dat kiest).
- **Het doorgeefluik** bewaart niets (ook niet tijdelijk) en werkt alleen voor Tijdkompas zelf. De app bewaart nooit foutpagina's in de offline-cache.
- **Geen code van anderen in je scherm**: alles wordt gefilterd en ontsmet. Een beveiligingsbeleid (Content-Security-Policy) laat alleen scripts van de app zelf en van Google/Firebase toe. Microsoft-inloggen (MSAL) staat in de app zelf, met een vaste controle-hash.

Wat je zelf nog kunt doen:

### E1. De Firebase-sleutel beperken tot deze site

De sleutel in `js/config.js` is openbaar; dat hoort zo bij Firebase. Je gegevens worden beschermd door de regels, niet door de sleutel.
Beperk hem toch, dan kan geen andere website hem gebruiken.

1. Ga naar https://console.cloud.google.com/apis/credentials?project=brennycc86-apps
2. Klik bij **API Keys** (API-sleutels) op de sleutel die begint met `AIzaSyAaA8n…` (meestal „Browser key (auto created by Firebase)”).
3. Kies bij **Application restrictions** (Toepassingsbeperkingen) **Websites** en voeg toe:
   - `https://brennyc86.github.io/*`
   - `https://brennycc86-apps.firebaseapp.com/*`
4. Klik op **Save** (Opslaan). Werkt inloggen daarna nog? Dan is het goed. Werkt het niet, stuur een schermafbeelding.

### E2. Controleren wie bij het project kan

1. Ga naar https://console.cloud.google.com/iam-admin/iam?project=brennycc86-apps
2. Er hoort alleen **brennycc86@gmail.com** (Owner) te staan, plus serviceaccounts van Google zelf (eindigen op `gserviceaccount.com`).
   Staat er iemand anders, haal die dan weg.
3. Zet tweestapsverificatie aan op alle accounts die je in Tijdkompas linkt. Wie in één gelinkt account inbreekt, ziet ook de agenda van de andere.

### E3. Outlook-agenda niet meer publiceren (als de Microsoft-koppeling werkt)

Een gepubliceerde agenda (stap D) kan iedereen lezen die de geheime link heeft. Nu de echte Microsoft-koppeling werkt, is die link niet meer nodig:

1. Haal hem in Tijdkompas weg: Instellingen → Agenda's & accounts → bij de agendalink op **Weghalen**.
2. Ga in Outlook naar **Instellingen → Agenda → Gedeelde agenda's** en klik bij **Een agenda publiceren** op **Publicatie ongedaan maken** (Unpublish).

### Goed om te weten voor werk

- Tijdkompas bewaart je gegevens bij Google (Firebase, Nederland als je bij A de locatie `europe-west4` koos). Niet versleuteld met een eigen sleutel:
  jij als eigenaar van het project en Google (als verwerker) kunnen er technisch bij, net als bij Google Drive.
- Afspraaktitels uit je agenda staan in je eigen gebruikersdocument, zodat je gelinkte accounts ze ook zien.
- Koppel een werk-takenlijst niet aan een lijst die je met mensen buiten je werk deelt: die zien dan ook die taken.
- Check bij twijfel het beleid van je werkgever over agenda's en taken in externe apps.
