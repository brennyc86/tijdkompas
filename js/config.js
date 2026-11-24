// Openbare configuratie (geen geheimen — dit staat bij elke website met "Inloggen met Google" gewoon in de broncode).
export const CONFIG = {
  // Firebase: inloggen met Google/Microsoft + online opslag en delen. Uit Firebase-console → Projectinstellingen → Je apps → Web-app.
  firebase: {
    apiKey: "AIzaSyAaA8n67JaBUmjMJfOJsxBGBOUS7foOfJA",
    authDomain: "brennycc86-apps.firebaseapp.com",
    projectId: "brennycc86-apps",
    storageBucket: "brennycc86-apps.firebasestorage.app",
    messagingSenderId: "144197829489",
    appId: "1:144197829489:web:7ded3fe52355e9f9f92cd0",
  },

  // Optioneel: agenda's lezen en blokken wegschrijven
  googleClientId: "144197829489-mfos5cs0kvghs2et10i4evvsj4m1g8cs.apps.googleusercontent.com",      // Google Drive + Agenda (OAuth-webclient van het Firebase-project, SETUP.md stap C)
  microsoftClientId: "73100eed-6815-4770-a11d-e522c91512c4",   // OneDrive + Outlook (SPA-platform op de Entra-registratie, SETUP.md stap C)
  // Doorgeefluik voor agenda-links (.ics), bv. een gepubliceerde Outlook-agenda (worker/agenda-doorgeef.js, SETUP.md stap D)
  // Optioneel: Google Maps-sleutel (Routes API) voor reistijden met verkeer. Leeg = OpenStreetMap (gratis, zonder verkeer).
  // Beperk de sleutel in de Google Cloud-console tot de Routes API en tot https://brennyc86.github.io/* (SETUP.md stap F).
  mapsSleutel: "",
  icsProxy: "https://tijdkompas-agenda.brennycc86.workers.dev",
};
