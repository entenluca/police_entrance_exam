Config = {}

-- Befehl zum Öffnen der Anwendung.
Config.Command = 'policeexam'

-- Optionales Standard-Keybind. Auf false setzen, um kein Keybind anzulegen.
Config.DefaultKey = false -- Beispiel: 'F7'

-- Maximale Anzahl gespeicherter Prüfungsakten.
Config.MaxRecords = 500

-- Gültigkeitsdauer einer gestarteten Bewerbersitzung in Sekunden.
Config.CandidateSessionTimeout = 3600

-- Konsolenmeldungen für Speicher- und RPC-Fehler.
Config.Debug = false

-- Realistische Bestehensregeln für das Auswahlverfahren
Config.Exam = {
    -- Mindest-Gesamtquote in Prozent (typisch anspruchsvoll für Polizei-Auswahl)
    PassPercentage = 78,
    -- Mindestquote in JEDEM Prüfungsbereich (kein Bereich darf zu schwach sein)
    CategoryMinimum = 55,
    -- Ab dieser Gesamtquote gilt die Bewertung „sehr geeignet“
    ExcellentPercentage = 88,
}

-- Ab diesem Job-Grade erhalten Mitarbeiter Zugriff auf erweiterte Einstellungen
-- (eigenes Passwort ändern, Mitarbeiterzugänge erstellen und verwalten).
-- Beispiel höherer Dienst ab Polizeioberrat: SettingsAccessFromGrade = 10
Config.SettingsAccessFromGrade = 10

--[[
  Tablet-Zugriff per Befehl / Keybind / Export / Event.
  Nur Spieler mit einem der gelisteten Jobs dürfen das Tablet so öffnen.
  Leere Liste = keine Job-Prüfung (jeder darf den Befehl nutzen).

  Frameworks: ESX, QBCore/QBox und Player-Statebag (job.name / job.grade).
]]
Config.TabletAccess = {
    Jobs = {
        { name = 'police', minGrade = 0 },
        -- { name = 'sheriff', minGrade = 0 },
    },
    DenyMessage = 'Du hast nicht den erforderlichen Job, um das Tablet zu öffnen.',
}

--[[
  Prüfungs-Startpunkte für Bewerber (vector4 = x, y, z, heading).
  Spieler ohne Tablet-Job können die Prüfung nur an diesen Orten starten (E-Taste).
  Personal mit erlaubtem Job kann das Tablet weiterhin überall per Befehl öffnen.
]]
Config.ExamStartPoints = {
    {
        coords = vector4(441.18, -981.13, 30.69, 90.0),
        label = 'Eignungsprüfung starten',
        radius = 2.0,
        drawDistance = 25.0,
        placePlayer = true, -- Spieler an die vector4-Position setzen
        blip = {
            enabled = true,
            sprite = 498,
            color = 3,
            scale = 0.75,
            label = 'Polizei-Eignungsprüfung',
        },
        marker = {
            enabled = true,
            type = 1,
            size = vector3(1.4, 1.4, 0.55),
            color = { r = 10, g = 77, b = 143, a = 140 },
        },
    },
    -- Weitere Startpunkte:
    -- {
    --     coords = vector4(0.0, 0.0, 0.0, 0.0),
    --     label = 'Prüfungsraum 2',
    --     radius = 2.0,
    --     drawDistance = 25.0,
    --     placePlayer = true,
    -- },
}
