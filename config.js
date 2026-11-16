// Ustawienia aplikacji. Ten plik jest publiczny (GitHub Pages) – nie wpisuj tu haseł ani tokenów.
// CLIENT_ID to identyfikator klienta OAuth z Google Cloud (on z założenia jest jawny).
window.KOMIS_CONFIG = {
  CLIENT_ID: '642257148665-73312egmb0bva3el2trskgtmg208fvfg.apps.googleusercontent.com',
  SPREADSHEET_ID: '1_ndDsDYHh2DKnMmBNMCX8-BtsY7K7o4KOmaGfkwKKLs', // arkusz „Komis_baza”
  // Tylko te konta mogą korzystać z aplikacji (dodatkowo dostęp i tak daje udostępnienie arkusza).
  ALLOWED_EMAILS: []                                            // np. ['lukasz@gmail.com', 'michal@gmail.com']
};
