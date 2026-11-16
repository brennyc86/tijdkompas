# Externe bibliotheken (vastgezet)

| Bestand | Bron | Controle |
|---|---|---|
| `msal-browser-3.28.1.min.js` | npm `@azure/msal-browser@3.28.1`, `lib/msal-browser.min.js` | tarball-integriteit `sha512-OHHEWMB5+Zrix8yKvLVzU3rKDFvh7SOzAzXfICD7YgUXLxfHpTPX2pzOotrri1kskwhHqIj4a5LvhZlIqE7C7g==` (npm-register); bestand `sha384-B5PXeUfgiegchZiX5iMRssMrHd9NfPhFnITob1HyW1CY76udptWpBsniaDsH/+BY` (staat ook als SRI in `js/koppeling.js`) |

Bijwerken: `npm pack @azure/msal-browser@<versie>`, controleer de integriteit met `npm view @azure/msal-browser@<versie> dist.integrity`,
kopieer `lib/msal-browser.min.js`, bereken de nieuwe hash met `openssl dgst -sha384 -binary <bestand> | base64` en zet die in `MSAL_SRI`.
`tests/veiligheid.mjs` controleert dat bestand en hash bij elkaar horen.
