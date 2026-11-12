// Openbare configuratie (geen geheimen — dit staat bij elke website met "Inloggen met Google" gewoon in de broncode).
export const CONFIG = {
  // Firebase: inloggen met Google/Microsoft + online opslag en delen. Uit Firebase-console → Projectinstellingen → Je apps → Web-app.
  firebase: null,   // { apiKey: "…", authDomain: "….firebaseapp.com", projectId: "…", appId: "…" }

  // Optioneel: agenda's lezen en blokken wegschrijven
  googleClientId: "",      // Google Drive + Agenda (OAuth-webclient van het Firebase-project, SETUP.md stap C)
  microsoftClientId: "",   // OneDrive + Outlook (SPA-platform op de Entra-registratie, SETUP.md stap C)
};
