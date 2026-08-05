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
| `Config.StaffRanks` | Rang-Hierarchie |
| `Config.Permissions` | Wer Passwörter ändern darf |
| `Config.ExamQuestions` | Lösungsschlüssel (serverseitig) |

### Personal-Zugang (Standard)

```lua
Config.StaffAccounts = {
    {
        username = 'admin',
        password = 'DEIN_SICHERES_PASSWORT',
        displayName = 'Personalwesen',
        rank = 'Administration',
    },
}
```

Standardzugang der ausgelieferten Version:

- Benutzer: `admin`
- Passwort: `PoliceExam2026!`

### Passwort im System ändern

Ab dem in `Config.Permissions.ChangePasswordMinRank` festgelegten Rang kann Personal das eigene Passwort im Admin-Bereich unter **Einstellungen** ändern.

Mit Rang `Administration` (`ResetStaffPasswordMinRank`) können zusätzlich Passwörter anderer Konten zurückgesetzt werden.

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
