// Openbare configuratie (geen geheimen — dit staat bij elke website met "Inloggen met Google" gewoon in de broncode).
export const CONFIG = {
  // Firebase: inloggen met Google/Microsoft + online opslag en delen. Uit Firebase-console → Projectinstellingen → Je apps → Web-app.
  firebase: null,   // { apiKey: "…", authDomain: "….firebaseapp.com", projectId: "…", appId: "…" }

  // Optioneel: agenda's lezen en blokken wegschrijven
  googleClientId: "",      // Google Agenda (OAuth-client van hetzelfde Google Cloud-project)
  microsoftClientId: "",   // Outlook-agenda (Azure app-registratie)
};
