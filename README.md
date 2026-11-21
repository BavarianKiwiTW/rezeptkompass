# Rezeptkompass

Ein responsives Haushaltskochbuch mit Rezeptverwaltung, Labels, Wochenplanung und Kochhistorie.

## 1. Lokal starten

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
npm run dev
```

Ohne Appwrite-Konfiguration startet die App im Demo-Modus. Änderungen werden lokal im Browser gespeichert und sind **nicht** zwischen Geräten synchronisiert. Das ist nur zur Vorschau.

## 2. Appwrite Cloud einrichten

1. Unter https://cloud.appwrite.io ein Projekt erstellen.
2. Unter **Project > Platforms** eine Web-Plattform hinzufügen:
   - Development: `localhost`
   - später zusätzlich eure GitHub-Pages-Domain, z. B. `https://BENUTZER.github.io`
3. Unter **Auth** E-Mail/Passwort-Anmeldung aktivieren.
4. Unter **Databases** eine Datenbank mit ID `rezeptkompass` erstellen.
5. Drei Collections anlegen und **Document Security** aktivieren.

### Collection `recipes`

| Attribute | Typ | Größe / Pflicht |
|---|---|---|
| name | String | 180 / Pflicht |
| category | String | 80 |
| minutes | Integer | – |
| servings | Integer | – |
| ingredients | String | 10000 |
| instructions | String | 20000 |
| labels | String[] | Elementgröße 40, max. 10 |
| lastCooked | String | 10 |

### Collection `plans`

| Attribute | Typ | Größe / Pflicht |
|---|---|---|
| date | String | 10 / Pflicht |
| recipeId | String | 64 / Pflicht |
| status | String | 20 / Pflicht |

Erstellt einen eindeutigen Index auf `date`, falls ihr pro Tag nur ein Gericht einplanen möchtet.

### Collection `history`

| Attribute | Typ | Größe / Pflicht |
|---|---|---|
| recipeId | String | 64 / Pflicht |
| recipeName | String | 180 / Pflicht |
| cookedAt | String | 10 / Pflicht |

Erstellt einen Index auf `cookedAt`.

### Gemeinsamen Haushalt freigeben

1. Unter **Auth > Teams** ein Team anlegen, z. B. `Unser Haushalt`.
2. Beide Benutzerkonten zum Team hinzufügen.
3. Die Team-ID kopieren.
4. Die Collections mit aktivierter Document Security verwenden.

Die App vergibt für neu erstellte Dokumente Lese-, Änderungs- und Löschrechte an dieses Team. Bereits vorhandene Dokumente müssen entsprechend freigegeben werden. Prüft außerdem die Berechtigungen der Collections und aktiviert die benötigten Create-Rechte für angemeldete Teammitglieder.

## 3. Konfiguration

`.env.example` nach `.env` kopieren und die Werte aus Appwrite eintragen:

```env
VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=...
VITE_APPWRITE_DATABASE_ID=rezeptkompass
VITE_APPWRITE_RECIPES_COLLECTION_ID=recipes
VITE_APPWRITE_PLANS_COLLECTION_ID=plans
VITE_APPWRITE_HISTORY_COLLECTION_ID=history
VITE_APPWRITE_TEAM_ID=...
```

Danach `npm run dev` neu starten.

## 4. Auf GitHub Pages veröffentlichen

1. Neues GitHub-Repository erstellen und dieses Projekt hochladen.
2. In `vite.config.js` `REPO_NAME` durch den Repository-Namen ersetzen.
3. Unter **Settings > Pages** als Build-Quelle **GitHub Actions** auswählen.
4. Unter **Settings > Secrets and variables > Actions > Variables** die sieben `VITE_APPWRITE_*` Variablen aus `.env` als Repository Variables hinterlegen.
5. Auf den `main`-Branch pushen. Der Workflow baut und veröffentlicht die App.

Die Appwrite-Webplattform muss die endgültige GitHub-Pages-Adresse als erlaubten Host enthalten.

## Aktueller Funktionsumfang

- Rezepte anlegen, bearbeiten und löschen
- Labels: Fleisch, Fisch, Vegetarisch, Süßspeise, Wochenende
- Suche nach Rezeptname und Zutaten
- Wochenplan mit Austausch von Gerichten
- „Als gekocht markieren“ mit Kochhistorie
- Anzeige „Zuletzt vor X Tagen gekocht“
- Demo-Modus ohne Backend zum Ausprobieren

## Noch nicht enthalten

- Rezeptbilder-Upload
- Automatischer Wochenplan-Vorschlag
- Einkaufsliste
- Mehrere Gerichte pro Tag
- Import von Rezepten aus Webseiten

## Datenschutz-Hinweis

Die `VITE_*` Variablen sind im Browser sichtbar. Dort gehören ausschließlich öffentliche Projekt- und Collection-IDs hinein, niemals Appwrite API Keys oder andere Geheimnisse. Zugriff muss über Appwrite Auth, Team-Mitgliedschaften und Dokumentberechtigungen geregelt werden.
