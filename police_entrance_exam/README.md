# Police Entrance Exam – FiveM Resource

Standalone FiveM-Resource für eine digitale Polizei-Eignungsprüfung. Es wird kein ESX, QBCore, Node.js oder MySQL benötigt.

## Installation

1. Den Ordner `police_entrance_exam` nach `resources/[local]/` kopieren.
2. In `server.cfg` eintragen:

```cfg
ensure police_entrance_exam
```

3. Server starten oder in der Serverkonsole ausführen:

```text
refresh
restart police_entrance_exam
```

4. Im Spiel `/policeexam` eingeben.

## Wichtige Konfiguration

In `server_config.lua` die Personal-Zugangsdaten vor dem Produktivbetrieb ändern. Diese Datei wird nicht an Clients ausgeliefert:

```lua
Config.StaffAccounts = {
    {
        username = 'admin',
        password = 'DEIN_SICHERES_PASSWORT',
        displayName = 'Personalwesen',
        rank = 'Polizeioberrat',
        jobGrade = 10
    }
}
```

In `config.lua` festlegen, ab welchem Job-Grade erweiterte Einstellungen verfügbar sind:

```lua
Config.SettingsAccessFromGrade = 10
```

Nur Mitarbeiter mit diesem oder einem höheren Job-Grade können:

- das eigene Passwort ändern,
- neue Mitarbeiterzugänge erstellen,
- bestehende Mitarbeiterzugänge verwalten.

### Tablet nur mit bestimmtem Job öffnen

In `config.lua` unter `Config.TabletAccess.Jobs` die erlaubten Jobs eintragen. Der Befehl `/policeexam`, Keybind, Export und Event prüfen den Job (ESX, QBCore/QBox oder Player-Statebag):

```lua
Config.TabletAccess = {
    Jobs = {
        { name = 'police', minGrade = 0 },
    },
    DenyMessage = 'Du hast nicht den erforderlichen Job, um das Tablet zu öffnen.',
}
```

Leere `Jobs`-Liste = keine Job-Prüfung.

### Prüfungs-Startpunkte (vector4)

Bewerber starten die Prüfung an konfigurierten Orten (`E`-Taste). Format: `vector4(x, y, z, heading)`.

```lua
Config.ExamStartPoints = {
    {
        coords = vector4(441.18, -981.13, 30.69, 90.0),
        label = 'Eignungsprüfung starten',
        radius = 2.0,
        placePlayer = true,
    },
}
```

Personal mit erlaubtem Job kann das Tablet weiterhin überall per Befehl öffnen. Bewerber ohne Tablet-Job nutzen die Startpunkte.

Standardzugang der ausgelieferten Version:

- Benutzer: `admin`
- Passwort: `PoliceExam2026!`
- Job-Grade: `10` (Zugang zu den erweiterten Einstellungen)

Mitarbeiterzugänge werden zur Laufzeit in `data/staff_accounts.json` gespeichert (beim ersten Start aus `Config.StaffAccounts` übernommen).

## Bewertungsskala

Für Bereichs- und Gesamtbewertungen werden ausschließlich diese Stufen verwendet:

- Ungenügend
- Mangelhaft
- Ausreichend
- Befriedigend
- Gut
- Sehr gut

Die Bewertung erscheint im Admin-Dashboard und auf ausgestellten Zertifikaten.

## Verwendung

1. Personalwesen-Login öffnen.
2. Unter **Zugangscodes** Name und Geburtsdatum des Bewerbers eintragen.
3. Auf **Code erstellen** klicken. Der Zugangscode wird jetzt ausschließlich serverseitig erzeugt und gespeichert.
4. Der Bewerber öffnet `/policeexam`, trägt dieselben Personendaten und den Code ein.
5. Nach der letzten Frage wird die Prüfung serverseitig ausgewertet.
6. Die vollständige Prüfungsakte wird automatisch in `data/records.json` gespeichert und erscheint unter **Prüfungsakten**.

## Persistenz

Die Daten werden automatisch in folgenden Dateien gespeichert:

- `data/records.json`
- `data/access_codes.json`

Der FiveM-Serverprozess benötigt Schreibrechte im Resource-Ordner. Bei fehlenden Schreibrechten zeigt die Oberfläche nun eine konkrete Fehlermeldung an und der Server schreibt einen Hinweis in die Konsole.

### Schreibrechte unter Linux prüfen

Beispiel, wobei der Benutzername des FiveM-Prozesses angepasst werden muss:

```bash
chown -R fivem:fivem police_entrance_exam
chmod -R u+rwX police_entrance_exam
```

## Änderungen in Version 1.1.0

- Zugangscodes werden serverseitig erzeugt und auf Eindeutigkeit geprüft.
- Name, Geburtsdatum, Erstellungszeit und Ersteller werden serverseitig validiert.
- Abgeschlossene Prüfungen werden über eine eigene serverseitige `exam:submit`-Aktion gespeichert.
- Akten-ID, Bewerbernummer, Abschlusszeit und Auswertung werden serverseitig erstellt.
- Doppelte Speicheranfragen liefern dieselbe bereits gespeicherte Akte zurück.
- Dateischreibvorgänge werden direkt nach dem Speichern geprüft.
- Das Adminpanel aktualisiert nicht mehr alle fünf Sekunden während einer Eingabe und löscht dadurch keine Formulardaten mehr.

## Events und Exports

Client-Event zum Öffnen:

```lua
TriggerEvent('police_exam:client:open')
```

Client-Export:

```lua
exports['police_entrance_exam']:OpenExam()
```

Optional kann in `config.lua` ein Keybind gesetzt werden:

```lua
Config.DefaultKey = 'F7'
```

## Hinweise

- Die Resource ist standalone und damit mit ESX, QBCore und anderen Frameworks parallel nutzbar.
- Personal-Aktionen werden serverseitig nur nach erfolgreicher Anmeldung zugelassen.
- Die Antworten werden serverseitig ausgewertet; der Lösungsschlüssel wird nicht an Clients ausgeliefert.
- Zugangscodes sind einmalig und an Name sowie Geburtsdatum gebunden.
- Die enthaltenen Behördenbezeichnungen und Dokumente sind für Roleplay gedacht und besitzen keine behördliche Rechtskraft.

## Änderungen in Version 1.2.0

- Bewerber erhalten nach der Abgabe nur noch eine neutrale Eingangsbestätigung.
- Punkte, Bestehensstatus und Detailauswertung werden dem Bewerber nicht mehr an die NUI zurückgegeben.
- Das vollständige Ergebnis ist ausschließlich im Admin-Dashboard sichtbar.
- Zertifikate werden ausschließlich serverseitig und nur für bestandene Prüfungen ausgestellt.
- Ausgestellte Zertifikatsnummer, Datum und ausstellende Person werden in der Prüfungsakte gespeichert.
- Das Löschen einzelner oder aller Akten nutzt eine FiveM-kompatible Bestätigung direkt im Dashboard statt eines Browser-Dialogs.
- Der Server bestätigt das Löschen mit der tatsächlich entfernten Akten-ID und meldet fehlende Akten als Fehler.

## Änderungen in Version 1.4.0

- Tablet-Öffnung per Befehl/Keybind/Export nur noch mit konfigurierbaren Jobs (`Config.TabletAccess`).
- Prüfungs-Startpunkte für Bewerber über `Config.ExamStartPoints` mit `vector4(x, y, z, heading)`.
- Admin-Tabs (Prüfungsakten / Zugangscodes / Einstellungen) als klare Segment-Buttons.
- Einstellungen-Layout neu geordnet (Passwort, Anlegen, Bearbeiten).
