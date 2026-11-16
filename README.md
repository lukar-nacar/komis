# Komis LUKAR · NACAR – aplikacja

Panel WWW i aplikacja na telefon (PWA) do arkusza Google **Komis_baza**.
Bez serwera: przeglądarka loguje się kontem Google i czyta/zapisuje arkusz bezpośrednio.

## Co jest w wersji 1
- **Pulpit** – zysk netto miesiąca i roku, auta na stanie, saldo do rozliczenia, terminy (rejestracja, OC, badanie, zgłoszenie zbycia), braki w danych.
- **Auta** – lista z filtrami (na stanie / do rozliczenia / sprzedane), wyszukiwanie, dni na stanie, prognoza zysku; karta auta z kosztami, terminami i rozliczeniem; dodawanie auta, sprzedaż, edycja.
- **Koszty** – koszty ogólne i koszty aut miesiąc po miesiącu, dodawanie kosztu lub przychodu.
- **Zyski** – miesiąc / rok / dowolny zakres, podział na wspólników i firmy, wykres miesięcy, najlepsze i najsłabsze auta, koszty ogólne wg kategorii.
- **Rozliczenia** – saldo z aut i kosztów ogólnych, oznaczanie pozycji jako rozliczone.

## Pliki
| Plik | Co robi |
|---|---|
| `index.html` | strona aplikacji |
| `css/app.css` | wygląd (propozycja B „Jasna i czysta”) |
| `js/config.js` | **ustawienia: CLIENT_ID, ID arkusza, lista dozwolonych kont** |
| `js/api.js` | logowanie Google i zapis/odczyt arkusza |
| `js/model.js` | obliczenia: koszty, zysk, salda, terminy, raporty |
| `js/ui.js`, `js/app.js` | ekrany i formularze |
| `js/demo.js` | zmyślone dane do trybu demo |
| `manifest.webmanifest`, `sw.js`, `img/` | instalacja na telefonie, ikony, logotypy |

## Logotypy
`lukar.svg` i `nacar.svg` to tymczasowe napisy – podmień je na prawdziwe pliki logo (te same nazwy).

## Wdrożenie (GitHub Pages)
1. Na GitHub utwórz repozytorium **komis** (publiczne) na koncie `lukar-nacar`.
2. Wgraj wszystkie pliki z tego folderu (Add file → Upload files), zachowując foldery.
3. Settings → Pages → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)` → Save.
4. Po ~1 minucie aplikacja działa pod adresem **https://lukar-nacar.github.io/komis/**.

## Google Cloud – identyfikator klienta OAuth
1. Interfejsy API i usługi → Dane logowania → **Utwórz dane logowania → Identyfikator klienta OAuth**.
2. Typ: **Aplikacja internetowa**, nazwa `Komis`.
3. Autoryzowane źródła JavaScript: `https://lukar-nacar.github.io`
4. Skopiuj identyfikator klienta i wpisz go w `js/config.js` jako `CLIENT_ID`.
5. W `ALLOWED_EMAILS` wpisz adresy Google Łukasza i Michała.

Arkusz musi być udostępniony obu kontom (edycja). Repozytorium jest publiczne, ale nie zawiera żadnych danych –
dane są tylko w arkuszu, a dostęp do nich wymaga zalogowania kontem z uprawnieniami.

## Instalacja na telefonie
- Android (Chrome): otwórz adres → menu ⋮ → **Zainstaluj aplikację**.
- iPhone (Safari): otwórz adres → Udostępnij → **Do ekranu początkowego**.
