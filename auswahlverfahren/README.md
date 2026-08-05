# Auswahlverfahren – FiveM Resource

Standalone FiveM-Resource für ein digitales Polizei-Auswahlverfahren. Es wird kein ESX, QBCore, Node.js oder MySQL benötigt.

## Installation

1. Den Ordner `auswahlverfahren` nach `resources/[local]/` kopieren.
2. In `server.cfg` eintragen:

```cfg
ensure auswahlverfahren
```

3. Server starten oder in der Serverkonsole ausführen:

```text
refresh
restart auswahlverfahren
```

4. Im Spiel `/auswahlverfahren` eingeben.

## Konfiguration (nur `config.lua`)

Alle Einstellungen liegen in **einer Datei**: `config.lua`.

Nach jeder Änderung in der Serverkonsole:

```text
refresh
restart auswahlverfahren
```

### Wichtige Bereiche in `config.lua`

| Bereich | Beschreibung |
|--------|--------------|
| `Config.Command` | Chat-Befehl zum Öffnen |
| `Config.Exam` | Bestehensgrenzen |
| `Config.Branding` | Dienststelle, Logo, Titel |
| `Config.StaffAccounts` | Start-Personal-Konten |
| `Config.TabletAccess` | Job-Prüfung für Tablet-Befehl |
| `Config.ExamStartPoints` | Bewerber-Startpunkte (E-Taste) |
| `Config.Permissions` | Erlaubte Rang-IDs für Passwortänderung |
| `Config.ExamQuestions` | Lösungsschlüssel (serverseitig) |

### Police-Rang-IDs (Berechtigungen)

```lua
Config.Police = {
    JobName = 'police',
    Framework = 'auto', -- auto | esx | qbcore | none
}

Config.Permissions = {
    ChangePasswordRankIds = { 5 },       -- nur diese Ränge dürfen eigenes Passwort ändern
    ResetStaffPasswordRankIds = { 8 },   -- nur diese Ränge dürfen andere Konten zurücksetzen
}
```

Der Rang wird live aus dem Police-Job gelesen (`job.grade`). Ohne ESX/QBCore wird `rankId` aus dem Personal-Konto verwendet.

### Personal-Zugang (Standard)

```lua
Config.StaffAccounts = {
    {
        username = 'admin',
        password = 'DEIN_SICHERES_PASSWORT',
        displayName = 'Personalwesen',
        rankId = 8,
    },
}
```

Standardzugang der ausgelieferten Version:

- Benutzer: `admin`
- Passwort: `PoliceExam2026!`

### Passwort im System ändern

Nur die in `ChangePasswordRankIds` eingetragenen Police-Ränge dürfen das eigene Passwort unter **Einstellungen** ändern (z. B. nur Rang `5`, nicht Rang `7`).

Nur die in `ResetStaffPasswordRankIds` eingetragenen Ränge dürfen Passwörter anderer Konten zurücksetzen.

Geänderte Passwörter werden in `data/staff_accounts.json` gespeichert und überleben einen Neustart.

## Verwendung

1. Personalwesen-Login öffnen.
2. Unter **Zugangscodes** Name und Geburtsdatum des Bewerbers eintragen.
3. Auf **Code erstellen** klicken.
4. Der Bewerber öffnet `/auswahlverfahren`, trägt dieselben Personendaten und den Code ein.
5. Nach der letzten Frage wird die Prüfung serverseitig ausgewertet.
6. Die Prüfungsakte erscheint unter **Prüfungsakten**.

## Persistenz

- `data/records.json` – Prüfungsakten
- `data/access_codes.json` – Zugangscodes
- `data/staff_accounts.json` – Personal-Konten inkl. geänderter Passwörter

## Events und Exports

```lua
TriggerEvent('police_exam:client:open')
exports['auswahlverfahren']:OpenExam()
```

Optional in `config.lua`:

```lua
Config.DefaultKey = 'F7'
```

## Hinweise

- Standalone – parallel mit ESX, QBCore usw. nutzbar.
- Antworten werden serverseitig ausgewertet; der Lösungsschlüssel wird nicht an Clients ausgeliefert.
- Zugangscodes sind einmalig und an Name sowie Geburtsdatum gebunden.
